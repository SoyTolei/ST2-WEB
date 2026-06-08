namespace PortalClienchi.Web;

internal static class St2Paths
{
    public static string GetDataDirectory()
    {
        var fromEnv = Environment.GetEnvironmentVariable("ST2_DATA_DIR");
        if (!string.IsNullOrWhiteSpace(fromEnv))
            return Path.GetFullPath(fromEnv.Trim());

        return Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "ST2");
    }
}
