using System.Security.Cryptography;
using System.Text;

using System.Text.Json.Serialization;

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

        var userOk = SecureEquals(user.ToLowerInvariant(), expectedUser.ToLowerInvariant());
        var passOk = SecureEquals(pass, expectedPass);

        return userOk && passOk;
    }

    private static bool SecureEquals(string left, string right)
    {
        var leftBytes = Encoding.UTF8.GetBytes(left);
        var rightBytes = Encoding.UTF8.GetBytes(right);
        if (leftBytes.Length != rightBytes.Length)
            return false;

        return CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
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

        var tokenBytes = Encoding.UTF8.GetBytes(token);
        var expectedBytes = Encoding.UTF8.GetBytes(expected);
        if (tokenBytes.Length != expectedBytes.Length)
            return false;

        return CryptographicOperations.FixedTimeEquals(tokenBytes, expectedBytes);
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
            SameSite = SameSiteMode.Lax,
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
            Environment.GetEnvironmentVariable("ST2_ACCESS_ADMIN_USER"),
            Environment.GetEnvironmentVariable("St2AccessAdmin__Username"),
            configuration["ST2_ACCESS_ADMIN_USER"],
            configuration["St2AccessAdmin:Username"]);

        var pass = FirstNonEmpty(
            Environment.GetEnvironmentVariable("ST2_ACCESS_ADMIN_PASSWORD"),
            Environment.GetEnvironmentVariable("St2AccessAdmin__Password"),
            configuration["ST2_ACCESS_ADMIN_PASSWORD"],
            configuration["St2AccessAdmin:Password"]);

        return (NormalizeCredential(user), NormalizeCredential(pass));
    }

    private static string? NormalizeCredential(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        value = value.Trim();
        if (value.Length >= 2)
        {
            if ((value.StartsWith('"') && value.EndsWith('"'))
                || (value.StartsWith('\'') && value.EndsWith('\'')))
            {
                value = value[1..^1].Trim();
            }
        }

        return string.IsNullOrWhiteSpace(value) ? null : value;
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
    [JsonPropertyName("username")]
    public string Username { get; set; } = "";

    [JsonPropertyName("password")]
    public string Password { get; set; } = "";
}
