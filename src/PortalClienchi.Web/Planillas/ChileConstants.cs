namespace PortalClienchi.Web.Planillas;

public static class ChileConstants
{
    public static readonly (string Id, string Label)[] Mesas =
    [
        ("TECNICO", "Técnico"),
        ("FUNCIONAL", "Funcional"),
    ];

    public static readonly HashSet<string> MesaIds = new(Mesas.Select(m => m.Id), StringComparer.OrdinalIgnoreCase);

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
