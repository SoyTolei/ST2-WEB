using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace PortalClienchi.Web.Planillas;

public static class PlanUserIdentity
{
    public const string CookieName = "st2_plan_user";
    private const string TokenVersion = "v1";
    private static readonly TimeSpan CookieLifetime = TimeSpan.FromDays(90);

    private static readonly string[] AllowedDomains = ["thomsonreuters.com"];

    /// <summary>
    /// Tokens que no se aceptan como parte del nombre (evita test.upload, admin.user, etc.).
    /// </summary>
    private static readonly HashSet<string> BlockedLocalTokens = new(StringComparer.OrdinalIgnoreCase)
    {
        "test", "testing", "tester", "upload", "uploads", "admin", "administrator",
        "user", "users", "usuario", "demo", "dummy", "fake", "sample", "example",
        "temp", "tmp", "prueba", "guest", "root", "support", "info", "noreply",
        "no-reply", "mailer", "service", "system", "bot", "null", "undefined",
        "foo", "bar", "baz", "asdf", "qwerty", "xxx", "abc", "aaa",
    };

    // nombre.apellido  |  nombre.segundo.apellido  (solo letras; segmentos de 2+ chars)
    private static readonly Regex LocalNamePattern = new(
        @"^[a-z]{2,}(?:\.[a-z]{2,})+$",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);

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

        if (!IsValidCorporateLocalPart(local))
            return null;

        return email;
    }

    public static bool IsValidCorporateLocalPart(string local)
    {
        if (string.IsNullOrWhiteSpace(local))
            return false;

        local = local.Trim().ToLowerInvariant();
        if (!LocalNamePattern.IsMatch(local))
            return false;

        foreach (var token in local.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (BlockedLocalTokens.Contains(token))
                return false;
        }

        return true;
    }

    public static string? GetFromRequest(HttpContext ctx)
    {
        if (!ctx.Request.Cookies.TryGetValue(CookieName, out var raw))
            return null;

        var config = ctx.RequestServices.GetService<IConfiguration>();
        return TryReadSignedCookie(raw, config);
    }

    public static void SetCookie(HttpContext ctx, string normalizedEmail)
    {
        var config = ctx.RequestServices.GetService<IConfiguration>();
        var token = CreateSignedCookie(normalizedEmail, config);
        var secure = IsSecureRequest(ctx);

        ctx.Response.Cookies.Append(CookieName, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            MaxAge = CookieLifetime,
            IsEssential = true,
        });
    }

    public static void ClearCookie(HttpContext ctx)
    {
        var secure = IsSecureRequest(ctx);
        ctx.Response.Cookies.Delete(CookieName, new CookieOptions { Path = "/", Secure = secure });
    }

    private static bool IsSecureRequest(HttpContext ctx) =>
        ctx.Request.IsHttps
        || string.Equals(ctx.Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase);

    internal static string CreateSignedCookie(string normalizedEmail, IConfiguration? configuration)
    {
        var email = ValidateAndNormalize(normalizedEmail)
            ?? throw new ArgumentException("Email inválido para cookie de sesión.", nameof(normalizedEmail));

        var exp = DateTimeOffset.UtcNow.Add(CookieLifetime).ToUnixTimeSeconds();
        var emailPart = Base64UrlEncode(Encoding.UTF8.GetBytes(email));
        var payload = $"{TokenVersion}.{emailPart}.{exp}";
        var sig = Sign(payload, configuration);
        return $"{payload}.{sig}";
    }

    internal static string? TryReadSignedCookie(string? raw, IConfiguration? configuration)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        // Cookies viejas: solo el email, sin firma → rechazar.
        var parts = raw.Split('.', StringSplitOptions.None);
        if (parts.Length != 4)
            return null;

        if (!string.Equals(parts[0], TokenVersion, StringComparison.Ordinal))
            return null;

        byte[] emailBytes;
        try
        {
            emailBytes = Base64UrlDecode(parts[1]);
        }
        catch
        {
            return null;
        }

        var email = ValidateAndNormalize(Encoding.UTF8.GetString(emailBytes));
        if (email is null)
            return null;

        if (!long.TryParse(parts[2], out var expUnix))
            return null;

        var exp = DateTimeOffset.FromUnixTimeSeconds(expUnix);
        if (exp < DateTimeOffset.UtcNow)
            return null;

        var payload = $"{parts[0]}.{parts[1]}.{parts[2]}";
        var expected = Sign(payload, configuration);
        if (!FixedTimeEqualsHex(parts[3], expected))
            return null;

        return email;
    }

    private static string Sign(string payload, IConfiguration? configuration)
    {
        var key = ResolveSigningKey(configuration);
        using var hmac = new HMACSHA256(key);
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static byte[] ResolveSigningKey(IConfiguration? configuration)
    {
        var secret = FirstNonEmpty(
            Environment.GetEnvironmentVariable("ST2_SESSION_SECRET"),
            Environment.GetEnvironmentVariable("St2Session__Secret"),
            configuration?["ST2_SESSION_SECRET"],
            configuration?["St2Session:Secret"],
            // Fallbacks: si aún no cargaste ST2_SESSION_SECRET, firmamos con otra clave ya usada.
            Environment.GetEnvironmentVariable("ST2_SUPER_ADMIN_PASSWORD"),
            Environment.GetEnvironmentVariable("ST2_ACCESS_ADMIN_PASSWORD"),
            configuration?["St2SuperAdmin:Password"],
            configuration?["St2AccessAdmin:Password"]);

        if (string.IsNullOrWhiteSpace(secret))
            secret = "st2-dev-unsigned-fallback-change-me";

        return SHA256.HashData(Encoding.UTF8.GetBytes("st2-plan-user-v1\0" + secret.Trim()));
    }

    private static bool FixedTimeEqualsHex(string left, string right)
    {
        var leftBytes = Encoding.UTF8.GetBytes(left.Trim().ToLowerInvariant());
        var rightBytes = Encoding.UTF8.GetBytes(right.Trim().ToLowerInvariant());
        if (leftBytes.Length != rightBytes.Length)
            return false;
        return CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
    }

    private static string Base64UrlEncode(byte[] data) =>
        Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string input)
    {
        var s = input.Replace('-', '+').Replace('_', '/');
        switch (s.Length % 4)
        {
            case 2: s += "=="; break;
            case 3: s += "="; break;
        }
        return Convert.FromBase64String(s);
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

public sealed class PlanUserSessionRequest
{
    [JsonPropertyName("email")]
    public string Email { get; set; } = "";

    /// <summary>Solo requerido para el super-admin.</summary>
    [JsonPropertyName("password")]
    public string? Password { get; set; }
}
