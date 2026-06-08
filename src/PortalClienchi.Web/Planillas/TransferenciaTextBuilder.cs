namespace PortalClienchi.Web.Planillas;

public static class TransferenciaTextBuilder
{
    private static readonly Dictionary<string, string> DestinoPorMesa = new(StringComparer.OrdinalIgnoreCase)
    {
        ["TECNICO"] = "la mesa TECNICA",
        ["FLEX"] = "la mesa FUNCIONAL",
        ["SAAS"] = "la mesa SAAS / ONVIO",
        ["SUELDOS"] = "la mesa de Sueldos y Jornales",
    };

    public static string Build(TransferenciaCase c)
    {
        var partes = new List<string>();

        partes.Add("==========================================");
        partes.Add("DATOS DEL CLIENTE 🪪");
        partes.Add($"N° DE CLIENTE: {c.NumeroCliente.Trim()}");

        partes.Add("==========================================");
        partes.Add("DETALLES DEL CASO 📝");
        partes.Add("");

        var asunto = c.Asunto.Trim();
        var desc = NormalizeDescripcion(c.Descripcion);
        var descOk = !string.IsNullOrWhiteSpace(desc) && desc != TransferenciaCase.DescripcionPlaceholder;

        if (!string.IsNullOrEmpty(c.Mesa) && !string.IsNullOrEmpty(asunto))
        {
            if (asunto.StartsWith("Se deriva a", StringComparison.OrdinalIgnoreCase))
                partes.Add(asunto);
            else
            {
                var destino = DestinoPorMesa.TryGetValue(c.Mesa, out var d)
                    ? d
                    : $"la mesa {c.Mesa}";
                partes.Add($"Se deriva a {destino} debido a la siguiente consulta o requerimiento: {asunto}");
            }

            if (descOk)
            {
                partes.Add("");
                partes.Add("DESCRIPCIÓN DEL CASO:");
                partes.Add(desc);
            }
        }
        else
        {
            if (!string.IsNullOrEmpty(asunto))
                partes.Add($"ASUNTO Y/O ERROR: {asunto}");
            if (descOk)
            {
                if (!string.IsNullOrEmpty(asunto))
                    partes.Add("");
                partes.Add($"DESCRIPCIÓN DEL CASO: {desc}");
            }
        }

        if (!string.IsNullOrWhiteSpace(c.PortalLink))
        {
            partes.Add("");
            partes.Add("==========================================");
            partes.Add("PORTAL Y REFERENCIA");
            partes.Add($"REFERENCIA PORTAL CLIENTE: {c.PortalLink.Trim()}");
            if (!string.IsNullOrWhiteSpace(c.PortalTitulo))
                partes.Add($"TÍTULO REFERENCIA: {c.PortalTitulo.Trim()}");
        }

        partes.Add("");
        partes.Add("==========================================");
        partes.Add("INFORMACIÓN ADICIONAL");
        partes.Add("");
        var hayCapturas = c.Capturas || c.CapturasEnlaces.Count > 0;
        CapturasTextoHelper.AppendBloqueCapturas(partes, hayCapturas, c.CapturasEnlaces);

        if (c.Sistema == PlanillasSistema.OnvioWeb)
        {
            partes.Add($"¿SE SOLICITÓ TICKET DE SERVICIO?: {(c.TicketSolicitado ? "SÍ" : "NO")}");
            if (c.TicketSolicitado && !string.IsNullOrWhiteSpace(c.NumeroTicket))
                partes.Add($"N° DE TICKET: {c.NumeroTicket.Trim()}");
        }
        else if (c.Sistema == PlanillasSistema.BejermanSql && c.Mesa is "SAAS" or "SUELDOS")
        {
            partes.Add($"¿SE SOLICITÓ TICKET DE SERVICIO?: {(c.TicketSolicitado ? "SÍ" : "NO")}");
            if (c.TicketSolicitado && !string.IsNullOrWhiteSpace(c.NumeroTicket))
                partes.Add($"N° DE TICKET: {c.NumeroTicket.Trim()}");
        }

        partes.Add("==========================================");
        return string.Join(Environment.NewLine, partes);
    }

    private static string NormalizeDescripcion(string? text) =>
        string.IsNullOrWhiteSpace(text) ? "" : text.Trim();
}
