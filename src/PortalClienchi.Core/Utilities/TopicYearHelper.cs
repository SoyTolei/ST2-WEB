using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using PortalClienchi.Core.Api;

namespace PortalClienchi.Core.Utilities;

public sealed class YearResolution
{
    public int? Year { get; set; }
    public DateTime? PublishedAt { get; set; }
    public int SortYear => TopicYearHelper.IsPlausibleYear(Year ?? PublishedAt?.Year) ? (Year ?? PublishedAt?.Year ?? 0) : 0;
    public string DateDisplay =>
        PublishedAt.HasValue ? PublishedAt.Value.ToString("dd/MM/yyyy") :
        Year.HasValue ? Year.Value.ToString() : "—";
}

public static class TopicYearHelper
{
    private static readonly Regex YearRegex = new(@"\b(20\d{2})\b", RegexOptions.Compiled);
    private static readonly Regex DateRegex = new(
        @"\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b|\b(20\d{2})[/-](\d{1,2})[/-](\d{1,2})\b",
        RegexOptions.Compiled);

    private static readonly string[] MonthNames =
    [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ];

    private static readonly string[] DateFieldNames =
    [
        "updated_at", "created_at", "published_at", "publish_date",
        "publication_date", "date", "release_date", "valid_from", "valid_until",
    ];

    public const int MinPlausibleYear = 1995;

    public static int MaxPlausibleYear => DateTime.Now.Year + 1;

    public static bool IsPlausibleYear(int year) =>
        year >= MinPlausibleYear && year <= MaxPlausibleYear;

    public static bool IsPlausibleYear(int? year) =>
        year.HasValue && IsPlausibleYear(year.Value);

    public static bool IsPlausibleDate(DateTime? date)
    {
        if (!date.HasValue)
            return false;
        if (!IsPlausibleYear(date.Value.Year))
            return false;
        return date.Value.Date <= DateTime.Today.AddMonths(2);
    }

    public static YearResolution Sanitize(YearResolution resolution)
    {
        if (resolution.PublishedAt.HasValue && !IsPlausibleDate(resolution.PublishedAt))
            resolution.PublishedAt = null;
        if (resolution.Year.HasValue && !IsPlausibleYear(resolution.Year))
            resolution.Year = null;
        return resolution;
    }

    public static YearResolution Resolve(string? title, JsonElement? listItem = null, string? htmlOrText = null)
    {
        var resolution = new YearResolution();

        if (listItem.HasValue)
        {
            resolution.PublishedAt = FindDateInElement(listItem.Value);
            if (resolution.PublishedAt.HasValue)
                resolution.Year = resolution.PublishedAt.Value.Year;
        }

        if (!resolution.Year.HasValue)
            resolution.Year = ExtractYearFromTitle(title);

        if (!resolution.PublishedAt.HasValue && !string.IsNullOrWhiteSpace(htmlOrText))
        {
            resolution.PublishedAt = ExtractDateFromText(htmlOrText);
            if (!resolution.Year.HasValue && resolution.PublishedAt.HasValue)
                resolution.Year = resolution.PublishedAt.Value.Year;
        }

        if (!resolution.Year.HasValue && !string.IsNullOrWhiteSpace(htmlOrText))
            resolution.Year = ExtractYearFromText(htmlOrText);

        if (!resolution.Year.HasValue && listItem.HasValue)
        {
            var extra = ExtractYearFromText(JsonSerializer.Serialize(listItem.Value));
            resolution.Year = extra;
        }

        return Sanitize(resolution);
    }

    public static DateTime? FindDateInElement(JsonElement el)
    {
        foreach (var field in DateFieldNames)
        {
            if (!el.TryGetProperty(field, out var prop))
                continue;
            var dt = ParseDateValue(prop);
            if (IsPlausibleDate(dt))
                return dt;
        }

        return null;
    }

    private static DateTime? ParseDateValue(JsonElement prop)
    {
        if (prop.ValueKind == JsonValueKind.String)
            return ParseDateString(prop.GetString());
        return null;
    }

    private static DateTime? ParseDateString(string? s)
    {
        if (string.IsNullOrWhiteSpace(s))
            return null;
        if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var dt) && IsPlausibleDate(dt))
            return dt;
        if (DateTime.TryParse(s, new CultureInfo("es-AR"), DateTimeStyles.None, out dt) && IsPlausibleDate(dt))
            return dt;
        return null;
    }

    public static int? ExtractYearFromTitle(string? title) =>
        PickBestPlausibleYear(ExtractYearsFromMatches(title));

    public static int? ExtractYearFromText(string? text) =>
        PickBestPlausibleYear(ExtractYearsFromMatches(text));

    private static IEnumerable<int> ExtractYearsFromMatches(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            yield break;
        foreach (Match m in YearRegex.Matches(text))
        {
            if (int.TryParse(m.Groups[1].Value, out var y))
                yield return y;
        }
    }

    /// <summary>Año más reciente plausible (evita 2050 u otros errores de carga).</summary>
    private static int? PickBestPlausibleYear(IEnumerable<int> years)
    {
        var plausible = years.Where(IsPlausibleYear).ToList();
        return plausible.Count == 0 ? null : plausible.Max();
    }

    public static DateTime? ExtractDateFromText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;

        foreach (Match m in DateRegex.Matches(text))
        {
            if (m.Groups[3].Success &&
                int.TryParse(m.Groups[1].Value, out var d) &&
                int.TryParse(m.Groups[2].Value, out var mo) &&
                int.TryParse(m.Groups[3].Value, out var y))
            {
                try
                {
                    var dt = new DateTime(y, mo, d);
                    if (IsPlausibleDate(dt))
                        return dt;
                }
                catch { }
            }
            if (m.Groups[4].Success &&
                int.TryParse(m.Groups[4].Value, out var y2) &&
                int.TryParse(m.Groups[5].Value, out var mo2) &&
                int.TryParse(m.Groups[6].Value, out var d2))
            {
                try
                {
                    var dt = new DateTime(y2, mo2, d2);
                    if (IsPlausibleDate(dt))
                        return dt;
                }
                catch { }
            }
        }

        if (DateTime.TryParse(text, new CultureInfo("es-AR"), DateTimeStyles.None, out var parsed) && IsPlausibleDate(parsed))
            return parsed;

        return null;
    }

    public static int? ExtractYearFromHtml(string? html) =>
        ExtractYearFromText(HtmlTextHelper.ToPlainText(html));

    public static string NormalizeTopicKey(string title)
    {
        var t = TextNormalizer.RemoveDiacritics(title).ToLowerInvariant();
        t = YearRegex.Replace(t, " ");
        foreach (var month in MonthNames)
            t = Regex.Replace(t, $@"\b{month}\b", " ", RegexOptions.IgnoreCase);
        t = Regex.Replace(t, @"[^\w\s]", " ");
        t = Regex.Replace(t, @"\s+", " ").Trim();
        return t.Length < 8 ? title.ToLowerInvariant() : t;
    }

    public static string BuildGroupTitle(string title)
    {
        var t = title.Trim();
        t = YearRegex.Replace(t, "").Trim();
        t = Regex.Replace(t, @"\s+", " ");
        return string.IsNullOrWhiteSpace(t) ? title : t;
    }

    public static string FormatYearsLabel(IEnumerable<int?> years)
    {
        var list = years.Where(IsPlausibleYear).Select(y => y!.Value).Distinct().OrderByDescending(y => y).ToList();
        return list.Count == 0 ? "sin fecha" : string.Join(", ", list);
    }

    public static int GetDefaultFilterYear(IEnumerable<int> yearsInResults)
    {
        var current = DateTime.Now.Year;
        var list = yearsInResults.Where(y => IsPlausibleYear(y)).ToList();
        if (list.Contains(current))
            return current;
        return list.Count > 0 ? list.Max() : current;
    }
}
