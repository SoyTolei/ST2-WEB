namespace PortalClienchi.Core.Models;

public sealed class KnowledgeItem
{
    public int Id { get; set; }
    public KnowledgeType Type { get; set; }
    public string Title { get; set; } = "";
    public string? ProductName { get; set; }
    public string? Keywords { get; set; }
    public string? DescriptionHtml { get; set; }
    public string? DescriptionPlain { get; set; }
    public string? ExternalUrl { get; set; }
    public List<string> AttachmentUrls { get; set; } = [];
    public string? Duration { get; set; }
    public string PortalUrl { get; set; } = "";
    public DateTime? UpdatedAt { get; set; }
    public DateTime SyncedAt { get; set; }
}

public sealed class KnowledgeListEntry
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string? Keywords { get; set; }
    public string? SystemProductName { get; set; }
}

public sealed class PagedKnowledgeResponse
{
    public List<KnowledgeListEntry> Items { get; set; } = [];
    public int TotalRecords { get; set; }
}
