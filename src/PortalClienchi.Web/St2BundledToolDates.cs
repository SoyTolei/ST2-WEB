using System.Globalization;
using System.Text.Json;

namespace PortalClienchi.Web;

public static class St2BundledToolDates
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public static string FormatAr(DateTime utc)
    {
        var instant = utc.Kind switch
        {
            DateTimeKind.Utc => utc,
            DateTimeKind.Local => utc.ToUniversalTime(),
            _ => DateTime.SpecifyKind(utc, DateTimeKind.Utc),
        };
        var tz = ResolveArgentinaTz();
        var local = TimeZoneInfo.ConvertTimeFromUtc(instant, tz);
        return local.ToString("d 'de' MMMM yyyy, HH:mm", new CultureInfo("es-AR"));
    }

    public static Dictionary<string, ToolPublishInfo> Load(IWebHostEnvironment env)
    {
        var map = new Dictionary<string, ToolPublishInfo>(StringComparer.OrdinalIgnoreCase);
        foreach (var path in CandidatePublishedPaths(env))
        {
            if (!File.Exists(path)) continue;
            try
            {
                var json = File.ReadAllText(path);
                var raw = JsonSerializer.Deserialize<Dictionary<string, string>>(json, JsonOpts);
                if (raw is null) continue;
                foreach (var (id, value) in raw)
                {
                    if (!DateTime.TryParse(value, null, DateTimeStyles.RoundtripKind, out var dt))
                        continue;
                    if (dt.Kind == DateTimeKind.Unspecified)
                        dt = DateTime.SpecifyKind(dt, DateTimeKind.Utc);
                    else
                        dt = dt.ToUniversalTime();
                    map[id] = new ToolPublishInfo(dt, FormatAr(dt));
                }
                if (map.Count > 0) return map;
            }
            catch
            {
                // siguiente ruta
            }
        }
        return map;
    }

    private static IEnumerable<string> CandidatePublishedPaths(IWebHostEnvironment env)
    {
        yield return Path.Combine(AppContext.BaseDirectory, "tools-packages", "published.json");
        yield return Path.Combine(env.ContentRootPath, "tools-packages", "published.json");
        var web = env.WebRootPath;
        if (!string.IsNullOrWhiteSpace(web))
            yield return Path.GetFullPath(Path.Combine(web, "..", "..", "..", "tools-packages", "published.json"));
    }

    private static TimeZoneInfo ResolveArgentinaTz()
    {
        foreach (var id in new[] { "America/Argentina/Buenos_Aires", "Argentina Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { /* siguiente */ }
            catch (InvalidTimeZoneException) { /* siguiente */ }
        }
        return TimeZoneInfo.Utc;
    }

    public readonly record struct ToolPublishInfo(DateTime Utc, string LabelAr);
}
