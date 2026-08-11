using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;

namespace PortalClienchi.Web.PortalPdf;

/// <summary>
/// Parser de HTML de contenteditable / paste de Word-Docs.
/// Reconoce negrita, cursiva, subrayado, tachado, color, tamaño, alineación e hipervínculos.
/// </summary>
public static partial class PortalPdfHtmlParser
{
    private const float DefaultFontSize = 12f;

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

    private sealed class StyleState
    {
        public bool Italic;
        public bool Bold;
        public bool Underline;
        public bool Strike;
        public string Align = "left";
        public string? Color;
        public float? FontSize;
        public string? LinkUrl;

        public StyleState Clone() => new()
        {
            Italic = Italic,
            Bold = Bold,
            Underline = Underline,
            Strike = Strike,
            Align = Align,
            Color = Color,
            FontSize = FontSize,
            LinkUrl = LinkUrl,
        };
    }

    private static List<PortalPdfBlock> ParseHtml(string html)
    {
        var blocks = new List<PortalPdfBlock>();
        var stack = new Stack<StyleState>();
        stack.Push(new StyleState());

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
                var selfClosing = token.EndsWith("/>", StringComparison.Ordinal) || name is "br" or "hr" or "img";

                if (name is "script" or "style" or "meta" or "link" or "head" or "title")
                    continue;

                if (name == "br")
                {
                    blocks.Add(MakeBreak(stack.Peek()));
                    continue;
                }

                if (selfClosing)
                    continue;

                if (!closing)
                {
                    if (name is "p" or "div" or "li" or "h1" or "h2" or "h3" or "h4" or "h5" or "h6" or "blockquote" or "section" or "article" or "td" or "th")
                    {
                        if (blocks.Count > 0 && blocks[^1].Text != "\n")
                            blocks.Add(MakeBreak(stack.Peek()));

                        var next = stack.Peek().Clone();
                        ApplyBlockStyles(next, name, attrs);
                        stack.Push(next);
                        continue;
                    }

                    var inline = stack.Peek().Clone();
                    ApplyInlineStyles(inline, name, attrs);
                    stack.Push(inline);
                    continue;
                }

                // closing
                if (name is "p" or "div" or "li" or "h1" or "h2" or "h3" or "h4" or "h5" or "h6" or "blockquote" or "section" or "article" or "td" or "th")
                {
                    blocks.Add(MakeBreak(stack.Peek()));
                    if (stack.Count > 1)
                        stack.Pop();
                    continue;
                }

                if (stack.Count > 1)
                    stack.Pop();
                continue;
            }

            var text = WebUtility.HtmlDecode(token)
                .Replace('\u00A0', ' ')
                .Replace('\u200B', '\0')
                .Replace("\0", "", StringComparison.Ordinal);
            if (text.Length == 0)
                continue;

            // Ignorar whitespace puro entre bloques (salvo espacios simples dentro de línea).
            if (string.IsNullOrWhiteSpace(text) && text.Contains('\n', StringComparison.Ordinal))
            {
                foreach (var _ in text.Where(c => c == '\n'))
                    blocks.Add(MakeBreak(stack.Peek()));
                continue;
            }

            var st = stack.Peek();
            blocks.Add(new PortalPdfBlock
            {
                Text = text,
                Italic = st.Italic,
                Bold = st.Bold,
                Underline = st.Underline,
                Strike = st.Strike,
                Align = st.Align,
                Color = st.Color,
                FontSize = st.FontSize,
                LinkUrl = st.LinkUrl,
            });
        }

        return CollapseBlocks(blocks);
    }

    private static PortalPdfBlock MakeBreak(StyleState st) => new()
    {
        Text = "\n",
        Align = st.Align,
    };

    private static void ApplyBlockStyles(StyleState st, string name, string attrs)
    {
        st.Align = ResolveAlign(attrs, st.Align);
        ApplyCssStyles(st, attrs);

        if (name is "h1")
            st.FontSize = 22f;
        else if (name is "h2")
            st.FontSize = 18f;
        else if (name is "h3")
            st.FontSize = 15f;
        else if (name is "h4")
            st.FontSize = 13f;

        if (name is "h1" or "h2" or "h3" or "h4" or "h5" or "h6")
            st.Bold = true;
    }

    private static void ApplyInlineStyles(StyleState st, string name, string attrs)
    {
        if (name is "i" or "em") st.Italic = true;
        if (name is "b" or "strong") st.Bold = true;
        if (name == "u") st.Underline = true;
        if (name is "s" or "strike" or "del") st.Strike = true;
        if (name == "a")
        {
            var href = AttrValue(attrs, "href");
            if (!string.IsNullOrWhiteSpace(href) && IsSafeLink(href))
            {
                st.LinkUrl = href.Trim();
                st.Underline = true;
                st.Color ??= "#5B9BD5";
            }
        }

        if (name == "font")
        {
            var color = AttrValue(attrs, "color");
            if (!string.IsNullOrWhiteSpace(color))
                st.Color = NormalizeColor(color);

            var size = AttrValue(attrs, "size");
            if (int.TryParse(size, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n))
                st.FontSize = MapHtmlFontSize(n);
        }

        ApplyCssStyles(st, attrs);
    }

    private static void ApplyCssStyles(StyleState st, string attrs)
    {
        var style = AttrValue(attrs, "style");
        if (string.IsNullOrWhiteSpace(style))
            return;

        foreach (var part in style.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var idx = part.IndexOf(':');
            if (idx <= 0) continue;
            var key = part[..idx].Trim().ToLowerInvariant();
            var val = part[(idx + 1)..].Trim();

            switch (key)
            {
                case "text-align":
                    var a = val.ToLowerInvariant();
                    if (a is "left" or "center" or "right" or "justify")
                        st.Align = a;
                    break;
                case "color":
                    st.Color = NormalizeColor(val) ?? st.Color;
                    break;
                case "font-size":
                    st.FontSize = ParseFontSize(val) ?? st.FontSize;
                    break;
                case "font-weight":
                    if (IsBoldWeight(val)) st.Bold = true;
                    else if (val.Equals("normal", StringComparison.OrdinalIgnoreCase) || val == "400")
                        st.Bold = false;
                    break;
                case "font-style":
                    if (val.Contains("italic", StringComparison.OrdinalIgnoreCase)) st.Italic = true;
                    else if (val.Contains("oblique", StringComparison.OrdinalIgnoreCase)) st.Italic = true;
                    else if (val.Equals("normal", StringComparison.OrdinalIgnoreCase)) st.Italic = false;
                    break;
                case "text-decoration":
                case "text-decoration-line":
                    var lower = val.ToLowerInvariant();
                    if (lower.Contains("underline")) st.Underline = true;
                    if (lower.Contains("line-through")) st.Strike = true;
                    if (lower.Contains("none"))
                    {
                        st.Underline = false;
                        st.Strike = false;
                    }
                    break;
            }
        }
    }

    private static bool IsBoldWeight(string val)
    {
        if (val.Contains("bold", StringComparison.OrdinalIgnoreCase)) return true;
        if (int.TryParse(val, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n))
            return n >= 600;
        return false;
    }

    private static float MapHtmlFontSize(int n) => n switch
    {
        1 => 8f,
        2 => 10f,
        3 => 12f,
        4 => 14f,
        5 => 18f,
        6 => 24f,
        7 => 32f,
        _ => DefaultFontSize,
    };

    private static float? ParseFontSize(string raw)
    {
        var v = raw.Trim().ToLowerInvariant();
        if (v.EndsWith("px", StringComparison.Ordinal))
        {
            if (float.TryParse(v[..^2], NumberStyles.Float, CultureInfo.InvariantCulture, out var px))
                return Math.Clamp(px * 0.75f, 7f, 48f); // ~px to pt
        }
        if (v.EndsWith("pt", StringComparison.Ordinal))
        {
            if (float.TryParse(v[..^2], NumberStyles.Float, CultureInfo.InvariantCulture, out var pt))
                return Math.Clamp(pt, 7f, 48f);
        }
        if (v.EndsWith("em", StringComparison.Ordinal))
        {
            if (float.TryParse(v[..^2], NumberStyles.Float, CultureInfo.InvariantCulture, out var em))
                return Math.Clamp(em * DefaultFontSize, 7f, 48f);
        }
        if (v.EndsWith('%'))
        {
            if (float.TryParse(v.TrimEnd('%'), NumberStyles.Float, CultureInfo.InvariantCulture, out var pct))
                return Math.Clamp(DefaultFontSize * (pct / 100f), 7f, 48f);
        }
        if (float.TryParse(v, NumberStyles.Float, CultureInfo.InvariantCulture, out var bare))
            return Math.Clamp(bare, 7f, 48f);

        return v switch
        {
            "xx-small" => 8f,
            "x-small" => 9f,
            "small" => 10f,
            "medium" => 12f,
            "large" => 14f,
            "x-large" => 18f,
            "xx-large" => 24f,
            _ => null,
        };
    }

    /// <summary>Normaliza a #RRGGBB o null.</summary>
    public static string? NormalizeColor(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        var v = raw.Trim();
        if (v.StartsWith("rgb", StringComparison.OrdinalIgnoreCase))
        {
            var m = RgbRegex().Match(v);
            if (!m.Success) return null;
            var r = int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
            var g = int.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture);
            var b = int.Parse(m.Groups[3].Value, CultureInfo.InvariantCulture);
            return $"#{r:X2}{g:X2}{b:X2}";
        }

        if (v.StartsWith('#'))
        {
            var hex = v[1..];
            if (hex.Length == 3)
                hex = string.Concat(hex.Select(c => $"{c}{c}"));
            if (hex.Length == 6 && HexRegex().IsMatch(hex))
                return "#" + hex.ToUpperInvariant();
            if (hex.Length == 8 && HexRegex().IsMatch(hex[..6]))
                return "#" + hex[..6].ToUpperInvariant();
            return null;
        }

        return NamedColor(v);
    }

    private static string? NamedColor(string name) => name.ToLowerInvariant() switch
    {
        "black" => "#000000",
        "white" => "#FFFFFF",
        "red" => "#FF0000",
        "green" => "#008000",
        "blue" => "#0000FF",
        "yellow" => "#FFFF00",
        "orange" => "#FFA500",
        "purple" => "#800080",
        "gray" or "grey" => "#808080",
        "navy" => "#000080",
        "teal" => "#008080",
        "maroon" => "#800000",
        "silver" => "#C0C0C0",
        "lime" => "#00FF00",
        "aqua" or "cyan" => "#00FFFF",
        "fuchsia" or "magenta" => "#FF00FF",
        _ => null,
    };

    private static bool IsSafeLink(string href)
    {
        if (href.StartsWith('#') || href.StartsWith('/') || href.StartsWith("./", StringComparison.Ordinal))
            return true;
        if (!Uri.TryCreate(href, UriKind.Absolute, out var uri))
            return false;
        return uri.Scheme is "http" or "https" or "mailto";
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

            if (result.Count > 0)
            {
                var prev = result[^1];
                if (prev.Text != "\n"
                    && prev.Italic == b.Italic
                    && prev.Bold == b.Bold
                    && prev.Underline == b.Underline
                    && prev.Strike == b.Strike
                    && prev.Align == b.Align
                    && string.Equals(prev.Color, b.Color, StringComparison.OrdinalIgnoreCase)
                    && Nullable.Equals(prev.FontSize, b.FontSize)
                    && string.Equals(prev.LinkUrl, b.LinkUrl, StringComparison.Ordinal))
                {
                    result[^1] = new PortalPdfBlock
                    {
                        Text = prev.Text + b.Text,
                        Italic = prev.Italic,
                        Bold = prev.Bold,
                        Underline = prev.Underline,
                        Strike = prev.Strike,
                        Align = prev.Align,
                        Color = prev.Color,
                        FontSize = prev.FontSize,
                        LinkUrl = prev.LinkUrl,
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

    private static string? AttrValue(string attrs, string name)
    {
        var m = Regex.Match(
            attrs,
            $@"\b{Regex.Escape(name)}\s*=\s*(?:""([^""]*)""|'([^']*)'|([^\s>]+))",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        if (!m.Success) return null;
        return m.Groups[1].Success ? m.Groups[1].Value
            : m.Groups[2].Success ? m.Groups[2].Value
            : m.Groups[3].Value;
    }

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

    [GeneratedRegex(@"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex RgbRegex();

    [GeneratedRegex(@"^[0-9A-Fa-f]+$", RegexOptions.CultureInvariant)]
    private static partial Regex HexRegex();
}
