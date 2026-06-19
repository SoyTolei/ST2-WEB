namespace PortalClienchi.Web;

using System.Globalization;
using System.Reflection;

public static class St2WebBuild
{
    public static string GetBuild() =>
        Environment.GetEnvironmentVariable("RAILWAY_GIT_COMMIT_SHA")?.Trim()
        ?? "local";

    public static string GetShortBuild()
    {
        var build = GetBuild();
        return build.Length > 7 ? build[..7] : build;
    }

    public static DateTime? GetBuildUpdatedUtc()
    {
        var railway = Environment.GetEnvironmentVariable("RAILWAY_DEPLOYMENT_CREATED_AT")?.Trim();
        if (!string.IsNullOrEmpty(railway) && DateTime.TryParse(railway, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var railwayDt))
            return railwayDt.ToUniversalTime();

        try
        {
            var path = Assembly.GetExecutingAssembly().Location;
            if (!string.IsNullOrEmpty(path) && File.Exists(path))
                return File.GetLastWriteTimeUtc(path);
        }
        catch
        {
            // ignore
        }

        return null;
    }

    public static string GetVersionLabel()
    {
        var updated = GetBuildUpdatedUtc();
        if (updated is null)
            return "Versión WEB";

        var local = updated.Value.ToLocalTime();
        var monthYear = local.ToString("MMMM yyyy", new CultureInfo("es-AR"));
        if (monthYear.Length > 0)
            monthYear = char.ToUpper(monthYear[0], new CultureInfo("es-AR")) + monthYear[1..];

        return $"Versión WEB · {monthYear}";
    }

    public static string GetUpdatedLabel()
    {
        var updated = GetBuildUpdatedUtc();
        if (updated is null)
            return "";

        var culture = new CultureInfo("es-AR");
        var local = updated.Value.ToLocalTime();
        var date = local.ToString("d 'de' MMMM yyyy", culture);
        var shortBuild = GetShortBuild();

        return shortBuild is "local"
            ? $"Actualizado el {date}"
            : $"Actualizado el {date} · build {shortBuild}";
    }
}
