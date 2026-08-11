using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PortalClienchi.Web.PortalPdf;

/// <summary>
/// Misma base que <see cref="Planillas.OportunidadPdfService"/>:
/// QuestPDF + Fonts.Arial (probado en Railway) + layout en Content sin elementos vacíos.
/// </summary>
public static class PortalPdfService
{
    private static readonly Color PageBg = Color.FromHex("#1A1A1A");
    private static readonly Color BrandText = Color.FromHex("#F2F2F2");
    private static readonly Color BrandAccent = Color.FromHex("#F36C00");
    private static readonly Color BodyText = Color.FromHex("#F2F2F2");
    private static readonly Color LinkText = Color.FromHex("#7DD3FC");

    public static byte[] GeneratePdfBytes(PortalPdfGenerateRequest request, string? contentRoot = null)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        var brand = (request.Brand ?? "").Trim();
        var blocks = PortalPdfHtmlParser.Parse(request.Html, request.Text);
        var logo = FindThomsonLogoBytes(contentRoot);
        var lines = GroupLines(blocks).ToList();

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(28);
                page.PageColor(PageBg);
                // Igual que Oportunidad: Arial (fonts-liberation en Docker / sistema en Windows).
                page.DefaultTextStyle(x => x.FontSize(11f).FontFamily(Fonts.Arial).FontColor(BodyText));

                page.Content().Column(col =>
                {
                    // Header como filas de Content (evita Header/elementos vacíos).
                    col.Item().PaddingBottom(18).Row(row =>
                    {
                        if (!string.IsNullOrWhiteSpace(brand))
                        {
                            row.RelativeItem().AlignLeft().AlignMiddle().Column(brandCol =>
                            {
                                brandCol.Item()
                                    .Text(brand)
                                    .FontSize(20f)
                                    .SemiBold()
                                    .FontColor(BrandText)
                                    .FontFamily(Fonts.Arial);
                                brandCol.Item().PaddingTop(6).Width(56).Height(3).Background(BrandAccent);
                            });
                        }
                        else
                        {
                            row.RelativeItem();
                        }

                        row.ConstantItem(12);

                        if (logo is { Length: > 0 })
                        {
                            row.ConstantItem(340).AlignRight().AlignMiddle().Height(74).Image(logo).FitHeight();
                        }
                        else
                        {
                            row.ConstantItem(340).AlignRight().AlignMiddle()
                                .Text("THOMSON REUTERS")
                                .FontSize(14f)
                                .FontColor(Colors.White)
                                .FontFamily(Fonts.Arial);
                        }
                    });

                    if (lines.Count == 0)
                    {
                        col.Item().Text(" ").FontSize(11f);
                        return;
                    }

                    foreach (var line in lines)
                    {
                        if (line.Count == 0 || (line.Count == 1 && line[0].Text == "\n"))
                        {
                            col.Item().Height(10);
                            continue;
                        }

                        var align = NormalizeAlign(line[0].Align);
                        col.Item().Element(item =>
                        {
                            item = align switch
                            {
                                "center" => item.AlignCenter(),
                                "right" => item.AlignRight(),
                                _ => item.AlignLeft(),
                            };

                            item.Text(text =>
                            {
                                // Sin Justify(): en algunos hosts Skia falla; left/center/right bastan.
                                if (align == "center")
                                    text.AlignCenter();
                                else if (align == "right")
                                    text.AlignRight();
                                else
                                    text.AlignLeft();

                                foreach (var run in line)
                                {
                                    if (run.Text == "\n") continue;
                                    var content = Sanitize(run.Text);
                                    if (content.Length == 0) continue;

                                    // Links: subrayado + color (sin API Hyperlink, más estable en Linux).
                                    var isLink = !string.IsNullOrWhiteSpace(run.LinkUrl) && IsSafePdfLink(run.LinkUrl!);
                                    var span = text.Span(content)
                                        .FontFamily(Fonts.Arial)
                                        .FontColor(isLink ? LinkText : ResolveRunColor(run.Color))
                                        .FontSize(run.FontSize ?? 12f);

                                    if (run.Bold) span.Bold();
                                    if (run.Italic) span.Italic();
                                    if (run.Underline || isLink) span.Underline();
                                    if (run.Strike) span.Strikethrough();
                                }
                            });
                        });

                        col.Item().Height(4);
                    }
                });
            });
        }).GeneratePdf();
    }

    private static string NormalizeAlign(string? align)
    {
        var a = (align ?? "left").Trim().ToLowerInvariant();
        return a is "center" or "right" ? a : "left";
    }

    private static bool IsSafePdfLink(string href)
    {
        var h = href.Trim();
        if (h.Length == 0) return false;
        if (!Uri.TryCreate(h, UriKind.Absolute, out var uri))
            return false;
        return uri.Scheme is "http" or "https" or "mailto";
    }

    private static Color ResolveRunColor(string? cssColor)
    {
        var normalized = PortalPdfHtmlParser.NormalizeColor(cssColor);
        if (string.IsNullOrEmpty(normalized))
            return BodyText;

        if (IsNearBlack(normalized))
            return BodyText;

        try { return Color.FromHex(normalized); }
        catch { return BodyText; }
    }

    private static bool IsNearBlack(string hex)
    {
        if (hex.Length != 7 || hex[0] != '#') return false;
        if (!int.TryParse(hex.AsSpan(1, 2), System.Globalization.NumberStyles.HexNumber, null, out var r)) return false;
        if (!int.TryParse(hex.AsSpan(3, 2), System.Globalization.NumberStyles.HexNumber, null, out var g)) return false;
        if (!int.TryParse(hex.AsSpan(5, 2), System.Globalization.NumberStyles.HexNumber, null, out var b)) return false;
        var lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0;
        return lum < 0.18;
    }

    private static IEnumerable<List<PortalPdfBlock>> GroupLines(IReadOnlyList<PortalPdfBlock> blocks)
    {
        var current = new List<PortalPdfBlock>();
        foreach (var b in blocks)
        {
            if (b.Text == "\n")
            {
                yield return current;
                current = new List<PortalPdfBlock>();
                continue;
            }

            var parts = b.Text.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n');
            for (var i = 0; i < parts.Length; i++)
            {
                if (i > 0)
                {
                    yield return current;
                    current = new List<PortalPdfBlock>();
                }

                if (parts[i].Length == 0 && i < parts.Length - 1)
                    continue;

                current.Add(new PortalPdfBlock
                {
                    Text = parts[i],
                    Italic = b.Italic,
                    Bold = b.Bold,
                    Underline = b.Underline,
                    Strike = b.Strike,
                    Align = b.Align,
                    Color = b.Color,
                    FontSize = b.FontSize,
                    LinkUrl = b.LinkUrl,
                });
            }
        }

        if (current.Count > 0)
            yield return current;
    }

    private static string Sanitize(string? text)
    {
        if (string.IsNullOrEmpty(text))
            return "";
        return new string(text.Where(c => !char.IsControl(c) || c is '\n' or '\r' or '\t').ToArray());
    }

    private static byte[]? FindThomsonLogoBytes(string? contentRoot)
    {
        var candidates = new List<string>();
        if (!string.IsNullOrWhiteSpace(contentRoot))
        {
            candidates.Add(Path.Combine(contentRoot, "wwwroot", "img", "thomson-reuters-logo.png"));
            candidates.Add(Path.Combine(contentRoot, "img", "thomson-reuters-logo.png"));
            // Mismos nombres que Oportunidad, por si existen en el root publicado.
            candidates.Add(Path.Combine(contentRoot, "wwwroot", "logo.png"));
            candidates.Add(Path.Combine(contentRoot, "logo.png"));
        }

        candidates.Add(Path.Combine(AppContext.BaseDirectory, "wwwroot", "img", "thomson-reuters-logo.png"));
        candidates.Add(Path.Combine(AppContext.BaseDirectory, "img", "thomson-reuters-logo.png"));
        candidates.Add(Path.Combine(AppContext.BaseDirectory, "wwwroot", "logo.png"));
        candidates.Add(Path.Combine(AppContext.BaseDirectory, "logo.png"));

        foreach (var path in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (!File.Exists(path))
                continue;
            try { return File.ReadAllBytes(path); }
            catch { /* ignore */ }
        }

        return null;
    }
}
