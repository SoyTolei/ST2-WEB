namespace PortalClienchi.Web.Planillas;

public static class ChileConstants
{
    public const string PlaceholderProducto = "";

    public static readonly (string Id, string Label)[] Mesas =
    [
        ("TECNICO", "Técnico"),
        ("FUNCIONAL", "Funcional"),
    ];

    public static readonly HashSet<string> MesaIds = new(Mesas.Select(m => m.Id), StringComparer.OrdinalIgnoreCase);

    public static readonly (string Id, string Label)[] ReferralProductos =
    [
        ("HYPERRENTA", "Hyperrenta"),
        ("CONTABILIDAD", "Contabilidad"),
        ("REMUNERACIONES", "Remuneraciones"),
    ];

    public static readonly HashSet<string> ReferralProductoIds = new(
        ReferralProductos.Select(p => p.Id),
        StringComparer.OrdinalIgnoreCase);

    public static readonly (string Id, string Label, string ExportLabel)[] HyperrentaVersiones =
    [
        ("ENTERPRISE", "Enterprise", "Enterprise (mod Rad SQL)"),
        ("PLUS", "Plus", "Plus"),
    ];

    public static readonly HashSet<string> HyperrentaVersionIds = new(
        HyperrentaVersiones.Select(v => v.Id),
        StringComparer.OrdinalIgnoreCase);

    public static readonly string[] HyperrentaModulos =
    [
        "HR-Administrador",
        "HR-Certificados",
        "HR-Extractor de Bases",
        "HR-Formulario 22",
        "HR-Importador de Certificados",
        "HR-Impuestos Finales",
        "HR-Iva",
        "HR-RAD",
        "HR-Traspasos",
        "HR-Wizard Importador IVA",
    ];

    public static readonly string[] TiposBase = ["Access", "SQL"];

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

    public static string ReferralProductoLabel(string? id)
    {
        if (string.IsNullOrWhiteSpace(id))
            return string.Empty;

        foreach (var (productoId, label) in ReferralProductos)
        {
            if (string.Equals(productoId, id.Trim(), StringComparison.OrdinalIgnoreCase))
                return label;
        }

        return id.Trim();
    }

    public static string HyperrentaVersionExportLabel(string? id)
    {
        if (string.IsNullOrWhiteSpace(id))
            return string.Empty;

        foreach (var (versionId, _, exportLabel) in HyperrentaVersiones)
        {
            if (string.Equals(versionId, id.Trim(), StringComparison.OrdinalIgnoreCase))
                return exportLabel;
        }

        return id.Trim();
    }
}
