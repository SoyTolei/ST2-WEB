using PortalClienchi.Core.Configuration;

namespace PortalClienchi.Web;

internal static class WebImageUrlResolver
{
    private static readonly string[] PublicImageHosts =
    [
        "i.ibb.co",
        "i.imgur.com",
        "imgbb.com",
        "ytimg.com",
    ];

    public static string? Resolve(string? url, AppSettings settings)
    {
        if (string.IsNullOrWhiteSpace(url))
            return null;

        url = url.Trim();

        if (url.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            return url;

        if (url.StartsWith("//", StringComparison.Ordinal))
            return "https:" + url;

        if (url.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return url;

        var apiBase = settings.ApiBaseUrl.TrimEnd('/');
        var portalBase = settings.PortalBaseUrl.TrimEnd('/');

        if (!url.StartsWith('/'))
            url = "/" + url;

        // Los assets del portal (capturas, adjuntos) suelen servirse desde la API autenticada.
        return apiBase + url;
    }

    public static bool NeedsAuthenticatedProxy(string url, AppSettings settings)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            return false;

        if (uri.Scheme is not ("http" or "https"))
            return false;

        if (PublicImageHosts.Any(h => uri.Host.Contains(h, StringComparison.OrdinalIgnoreCase)))
            return false;

        var portalHost = Uri.TryCreate(settings.PortalBaseUrl, UriKind.Absolute, out var portal)
            ? portal.Host : "";
        var apiHost = Uri.TryCreate(settings.ApiBaseUrl, UriKind.Absolute, out var api)
            ? api.Host : "";

        return uri.Host.Equals(portalHost, StringComparison.OrdinalIgnoreCase)
            || uri.Host.Equals(apiHost, StringComparison.OrdinalIgnoreCase)
            || uri.Host.Contains("thomsonreuters", StringComparison.OrdinalIgnoreCase);
    }
}
