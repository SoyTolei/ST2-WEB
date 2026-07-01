using System.Security.Cryptography;
using System.Text;

namespace PortalClienchi.Web;

public static class St2AccessAdminAuth
{
    public const string CookieName = "st2_access_admin";

    public static bool IsConfigured(IConfiguration configuration)
    {
        var (user, pass) = GetCredentials(configuration);
        return !string.IsNullOrWhiteSpace(user) && !string.IsNullOrWhiteSpace(pass);
    }

    public static bool ValidateLogin(IConfiguration configuration, string? username, string? password)
    {
        var (expectedUser, expectedPass) = GetCredentials(configuration);
        if (expectedUser is null || expectedPass is null)
            return false;

        var user = username?.Trim() ?? "";
        var pass = password ?? "";
        if (user.Length == 0 || pass.Length == 0)
            return false;

        var userOk = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(user.ToLowerInvariant()),
            Encoding.UTF8.GetBytes(expectedUser.ToLowerInvariant()));

        var passOk = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(pass),
            Encoding.UTF8.GetBytes(expectedPass));

        return userOk && passOk;
    }

    public static string CreateSessionToken(IConfiguration configuration)
    {
        var (user, pass) = GetCredentials(configuration);
        if (user is null || pass is null)
            return "";

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(pass + "\0" + user));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes("st2-access-admin-v1"));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public static bool IsAuthenticated(IConfiguration configuration, HttpContext ctx)
    {
        if (!IsConfigured(configuration))
            return false;

        if (!ctx.Request.Cookies.TryGetValue(CookieName, out var token))
            return false;

        var expected = CreateSessionToken(configuration);
        if (expected.Length == 0 || string.IsNullOrEmpty(token))
            return false;

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(token),
            Encoding.UTF8.GetBytes(expected));
    }

    public static void SetCookie(HttpContext ctx, IConfiguration configuration)
    {
        var token = CreateSessionToken(configuration);
        var secure = ctx.Request.IsHttps
            || string.Equals(ctx.Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase);

        ctx.Response.Cookies.Append(CookieName, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            MaxAge = TimeSpan.FromHours(8),
            IsEssential = true,
        });
    }

    public static void ClearCookie(HttpContext ctx)
    {
        var secure = ctx.Request.IsHttps
            || string.Equals(ctx.Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase);

        ctx.Response.Cookies.Delete(CookieName, new CookieOptions { Path = "/", Secure = secure });
    }

    private static (string? User, string? Password) GetCredentials(IConfiguration configuration)
    {
        var user = FirstNonEmpty(
            configuration["ST2_ACCESS_ADMIN_USER"],
            configuration["St2AccessAdmin:Username"]);

        var pass = FirstNonEmpty(
            configuration["ST2_ACCESS_ADMIN_PASSWORD"],
            configuration["St2AccessAdmin:Password"]);

        return (user, pass);
    }

    private static string? FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
                return value.Trim();
        }

        return null;
    }
}

public sealed class St2AccessAdminLoginRequest
{
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
}
