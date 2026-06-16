namespace PortalClienchi.Web.Planillas;

public enum PlanillasSistema
{
    None,
    BejermanSql,
    OnvioWeb,
    Legal,
    Chile,
}

public static class PlanillasSistemaExtensions
{
    public const string BejermanSqlLabel = "Bejerman SQL";
    public const string OnvioWebLabel = "ONVIO/Bejerman WEB";
    public const string LegalLabel = "LEGAL";
    public const string ChileLabel = "Chile";

    public static string ToDisplayName(this PlanillasSistema sistema) => sistema switch
    {
        PlanillasSistema.BejermanSql => BejermanSqlLabel,
        PlanillasSistema.OnvioWeb => OnvioWebLabel,
        PlanillasSistema.Legal => LegalLabel,
        PlanillasSistema.Chile => ChileLabel,
        _ => string.Empty,
    };

    public static PlanillasSistema Parse(string? value) => value?.Trim() switch
    {
        "BejermanSql" or "bejermanSql" or BejermanSqlLabel => PlanillasSistema.BejermanSql,
        "OnvioWeb" or "onvioWeb" or OnvioWebLabel => PlanillasSistema.OnvioWeb,
        "Legal" or "legal" or LegalLabel => PlanillasSistema.Legal,
        "Chile" or "chile" or ChileLabel => PlanillasSistema.Chile,
        _ => PlanillasSistema.None,
    };

    public static bool IsPlaceholder(this PlanillasSistema sistema) =>
        sistema is PlanillasSistema.Chile
        || (sistema is PlanillasSistema.Legal && !PlanillasFeatureFlags.LegalEnabled);

    public static bool BlocksOportunidad(this PlanillasSistema sistema) =>
        sistema is PlanillasSistema.Legal or PlanillasSistema.Chile;
}

public sealed class TransferenciaCase
{
    public PlanillasSistema Sistema { get; init; }
    public string NumeroCliente { get; init; } = "";
    public string? Mesa { get; init; }
    public string Asunto { get; init; } = "";
    public string Descripcion { get; init; } = "";
    public bool Capturas { get; init; }
    public IReadOnlyList<string> CapturasArchivos { get; init; } = Array.Empty<string>();
    public IReadOnlyList<TransferenciaCapturaEnlace> CapturasEnlaces { get; init; } = Array.Empty<TransferenciaCapturaEnlace>();
    public bool TicketSolicitado { get; init; }
    public string? NumeroTicket { get; init; }
    public string? PortalLink { get; init; }
    public string? PortalTitulo { get; init; }
    public LegalTransferFields Legal { get; init; } = new();

    public const string DescripcionPlaceholder = "Detalle y/o proceso realizado por el usuario";
}

public sealed class LegalTransferFields
{
    public string Produto { get; init; } = "";
    public string Modulo { get; init; } = "";
    public string Ambiente { get; init; } = "";
    public string UsuarioOnePass { get; init; } = "";
    public string Escritorio { get; init; } = "";
}

public sealed record TransferenciaCapturaEnlace(string FileName, string Url);

public sealed class TransferenciaGenerateRequest
{
    public string Sistema { get; set; } = "";
    public string NumeroCliente { get; set; } = "";
    public string? Mesa { get; set; }
    public string Asunto { get; set; } = "";
    public string? Descripcion { get; set; }
    public bool Capturas { get; set; }
    public bool TicketSolicitado { get; set; }
    public string? NumeroTicket { get; set; }
    public string? PortalLink { get; set; }
    public string? PortalTitulo { get; set; }
    public LegalTransferDto? Legal { get; set; }
    public List<CapturaEnlaceDto>? CapturasEnlaces { get; set; }
}

public sealed class LegalTransferDto
{
    public string? Produto { get; set; }
    public string? Modulo { get; set; }
    public string? Ambiente { get; set; }
    public string? UsuarioOnePass { get; set; }
    public string? Escritorio { get; set; }
}

public sealed record CapturaEnlaceDto(string FileName, string Url);
