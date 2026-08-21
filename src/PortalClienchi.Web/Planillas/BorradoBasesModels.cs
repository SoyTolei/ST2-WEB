namespace PortalClienchi.Web.Planillas;

public sealed class BorradoBasesRecordDto
{
    public int Id { get; set; }
    public string NroCaso { get; set; } = "";
    public string NroCliente { get; set; } = "";
    public string NroEmpresa { get; set; } = "";
    public string NombreEmpresa { get; set; } = "";
    public string Cuit { get; set; } = "";
    public bool Iva { get; set; }
    public bool Sueldos { get; set; }
    public bool Contabilidad { get; set; }
    /// <summary>Nombre / detalle de la base IVA (legacy; ya no se carga en UI).</summary>
    public string? IvaDetalle { get; set; }
    /// <summary>Nombre / detalle de la base Sueldos (legacy; ya no se carga en UI).</summary>
    public string? SueldosDetalle { get; set; }
    /// <summary>Ejercicios a borrar (requerido si Contabilidad).</summary>
    public string? EjerciciosDetalle { get; set; }
    public string FechaSolicitud { get; set; } = "";
    public string SolicitadoPorEmail { get; set; } = "";
    public string SolicitadoPorNombre { get; set; } = "";
    public bool Listo { get; set; }
    public string? Aclaracion { get; set; }
    /// <summary>UTC ISO de alta (para ordenar: lo más nuevo al final).</summary>
    public string FechaCreacion { get; set; } = "";
}

public sealed class BorradoBasesCreateRequest
{
    public string NroCaso { get; set; } = "";
    public string NroCliente { get; set; } = "";
    public string NroEmpresa { get; set; } = "";
    public string NombreEmpresa { get; set; } = "";
    public string Cuit { get; set; } = "";
    public bool Iva { get; set; }
    public bool Sueldos { get; set; }
    public bool Contabilidad { get; set; }
    public string? IvaDetalle { get; set; }
    public string? SueldosDetalle { get; set; }
    public string? EjerciciosDetalle { get; set; }
}

public sealed class BorradoBasesUpdateRequest
{
    public string NroCaso { get; set; } = "";
    public string NroCliente { get; set; } = "";
    public string NroEmpresa { get; set; } = "";
    public string NombreEmpresa { get; set; } = "";
    public string Cuit { get; set; } = "";
    public bool Iva { get; set; }
    public bool Sueldos { get; set; }
    public bool Contabilidad { get; set; }
    public string? IvaDetalle { get; set; }
    public string? SueldosDetalle { get; set; }
    public string? EjerciciosDetalle { get; set; }
}

public sealed class BorradoBasesPatchRequest
{
    public bool? Listo { get; set; }
    public string? Aclaracion { get; set; }
    public bool ClearAclaracion { get; set; }
}

public static class BorradoAlertKinds
{
    public const string Ready = "ready";
    public const string Note = "note";
    public const string Partial = "partial";
    public const string Pending = "pending";

    /// <summary>Confirmación con alguna base marcada ✗ (no hecha).</summary>
    public static bool IsPartialListo(string? aclaracion)
    {
        var text = (aclaracion ?? "").Trim();
        if (string.IsNullOrEmpty(text))
            return false;
        // Solo el resumen de bases (✓/✗); no confundir con observaciones libres.
        var resultado = text;
        var sep = text.IndexOf("---", StringComparison.Ordinal);
        if (sep >= 0)
            resultado = text[..sep].Trim();
        return resultado.Contains('✗', StringComparison.Ordinal);
    }
}

public sealed class BorradoAlertDto
{
    public int Id { get; set; }
    public int SolicitudId { get; set; }
    public string NroCaso { get; set; } = "";
    public string NroEmpresa { get; set; } = "";
    public string NombreEmpresa { get; set; } = "";
    public string Cuit { get; set; } = "";
    public string Kind { get; set; } = BorradoAlertKinds.Ready;
    public string CreatedAt { get; set; } = "";
}

public sealed class BorradoAlertsSeenRequest
{
    public int[]? Ids { get; set; }
}
