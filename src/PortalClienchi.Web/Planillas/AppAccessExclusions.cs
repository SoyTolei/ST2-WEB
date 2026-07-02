namespace PortalClienchi.Web.Planillas;

public static class AppAccessExclusions
{
    private static readonly string[] DefaultExcluded =
    [
        "leonel.gallo@thomsonreuters.com",
    ];

    public static bool IsExcluded(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return false;

        var normalized = email.Trim();
        foreach (var excluded in GetExcludedEmails())
        {
            if (string.Equals(normalized, excluded, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }

    private static IEnumerable<string> GetExcludedEmails()
    {
        foreach (var email in DefaultExcluded)
            yield return email;

        var fromEnv = Environment.GetEnvironmentVariable("ST2_ACCESS_EXCLUDED_EMAILS");
        if (string.IsNullOrWhiteSpace(fromEnv))
            yield break;

        foreach (var part in fromEnv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            yield return part;
    }
}
