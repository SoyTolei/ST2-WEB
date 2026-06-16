namespace PortalClienchi.Web.Planillas;

public static class LegalConstants
{
    public const string PlaceholderProduto = "Indique producto";
    public const string PlaceholderModulo = "Indique módulo...";
    public const string PlaceholderAmbiente = "Indique ambiente";

    public static readonly string[] Produtos =
    [
        "Legal One Firm",
        "Legal One Corporate",
        "Legal One Analytics",
        "HighQ",
    ];

    public static readonly string[] Modulos =
    [
        "Contencioso",
        "GED",
        "Workflow",
        "Financiero",
        "Agenda",
        "Contratos",
        "E-Social",
        "Intimaciones electrónicas",
        "Integraciones / API",
        "DataCloud",
        "OnePass / Autenticación",
    ];

    public static readonly string[] Ambientes = ["Producción", "Homologación"];

    public static readonly (string Id, string Label)[] Mesas =
    [
        ("N1", "Atención N1"),
        ("N2", "Técnico N2"),
        ("API", "API / Integraciones"),
        ("FINANCEIRO", "Financiero / NF-e"),
        ("ONEPASS", "Infra / OnePass"),
    ];

    public static string MesaLabel(string? id)
    {
        if (string.IsNullOrWhiteSpace(id))
            return string.Empty;

        foreach (var (mesaId, label) in Mesas)
        {
            if (string.Equals(mesaId, id.Trim(), StringComparison.OrdinalIgnoreCase))
                return label;
        }

        return id.Trim();
    }
}
