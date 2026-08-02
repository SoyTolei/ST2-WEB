using System.Security.Cryptography;
using System.Text.RegularExpressions;
using PortalClienchi.Core.Configuration;
using PortalClienchi.Core.Models;

namespace PortalClienchi.Web.Planillas;

/// <summary>
/// Guarda capturas en el Volume ST2 (/data/st2/capturas) sin recomprimir (calidad original)
/// y las sirve por id corto (/c/{id}).
/// </summary>
public sealed partial class LocalCapturaStore
{
    /// <summary>Alfabeto sin caracteres ambiguos (0/O, 1/l/I).</summary>
    private const string ShortAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

    private static readonly string[] StoredExts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"];

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

        // Sin recomprimir: subimos un poco el techo para PNGs de pantalla completa.
        var maxBytes = Math.Clamp(_settings.MaxFileBytes, 256 * 1024, 25 * 1024 * 1024);
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

                // Calidad original: no reencodear. Solo normalizar extensión por magic bytes.
                var outExt = GuessExt(raw);
                if (outExt == ".bin" && AllowedExt.Contains(ext))
                    outExt = ext.Equals(".jpeg", StringComparison.OrdinalIgnoreCase) ? ".jpg" : ext.ToLowerInvariant();

                if (outExt == ".bin")
                {
                    results.Add(new CapturaSubidaResult(safeName, null, "No se reconoció la imagen."));
                    continue;
                }

                var id = NewShortId();
                var storedName = id + outExt;
                var path = Path.Combine(_root, storedName);
                await File.WriteAllBytesAsync(path, raw, ct).ConfigureAwait(false);

                var url = $"{baseUrl}/c/{id}";
                _logger.LogInformation("Captura guardada {Id} ({Bytes} bytes) → {Url}", id, raw.Length, url);
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

    /// <summary>Abre por id corto (/c/{id}).</summary>
    public bool TryOpenById(string id, out string fullPath, out string contentType)
    {
        fullPath = "";
        contentType = "application/octet-stream";

        if (string.IsNullOrWhiteSpace(id))
            return false;

        id = id.Trim();
        if (!ShortIdRegex().IsMatch(id))
        {
            _logger.LogWarning("Id de captura inválido: {Id}", id);
            return false;
        }

        foreach (var ext in StoredExts)
        {
            var path = Path.Combine(_root, id + ext);
            if (!File.Exists(path))
                continue;

            fullPath = path;
            contentType = MimeForExt(ext);
            return true;
        }

        _logger.LogWarning("Captura no encontrada: {Id} en {Root}", id, _root);
        return false;
    }

    /// <summary>Compat: formato largo /media/capturas/{token}.ext</summary>
    public bool TryOpen(string tokenWithExt, out string fullPath, out string contentType)
    {
        fullPath = "";
        contentType = "application/octet-stream";

        if (string.IsNullOrWhiteSpace(tokenWithExt))
            return false;

        var name = Path.GetFileName(tokenWithExt.Trim());
        if (ShortIdRegex().IsMatch(name))
            return TryOpenById(name, out fullPath, out contentType);

        if (!LegacyTokenFileRegex().IsMatch(name))
            return false;

        var path = Path.Combine(_root, name);
        if (!File.Exists(path))
            return false;

        fullPath = path;
        contentType = MimeForExt(Path.GetExtension(name));
        return true;
    }

    private string NewShortId()
    {
        Span<byte> bytes = stackalloc byte[8];
        for (var attempt = 0; attempt < 12; attempt++)
        {
            RandomNumberGenerator.Fill(bytes);
            var chars = new char[8];
            for (var i = 0; i < 8; i++)
                chars[i] = ShortAlphabet[bytes[i] % ShortAlphabet.Length];

            var id = new string(chars);
            var taken = StoredExts.Any(ext => File.Exists(Path.Combine(_root, id + ext)));
            if (!taken)
                return id;
        }

        throw new InvalidOperationException("No se pudo generar un id único para la captura.");
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

    private static bool LooksLikeImage(byte[] raw)
    {
        if (raw.Length < 12)
            return false;
        if (raw[0] == 0x89 && raw[1] == 0x50 && raw[2] == 0x4E && raw[3] == 0x47)
            return true;
        if (raw[0] == 0xFF && raw[1] == 0xD8)
            return true;
        if (raw[0] == 0x47 && raw[1] == 0x49 && raw[2] == 0x46)
            return true;
        if (raw[0] == 0x52 && raw[1] == 0x49 && raw[2] == 0x46 && raw[3] == 0x46
            && raw[8] == 0x57 && raw[9] == 0x45 && raw[10] == 0x42 && raw[11] == 0x50)
            return true;
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
        if (raw.Length >= 2 && raw[0] == 0x42 && raw[1] == 0x4D)
            return ".bmp";
        return ".bin";
    }

    private static string MimeForExt(string ext) => ext.ToLowerInvariant() switch
    {
        ".webp" => "image/webp",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".png" => "image/png",
        ".gif" => "image/gif",
        ".bmp" => "image/bmp",
        _ => "application/octet-stream",
    };

    private static string NormalizeBaseUrl(string? fromRequest, string fromSettings)
    {
        var candidate = !string.IsNullOrWhiteSpace(fromSettings) ? fromSettings : fromRequest;
        if (string.IsNullOrWhiteSpace(candidate))
            return "";

        candidate = candidate.Trim().TrimEnd('/');

        // Evitar links http rotos detrás del proxy de Railway.
        if (candidate.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            && candidate.Contains("tolei.dev", StringComparison.OrdinalIgnoreCase))
        {
            candidate = "https://" + candidate["http://".Length..];
        }

        return candidate;
    }

    [GeneratedRegex(@"^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{8}$", RegexOptions.CultureInvariant)]
    private static partial Regex ShortIdRegex();

    [GeneratedRegex(@"^[a-f0-9]{32}\.(webp|jpg|jpeg|png|gif|bmp)$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex LegacyTokenFileRegex();
}
