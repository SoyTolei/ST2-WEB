namespace PortalClienchi.Web.Planillas;

public static class PlanModuleIds
{
    public const string Oportunidad = "oportunidad";
    public const string PdfPortal = "pdfPortal";
    public const string Blanqueo = "blanqueo";
    /// <summary>Puede usar el formulario de alta (además de ver el módulo).</summary>
    public const string BlanqueoLoad = "blanqueo_load";

    public static readonly string[] All = [Oportunidad, PdfPortal, Blanqueo, BlanqueoLoad];
}

public sealed class ModuleAccessFlagsDto
{
    public bool Oportunidad { get; set; }
    public bool PdfPortal { get; set; }
    public bool Blanqueo { get; set; }
    public bool BlanqueoConfirm { get; set; }
    /// <summary>Formulario de nueva solicitud. Confirmadores suelen tenerlo en false (solo listado).</summary>
    public bool BlanqueoLoad { get; set; }
}

public sealed class ModuleAccessUpdateRequest
{
    public string Email { get; set; } = "";
    public bool? Oportunidad { get; set; }
    public bool? PdfPortal { get; set; }
    public bool? Blanqueo { get; set; }
    public bool? BlanqueoConfirm { get; set; }
    public bool? BlanqueoLoad { get; set; }
}
