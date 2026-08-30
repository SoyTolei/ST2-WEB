namespace PortalClienchi.Web.Planillas;

public sealed record LegalReferralHubItem(string Id, string Label, string Icon, string? CatalogCategoryId = null);

public sealed record LegalReferralHubProduct(
    string Id,
    string Label,
    string Icon,
    string Layout,
    string CatalogProductId,
    IReadOnlyList<LegalReferralHubItem> Items);

public static class LegalReferralHubCatalog
{
    public static readonly LegalReferralHubProduct[] Products =
    [
        new(
            "firm",
            "Legal One",
            "briefcase",
            "cards",
            "legal-one",
            [
                new("bug", "Escalamiento a N2/N3", "bug", "sistema"),
            ]),
        new(
            "highq",
            "HighQ",
            "diagram",
            "cards",
            "highq",
            [
                new("bug-geral", "Escalamiento a N2/N3", "bug", "general"),
            ]),
        new(
            "westlaw",
            "Westlaw",
            "scale",
            "cards",
            "legal-one",
            [
                new("bug", "Escalamiento a N2/N3", "bug", "sistema"),
            ]),
        new(
            "cocounsel",
            "CoCounsel",
            "sparkles",
            "cards",
            "legal-one",
            [
                new("bug", "Escalamiento a N2/N3", "bug", "sistema"),
            ]),
    ];

    public static LegalReferralHubProduct? FindProduct(string? productId) =>
        Products.FirstOrDefault(p => string.Equals(p.Id, productId, StringComparison.OrdinalIgnoreCase));

    public static LegalReferralHubItem? FindItem(string? productId, string? itemId)
    {
        var product = FindProduct(productId);
        if (product is null || string.IsNullOrWhiteSpace(itemId))
            return null;

        return product.Items.FirstOrDefault(i => string.Equals(i.Id, itemId, StringComparison.OrdinalIgnoreCase));
    }
}
