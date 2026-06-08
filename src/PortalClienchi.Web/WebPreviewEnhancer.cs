using System.Net;
using PortalClienchi.Core.Models;

namespace PortalClienchi.Web;

internal static class WebPreviewEnhancer
{
    public static string InjectPrintStylesOnly(string html)
    {
        const string printCss = """
            @media print {
              .media-frame iframe, .media-frame video { display: none !important; }
              .media-print-fallback { display: block !important; color: #374151 !important; font-size: 12px; margin: 8px 0; }
              .content img { max-width: 100% !important; page-break-inside: avoid; }
            }
            @media screen {
              .media-print-fallback { display: none; }
            }
            """;

        if (html.Contains("media-print-fallback", StringComparison.Ordinal))
            return html;

        return html.Replace("</style>", printCss + "</style>", StringComparison.Ordinal);
    }

    public static string BuildMediaPrintFallback(MediaResource? media)
    {
        if (media is null || string.IsNullOrWhiteSpace(media.Url))
            return "";

        var label = media.Kind == MediaKind.Video ? "Ver video" : "Ver archivo";
        return $"""<p class="media-print-fallback"><strong>{label}:</strong> {WebUtility.HtmlEncode(media.Url)}</p>""";
    }
}
