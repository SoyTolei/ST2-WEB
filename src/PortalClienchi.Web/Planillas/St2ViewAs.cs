using Microsoft.AspNetCore.Http;

namespace PortalClienchi.Web.Planillas;

/// <summary>Preview de alertas de otro usuario, solo para el admin primario.</summary>
internal static class St2ViewAs
{
    public static bool TryApply(
        HttpContext ctx,
        ModuleAccessRepository modules,
        ref string? email,
        ref ModuleAccessFlagsDto flags)
    {
        var asRaw = (ctx.Request.Query["as"].ToString() ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(asRaw) || asRaw.Contains(' ') || !asRaw.EndsWith("@thomsonreuters.com", StringComparison.Ordinal))
            return false;

        var session = PlanUserIdentity.GetFromRequest(ctx);
        if (!St2SuperAdmin.Is(session))
            return false;

        email = asRaw;
        flags = modules.GetFlags(asRaw);
        return true;
    }
}
