namespace PortalClienchi.Web.Planillas;

public sealed class BlanqueoRecordDto
{
    public int Id { get; set; }
    public string Portal { get; set; } = "";
    public string NroCaso { get; set; } = "";
    public string NroCliente { get; set; } = "";
    public string Correo { get; set; } = "";
    public string FechaSolicitud { get; set; } = "";
    public string SolicitadoPorEmail { get; set; } = "";
    public string SolicitadoPorNombre { get; set; } = "";
    public string TipoSolicitud { get; set; } = "";
    public bool Listo { get; set; }
    public string? Aclaracion { get; set; }
}

public sealed class BlanqueoCreateRequest
{
    public string Portal { get; set; } = "";
    public string NroCaso { get; set; } = "";
    public string NroCliente { get; set; } = "";
    public string Correo { get; set; } = "";
    public string TipoSolicitud { get; set; } = "";
}

public sealed class BlanqueoUpdateRequest
{
    public string Portal { get; set; } = "";
    public string NroCaso { get; set; } = "";
    public string NroCliente { get; set; } = "";
    public string Correo { get; set; } = "";
    public string TipoSolicitud { get; set; } = "";
}

public sealed class BlanqueoPatchRequest
{
    public bool? Listo { get; set; }
    public string? Aclaracion { get; set; }
    public bool ClearAclaracion { get; set; }
}

public static class BlanqueoAlertKinds
{
    public const string Ready = "ready";
    public const string Note = "note";
    public const string NoRegistrado = "no_registrado";

    public static string FromAclaracion(string? aclaracion)
    {
        var text = (aclaracion ?? "").Trim();
        if (text.Length == 0)
            return Note;
        if (text.Equals("No registrado", StringComparison.OrdinalIgnoreCase))
            return NoRegistrado;
        return Note;
    }
}

public sealed class BlanqueoAlertDto
{
    public int Id { get; set; }
    public int SolicitudId { get; set; }
    public string Portal { get; set; } = "";
    public string NroCaso { get; set; } = "";
    public string Correo { get; set; } = "";
    public string TipoSolicitud { get; set; } = "";
    public string Kind { get; set; } = BlanqueoAlertKinds.Ready;
    public string CreatedAt { get; set; } = "";
}

public sealed class BlanqueoAlertsSeenRequest
{
    public int[]? Ids { get; set; }
}

public static class BlanqueoClave
{
    /// <summary>Clave temporal vigente (puede cambiarse a mano cuando se actualice el proceso).</summary>
    public const string Actual = "Sueldo.2026";
}
