using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using PortalClienchi.Core.Configuration;

namespace PortalClienchi.Web;

internal sealed class EmbedSiteProxy
{
    private readonly bool _autoCloseThomHelpPanel;
    private readonly double _thomZoomFactor;

    public EmbedSiteProxy(AppSettings settings)
    {
        _autoCloseThomHelpPanel = settings.ThomAutoCloseHelpPanel;
        _thomZoomFactor = settings.ThomZoomFactor is > 0.25 and < 2 ? settings.ThomZoomFactor : 0.9;
    }

    private static readonly HttpClient Http = CreateClient();

    private static readonly Dictionary<string, string> SiteBases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["thom"] = "https://css-latam.int.thomsonreuters.com",
        ["ai"] = "https://aiplatform.thomsonreuters.com",
        ["portal-bejerman"] = "https://clientes.thomsonreuters.com.ar",
        ["portal-bejerman-api"] = "https://clientes.thomsonreuters.com.ar:3333",
        ["portal-legal"] = "https://portaldelcliente.thomsonreuters.com.ar",
        ["portal-legal-api"] = "https://portaldelcliente.thomsonreuters.com.ar:3334",
        ["sso"] = "https://sso.thomsonreuters.com",
        ["aad"] = "https://login.microsoftonline.com",
        ["cf"] = "https://d3uc069fcn7uxw.cloudfront.net",
        ["cf2"] = "https://d20xtzwzcl0ceb.cloudfront.net",
        ["cg"] = "https://a208582-CSS-Openarena-SSO.auth.us-east-1.amazoncognito.com",
        ["daa"] = "https://dataandanalytics.int.thomsonreuters.com",
        ["aoa"] = "https://aiopenarena.thomsonreuters.com",
    };

    private static readonly Dictionary<string, string> HostToSite = BuildHostToSite();

    private static Dictionary<string, string> BuildHostToSite()
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (site, baseUrl) in SiteBases)
        {
            var uri = new Uri(baseUrl);
            if (uri.IsDefaultPort)
                map[uri.Host] = site;
            else
                map[$"{uri.Host}:{uri.Port}"] = site;
        }

        return map;
    }

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

    private const string ThomHost = "css-latam.int.thomsonreuters.com";

    private static readonly string[] St2ReservedPrefixes =
    [
        "/embed/",
        "/js/",
        "/img/",
        "/data/",
        "/c/",
        "/media/",
    ];

    private static readonly string[] St2ApiPrefixes =
    [
        "/api/health",
        "/api/live",
        "/api/version",
        "/api/app-config",
        "/api/types",
        "/api/organize",
        "/api/media-proxy",
        "/api/search",
        "/api/knowledge/",
        "/api/planillas/",
        "/api/portal-pdf/",
        "/api/access/",
        "/api/capturas/",
        "/api/tools/",
    ];

    private static readonly string[] St2ReservedExact =
    [
        "/",
        "/index.html",
        "/st2.ico",
        "/css/styles.css",
        "/css/planillas.css",
    ];

    public static bool ShouldMirrorThomPath(PathString path) =>
        !IsSt2OwnedPath(path.Value ?? "/");

    private static bool IsSt2OwnedPath(string value)
    {
        if (St2AppRoutes.IsAppShell(value))
            return true;

        if (St2ReservedExact.Contains(value, StringComparer.OrdinalIgnoreCase))
            return true;

        foreach (var prefix in St2ReservedPrefixes)
        {
            if (value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        if (value.StartsWith("/css/", StringComparison.OrdinalIgnoreCase))
            return true;

        if (!value.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
            return false;

        foreach (var prefix in St2ApiPrefixes)
        {
            if (value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }

    public static string ToEmbedPath(string absoluteUrl)
    {
        if (!Uri.TryCreate(absoluteUrl, UriKind.Absolute, out var uri))
            return "/";

        if (uri.Host.Equals(ThomHost, StringComparison.OrdinalIgnoreCase))
            return $"{uri.AbsolutePath}{uri.Query}";

        var site = ResolveSite(uri.Host, uri.Port) ?? uri.Host.Split('.')[0].ToLowerInvariant();
        return $"/embed/{site}{uri.AbsolutePath}{uri.Query}";
    }

    public async Task HandleMirrorAsync(HttpContext context, CancellationToken ct)
    {
        var path = (context.Request.Path.Value ?? "/").TrimStart('/');
        await HandleAsync(context, "thom", path, ct, mirrorPaths: true);
    }

    public async Task HandleAsync(HttpContext context, string site, string path, CancellationToken ct) =>
        await HandleAsync(context, site, path, ct, mirrorPaths: false);

    private async Task HandleAsync(HttpContext context, string site, string path, CancellationToken ct, bool mirrorPaths)
    {
        if (!SiteBases.TryGetValue(site, out var baseUrl))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        if (HttpMethods.IsOptions(context.Request.Method))
        {
            ApplyEmbedCorsHeaders(context.Request, context.Response);
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

        CopyResponseHeaders(response, context.Response, site, context.Request.IsHttps, mirrorPaths);
        ApplyEmbedCorsHeaders(context.Request, context.Response);

        if (response.Headers.Location is not null)
        {
            var rewritten = mirrorPaths
                ? RewriteMirrorUrl(response.Headers.Location.ToString())
                : RewriteUrl(response.Headers.Location.ToString(), site);
            context.Response.Headers.Location = rewritten;
        }

        var contentType = response.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
        context.Response.ContentType = contentType;

        if (ShouldRewrite(contentType))
        {
            var text = await response.Content.ReadAsStringAsync(ct);
            text = RewriteContent(text, site, contentType, mirrorPaths, _autoCloseThomHelpPanel, _thomZoomFactor);
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
        var handler = ThomUpstreamHttp.CreateHandler(allowAutoRedirect: false);
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
        if (request.Headers.TryGetValue("Cookie", out var cookie))
            message.Headers.TryAddWithoutValidation("Cookie", cookie.ToArray());
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

    private static void CopyResponseHeaders(HttpResponseMessage upstream, HttpResponse response, string currentSite, bool isHttps, bool mirrorPaths = false)
    {
        foreach (var header in upstream.Headers)
        {
            if (BlockedResponseHeaders.Contains(header.Key, StringComparer.OrdinalIgnoreCase))
                continue;
            if (header.Key.Equals("Transfer-Encoding", StringComparison.OrdinalIgnoreCase))
                continue;
            if (header.Key.Equals("Set-Cookie", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var cookie in header.Value)
                    response.Headers.Append("Set-Cookie", RewriteSetCookie(cookie, currentSite, isHttps, mirrorPaths));
                continue;
            }
            response.Headers[header.Key] = header.Value.ToArray();
        }

        foreach (var header in upstream.Content.Headers)
        {
            if (header.Key.Equals("Content-Length", StringComparison.OrdinalIgnoreCase))
                continue;
            if (header.Key.Equals("Set-Cookie", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var cookie in header.Value)
                    response.Headers.Append("Set-Cookie", RewriteSetCookie(cookie, currentSite, isHttps, mirrorPaths));
                continue;
            }
            response.Headers[header.Key] = header.Value.ToArray();
        }

        response.Headers.Remove("Content-Security-Policy");
        response.Headers.Remove("X-Frame-Options");
    }

    private static string RewriteSetCookie(string setCookie, string site, bool isHttps, bool mirrorPaths = false)
    {
        var value = Regex.Replace(setCookie, @";\s*Domain=[^;]*", "", RegexOptions.IgnoreCase);
        value = Regex.Replace(value, @";\s*SameSite=[^;]*", "", RegexOptions.IgnoreCase);
        value = Regex.Replace(value, @";\s*Secure", "", RegexOptions.IgnoreCase);
        var cookiePath = "/";
        if (Regex.IsMatch(value, @";\s*Path=", RegexOptions.IgnoreCase))
            value = Regex.Replace(value, @";\s*Path=[^;]*", $"; Path={cookiePath}", RegexOptions.IgnoreCase);
        else
            value += $"; Path={cookiePath}";
        value += isHttps ? "; SameSite=None; Secure" : "; SameSite=Lax";
        return value;
    }

    private static bool ShouldRewrite(string contentType) =>
        TextualContentRegex.IsMatch(contentType);

    private static readonly Regex OAuthRedirectUriRegex = new(
        @"redirect_uri=([^&""'\s]+)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static string RewriteContent(string content, string site, string contentType, bool mirrorPaths, bool autoCloseHelpPanel, double thomZoomFactor)
    {
        if (mirrorPaths)
        {
            if (contentType.Contains("html", StringComparison.OrdinalIgnoreCase))
            {
            content = RewriteThomMirrorHostsPreservingOAuth(content);
            content = InjectThomEmbedBridge(content, autoCloseHelpPanel, thomZoomFactor);
            content = StripCrossOriginAttributes(content);
            }
            else if (contentType.Contains("javascript", StringComparison.OrdinalIgnoreCase)
                     || contentType.Contains("css", StringComparison.OrdinalIgnoreCase))
            {
                content = RewriteCloudFrontHosts(content);
                content = RewriteThomMirrorHostsPreservingOAuth(content);
                if (autoCloseHelpPanel && contentType.Contains("javascript", StringComparison.OrdinalIgnoreCase))
                    content = RewriteThomHelpPanelDefault(content);
            }
            else
            {
                content = RewriteThomMirrorHostsPreservingOAuth(content);
            }

            return content;
        }

        if (contentType.Contains("html", StringComparison.OrdinalIgnoreCase))
        {
            content = RewriteAbsoluteHostsPreservingOAuth(content);

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
            if (IsPortalWebSite(site))
                content = RewritePortalWebpackPublicPath(content, site);
            content = StripCrossOriginAttributes(content);
        }
        else if (contentType.Contains("javascript", StringComparison.OrdinalIgnoreCase)
                 || contentType.Contains("css", StringComparison.OrdinalIgnoreCase))
        {
            content = RewriteCloudFrontHosts(content);
            content = RewriteScriptOrStyleUrls(content, site);
            content = RewriteAbsoluteHostsPreservingOAuth(content);
            if (IsPortalWebSite(site) && contentType.Contains("javascript", StringComparison.OrdinalIgnoreCase))
                content = RewritePortalWebpackPublicPath(content, site);
        }
        else
        {
            content = RewriteAbsoluteHostsPreservingOAuth(content);
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

    private static void ApplyEmbedCorsHeaders(HttpRequest request, HttpResponse response)
    {
        var origin = request.Headers.Origin.FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(origin))
        {
            response.Headers.AccessControlAllowOrigin = origin;
            response.Headers.AccessControlAllowCredentials = "true";
        }
        else
        {
            response.Headers.AccessControlAllowOrigin = "*";
        }

        response.Headers.AccessControlAllowMethods = "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS";
        response.Headers.AccessControlAllowHeaders = "Content-Type, Authorization, Accept, Origin, X-Requested-With";
        response.Headers.Vary = "Origin";
    }

    private static string StripCrossOriginAttributes(string content) =>
        Regex.Replace(content, @"\s+crossorigin(=(['""])?(anonymous|use-credentials)\2)?", "", RegexOptions.IgnoreCase);

    private static bool IsPortalWebSite(string site) =>
        site.Equals("portal-bejerman", StringComparison.OrdinalIgnoreCase)
        || site.Equals("portal-legal", StringComparison.OrdinalIgnoreCase);

    private static string RewritePortalWebpackPublicPath(string content, string site)
    {
        var embed = $"/embed/{site}/";
        return Regex.Replace(
            content,
            @"(\.p\s*=\s*"")/""",
            $"$1{embed}\"",
            RegexOptions.IgnoreCase);
    }

    private static string RewriteThomHelpPanelDefault(string content) =>
        content.Replace("caseId:\"\",isHelpOpen:!0", "caseId:\"\",isHelpOpen:!1", StringComparison.Ordinal);

    private static string InjectThomEmbedBridge(string content, bool autoCloseHelpPanel, double thomZoomFactor)
    {
        var zoomLiteral = thomZoomFactor.ToString(System.Globalization.CultureInfo.InvariantCulture);
        var zoomScript = $@"
  function applyThomZoom() {{
    try {{
      var z = ""{zoomLiteral}"";
      document.documentElement.style.zoom = z;
      if (document.body) document.body.style.zoom = z;
    }} catch (e) {{}}
  }}
  applyThomZoom();
  window.addEventListener(""load"", applyThomZoom);
  new MutationObserver(applyThomZoom).observe(document.documentElement, {{ childList: true, subtree: true }});
";

        const string helpPanelScript = """

  function collapseHelpPanel() {
    var buttons = document.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      var cls = buttons[i].className || "";
      if (cls.indexOf("panelOpened") >= 0) {
        buttons[i].click();
        return true;
      }
    }
    var tooltipBtn = document.querySelector('[aria-label="Close Help Panel"]');
    if (tooltipBtn) { tooltipBtn.click(); return true; }
    return false;
  }
  function scheduleHelpPanelCollapse() {
    if (window.__st2HelpCollapseDone) return;
    var tries = 0;
    function attempt() {
      if (collapseHelpPanel()) {
        window.__st2HelpCollapseDone = true;
        return;
      }
      if (++tries > 80) return;
      setTimeout(attempt, 300);
    }
    attempt();
  }
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "st2-collapse-help") scheduleHelpPanelCollapse();
  });
  window.addEventListener("load", scheduleHelpPanelCollapse);
  new MutationObserver(function () {
    if (!window.__st2HelpCollapseDone) scheduleHelpPanelCollapse();
  }).observe(document.documentElement, { childList: true, subtree: true });
""";

        const string bridgeCore = """
<script>
(function () {
  function notify(extra) {
    try {
      var root = document.getElementById("root");
      var hasContent = !!(root && root.children && root.children.length > 0);
      parent.postMessage({
        type: "st2-thom-state",
        hasContent: hasContent,
        path: location.pathname,
        ready: document.readyState,
        alive: true
      }, "*");
    } catch (e) {}
  }
  window.addEventListener("error", function (e) {
    try {
      parent.postMessage({
        type: "st2-thom-state",
        hasContent: false,
        path: location.pathname,
        error: e.message || "script-error",
        alive: true
      }, "*");
    } catch (x) {}
  });
  window.addEventListener("load", function () { notify(); setTimeout(notify, 1500); setTimeout(notify, 5000); });
  new MutationObserver(notify).observe(document.documentElement, { childList: true, subtree: true });
""";

        const string bridgeEnd = """
})();
</script>
""";

        var bridge = bridgeCore + zoomScript + (autoCloseHelpPanel ? helpPanelScript : "") + bridgeEnd;
        if (content.Contains("st2-thom-state", StringComparison.Ordinal))
            return content;

        return Regex.Replace(
            content,
            @"</body>",
            bridge + "</body>",
            RegexOptions.IgnoreCase);
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

    private static string RewriteAbsoluteHostsPreservingOAuth(string content) =>
        RewriteHostsPreservingOAuth(content, RewriteAbsoluteHosts);

    private static string RewriteThomMirrorHostsPreservingOAuth(string content) =>
        RewriteHostsPreservingOAuth(content, RewriteThomMirrorHosts);

    private static string RewriteHostsPreservingOAuth(string content, Func<string, string> rewriteHosts)
    {
        var tokens = new List<string>();
        content = OAuthRedirectUriRegex.Replace(content, match =>
        {
            tokens.Add(match.Value);
            return $"__OAUTH_RU_{tokens.Count - 1}__";
        });

        content = rewriteHosts(content);

        for (var i = 0; i < tokens.Count; i++)
            content = content.Replace($"__OAUTH_RU_{i}__", tokens[i], StringComparison.Ordinal);

        return content;
    }

    private static string RewriteThomMirrorHosts(string content)
    {
        content = content.Replace($"https://{ThomHost}", "", StringComparison.OrdinalIgnoreCase);
        content = content.Replace($"http://{ThomHost}", "", StringComparison.OrdinalIgnoreCase);
        content = content.Replace($"//{ThomHost}", "", StringComparison.OrdinalIgnoreCase);

        foreach (var (site, baseUrl) in SiteBases.OrderByDescending(kv => kv.Value.Length))
        {
            if (site.Equals("thom", StringComparison.OrdinalIgnoreCase))
                continue;

            content = ReplaceBaseUrlWithEmbed(content, site, baseUrl);
        }

        return content;
    }

    private static string RewriteMirrorUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return "/";

        if (Uri.TryCreate(url, UriKind.Absolute, out var absolute))
        {
            if (absolute.Host.Equals(ThomHost, StringComparison.OrdinalIgnoreCase))
                return absolute.PathAndQuery;

            var site = ResolveSite(absolute.Host, absolute.Port);
            return site is null ? url : $"/embed/{site}{absolute.PathAndQuery}";
        }

        return url;
    }

    private static string RewriteAbsoluteHosts(string content)
    {
        foreach (var (site, baseUrl) in SiteBases.OrderByDescending(kv => kv.Value.Length))
            content = ReplaceBaseUrlWithEmbed(content, site, baseUrl);

        return content;
    }

    private static string ReplaceBaseUrlWithEmbed(string content, string site, string baseUrl)
    {
        var uri = new Uri(baseUrl);
        var embed = $"/embed/{site}";
        content = content.Replace(baseUrl, embed, StringComparison.OrdinalIgnoreCase);
        content = content.Replace(baseUrl.TrimEnd('/'), embed, StringComparison.OrdinalIgnoreCase);

        if (uri.IsDefaultPort)
        {
            content = content.Replace($"https://{uri.Host}", embed, StringComparison.OrdinalIgnoreCase);
            content = content.Replace($"http://{uri.Host}", embed, StringComparison.OrdinalIgnoreCase);
            content = content.Replace($"//{uri.Host}", embed, StringComparison.OrdinalIgnoreCase);
        }
        else
        {
            var hostPort = $"{uri.Host}:{uri.Port}";
            content = content.Replace($"https://{hostPort}", embed, StringComparison.OrdinalIgnoreCase);
            content = content.Replace($"http://{hostPort}", embed, StringComparison.OrdinalIgnoreCase);
            content = content.Replace($"//{hostPort}", embed, StringComparison.OrdinalIgnoreCase);
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
            var site = ResolveSite(absolute.Host, absolute.Port);
            if (site is null)
                return url;
            return $"/embed/{site}{absolute.PathAndQuery}";
        }

        if (url.StartsWith('/'))
            return $"/embed/{currentSite}{url}";

        return url;
    }

    private static string? ResolveSite(string host, int port = -1)
    {
        if (port > 0 && !IsDefaultHttpPort(port))
        {
            var hostPort = $"{host}:{port}";
            if (HostToSite.TryGetValue(hostPort, out var siteWithPort))
                return siteWithPort;
        }

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
        || host.Equals("thomsonreuters.com", StringComparison.OrdinalIgnoreCase)
        || host.EndsWith(".thomsonreuters.com.ar", StringComparison.OrdinalIgnoreCase)
        || host.Equals("thomsonreuters.com.ar", StringComparison.OrdinalIgnoreCase);

    private static bool IsDefaultHttpPort(int port) => port is 80 or 443;
}
