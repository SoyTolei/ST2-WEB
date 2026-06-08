namespace PortalClienchi.Core.Models;

public enum KnowledgeType
{
    Faq = 1,
    Video = 2,
    Manual = 3,
    News = 4,
    Link = 5,
    Other = 6,
}

public static class KnowledgeTypeExtensions
{
    public static string ToDisplayName(this KnowledgeType type) => type switch
    {
        KnowledgeType.Faq => "FAQ",
        KnowledgeType.Video => "Video",
        KnowledgeType.Manual => "Manual",
        KnowledgeType.News => "Actualización",
        KnowledgeType.Link => "Link",
        _ => "Otro",
    };

    public static string ToFilterKey(this KnowledgeType type) => type.ToString().ToLowerInvariant();
}
