using System.Globalization;
using System.Text.RegularExpressions;

namespace PortalClienchi.Web.Planillas;

public static class BorradoBasesEndpoints
{
    public static void MapBorradoBasesEndpoints(this WebApplication app)
    {
        app.MapGet("/api/planillas/borrado-bases", (HttpContext ctx, BorradoBasesRepository repo, ModuleAccessRepository modules) =>
        {
            if (!TryAuthorize(ctx, modules, requireConfirm: false, out var email, out var flags, out var error))
                return error!;

            return Results.Ok(new
            {
                items = repo.LoadAll(),
                usuario = email,
                canConfirm = flags.BorradoBasesConfirm,
                canLoad = flags.BorradoBasesLoad,
                storage = new { ready = repo.StorageReady, path = repo.DatabasePath },
            });
        });

        app.MapPost("/api/planillas/borrado-bases", (
            HttpContext ctx,
            BorradoBasesCreateRequest body,
            BorradoBasesRepository repo,
            ModuleAccessRepository modules,
            AppAccessRepository accessRepo) =>
        {
            if (!TryAuthorize(ctx, modules, requireConfirm: false, out var email, out var flags, out var error))
                return error!;
            if (!flags.BorradoBasesLoad)
                return Results.Json(new { error = "Tu perfil es solo listado: no podés cargar solicitudes." }, statusCode: StatusCodes.Status403Forbidden);

            var validation = ValidateCreate(body);
            if (validation is not null)
                return Results.BadRequest(new { error = validation });

            try
            {
                var fecha = DateTime.Now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                var access = accessRepo.Find(email!);
                var nombre = !string.IsNullOrWhiteSpace(access?.DisplayName)
                    ? access!.DisplayName!.Trim()
                    : DisplayNameFromEmail(email!);
                var item = repo.Insert(NormalizeCreate(body), email!, nombre, fecha);
                return Results.Ok(item);
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, title: "No se pudo guardar la solicitud");
            }
        });

        app.MapPut("/api/planillas/borrado-bases/{id:int}", (
            HttpContext ctx,
            int id,
            BorradoBasesUpdateRequest body,
            BorradoBasesRepository repo,
            ModuleAccessRepository modules) =>
        {
            if (!TryAuthorize(ctx, modules, requireConfirm: false, out var email, out var flags, out var error))
                return error!;

            var current = repo.GetById(id);
            if (current is null)
                return Results.NotFound(new { error = "Solicitud no encontrada." });

            if (!IsOwner(current, email!) && !flags.BorradoBasesConfirm)
                return Results.Json(new { error = "Solo podés editar tus propias solicitudes." }, statusCode: StatusCodes.Status403Forbidden);

            var validation = ValidateUpdate(body);
            if (validation is not null)
                return Results.BadRequest(new { error = validation });

            var updated = repo.UpdateOwnerFields(id, NormalizeUpdate(body));
            return updated is null
                ? Results.NotFound(new { error = "Solicitud no encontrada." })
                : Results.Ok(updated);
        });

        app.MapPatch("/api/planillas/borrado-bases/{id:int}", (
            HttpContext ctx,
            int id,
            BorradoBasesPatchRequest body,
            BorradoBasesRepository repo,
            ModuleAccessRepository modules) =>
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

        app.MapDelete("/api/planillas/borrado-bases/{id:int}", (
            HttpContext ctx,
            int id,
            BorradoBasesRepository repo,
            ModuleAccessRepository modules) =>
        {
            if (!TryAuthorize(ctx, modules, requireConfirm: false, out var email, out var flags, out var error))
                return error!;

            var current = repo.GetById(id);
            if (current is null)
                return Results.NotFound(new { error = "Solicitud no encontrada." });

            if (!IsOwner(current, email!) && !flags.BorradoBasesConfirm)
                return Results.Json(new { error = "Solo podés eliminar tus propias solicitudes." }, statusCode: StatusCodes.Status403Forbidden);

            if (!repo.Delete(id))
                return Results.NotFound(new { error = "Solicitud no encontrada." });

            return Results.Ok(new { ok = true });
        });
    }

    private static bool IsOwner(BorradoBasesRecordDto item, string email) =>
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
        if (!flags.BorradoBases)
        {
            error = Results.Json(new { error = "No tenés acceso a este módulo." }, statusCode: StatusCodes.Status403Forbidden);
            return false;
        }

        if (requireConfirm && !flags.BorradoBasesConfirm)
        {
            error = Results.Json(new { error = "No tenés permiso para confirmar o aclarar." }, statusCode: StatusCodes.Status403Forbidden);
            return false;
        }

        return true;
    }

    private static BorradoBasesCreateRequest NormalizeCreate(BorradoBasesCreateRequest body) => new()
    {
        NroCaso = body.NroCaso.Trim(),
        NroCliente = body.NroCliente.Trim(),
        NroEmpresa = body.NroEmpresa.Trim(),
        NombreEmpresa = body.NombreEmpresa.Trim(),
        Cuil = NormalizeCuil(body.Cuil),
        Iva = body.Iva,
        Sueldos = body.Sueldos,
        Contabilidad = body.Contabilidad,
        IvaDetalle = null,
        SueldosDetalle = null,
        EjerciciosDetalle = body.Contabilidad ? NullIfBlank(body.EjerciciosDetalle) : null,
    };

    private static BorradoBasesUpdateRequest NormalizeUpdate(BorradoBasesUpdateRequest body) => new()
    {
        NroCaso = body.NroCaso.Trim(),
        NroCliente = body.NroCliente.Trim(),
        NroEmpresa = body.NroEmpresa.Trim(),
        NombreEmpresa = body.NombreEmpresa.Trim(),
        Cuil = NormalizeCuil(body.Cuil),
        Iva = body.Iva,
        Sueldos = body.Sueldos,
        Contabilidad = body.Contabilidad,
        IvaDetalle = null,
        SueldosDetalle = null,
        EjerciciosDetalle = body.Contabilidad ? NullIfBlank(body.EjerciciosDetalle) : null,
    };

    private static string? ValidateCreate(BorradoBasesCreateRequest body) => ValidateFields(body);

    private static string? ValidateUpdate(BorradoBasesUpdateRequest body) => ValidateFields(new BorradoBasesCreateRequest
    {
        NroCaso = body.NroCaso,
        NroCliente = body.NroCliente,
        NroEmpresa = body.NroEmpresa,
        NombreEmpresa = body.NombreEmpresa,
        Cuil = body.Cuil,
        Iva = body.Iva,
        Sueldos = body.Sueldos,
        Contabilidad = body.Contabilidad,
        EjerciciosDetalle = body.EjerciciosDetalle,
    });

    private static string? ValidateFields(BorradoBasesCreateRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.NroCaso))
            return "Completá el N° de caso.";
        if (string.IsNullOrWhiteSpace(body.NroCliente))
            return "Completá el N° de cliente.";
        if (string.IsNullOrWhiteSpace(body.NroEmpresa))
            return "Completá el N° de empresa.";
        if (string.IsNullOrWhiteSpace(body.NombreEmpresa))
            return "Completá el nombre de empresa.";
        if (string.IsNullOrWhiteSpace(body.Cuil))
            return "Completá el CUIL.";
        if (NormalizeCuil(body.Cuil).Length > 20)
            return "El CUIL es demasiado largo.";
        if (!body.Iva && !body.Sueldos && !body.Contabilidad)
            return "Marcá al menos una base a borrar.";
        if (body.Contabilidad && string.IsNullOrWhiteSpace(body.EjerciciosDetalle))
            return "Si marcás Contabilidad, completá los ejercicios a borrar.";
        if ((body.EjerciciosDetalle ?? "").Trim().Length > 4000)
            return "El detalle de ejercicios es demasiado largo (máx. 4000).";
        return null;
    }

    private static string NormalizeCuil(string? value) =>
        Regex.Replace((value ?? "").Trim(), @"\s+", " ");

    private static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static string DisplayNameFromEmail(string email)
    {
        var local = email.Split('@')[0];
        var parts = Regex.Split(local, @"[._\-]+")
            .Where(p => p.Length > 0)
            .Select(p => char.ToUpperInvariant(p[0]) + p[1..].ToLowerInvariant());
        return string.Join(' ', parts);
    }
}
