namespace PortalClienchi.Web;

/// <summary>
/// Rutas del shell de ST2 (SPA). No deben ir al mirror de THOM.
/// </summary>
public static class St2AppRoutes
{
    public static bool IsAppShell(PathString path) => IsAppShell(path.Value ?? "/");

    public static bool IsAppShell(string? path)
    {
        var p = Normalize(path);
        return p is "/"
            or "/index.html"
            or "/planillas"
            or "/transferencia"
            or "/referral"
            or "/oportunidad"
            or "/pdf"
            or "/pdf-portal"
            or "/blanqueo"
            || p.StartsWith("/oportunidad/", StringComparison.OrdinalIgnoreCase)
            || p.StartsWith("/transferencia/", StringComparison.OrdinalIgnoreCase)
            || p.StartsWith("/referral/", StringComparison.OrdinalIgnoreCase);
    }

    public static string Normalize(string? path)
    {
        var value = string.IsNullOrWhiteSpace(path) ? "/" : path.Trim();
        if (value.Length > 1)
            value = value.TrimEnd('/');
        return value.Length == 0 ? "/" : value;
    }
}
