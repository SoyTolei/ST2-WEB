using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PortalClienchi.Web.PortalPdf;

public static class PortalPdfService
{
    private static readonly Color PageBg = Color.FromHex("#1A1A1A");
    private static readonly Color BrandBoxBg = Colors.White;
    private static readonly Color BrandText = Color.FromHex("#B8B8B8");
    private static readonly Color BodyText = Color.FromHex("#F2F2F2");

    /// <summary>Lato viene embebida en QuestPDF: funciona en Railway/Linux sin fuentes del sistema.</summary>
    private const string FontFamilyName = "Lato";

    public static byte[] GeneratePdfBytes(PortalPdfGenerateRequest request, string? contentRoot = null)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        var brand = (request.Brand ?? "").Trim();
        var blocks = PortalPdfHtmlParser.Parse(request.Html, request.Text);
        var logo = FindThomsonLogoBytes(contentRoot);
        const string font = FontFamilyName;

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(28);
                page.PageColor(PageBg);
                page.DefaultTextStyle(x => x.FontSize(11).FontFamily(font).FontColor(BodyText));

                page.Header().PaddingBottom(18).Row(row =>
                {
                    row.RelativeItem().AlignLeft().Element(e =>
                    {
                        if (string.IsNullOrWhiteSpace(brand))
                            return;

                        e.Background(BrandBoxBg)
                            .PaddingHorizontal(18)
                            .PaddingVertical(10)
                            .Text(brand.ToUpperInvariant())
                            .FontSize(16)
                            .Bold()
                            .FontColor(BrandText)
                            .FontFamily(font);
                    });

                    row.ConstantItem(12);

                    row.ConstantItem(210).AlignRight().AlignMiddle().Element(e =>
                    {
                        if (logo is null || logo.Length == 0)
                        {
                            e.Text("THOMSON REUTERS").FontSize(10).FontColor(Colors.White).FontFamily(font);
                            return;
                        }

                        try
                        {
                            e.Height(42).Image(logo).FitHeight();
                        }
                        catch
                        {
                            e.Text("THOMSON REUTERS").FontSize(10).FontColor(Colors.White).FontFamily(font);
                        }
                    });
                });

                page.Content().Column(col =>
                {
                    if (blocks.Count == 0)
                    {
                        col.Item().Text("").FontSize(11);
                        return;
                    }

                    foreach (var line in GroupLines(blocks))
                    {
                        if (line.Count == 0 || (line.Count == 1 && line[0].Text == "\n"))
                        {
                            col.Item().Height(10);
                            continue;
                        }

                        var align = line[0].Align;
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
                                if (align == "justify")
                                    text.Justify();
                                else if (align == "center")
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

                                    var size = run.FontSize ?? 12f;
                                    var color = ResolveRunColor(run.Color);

                                    TextSpanDescriptor span = !string.IsNullOrWhiteSpace(run.LinkUrl)
                                        ? text.Hyperlink(content, run.LinkUrl!)
                                        : text.Span(content);

                                    span = span
                                        .FontFamily(font)
                                        .FontColor(color)
                                        .FontSize(size);

                                    if (run.Bold) span.Bold();
                                    if (run.Italic) span.Italic();
                                    if (run.Underline) span.Underline();
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
        }

        candidates.Add(Path.Combine(AppContext.BaseDirectory, "wwwroot", "img", "thomson-reuters-logo.png"));
        candidates.Add(Path.Combine(AppContext.BaseDirectory, "img", "thomson-reuters-logo.png"));

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
