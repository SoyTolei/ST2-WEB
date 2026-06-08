using System.Text.RegularExpressions;

namespace PortalClienchi.Core.Utilities;

public static class StreamingEmbedHelper
{
    public static string PreviewOrigin => "https://portal-preview.local";

    public static bool IsYouTubeUrl(string url) =>
        url.Contains("youtube.com", StringComparison.OrdinalIgnoreCase) ||
        url.Contains("youtu.be", StringComparison.OrdinalIgnoreCase);

    public static bool IsVimeoUrl(string url) =>
        url.Contains("vimeo.com", StringComparison.OrdinalIgnoreCase);

    public static bool IsStreamingUrl(string url) =>
        IsYouTubeUrl(url) || IsVimeoUrl(url);

    public static bool TryGetYouTubeEmbedUrl(string url, out string embedUrl)
    {
        embedUrl = "";
        if (!TryGetYouTubeId(url, out var id))
            return false;

        var origin = Uri.EscapeDataString(PreviewOrigin);
        embedUrl =
            $"https://www.youtube-nocookie.com/embed/{id}?origin={origin}&enablejsapi=1&rel=0&modestbranding=1&playsinline=1";
        return true;
    }

    public static bool TryGetVimeoEmbedUrl(string url, out string embedUrl)
    {
        embedUrl = "";
        var match = Regex.Match(url, @"vimeo\.com/(?:video/)?(\d+)", RegexOptions.IgnoreCase);
        if (!match.Success)
            return false;

        embedUrl = $"https://player.vimeo.com/video/{match.Groups[1].Value}?title=0&byline=0&portrait=0&dnt=1";
        return true;
    }

    public static bool TryGetStreamingEmbedUrl(string url, out string embedUrl)
    {
        if (TryGetYouTubeEmbedUrl(url, out embedUrl))
            return true;
        return TryGetVimeoEmbedUrl(url, out embedUrl);
    }

    private static bool TryGetYouTubeId(string url, out string id)
    {
        id = "";
        var lower = url.ToLowerInvariant();

        if (lower.Contains("youtube.com/watch") && url.Contains('?'))
        {
            foreach (var part in url[(url.IndexOf('?') + 1)..].Split('&'))
            {
                if (part.StartsWith("v=", StringComparison.OrdinalIgnoreCase))
                {
                    id = part[2..].Trim();
                    return id.Length > 0;
                }
            }
        }
        else if (lower.Contains("youtu.be/"))
        {
            id = url.Split('/', StringSplitOptions.RemoveEmptyEntries).LastOrDefault() ?? "";
            var q = id.IndexOf('?');
            if (q > 0)
                id = id[..q];
            return id.Length > 0;
        }
        else if (lower.Contains("youtube.com/embed/"))
        {
            var parts = url.Split('/', StringSplitOptions.RemoveEmptyEntries);
            id = parts.LastOrDefault() ?? "";
            var q = id.IndexOf('?');
            if (q > 0)
                id = id[..q];
            return id.Length > 0;
        }

        return false;
    }
}
