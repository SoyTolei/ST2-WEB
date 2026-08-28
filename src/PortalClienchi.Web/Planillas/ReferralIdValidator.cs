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
            PlanillasSistema.Legal => PlanillasFeatureFlags.LegalEnabled
                ? ValidateLegal(c)
                : "El módulo LEGAL estará disponible en una próxima versión.",
            PlanillasSistema.Chile => ValidateChile(c),
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

    private static string? ValidateChile(ReferralIdCase c)
    {
        var ch = c.Chile;

        if (string.IsNullOrWhiteSpace(ch.Producto) || ch.Producto == ChileConstants.PlaceholderProducto)
            return "Seleccioná el producto.";

        if (!ChileConstants.ReferralProductoIds.Contains(ch.Producto))
            return "Producto no válido.";

        if (string.Equals(ch.Producto, "HYPERRENTA", StringComparison.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(ch.HyperrentaVersion))
                return "Seleccioná la versión de Hyperrenta.";

            if (!ChileConstants.HyperrentaVersionIds.Contains(ch.HyperrentaVersion))
                return "Versión de Hyperrenta no válida.";

            if (ch.HyperrentaModulos.Count == 0)
                return "Seleccioná al menos un módulo HR.";
        }
        else
        {
            if (string.IsNullOrWhiteSpace(ch.Version))
                return "Completá la versión del producto.";

            if (string.IsNullOrWhiteSpace(ch.TipoBase))
                return "Seleccioná el tipo de base (Access o SQL).";

            if (!ChileConstants.TiposBase.Contains(ch.TipoBase))
                return "Tipo de base no válido.";

            if (ch.BaseAdjunta is null)
                return "Indicá si hay base adjunta (Sí o No).";

            if (string.Equals(ch.TipoBase, "SQL", StringComparison.OrdinalIgnoreCase)
                && string.IsNullOrWhiteSpace(ch.VersionMotorSql))
                return "Completá la versión del motor SQL.";
        }

        if (string.IsNullOrWhiteSpace(ch.Anio))
            return "Completá el año.";

        if (string.IsNullOrWhiteSpace(ch.Rut))
            return "Completá el RUT con inconvenientes.";

        var common = ValidateCommonFields(c);
        if (common is not null)
            return common;

        if (string.IsNullOrWhiteSpace(ch.Usuario))
            return "Completá el usuario de ingreso al sistema.";

        if (string.IsNullOrWhiteSpace(ch.Clave))
            return "Completá la clave de ingreso al sistema.";

        if (string.IsNullOrWhiteSpace(ch.SistemaOperativo))
            return "Completá el sistema operativo.";

        return null;
    }

    private static string? ValidateLegal(ReferralIdCase c)
    {
        if (c.Legal.Produto == LegalConstants.PlaceholderProduto || string.IsNullOrWhiteSpace(c.Legal.Produto))
            return "Seleccioná el producto Legal One.";

        if (c.Legal.Modulo == LegalConstants.PlaceholderModulo || string.IsNullOrWhiteSpace(c.Legal.Modulo))
            return "Seleccioná el módulo.";

        if (c.Legal.Ambiente == LegalConstants.PlaceholderAmbiente || string.IsNullOrWhiteSpace(c.Legal.Ambiente))
            return "Seleccioná el ambiente.";

        var common = ValidateCommonFields(c);
        if (common is not null)
            return common;

        if (string.IsNullOrWhiteSpace(c.Legal.ChaveRegistro))
            return "Completá la clave de registro.";

        if (string.IsNullOrWhiteSpace(c.Legal.UsuarioOnePass))
            return "Completá el usuario OnePass.";

        if (string.IsNullOrWhiteSpace(c.Legal.Escritorio))
            return "Completá el estudio / empresa.";

        if (c.Legal.HayTicket && string.IsNullOrWhiteSpace(c.Legal.NumeroTicket))
            return "Completá el N° de Ticket.";

        if (!c.Legal.HayTicket && !c.Legal.TicketAvisoOmitido)
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
