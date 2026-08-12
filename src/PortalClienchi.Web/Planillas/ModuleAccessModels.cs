namespace PortalClienchi.Web.Planillas;

public static class PlanModuleIds
{
    public const string Oportunidad = "oportunidad";
    public const string PdfPortal = "pdfPortal";
    public const string Blanqueo = "blanqueo";

    public static readonly string[] All = [Oportunidad, PdfPortal, Blanqueo];
}

public sealed class ModuleAccessFlagsDto
{
    public bool Oportunidad { get; set; }
    public bool PdfPortal { get; set; }
    public bool Blanqueo { get; set; }
    public bool BlanqueoConfirm { get; set; }
}

public sealed class ModuleAccessUpdateRequest
{
    public string Email { get; set; } = "";
    public bool? Oportunidad { get; set; }
    public bool? PdfPortal { get; set; }
    public bool? Blanqueo { get; set; }
    public bool? BlanqueoConfirm { get; set; }
}
