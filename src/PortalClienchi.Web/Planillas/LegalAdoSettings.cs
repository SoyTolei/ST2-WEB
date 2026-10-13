namespace PortalClienchi.Web.Planillas;

/// <summary>
/// Sección <c>Legal:Ado</c> de appsettings: valores fijos del proceso de carga de Bug / User Story
/// de Westlaw International en Azure DevOps. Se editan acá, no en el JS.
/// </summary>
public sealed class LegalAdoSettings
{
    public string AssignedTo { get; set; } = "";
    public string State { get; set; } = "";
    public string Reason { get; set; } = "";
    public string Iteration { get; set; } = "";
    public string CustomerTag { get; set; } = "";
    public LegalAdoBacklog Application { get; set; } = new();
    public LegalAdoBacklog Content { get; set; } = new();
    public List<LegalAdoCountry> Countries { get; set; } = [];
}

public sealed class LegalAdoBacklog
{
    /// <summary>Tipo del item padre en ADO (Epic, work item…).</summary>
    public string ParentType { get; set; } = "";
    public string ParentId { get; set; } = "";
    public string Area { get; set; } = "";
}

public sealed class LegalAdoCountry
{
    public string Es { get; set; } = "";
    public string En { get; set; } = "";
}
