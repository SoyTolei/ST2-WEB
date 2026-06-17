using PortalClienchi.Core.Configuration;

namespace PortalClienchi.Web;

/// <summary>
/// proxy = iframe mismo host (localhost con VPN en el servidor).
/// window = ventana popup alineada al panel (web pública / Railway).
/// </summary>
internal sealed record ThomEmbedConfig(
    string Mode,
    string FrameUrl,
    bool ProxyReachable);

internal static class ThomEmbedResolver
{
    public static async Task<ThomEmbedConfig> ResolveAsync(AppSettings settings, IConfiguration configuration)
    {
        var mode = configuration["ThomEmbedMode"]?.Trim();
        if (string.IsNullOrWhiteSpace(mode))
            mode = Environment.GetEnvironmentVariable("THOM_EMBED_MODE")?.Trim();
        mode = (mode ?? "auto").ToLowerInvariant();

        var tapUrl = string.IsNullOrWhiteSpace(settings.ThomTapUrl)
            ? "https://css-latam.int.thomsonreuters.com/css-tap"
            : settings.ThomTapUrl.Trim();

        var onRailway = !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("RAILWAY_ENVIRONMENT"));

        if (mode is "window" or "direct")
            return new ThomEmbedConfig("window", tapUrl, false);

        if (onRailway)
            return new ThomEmbedConfig("window", tapUrl, false);

        var proxyReachable = false;
        if (mode is "auto" or "proxy")
            proxyReachable = await ProbeUpstreamAsync(tapUrl).ConfigureAwait(false);

        if (mode == "proxy" || (mode == "auto" && proxyReachable))
            return new ThomEmbedConfig("proxy", ToProxyFramePath(tapUrl), true);

        return new ThomEmbedConfig("window", tapUrl, proxyReachable);
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
