using System.Net;
using System.Net.Sockets;
using System.Text.RegularExpressions;

namespace PortalClienchi.Web.Planillas;

public static class AppAccessClientInfo
{
    public const int MaxHintLength = 160;
    public const int MaxUserAgentLength = 512;
    public const int MaxHostLength = 200;
    public const int MaxDeviceIdLength = 32;

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

    public static string? NormalizeDeviceId(string? deviceId)
    {
        var value = (deviceId ?? "").Trim().ToLowerInvariant();
        if (value.Length == 0)
            return null;

        // Solo id alfanumérico corto (evita basura del cliente).
        if (!Regex.IsMatch(value, "^[a-z0-9-]{6,32}$"))
            return null;

        return value.Length <= MaxDeviceIdLength ? value : value[..MaxDeviceIdLength];
    }

    /// <summary>Resumen corto del UA para la columna Equipo (Edge 128, Chrome 131, etc.).</summary>
    public static string? SummarizeBrowser(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent))
            return null;

        var ua = userAgent.Trim();

        // Orden importa: Edge/Opera/Chrome comparten "Chrome/" en el UA.
        if (TryMatchBrowser(ua, "Edg(?:e|A|iOS)?/(\\d+)", "Edge", out var edge))
            return edge;
        if (TryMatchBrowser(ua, "OPR/(\\d+)", "Opera", out var opera))
            return opera;
        if (TryMatchBrowser(ua, "Firefox/(\\d+)", "Firefox", out var firefox))
            return firefox;
        if (TryMatchBrowser(ua, "CriOS/(\\d+)", "Chrome", out var crios))
            return crios;
        if (ua.Contains("Chrome/", StringComparison.Ordinal) && !ua.Contains("Chromium", StringComparison.Ordinal))
        {
            if (TryMatchBrowser(ua, "Chrome/(\\d+)", "Chrome", out var chrome))
                return chrome;
        }
        if (TryMatchBrowser(ua, "Version/(\\d+).*Safari/", "Safari", out var safari))
            return safari;
        if (ua.Contains("Safari/", StringComparison.Ordinal) && TryMatchBrowser(ua, "Version/(\\d+)", "Safari", out var safari2))
            return safari2;

        return null;
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

    public static string BuildDisplayLabel(
        string? host,
        string? hint,
        string? ip,
        string? deviceId = null,
        string? browser = null)
    {
        var deviceShort = ShortDevice(deviceId);
        var browserLabel = (browser ?? "").Trim();

        if (!string.IsNullOrWhiteSpace(browserLabel) && !string.IsNullOrWhiteSpace(deviceShort))
            return $"{browserLabel} · {deviceShort}";

        if (!string.IsNullOrWhiteSpace(browserLabel))
            return browserLabel;

        if (!string.IsNullOrWhiteSpace(deviceShort))
            return $"id {deviceShort}";

        // Hint del cliente (SO · TZ · …) suele ser más útil que la IP de Zscaler.
        if (!string.IsNullOrWhiteSpace(hint))
            return hint.Trim();

        if (!string.IsNullOrWhiteSpace(host))
            return host.Trim();

        if (!string.IsNullOrWhiteSpace(ip))
            return ip.Trim();

        return "—";
    }

    public static string? ShortDevice(string? deviceId)
    {
        var id = NormalizeDeviceId(deviceId);
        if (id is null)
            return null;
        return id.Length <= 8 ? id : id[..8];
    }

    private static bool TryMatchBrowser(string ua, string pattern, string name, out string label)
    {
        var m = Regex.Match(ua, pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        if (!m.Success)
        {
            label = "";
            return false;
        }

        label = $"{name} {m.Groups[1].Value}";
        return true;
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
