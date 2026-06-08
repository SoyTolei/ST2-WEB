using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace PortalClienchi.Core.Utilities;

public static class TextNormalizer
{
    public static string RemoveDiacritics(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return "";

        var normalized = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    public static string NormalizeForSearch(string text) =>
        RemoveDiacritics(text).ToLowerInvariant().Trim();

    /// <summary>
    /// Variantes para consultar el API: sin/con tildes, expansiones españolas y prefijos.
    /// </summary>
    public static IReadOnlyList<string> GetSearchVariants(string query, int maxVariants = 10)
    {
        var q = query.Trim();
        if (q.Length < 2)
            return [];

        var variants = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void Add(string? s, bool highPriority = false)
        {
            if (string.IsNullOrWhiteSpace(s))
                return;
            s = s.Trim();
            if (s.Length < 2 || !seen.Add(s))
                return;
            if (highPriority)
                variants.Insert(0, s);
            else
                variants.Add(s);
        }

        Add(q, highPriority: true);
        Add(RemoveDiacritics(q), highPriority: true);

        foreach (var expanded in SpanishAccentExpander.Expand(q))
            Add(expanded, highPriority: true);

        foreach (var word in Regex.Split(q, @"\s+").Where(w => w.Length >= 3))
        {
            Add(word);
            Add(RemoveDiacritics(word));
            foreach (var expanded in SpanishAccentExpander.Expand(word))
                Add(expanded);

            if (word.Length >= 5)
            {
                var prefix = RemoveDiacritics(word)[..Math.Min(7, word.Length)];
                Add(prefix);
            }
        }

        return variants.Take(maxVariants).ToList();
    }

    public static bool MatchesLoose(string? haystack, string query)
    {
        if (string.IsNullOrWhiteSpace(haystack) || string.IsNullOrWhiteSpace(query))
            return false;

        var h = NormalizeForSearch(haystack);
        var words = NormalizeForSearch(query)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length >= 2)
            .ToList();

        if (words.Count == 0)
            return false;

        return words.All(w => WordMatches(h, w));
    }

    private static bool WordMatches(string normalizedHaystack, string word)
    {
        if (normalizedHaystack.Contains(word, StringComparison.Ordinal))
            return true;

        if (word.Length < 3)
            return false;

        foreach (var token in normalizedHaystack.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            if (token.Contains(word, StringComparison.Ordinal) || word.Contains(token, StringComparison.Ordinal))
                return true;
            if (token.StartsWith(word, StringComparison.Ordinal) || word.StartsWith(token, StringComparison.Ordinal))
                return true;
        }

        return false;
    }

    public static bool MatchesAnyField(string? title, string? snippet, string? product, string query) =>
        MatchesLoose(title, query) || MatchesLoose(snippet, query) || MatchesLoose(product, query);
}
