using System.Net;
using System.Text.RegularExpressions;

namespace PortalClienchi.Web.PortalPdf;

/// <summary>
/// Parser liviano de HTML de contenteditable (sin dependencias extra).
/// Reconoce p/div/br, i/em, b/strong, u y text-align.
/// </summary>
public static partial class PortalPdfHtmlParser
{
    public static IReadOnlyList<PortalPdfBlock> Parse(string? html, string? plainFallback)
    {
        if (!string.IsNullOrWhiteSpace(html))
        {
            var blocks = ParseHtml(html);
            if (blocks.Count > 0)
                return blocks;
        }

        if (string.IsNullOrWhiteSpace(plainFallback))
            return Array.Empty<PortalPdfBlock>();

        return plainFallback
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Split('\n')
            .Select(line => new PortalPdfBlock { Text = line.TrimEnd() })
            .ToList();
    }

    private static List<PortalPdfBlock> ParseHtml(string html)
    {
        var blocks = new List<PortalPdfBlock>();
        var italic = false;
        var bold = false;
        var underline = false;
        var align = "left";
        var alignStack = new Stack<string>();
        alignStack.Push("left");

        foreach (Match m in TokenRegex().Matches(html))
        {
            var token = m.Value;
            if (token.StartsWith('<'))
            {
                var tagMatch = TagRegex().Match(token);
                if (!tagMatch.Success)
                    continue;

                var closing = tagMatch.Groups["close"].Success;
                var name = tagMatch.Groups["name"].Value.ToLowerInvariant();
                var attrs = tagMatch.Groups["attrs"].Value;

                if (name is "script" or "style")
                    continue;

                if (name == "br")
                {
                    blocks.Add(new PortalPdfBlock { Text = "\n", Align = align });
                    continue;
                }

                if (!closing && name is "p" or "div" or "li" or "h1" or "h2" or "h3" or "h4")
                {
                    if (blocks.Count > 0 && blocks[^1].Text != "\n")
                        blocks.Add(new PortalPdfBlock { Text = "\n", Align = align });
                    align = ResolveAlign(attrs, alignStack.Peek());
                    alignStack.Push(align);
                    continue;
                }

                if (closing && name is "p" or "div" or "li" or "h1" or "h2" or "h3" or "h4")
                {
                    blocks.Add(new PortalPdfBlock { Text = "\n", Align = align });
                    if (alignStack.Count > 1)
                        alignStack.Pop();
                    align = alignStack.Peek();
                    continue;
                }

                if (!closing)
                {
                    if (name is "i" or "em") italic = true;
                    else if (name is "b" or "strong") bold = true;
                    else if (name == "u") underline = true;
                }
                else
                {
                    if (name is "i" or "em") italic = false;
                    else if (name is "b" or "strong") bold = false;
                    else if (name == "u") underline = false;
                }

                continue;
            }

            var text = WebUtility.HtmlDecode(token).Replace('\u00A0', ' ');
            if (text.Length == 0)
                continue;

            blocks.Add(new PortalPdfBlock
            {
                Text = text,
                Italic = italic,
                Bold = bold,
                Underline = underline,
                Align = align,
            });
        }

        return CollapseBlocks(blocks);
    }

    private static List<PortalPdfBlock> CollapseBlocks(List<PortalPdfBlock> blocks)
    {
        var result = new List<PortalPdfBlock>();
        foreach (var b in blocks)
        {
            if (b.Text == "\n")
            {
                if (result.Count == 0) continue;
                if (result[^1].Text == "\n") continue;
                result.Add(b);
                continue;
            }

            // Fusionar runs consecutivos con el mismo estilo.
            if (result.Count > 0)
            {
                var prev = result[^1];
                if (prev.Text != "\n"
                    && prev.Italic == b.Italic
                    && prev.Bold == b.Bold
                    && prev.Underline == b.Underline
                    && prev.Align == b.Align)
                {
                    result[^1] = new PortalPdfBlock
                    {
                        Text = prev.Text + b.Text,
                        Italic = prev.Italic,
                        Bold = prev.Bold,
                        Underline = prev.Underline,
                        Align = prev.Align,
                    };
                    continue;
                }
            }

            result.Add(b);
        }

        while (result.Count > 0 && result[^1].Text == "\n")
            result.RemoveAt(result.Count - 1);

        return result;
    }

    private static string ResolveAlign(string attrs, string fallback)
    {
        var styleMatch = StyleAlignRegex().Match(attrs);
        if (styleMatch.Success)
        {
            var v = styleMatch.Groups[1].Value.Trim().ToLowerInvariant();
            if (v is "left" or "center" or "right" or "justify")
                return v;
        }

        var alignMatch = AttrAlignRegex().Match(attrs);
        if (alignMatch.Success)
        {
            var v = alignMatch.Groups[1].Value.Trim().ToLowerInvariant();
            if (v is "left" or "center" or "right" or "justify")
                return v;
        }

        return fallback;
    }

    /// <summary>
    /// Extrae marca desde un .txt:
    /// - línea "MARCA=BEJERMAN" / "BRAND=..."
    /// - o primera línea "# BEJERMAN"
    /// El resto es cuerpo.
    /// </summary>
    public static (string Brand, string Body) ParseTxtPayload(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return ("", "");

        var lines = raw.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n');
        var brand = "";
        var bodyStart = 0;

        for (var i = 0; i < Math.Min(lines.Length, 5); i++)
        {
            var line = lines[i].Trim();
            if (line.Length == 0) continue;

            var kv = BrandLineRegex().Match(line);
            if (kv.Success)
            {
                brand = kv.Groups[1].Value.Trim();
                bodyStart = i + 1;
                break;
            }

            if (line.StartsWith('#'))
            {
                brand = line.TrimStart('#').Trim();
                bodyStart = i + 1;
                break;
            }

            break;
        }

        var body = string.Join('\n', lines.Skip(bodyStart)).Trim();
        return (brand, body);
    }

    [GeneratedRegex(@"<[^>]+>|[^<]+", RegexOptions.CultureInvariant)]
    private static partial Regex TokenRegex();

    [GeneratedRegex(@"^<(?<close>/)?(?<name>[a-zA-Z0-9]+)(?<attrs>[^>]*)/?>$", RegexOptions.CultureInvariant)]
    private static partial Regex TagRegex();

    [GeneratedRegex(@"text-align\s*:\s*([a-z]+)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex StyleAlignRegex();

    [GeneratedRegex(@"\balign\s*=\s*[""']?([a-z]+)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex AttrAlignRegex();

    [GeneratedRegex(@"^(?:MARCA|BRAND|LOGO)\s*[:=]\s*(.+)$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex BrandLineRegex();
}
