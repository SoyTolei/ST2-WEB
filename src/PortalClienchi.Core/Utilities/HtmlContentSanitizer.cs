using HtmlAgilityPack;

namespace PortalClienchi.Core.Utilities;

public static class HtmlContentSanitizer
{
    public static string ForPreview(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
            return "";

        var doc = new HtmlDocument();
        doc.LoadHtml(html);

        doc.DocumentNode.SelectSingleNode("//h1|//h2")?.Remove();

        foreach (var node in doc.DocumentNode.Descendants().ToList())
        {
            if (node.Name is "script" or "style" or "iframe" or "object" or "embed")
            {
                node.Remove();
                continue;
            }

            if (node.Attributes["style"] != null)
                node.Attributes["style"].Remove();

            node.Attributes.Remove("bgcolor");
            node.Attributes.Remove("background");
            node.Attributes.Remove("color");
        }

        return doc.DocumentNode.InnerHtml;
    }
}
