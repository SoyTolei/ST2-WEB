using System.Net;
using PortalClienchi.Core.Models;

namespace PortalClienchi.Core.Utilities;

public static class PreviewHtmlBuilder
{
    public static string Wrap(
        string title,
        string? product,
        string typeLabel,
        string? bodyHtml,
        string? plainFallback,
        string? portalUrl = null,
        MediaResource? media = null)
    {
        var body = !string.IsNullOrWhiteSpace(bodyHtml)
            ? HtmlContentSanitizer.ForPreview(bodyHtml)
            : "<p>" + WebUtility.HtmlEncode(plainFallback ?? "Sin contenido.") + "</p>";

        var productLine = string.IsNullOrWhiteSpace(product)
            ? ""
            : "<p class=\"meta\"><strong>Producto:</strong> " + WebUtility.HtmlEncode(product) + "</p>";

        return """
            <!DOCTYPE html>
            <html lang="es">
            <head>
            <meta charset="utf-8"/>
            <meta name="color-scheme" content="light"/>
            <style>
              html, body {
                font-family: 'Segoe UI', Arial, sans-serif;
                margin: 0; padding: 16px 20px;
                background: #ffffff !important;
                color: #1f2937 !important;
                line-height: 1.6; font-size: 14px;
              }
              .badge {
                display: inline-block; background: #fff3ed !important; color: #d64000 !important;
                font-weight: 600; font-size: 12px; padding: 4px 10px;
                border-radius: 4px; margin-bottom: 10px;
              }
              h1.page-title {
                color: #d64000 !important; font-size: 18px; margin: 0 0 10px;
                font-weight: 600; line-height: 1.35;
              }
              .meta { color: #6b7280 !important; font-size: 13px; margin: 0 0 14px; }
              .content { background: #ffffff !important; color: #374151 !important; padding: 0; }
              .content, .content * {
                background: transparent !important;
                background-color: transparent !important;
                color: #374151 !important;
                font-family: 'Segoe UI', Arial, sans-serif !important;
              }
              .content h1, .content h2, .content h3, .content h4, .content strong, .content b {
                color: #1f2937 !important; font-weight: 600 !important;
              }
              .content a { color: #d64000 !important; text-decoration: underline; }
              .content p, .content li, .content td, .content th, .content div, .content span {
                color: #374151 !important;
              }
              .content img { max-width: 100%; height: auto; border-radius: 4px; }
              .content table { border-collapse: collapse; width: 100%; margin: 12px 0; background: #fff !important; }
              .content th, .content td {
                border: 1px solid #e5e7eb !important; padding: 8px; vertical-align: top; background: #fff !important;
              }
              .content th { background: #f9fafb !important; font-weight: 600; }
              .content ul, .content ol { padding-left: 1.5em; margin: 8px 0; }
              .media-frame {
                margin: 0 0 16px; border: 1px solid #e5e7eb; border-radius: 8px;
                overflow: hidden; background: #f9fafb !important;
              }
              .media-frame iframe, .media-frame video {
                display: block; width: 100%; min-height: 420px; border: 0;
                background: #000;
              }
              .media-frame video { max-height: 70vh; }
              .streaming-frame iframe { min-height: 480px; }
              .media-hint {
                font-size: 12px; color: #6b7280 !important; margin: 0 0 8px;
              }
              .pdf-footer {
                margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb;
                font-size: 11px; color: #6b7280 !important;
              }
              @media print {
                html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
            </style>
            </head>
            <body>
            """ +
            "<span class=\"badge\">" + WebUtility.HtmlEncode(typeLabel) + "</span>" +
            "<h1 class=\"page-title\">" + WebUtility.HtmlEncode(title) + "</h1>" +
            productLine +
            BuildMediaBlock(media) +
            "<div class=\"content\">" + body + "</div>" +
            BuildFooter(portalUrl) +
            "</body></html>";
    }

    private static string BuildMediaBlock(MediaResource? media)
    {
        if (media is null || media.Kind == MediaKind.None)
            return "";

        var url = WebUtility.HtmlEncode(media.Url);
        var hint = media.Kind == MediaKind.Pdf
            ? "<p class=\"media-hint\">Vista previa del PDF</p>"
            : "<p class=\"media-hint\">Reproductor de video · si no carga, usá «Abrir video»</p>";

        if (media.Kind == MediaKind.Pdf)
        {
            return hint +
                   $"<div class=\"media-frame\"><iframe src=\"{url}\" title=\"PDF\"></iframe></div>";
        }

        if (StreamingEmbedHelper.TryGetStreamingEmbedUrl(media.Url, out var embed))
        {
            var embedSafe = WebUtility.HtmlEncode(embed);
            return hint +
                   "<div class=\"media-frame streaming-frame\">" +
                   $"<iframe src=\"{embedSafe}\" referrerpolicy=\"strict-origin-when-cross-origin\" " +
                   "allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen\" " +
                   "allowfullscreen title=\"Video\"></iframe></div>";
        }

        return hint +
               $"<div class=\"media-frame\"><video controls preload=\"metadata\" src=\"{url}\">Tu navegador no reproduce este video.</video></div>";
    }

    private static string BuildFooter(string? portalUrl)
    {
        if (string.IsNullOrWhiteSpace(portalUrl))
            return "";
        return "<p class=\"pdf-footer\"><strong>Portal Cliente</strong><br/>" +
               WebUtility.HtmlEncode(portalUrl) + "</p>";
    }
}
