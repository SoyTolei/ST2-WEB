using PortalClienchi.Core.Api;
using PortalClienchi.Core.Configuration;

namespace PortalClienchi.Web;

internal sealed class PortalMediaProxy : IDisposable
{
    private readonly AppSettings _settings;
    private readonly ThomsonApiClient _api;

    public PortalMediaProxy(AppSettings settings)
    {
        _settings = settings;
        _api = new ThomsonApiClient(settings);
    }

    public bool IsAllowedUrl(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            return false;

        if (uri.Scheme is not ("http" or "https"))
            return false;

        if (uri.Host is "localhost" or "127.0.0.1")
            return false;

        return WebImageUrlResolver.NeedsAuthenticatedProxy(url, _settings);
    }

    public async Task<(byte[] Data, string ContentType)?> FetchAsync(string url, CancellationToken ct)
    {
        if (!IsAllowedUrl(url))
            return null;

        var tmp = Path.Combine(Path.GetTempPath(), "st2web_" + Guid.NewGuid().ToString("N"));
        try
        {
            await _api.DownloadFileAsync(url, tmp, ct);
            var data = await File.ReadAllBytesAsync(tmp, ct);
            if (data.Length == 0)
                return null;

            return (data, GuessContentType(url, data));
        }
        finally
        {
            if (File.Exists(tmp))
                File.Delete(tmp);
        }
    }

    private static string GuessContentType(string url, byte[] data)
    {
        if (data.Length >= 8
            && data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47)
            return "image/png";

        if (data.Length >= 3
            && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF)
            return "image/jpeg";

        if (data.Length >= 6
            && data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46)
            return "image/gif";

        var lower = url.ToLowerInvariant();
        if (lower.Contains(".png")) return "image/png";
        if (lower.Contains(".gif")) return "image/gif";
        if (lower.Contains(".webp")) return "image/webp";
        if (lower.Contains(".svg")) return "image/svg+xml";
        if (lower.Contains(".pdf")) return "application/pdf";
        return "image/jpeg";
    }

    public void Dispose() => _api.Dispose();
}
