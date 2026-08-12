using System.Globalization;
using System.Text.RegularExpressions;

namespace PortalClienchi.Web.Planillas;

public static class BlanqueoEndpoints
{
    private static readonly HashSet<string> AllowedEmails = new(StringComparer.OrdinalIgnoreCase)
    {
        "leonel.gallo@thomsonreuters.com",
        "sabrinacecilia.rodriguezcuaglia@thomsonreuters.com",
        "alexis.ruiz@thomsonreuters.com",
        "yohanaelizabeth.orellana@thomsonreuters.com",
    };

    private static readonly HashSet<string> ConfirmerEmails = new(StringComparer.OrdinalIgnoreCase)
    {
        "leonel.gallo@thomsonreuters.com",
        "alexis.ruiz@thomsonreuters.com",
        "yohanaelizabeth.orellana@thomsonreuters.com",
    };

    private static readonly HashSet<string> PortalesPermitidos = new(StringComparer.OrdinalIgnoreCase)
    {
        "OnBalance",
        "PortalCliente",
    };

    private static readonly HashSet<string> TiposPermitidos = new(StringComparer.OrdinalIgnoreCase)
    {
        "Blanqueo",
        "Blanqueo + MFA",
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
                canConfirm = ConfirmerEmails.Contains(email!),
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
                var item = repo.Insert(NormalizeCreate(body), email!, nombre, fecha);
                return Results.Ok(item);
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, title: "No se pudo guardar la solicitud");
            }
        });

        app.MapPut("/api/planillas/blanqueo/{id:int}", (HttpContext ctx, int id, BlanqueoUpdateRequest body, BlanqueoRepository repo) =>
        {
            if (!TryAuthorize(ctx, out var email, out var error))
                return error!;

            var current = repo.GetById(id);
            if (current is null)
                return Results.NotFound(new { error = "Solicitud no encontrada." });

            if (!IsOwner(current, email!) && !ConfirmerEmails.Contains(email!))
                return Results.Json(new { error = "Solo podés editar tus propias solicitudes." }, statusCode: StatusCodes.Status403Forbidden);

            var validation = ValidateUpdate(body);
            if (validation is not null)
                return Results.BadRequest(new { error = validation });

            var normalized = new BlanqueoUpdateRequest
            {
                Portal = NormalizePortal(body.Portal),
                NroCaso = body.NroCaso.Trim(),
                NroCliente = body.NroCliente.Trim(),
                Correo = body.Correo.Trim(),
                TipoSolicitud = body.TipoSolicitud.Trim(),
            };

            var updated = repo.UpdateOwnerFields(id, normalized);
            return updated is null
                ? Results.NotFound(new { error = "Solicitud no encontrada." })
                : Results.Ok(updated);
        });

        app.MapPatch("/api/planillas/blanqueo/{id:int}", (HttpContext ctx, int id, BlanqueoPatchRequest body, BlanqueoRepository repo) =>
        {
            if (!TryAuthorize(ctx, out var email, out var error))
                return error!;

            if (!ConfirmerEmails.Contains(email!))
                return Results.Json(new { error = "No tenés permiso para confirmar o aclarar." }, statusCode: StatusCodes.Status403Forbidden);

            if (body.Aclaracion is not null && body.Aclaracion.Trim().Length > 280)
                return Results.BadRequest(new { error = "La aclaración es demasiado larga (máx. 280)." });

            var updated = repo.PatchConfirm(id, body);
            if (updated is null)
                return Results.NotFound(new { error = "Solicitud no encontrada." });

            return Results.Ok(updated);
        });

        app.MapDelete("/api/planillas/blanqueo/{id:int}", (HttpContext ctx, int id, BlanqueoRepository repo) =>
        {
            if (!TryAuthorize(ctx, out var email, out var error))
                return error!;

            var current = repo.GetById(id);
            if (current is null)
                return Results.NotFound(new { error = "Solicitud no encontrada." });

            if (!IsOwner(current, email!) && !ConfirmerEmails.Contains(email!))
                return Results.Json(new { error = "Solo podés eliminar tus propias solicitudes." }, statusCode: StatusCodes.Status403Forbidden);

            if (!repo.Delete(id))
                return Results.NotFound(new { error = "Solicitud no encontrada." });

            return Results.Ok(new { ok = true });
        });
    }

    private static bool IsOwner(BlanqueoRecordDto item, string email) =>
        string.Equals(item.SolicitadoPorEmail, email, StringComparison.OrdinalIgnoreCase);

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

    private static BlanqueoCreateRequest NormalizeCreate(BlanqueoCreateRequest body) => new()
    {
        Portal = NormalizePortal(body.Portal),
        NroCaso = body.NroCaso.Trim(),
        NroCliente = body.NroCliente.Trim(),
        Correo = body.Correo.Trim(),
        TipoSolicitud = body.TipoSolicitud.Trim(),
    };

    private static string NormalizePortal(string? portal)
    {
        var value = (portal ?? "").Trim();
        if (value.Equals("OnBalance", StringComparison.OrdinalIgnoreCase))
            return "OnBalance";
        return "PortalCliente";
    }

    private static string? ValidateCreate(BlanqueoCreateRequest body)
    {
        return ValidateUpdate(new BlanqueoUpdateRequest
        {
            Portal = body.Portal,
            NroCaso = body.NroCaso,
            NroCliente = body.NroCliente,
            Correo = body.Correo,
            TipoSolicitud = body.TipoSolicitud,
        });
    }

    private static string? ValidateUpdate(BlanqueoUpdateRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.Portal) || !PortalesPermitidos.Contains(body.Portal.Trim()))
            return "Elegí On Balance o Portal Cliente.";
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
