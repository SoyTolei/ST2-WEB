using PortalClienchi.Web.Planillas;

namespace PortalClienchi.Web;

public static class St2AccessMiddleware
{
    public static bool IsSessionExempt(PathString path, string method)
    {
        if (path.Equals("/api/planillas/session", StringComparison.OrdinalIgnoreCase))
        {
            return HttpMethods.IsGet(method)
                || HttpMethods.IsPost(method)
                || HttpMethods.IsDelete(method);
        }

        if (path.Equals("/api/access/admin/session", StringComparison.OrdinalIgnoreCase))
        {
            return HttpMethods.IsGet(method)
                || HttpMethods.IsPost(method)
                || HttpMethods.IsDelete(method);
        }

        return false;
    }

    public static bool IsPublicPath(PathString path, string method)
    {
        if (IsSessionExempt(path, method))
            return true;

        if (path.Equals("/api/health", StringComparison.OrdinalIgnoreCase) && HttpMethods.IsGet(method))
            return true;

        if (path.Equals("/api/live", StringComparison.OrdinalIgnoreCase) && HttpMethods.IsGet(method))
            return true;

        // Capturas públicas (links en TXT de planillas); token opaco.
        var value = path.Value ?? "";
        if (!HttpMethods.IsGet(method))
            return false;

        return value.StartsWith("/api/health", StringComparison.OrdinalIgnoreCase)
            || value.StartsWith("/api/capturas/status", StringComparison.OrdinalIgnoreCase)
            || value.StartsWith("/c/", StringComparison.OrdinalIgnoreCase)
            || value.StartsWith("/media/capturas/", StringComparison.OrdinalIgnoreCase);
    }

    public static bool RequiresAuthenticatedUser(PathString path, string method)
    {
        var value = path.Value ?? "";
        if (IsPublicPath(path, method))
            return false;

        return value.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)
            || value.StartsWith("/embed/", StringComparison.OrdinalIgnoreCase);
    }

    public static IApplicationBuilder UseSt2AccessGate(this IApplicationBuilder app) =>
        app.Use(async (ctx, next) =>
        {
            if (!RequiresAuthenticatedUser(ctx.Request.Path, ctx.Request.Method))
            {
                await next(ctx).ConfigureAwait(false);
                return;
            }

            var email = PlanUserIdentity.GetFromRequest(ctx);
            if (email is not null)
            {
                ctx.RequestServices.GetService<AppAccessRepository>()?.TouchActivity(email);
                await next(ctx).ConfigureAwait(false);
                return;
            }

            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await ctx.Response.WriteAsJsonAsync(new
            {
                error = "Identificá tu usuario para continuar.",
            }).ConfigureAwait(false);
        });
}
