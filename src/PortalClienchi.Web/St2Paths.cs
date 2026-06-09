namespace PortalClienchi.Web;

internal static class St2Paths
{
    public static string GetDataDirectory()
    {
        foreach (var candidate in new[]
        {
            Environment.GetEnvironmentVariable("ST2_DATA_DIR"),
            Environment.GetEnvironmentVariable("RAILWAY_VOLUME_MOUNT_PATH"),
        })
        {
            if (!string.IsNullOrWhiteSpace(candidate))
                return Path.GetFullPath(candidate.Trim());
        }

        return Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "ST2");
    }
}
