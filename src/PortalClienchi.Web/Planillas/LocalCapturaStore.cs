using System.Security.Cryptography;
using System.Text.RegularExpressions;
using PortalClienchi.Core.Configuration;
using PortalClienchi.Core.Models;

namespace PortalClienchi.Web.Planillas;

/// <summary>
/// Guarda capturas en el Volume ST2 (/data/st2/capturas) sin recomprimir (calidad original)
/// y las sirve por id corto (/c/{id}).
/// </summary>
public sealed class LocalCapturaStore
{
    /// <summary>Alfabeto sin caracteres ambiguos (0/O, 1/l/I).</summary>
    private const string ShortAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

    private static readonly Regex ShortIdRegex = new(
        @"^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{8}$",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private static readonly Regex LegacyTokenFileRegex = new(
        @"^[a-f0-9]{32}\.(webp|jpg|jpeg|png|gif|bmp)$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private static readonly string[] StoredExts =
    [
        ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp",
        ".mp4", ".webm",
        ".pdf",
        ".xlsx", ".xls",
        ".xml",
        ".trc", ".csv", ".txt",
    ];

    private static readonly HashSet<string> AllowedExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp",
    };

    private static readonly HashSet<string> AllowedVideoExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".webm",
    };

    private static readonly HashSet<string> AllowedPdfExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf",
    };

    private static readonly HashSet<string> AllowedExcelExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".xlsx", ".xls",
    };

    private static readonly HashSet<string> AllowedXmlExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".xml",
    };

    private static readonly HashSet<string> AllowedDownloadExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".trc", ".csv", ".txt",
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
        EnsureRoot();
        _logger.LogInformation("Capturas locales en {Root}", _root);
    }

    public string RootPath => _root;

    private void EnsureRoot()
    {
        try
        {
            Directory.CreateDirectory(_root);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "No se pudo crear el directorio de capturas {Root}", _root);
        }
    }

    public async Task<IReadOnlyList<CapturaSubidaResult>> GuardarAsync(
        IReadOnlyList<(string FileName, Stream Content)> archivos,
        string publicBaseUrl,
        CancellationToken ct = default)
    {
        EnsureRoot();
        PurgeExpired();

        var maxFiles = Math.Clamp(_settings.MaxFilesPerRequest, 1, 50);
        if (archivos.Count > maxFiles)
            throw new InvalidOperationException($"Máximo {maxFiles} archivos por subida.");

        var maxVideos = Math.Clamp(_settings.MaxVideosPerRequest, 1, 5);
        var videoCount = archivos.Count(a => AllowedVideoExt.Contains(Path.GetExtension(a.FileName)));
        if (videoCount > maxVideos)
            throw new InvalidOperationException(
                maxVideos == 1
                    ? "Solo se permite 1 video por subida."
                    : $"Máximo {maxVideos} video(s) por subida.");

        var baseUrl = NormalizeBaseUrl(publicBaseUrl, _settings.PublicBaseUrl);
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new InvalidOperationException("No se pudo determinar la URL pública de las capturas.");

        var maxImageBytes = Math.Clamp(_settings.MaxFileBytes, 256 * 1024, 25 * 1024 * 1024);
        var maxVideoBytes = Math.Clamp(_settings.MaxVideoFileBytes, 1024 * 1024, 120 * 1024 * 1024);
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

                var ext = Path.GetExtension(safeName);
                var isVideo = AllowedVideoExt.Contains(ext);
                var isPdf = AllowedPdfExt.Contains(ext) || LooksLikePdf(raw);
                var isTxt = ext.Equals(".txt", StringComparison.OrdinalIgnoreCase);
                var isExcel = AllowedExcelExt.Contains(ext);
                var isXml = AllowedXmlExt.Contains(ext);

                if (isVideo)
                {
                    if (raw.Length > maxVideoBytes)
                    {
                        results.Add(new CapturaSubidaResult(
                            safeName,
                            null,
                            $"El video supera el máximo de {maxVideoBytes / (1024 * 1024.0):0.#} MB. Recomendamos subirlo en los comentarios del caso."));
                        continue;
                    }

                    var videoExt = ext.ToLowerInvariant();
                    EnsureRoot();
                    var videoId = NewShortId();
                    await File.WriteAllBytesAsync(Path.Combine(_root, videoId + videoExt), raw, ct)
                        .ConfigureAwait(false);

                    var videoUrl = $"{baseUrl}/c/{videoId}";
                    _logger.LogInformation("Video guardado {Id} ({Bytes} bytes) → {Url}", videoId, raw.Length, videoUrl);
                    results.Add(new CapturaSubidaResult(safeName, videoUrl, null));
                    continue;
                }

                if (isPdf)
                {
                    if (raw.Length > maxImageBytes)
                    {
                        results.Add(new CapturaSubidaResult(
                            safeName,
                            null,
                            $"El PDF supera el máximo de {maxImageBytes / (1024 * 1024.0):0.#} MB."));
                        continue;
                    }

                    if (!LooksLikePdf(raw))
                    {
                        results.Add(new CapturaSubidaResult(safeName, null, "El archivo no parece un PDF válido."));
                        continue;
                    }

                    EnsureRoot();
                    var pdfId = NewShortId();
                    await File.WriteAllBytesAsync(Path.Combine(_root, pdfId + ".pdf"), raw, ct)
                        .ConfigureAwait(false);

                    var pdfUrl = $"{baseUrl}/c/{pdfId}";
                    _logger.LogInformation("PDF guardado {Id} ({Bytes} bytes) → {Url}", pdfId, raw.Length, pdfUrl);
                    results.Add(new CapturaSubidaResult(safeName, pdfUrl, null));
                    continue;
                }

                if (isTxt)
                {
                    if (raw.Length > maxImageBytes)
                    {
                        results.Add(new CapturaSubidaResult(
                            safeName,
                            null,
                            $"El TXT supera el máximo de {maxImageBytes / (1024 * 1024.0):0.#} MB."));
                        continue;
                    }

                    EnsureRoot();
                    var txtId = NewShortId();
                    await File.WriteAllBytesAsync(Path.Combine(_root, txtId + ".txt"), raw, ct)
                        .ConfigureAwait(false);
                    var downloadName = SanitizeDownloadName(safeName, ".txt");
                    await File.WriteAllTextAsync(
                        Path.Combine(_root, txtId + ".meta"),
                        downloadName,
                        ct).ConfigureAwait(false);

                    var txtUrl = $"{baseUrl}/c/{txtId}";
                    _logger.LogInformation("TXT guardado {Id} ({Bytes} bytes) → {Url}", txtId, raw.Length, txtUrl);
                    results.Add(new CapturaSubidaResult(safeName, txtUrl, null));
                    continue;
                }

                if (isExcel)
                {
                    if (raw.Length > maxImageBytes)
                    {
                        results.Add(new CapturaSubidaResult(
                            safeName,
                            null,
                            $"El Excel supera el máximo de {maxImageBytes / (1024 * 1024.0):0.#} MB."));
                        continue;
                    }

                    if (!LooksLikeExcel(raw, ext))
                    {
                        results.Add(new CapturaSubidaResult(safeName, null, "El archivo no parece un Excel válido (.xlsx o .xls)."));
                        continue;
                    }

                    EnsureRoot();
                    var excelExt = AllowedExcelExt.Contains(ext) ? ext.ToLowerInvariant() : ".xlsx";
                    var excelId = NewShortId();
                    await File.WriteAllBytesAsync(Path.Combine(_root, excelId + excelExt), raw, ct)
                        .ConfigureAwait(false);
                    var downloadName = SanitizeDownloadName(safeName, excelExt);
                    await File.WriteAllTextAsync(
                        Path.Combine(_root, excelId + ".meta"),
                        downloadName,
                        ct).ConfigureAwait(false);

                    var excelUrl = $"{baseUrl}/c/{excelId}";
                    _logger.LogInformation("Excel guardado {Id} ({Bytes} bytes) → {Url}", excelId, raw.Length, excelUrl);
                    results.Add(new CapturaSubidaResult(safeName, excelUrl, null));
                    continue;
                }

                if (isXml)
                {
                    if (raw.Length > maxImageBytes)
                    {
                        results.Add(new CapturaSubidaResult(
                            safeName,
                            null,
                            $"El XML supera el máximo de {maxImageBytes / (1024 * 1024.0):0.#} MB."));
                        continue;
                    }

                    if (!LooksLikeXml(raw))
                    {
                        results.Add(new CapturaSubidaResult(safeName, null, "El archivo no parece un XML válido (.xml)."));
                        continue;
                    }

                    EnsureRoot();
                    var xmlId = NewShortId();
                    await File.WriteAllBytesAsync(Path.Combine(_root, xmlId + ".xml"), raw, ct)
                        .ConfigureAwait(false);
                    var downloadName = SanitizeDownloadName(safeName, ".xml");
                    await File.WriteAllTextAsync(
                        Path.Combine(_root, xmlId + ".meta"),
                        downloadName,
                        ct).ConfigureAwait(false);

                    var xmlUrl = $"{baseUrl}/c/{xmlId}";
                    _logger.LogInformation("XML guardado {Id} ({Bytes} bytes) → {Url}", xmlId, raw.Length, xmlUrl);
                    results.Add(new CapturaSubidaResult(safeName, xmlUrl, null));
                    continue;
                }

                if (raw.Length > maxImageBytes)
                {
                    results.Add(new CapturaSubidaResult(
                        safeName,
                        null,
                        $"Supera el máximo de {maxImageBytes / (1024 * 1024.0):0.#} MB."));
                    continue;
                }

                if (!AllowedExt.Contains(ext) && !LooksLikeImage(raw))
                {
                    results.Add(new CapturaSubidaResult(safeName, null, "Formato no permitido. Imágenes, PDF, TXT, Excel, XML o video mp4/webm."));
                    continue;
                }

                var outExt = GuessExt(raw);
                if (outExt == ".bin" && AllowedExt.Contains(ext))
                    outExt = ext.Equals(".jpeg", StringComparison.OrdinalIgnoreCase) ? ".jpg" : ext.ToLowerInvariant();

                if (outExt == ".bin")
                {
                    results.Add(new CapturaSubidaResult(safeName, null, "No se reconoció la imagen."));
                    continue;
                }

                EnsureRoot();
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

    /// <summary>Guarda trazas / archivos descargables (.trc, .csv, .txt). Misma URL corta /c/{id} con Content-Disposition: attachment.</summary>
    public async Task<IReadOnlyList<CapturaSubidaResult>> GuardarDescargasAsync(
        IReadOnlyList<(string FileName, Stream Content)> archivos,
        string publicBaseUrl,
        CancellationToken ct = default)
    {
        EnsureRoot();
        PurgeExpired();

        var maxFiles = Math.Clamp(_settings.MaxFilesPerRequest, 1, 50);
        if (archivos.Count > maxFiles)
            throw new InvalidOperationException($"Máximo {maxFiles} archivos por subida.");

        var baseUrl = NormalizeBaseUrl(publicBaseUrl, _settings.PublicBaseUrl);
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new InvalidOperationException("No se pudo determinar la URL pública de las trazas.");

        var maxBytes = Math.Clamp(_settings.MaxFileBytes, 256 * 1024, 25 * 1024 * 1024);
        var results = new List<CapturaSubidaResult>(archivos.Count);

        foreach (var (fileName, content) in archivos)
        {
            ct.ThrowIfCancellationRequested();
            var safeName = Path.GetFileName(fileName);
            if (string.IsNullOrWhiteSpace(safeName))
                safeName = "traza.trc";

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
                if (!AllowedDownloadExt.Contains(ext))
                {
                    results.Add(new CapturaSubidaResult(safeName, null, "Solo .trc, .csv o .txt."));
                    continue;
                }

                ext = ext.ToLowerInvariant();
                EnsureRoot();
                var id = NewShortId();
                var path = Path.Combine(_root, id + ext);
                await File.WriteAllBytesAsync(path, raw, ct).ConfigureAwait(false);

                var downloadName = SanitizeDownloadName(safeName, ext);
                await File.WriteAllTextAsync(
                    Path.Combine(_root, id + ".meta"),
                    downloadName,
                    ct).ConfigureAwait(false);

                var url = $"{baseUrl}/c/{id}";
                _logger.LogInformation("Descarga guardada {Id} ({Bytes} bytes) → {Url}", id, raw.Length, url);
                results.Add(new CapturaSubidaResult(safeName, url, null));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error al guardar descarga {File}", safeName);
                results.Add(new CapturaSubidaResult(safeName, null, ex.Message));
            }
        }

        return results;
    }

    public bool TryOpenById(string id, out LocalMediaOpen? open)
    {
        open = null;

        if (string.IsNullOrWhiteSpace(id))
            return false;

        id = id.Trim();
        if (!ShortIdRegex.IsMatch(id))
            return false;

        foreach (var ext in StoredExts)
        {
            var path = Path.Combine(_root, id + ext);
            if (!File.Exists(path))
                continue;

            var forceDownload = AllowedDownloadExt.Contains(ext) || AllowedExcelExt.Contains(ext) || AllowedXmlExt.Contains(ext);
            string? downloadName = null;
            if (forceDownload)
            {
                var metaPath = Path.Combine(_root, id + ".meta");
                if (File.Exists(metaPath))
                {
                    try { downloadName = File.ReadAllText(metaPath).Trim(); }
                    catch { /* ignore */ }
                }

                if (string.IsNullOrWhiteSpace(downloadName))
                    downloadName = "traza" + ext;
            }

            open = new LocalMediaOpen(path, MimeForExt(ext), downloadName, forceDownload);
            return true;
        }

        _logger.LogWarning("Archivo no encontrado: {Id} en {Root}", id, _root);
        return false;
    }

    public bool TryOpen(string tokenWithExt, out LocalMediaOpen? open)
    {
        open = null;

        if (string.IsNullOrWhiteSpace(tokenWithExt))
            return false;

        var name = Path.GetFileName(tokenWithExt.Trim());
        if (ShortIdRegex.IsMatch(name))
            return TryOpenById(name, out open);

        if (!LegacyTokenFileRegex.IsMatch(name))
            return false;

        var path = Path.Combine(_root, name);
        if (!File.Exists(path))
            return false;

        var ext = Path.GetExtension(name);
        open = new LocalMediaOpen(path, MimeForExt(ext), null, AllowedDownloadExt.Contains(ext));
        return true;
    }

    /// <summary>Compat: API anterior que solo devolvía path + content-type.</summary>
    public bool TryOpenById(string id, out string fullPath, out string contentType)
    {
        if (!TryOpenById(id, out LocalMediaOpen? open) || open is null)
        {
            fullPath = "";
            contentType = "application/octet-stream";
            return false;
        }

        fullPath = open.FullPath;
        contentType = open.ContentType;
        return true;
    }

    public bool TryOpen(string tokenWithExt, out string fullPath, out string contentType)
    {
        if (!TryOpen(tokenWithExt, out LocalMediaOpen? open) || open is null)
        {
            fullPath = "";
            contentType = "application/octet-stream";
            return false;
        }

        fullPath = open.FullPath;
        contentType = open.ContentType;
        return true;
    }

    /// <summary>Borra un media local por id corto (archivo + .meta si existe).</summary>
    public bool TryDeleteById(string id)
    {
        if (string.IsNullOrWhiteSpace(id) || !ShortIdRegex.IsMatch(id.Trim()))
            return false;

        id = id.Trim();
        var deleted = false;
        foreach (var ext in StoredExts)
        {
            var path = Path.Combine(_root, id + ext);
            if (!File.Exists(path))
                continue;
            try
            {
                File.Delete(path);
                deleted = true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo borrar captura {Path}", path);
            }
        }

        var meta = Path.Combine(_root, id + ".meta");
        if (File.Exists(meta))
        {
            try { File.Delete(meta); } catch { /* ignore */ }
        }

        return deleted;
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
        var ttlImages = _settings.TtlDays;
        var ttlVideos = _settings.VideoTtlDays > 0 ? _settings.VideoTtlDays : ttlImages;
        if (ttlImages <= 0 && ttlVideos <= 0)
            return 0;

        lock (_purgeLock)
        {
            EnsureRoot();
            if (!Directory.Exists(_root))
                return 0;

            var now = DateTime.UtcNow;
            var cutoffImages = ttlImages > 0 ? now.AddDays(-ttlImages) : DateTime.MinValue;
            var cutoffVideos = ttlVideos > 0 ? now.AddDays(-ttlVideos) : DateTime.MinValue;
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

                    var ext = Path.GetExtension(file);
                    var isVideo = AllowedVideoExt.Contains(ext);
                    var cutoff = isVideo ? cutoffVideos : cutoffImages;
                    if (ttlImages <= 0 && !isVideo)
                        continue;
                    if (ttlVideos <= 0 && isVideo)
                        continue;
                    if (stamp >= cutoff)
                        continue;

                    try
                    {
                        File.Delete(file);
                        removed++;

                        if (!ext.Equals(".meta", StringComparison.OrdinalIgnoreCase))
                        {
                            var meta = Path.Combine(
                                Path.GetDirectoryName(file)!,
                                Path.GetFileNameWithoutExtension(file) + ".meta");
                            if (File.Exists(meta))
                            {
                                try { File.Delete(meta); }
                                catch { /* ignore */ }
                            }
                        }
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
                _logger.LogInformation(
                    "Purgados {Count} archivos (imágenes {ImgDays}d / videos {VidDays}d)",
                    removed,
                    ttlImages,
                    ttlVideos);

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

    private static bool LooksLikePdf(byte[] raw) =>
        raw.Length >= 5
        && raw[0] == (byte)'%'
        && raw[1] == (byte)'P'
        && raw[2] == (byte)'D'
        && raw[3] == (byte)'F'
        && raw[4] == (byte)'-';

    private static bool LooksLikeExcel(byte[] raw, string ext)
    {
        if (ext.Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
            return LooksLikeZip(raw);
        if (ext.Equals(".xls", StringComparison.OrdinalIgnoreCase))
            return raw.Length >= 8
                && raw[0] == 0xD0 && raw[1] == 0xCF && raw[2] == 0x11 && raw[3] == 0xE0;
        return false;
    }

    private static bool LooksLikeZip(byte[] raw) =>
        raw.Length >= 4 && raw[0] == 0x50 && raw[1] == 0x4B && raw[2] == 0x03 && raw[3] == 0x04;

    private static bool LooksLikeXml(byte[] raw)
    {
        var i = 0;
        if (raw.Length >= 3 && raw[0] == 0xEF && raw[1] == 0xBB && raw[2] == 0xBF)
            i = 3;

        while (i < raw.Length && raw[i] is 0x20 or 0x09 or 0x0A or 0x0D)
            i++;

        return i < raw.Length && raw[i] == (byte)'<';
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
        ".mp4" => "video/mp4",
        ".webm" => "video/webm",
        ".pdf" => "application/pdf",
        ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xls" => "application/vnd.ms-excel",
        ".xml" => "application/xml",
        ".csv" => "text/csv",
        ".txt" => "text/plain",
        ".trc" => "application/octet-stream",
        _ => "application/octet-stream",
    };

    private static string SanitizeDownloadName(string original, string ext)
    {
        var baseName = Path.GetFileNameWithoutExtension(original);
        if (string.IsNullOrWhiteSpace(baseName))
            baseName = "traza";

        var cleaned = new string(baseName
            .Where(ch => char.IsLetterOrDigit(ch) || ch is '-' or '_' or '.' or ' ')
            .ToArray())
            .Trim();

        if (string.IsNullOrWhiteSpace(cleaned))
            cleaned = "traza";

        if (cleaned.Length > 80)
            cleaned = cleaned[..80];

        return cleaned + ext;
    }

    private static string NormalizeBaseUrl(string? fromRequest, string fromSettings)
    {
        var candidate = !string.IsNullOrWhiteSpace(fromSettings) ? fromSettings : fromRequest;
        if (string.IsNullOrWhiteSpace(candidate))
            return "";

        candidate = candidate.Trim().TrimEnd('/');

        if (candidate.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            && candidate.Contains("tolei.dev", StringComparison.OrdinalIgnoreCase))
        {
            candidate = "https://" + candidate["http://".Length..];
        }

        return candidate;
    }
}

public sealed record LocalMediaOpen(
    string FullPath,
    string ContentType,
    string? DownloadFileName,
    bool ForceDownload);
