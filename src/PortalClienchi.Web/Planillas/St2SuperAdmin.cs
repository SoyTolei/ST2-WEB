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

    public static ModuleAccessFlagsDto FullFlags() => new()
    {
        Oportunidad = true,
        PdfPortal = true,
        Blanqueo = true,
        BlanqueoConfirm = true,
        BlanqueoLoad = true,
        BorradoBases = true,
        BorradoBasesConfirm = true,
        BorradoBasesLoad = true,
        PlanillasSqlOnvio = true,
        PlanillasLegal = true,
        PlanillasChile = true,
    };
}
