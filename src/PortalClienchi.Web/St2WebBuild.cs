namespace PortalClienchi.Web;

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
}
