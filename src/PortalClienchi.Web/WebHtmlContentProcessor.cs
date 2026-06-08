using System.Net;
using System.Text.RegularExpressions;
using HtmlAgilityPack;
using PortalClienchi.Core.Configuration;
using PortalClienchi.Core.Utilities;

namespace PortalClienchi.Web;

internal static class WebHtmlContentProcessor
{
    private static readonly Regex IframeSrcRegex = new(
        @"<iframe[^>]+src=[""']([^""']+)[""']",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex EmbedSrcRegex = new(
        @"<embed[^>]+src=[""']([^""']+)[""']",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex DataImgRegex = new(
        """<img\b(?:(?!>).)*?\ssrc=(?:"data:[^"]+"|'data:[^']+')[^>]*>""",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    private static readonly Regex ImgSrcRegex = new(
        """(<img\b(?:(?!>).)*?\ssrc=")(?<url>[^"]+)(")""",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    private static readonly Regex ImgSrcSingleQuoteRegex = new(
        """(<img\b(?:(?!>).)*?\ssrc=')(?<url>[^']+)(')""",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    public static string ProcessBody(string? html, AppSettings settings, string pageOrigin)
    {
        if (string.IsNullOrWhiteSpace(html))
            return "";

        var placeholders = new List<string>();
        var protectedHtml = DataImgRegex.Replace(html, match =>
        {
            var key = $"__ST2_IMG_{placeholders.Count}__";
            placeholders.Add(match.Value);
            return key;
        });

        var doc = new HtmlDocument();
        doc.LoadHtml(protectedHtml);

        doc.DocumentNode.SelectSingleNode("//h1|//h2")?.Remove();

        foreach (var node in doc.DocumentNode.Descendants().ToList())
        {
            if (node.Name is "script" or "style")
            {
                node.Remove();
                continue;
            }

            if (node.Name is "iframe" or "object" or "embed")
            {
                var src = node.GetAttributeValue("src", "") ?? node.GetAttributeValue("data-src", "");
                var link = BuildVideoLink(src, settings);
                if (link is not null)
                {
                    var linkNode = HtmlNode.CreateNode(link);
                    node.ParentNode?.ReplaceChild(linkNode, node);
                }
                else
                    node.Remove();
                continue;
            }

            if (node.Name == "img")
                FixImageNode(node, settings);

            node.Attributes.Remove("style");
            node.Attributes.Remove("bgcolor");
            node.Attributes.Remove("background");
            node.Attributes.Remove("color");
        }

        var result = doc.DocumentNode.InnerHtml;
        for (var i = 0; i < placeholders.Count; i++)
            result = result.Replace($"__ST2_IMG_{i}__", placeholders[i], StringComparison.Ordinal);

        return result;
    }

    private static readonly Regex HrefRegex = new(
        @"href=[""']([^""']+)[""']",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static string ExtractAdditionalEmbeds(string? html, AppSettings settings, string pageOrigin)
    {
        if (string.IsNullOrWhiteSpace(html))
            return "";

        var urls = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (Match match in IframeSrcRegex.Matches(html))
            urls.Add(match.Groups[1].Value);
        foreach (Match match in EmbedSrcRegex.Matches(html))
            urls.Add(match.Groups[1].Value);
        foreach (Match match in HrefRegex.Matches(html))
        {
            var href = match.Groups[1].Value;
            if (StreamingEmbedHelper.IsStreamingUrl(href)
                || href.Contains(".mp4", StringComparison.OrdinalIgnoreCase)
                || href.Contains(".webm", StringComparison.OrdinalIgnoreCase))
                urls.Add(href);
        }

        var blocks = new List<string>();
        foreach (var url in urls)
        {
            var block = BuildStreamingEmbedFromUrl(url, settings, pageOrigin);
            if (block is not null)
                blocks.Add(block);
        }

        return string.Concat(blocks);
    }

    private static void FixImageNode(HtmlNode img, AppSettings settings)
    {
        var src = FirstNonEmpty(
            img.GetAttributeValue("data-src", ""),
            img.GetAttributeValue("data-original", ""),
            img.GetAttributeValue("data-lazy-src", ""),
            img.GetAttributeValue("src", ""));

        if (string.IsNullOrWhiteSpace(src))
            return;

        if (src.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            return;

        if (src.StartsWith("file:", StringComparison.OrdinalIgnoreCase))
        {
            img.SetAttributeValue("src", "");
            img.SetAttributeValue("alt", "Captura no disponible en la vista web");
            return;
        }

        var absolute = WebImageUrlResolver.Resolve(src, settings);
        if (string.IsNullOrWhiteSpace(absolute))
            return;

        img.SetAttributeValue("src", absolute);
        img.Attributes.Remove("data-src");
        img.Attributes.Remove("data-original");
        img.Attributes.Remove("data-lazy-src");
        img.SetAttributeValue("loading", "lazy");
    }

    private static string FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v)) ?? "";

    public static string RewriteProtectedImages(string html, AppSettings settings)
    {
        if (string.IsNullOrWhiteSpace(html))
            return html;

        html = RewriteProtectedImagesCore(html, settings, ImgSrcRegex);
        return RewriteProtectedImagesCore(html, settings, ImgSrcSingleQuoteRegex);
    }

    private static string RewriteProtectedImagesCore(string html, AppSettings settings, Regex regex) =>
        regex.Replace(html, match =>
        {
            var src = WebUtility.HtmlDecode(match.Groups["url"].Value);
            if (src.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                return match.Value;

            var absolute = WebImageUrlResolver.Resolve(src, settings) ?? src;

            if (!WebImageUrlResolver.NeedsAuthenticatedProxy(absolute, settings))
                return match.Groups[1].Value + absolute + match.Groups[3].Value;

            var proxyUrl = "/api/media-proxy?url=" + Uri.EscapeDataString(absolute);
            return match.Groups[1].Value + proxyUrl + match.Groups[3].Value;
        });
    private static string? BuildVideoLink(string? url, AppSettings settings)
    {
        var absolute = MediaContentResolver.ToAbsoluteUrl(url, settings) ?? url;
        if (string.IsNullOrWhiteSpace(absolute))
            return null;

        var safe = WebUtility.HtmlEncode(absolute);
        return $"""<p class="video-link"><a href="{safe}" target="_blank" rel="noopener">Ver video</a></p>""";
    }

    public static string InjectEmbeds(string html, string embedBlocks)
    {
        if (string.IsNullOrWhiteSpace(embedBlocks))
            return html;

        const string marker = "<div class=\"content\">";
        var index = html.IndexOf(marker, StringComparison.Ordinal);
        if (index < 0)
            return html;

        return html.Insert(index + marker.Length, embedBlocks);
    }

    private static string? BuildStreamingEmbedFromUrl(string? url, AppSettings settings, string pageOrigin)
    {
        if (string.IsNullOrWhiteSpace(url))
            return null;

        var absolute = MediaContentResolver.ToAbsoluteUrl(url, settings) ?? url;
        var originEncoded = Uri.EscapeDataString(pageOrigin.TrimEnd('/'));

        if (WebStreamingEmbed.TryGetYouTubeEmbedUrl(absolute, originEncoded, out var youtube))
            return BuildIframeBlock(youtube, "Video de YouTube");

        if (WebStreamingEmbed.TryGetVimeoEmbedUrl(absolute, pageOrigin, out var vimeo))
            return BuildIframeBlock(vimeo, "Video de Vimeo");

        if (absolute.Contains(".mp4", StringComparison.OrdinalIgnoreCase)
            || absolute.Contains(".webm", StringComparison.OrdinalIgnoreCase))
        {
            var safe = WebUtility.HtmlEncode(absolute);
            return $"""
                <div class="media-frame"><video controls preload="metadata" src="{safe}">Tu navegador no reproduce este video.</video></div>
                """;
        }

        return null;
    }

    private static string BuildIframeBlock(string embedUrl, string title)
    {
        var safeTitle = WebUtility.HtmlEncode(title);
        var fallback = embedUrl.Contains("vimeo.com", StringComparison.OrdinalIgnoreCase)
            ? $"""<p class="media-hint"><a href="{WebUtility.HtmlEncode(ExtractWatchUrl(embedUrl))}" target="_blank" rel="noopener">Si no carga, abrir en Vimeo</a></p>"""
            : "";

        return $"""
            {fallback}<div class="media-frame streaming-frame">
            <iframe src="{embedUrl}" referrerpolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowfullscreen title="{safeTitle}"></iframe>
            </div>
            """;
    }

    private static string ExtractWatchUrl(string embedUrl)
    {
        var match = Regex.Match(embedUrl, @"player\.vimeo\.com/video/(?<id>\d+)");
        return match.Success ? $"https://vimeo.com/{match.Groups["id"].Value}" : embedUrl;
    }
}

internal static class WebStreamingEmbed
{
    public static bool TryGetYouTubeEmbedUrl(string url, string originEncoded, out string embedUrl)
    {
        embedUrl = "";
        if (!StreamingEmbedHelper.TryGetYouTubeEmbedUrl(url, out embedUrl))
            return false;

        embedUrl = Regex.Replace(
            embedUrl,
            @"origin=[^&""']+",
            $"origin={originEncoded}",
            RegexOptions.IgnoreCase);
        return true;
    }

    public static bool TryGetVimeoEmbedUrl(string url, string pageOrigin, out string embedUrl)
    {
        embedUrl = "";
        var match = Regex.Match(
            url,
            @"vimeo\.com/(?:video/)?(?<id>\d+)(?:/(?<hash>[a-f0-9]+))?",
            RegexOptions.IgnoreCase);
        if (!match.Success)
        {
            return StreamingEmbedHelper.TryGetVimeoEmbedUrl(url, out embedUrl)
                && AppendVimeoReferrer(ref embedUrl, pageOrigin);
        }

        var id = match.Groups["id"].Value;
        var hash = match.Groups["hash"].Success ? match.Groups["hash"].Value : "";
        var referrer = Uri.EscapeDataString(pageOrigin.TrimEnd('/') + "/");

        embedUrl = string.IsNullOrEmpty(hash)
            ? $"https://player.vimeo.com/video/{id}?title=0&byline=0&portrait=0&referrer={referrer}"
            : $"https://player.vimeo.com/video/{id}?h={hash}&title=0&byline=0&portrait=0&referrer={referrer}";

        return true;
    }

    private static bool AppendVimeoReferrer(ref string embedUrl, string pageOrigin)
    {
        var referrer = Uri.EscapeDataString(pageOrigin.TrimEnd('/') + "/");
        embedUrl += embedUrl.Contains('?') ? "&" : "?";
        embedUrl += $"referrer={referrer}";
        return true;
    }
}
