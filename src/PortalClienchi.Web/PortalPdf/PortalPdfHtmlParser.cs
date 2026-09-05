using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;

namespace PortalClienchi.Web.PortalPdf;

/// <summary>
/// Parser de HTML enriquecido para el generador de PDF corporativo de Thomson Reuters.
/// Reconoce párrafos, títulos (h1, h2, h3), tablas completas (table, tr, th, td),
/// separadores (hr), imágenes (img data-uri/base64), listas y estilos inline (negrita, cursiva, color, etc.).
/// </summary>
public static partial class PortalPdfHtmlParser
{
    private const float DefaultFontSize = 10.5f;

    public static IReadOnlyList<PortalPdfElement> Parse(string? html, string? plainFallback)
    {
        if (!string.IsNullOrWhiteSpace(html))
        {
            var elements = ParseHtmlElements(html);
            if (elements.Count > 0)
                return elements;
        }

        if (string.IsNullOrWhiteSpace(plainFallback))
            return Array.Empty<PortalPdfElement>();

        var fallbackElements = new List<PortalPdfElement>();
        var lines = plainFallback
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Split('\n');

        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            if (trimmed == "---" || trimmed == "___")
            {
                fallbackElements.Add(new PortalPdfHrElement());
                continue;
            }

            var isBullet = trimmed.StartsWith("• ") || trimmed.StartsWith("- ");
            var text = isBullet ? trimmed[2..] : trimmed;

            fallbackElements.Add(new PortalPdfParagraphElement
            {
                Runs = new List<PortalPdfBlock>
                {
                    new() { Text = text, FontSize = DefaultFontSize }
                },
                IsListItem = isBullet,
                Align = "left"
            });
        }

        return fallbackElements;
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
        public int HeadingLevel;
        public bool IsListItem;

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
            HeadingLevel = HeadingLevel,
            IsListItem = IsListItem,
        };
    }

    private static List<PortalPdfElement> ParseHtmlElements(string html)
    {
        var elements = new List<PortalPdfElement>();
        var currentParaRuns = new List<PortalPdfBlock>();
        var currentParaAlign = "left";
        var currentParaHeading = 0;
        var currentParaIsList = false;

        void FlushParagraph()
        {
            var collapsed = CollapseBlocks(currentParaRuns);
            if (collapsed.Count > 0)
            {
                elements.Add(new PortalPdfParagraphElement
                {
                    Runs = collapsed,
                    Align = currentParaAlign,
                    HeadingLevel = currentParaHeading,
                    IsListItem = currentParaIsList,
                });
            }
            currentParaRuns.Clear();
            currentParaAlign = "left";
            currentParaHeading = 0;
            currentParaIsList = false;
        }

        var stack = new Stack<StyleState>();
        stack.Push(new StyleState());

        // Manejo de tabla
        PortalPdfTableElement? activeTable = null;
        List<PortalPdfTableCell>? activeRow = null;
        PortalPdfTableCell? activeCell = null;
        List<PortalPdfBlock>? activeCellRuns = null;

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

                // --- TABLA ---
                if (name == "table")
                {
                    if (!closing)
                    {
                        FlushParagraph();
                        activeTable = new PortalPdfTableElement();
                    }
                    else
                    {
                        if (activeTable != null && activeTable.Rows.Count > 0)
                            elements.Add(activeTable);
                        activeTable = null;
                        activeRow = null;
                        activeCell = null;
                        activeCellRuns = null;
                    }
                    continue;
                }

                if (name == "tr")
                {
                    if (!closing)
                    {
                        activeRow = new List<PortalPdfTableCell>();
                    }
                    else
                    {
                        if (activeTable != null && activeRow != null && activeRow.Count > 0)
                            activeTable.Rows.Add(activeRow);
                        activeRow = null;
                    }
                    continue;
                }

                if (name is "th" or "td")
                {
                    if (!closing)
                    {
                        activeCell = new PortalPdfTableCell
                        {
                            IsHeader = name == "th",
                            Align = ResolveAlign(attrs, "left")
                        };
                        activeCellRuns = new List<PortalPdfBlock>();
                        var next = stack.Peek().Clone();
                        ApplyBlockStyles(next, name, attrs);
                        if (name == "th") next.Bold = true;
                        stack.Push(next);
                    }
                    else
                    {
                        if (activeRow != null && activeCell != null && activeCellRuns != null)
                        {
                            activeCell.Content = CollapseBlocks(activeCellRuns);
                            activeRow.Add(activeCell);
                        }
                        activeCell = null;
                        activeCellRuns = null;
                        if (stack.Count > 1) stack.Pop();
                    }
                    continue;
                }

                // --- HR ---
                if (name == "hr")
                {
                    FlushParagraph();
                    elements.Add(new PortalPdfHrElement());
                    continue;
                }

                // --- IMG ---
                if (name == "img")
                {
                    var src = AttrValue(attrs, "src") ?? "";
                    if (src.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
                    {
                        var commaIdx = src.IndexOf(',');
                        if (commaIdx > 0)
                        {
                            try
                            {
                                var base64 = src[(commaIdx + 1)..].Trim();
                                var bytes = Convert.FromBase64String(base64);
                                if (bytes.Length > 0)
                                {
                                    FlushParagraph();
                                    elements.Add(new PortalPdfImageElement { ImageBytes = bytes });
                                }
                            }
                            catch { /* ignore malformed base64 */ }
                        }
                    }
                    continue;
                }

                // --- BR ---
                if (name == "br")
                {
                    var st = stack.Peek();
                    if (activeCellRuns != null)
                        activeCellRuns.Add(new PortalPdfBlock { Text = "\n", Align = st.Align });
                    else
                        currentParaRuns.Add(new PortalPdfBlock { Text = "\n", Align = st.Align });
                    continue;
                }

                if (selfClosing)
                    continue;

                // --- APERTURA DE BLOQUE / INLINE ---
                if (!closing)
                {
                    if (name is "p" or "div" or "li" or "h1" or "h2" or "h3" or "h4" or "h5" or "h6" or "blockquote" or "section" or "article")
                    {
                        if (activeCellRuns == null)
                        {
                            FlushParagraph();
                        }
                        else
                        {
                            if (activeCellRuns.Count > 0 && activeCellRuns[^1].Text != "\n")
                                activeCellRuns.Add(new PortalPdfBlock { Text = "\n", Align = stack.Peek().Align });
                        }

                        var next = stack.Peek().Clone();
                        ApplyBlockStyles(next, name, attrs);
                        stack.Push(next);

                        if (activeCellRuns == null)
                        {
                            currentParaAlign = next.Align;
                            currentParaHeading = next.HeadingLevel;
                            currentParaIsList = next.IsListItem;
                        }
                        continue;
                    }

                    var inline = stack.Peek().Clone();
                    ApplyInlineStyles(inline, name, attrs);
                    stack.Push(inline);
                    continue;
                }

                // --- CIERRE DE BLOQUE / INLINE ---
                if (name is "p" or "div" or "li" or "h1" or "h2" or "h3" or "h4" or "h5" or "h6" or "blockquote" or "section" or "article")
                {
                    if (activeCellRuns == null)
                    {
                        FlushParagraph();
                    }
                    if (stack.Count > 1)
                        stack.Pop();
                    continue;
                }

                if (stack.Count > 1)
                    stack.Pop();
                continue;
            }

            // --- TEXTO ---
            var text = WebUtility.HtmlDecode(token)
                .Replace('\u00A0', ' ')
                .Replace('\u200B', '\0')
                .Replace("\0", "", StringComparison.Ordinal);
            if (text.Length == 0)
                continue;

            var currentStyle = stack.Peek();
            var block = new PortalPdfBlock
            {
                Text = text,
                Italic = currentStyle.Italic,
                Bold = currentStyle.Bold,
                Underline = currentStyle.Underline,
                Strike = currentStyle.Strike,
                Align = currentStyle.Align,
                Color = currentStyle.Color,
                FontSize = currentStyle.FontSize ?? DefaultFontSize,
                LinkUrl = currentStyle.LinkUrl,
            };

            if (activeCellRuns != null)
            {
                activeCellRuns.Add(block);
            }
            else
            {
                currentParaRuns.Add(block);
                if (currentStyle.HeadingLevel > 0)
                    currentParaHeading = currentStyle.HeadingLevel;
                if (currentStyle.IsListItem)
                    currentParaIsList = true;
                if (currentStyle.Align != "left")
                    currentParaAlign = currentStyle.Align;
            }
        }

        FlushParagraph();
        return elements;
    }

    private static void ApplyBlockStyles(StyleState st, string name, string attrs)
    {
        st.Align = ResolveAlign(attrs, st.Align);
        ApplyCssStyles(st, attrs);

        if (name == "h1")
        {
            st.FontSize = 18f;
            st.Bold = true;
            st.HeadingLevel = 1;
            st.Color ??= "#E05A10"; // Thomson Reuters corporate orange
            st.Align = "left";      // Nunca justificar títulos
        }
        else if (name == "h2")
        {
            st.FontSize = 15f;
            st.Bold = true;
            st.HeadingLevel = 2;
            st.Color ??= "#E05A10";
            st.Align = "left";
        }
        else if (name == "h3")
        {
            st.FontSize = 12.5f;
            st.Bold = true;
            st.HeadingLevel = 3;
            st.Color ??= "#1E293B";
            st.Align = "left";
        }
        else if (name is "h4" or "h5" or "h6")
        {
            st.FontSize = 11.5f;
            st.Bold = true;
            st.HeadingLevel = 3;
            st.Align = "left";
        }

        if (name == "li")
        {
            st.IsListItem = true;
        }
    }

    private static void ApplyInlineStyles(StyleState st, string name, string attrs)
    {
        ApplyCssStyles(st, attrs);

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
                st.Color ??= "#0284C7"; // Corporate blue
            }
        }

        if (name == "font")
        {
            var color = AttrValue(attrs, "color");
            if (!string.IsNullOrWhiteSpace(color))
                st.Color = NormalizeColor(color) ?? st.Color;

            var size = AttrValue(attrs, "size");
            if (int.TryParse(size, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n))
                st.FontSize = MapHtmlFontSize(n);
        }
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
        var v = val.ToLowerInvariant();
        if (v is "bold" or "bolder") return true;
        if (int.TryParse(v, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n))
            return n >= 600;
        return false;
    }

    private static float MapHtmlFontSize(int n) => n switch
    {
        1 => 8f,
        2 => 9.5f,
        3 => DefaultFontSize,
        4 => 12.5f,
        5 => 15f,
        6 => 18f,
        7 => 24f,
        _ => DefaultFontSize,
    };

    private static float? ParseFontSize(string raw)
    {
        var v = raw.Trim().ToLowerInvariant();
        if (v.EndsWith("px", StringComparison.Ordinal))
        {
            if (float.TryParse(v[..^2], NumberStyles.Float, CultureInfo.InvariantCulture, out var px))
                return Math.Clamp(px * 0.75f, 7f, 36f);
        }
        if (v.EndsWith("pt", StringComparison.Ordinal))
        {
            if (float.TryParse(v[..^2], NumberStyles.Float, CultureInfo.InvariantCulture, out var pt))
                return Math.Clamp(pt, 7f, 36f);
        }
        if (v.EndsWith("em", StringComparison.Ordinal))
        {
            if (float.TryParse(v[..^2], NumberStyles.Float, CultureInfo.InvariantCulture, out var em))
                return Math.Clamp(em * DefaultFontSize, 7f, 36f);
        }
        if (v.EndsWith('%'))
        {
            if (float.TryParse(v.TrimEnd('%'), NumberStyles.Float, CultureInfo.InvariantCulture, out var pct))
                return Math.Clamp(DefaultFontSize * (pct / 100f), 7f, 36f);
        }
        if (float.TryParse(v, NumberStyles.Float, CultureInfo.InvariantCulture, out var bare))
            return Math.Clamp(bare, 7f, 36f);

        return v switch
        {
            "xx-small" => 7.5f,
            "x-small" => 8.5f,
            "small" => 9.5f,
            "medium" => DefaultFontSize,
            "large" => 13f,
            "x-large" => 16f,
            "xx-large" => 20f,
            _ => null,
        };
    }

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
        "red" => "#DC2626",
        "green" => "#16A34A",
        "blue" => "#0284C7",
        "yellow" => "#CA8A04",
        "orange" => "#E05A10",
        "purple" => "#9333EA",
        "gray" or "grey" => "#6B7280",
        "navy" => "#1E3A8A",
        "teal" => "#0D9488",
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

    private static List<PortalPdfBlock> CollapseBlocks(List<PortalPdfBlock> input)
    {
        if (input.Count == 0) return input;

        var result = new List<PortalPdfBlock>(input.Count);
        foreach (var b in input)
        {
            if (b.Text.Length == 0) continue;

            if (result.Count > 0)
            {
                var prev = result[^1];
                if (prev.Text == "\n" && b.Text == "\n")
                {
                    result.Add(b);
                    continue;
                }

                if (prev.Text != "\n" && b.Text != "\n" &&
                    prev.Bold == b.Bold &&
                    prev.Italic == b.Italic &&
                    prev.Underline == b.Underline &&
                    prev.Strike == b.Strike &&
                    prev.Align == b.Align &&
                    string.Equals(prev.Color, b.Color, StringComparison.OrdinalIgnoreCase) &&
                    Nullable.Equals(prev.FontSize, b.FontSize) &&
                    string.Equals(prev.LinkUrl, b.LinkUrl, StringComparison.Ordinal))
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

    [GeneratedRegex(@"^\s*rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex RgbRegex();

    [GeneratedRegex(@"^[0-9a-fA-F]{6}$", RegexOptions.CultureInvariant)]
    private static partial Regex HexRegex();

    [GeneratedRegex(@"(<[^>]+>|[^<]+)", RegexOptions.CultureInvariant)]
    private static partial Regex TokenRegex();

    [GeneratedRegex(@"^<\s*(?<close>/)?\s*(?<name>[a-zA-Z0-9]+)(?<attrs>[^>]*)>", RegexOptions.CultureInvariant | RegexOptions.Singleline)]
    private static partial Regex TagRegex();

    [GeneratedRegex(@"text-align\s*:\s*(left|center|right|justify)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex StyleAlignRegex();

    [GeneratedRegex(@"\balign\s*=\s*[""']?(left|center|right|justify)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex AttrAlignRegex();
}
