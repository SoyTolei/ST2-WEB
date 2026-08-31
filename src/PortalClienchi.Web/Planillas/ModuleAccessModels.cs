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
    public const string PlanillasTransferencia = "planillas_transferencia";
    public const string PlanillasReferral = "planillas_referral";
    public const string PlanillasLegal = "planillas_legal";
    public const string LegalTransferencia = "legal_transferencia";
    public const string LegalEscalamiento = "legal_escalamiento";
    public const string PlanillasChile = "planillas_chile";
    public const string ChileTransferencia = "chile_transferencia";
    public const string ChileReferral = "chile_referral";
    public const string ChileSaad = "chile_saad";
    public const string ChileHr = "chile_hr";
    public const string ChileWiki = "chile_wiki";
    public const string ChileLp = "chile_lp";
    public const string ChilePowerapps = "chile_powerapps";

    public static readonly string[] All =
    [
        Oportunidad,
        PdfPortal,
        Blanqueo,
        BlanqueoLoad,
        BorradoBases,
        BorradoBasesLoad,
        PlanillasSqlOnvio,
        PlanillasTransferencia,
        PlanillasReferral,
        PlanillasLegal,
        LegalTransferencia,
        LegalEscalamiento,
        PlanillasChile,
        ChileTransferencia,
        ChileReferral,
        ChileSaad,
        ChileHr,
        ChileWiki,
        ChileLp,
        ChilePowerapps,
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
    public bool PlanillasTransferencia { get; set; } = true;
    public bool PlanillasReferral { get; set; } = true;
    public bool PlanillasLegal { get; set; } = true;
    public bool LegalTransferencia { get; set; } = true;
    public bool LegalEscalamiento { get; set; } = true;
    public bool PlanillasChile { get; set; } = true;
    public bool ChileTransferencia { get; set; } = true;
    public bool ChileReferral { get; set; } = true;
    public bool ChileSaad { get; set; } = true;
    public bool ChileHr { get; set; } = true;
    public bool ChileWiki { get; set; } = true;
    public bool ChileLp { get; set; } = true;
    public bool ChilePowerapps { get; set; } = true;
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
    public bool? PlanillasTransferencia { get; set; }
    public bool? PlanillasReferral { get; set; }
    public bool? PlanillasLegal { get; set; }
    public bool? LegalTransferencia { get; set; }
    public bool? LegalEscalamiento { get; set; }
    public bool? PlanillasChile { get; set; }
    public bool? ChileTransferencia { get; set; }
    public bool? ChileReferral { get; set; }
    public bool? ChileSaad { get; set; }
    public bool? ChileHr { get; set; }
    public bool? ChileWiki { get; set; }
    public bool? ChileLp { get; set; }
    public bool? ChilePowerapps { get; set; }
    /// <summary>Puede ver la pestaña Admin ST2 (además del super-admin primario).</summary>
    public bool? St2Admin { get; set; }
}
