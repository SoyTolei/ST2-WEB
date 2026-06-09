namespace PortalClienchi.Web.Planillas;

public static class ReferralIdValidator
{
    public const string CodeTicketConfirm = "ticket_confirm";
    public const string CodeTicketEnable = "ticket_enable";

    public static string? ValidateForGenerate(ReferralIdCase c)
    {
        if (c.Sistema == PlanillasSistema.None)
            return "Seleccioná un sistema.";

        return c.Sistema switch
        {
            PlanillasSistema.BejermanSql => ValidateBejerman(c),
            PlanillasSistema.OnvioWeb => ValidateOnvio(c),
            PlanillasSistema.Legal => ValidateCommonFields(c),
            PlanillasSistema.Chile => "El módulo Chile estará disponible en una próxima versión.",
            _ => "Sistema no válido.",
        };
    }

    private static string? ValidateBejerman(ReferralIdCase c)
    {
        if (c.Version == ReferralIdConstants.PlaceholderVersion || string.IsNullOrWhiteSpace(c.Version))
            return "Seleccioná la versión del sistema.";

        if (c.Modulo == ReferralIdConstants.PlaceholderModulo || string.IsNullOrWhiteSpace(c.Modulo))
            return "Seleccioná el módulo.";

        var common = ValidateCommonFields(c);
        if (common is not null)
            return common;

        if (c.RequiresCollationSql)
        {
            if (c.Collation == ReferralIdConstants.PlaceholderCollation || string.IsNullOrWhiteSpace(c.Collation))
                return "Adjuntaste backup de bases: seleccioná la Collation SQL.";
            if (c.SqlServer == ReferralIdConstants.PlaceholderSqlServer || string.IsNullOrWhiteSpace(c.SqlServer))
                return "Adjuntaste backup de bases: seleccioná la versión de SQL Server.";
        }

        if (!c.MamConfigured)
            return "Abrí MAM y marcá al menos una opción (o «No utiliza MAM»).";

        if (!c.SdkConfigured)
            return "Abrí SDK y marcá al menos una opción (o «No utiliza SDK»).";

        if (!c.PlanillaConfigured)
            return "Completá la planilla técnica (todas las opciones obligatorias).";

        if (c.Adjuntos.BackupBases &&
            !(c.Adjuntos.BackupManager || c.Adjuntos.BackupSbda || c.Adjuntos.BackupCg || c.Adjuntos.BackupSj))
            return "Seleccioná al menos una base en Backup Bases.";

        return null;
    }

    private static string? ValidateOnvio(ReferralIdCase c)
    {
        var common = ValidateCommonFields(c);
        if (common is not null)
            return common;

        if (string.IsNullOrWhiteSpace(c.Onvio.UsuarioContador))
            return "Completá Usuario/Contador.";

        if (string.IsNullOrWhiteSpace(c.Onvio.Empresa))
            return "Completá Empresa.";

        if (c.Onvio.HayTicket && string.IsNullOrWhiteSpace(c.Onvio.NumeroTicket))
            return "Completá el N° de Ticket.";

        if (!c.Onvio.HayTicket && !c.Onvio.TicketAvisoOmitido)
            return CodeTicketConfirm;

        return null;
    }

    private static string? ValidateCommonFields(ReferralIdCase c)
    {
        if (string.IsNullOrWhiteSpace(c.Asunto))
            return "Completá el campo Asunto y/o Error.";

        if (!IsReal(c.Descripcion, ReferralIdConstants.PlaceholderDescripcion))
            return "Completá la descripción del caso.";

        if (!IsReal(c.PasoAPaso, ReferralIdConstants.PlaceholderPasoAPaso))
            return "Completá el paso a paso realizado.";

        return null;
    }

    private static bool IsReal(string? t, string ph) =>
        !string.IsNullOrWhiteSpace(t) && !string.Equals(t.Trim(), ph, StringComparison.Ordinal);
}
