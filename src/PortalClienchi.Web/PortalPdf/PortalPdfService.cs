using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PortalClienchi.Web.PortalPdf;

/// <summary>
/// Generador corporativo de PDFs para instructivos y notas del Portal de Clientes Thomson Reuters.
/// Formato estándar A4 vertical (Portrait), con soporte bimodal:
/// - Hoja oscura (#1A1A1A) cuando se genera en modo oscuro.
/// - Hoja blanca (Colors.White) cuando se genera en modo claro para impresión directa.
/// Soporta tablas completas, imágenes, títulos corporativos, listas e hipervínculos.
/// </summary>
public static class PortalPdfService
{
    private sealed class PdfTheme
    {
        public bool IsDark { get; init; }
        public Color PageBg { get; init; } = Colors.White;
        public Color BodyText { get; init; } = Color.FromHex("#1E293B");
        public Color BrandText { get; init; } = Color.FromHex("#1E293B");
        public Color BrandAccent { get; init; } = Color.FromHex("#F36C00");
        public Color LinkText { get; init; } = Color.FromHex("#0284C7");
        public Color LineColor { get; init; } = Color.FromHex("#E2E8F0");
        public Color TableHeaderBg { get; init; } = Color.FromHex("#737373");
        public Color TableHeaderText { get; init; } = Colors.White;
        public Color TableCellBg { get; init; } = Colors.White;
        public Color TableCellText { get; init; } = Color.FromHex("#1E293B");
        public Color TableBorder { get; init; } = Color.FromHex("#CBD5E1");
        public Color FooterText { get; init; } = Colors.Grey.Medium;
        public Color H1Color { get; init; } = Color.FromHex("#E05A10");
        public Color H2Color { get; init; } = Color.FromHex("#E05A10");
        public Color H3Color { get; init; } = Color.FromHex("#1E293B");
    }

    private static PdfTheme GetTheme(bool isDark) => isDark
        ? new PdfTheme
        {
            IsDark = true,
            PageBg = Color.FromHex("#1A1A1A"),
            BodyText = Color.FromHex("#F2F2F2"),
            BrandText = Color.FromHex("#F2F2F2"),
            BrandAccent = Color.FromHex("#F36C00"),
            LinkText = Color.FromHex("#7DD3FC"),
            LineColor = Color.FromHex("#334155"),
            TableHeaderBg = Color.FromHex("#374151"),
            TableHeaderText = Colors.White,
            TableCellBg = Color.FromHex("#262626"),
            TableCellText = Color.FromHex("#F2F2F2"),
            TableBorder = Color.FromHex("#4B5563"),
            FooterText = Color.FromHex("#94A3B8"),
            H1Color = Color.FromHex("#FB923C"),
            H2Color = Color.FromHex("#FB923C"),
            H3Color = Color.FromHex("#F2F2F2"),
        }
        : new PdfTheme
        {
            IsDark = false,
            PageBg = Colors.White,
            BodyText = Color.FromHex("#1E293B"),
            BrandText = Color.FromHex("#1E293B"),
            BrandAccent = Color.FromHex("#F36C00"),
            LinkText = Color.FromHex("#0284C7"),
            LineColor = Color.FromHex("#E2E8F0"),
            TableHeaderBg = Color.FromHex("#737373"),
            TableHeaderText = Colors.White,
            TableCellBg = Colors.White,
            TableCellText = Color.FromHex("#1E293B"),
            TableBorder = Color.FromHex("#CBD5E1"),
            FooterText = Colors.Grey.Medium,
            H1Color = Color.FromHex("#E05A10"),
            H2Color = Color.FromHex("#E05A10"),
            H3Color = Color.FromHex("#1E293B"),
        };

    public static byte[] GeneratePdfBytes(PortalPdfGenerateRequest request, string? contentRoot = null)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        var theme = GetTheme(request.DarkMode);
        var brand = (request.Brand ?? "").Trim();
        var elements = PortalPdfHtmlParser.Parse(request.Html, request.Text);
        var logo = PortalPdfLogoGenerator.GetLogoBytes(theme.IsDark);

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                // Hoja estándar A4 Vertical (Portrait: 595.28 x 841.89 pt)
                page.Size(PageSizes.A4);
                page.MarginHorizontal(36);
                page.MarginVertical(32);
                page.PageColor(theme.PageBg);
                page.DefaultTextStyle(x => x.FontSize(11.5f).FontFamily(Fonts.Arial).FontColor(theme.BodyText));

                // Cabecera corporativa con logo y título / marca
                page.Header().Column(headerCol =>
                {
                    headerCol.Item().Row(row =>
                    {
                        if (!string.IsNullOrWhiteSpace(brand))
                        {
                            row.RelativeItem().AlignLeft().AlignMiddle().Column(brandCol =>
                            {
                                brandCol.Item()
                                    .Text(brand.ToUpperInvariant())
                                    .FontSize(13f)
                                    .Bold()
                                    .FontColor(theme.BrandText)
                                    .FontFamily(Fonts.Arial);
                                brandCol.Item().PaddingTop(3).Width(42).Height(2.5f).Background(theme.BrandAccent);
                            });
                        }
                        else
                        {
                            row.RelativeItem();
                        }

                        row.ConstantItem(12);

                        if (logo is { Length: > 0 })
                        {
                            row.ConstantItem(185).AlignRight().AlignMiddle().Height(36).Image(logo).FitArea();
                        }
                        else
                        {
                            row.ConstantItem(185).AlignRight().AlignMiddle()
                                .Text("THOMSON REUTERS")
                                .FontSize(12.5f)
                                .Bold()
                                .FontColor(theme.BrandText)
                                .FontFamily(Fonts.Arial);
                        }
                    });

                    headerCol.Item().PaddingTop(8).LineHorizontal(1f).LineColor(theme.LineColor);
                });

                // Contenido del documento
                page.Content().PaddingTop(14).Column(col =>
                {
                    if (elements.Count == 0)
                    {
                        col.Item().Text(" ").FontSize(10.5f);
                        return;
                    }

                    foreach (var elem in elements)
                    {
                        switch (elem)
                        {
                            case PortalPdfParagraphElement para:
                                RenderParagraph(col, para, theme);
                                break;

                            case PortalPdfTableElement table:
                                RenderTable(col, table, theme);
                                break;

                            case PortalPdfHrElement:
                                col.Item().PaddingVertical(8).LineHorizontal(1).LineColor(theme.LineColor);
                                break;

                            case PortalPdfImageElement img when img.ImageBytes.Length > 0:
                                col.Item().PaddingVertical(8).MaxWidth(480).Image(img.ImageBytes).FitWidth();
                                break;
                        }
                    }
                });

                // Pie de página corporativo
                page.Footer().Column(footerCol =>
                {
                    footerCol.Item().LineHorizontal(0.5f).LineColor(theme.LineColor);
                    footerCol.Item().PaddingTop(6).Row(row =>
                    {
                        row.RelativeItem().Text("Thomson Reuters · Portal de Clientes")
                            .FontSize(8f)
                            .FontColor(theme.FooterText);

                        row.RelativeItem().AlignRight().Text(text =>
                        {
                            text.DefaultTextStyle(x => x.FontSize(8f).FontColor(theme.FooterText));
                            text.Span("Página ");
                            text.CurrentPageNumber();
                            text.Span(" de ");
                            text.TotalPages();
                        });
                    });
                });
            });
        }).GeneratePdf();
    }

    private static void RenderParagraph(ColumnDescriptor col, PortalPdfParagraphElement para, PdfTheme theme)
    {
        if (para.Runs.Count == 0 || (para.Runs.Count == 1 && string.IsNullOrWhiteSpace(para.Runs[0].Text)))
        {
            col.Item().Height(8);
            return;
        }

        var align = NormalizeAlign(para.Align);

        var topPad = para.HeadingLevel switch
        {
            1 => 14f,
            2 => 10f,
            3 => 8f,
            _ => 0f,
        };

        var botPad = para.HeadingLevel switch
        {
            1 => 6f,
            2 => 5f,
            3 => 4f,
            _ => 6f,
        };

        var defaultHeadingColor = para.HeadingLevel switch
        {
            1 => theme.H1Color,
            2 => theme.H2Color,
            3 => theme.H3Color,
            _ => theme.BodyText,
        };

        if (para.IsListItem)
        {
            col.Item().PaddingTop(2).PaddingBottom(4).PaddingLeft(12).Row(r =>
            {
                r.ConstantItem(12).Text("•").Bold().FontColor(theme.BrandAccent);
                r.RelativeItem().Text(text =>
                {
                    ConfigureTextAlignment(text, align);
                    text.ParagraphSpacing(1);
                    RenderRuns(text, para.Runs, theme, defaultHeadingColor);
                });
            });
            return;
        }

        col.Item().PaddingTop(topPad).PaddingBottom(botPad).Text(text =>
        {
            ConfigureTextAlignment(text, para.HeadingLevel > 0 ? "left" : align);
            text.ParagraphSpacing(3.5f);
            RenderRuns(text, para.Runs, theme, defaultHeadingColor);
        });
    }

    private static void ConfigureTextAlignment(TextDescriptor text, string align)
    {
        if (align == "center")
            text.AlignCenter();
        else if (align == "right")
            text.AlignRight();
        else
            text.AlignLeft();
    }

    private static void RenderRuns(TextDescriptor text, IReadOnlyList<PortalPdfBlock> runs, PdfTheme theme, Color? defaultColor = null)
    {
        var fallbackColor = defaultColor ?? theme.BodyText;

        foreach (var run in runs)
        {
            if (run.Text == "\n")
            {
                text.EmptyLine();
                continue;
            }

            var content = Sanitize(run.Text);
            if (content.Length == 0) continue;

            var isLink = !string.IsNullOrWhiteSpace(run.LinkUrl) && IsSafePdfLink(run.LinkUrl!);
            var runColor = isLink
                ? theme.LinkText
                : ResolveRunColor(run.Color, theme, fallbackColor);

            var span = text.Span(content)
                .FontFamily(Fonts.Arial)
                .FontColor(runColor)
                .FontSize(run.FontSize ?? 11.5f);

            if (run.Bold) span.Bold();
            if (run.Italic) span.Italic();
            if (run.Underline || isLink) span.Underline();
            if (run.Strike) span.Strikethrough();
        }
    }

    private static void RenderTable(ColumnDescriptor col, PortalPdfTableElement table, PdfTheme theme)
    {
        if (table.Rows.Count == 0) return;

        var maxCols = 1;
        foreach (var r in table.Rows)
        {
            if (r.Count > maxCols) maxCols = r.Count;
        }

        col.Item().PaddingVertical(8).Table(tbl =>
        {
            tbl.ColumnsDefinition(cols =>
            {
                for (var i = 0; i < maxCols; i++)
                    cols.RelativeColumn();
            });

            foreach (var row in table.Rows)
            {
                foreach (var cell in row)
                {
                    var isH = cell.IsHeader;
                    var bg = isH ? theme.TableHeaderBg : theme.TableCellBg;
                    var defaultCellColor = isH ? theme.TableHeaderText : theme.TableCellText;

                    tbl.Cell()
                        .Border(0.75f)
                        .BorderColor(theme.TableBorder)
                        .Background(bg)
                        .PaddingVertical(5)
                        .PaddingHorizontal(8)
                        .Text(text =>
                        {
                            ConfigureTextAlignment(text, cell.Align);
                            if (cell.Content.Count == 0)
                            {
                                text.Span(" ");
                                return;
                            }

                            foreach (var run in cell.Content)
                            {
                                if (run.Text == "\n") continue;
                                var content = Sanitize(run.Text);
                                if (content.Length == 0) continue;

                                var runColor = isH
                                    ? theme.TableHeaderText
                                    : ResolveRunColor(run.Color, theme, defaultCellColor);

                                var span = text.Span(content)
                                    .FontFamily(Fonts.Arial)
                                    .FontColor(runColor)
                                    .FontSize(run.FontSize ?? 10.5f);

                                if (run.Bold || isH) span.Bold();
                                if (run.Italic) span.Italic();
                                if (run.Underline) span.Underline();
                                if (run.Strike) span.Strikethrough();
                            }
                        });
                }
            }
        });
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

    private static Color ResolveRunColor(string? cssColor, PdfTheme theme, Color? fallback = null)
    {
        var defaultColor = fallback ?? theme.BodyText;
        var normalized = PortalPdfHtmlParser.NormalizeColor(cssColor);
        if (string.IsNullOrEmpty(normalized))
            return defaultColor;

        if (theme.IsDark)
        {
            // En fondo oscuro, si el color es muy oscuro (casi negro), lo cambiamos a texto claro
            if (IsNearBlack(normalized))
                return defaultColor;
        }
        else
        {
            // En fondo blanco, si el color es casi blanco, lo normalizamos a oscuro
            if (IsNearWhite(normalized))
                return defaultColor;
        }

        try { return Color.FromHex(normalized); }
        catch { return defaultColor; }
    }

    private static bool IsNearBlack(string hex)
    {
        if (hex.Length != 7 || hex[0] != '#') return false;
        if (!int.TryParse(hex.AsSpan(1, 2), System.Globalization.NumberStyles.HexNumber, null, out var r)) return false;
        if (!int.TryParse(hex.AsSpan(3, 2), System.Globalization.NumberStyles.HexNumber, null, out var g)) return false;
        if (!int.TryParse(hex.AsSpan(5, 2), System.Globalization.NumberStyles.HexNumber, null, out var b)) return false;
        var lum = (0.2126f * r + 0.7152f * g + 0.0722f * b) / 255f;
        return lum < 0.22f;
    }

    private static bool IsNearWhite(string hex)
    {
        if (hex.Length != 7 || hex[0] != '#') return false;
        if (!int.TryParse(hex.AsSpan(1, 2), System.Globalization.NumberStyles.HexNumber, null, out var r)) return false;
        if (!int.TryParse(hex.AsSpan(3, 2), System.Globalization.NumberStyles.HexNumber, null, out var g)) return false;
        if (!int.TryParse(hex.AsSpan(5, 2), System.Globalization.NumberStyles.HexNumber, null, out var b)) return false;
        var lum = (0.2126f * r + 0.7152f * g + 0.0722f * b) / 255f;
        return lum > 0.82f;
    }

    private static string Sanitize(string? text)
    {
        if (string.IsNullOrEmpty(text))
            return "";
        return new string(text.Where(c => !char.IsControl(c) || c is '\n' or '\r' or '\t').ToArray());
    }
}
