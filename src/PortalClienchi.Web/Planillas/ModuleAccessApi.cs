namespace PortalClienchi.Web.Planillas;

public static class ModuleAccessApi
{
    public static object Snapshot(ModuleAccessFlagsDto flags) => new
    {
        oportunidad = flags.Oportunidad,
        pdfPortal = flags.PdfPortal,
        blanqueo = flags.Blanqueo,
        blanqueoConfirm = flags.BlanqueoConfirm,
        blanqueoLoad = flags.BlanqueoLoad,
        borradoBases = flags.BorradoBases,
        borradoBasesConfirm = flags.BorradoBasesConfirm,
        borradoBasesLoad = flags.BorradoBasesLoad,
        planillasSqlOnvio = flags.PlanillasSqlOnvio,
        planillasTransferencia = flags.PlanillasTransferencia,
        planillasReferral = flags.PlanillasReferral,
        planillasLegal = flags.PlanillasLegal,
        legalFirm = flags.LegalFirm,
        legalHighq = flags.LegalHighq,
        legalWestlaw = flags.LegalWestlaw,
        legalCocounsel = flags.LegalCocounsel,
        planillasChile = flags.PlanillasChile,
        chileTransferencia = flags.ChileTransferencia,
        chileReferral = flags.ChileReferral,
        chileSaad = flags.ChileSaad,
        chileHr = flags.ChileHr,
        chileWiki = flags.ChileWiki,
        chileLp = flags.ChileLp,
        chilePowerapps = flags.ChilePowerapps,
    };
}
