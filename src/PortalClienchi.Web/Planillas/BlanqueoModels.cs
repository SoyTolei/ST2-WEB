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
