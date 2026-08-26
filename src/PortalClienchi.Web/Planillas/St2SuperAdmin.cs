namespace PortalClienchi.Web.Planillas;

/// <summary>Usuarios con acceso total a módulos (siempre, sin depender del panel Accesos).</summary>
public static class St2SuperAdmin
{
    public const string PrimaryEmail = "leonel.gallo@thomsonreuters.com";

    public static bool Is(string? email)
    {
        var normalized = PlanUserIdentity.ValidateAndNormalize(email);
        return normalized is not null
            && string.Equals(normalized, PrimaryEmail, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Acceso total salvo Blanqueo: ese módulo sigue el panel Accesos
    /// (Leonel aún no tiene permisos reales de proceso).
    /// </summary>
    public static ModuleAccessFlagsDto FullFlags() => new()
    {
        Oportunidad = true,
        PdfPortal = true,
        Blanqueo = false,
        BlanqueoConfirm = false,
        BlanqueoLoad = false,
        BorradoBases = true,
        BorradoBasesConfirm = true,
        BorradoBasesLoad = true,
    };
}
