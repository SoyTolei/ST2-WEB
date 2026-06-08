using PortalClienchi.Core.Utilities;

namespace PortalClienchi.Core.Models;
public sealed class SearchResult
{
    public int Id { get; set; }
    public string Type { get; set; } = "";
    public string TypeLabel { get; set; } = "";
    public string Title { get; set; } = "";
    public string? ProductName { get; set; }
    public string Snippet { get; set; } = "";
    public string PortalUrl { get; set; } = "";
    public string? ExternalUrl { get; set; }

    public int? Year { get; set; }
    public DateTime? PublishedAt { get; set; }
    public int SortYear { get; set; }
    public string GroupKey { get; set; } = "";
    public string GroupTitle { get; set; } = "";
    public bool IsVersionOfGroup { get; set; }
    public string YearLabel => Year is > 0 ? Year.Value.ToString() : "—";
    public string DateLabel => PublishedAt?.ToString("dd/MM/yyyy") ?? YearLabel;
    public bool IsCurrentYear => SortYear > 0 && SortYear == DateTime.Now.Year;

    public void ApplyYearResolution(YearResolution resolution)
    {
        resolution = TopicYearHelper.Sanitize(resolution);
        Year = resolution.Year;
        PublishedAt = resolution.PublishedAt;
        SortYear = resolution.SortYear;
    }
}
