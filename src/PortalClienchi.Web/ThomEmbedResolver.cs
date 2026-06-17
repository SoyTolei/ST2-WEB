using PortalClienchi.Core.Configuration;

namespace PortalClienchi.Web;

/// <summary>
/// proxy = mismo host (localhost/Railway con VPN o proxy corporativo).
/// proxy-remote = iframe apunta a otro ST2 con VPN (túnel Cloudflare, etc.).
/// window = solo ventana aparte (SSO no admite iframe cross-origin directo).
/// </summary>
internal sealed record ThomEmbedConfig(
    string Mode,
    string FrameUrl,
    bool ProxyReachable,
    string? RemoteProxyBase);

internal static class ThomEmbedResolver
{
    public static async Task<ThomEmbedConfig> ResolveAsync(AppSettings settings, IConfiguration configuration)
    {
        var mode = configuration["ThomEmbedMode"]?.Trim()
            ?? Environment.GetEnvironmentVariable("THOM_EMBED_MODE")?.Trim()
            ?? "auto";

        mode = mode.ToLowerInvariant();
        var tapUrl = string.IsNullOrWhiteSpace(settings.ThomTapUrl)
            ? "https://css-latam.int.thomsonreuters.com/css-tap"
            : settings.ThomTapUrl.Trim();

        var remoteBase = configuration["ThomProxyBaseUrl"]?.Trim();
        if (string.IsNullOrWhiteSpace(remoteBase))
            remoteBase = Environment.GetEnvironmentVariable("THOM_PROXY_BASE_URL")?.Trim();
        if (string.IsNullOrWhiteSpace(remoteBase))
            remoteBase = Environment.GetEnvironmentVariable("ThomProxyBaseUrl")?.Trim();

        if (!string.IsNullOrWhiteSpace(remoteBase))
        {
            remoteBase = remoteBase.TrimEnd('/');
            if (!Uri.TryCreate(remoteBase, UriKind.Absolute, out _))
                remoteBase = null;
        }

        if (!string.IsNullOrEmpty(remoteBase))
        {
            var remoteFrame = $"{remoteBase}{ToProxyFramePath(tapUrl)}";
            return new ThomEmbedConfig("proxy-remote", remoteFrame, false, remoteBase);
        }

        var proxyReachable = false;
        if (mode is "auto" or "proxy")
            proxyReachable = await ProbeUpstreamAsync(tapUrl).ConfigureAwait(false);

        var onRailway = !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("RAILWAY_ENVIRONMENT"));

        var useLocalProxy = mode switch
        {
            "proxy" => true,
            "window" or "direct" => false,
            _ when onRailway && !proxyReachable => false,
            _ => proxyReachable,
        };

        if (useLocalProxy)
            return new ThomEmbedConfig("proxy", ToProxyFramePath(tapUrl), true, null);

        return new ThomEmbedConfig("window", tapUrl, proxyReachable, null);
    }

    private static string ToProxyFramePath(string tapUrl)
    {
        if (!Uri.TryCreate(tapUrl, UriKind.Absolute, out var uri))
            return "/css-tap";

        return $"{uri.AbsolutePath}{uri.Query}";
    }

    private static async Task<bool> ProbeUpstreamAsync(string tapUrl)
    {
        using var client = ThomUpstreamHttp.CreateProbeClient();
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Head, tapUrl);
            request.Headers.TryAddWithoutValidation("User-Agent",
                "Mozilla/5.0 (compatible; ST2-Web/1.0; +https://github.com/SoyTolei/ST2-WEB)");

            using var response = await client.SendAsync(request).ConfigureAwait(false);
            return response.IsSuccessStatusCode || (int)response.StatusCode is 401 or 403 or 405;
        }
        catch
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, tapUrl);
                request.Headers.TryAddWithoutValidation("User-Agent",
                    "Mozilla/5.0 (compatible; ST2-Web/1.0; +https://github.com/SoyTolei/ST2-WEB)");

                using var response = await client.SendAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead).ConfigureAwait(false);
                return response.IsSuccessStatusCode || (int)response.StatusCode is 401 or 403;
            }
            catch
            {
                return false;
            }
        }
    }
}
