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
            partes.Add("SE ADJUNTAN LOS SIGUIENTES LINKS 🗃️");
            foreach (var enlace in enlaces)
                partes.Add(enlace.Url);
            return;
        }

        partes.Add("  La captura / imágenes se adjunta en comentarios.");
    }

    public static void AppendDetalleCapturasBajoLinea(
        List<string> partes,
        IReadOnlyList<TransferenciaCapturaEnlace> enlaces)
    {
        if (enlaces.Count > 0)
        {
            partes.Add("  SE ADJUNTAN LOS SIGUIENTES LINKS 🗃️");
            foreach (var enlace in enlaces)
                partes.Add($"  {enlace.Url}");
            return;
        }

        partes.Add("  La captura / imágenes se adjunta en comentarios.");
    }
}
