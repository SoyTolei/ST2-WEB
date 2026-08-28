using System.Net;
using System.Net.Sockets;

namespace PortalClienchi.Web.Planillas;

public static class AppAccessClientInfo
{
    public const int MaxHintLength = 160;
    public const int MaxUserAgentLength = 512;
    public const int MaxHostLength = 200;

    public static string? GetClientIp(HttpContext ctx)
    {
        var forwarded = ctx.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(forwarded))
        {
            var first = forwarded.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).FirstOrDefault();
            if (IsUsableIp(first))
                return first;
        }

        var realIp = ctx.Request.Headers["X-Real-IP"].FirstOrDefault();
        if (IsUsableIp(realIp))
            return realIp;

        var remote = ctx.Connection.RemoteIpAddress;
        if (remote is null)
            return null;

        if (remote.IsIPv4MappedToIPv6)
            remote = remote.MapToIPv4();

        return remote.ToString();
    }

    public static string? GetUserAgent(HttpContext ctx)
    {
        var ua = ctx.Request.Headers.UserAgent.ToString().Trim();
        if (ua.Length == 0)
            return null;
        return ua.Length <= MaxUserAgentLength ? ua : ua[..MaxUserAgentLength];
    }

    public static string? NormalizeClientHint(string? hint)
    {
        var value = (hint ?? "").Trim();
        if (value.Length == 0)
            return null;
        return value.Length <= MaxHintLength ? value : value[..MaxHintLength];
    }

    public static string? TryResolveHost(string? ip)
    {
        if (!IsUsableIp(ip) || IsPrivateLoopback(ip!))
            return null;

        try
        {
            var entry = Dns.GetHostEntry(ip!);
            var host = entry.HostName?.Trim();
            if (string.IsNullOrWhiteSpace(host) || string.Equals(host, ip, StringComparison.OrdinalIgnoreCase))
                return null;

            return host.Length <= MaxHostLength ? host : host[..MaxHostLength];
        }
        catch
        {
            return null;
        }
    }

    public static string BuildDisplayLabel(string? host, string? hint, string? ip)
    {
        if (!string.IsNullOrWhiteSpace(host))
            return host.Trim();

        if (!string.IsNullOrWhiteSpace(hint))
            return hint.Trim();

        if (!string.IsNullOrWhiteSpace(ip))
            return ip.Trim();

        return "—";
    }

    private static bool IsUsableIp(string? ip)
    {
        if (string.IsNullOrWhiteSpace(ip))
            return false;

        return IPAddress.TryParse(ip.Trim(), out var parsed)
            && parsed.AddressFamily is AddressFamily.InterNetwork or AddressFamily.InterNetworkV6;
    }

    private static bool IsPrivateLoopback(string ip)
    {
        if (!IPAddress.TryParse(ip, out var parsed))
            return true;

        if (IPAddress.IsLoopback(parsed))
            return true;

        if (parsed.IsIPv4MappedToIPv6)
            parsed = parsed.MapToIPv4();

        if (parsed.AddressFamily != AddressFamily.InterNetwork)
            return false;

        var bytes = parsed.GetAddressBytes();
        return bytes[0] switch
        {
            10 => true,
            127 => true,
            192 when bytes[1] == 168 => true,
            172 when bytes[1] is >= 16 and <= 31 => true,
            _ => false,
        };
    }
}
