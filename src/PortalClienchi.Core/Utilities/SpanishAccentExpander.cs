using System.Text.RegularExpressions;

namespace PortalClienchi.Core.Utilities;

/// <summary>
/// Genera variantes con tildes probables cuando el usuario escribe sin acentos.
/// El API del portal distingue tildes (ej. facturacion ≠ facturación).
/// </summary>
public static class SpanishAccentExpander
{
    private static readonly (string From, string To)[] Rules =
    [
        ("eccion", "ección"),
        ("uccion", "ucción"),
        ("ccion", "cción"),
        ("acion", "ación"),
        ("icion", "ición"),
        ("ucion", "ución"),
        ("sion", "sión"),
        ("cion", "ción"),
        ("logia", "logía"),
        ("logico", "lógico"),
        ("logica", "lógica"),
        ("onica", "ónica"),
        ("onico", "ónico"),
        ("atico", "ático"),
        ("atica", "ática"),
    ];

    public static IEnumerable<string> Expand(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            yield break;

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var v in ExpandToken(text))
        {
            if (seen.Add(v))
                yield return v;
        }

        foreach (var word in Regex.Split(text, @"\s+").Where(w => w.Length >= 2))
        {
            foreach (var v in ExpandToken(word))
            {
                if (seen.Add(v))
                    yield return v;
            }
        }
    }

    private static IEnumerable<string> ExpandToken(string text)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (seen.Add(text))
            yield return text;

        var stripped = TextNormalizer.RemoveDiacritics(text);
        if (!string.Equals(text, stripped, StringComparison.OrdinalIgnoreCase) && seen.Add(stripped))
            yield return stripped;

        if (HasAccent(text))
            yield break;

        foreach (var (from, to) in Rules)
        {
            var variant = ApplyRule(text, from, to);
            if (variant is not null && seen.Add(variant))
                yield return variant;
        }
    }

    private static string? ApplyRule(string word, string from, string to)
    {
        var lower = word.ToLowerInvariant();
        var idx = lower.IndexOf(from, StringComparison.Ordinal);
        if (idx < 0)
            return null;
        return word[..idx] + to + word[(idx + from.Length)..];
    }

    private static bool HasAccent(string text) =>
        text.Any(c => c is 'á' or 'é' or 'í' or 'ó' or 'ú' or 'Á' or 'É' or 'Í' or 'Ó' or 'Ú' or 'ñ' or 'Ñ');
}
