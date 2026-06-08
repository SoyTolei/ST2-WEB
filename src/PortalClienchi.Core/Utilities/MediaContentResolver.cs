using System.Text.RegularExpressions;
using HtmlAgilityPack;
using PortalClienchi.Core.Configuration;
using PortalClienchi.Core.Models;

namespace PortalClienchi.Core.Utilities;

public static class MediaContentResolver
{
    private static readonly Regex HrefRegex = new(
        @"href=[""']([^""']+)[""']",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static MediaResource? Resolve(KnowledgeItem item, AppSettings settings)
    {
        var candidates = CollectUrls(item, settings);
        MediaResource? pdf = null;
        MediaResource? video = null;

        foreach (var url in candidates)
        {
            var kind = ClassifyUrl(url);
            if (kind == MediaKind.None)
                continue;
            var resource = BuildResource(url, kind, item.Title);
            if (kind == MediaKind.Pdf && pdf is null)
                pdf = resource;
            if (kind == MediaKind.Video && video is null)
                video = resource;
        }

        if (item.Type == KnowledgeType.Link)
            return pdf ?? video;

        if (item.Type == KnowledgeType.Video)
            return video ?? pdf;

        return pdf ?? video;
    }

    public static IReadOnlyList<string> CollectUrls(KnowledgeItem item, AppSettings settings)
    {
        var list = new List<string>();
        void Add(string? raw)
        {
            var abs = ToAbsoluteUrl(raw, settings);
            if (!string.IsNullOrWhiteSpace(abs) && !list.Contains(abs, StringComparer.OrdinalIgnoreCase))
                list.Add(abs);
        }

        Add(item.ExternalUrl);
        foreach (var u in item.AttachmentUrls)
            Add(u);
        foreach (var u in ExtractUrlsFromHtml(item.DescriptionHtml))
            Add(u);

        return list;
    }

    public static string? ToAbsoluteUrl(string? url, AppSettings settings)
    {
        if (string.IsNullOrWhiteSpace(url))
            return null;
        url = url.Trim();
        if (url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return url;

        var baseUrl = settings.PortalBaseUrl.TrimEnd('/');
        return url.StartsWith('/') ? baseUrl + url : $"{baseUrl}/{url}";
    }

    public static MediaKind ClassifyUrl(string url)
    {
        var lower = url.ToLowerInvariant();
        if (lower.Contains(".pdf", StringComparison.Ordinal) ||
            lower.Contains("application/pdf", StringComparison.Ordinal) ||
            lower.Contains("/pdf/", StringComparison.Ordinal) ||
            lower.Contains("format=pdf", StringComparison.Ordinal))
            return MediaKind.Pdf;

        if (StreamingEmbedHelper.IsStreamingUrl(url) ||
            lower.EndsWith(".mp4", StringComparison.Ordinal) ||
            lower.EndsWith(".webm", StringComparison.Ordinal) ||
            lower.EndsWith(".m4v", StringComparison.Ordinal) ||
            lower.Contains(".mp4?", StringComparison.Ordinal) ||
            lower.Contains("/video/", StringComparison.Ordinal) ||
            lower.Contains("video.", StringComparison.Ordinal))
            return MediaKind.Video;

        return MediaKind.None;
    }

    private static MediaResource BuildResource(string url, MediaKind kind, string title)
    {
        var safe = Regex.Replace(title, @"[^\w\s\-áéíóúñÁÉÍÓÚÑ]", "").Trim();
        if (safe.Length > 60)
            safe = safe[..60];

        return kind switch
        {
            MediaKind.Pdf => new MediaResource
            {
                Url = url,
                Kind = MediaKind.Pdf,
                SuggestedFileName = string.IsNullOrWhiteSpace(safe) ? "documento.pdf" : $"{safe}.pdf",
                DownloadFilter = "PDF (*.pdf)|*.pdf",
            },
            MediaKind.Video => new MediaResource
            {
                Url = url,
                Kind = MediaKind.Video,
                SuggestedFileName = string.IsNullOrWhiteSpace(safe) ? "video.mp4" : $"{safe}.mp4",
                DownloadFilter = "Video (*.mp4;*.webm)|*.mp4;*.webm|Todos|*.*",
            },
            _ => new MediaResource { Url = url, Kind = MediaKind.None, SuggestedFileName = safe },
        };
    }

    private static IEnumerable<string> ExtractUrlsFromHtml(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
            yield break;

        var doc = new HtmlDocument();
        doc.LoadHtml(html);
        var nodes = doc.DocumentNode.SelectNodes("//a[@href]|//video[@src]|//video//source[@src]|//iframe[@src]|//embed[@src]");
        if (nodes is not null)
        {
            foreach (var node in nodes)
            {
                var u = node.GetAttributeValue("href", null) ??
                        node.GetAttributeValue("src", null);
                if (!string.IsNullOrWhiteSpace(u))
                    yield return u;
            }
        }

        foreach (Match m in HrefRegex.Matches(html))
        {
            if (!string.IsNullOrWhiteSpace(m.Groups[1].Value))
                yield return m.Groups[1].Value;
        }
    }
}
