using PortalClienchi.Core.Models;

namespace PortalClienchi.Web;

internal static class WebMediaEmbedFix
{
    public static string PatchTopMediaFrame(string html, MediaResource? media, string pageOrigin)
    {
        if (media?.Kind != MediaKind.Video || string.IsNullOrWhiteSpace(media.Url))
            return html;

        var originEncoded = Uri.EscapeDataString(pageOrigin.TrimEnd('/'));
        string? embedUrl = null;
        if (WebStreamingEmbed.TryGetYouTubeEmbedUrl(media.Url, originEncoded, out var youtube))
            embedUrl = youtube;
        else if (WebStreamingEmbed.TryGetVimeoEmbedUrl(media.Url, pageOrigin, out var vimeo))
            embedUrl = vimeo;

        if (embedUrl is null)
            return html;

        var marker = html.Contains("media-frame streaming-frame", StringComparison.Ordinal)
            ? "class=\"media-frame streaming-frame\""
            : "class=\"media-frame\"";

        var start = html.IndexOf(marker, StringComparison.Ordinal);
        if (start < 0)
            return html;

        var iframeStart = html.IndexOf("<iframe", start, StringComparison.Ordinal);
        if (iframeStart < 0)
            return html;

        var srcAttr = html.IndexOf("src=\"", iframeStart, StringComparison.Ordinal);
        if (srcAttr < 0)
            return html;

        var srcStart = srcAttr + 5;
        var srcEnd = html.IndexOf('"', srcStart);
        if (srcEnd < 0)
            return html;

        return html[..srcStart] + embedUrl + html[srcEnd..];
    }

    public static string PatchEmbeddedIframe(string iframeHtml, string pageOrigin)
    {
        var srcMatch = System.Text.RegularExpressions.Regex.Match(
            iframeHtml,
            @"src=""(?<url>[^""]+)""",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (!srcMatch.Success)
            return iframeHtml;

        var url = srcMatch.Groups["url"].Value;
        var originEncoded = Uri.EscapeDataString(pageOrigin.TrimEnd('/'));
        string? embedUrl = null;

        if (WebStreamingEmbed.TryGetYouTubeEmbedUrl(url, originEncoded, out var youtube))
            embedUrl = youtube;
        else if (WebStreamingEmbed.TryGetVimeoEmbedUrl(url, pageOrigin, out var vimeo))
            embedUrl = vimeo;

        if (embedUrl is null)
            return iframeHtml;

        return iframeHtml.Replace(url, embedUrl, StringComparison.Ordinal);
    }
}
