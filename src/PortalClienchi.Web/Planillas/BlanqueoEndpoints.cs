using System.Globalization;
using System.Text.RegularExpressions;

namespace PortalClienchi.Web.Planillas;

public static class BlanqueoEndpoints
{
    /// <summary>Por ahora solo Leo. Ampliar cuando haya más confirmadores/solicitantes.</summary>
    private static readonly HashSet<string> AllowedEmails = new(StringComparer.OrdinalIgnoreCase)
    {
        "leonel.gallo@thomsonreuters.com",
    };

    private static readonly HashSet<string> TiposPermitidos = new(StringComparer.OrdinalIgnoreCase)
    {
        "Blanqueo",
        "Blanqueo + MFA",
    };

    private static readonly HashSet<string> AclaracionesPermitidas = new(StringComparer.OrdinalIgnoreCase)
    {
        "No registrado",
        "Duplicado",
        "Perfil inexistente",
    };

    public static void MapBlanqueoEndpoints(this WebApplication app)
    {
        app.MapGet("/api/planillas/blanqueo", (HttpContext ctx, BlanqueoRepository repo) =>
        {
            if (!TryAuthorize(ctx, out var email, out var error))
                return error!;

            return Results.Ok(new
            {
                items = repo.LoadAll(),
                usuario = email,
                storage = new { ready = repo.StorageReady, path = repo.DatabasePath },
            });
        });

        app.MapPost("/api/planillas/blanqueo", (HttpContext ctx, BlanqueoCreateRequest body, BlanqueoRepository repo) =>
        {
            if (!TryAuthorize(ctx, out var email, out var error))
                return error!;

            var validation = ValidateCreate(body);
            if (validation is not null)
                return Results.BadRequest(new { error = validation });

            try
            {
                var fecha = DateTime.Now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                var nombre = DisplayNameFromEmail(email!);
                var item = repo.Insert(body, email!, nombre, fecha);
                return Results.Ok(item);
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, title: "No se pudo guardar la solicitud");
            }
        });

        app.MapPatch("/api/planillas/blanqueo/{id:int}", (HttpContext ctx, int id, BlanqueoPatchRequest body, BlanqueoRepository repo) =>
        {
            if (!TryAuthorize(ctx, out _, out var error))
                return error!;

            if (body.Aclaracion is not null
                && !string.IsNullOrWhiteSpace(body.Aclaracion)
                && !AclaracionesPermitidas.Contains(body.Aclaracion.Trim()))
            {
                return Results.BadRequest(new { error = "Aclaración no válida." });
            }

            var updated = repo.Patch(id, body);
            if (updated is null)
                return Results.NotFound(new { error = "Solicitud no encontrada." });

            return Results.Ok(updated);
        });

        app.MapDelete("/api/planillas/blanqueo/{id:int}", (HttpContext ctx, int id, BlanqueoRepository repo) =>
        {
            if (!TryAuthorize(ctx, out _, out var error))
                return error!;

            if (!repo.Delete(id))
                return Results.NotFound(new { error = "Solicitud no encontrada." });

            return Results.Ok(new { ok = true });
        });
    }

    private static bool TryAuthorize(HttpContext ctx, out string? email, out IResult? error)
    {
        email = PlanUserIdentity.GetFromRequest(ctx);
        error = null;
        if (email is null)
        {
            error = Results.Json(new { error = "Identificá tu usuario para continuar." }, statusCode: StatusCodes.Status401Unauthorized);
            return false;
        }

        if (!AllowedEmails.Contains(email))
        {
            error = Results.Json(new { error = "No tenés acceso a este módulo." }, statusCode: StatusCodes.Status403Forbidden);
            return false;
        }

        return true;
    }

    private static string? ValidateCreate(BlanqueoCreateRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.NroCaso))
            return "Ingresá el N° de caso.";
        if (string.IsNullOrWhiteSpace(body.NroCliente))
            return "Ingresá el N° de cliente.";
        if (string.IsNullOrWhiteSpace(body.Correo))
            return "Ingresá el correo.";
        if (!LooksLikeEmail(body.Correo.Trim()))
            return "El correo no parece válido.";
        if (string.IsNullOrWhiteSpace(body.TipoSolicitud) || !TiposPermitidos.Contains(body.TipoSolicitud.Trim()))
            return "Elegí Blanqueo o Blanqueo + MFA.";
        return null;
    }

    private static bool LooksLikeEmail(string value) =>
        Regex.IsMatch(value, @"^[^@\s]+@[^@\s]+\.[^@\s]+$");

    internal static string DisplayNameFromEmail(string email)
    {
        var at = email.IndexOf('@');
        var local = at > 0 ? email[..at] : email;
        var parts = local.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length == 0)
            return email;

        return string.Join(' ', parts.Select(p =>
            p.Length == 0 ? p : char.ToUpperInvariant(p[0]) + p[1..].ToLowerInvariant()));
    }
}
