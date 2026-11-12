namespace PortalClienchi.Web;

/// <summary>
/// Helpers para bypass de acceso solo en Development + localhost.
/// No se usa en producción (el endpoint ni siquiera se registra fuera de Development).
/// </summary>
public static class St2LocalDevAccess
{
    public const string DevEmail = "local.dev@thomsonreuters.com";

    public static bool IsLocalHost(HttpContext ctx)
    {
        var host = ctx.Request.Host.Host;
        if (string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)
            || string.Equals(host, "127.0.0.1", StringComparison.OrdinalIgnoreCase)
            || string.Equals(host, "::1", StringComparison.OrdinalIgnoreCase)
            || string.Equals(host, "[::1]", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var remote = ctx.Connection.RemoteIpAddress;
        return remote is not null
            && (System.Net.IPAddress.IsLoopback(remote)
                || (remote.IsIPv4MappedToIPv6 && System.Net.IPAddress.IsLoopback(remote.MapToIPv4())));
    }
}
