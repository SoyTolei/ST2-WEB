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

            "accordion",

            "legal-one",

            [

                new("sistema", "Sistema", "gear", "sistema"),

                new("rto", "RTO/Proview", "shield", "rto-proview"),

                new("nfse", "NFSe", "file", "nfse"),

                new("mobile", "Mobile", "phone", "mobile"),

                new("datacloud", "Datacloud", "cloud", "datacloud"),

                new("performance", "Performance", "gauge", "performance"),

                new("entitlement", "Entitlement", "key", "entitlement"),

            ]),

        new(

            "analytics",

            "Legal One Analytics",

            "graph",

            "cards",

            "legal-one-analytics",

            [

                new("bug", "Bug", "bug", "general"),

                new("servicios", "Servicios", "gear", "general"),

            ]),

        new(

            "highq",

            "HighQ",

            "diagram",

            "cards",

            "highq",

            [

                new("bug-geral", "Bug General", "bug", "general"),

                new("bug-workflow", "Bug Workflow", "diagram", "general"),

                new("performance", "Performance", "gauge", "general"),

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

