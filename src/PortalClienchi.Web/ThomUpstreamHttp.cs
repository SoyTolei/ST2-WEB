using System.Net;

namespace PortalClienchi.Web;

internal static class ThomUpstreamHttp
{
    public static string? GetUpstreamProxyUrl() =>
        Environment.GetEnvironmentVariable("THOM_UPSTREAM_PROXY")?.Trim()
        ?? Environment.GetEnvironmentVariable("HTTPS_PROXY")?.Trim();

    public static SocketsHttpHandler CreateHandler(bool allowAutoRedirect = false)
    {
        var handler = new SocketsHttpHandler
        {
            AllowAutoRedirect = allowAutoRedirect,
            AutomaticDecompression = DecompressionMethods.All,
            UseCookies = false,
        };

        var proxyUrl = GetUpstreamProxyUrl();
        if (!string.IsNullOrWhiteSpace(proxyUrl) && Uri.TryCreate(proxyUrl, UriKind.Absolute, out var proxy))
        {
            handler.Proxy = new WebProxy(proxy);
            handler.UseProxy = true;
        }

        return handler;
    }

    public static HttpClient CreateProbeClient() =>
        new(CreateHandler(allowAutoRedirect: true))
        {
            Timeout = TimeSpan.FromSeconds(6),
        };
}
