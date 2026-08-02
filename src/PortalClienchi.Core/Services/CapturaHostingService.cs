using System.IO;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using PortalClienchi.Core.Configuration;
using PortalClienchi.Core.Models;

namespace PortalClienchi.Core.Services;

public sealed class CapturaHostingService : IDisposable
{
    private readonly CapturaHostingSettings _settings;
    private readonly HttpClient _http;

    public CapturaHostingService(CapturaHostingSettings settings)
    {
        _settings = settings;
        var timeout = Math.Clamp(settings.TimeoutSeconds, 15, 300);
        _http = new HttpClient(new HttpClientHandler
        {
            AutomaticDecompression = DecompressionMethods.All,
            UseProxy = true,
        })
        {
            Timeout = TimeSpan.FromSeconds(timeout),
        };
        _http.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", "ST2-PortalClienchi/1.0");
    }

    public bool IsActive => _settings.IsActive;

    public string ProveedorLabel => _settings.ProveedorEfectivo;

    public async Task<IReadOnlyList<CapturaSubidaResult>> SubirArchivosAsync(
        IEnumerable<string> filePaths,
        IProgress<(int actual, int total, string nombre)>? progress = null,
        CancellationToken ct = default)
    {
        var paths = filePaths.Where(File.Exists).ToList();
        var results = new List<CapturaSubidaResult>(paths.Count);
        var total = paths.Count;
        var index = 0;

        foreach (var path in paths)
        {
            ct.ThrowIfCancellationRequested();
            index++;
            var nombre = Path.GetFileName(path);
            progress?.Report((index, total, nombre));

            try
            {
                var url = await SubirConReintentosAsync(path, ct).ConfigureAwait(false);
                results.Add(new CapturaSubidaResult(nombre, url, null));
            }
            catch (Exception ex)
            {
                results.Add(new CapturaSubidaResult(nombre, null, FormatearError(ex)));
            }
        }

        return results;
    }

    private async Task<string> SubirConReintentosAsync(string filePath, CancellationToken ct)
    {
        Exception? last = null;
        for (var intento = 1; intento <= 2; intento++)
        {
            try
            {
                return _settings.ProveedorEfectivo switch
                {
                    "ImgBB" => await SubirImgBbAsync(filePath, ct).ConfigureAwait(false),
                    "Catbox" => await SubirCatboxAsync(filePath, ct).ConfigureAwait(false),
                    _ => throw new InvalidOperationException(
                        "El proveedor Local se maneja en LocalCapturaStore (Volume ST2), no en CapturaHostingService."),
                };
            }
            catch (Exception ex) when (intento < 2)
            {
                last = ex;
                await Task.Delay(800, ct).ConfigureAwait(false);
            }
        }

        throw last ?? new InvalidOperationException("No se pudo subir el archivo.");
    }

    private async Task<string> SubirImgBbAsync(string filePath, CancellationToken ct)
    {
        if (!_settings.TieneImgBbKey)
            throw new InvalidOperationException(
                "Falta ImgBbApiKey en appsettings.local.json (clave gratis en https://api.imgbb.com/).");

        var bytes = await File.ReadAllBytesAsync(filePath, ct).ConfigureAwait(false);
        using var content = new MultipartFormDataContent();
        content.Add(new StringContent(_settings.ImgBbApiKey.Trim()), "key");
        var fileContent = new ByteArrayContent(bytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(ObtenerMime(filePath));
        content.Add(fileContent, "image", Path.GetFileName(filePath));

        using var response = await _http.PostAsync("https://api.imgbb.com/1/upload", content, ct)
            .ConfigureAwait(false);
        var body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(ExtraerErrorImgBb(body, response.StatusCode));

        using var doc = JsonDocument.Parse(body);
        if (!doc.RootElement.TryGetProperty("data", out var data))
            throw new InvalidOperationException("ImgBB no devolvió datos.");

        if (data.TryGetProperty("url", out var urlEl))
        {
            var url = urlEl.GetString();
            if (!string.IsNullOrWhiteSpace(url))
                return url.Trim();
        }

        if (data.TryGetProperty("image", out var image) && image.TryGetProperty("url", out var imageUrl))
        {
            var url = imageUrl.GetString();
            if (!string.IsNullOrWhiteSpace(url))
                return url.Trim();
        }

        throw new InvalidOperationException("ImgBB no devolvió URL de la imagen.");
    }

    private async Task<string> SubirCatboxAsync(string filePath, CancellationToken ct)
    {
        var bytes = await File.ReadAllBytesAsync(filePath, ct).ConfigureAwait(false);
        using var content = new MultipartFormDataContent();
        content.Add(new StringContent("fileupload"), "reqtype");
        var fileContent = new ByteArrayContent(bytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(ObtenerMime(filePath));
        content.Add(fileContent, "fileToUpload", Path.GetFileName(filePath));

        using var response = await _http.PostAsync("https://catbox.moe/user/api.php", content, ct)
            .ConfigureAwait(false);
        var url = (await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false)).Trim();

        if (!response.IsSuccessStatusCode || string.IsNullOrWhiteSpace(url) || !url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(string.IsNullOrWhiteSpace(url) ? "Catbox no devolvió enlace." : url);

        return url;
    }

    private static string FormatearError(Exception ex)
    {
        var baseMsg = ex switch
        {
            HttpRequestException h => h.InnerException?.Message ?? h.Message,
            TaskCanceledException => "Tiempo de espera agotado al conectar con el servidor.",
            _ => ex.Message,
        };

        if (baseMsg.Contains("An error occurred while sending the request", StringComparison.OrdinalIgnoreCase)
            || baseMsg.Contains("No such host", StringComparison.OrdinalIgnoreCase)
            || baseMsg.Contains("SSL", StringComparison.OrdinalIgnoreCase)
            || baseMsg.Contains("connection", StringComparison.OrdinalIgnoreCase))
        {
            return baseMsg + Environment.NewLine +
                   "La red o el proxy corporativo puede estar bloqueando Catbox. " +
                   "Probá con ImgBB: agregá ImgBbApiKey en appsettings.local.json (https://api.imgbb.com/) " +
                   "o desmarcá «Subir a la web» para generar el .txt solo con carpeta local.";
        }

        return baseMsg;
    }

    private static string ObtenerMime(string path) =>
        Path.GetExtension(path).ToLowerInvariant() switch
        {
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            ".bmp" => "image/bmp",
            _ => "image/jpeg",
        };

    private static string ExtraerErrorImgBb(string body, HttpStatusCode status)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("error", out var err))
            {
                var msg = err.TryGetProperty("message", out var m) ? m.GetString() : err.GetRawText();
                return $"ImgBB ({(int)status}): {msg}";
            }
        }
        catch
        {
            // ignorar
        }

        var snippet = body.Length > 120 ? body[..120] + "…" : body;
        return $"ImgBB ({(int)status}): {snippet}";
    }

    public void Dispose() => _http.Dispose();
}
