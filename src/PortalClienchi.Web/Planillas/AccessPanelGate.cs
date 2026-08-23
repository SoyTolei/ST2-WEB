using PortalClienchi.Web;

namespace PortalClienchi.Web.Planillas;

/// <summary>
/// Dueño (Leonel / cookie de credenciales del servidor) vs ADMIN WEB (sesión).
/// </summary>
public static class AccessPanelGate
{
    public enum Role
    {
        None,
        Manager,
        Owner,
    }

    public static Role Resolve(HttpContext ctx, IConfiguration config, AppAccessRepository accessRepo)
    {
        var email = PlanUserIdentity.GetFromRequest(ctx);
        if (St2SuperAdmin.Is(email))
            return Role.Owner;

        if (email is not null && accessRepo.IsSt2Admin(email))
            return Role.Manager;

        if (St2AccessAdminAuth.IsAuthenticated(config, ctx))
            return Role.Owner;

        return Role.None;
    }

    public static bool TryAuthorize(
        HttpContext ctx,
        IConfiguration config,
        AppAccessRepository accessRepo,
        out Role role,
        out IResult? error,
        bool ownerOnly = false)
    {
        role = Resolve(ctx, config, accessRepo);
        if (role == Role.None)
        {
            error = Results.Json(new { error = "Acceso denegado." }, statusCode: StatusCodes.Status401Unauthorized);
            return false;
        }

        if (ownerOnly && role != Role.Owner)
        {
            error = Results.Json(
                new { error = "Esa acción es solo del dueño de ST2." },
                statusCode: StatusCodes.Status403Forbidden);
            return false;
        }

        error = null;
        return true;
    }
}
