using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PortalClienchi.Web.Planillas;

public static class OportunidadPdfService
{
    private static readonly Color OrangeDark = Color.FromHex("#D9661F");
    private static readonly Color OrangeLight = Color.FromHex("#FFA64D");
    private static readonly Color OrangePale = Color.FromHex("#FFD9B3");
    private static PageSize CompactPage => PageSizes.A6;

    public static byte[] GeneratePdfBytes(OportunidadCargaForm form, string? contentRoot = null)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        var titulo = OportunidadTextBuilder.PdfTitle(form);
        var correo = string.IsNullOrWhiteSpace(form.Correo) ? "No informado" : form.Correo.Trim();
        var sistema = form.Sistema.ToDisplayName();
        if (string.IsNullOrEmpty(sistema))
            sistema = "No indicado";

        var logo = FindLogoBytes(contentRoot);
        var descripcion = SanitizeForPdf(form.Descripcion);
        var pageSize = BuildAdaptivePageSize(form, titulo, descripcion);

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(pageSize);
                page.Margin(8);
                page.DefaultTextStyle(x => x.FontSize(8f).FontFamily(Fonts.Arial));

                page.Content().Column(col =>
                {
                    col.Item().Background(OrangeDark).Padding(6).Row(row =>
                    {
                        if (logo is not null)
                        {
                            row.ConstantItem(40).Image(logo).FitHeight();
                            row.ConstantItem(6);
                        }
                        row.RelativeItem().Column(inner =>
                        {
                            foreach (var line in WrapTitle(titulo, 24))
                                inner.Item().Text(line).FontSize(8.8f).Bold().FontColor(Colors.White);
                        });
                    });
                    col.Item().Height(2).Background(OrangeLight);

                    col.Item().PaddingTop(4).Column(body =>
                    {
                        Field(body, "Sistema", sistema);
                        Field(body, "Método de contacto", form.MetodoContacto);
                        Field(body, "N° de Cliente", form.NumeroCliente.Trim());
                        Field(body, "Razón Social", form.RazonSocial.Trim());
                        Field(body, "Contacto", form.NombreContacto.Trim());
                        Field(body, "Teléfono", form.Telefono.Trim());
                        Field(body, "Correo", correo);
                        Field(body, "Horarios", form.Horarios.Trim());

                        body.Item().PaddingTop(3).Text("Descripción de la oportunidad")
                            .Bold().FontColor(OrangeDark).FontSize(8.2f);
                        body.Item().PaddingTop(2).Background(OrangePale).Padding(6)
                            .Text(descripcion).FontSize(8f);
                    });
                });
            });
        }).GeneratePdf();
    }

    private static void Field(ColumnDescriptor col, string label, string value)
    {
        col.Item().PaddingBottom(1).Row(row =>
        {
            row.ConstantItem(82).Text(label + ":").SemiBold().FontColor(OrangeDark).FontSize(7.8f);
            row.RelativeItem().Text(SanitizeForPdf(value)).FontSize(7.8f);
        });
        col.Item().PaddingBottom(3).LineHorizontal(0.7f).LineColor(OrangePale);
    }

    private static string SanitizeForPdf(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return "";
        return new string(text.Where(c => !char.IsControl(c) || c is '\n' or '\r' or '\t').ToArray()).Trim();
    }

    private static IEnumerable<string> WrapTitle(string text, int width)
    {
        text = SanitizeForPdf(text);
        if (string.IsNullOrWhiteSpace(text))
        {
            yield return "Oportunidad de Venta";
            yield break;
        }

        var words = text.Split(' ');
        var line = "";
        foreach (var w in words)
        {
            var test = string.IsNullOrEmpty(line) ? w : line + " " + w;
            if (test.Length > width)
            {
                if (!string.IsNullOrEmpty(line))
                    yield return line;
                line = w;
            }
            else
                line = test;
        }
        if (!string.IsNullOrEmpty(line))
            yield return line;
    }

    private static PageSize BuildAdaptivePageSize(OportunidadCargaForm form, string titulo, string descripcion)
    {
        var width = CompactPage.Width;
        var maxHeight = CompactPage.Height;
        const float minHeight = 260f;

        var textLines = 0;
        textLines += CountWrappedLines(titulo, 24);
        textLines += CountWrappedLines(form.MetodoContacto, 14);
        textLines += CountWrappedLines(form.NumeroCliente, 14);
        textLines += CountWrappedLines(form.RazonSocial, 16);
        textLines += CountWrappedLines(form.NombreContacto, 16);
        textLines += CountWrappedLines(form.Telefono, 16);
        textLines += CountWrappedLines(form.Correo, 18);
        textLines += CountWrappedLines(form.Horarios, 16);
        textLines += Math.Max(1, CountWrappedLines(descripcion, 44));

        var estimatedHeight = 120f + (textLines * 9f);
        var finalHeight = Math.Clamp(estimatedHeight, minHeight, maxHeight);
        return new PageSize(width, finalHeight);
    }

    private static int CountWrappedLines(string? value, int charsPerLine)
    {
        value = SanitizeForPdf(value);
        if (string.IsNullOrEmpty(value))
            return 1;

        var lines = value
            .Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries)
            .Select(line => Math.Max(1, (int)Math.Ceiling(line.Length / (double)charsPerLine)));

        return Math.Max(1, lines.Sum());
    }

    private static byte[]? FindLogoBytes(string? contentRoot)
    {
        var dirs = new List<string>();
        if (!string.IsNullOrWhiteSpace(contentRoot))
        {
            dirs.Add(contentRoot);
            dirs.Add(Path.Combine(contentRoot, "wwwroot"));
        }
        dirs.Add(AppContext.BaseDirectory);

        foreach (var dir in dirs.Distinct())
        {
            foreach (var name in new[] { "logo.png", "logo.jpg" })
            {
                var path = Path.Combine(dir, name);
                if (!File.Exists(path))
                    continue;
                try { return File.ReadAllBytes(path); }
                catch { }
            }
        }
        return null;
    }
}
