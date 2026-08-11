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

    public static byte[] GeneratePdfBytes(PortalPdfGenerateRequest request, string? contentRoot = null)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        var brand = (request.Brand ?? "").Trim();
        var blocks = PortalPdfHtmlParser.Parse(request.Html, request.Text);
        var logo = FindThomsonLogoBytes(contentRoot);

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(28);
                page.PageColor(PageBg);
                page.DefaultTextStyle(x => x.FontSize(11).FontFamily(Fonts.Arial).FontColor(BodyText));

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
                            .FontFamily(Fonts.Arial);
                    });

                    row.ConstantItem(12);

                    row.ConstantItem(210).AlignRight().AlignMiddle().Element(e =>
                    {
                        if (logo is null)
                        {
                            e.Text("THOMSON REUTERS").FontSize(10).FontColor(Colors.White);
                            return;
                        }

                        e.Height(42).Image(logo).FitHeight();
                    });
                });

                page.Content().Column(col =>
                {
                    if (blocks.Count == 0)
                    {
                        col.Item().Text("").FontSize(11);
                        return;
                    }

                    // Agrupar runs en líneas lógicas separadas por \n.
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
                                    var span = text.Span(Sanitize(run.Text)).FontColor(BodyText).FontSize(12);
                                    if (run.Bold) span.Bold();
                                    if (run.Italic) span.Italic();
                                    if (run.Underline) span.Underline();
                                }
                            });
                        });

                        col.Item().Height(4);
                    }
                });
            });
        }).GeneratePdf();
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

            // Soportar saltos embebidos dentro de un run.
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
                    Align = b.Align,
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
