namespace PortalClienchi.Web.Planillas;

public static class PlanModuleIds
{
    public const string Oportunidad = "oportunidad";
    public const string PdfPortal = "pdfPortal";
    public const string Blanqueo = "blanqueo";
    /// <summary>Puede usar el formulario de alta (además de ver el módulo).</summary>
    public const string BlanqueoLoad = "blanqueo_load";
    public const string BorradoBases = "borrado_bases";
    /// <summary>Puede usar el formulario de alta de borrado de bases.</summary>
    public const string BorradoBasesLoad = "borrado_bases_load";
    public const string PlanillasSqlOnvio = "planillas_sql_onvio";
    public const string PlanillasLegal = "planillas_legal";
    public const string PlanillasChile = "planillas_chile";

    public static readonly string[] All =
    [
        Oportunidad,
        PdfPortal,
        Blanqueo,
        BlanqueoLoad,
        BorradoBases,
        BorradoBasesLoad,
        PlanillasSqlOnvio,
        PlanillasLegal,
        PlanillasChile,
    ];
}

public sealed class ModuleAccessFlagsDto
{
    public bool Oportunidad { get; set; }
    public bool PdfPortal { get; set; }
    public bool Blanqueo { get; set; }
    public bool BlanqueoConfirm { get; set; }
    /// <summary>Formulario de nueva solicitud. Confirmadores suelen tenerlo en false (solo listado).</summary>
    public bool BlanqueoLoad { get; set; }
    public bool BorradoBases { get; set; }
    public bool BorradoBasesConfirm { get; set; }
    /// <summary>Formulario de nueva solicitud de borrado. Confirmadores suelen tenerlo en false.</summary>
    public bool BorradoBasesLoad { get; set; }
    public bool PlanillasSqlOnvio { get; set; } = true;
    public bool PlanillasLegal { get; set; } = true;
    public bool PlanillasChile { get; set; } = true;
}

public sealed class ModuleAccessUpdateRequest
{
    public string Email { get; set; } = "";
    public bool? Oportunidad { get; set; }
    public bool? PdfPortal { get; set; }
    public bool? Blanqueo { get; set; }
    public bool? BlanqueoConfirm { get; set; }
    public bool? BlanqueoLoad { get; set; }
    public bool? BorradoBases { get; set; }
    public bool? BorradoBasesConfirm { get; set; }
    public bool? BorradoBasesLoad { get; set; }
    public bool? PlanillasSqlOnvio { get; set; }
    public bool? PlanillasLegal { get; set; }
    public bool? PlanillasChile { get; set; }
    /// <summary>Puede ver la pestaña Admin ST2 (además del super-admin primario).</summary>
    public bool? St2Admin { get; set; }
}
