using HtmlAgilityPack;

namespace PortalClienchi.Core.Utilities;

public static class HtmlTextHelper
{
    public static string ToPlainText(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
            return "";

        var doc = new HtmlDocument();
        doc.LoadHtml(html);
        var text = doc.DocumentNode.InnerText;
        return System.Net.WebUtility.HtmlDecode(text)
            .Replace("\r", "")
            .Replace("\n\n\n", "\n\n")
            .Trim();
    }

    public static string Snippet(string? plain, int maxLen = 220)
    {
        if (string.IsNullOrWhiteSpace(plain))
            return "";

        var oneLine = string.Join(" ", plain.Split(['\n', '\r'], StringSplitOptions.RemoveEmptyEntries));
        if (oneLine.Length <= maxLen)
            return oneLine;
        return oneLine[..maxLen].TrimEnd() + "…";
    }
}
