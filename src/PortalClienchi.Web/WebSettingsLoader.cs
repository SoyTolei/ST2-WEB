using Microsoft.Extensions.Configuration;
using PortalClienchi.Core.Configuration;

namespace PortalClienchi.Web;

internal static class WebSettingsLoader
{
    public static AppSettings Load(IConfiguration hostConfiguration, string contentRoot)
    {
        var appDataDir = St2Paths.GetDataDirectory();

        var config = new ConfigurationBuilder()
            .SetBasePath(contentRoot)
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
            .AddJsonFile("appsettings.local.json", optional: true, reloadOnChange: true)
            .AddJsonFile(Path.Combine(appDataDir, "appsettings.local.json"), optional: true, reloadOnChange: true)
            .AddConfiguration(hostConfiguration)
            .Build();

        var settings = new AppSettings();
        config.Bind(settings);
        return settings;
    }

    public static bool HasPortalCredentials(AppSettings settings) =>
        !string.IsNullOrWhiteSpace(settings.Email)
        && !string.IsNullOrWhiteSpace(settings.Password);
}
