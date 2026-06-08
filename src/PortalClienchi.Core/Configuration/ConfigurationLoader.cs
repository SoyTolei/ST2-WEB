using System.Reflection;
using Microsoft.Extensions.Configuration;

namespace PortalClienchi.Core.Configuration;

public static class ConfigurationLoader
{
    private static Assembly? _embeddedAssembly;

    /// <summary>Config embebida en ST2.exe (Groq, portal, etc.). Llamar al iniciar la app.</summary>
    public static void SetEmbeddedAssembly(Assembly assembly) => _embeddedAssembly = assembly;

    public static AppSettings Load(string? baseDirectory = null)
    {
        baseDirectory ??= AppContext.BaseDirectory;
        var builder = new ConfigurationBuilder()
            .SetBasePath(baseDirectory);

        if (_embeddedAssembly is not null)
        {
            AddEmbeddedJson(builder, _embeddedAssembly, "appsettings.json");
            AddEmbeddedJson(builder, _embeddedAssembly, "appsettings.local.json");
        }

        builder
            .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
            .AddJsonFile("appsettings.local.json", optional: true, reloadOnChange: true);

        var appDataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "ST2");
        Directory.CreateDirectory(appDataDir);
        builder.AddJsonFile(Path.Combine(appDataDir, "appsettings.local.json"), optional: true, reloadOnChange: true);

        var config = builder.Build();
        var settings = new AppSettings();
        config.Bind(settings);
        return settings;
    }

    private static void AddEmbeddedJson(IConfigurationBuilder builder, Assembly assembly, string fileName)
    {
        var resourceName = assembly.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith(fileName, StringComparison.OrdinalIgnoreCase));
        if (resourceName is null)
            return;

        var stream = assembly.GetManifestResourceStream(resourceName);
        if (stream is null)
            return;

        builder.AddJsonStream(stream);
    }
}
