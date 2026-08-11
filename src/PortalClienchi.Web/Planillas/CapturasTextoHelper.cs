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
        return string.IsNullOrEmpty(label) ? "- Capturas / video / PDF / TXT" : $"- {label}";
    }

    /// <summary>Etiqueta corta para ítems «en comentarios» (Referral).</summary>
    public static string BuildComentariosItemLabel(IReadOnlyList<TransferenciaCapturaEnlace> enlaces)
    {
        var flags = Classify(enlaces);
        var label = BuildPhrase(flags, Style.Titulo, singular: false);
        return string.IsNullOrEmpty(label) ? "Capturas / video / PDF / TXT" : label;
    }

    public static string BuildSiNoLabel(IReadOnlyList<TransferenciaCapturaEnlace> enlaces, bool marcado)
    {
        if (!marcado)
            return "capturas / video / PDF / TXT";
        var flags = Classify(enlaces);
        var label = BuildPhrase(flags, Style.Minuscula, singular: false);
        return string.IsNullOrEmpty(label) ? "capturas / video / PDF / TXT" : label;
    }

    private static string BuildEnlacesIntro(
        IReadOnlyList<TransferenciaCapturaEnlace> enlaces,
        MediaFlags flags)
    {
        var uno = enlaces.Count == 1;
        var phrase = BuildPhrase(flags, Style.Minuscula, uno);
        if (string.IsNullOrEmpty(phrase))
            phrase = uno ? "captura / video / PDF / TXT" : "capturas / video / PDF / TXT";

        if (uno)
            return $"Se adjunta {ArticleFor(flags)} {phrase} en el siguiente link:";

        return $"Se adjuntan {phrase} en los siguientes links:";
    }

    private static string ArticleFor(MediaFlags flags)
    {
        // "el video", "el PDF", "el TXT", "la captura"
        if (flags.Video && !flags.Images && !flags.Pdf && !flags.Txt) return "el";
        if (flags.Pdf && !flags.Images && !flags.Video && !flags.Txt) return "el";
        if (flags.Txt && !flags.Images && !flags.Video && !flags.Pdf) return "el";
        if (flags.Images && !flags.Video && !flags.Pdf && !flags.Txt) return "la";
        return "el";
    }

    private static string BuildComentariosLine(MediaFlags flags)
    {
        var phrase = BuildPhrase(flags, Style.Minuscula, singular: false);
        if (string.IsNullOrEmpty(phrase))
            phrase = "capturas / video / PDF / TXT";

        var sujeto = flags switch
        {
            { Images: false, Video: true, Pdf: false, Txt: false } => "El video se adjunta",
            { Images: false, Video: false, Pdf: true, Txt: false } => "El PDF se adjunta",
            { Images: false, Video: false, Pdf: false, Txt: true } => "El TXT se adjunta",
            { Images: true, Video: false, Pdf: false, Txt: false } => "Las capturas se adjuntan",
            _ => $"{char.ToUpperInvariant(phrase[0])}{phrase[1..]} se adjuntan",
        };

        return $"{sujeto} en comentarios.";
    }

    private static string LabelMayus(MediaFlags flags, bool hayCapturas)
    {
        if (!hayCapturas)
            return "CAPTURAS / VIDEO / PDF / TXT";
        var phrase = BuildPhrase(flags, Style.Mayuscula, singular: false);
        return string.IsNullOrEmpty(phrase) ? "CAPTURAS / VIDEO / PDF / TXT" : phrase;
    }

    private enum Style
    {
        Minuscula,
        Titulo,
        Mayuscula,
    }

    private static string BuildPhrase(MediaFlags flags, Style style, bool singular)
    {
        var parts = new List<string>(4);
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
        foreach (var e in enlaces)
        {
            if (IsVideoFileName(e.FileName))
                video = true;
            else if (IsPdfFileName(e.FileName))
                pdf = true;
            else if (IsTxtFileName(e.FileName))
                txt = true;
            else
                images = true;
        }

        return new MediaFlags(images, video, pdf, txt);
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

    private readonly record struct MediaFlags(bool Images, bool Video, bool Pdf, bool Txt);
}
