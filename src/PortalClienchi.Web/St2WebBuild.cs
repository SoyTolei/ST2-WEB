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
        foreach (var key in new[] { "RAILWAY_DEPLOYMENT_CREATED_AT", "ST2_BUILD_UTC" })
        {
            var raw = Environment.GetEnvironmentVariable(key)?.Trim();
            if (string.IsNullOrEmpty(raw))
                continue;
            if (DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsed))
                return parsed.Kind == DateTimeKind.Unspecified
                    ? DateTime.SpecifyKind(parsed, DateTimeKind.Utc)
                    : parsed.ToUniversalTime();
        }

        var fromMeta = ReadAssemblyBuildTime();
        if (fromMeta is not null)
            return fromMeta;

        try
        {
            var path = Assembly.GetExecutingAssembly().Location;
            if (string.IsNullOrEmpty(path))
                path = Path.Combine(AppContext.BaseDirectory, "PortalClienchi.Web.dll");
            if (!string.IsNullOrEmpty(path) && File.Exists(path))
                return File.GetLastWriteTimeUtc(path);
        }
        catch
        {
            // ignore
        }

        return null;
    }

    public static string GetVersionLabel() => "Versión WEB";

    public static string GetUpdatedLabel()
    {
        try
        {
            var updated = GetBuildUpdatedUtc();
            if (updated is null)
                return "Última actualización de la web: versión WEB";

            var utc = DateTime.SpecifyKind(updated.Value, DateTimeKind.Utc);
            var local = TimeZoneInfo.ConvertTimeFromUtc(utc, GetArgentinaTimeZone());
            var date = local.ToString("d 'de' MMMM yyyy", new CultureInfo("es-AR"));
            return $"Última actualización de la web: {date}";
        }
        catch
        {
            return "Última actualización de la web: versión WEB";
        }
    }

    private static DateTime? ReadAssemblyBuildTime()
    {
        try
        {
            var value = Assembly.GetExecutingAssembly()
                .GetCustomAttributes<AssemblyMetadataAttribute>()
                .FirstOrDefault(a => a.Key == "BuildTimeUtc")
                ?.Value;
            if (string.IsNullOrWhiteSpace(value))
                return null;
            if (DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsed))
                return parsed.Kind == DateTimeKind.Unspecified
                    ? DateTime.SpecifyKind(parsed, DateTimeKind.Utc)
                    : parsed.ToUniversalTime();
        }
        catch
        {
            // ignore
        }

        return null;
    }

    private static TimeZoneInfo GetArgentinaTimeZone()
    {
        foreach (var id in OperatingSystem.IsWindows()
            ? new[] { "Argentina Standard Time", "America/Argentina/Buenos_Aires" }
            : new[] { "America/Argentina/Buenos_Aires", "Argentina Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        return TimeZoneInfo.CreateCustomTimeZone("ART", TimeSpan.FromHours(-3), "Argentina", "Argentina");
    }
}
