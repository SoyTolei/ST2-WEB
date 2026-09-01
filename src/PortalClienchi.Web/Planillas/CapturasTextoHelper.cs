namespace PortalClienchi.Web.Planillas;

public static class CapturasTextoHelper
{
    private static readonly HashSet<string> VideoExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".webm",
    };

    private static readonly HashSet<string> PdfExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf",
    };

    private static readonly HashSet<string> TxtExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".txt",
    };

    private static readonly HashSet<string> ExcelExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".xlsx", ".xls",
    };

    private static readonly HashSet<string> XmlExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".xml",
    };

    private const string DefaultAdjuntosLabel = "capturas / video / PDF / TXT / Excel / XML";
    private const string DefaultAdjuntosLabelMayus = "CAPTURAS / VIDEO / PDF / TXT / EXCEL / XML";
    private const string DefaultAdjuntosTitulo = "Capturas / video / PDF / TXT / Excel / XML";

    public static void AppendBloqueCapturas(
        List<string> partes,
        bool hayCapturas,
        IReadOnlyList<TransferenciaCapturaEnlace> enlaces)
    {
        var flags = Classify(enlaces);
        partes.Add($"¿SE ADJUNTAN {LabelMayus(flags, hayCapturas)}?: {(hayCapturas ? "SÍ" : "NO")}");
        if (!hayCapturas)
            return;

        AppendEnlacesOComentarios(partes, enlaces, flags);
    }

    private static void AppendEnlacesOComentarios(
        List<string> partes,
        IReadOnlyList<TransferenciaCapturaEnlace> enlaces,
        MediaFlags flags)
    {
        if (enlaces.Count > 0)
        {
            partes.Add(BuildEnlacesIntro(enlaces, flags));
            foreach (var enlace in enlaces)
                partes.Add(enlace.Url);
            return;
        }

        partes.Add($"  {BuildComentariosLine(flags)}");
    }

    public static void AppendDetalleCapturasBajoLinea(
        List<string> partes,
        IReadOnlyList<TransferenciaCapturaEnlace> enlaces)
    {
        AppendEnlacesCapturas(partes, enlaces, indentar: true);
    }

    public static void AppendEnlacesCapturas(
        List<string> partes,
        IReadOnlyList<TransferenciaCapturaEnlace> enlaces,
        bool indentar = false)
    {
        var pad = indentar ? "  " : "";
        var flags = Classify(enlaces);
        if (enlaces.Count > 0)
        {
            partes.Add($"{pad}{BuildEnlacesIntro(enlaces, flags)}");
            foreach (var enlace in enlaces)
                partes.Add(indentar ? $"  {enlace.Url}" : enlace.Url);
            return;
        }

        partes.Add($"{pad}{BuildComentariosLine(flags)}");
    }

    /// <summary>Título de sección para Referral según lo subido.</summary>
    public static string BuildSeccionTitulo(IReadOnlyList<TransferenciaCapturaEnlace> enlaces)
    {
        var flags = Classify(enlaces);
        var label = BuildPhrase(flags, Style.Titulo, enlaces.Count == 1);
        return string.IsNullOrEmpty(label) ? $"- {DefaultAdjuntosTitulo}" : $"- {label}";
    }

    /// <summary>Etiqueta corta para ítems «en comentarios» (Referral).</summary>
    public static string BuildComentariosItemLabel(IReadOnlyList<TransferenciaCapturaEnlace> enlaces)
    {
        var flags = Classify(enlaces);
        var label = BuildPhrase(flags, Style.Titulo, singular: false);
        return string.IsNullOrEmpty(label) ? DefaultAdjuntosTitulo : label;
    }

    public static string BuildSiNoLabel(IReadOnlyList<TransferenciaCapturaEnlace> enlaces, bool marcado)
    {
        if (!marcado)
            return DefaultAdjuntosLabel;
        var flags = Classify(enlaces);
        var label = BuildPhrase(flags, Style.Minuscula, singular: false);
        return string.IsNullOrEmpty(label) ? DefaultAdjuntosLabel : label;
    }

    private static string BuildEnlacesIntro(
        IReadOnlyList<TransferenciaCapturaEnlace> enlaces,
        MediaFlags flags)
    {
        var uno = enlaces.Count == 1;
        var phrase = BuildPhrase(flags, Style.Minuscula, uno);
        if (string.IsNullOrEmpty(phrase))
            phrase = uno ? "captura / video / PDF / TXT / Excel / XML" : DefaultAdjuntosLabel;

        if (uno)
            return $"Se adjunta {ArticleFor(flags)} {phrase} en el siguiente link:";

        return $"Se adjuntan {phrase} en los siguientes links:";
    }

    private static string ArticleFor(MediaFlags flags)
    {
        if (Only(flags, f => f.Video)) return "el";
        if (Only(flags, f => f.Pdf)) return "el";
        if (Only(flags, f => f.Txt)) return "el";
        if (Only(flags, f => f.Excel)) return "el";
        if (Only(flags, f => f.Xml)) return "el";
        if (Only(flags, f => f.Images)) return "la";
        return "el";
    }

    private static string BuildComentariosLine(MediaFlags flags)
    {
        var phrase = BuildPhrase(flags, Style.Minuscula, singular: false);
        if (string.IsNullOrEmpty(phrase))
            phrase = DefaultAdjuntosLabel;

        var sujeto = flags switch
        {
            _ when Only(flags, f => f.Video) => "El video se adjunta",
            _ when Only(flags, f => f.Pdf) => "El PDF se adjunta",
            _ when Only(flags, f => f.Txt) => "El TXT se adjunta",
            _ when Only(flags, f => f.Excel) => "El Excel se adjunta",
            _ when Only(flags, f => f.Xml) => "El XML se adjunta",
            _ when Only(flags, f => f.Images) => "Las capturas se adjuntan",
            _ => $"{char.ToUpperInvariant(phrase[0])}{phrase[1..]} se adjuntan",
        };

        return $"{sujeto} en comentarios.";
    }

    private static string LabelMayus(MediaFlags flags, bool hayCapturas)
    {
        if (!hayCapturas)
            return DefaultAdjuntosLabelMayus;
        var phrase = BuildPhrase(flags, Style.Mayuscula, singular: false);
        return string.IsNullOrEmpty(phrase) ? DefaultAdjuntosLabelMayus : phrase;
    }

    private static bool Only(MediaFlags flags, Func<MediaFlags, bool> pick) =>
        pick(flags)
        && CountTrue(flags) == 1;

    private static int CountTrue(MediaFlags flags)
    {
        var n = 0;
        if (flags.Images) n++;
        if (flags.Video) n++;
        if (flags.Pdf) n++;
        if (flags.Txt) n++;
        if (flags.Excel) n++;
        if (flags.Xml) n++;
        return n;
    }

    private enum Style
    {
        Minuscula,
        Titulo,
        Mayuscula,
    }

    private static string BuildPhrase(MediaFlags flags, Style style, bool singular)
    {
        var parts = new List<string>(6);
        if (flags.Images)
        {
            parts.Add(style switch
            {
                Style.Mayuscula => singular ? "CAPTURA" : "CAPTURAS",
                Style.Titulo => singular ? "Captura" : "Capturas",
                _ => singular ? "captura" : "capturas",
            });
        }

        if (flags.Video)
        {
            parts.Add(style switch
            {
                Style.Mayuscula => "VIDEO",
                Style.Titulo => "Video",
                _ => "video",
            });
        }

        if (flags.Pdf)
        {
            parts.Add(style switch
            {
                Style.Mayuscula => "PDF",
                Style.Titulo => "PDF",
                _ => "PDF",
            });
        }

        if (flags.Txt)
        {
            parts.Add(style switch
            {
                Style.Mayuscula => "TXT",
                Style.Titulo => "TXT",
                _ => "TXT",
            });
        }

        if (flags.Excel)
        {
            parts.Add(style switch
            {
                Style.Mayuscula => "EXCEL",
                Style.Titulo => "Excel",
                _ => "Excel",
            });
        }

        if (flags.Xml)
        {
            parts.Add(style switch
            {
                Style.Mayuscula => "XML",
                Style.Titulo => "XML",
                _ => "XML",
            });
        }

        if (parts.Count == 0)
            return "";

        if (parts.Count == 1)
            return parts[0];

        if (parts.Count == 2)
            return style == Style.Mayuscula
                ? $"{parts[0]} Y {parts[1]}"
                : $"{parts[0]} y {parts[1]}";

        var last = parts[^1];
        var head = string.Join(", ", parts.Take(parts.Count - 1));
        return style == Style.Mayuscula
            ? $"{head} Y {last}"
            : $"{head} y {last}";
    }

    private static MediaFlags Classify(IReadOnlyList<TransferenciaCapturaEnlace> enlaces)
    {
        var images = false;
        var video = false;
        var pdf = false;
        var txt = false;
        var excel = false;
        var xml = false;
        foreach (var e in enlaces)
        {
            if (IsVideoFileName(e.FileName))
                video = true;
            else if (IsPdfFileName(e.FileName))
                pdf = true;
            else if (IsTxtFileName(e.FileName))
                txt = true;
            else if (IsExcelFileName(e.FileName))
                excel = true;
            else if (IsXmlFileName(e.FileName))
                xml = true;
            else
                images = true;
        }

        return new MediaFlags(images, video, pdf, txt, excel, xml);
    }

    private static bool IsVideoFileName(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            return false;
        return VideoExt.Contains(Path.GetExtension(fileName));
    }

    private static bool IsPdfFileName(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            return false;
        return PdfExt.Contains(Path.GetExtension(fileName));
    }

    private static bool IsTxtFileName(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            return false;
        return TxtExt.Contains(Path.GetExtension(fileName));
    }

    private static bool IsExcelFileName(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            return false;
        return ExcelExt.Contains(Path.GetExtension(fileName));
    }

    private static bool IsXmlFileName(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            return false;
        return XmlExt.Contains(Path.GetExtension(fileName));
    }

    private readonly record struct MediaFlags(bool Images, bool Video, bool Pdf, bool Txt, bool Excel, bool Xml);
}
