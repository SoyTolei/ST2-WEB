using System.Globalization;
using System.Text.RegularExpressions;

namespace PortalClienchi.Web.Planillas;

public static class BlanqueoEndpoints
{
    private static readonly HashSet<string> PortalesPermitidos = new(StringComparer.OrdinalIgnoreCase)
    {
        "OnBalance",
        "Onvio",
        "PortalCliente",
    };

    private static readonly Dictionary<string, HashSet<string>> TiposPorPortal = new(StringComparer.OrdinalIgnoreCase)
    {
        ["OnBalance"] = new(StringComparer.OrdinalIgnoreCase) { "Blanqueo", "Blanqueo + MFA" },
        ["Onvio"] = new(StringComparer.OrdinalIgnoreCase) { "Blanqueo MFA" },
        ["PortalCliente"] = new(StringComparer.OrdinalIgnoreCase) { "Activación", "Cambio de contraseña" },
    };

    public static void MapBlanqueoEndpoints(this WebApplication app)
    {
        app.MapGet("/api/planillas/blanqueo", (HttpContext ctx, BlanqueoRepository repo, ModuleAccessRepository modules) =>
        {
            if (!TryAuthorize(ctx, modules, requireConfirm: false, out var email, out var flags, out var error))
                return error!;

            return Results.Ok(new
            {
                items = repo.LoadAll(),
                usuario = email,
                canConfirm = flags.BlanqueoConfirm,
                claveBlanqueo = BlanqueoClave.Actual,
                storage = new { ready = repo.StorageReady, path = repo.DatabasePath },
            });
        });

        app.MapGet("/api/planillas/blanqueo/export", (HttpContext ctx, BlanqueoRepository repo, ModuleAccessRepository modules) =>
        {
            if (!TryAuthorize(ctx, modules, requireConfirm: true, out _, out _, out var error))
                return error!;

            var bytes = BlanqueoExcel.BuildExportWorkbook(repo.LoadAll());
            var name = $"blanqueo-export-{DateTime.Now:yyyyMMdd-HHmm}.xlsx";
            return Results.File(
                bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                name);
        });

        app.MapGet("/api/planillas/blanqueo/import-template", (HttpContext ctx, ModuleAccessRepository modules) =>
        {
            if (!TryAuthorize(ctx, modules, requireConfirm: true, out _, out _, out var error))
                return error!;

            var bytes = BlanqueoExcel.BuildImportTemplate();
            return Results.File(
                bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "blanqueo-plantilla-import.xlsx");
        });

        app.MapPost("/api/planillas/blanqueo/import", async (HttpContext ctx, BlanqueoRepository repo, ModuleAccessRepository modules, CancellationToken ct) =>
        {
            if (!TryAuthorize(ctx, modules, requireConfirm: true, out _, out _, out var error))
                return error!;

            if (!ctx.Request.HasFormContentType)
                return Results.BadRequest(new { error = "Se esperaba multipart/form-data con el Excel." });

            var form = await ctx.Request.ReadFormAsync(ct).ConfigureAwait(false);
            var file = form.Files.FirstOrDefault();
            if (file is null || file.Length == 0)
                return Results.BadRequest(new { error = "Subí un archivo Excel (.xlsx)." });

            var ext = Path.GetExtension(file.FileName);
            if (!ext.Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
                return Results.BadRequest(new { error = "Solo se acepta .xlsx. Descargá la plantilla o guardá el Excel anterior como .xlsx." });

            try
            {
                await using var stream = file.OpenReadStream();
                var (rows, parseErrors) = BlanqueoExcel.ParseImport(stream, file.FileName);
                if (rows.Count == 0)
                {
                    return Results.BadRequest(new
                    {
                        error = "No se importó ninguna fila.",
                        details = parseErrors.Take(20).ToArray(),
                    });
                }

                var inserted = repo.InsertHistoricalBatch(rows);
                return Results.Ok(new
                {
                    ok = true,
                    inserted,
                    skippedErrors = parseErrors.Count,
                    details = parseErrors.Take(30).ToArray(),
                });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, title: "No se pudo importar el Excel");
            }
        });

        app.MapGet("/api/planillas/blanqueo/alerts", (HttpContext ctx, BlanqueoRepository repo, ModuleAccessRepository modules) =>
        {
            if (!TryAuthorize(ctx, modules, requireConfirm: false, out var email, out var flags, out var error))
                return error!;

            // Quien confirma ve la cola de pendientes; el resto, avisos personales.
            if (flags.BlanqueoConfirm)
            {
                var pending = repo.ListPendingForConfirm();
                return Results.Ok(new
                {
                    mode = "confirm",
                    count = pending.Count,
                    items = pending,
                    claveBlanqueo = BlanqueoClave.Actual,
                });
            }

            var alerts = repo.ListUnseenAlerts(email!);
            return Results.Ok(new
            {
                mode = "requester",
                count = alerts.Count,
                items = alerts,
                claveBlanqueo = BlanqueoClave.Actual,
            });
        });

        app.MapPost("/api/planillas/blanqueo/alerts/seen", async (HttpContext ctx, BlanqueoRepository repo, ModuleAccessRepository modules, CancellationToken ct) =>
        {
            if (!TryAuthorize(ctx, modules, requireConfirm: false, out var email, out var flags, out var error))
                return error!;

            // Para confirmadores el "visto" es solo UI (toast); la cola sigue en badge hasta marcar listo.
            if (flags.BlanqueoConfirm)
                return Results.Ok(new { ok = true, marked = 0, mode = "confirm" });

            int[]? ids = null;
            try
            {
                var body = await ctx.Request.ReadFromJsonAsync<BlanqueoAlertsSeenRequest>(cancellationToken: ct).ConfigureAwait(false);
                ids = body?.Ids;
            }
            catch
            {
                // body opcional: sin ids marca todas
            }

            var marked = repo.MarkAlertsSeen(email!, ids);
            return Results.Ok(new { ok = true, marked, mode = "requester" });
        });

        app.MapPost("/api/planillas/blanqueo", (HttpContext ctx, BlanqueoCreateRequest body, BlanqueoRepository repo, ModuleAccessRepository modules) =>
        {
            if (!TryAuthorize(ctx, modules, requireConfirm: false, out var email, out _, out var error))
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

        app.MapPut("/api/planillas/blanqueo/{id:int}", (HttpContext ctx, int id, BlanqueoUpdateRequest body, BlanqueoRepository repo, ModuleAccessRepository modules) =>
        {
            if (!TryAuthorize(ctx, modules, requireConfirm: false, out var email, out var flags, out var error))
                return error!;

            var current = repo.GetById(id);
            if (current is null)
                return Results.NotFound(new { error = "Solicitud no encontrada." });

            if (!IsOwner(current, email!) && !flags.BlanqueoConfirm)
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
                TipoSolicitud = NormalizeTipo(body.TipoSolicitud),
            };

            var updated = repo.UpdateOwnerFields(id, normalized);
            return updated is null
                ? Results.NotFound(new { error = "Solicitud no encontrada." })
                : Results.Ok(updated);
        });

        app.MapPatch("/api/planillas/blanqueo/{id:int}", (HttpContext ctx, int id, BlanqueoPatchRequest body, BlanqueoRepository repo, ModuleAccessRepository modules) =>
        {
            if (!TryAuthorize(ctx, modules, requireConfirm: true, out _, out _, out var error))
                return error!;

            if (body.Aclaracion is not null && body.Aclaracion.Trim().Length > 280)
                return Results.BadRequest(new { error = "La aclaración es demasiado larga (máx. 280)." });

            var updated = repo.PatchConfirm(id, body);
            if (updated is null)
                return Results.NotFound(new { error = "Solicitud no encontrada." });

            return Results.Ok(updated);
        });

        app.MapDelete("/api/planillas/blanqueo/{id:int}", (HttpContext ctx, int id, BlanqueoRepository repo, ModuleAccessRepository modules) =>
        {
            if (!TryAuthorize(ctx, modules, requireConfirm: false, out var email, out var flags, out var error))
                return error!;

            var current = repo.GetById(id);
            if (current is null)
                return Results.NotFound(new { error = "Solicitud no encontrada." });

            if (!IsOwner(current, email!) && !flags.BlanqueoConfirm)
                return Results.Json(new { error = "Solo podés eliminar tus propias solicitudes." }, statusCode: StatusCodes.Status403Forbidden);

            if (!repo.Delete(id))
                return Results.NotFound(new { error = "Solicitud no encontrada." });

            return Results.Ok(new { ok = true });
        });
    }

    private static bool IsOwner(BlanqueoRecordDto item, string email) =>
        string.Equals(item.SolicitadoPorEmail, email, StringComparison.OrdinalIgnoreCase);

    private static bool TryAuthorize(
        HttpContext ctx,
        ModuleAccessRepository modules,
        bool requireConfirm,
        out string? email,
        out ModuleAccessFlagsDto flags,
        out IResult? error)
    {
        email = PlanUserIdentity.GetFromRequest(ctx);
        flags = new ModuleAccessFlagsDto();
        error = null;
        if (email is null)
        {
            error = Results.Json(new { error = "Identificá tu usuario para continuar." }, statusCode: StatusCodes.Status401Unauthorized);
            return false;
        }

        flags = modules.GetFlags(email);
        if (!flags.Blanqueo)
        {
            error = Results.Json(new { error = "No tenés acceso a este módulo." }, statusCode: StatusCodes.Status403Forbidden);
            return false;
        }

        if (requireConfirm && !flags.BlanqueoConfirm)
        {
            error = Results.Json(new { error = "No tenés permiso para confirmar o aclarar." }, statusCode: StatusCodes.Status403Forbidden);
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
        TipoSolicitud = NormalizeTipo(body.TipoSolicitud),
    };

    private static string NormalizePortal(string? portal)
    {
        var value = (portal ?? "").Trim();
        if (value.Equals("OnBalance", StringComparison.OrdinalIgnoreCase)
            || value.Equals("On Balance", StringComparison.OrdinalIgnoreCase))
            return "OnBalance";
        if (value.Equals("Onvio", StringComparison.OrdinalIgnoreCase)
            || value.Equals("ONVIO", StringComparison.OrdinalIgnoreCase))
            return "Onvio";
        if (value.Equals("PortalCliente", StringComparison.OrdinalIgnoreCase)
            || value.Equals("Portal Cliente", StringComparison.OrdinalIgnoreCase))
            return "PortalCliente";
        return value;
    }

    private static string NormalizeTipo(string? tipo)
    {
        var value = (tipo ?? "").Trim();
        if (value.Equals("Activacion", StringComparison.OrdinalIgnoreCase))
            return "Activación";
        if (value.Equals("Cambio de contraseña", StringComparison.OrdinalIgnoreCase)
            || value.Equals("Cambio de password", StringComparison.OrdinalIgnoreCase))
            return "Cambio de contraseña";
        if (value.Equals("Blanqueo MFA", StringComparison.OrdinalIgnoreCase)
            || value.Equals("Blanqueo+MFA", StringComparison.OrdinalIgnoreCase))
            return "Blanqueo MFA";
        if (value.Equals("Blanqueo + MFA", StringComparison.OrdinalIgnoreCase))
            return "Blanqueo + MFA";
        if (value.Equals("Blanqueo", StringComparison.OrdinalIgnoreCase))
            return "Blanqueo";
        return value;
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
        var portal = NormalizePortal(body.Portal);
        if (string.IsNullOrWhiteSpace(portal) || !PortalesPermitidos.Contains(portal))
            return "Elegí On Balance, ONVIO o Portal Cliente.";
        if (string.IsNullOrWhiteSpace(body.NroCaso))
            return "Ingresá el N° de caso.";
        if (string.IsNullOrWhiteSpace(body.NroCliente))
            return "Ingresá el N° de cliente.";
        if (string.IsNullOrWhiteSpace(body.Correo))
            return "Ingresá el correo.";
        if (!LooksLikeEmail(body.Correo.Trim()))
            return "El correo no parece válido.";

        var tipo = NormalizeTipo(body.TipoSolicitud);
        if (!TiposPorPortal.TryGetValue(portal, out var tipos) || !tipos.Contains(tipo))
            return portal switch
            {
                "OnBalance" => "En On Balance elegí Blanqueo o Blanqueo + MFA.",
                "Onvio" => "En ONVIO elegí Blanqueo MFA.",
                "PortalCliente" => "En Portal Cliente elegí Activación o Cambio de contraseña.",
                _ => "Elegí un tipo de solicitud válido para la plataforma.",
            };

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
