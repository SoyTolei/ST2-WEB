using System.Text.Json.Serialization;

namespace PortalClienchi.Web.Planillas;

public static class PlanUserIdentity
{
    public const string CookieName = "st2_plan_user";

    private static readonly string[] AllowedDomains = ["thomsonreuters.com"];

    public static string? ValidateAndNormalize(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return null;

        email = email.Trim().ToLowerInvariant();
        var at = email.LastIndexOf('@');
        if (at <= 0 || at >= email.Length - 1)
            return null;

        var local = email[..at];
        var domain = email[(at + 1)..];

        if (string.IsNullOrWhiteSpace(local) || local.Contains(' ') || local.Contains('@'))
            return null;

        if (!AllowedDomains.Any(d => domain.Equals(d, StringComparison.OrdinalIgnoreCase)))
            return null;

        return email;
    }

    public static string? GetFromRequest(HttpContext ctx)
    {
        if (!ctx.Request.Cookies.TryGetValue(CookieName, out var raw))
            return null;
        return ValidateAndNormalize(raw);
    }

    public static void SetCookie(HttpContext ctx, string normalizedEmail)
    {
        var secure = ctx.Request.IsHttps
            || string.Equals(ctx.Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase);

        ctx.Response.Cookies.Append(CookieName, normalizedEmail, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            MaxAge = TimeSpan.FromDays(90),
            IsEssential = true,
        });
    }

    public static void ClearCookie(HttpContext ctx)
    {
        var secure = ctx.Request.IsHttps
            || string.Equals(ctx.Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase);

        ctx.Response.Cookies.Delete(CookieName, new CookieOptions { Path = "/", Secure = secure });
    }
}

public sealed class PlanUserSessionRequest
{
    [JsonPropertyName("email")]
    public string Email { get; set; } = "";
}
