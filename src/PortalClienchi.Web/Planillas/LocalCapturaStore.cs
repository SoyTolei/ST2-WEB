using System.Security.Cryptography;
using System.Text.RegularExpressions;
using PortalClienchi.Core.Configuration;
using PortalClienchi.Core.Models;
using SkiaSharp;

namespace PortalClienchi.Web.Planillas;

/// <summary>
/// Guarda capturas comprimidas en el Volume ST2 (/data/st2/capturas) y las sirve por token opaco.
/// </summary>
public sealed partial class LocalCapturaStore
{
    private static readonly HashSet<string> AllowedExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp",
    };

    private readonly CapturaHostingSettings _settings;
    private readonly ILogger<LocalCapturaStore> _logger;
    private readonly string _root;
    private readonly object _purgeLock = new();

    public LocalCapturaStore(AppSettings settings, ILogger<LocalCapturaStore> logger)
    {
        _settings = settings.CapturaHosting;
        _logger = logger;
        _root = Path.Combine(St2Paths.GetDataDirectory(), "capturas");
        Directory.CreateDirectory(_root);
        _logger.LogInformation("Capturas locales en {Root}", _root);
    }

    public string RootPath => _root;

    public async Task<IReadOnlyList<CapturaSubidaResult>> GuardarAsync(
        IReadOnlyList<(string FileName, Stream Content)> archivos,
        string publicBaseUrl,
        CancellationToken ct = default)
    {
        PurgeExpired();

        var maxFiles = Math.Clamp(_settings.MaxFilesPerRequest, 1, 50);
        if (archivos.Count > maxFiles)
            throw new InvalidOperationException($"Máximo {maxFiles} imágenes por subida.");

        var baseUrl = NormalizeBaseUrl(publicBaseUrl, _settings.PublicBaseUrl);
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new InvalidOperationException("No se pudo determinar la URL pública de las capturas.");

        var maxBytes = Math.Clamp(_settings.MaxFileBytes, 256 * 1024, 20 * 1024 * 1024);
        var results = new List<CapturaSubidaResult>(archivos.Count);

        foreach (var (fileName, content) in archivos)
        {
            ct.ThrowIfCancellationRequested();
            var safeName = Path.GetFileName(fileName);
            if (string.IsNullOrWhiteSpace(safeName))
                safeName = "captura.png";

            try
            {
                await using var ms = new MemoryStream();
                await content.CopyToAsync(ms, ct).ConfigureAwait(false);
                var raw = ms.ToArray();

                if (raw.Length == 0)
                {
                    results.Add(new CapturaSubidaResult(safeName, null, "Archivo vacío."));
                    continue;
                }

                if (raw.Length > maxBytes)
                {
                    results.Add(new CapturaSubidaResult(
                        safeName,
                        null,
                        $"Supera el máximo de {maxBytes / (1024 * 1024.0):0.#} MB."));
                    continue;
                }

                var ext = Path.GetExtension(safeName);
                if (!AllowedExt.Contains(ext) && !LooksLikeImage(raw))
                {
                    results.Add(new CapturaSubidaResult(safeName, null, "Formato no permitido."));
                    continue;
                }

                var (bytes, outExt, contentType) = CompressImage(raw);
                var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
                var storedName = token + outExt;
                var path = Path.Combine(_root, storedName);
                await File.WriteAllBytesAsync(path, bytes, ct).ConfigureAwait(false);

                var url = $"{baseUrl}/media/capturas/{storedName}";
                results.Add(new CapturaSubidaResult(safeName, url, null));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error al guardar captura {File}", safeName);
                results.Add(new CapturaSubidaResult(safeName, null, ex.Message));
            }
        }

        return results;
    }

    public bool TryOpen(string tokenWithExt, out string fullPath, out string contentType)
    {
        fullPath = "";
        contentType = "application/octet-stream";

        if (string.IsNullOrWhiteSpace(tokenWithExt))
            return false;

        var name = Path.GetFileName(tokenWithExt.Trim());
        if (!TokenFileRegex().IsMatch(name))
            return false;

        var path = Path.Combine(_root, name);
        if (!File.Exists(path))
            return false;

        fullPath = path;
        contentType = Path.GetExtension(name).ToLowerInvariant() switch
        {
            ".webp" => "image/webp",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            _ => "application/octet-stream",
        };
        return true;
    }

    public int PurgeExpired()
    {
        var ttl = _settings.TtlDays;
        if (ttl <= 0)
            return 0;

        lock (_purgeLock)
        {
            var cutoff = DateTime.UtcNow.AddDays(-ttl);
            var removed = 0;
            try
            {
                foreach (var file in Directory.EnumerateFiles(_root, "*", SearchOption.TopDirectoryOnly))
                {
                    DateTime stamp;
                    try
                    {
                        stamp = File.GetLastWriteTimeUtc(file);
                    }
                    catch
                    {
                        continue;
                    }

                    if (stamp >= cutoff)
                        continue;

                    try
                    {
                        File.Delete(file);
                        removed++;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogDebug(ex, "No se pudo borrar captura vencida {File}", file);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error al purgar capturas vencidas en {Root}", _root);
            }

            if (removed > 0)
                _logger.LogInformation("Purgadas {Count} capturas con más de {Days} días", removed, ttl);

            return removed;
        }
    }

    private (byte[] Bytes, string Ext, string ContentType) CompressImage(byte[] raw)
    {
        var maxWidth = Math.Clamp(_settings.MaxWidthPx, 640, 4096);
        var quality = Math.Clamp(_settings.JpegQuality, 40, 95);

        using var bitmap = SKBitmap.Decode(raw);
        if (bitmap is null)
        {
            // No se pudo decodificar: guardar original si la extensión es conocida
            var fallbackExt = GuessExt(raw);
            return (raw, fallbackExt, MimeForExt(fallbackExt));
        }

        SKBitmap working = bitmap;
        SKBitmap? scaled = null;
        try
        {
            if (bitmap.Width > maxWidth)
            {
                var h = (int)Math.Round(bitmap.Height * (maxWidth / (double)bitmap.Width));
                scaled = bitmap.Resize(new SKImageInfo(maxWidth, Math.Max(1, h)), SKFilterQuality.Medium);
                if (scaled is not null)
                    working = scaled;
            }

            using var image = SKImage.FromBitmap(working);
            using var webp = image.Encode(SKEncodedImageFormat.Webp, quality);
            if (webp is not null)
            {
                var compressed = webp.ToArray();
                // Si la original ya era chica y comprimida sale peor, conservar original
                if (compressed.Length < raw.Length || raw.Length > 400_000)
                    return (compressed, ".webp", "image/webp");
            }

            using var jpeg = image.Encode(SKEncodedImageFormat.Jpeg, quality);
            if (jpeg is not null)
            {
                var compressed = jpeg.ToArray();
                if (compressed.Length < raw.Length || raw.Length > 400_000)
                    return (compressed, ".jpg", "image/jpeg");
            }

            var ext = GuessExt(raw);
            return (raw, ext, MimeForExt(ext));
        }
        finally
        {
            scaled?.Dispose();
        }
    }

    private static bool LooksLikeImage(byte[] raw)
    {
        if (raw.Length < 12)
            return false;
        // PNG
        if (raw[0] == 0x89 && raw[1] == 0x50 && raw[2] == 0x4E && raw[3] == 0x47)
            return true;
        // JPEG
        if (raw[0] == 0xFF && raw[1] == 0xD8)
            return true;
        // GIF
        if (raw[0] == 0x47 && raw[1] == 0x49 && raw[2] == 0x46)
            return true;
        // WEBP
        if (raw[0] == 0x52 && raw[1] == 0x49 && raw[2] == 0x46 && raw[3] == 0x46
            && raw[8] == 0x57 && raw[9] == 0x45 && raw[10] == 0x42 && raw[11] == 0x50)
            return true;
        // BMP
        if (raw[0] == 0x42 && raw[1] == 0x4D)
            return true;
        return false;
    }

    private static string GuessExt(byte[] raw)
    {
        if (raw.Length >= 3 && raw[0] == 0xFF && raw[1] == 0xD8)
            return ".jpg";
        if (raw.Length >= 4 && raw[0] == 0x89 && raw[1] == 0x50)
            return ".png";
        if (raw.Length >= 3 && raw[0] == 0x47 && raw[1] == 0x49)
            return ".gif";
        if (raw.Length >= 12 && raw[8] == 0x57 && raw[9] == 0x45)
            return ".webp";
        return ".bin";
    }

    private static string MimeForExt(string ext) => ext.ToLowerInvariant() switch
    {
        ".webp" => "image/webp",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".png" => "image/png",
        ".gif" => "image/gif",
        _ => "application/octet-stream",
    };

    private static string NormalizeBaseUrl(string? fromRequest, string fromSettings)
    {
        var candidate = !string.IsNullOrWhiteSpace(fromSettings) ? fromSettings : fromRequest;
        if (string.IsNullOrWhiteSpace(candidate))
            return "";
        return candidate.Trim().TrimEnd('/');
    }

    [GeneratedRegex(@"^[a-f0-9]{32}\.(webp|jpg|jpeg|png|gif)$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex TokenFileRegex();
}
