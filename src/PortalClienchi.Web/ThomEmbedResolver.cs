using System.Net;
using PortalClienchi.Core.Configuration;

namespace PortalClienchi.Web;

internal sealed record ThomEmbedConfig(string Mode, string FrameUrl, bool ProxyReachable);

internal static class ThomEmbedResolver
{
    private static readonly HttpClient ProbeClient = new(new SocketsHttpHandler
    {
        AllowAutoRedirect = true,
        AutomaticDecompression = DecompressionMethods.All,
    })
    {
        Timeout = TimeSpan.FromSeconds(4),
    };

    public static async Task<ThomEmbedConfig> ResolveAsync(AppSettings settings, IConfiguration configuration)
    {
        var mode = configuration["ThomEmbedMode"]?.Trim()
            ?? Environment.GetEnvironmentVariable("THOM_EMBED_MODE")?.Trim()
            ?? "auto";

        mode = mode.ToLowerInvariant();
        var tapUrl = string.IsNullOrWhiteSpace(settings.ThomTapUrl)
            ? "https://css-latam.int.thomsonreuters.com/css-tap"
            : settings.ThomTapUrl.Trim();

        var onRailway = !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("RAILWAY_ENVIRONMENT"));
        var proxyReachable = false;

        if (mode is "auto" or "proxy")
            proxyReachable = await ProbeUpstreamAsync(tapUrl).ConfigureAwait(false);

        var useProxy = mode switch
        {
            "proxy" => true,
            "direct" => false,
            _ when onRailway => false,
            _ => proxyReachable,
        };

        var resolvedMode = useProxy ? "proxy" : "direct";
        var frameUrl = useProxy ? ToProxyFrameUrl(tapUrl) : tapUrl;

        return new ThomEmbedConfig(resolvedMode, frameUrl, proxyReachable);
    }

    private static string ToProxyFrameUrl(string tapUrl)
    {
        if (!Uri.TryCreate(tapUrl, UriKind.Absolute, out var uri))
            return "/css-tap";

        return $"{uri.AbsolutePath}{uri.Query}";
    }

    private static async Task<bool> ProbeUpstreamAsync(string tapUrl)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Head, tapUrl);
            request.Headers.TryAddWithoutValidation("User-Agent",
                "Mozilla/5.0 (compatible; ST2-Web/1.0; +https://github.com/SoyTolei/ST2-WEB)");

            using var response = await ProbeClient.SendAsync(request).ConfigureAwait(false);
            return response.IsSuccessStatusCode || (int)response.StatusCode is 401 or 403 or 405;
        }
        catch
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, tapUrl);
                request.Headers.TryAddWithoutValidation("User-Agent",
                    "Mozilla/5.0 (compatible; ST2-Web/1.0; +https://github.com/SoyTolei/ST2-WEB)");

                using var response = await ProbeClient.SendAsync(
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
