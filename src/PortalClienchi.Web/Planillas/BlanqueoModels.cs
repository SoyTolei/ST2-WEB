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
    public string? ModulosDetalle { get; set; }
    public bool Listo { get; set; }
    public string? Aclaracion { get; set; }
    /// <summary>UTC ISO de alta (para ordenar: lo más nuevo al final).</summary>
    public string FechaCreacion { get; set; } = "";
}

public sealed class BlanqueoCreateRequest
{
    public string Portal { get; set; } = "";
    public string NroCaso { get; set; } = "";
    public string NroCliente { get; set; } = "";
    public string Correo { get; set; } = "";
    public string TipoSolicitud { get; set; } = "";
    public string? ModulosDetalle { get; set; }
}

public sealed class BlanqueoUpdateRequest
{
    public string Portal { get; set; } = "";
    public string NroCaso { get; set; } = "";
    public string NroCliente { get; set; } = "";
    public string Correo { get; set; } = "";
    public string TipoSolicitud { get; set; } = "";
    public string? ModulosDetalle { get; set; }
}

public static class BlanqueoModulos
{
    public const string TipoHabilitacion = "Habilitación de Módulos";

    public static readonly string[] Permitidos =
    [
        "Sueldos SQL",
        "Sueldos WEB",
        "ONVIO",
        "Bejerman SQL",
        "Contabilidad WEB",
    ];

    public static bool EsHabilitacion(string? tipo) =>
        string.Equals((tipo ?? "").Trim(), TipoHabilitacion, StringComparison.OrdinalIgnoreCase);

    public static string? NormalizeList(string? raw)
    {
        var picked = Parse(raw);
        return picked.Count == 0 ? null : string.Join('|', picked);
    }

    public static List<string> Parse(string? raw)
    {
        var text = (raw ?? "").Trim();
        if (text.Length == 0)
            return [];

        var parts = text.Split(['|', ',', ';', '\n', '\r'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var list = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var part in parts)
        {
            var canon = Match(part);
            if (canon is null || !seen.Add(canon))
                continue;
            list.Add(canon);
        }
        return list;
    }

    public static string? Match(string? value)
    {
        var v = (value ?? "").Trim();
        if (v.Length == 0) return null;
        foreach (var opt in Permitidos)
        {
            if (opt.Equals(v, StringComparison.OrdinalIgnoreCase))
                return opt;
        }
        if (v.Equals("SueldosSql", StringComparison.OrdinalIgnoreCase) || v.Equals("Sueldos SQL", StringComparison.OrdinalIgnoreCase))
            return "Sueldos SQL";
        if (v.Equals("SueldosWeb", StringComparison.OrdinalIgnoreCase) || v.Equals("Sueldos WEB", StringComparison.OrdinalIgnoreCase))
            return "Sueldos WEB";
        if (v.Equals("BejermanSql", StringComparison.OrdinalIgnoreCase) || v.Equals("Bejerman SQL", StringComparison.OrdinalIgnoreCase))
            return "Bejerman SQL";
        if (v.Equals("ContabilidadWeb", StringComparison.OrdinalIgnoreCase) || v.Equals("Contabilidad WEB", StringComparison.OrdinalIgnoreCase))
            return "Contabilidad WEB";
        if (v.Equals("Onvio", StringComparison.OrdinalIgnoreCase))
            return "ONVIO";
        return null;
    }
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
    public const string Pending = "pending";

    public static string FromAclaracion(string? aclaracion)
    {
        var text = (aclaracion ?? "").Trim();
        if (text.Length == 0)
            return Note;
        if (IsNoRegistrado(text))
            return NoRegistrado;
        return Note;
    }

    public static bool IsNoRegistrado(string? aclaracion) =>
        string.Equals((aclaracion ?? "").Trim(), "No registrado", StringComparison.OrdinalIgnoreCase);
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
