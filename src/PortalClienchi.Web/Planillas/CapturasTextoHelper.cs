namespace PortalClienchi.Web.Planillas;

public static class CapturasTextoHelper
{
    public static void AppendBloqueCapturas(
        List<string> partes,
        bool hayCapturas,
        IReadOnlyList<TransferenciaCapturaEnlace> enlaces)
    {
        partes.Add($"¿SE TOMARON CAPTURAS?: {(hayCapturas ? "SÍ" : "NO")}");
        if (!hayCapturas)
            return;

        AppendEnlacesOComentarios(partes, enlaces);
    }

    private static void AppendEnlacesOComentarios(
        List<string> partes,
        IReadOnlyList<TransferenciaCapturaEnlace> enlaces)
    {
        if (enlaces.Count > 0)
        {
            partes.Add(BuildEnlacesIntro(enlaces.Count));
            foreach (var enlace in enlaces)
                partes.Add(enlace.Url);
            return;
        }

        partes.Add("  La captura / imágenes / video se adjunta en comentarios.");
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
        if (enlaces.Count > 0)
        {
            partes.Add($"{pad}{BuildEnlacesIntro(enlaces.Count)}");
            foreach (var enlace in enlaces)
                partes.Add(indentar ? $"  {enlace.Url}" : enlace.Url);
            return;
        }

        partes.Add($"{pad}La captura / imágenes / video se adjunta en comentarios.");
    }

    private static string BuildEnlacesIntro(int count) =>
        count == 1
            ? "Se adjunta en el siguiente link:"
            : "Se adjuntan en los siguientes links:";
}
