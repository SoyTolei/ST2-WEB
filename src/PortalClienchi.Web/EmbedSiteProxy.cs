using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace PortalClienchi.Web;

internal sealed class EmbedSiteProxy
{
    private static readonly CookieContainer CookieJar = new();
    private static readonly HttpClient Http = CreateClient();

    private static readonly Dictionary<string, string> SiteBases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["thom"] = "https://css-latam.int.thomsonreuters.com",
        ["ai"] = "https://aiplatform.thomsonreuters.com",
        ["sso"] = "https://sso.thomsonreuters.com",
        ["aad"] = "https://login.microsoftonline.com",
        ["cf"] = "https://d3uc069fcn7uxw.cloudfront.net",
        ["cf2"] = "https://d20xtzwzcl0ceb.cloudfront.net",
        ["cg"] = "https://a208582-CSS-Openarena-SSO.auth.us-east-1.amazoncognito.com",
        ["daa"] = "https://dataandanalytics.int.thomsonreuters.com",
        ["aoa"] = "https://aiopenarena.thomsonreuters.com",
    };

    private static readonly Dictionary<string, string> HostToSite =
        SiteBases.ToDictionary(kv => new Uri(kv.Value).Host, kv => kv.Key, StringComparer.OrdinalIgnoreCase);

    private static readonly string[] BlockedResponseHeaders =
    [
        "X-Frame-Options",
        "Content-Security-Policy",
        "Content-Security-Policy-Report-Only",
        "Cross-Origin-Embedder-Policy",
        "Cross-Origin-Opener-Policy",
        "Cross-Origin-Resource-Policy",
        "Permissions-Policy",
    ];

    private static readonly Regex TextualContentRegex = new(
        @"^(text/|application/javascript|application/json|application/xml|application/xhtml\+xml)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static string ToEmbedPath(string absoluteUrl)
    {
        if (!Uri.TryCreate(absoluteUrl, UriKind.Absolute, out var uri))
            return "/";

        var site = ResolveSite(uri.Host) ?? uri.Host.Split('.')[0].ToLowerInvariant();
        return $"/embed/{site}{uri.AbsolutePath}{uri.Query}";
    }

    public async Task HandleAsync(HttpContext context, string site, string path, CancellationToken ct)
    {
        if (!SiteBases.TryGetValue(site, out var baseUrl))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        if (HttpMethods.IsOptions(context.Request.Method))
        {
            context.Response.StatusCode = StatusCodes.Status204NoContent;
            return;
        }

        var baseUri = new Uri(baseUrl.EndsWith('/') ? baseUrl : baseUrl + "/");
        var relativePath = string.IsNullOrEmpty(path) ? "" : path.TrimStart('/');
        var query = context.Request.QueryString.HasValue ? context.Request.QueryString.Value : "";
        var targetUri = new Uri(baseUri, relativePath + query);

        if (!IsAllowedHost(targetUri.Host))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        using var request = BuildUpstreamRequest(context.Request, targetUri, site);
        using var response = await Http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);

        context.Response.StatusCode = (int)response.StatusCode;

        CopyResponseHeaders(response, context.Response, site);

        if (response.Headers.Location is not null)
        {
            var rewritten = RewriteUrl(response.Headers.Location.ToString(), site);
            context.Response.Headers.Location = rewritten;
        }

        var contentType = response.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
        context.Response.ContentType = contentType;

        if (ShouldRewrite(contentType))
        {
            var text = await response.Content.ReadAsStringAsync(ct);
            text = RewriteContent(text, site, contentType);
            var bytes = Encoding.UTF8.GetBytes(text);
            context.Response.ContentLength = bytes.Length;
            await context.Response.Body.WriteAsync(bytes, ct);
            return;
        }

        context.Response.Headers.Remove("Content-Length");
        await response.Content.CopyToAsync(context.Response.Body, ct);
    }

    private static HttpClient CreateClient()
    {
        var handler = new SocketsHttpHandler
        {
            CookieContainer = CookieJar,
            AllowAutoRedirect = false,
            AutomaticDecompression = DecompressionMethods.All,
            UseCookies = true,
        };
        return new HttpClient(handler)
        {
            Timeout = TimeSpan.FromMinutes(3),
        };
    }

    private static HttpRequestMessage BuildUpstreamRequest(HttpRequest request, Uri targetUri, string site)
    {
        var method = new HttpMethod(request.Method);
        var message = new HttpRequestMessage(method, targetUri);

        if (method == HttpMethod.Post || method == HttpMethod.Put || method == HttpMethod.Patch)
            message.Content = new StreamContent(request.Body);

        if (request.Headers.TryGetValue("Accept", out var accept))
            message.Headers.TryAddWithoutValidation("Accept", accept.ToArray());
        if (request.Headers.TryGetValue("Accept-Language", out var lang))
            message.Headers.TryAddWithoutValidation("Accept-Language", lang.ToArray());
        if (request.ContentType is not null && message.Content is not null)
            message.Content.Headers.TryAddWithoutValidation("Content-Type", request.ContentType);

        message.Headers.TryAddWithoutValidation("User-Agent",
            request.Headers.UserAgent.ToString() is { Length: > 0 } ua
                ? ua
                : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

        var referer = GetRefererOrigin(site);
        message.Headers.TryAddWithoutValidation("Referer", referer);
        message.Headers.TryAddWithoutValidation("Origin", referer.TrimEnd('/'));

        return message;
    }

    private static string GetRefererOrigin(string site) =>
        site is "cf" or "cf2" or "cg"
            ? "https://css-latam.int.thomsonreuters.com/css-tap"
            : SiteBases.TryGetValue(site, out var url)
                ? url.TrimEnd('/') + "/"
                : "https://css-latam.int.thomsonreuters.com/css-tap";

    private static void CopyResponseHeaders(HttpResponseMessage upstream, HttpResponse response, string currentSite)
    {
        foreach (var header in upstream.Headers)
        {
            if (BlockedResponseHeaders.Contains(header.Key, StringComparer.OrdinalIgnoreCase))
                continue;
            if (header.Key.Equals("Transfer-Encoding", StringComparison.OrdinalIgnoreCase))
                continue;
            response.Headers[header.Key] = header.Value.ToArray();
        }

        foreach (var header in upstream.Content.Headers)
        {
            if (header.Key.Equals("Content-Length", StringComparison.OrdinalIgnoreCase))
                continue;
            response.Headers[header.Key] = header.Value.ToArray();
        }

        response.Headers.Remove("Content-Security-Policy");
        response.Headers.Remove("X-Frame-Options");
    }

    private static bool ShouldRewrite(string contentType) =>
        TextualContentRegex.IsMatch(contentType);

    private static string RewriteContent(string content, string site, string contentType)
    {
        if (contentType.Contains("html", StringComparison.OrdinalIgnoreCase))
        {
            content = RewriteAbsoluteHosts(content);

            var baseTag = $"""<base href="/embed/{site}/">""";
            if (!content.Contains("<base ", StringComparison.OrdinalIgnoreCase))
            {
                content = Regex.Replace(
                    content,
                    @"<head(\s[^>]*)?>",
                    match => match.Value + baseTag,
                    RegexOptions.IgnoreCase);
            }

            content = RewriteHtmlAttributeUrls(content, site);
        }
        else if (contentType.Contains("javascript", StringComparison.OrdinalIgnoreCase)
                 || contentType.Contains("css", StringComparison.OrdinalIgnoreCase))
        {
            content = RewriteCloudFrontHosts(content);
            content = RewriteScriptOrStyleUrls(content, site);
            if (site == "ai")
                content = RewriteAbsoluteHosts(content);
        }
        else
        {
            content = RewriteAbsoluteHosts(content);
        }

        return content;
    }

    private static string RewriteCloudFrontHosts(string content)
    {
        content = content.Replace("https://d3uc069fcn7uxw.cloudfront.net", "/embed/cf", StringComparison.OrdinalIgnoreCase);
        content = content.Replace("https://d20xtzwzcl0ceb.cloudfront.net", "/embed/cf2", StringComparison.OrdinalIgnoreCase);
        content = content.Replace("http://d3uc069fcn7uxw.cloudfront.net", "/embed/cf", StringComparison.OrdinalIgnoreCase);
        content = content.Replace("http://d20xtzwzcl0ceb.cloudfront.net", "/embed/cf2", StringComparison.OrdinalIgnoreCase);
        return content;
    }

    private static string RewriteHtmlAttributeUrls(string content, string site)
    {
        var embed = $"/embed/{site}/";
        return Regex.Replace(
            content,
            @"\b(src|href|action|content|poster|data-src)\s*=\s*(['""])/(?!embed/)",
            match => $"{match.Groups[1].Value}={match.Groups[2].Value}{embed}",
            RegexOptions.IgnoreCase);
    }

    private static string RewriteScriptOrStyleUrls(string content, string site)
    {
        var embed = $"/embed/{site}/";
        // Rutas entre comillas que empiezan con /letra (evita romper " /> en HTML o divisiones en JS)
        content = Regex.Replace(
            content,
            @"([""'])/(?!embed/)(?=[a-zA-Z0-9_\-])",
            $"$1{embed}",
            RegexOptions.IgnoreCase);
        // url(/...) en CSS
        content = Regex.Replace(
            content,
            @"url\(\s*(['""]?)/(?!embed/)(?=[a-zA-Z0-9_\-])",
            $"url($1{embed}",
            RegexOptions.IgnoreCase);
        return content;
    }

    private static string RewriteAbsoluteHosts(string content)
    {
        foreach (var (site, baseUrl) in SiteBases)
        {
            var uri = new Uri(baseUrl);
            var embed = $"/embed/{site}";
            content = content.Replace(baseUrl, embed, StringComparison.OrdinalIgnoreCase);
            content = content.Replace(baseUrl.TrimEnd('/'), embed, StringComparison.OrdinalIgnoreCase);
            content = content.Replace($"https://{uri.Host}", embed, StringComparison.OrdinalIgnoreCase);
            content = content.Replace($"http://{uri.Host}", embed, StringComparison.OrdinalIgnoreCase);
            content = content.Replace($"//{uri.Host}", embed, StringComparison.OrdinalIgnoreCase);
        }

        return content;
    }

    private static string RewriteUrl(string? url, string currentSite)
    {
        if (string.IsNullOrWhiteSpace(url))
            return "/";

        if (url.StartsWith("/embed/", StringComparison.OrdinalIgnoreCase))
            return url;

        if (Uri.TryCreate(url, UriKind.Absolute, out var absolute))
        {
            var site = ResolveSite(absolute.Host);
            if (site is null)
                return url;
            return $"/embed/{site}{absolute.PathAndQuery}";
        }

        if (url.StartsWith('/'))
            return $"/embed/{currentSite}{url}";

        return url;
    }

    private static string? ResolveSite(string host)
    {
        if (HostToSite.TryGetValue(host, out var site))
            return site;
        if (host.Equals("login.microsoftonline.com", StringComparison.OrdinalIgnoreCase))
            return "aad";
        if (host.Equals("d3uc069fcn7uxw.cloudfront.net", StringComparison.OrdinalIgnoreCase))
            return "cf";
        if (host.Equals("d20xtzwzcl0ceb.cloudfront.net", StringComparison.OrdinalIgnoreCase))
            return "cf2";
        if (host.Contains("amazoncognito.com", StringComparison.OrdinalIgnoreCase))
            return "cg";
        if (IsAllowedThomsonHost(host))
            return "sso";
        return null;
    }

    private static bool IsAllowedHost(string host) =>
        IsAllowedThomsonHost(host)
        || host.Equals("login.microsoftonline.com", StringComparison.OrdinalIgnoreCase)
        || host.EndsWith(".cloudfront.net", StringComparison.OrdinalIgnoreCase)
        || host.Contains("amazoncognito.com", StringComparison.OrdinalIgnoreCase);

    private static bool IsAllowedThomsonHost(string host) =>
        host.EndsWith(".thomsonreuters.com", StringComparison.OrdinalIgnoreCase)
        || host.Equals("thomsonreuters.com", StringComparison.OrdinalIgnoreCase);
}
