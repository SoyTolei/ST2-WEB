using System.Text.RegularExpressions;

namespace PortalClienchi.Web.Planillas;

public static class CrypticGuestIdentity
{
    public const string CookieName = "st2_cryptic_guest";
    private static readonly TimeSpan CookieLifetime = TimeSpan.FromDays(90);
    private static readonly Regex PlayerPattern = new(
        "^guest:[0-9a-f]{32}$",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);
    private static readonly Regex IdPattern = new(
        "^[0-9a-f]{32}$",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);

    public static bool IsPlayer(string? player) =>
        !string.IsNullOrWhiteSpace(player) && PlayerPattern.IsMatch(player);

    public static string Ensure(HttpContext ctx)
    {
        if (ctx.Request.Cookies.TryGetValue(CookieName, out var raw) && IdPattern.IsMatch(raw))
            return "guest:" + raw;

        var id = Guid.NewGuid().ToString("N");
        var secure = ctx.Request.IsHttps
            || string.Equals(ctx.Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase);
        ctx.Response.Cookies.Append(CookieName, id, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            MaxAge = CookieLifetime,
            IsEssential = true,
        });
        return "guest:" + id;
    }
}
