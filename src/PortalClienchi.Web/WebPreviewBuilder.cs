using PortalClienchi.Core.Configuration;
using PortalClienchi.Core.Models;
using PortalClienchi.Core.Utilities;

namespace PortalClienchi.Web;

internal static class WebPreviewBuilder
{
    public static string Build(
        KnowledgeItem item,
        string typeLabel,
        MediaResource? media,
        AppSettings settings,
        string pageOrigin)
    {
        var processedBody = WebHtmlContentProcessor.ProcessBody(
            item.DescriptionHtml,
            settings,
            pageOrigin);

        var html = WebPreviewHtmlBuilder.Wrap(
            item.Title,
            item.ProductName,
            typeLabel,
            processedBody,
            item.DescriptionPlain,
            item.PortalUrl,
            media);

        var embeddedPlayers = WebHtmlContentProcessor.ExtractAdditionalEmbeds(
            item.DescriptionHtml,
            settings,
            pageOrigin);

        html = WebHtmlContentProcessor.InjectEmbeds(html, embeddedPlayers);

        if (media is not null)
        {
            var fallback = WebPreviewEnhancer.BuildMediaPrintFallback(media);
            html = html.Replace(
                "<div class=\"media-frame",
                fallback + "<div class=\"media-frame",
                StringComparison.Ordinal);
        }

        html = WebPreviewEnhancer.InjectPrintStylesOnly(html);
        html = WebMediaEmbedFix.PatchTopMediaFrame(html, media, pageOrigin);
        html = WebHtmlContentProcessor.RewriteProtectedImages(html, settings);
        return html;
    }

    public static string GetPageOrigin(HttpRequest request) =>
        $"{request.Scheme}://{request.Host.Value}".TrimEnd('/');
}
