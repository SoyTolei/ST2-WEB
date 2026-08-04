using PortalClienchi.Core.Configuration;
using PortalClienchi.Core.Services;

namespace PortalClienchi.Web;

internal static class PortalIds
{
    public const string Bejerman = "bejerman";
    public const string Legal = "legal";
}

internal sealed class PortalRegistry : IDisposable
{
    public sealed record PortalInfo(string Id, string Label);

    public sealed record PortalRuntime(
        PortalInfo Info,
        AppSettings Settings,
        PortalSearchService Search,
        PortalMediaProxy Media);

    private readonly Dictionary<string, PortalRuntime> _portals;
    private readonly string _defaultId;

    public PortalRegistry(AppSettings root)
    {
        PortalSettingsNormalizer.Normalize(root);
        _portals = new Dictionary<string, PortalRuntime>(StringComparer.OrdinalIgnoreCase);

        foreach (var (key, profile) in root.Portals.OrderBy(p => p.Key, StringComparer.OrdinalIgnoreCase))
        {
            var id = PortalSettingsNormalizer.ToPortalId(key);
            if (string.IsNullOrWhiteSpace(id))
                continue;

            var settings = PortalSettingsNormalizer.ToRuntimeSettings(root, profile);
            _portals[id] = new PortalRuntime(
                new PortalInfo(id, string.IsNullOrWhiteSpace(profile.Label) ? id : profile.Label.Trim()),
                settings,
                new PortalSearchService(settings),
                new PortalMediaProxy(settings));
        }

        if (_portals.Count == 0)
            throw new InvalidOperationException("No hay portales configurados en Portals.");

        _defaultId = _portals.ContainsKey(PortalIds.Bejerman)
            ? PortalIds.Bejerman
            : _portals.Keys.First();
    }

    public string DefaultId => _defaultId;

    public IReadOnlyList<PortalInfo> List() =>
        _portals.Values.Select(p => p.Info).OrderBy(p => p.Id, StringComparer.OrdinalIgnoreCase).ToList();

    public PortalRuntime Resolve(string? portalId)
    {
        if (!string.IsNullOrWhiteSpace(portalId) && _portals.TryGetValue(portalId.Trim(), out var found))
            return found;

        return _portals[_defaultId];
    }

    public PortalRuntime ResolveByMediaUrl(string url)
    {
        if (Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            foreach (var runtime in _portals.Values)
            {
                if (UrlBelongsToProfile(uri, runtime.Settings))
                    return runtime;
            }
        }

        return Resolve(null);
    }

    public bool HasCredentials(string? portalId)
    {
        var runtime = Resolve(portalId);
        return PortalSettingsNormalizer.HasCredentials(runtime.Settings);
    }

    public static bool UrlBelongsToProfile(Uri uri, AppSettings settings)
    {
        var hosts = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var baseUrl in new[] { settings.PortalBaseUrl, settings.ApiBaseUrl })
        {
            if (Uri.TryCreate(baseUrl, UriKind.Absolute, out var parsed))
                hosts.Add(parsed.Host);
        }

        return hosts.Contains(uri.Host);
    }

    public void Dispose()
    {
        foreach (var runtime in _portals.Values)
        {
            runtime.Search.Dispose();
            runtime.Media.Dispose();
        }
    }
}

internal static class PortalSettingsNormalizer
{
    public static void Normalize(AppSettings root)
    {
        root.Portals ??= new Dictionary<string, PortalProfileSettings>(StringComparer.OrdinalIgnoreCase);

        if (root.Portals.Count == 0)
        {
            root.Portals["Bejerman"] = new PortalProfileSettings
            {
                Label = "Bejerman SQL/WEB - ONVIO",
                ApiBaseUrl = root.ApiBaseUrl,
                PortalBaseUrl = root.PortalBaseUrl,
                Email = root.Email,
                Password = root.Password,
            };
            return;
        }

        EnsureProfile(root, "Bejerman", new PortalProfileSettings
        {
            Label = "Bejerman SQL/WEB - ONVIO",
            ApiBaseUrl = string.IsNullOrWhiteSpace(root.ApiBaseUrl)
                ? "https://clientes.thomsonreuters.com.ar:3333"
                : root.ApiBaseUrl,
            PortalBaseUrl = string.IsNullOrWhiteSpace(root.PortalBaseUrl)
                ? "https://clientes.thomsonreuters.com.ar"
                : root.PortalBaseUrl,
        });

        EnsureProfile(root, "Legal", new PortalProfileSettings
        {
            Label = "LEGAL",
            ApiBaseUrl = "https://portaldelcliente.thomsonreuters.com.ar:3334",
            PortalBaseUrl = "https://portaldelcliente.thomsonreuters.com.ar",
        });

        var bejerman = root.Portals["Bejerman"];
        if (string.IsNullOrWhiteSpace(bejerman.Email) && !string.IsNullOrWhiteSpace(root.Email))
            bejerman.Email = root.Email;
        if (string.IsNullOrWhiteSpace(bejerman.Password) && !string.IsNullOrWhiteSpace(root.Password))
            bejerman.Password = root.Password;

        var legal = root.Portals["Legal"];
        if (string.IsNullOrWhiteSpace(legal.Email) && !string.IsNullOrWhiteSpace(root.Email))
            legal.Email = root.Email;
        if (string.IsNullOrWhiteSpace(legal.Password) && !string.IsNullOrWhiteSpace(root.Password))
            legal.Password = root.Password;
        if (string.IsNullOrWhiteSpace(legal.Email) && !string.IsNullOrWhiteSpace(bejerman.Email))
            legal.Email = bejerman.Email;
        if (string.IsNullOrWhiteSpace(legal.Password) && !string.IsNullOrWhiteSpace(bejerman.Password))
            legal.Password = bejerman.Password;

        legal.ApiBaseUrl = NormalizeLegalApiBaseUrl(legal.ApiBaseUrl, bejerman.ApiBaseUrl);

        root.ApiBaseUrl = bejerman.ApiBaseUrl;
        root.PortalBaseUrl = bejerman.PortalBaseUrl;
        root.Email = bejerman.Email;
        root.Password = bejerman.Password;
    }

    private static void EnsureProfile(AppSettings root, string key, PortalProfileSettings defaults)
    {
        if (!root.Portals.TryGetValue(key, out var profile) || profile is null)
        {
            root.Portals[key] = defaults;
            return;
        }

        if (string.IsNullOrWhiteSpace(profile.Label))
            profile.Label = defaults.Label;
        if (string.IsNullOrWhiteSpace(profile.ApiBaseUrl))
            profile.ApiBaseUrl = defaults.ApiBaseUrl;
        if (string.IsNullOrWhiteSpace(profile.PortalBaseUrl))
            profile.PortalBaseUrl = defaults.PortalBaseUrl;
    }

    public static string ToPortalId(string configKey) =>
        configKey.Trim().ToLowerInvariant() switch
        {
            "bejerman" => PortalIds.Bejerman,
            "legal" => PortalIds.Legal,
            _ => configKey.Trim().ToLowerInvariant(),
        };

    public static AppSettings ToRuntimeSettings(AppSettings root, PortalProfileSettings profile) =>
        new()
        {
            ApiBaseUrl = profile.ApiBaseUrl,
            PortalBaseUrl = profile.PortalBaseUrl,
            Email = profile.Email,
            Password = profile.Password,
            ThomTapUrl = root.ThomTapUrl,
            ThomLegalUrl = root.ThomLegalUrl,
            ThomChileUrl = root.ThomChileUrl,
            AiPlatformUrl = root.AiPlatformUrl,
            ThomZoomFactor = root.ThomZoomFactor,
            AiPlatformZoomFactor = root.AiPlatformZoomFactor,
            SyncPageSize = root.SyncPageSize,
            SyncTypes = root.SyncTypes,
        };

    public static bool HasCredentials(AppSettings settings) =>
        !string.IsNullOrWhiteSpace(settings.Email)
        && !string.IsNullOrWhiteSpace(settings.Password);

    /// <summary>
    /// Corrige URLs legacy (clientes:3333 o portaldelcliente:3333) al backend real de LEGAL (:3334).
    /// </summary>
    public static string NormalizeLegalApiBaseUrl(string? configured, string? bejermanApiBaseUrl)
    {
        const string legalApi = "https://portaldelcliente.thomsonreuters.com.ar:3334";
        if (string.IsNullOrWhiteSpace(configured))
            return legalApi;

        var trimmed = configured.Trim().TrimEnd('/');
        if (trimmed.Equals(legalApi, StringComparison.OrdinalIgnoreCase))
            return legalApi;

        if (Uri.TryCreate(trimmed, UriKind.Absolute, out var uri))
        {
            if (uri.Host.Contains("portaldelcliente", StringComparison.OrdinalIgnoreCase)
                && uri.Port is 3333 or 443 or -1)
                return legalApi;

            if (uri.Host.Contains("clientes.thomsonreuters", StringComparison.OrdinalIgnoreCase))
                return legalApi;
        }

        if (!string.IsNullOrWhiteSpace(bejermanApiBaseUrl)
            && trimmed.Equals(bejermanApiBaseUrl.Trim().TrimEnd('/'), StringComparison.OrdinalIgnoreCase))
            return legalApi;

        return trimmed;
    }
}
