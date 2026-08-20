using System.Security.Cryptography;
using System.Text;

namespace PortalClienchi.Web.Planillas;

/// <summary>
/// Contraseña extra solo para el super-admin al abrir sesión en ST2.
/// El resto de correos sigue entrando solo con el mail aprobado.
/// </summary>
public static class St2SuperAdminGate
{
    /// <summary>SHA-256 de "st2-super-admin-v1\0" + contraseña por defecto (rotá con env si hace falta).</summary>
    private const string DefaultPasswordSha256Hex =
        "f48fd720bbe269d73282635195b1140d93d72bf15e25bf929861d0cf9785446d";

    public static bool RequiresPassword(string? email) => St2SuperAdmin.Is(email);

    public static bool ValidatePassword(IConfiguration configuration, string? password)
    {
        var pass = password ?? "";
        if (pass.Length == 0)
            return false;

        var configured = GetConfiguredPassword(configuration);
        if (configured is not null)
            return SecureEquals(pass, configured);

        var hashHex = Sha256Hex("st2-super-admin-v1\0" + pass);
        return SecureEquals(hashHex, DefaultPasswordSha256Hex);
    }

    private static string? GetConfiguredPassword(IConfiguration configuration)
    {
        var pass = FirstNonEmpty(
            Environment.GetEnvironmentVariable("ST2_SUPER_ADMIN_PASSWORD"),
            Environment.GetEnvironmentVariable("St2SuperAdmin__Password"),
            configuration["ST2_SUPER_ADMIN_PASSWORD"],
            configuration["St2SuperAdmin:Password"]);

        if (string.IsNullOrWhiteSpace(pass))
            return null;

        pass = pass.Trim();
        if (pass.Length >= 2
            && ((pass.StartsWith('"') && pass.EndsWith('"'))
                || (pass.StartsWith('\'') && pass.EndsWith('\''))))
        {
            pass = pass[1..^1].Trim();
        }

        return string.IsNullOrWhiteSpace(pass) ? null : pass;
    }

    private static string Sha256Hex(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static bool SecureEquals(string left, string right)
    {
        var leftBytes = Encoding.UTF8.GetBytes(left);
        var rightBytes = Encoding.UTF8.GetBytes(right);
        if (leftBytes.Length != rightBytes.Length)
            return false;

        return CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
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
