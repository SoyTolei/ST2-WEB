namespace PortalClienchi.Web.Planillas;

public static class CapturasTextoHelper
{
    private static readonly HashSet<string> VideoExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".webm",
    };

    public static void AppendBloqueCapturas(
        List<string> partes,
        bool hayCapturas,
        IReadOnlyList<TransferenciaCapturaEnlace> enlaces)
    {
        var tipo = Classify(enlaces);
        partes.Add($"¿SE ADJUNTAN {LabelMayus(tipo, hayCapturas)}?: {(hayCapturas ? "SÍ" : "NO")}");
        if (!hayCapturas)
            return;

        AppendEnlacesOComentarios(partes, enlaces, tipo);
    }

    private static void AppendEnlacesOComentarios(
        List<string> partes,
        IReadOnlyList<TransferenciaCapturaEnlace> enlaces,
        MediaKind tipo)
    {
        if (enlaces.Count > 0)
        {
            partes.Add(BuildEnlacesIntro(enlaces, tipo));
            foreach (var enlace in enlaces)
                partes.Add(enlace.Url);
            return;
        }

        partes.Add($"  {BuildComentariosLine(tipo)}");
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
        var tipo = Classify(enlaces);
        if (enlaces.Count > 0)
        {
            partes.Add($"{pad}{BuildEnlacesIntro(enlaces, tipo)}");
            foreach (var enlace in enlaces)
                partes.Add(indentar ? $"  {enlace.Url}" : enlace.Url);
            return;
        }

        partes.Add($"{pad}{BuildComentariosLine(tipo)}");
    }

    /// <summary>Título de sección para Referral según lo subido.</summary>
    public static string BuildSeccionTitulo(IReadOnlyList<TransferenciaCapturaEnlace> enlaces)
    {
        var tipo = Classify(enlaces);
        return tipo switch
        {
            MediaKind.SoloVideo => "- Video",
            MediaKind.Mixto => "- Capturas y video",
            MediaKind.SoloImagenes when enlaces.Count == 1 => "- Captura",
            MediaKind.SoloImagenes => "- Capturas",
            _ => "- Capturas / video",
        };
    }

    /// <summary>Etiqueta corta para ítems «en comentarios» (Referral).</summary>
    public static string BuildComentariosItemLabel(IReadOnlyList<TransferenciaCapturaEnlace> enlaces)
    {
        var tipo = Classify(enlaces);
        return tipo switch
        {
            MediaKind.SoloVideo => "Video",
            MediaKind.Mixto => "Capturas y video",
            MediaKind.SoloImagenes => "Capturas",
            _ => "Capturas / video",
        };
    }

    public static string BuildSiNoLabel(IReadOnlyList<TransferenciaCapturaEnlace> enlaces, bool marcado)
    {
        if (!marcado)
            return "capturas / video";
        var tipo = Classify(enlaces);
        return tipo switch
        {
            MediaKind.SoloVideo => "video",
            MediaKind.Mixto => "capturas y video",
            MediaKind.SoloImagenes => "capturas",
            _ => "capturas / video",
        };
    }

    private static string BuildEnlacesIntro(
        IReadOnlyList<TransferenciaCapturaEnlace> enlaces,
        MediaKind tipo)
    {
        var uno = enlaces.Count == 1;
        return tipo switch
        {
            MediaKind.SoloVideo when uno => "Se adjunta el video en el siguiente link:",
            MediaKind.SoloVideo => "Se adjuntan los videos en los siguientes links:",
            MediaKind.Mixto => "Se adjuntan capturas y video en los siguientes links:",
            MediaKind.SoloImagenes when uno => "Se adjunta la captura en el siguiente link:",
            MediaKind.SoloImagenes => "Se adjuntan las capturas en los siguientes links:",
            _ when uno => "Se adjunta captura / video en el siguiente link:",
            _ => "Se adjuntan capturas / video en los siguientes links:",
        };
    }

    private static string BuildComentariosLine(MediaKind tipo) =>
        tipo switch
        {
            MediaKind.SoloVideo => "El video se adjunta en comentarios.",
            MediaKind.Mixto => "Las capturas y el video se adjuntan en comentarios.",
            MediaKind.SoloImagenes => "Las capturas se adjuntan en comentarios.",
            _ => "Las capturas / video se adjuntan en comentarios.",
        };

    private static string LabelMayus(MediaKind tipo, bool hayCapturas)
    {
        if (!hayCapturas)
            return "CAPTURAS / VIDEO";
        return tipo switch
        {
            MediaKind.SoloVideo => "VIDEO",
            MediaKind.Mixto => "CAPTURAS Y VIDEO",
            MediaKind.SoloImagenes => "CAPTURAS",
            _ => "CAPTURAS / VIDEO",
        };
    }

    private static MediaKind Classify(IReadOnlyList<TransferenciaCapturaEnlace> enlaces)
    {
        if (enlaces.Count == 0)
            return MediaKind.Desconocido;

        var videos = 0;
        var imgs = 0;
        foreach (var e in enlaces)
        {
            if (IsVideoFileName(e.FileName))
                videos++;
            else
                imgs++;
        }

        if (videos > 0 && imgs > 0) return MediaKind.Mixto;
        if (videos > 0) return MediaKind.SoloVideo;
        return MediaKind.SoloImagenes;
    }

    private static bool IsVideoFileName(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            return false;
        return VideoExt.Contains(Path.GetExtension(fileName));
    }

    private enum MediaKind
    {
        Desconocido,
        SoloImagenes,
        SoloVideo,
        Mixto,
    }
}
