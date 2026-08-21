using PortalClienchi.Web.Planillas;

namespace PortalClienchi.Web;

public static class St2ToolsEndpoints
{
    public static void MapSt2ToolsEndpoints(this WebApplication app)
    {
        app.MapGet("/api/tools", (HttpContext ctx, St2ToolsStore store) =>
        {
            if (!TryRequireUser(ctx, out _, out var error))
                return error!;

            return Results.Ok(new { tools = store.List(), dataDir = store.RootPath });
        });

        app.MapGet("/api/tools/{toolId}/download", (HttpContext ctx, string toolId, St2ToolsStore store) =>
        {
            if (!TryRequireUser(ctx, out _, out var error))
                return error!;

            if (!store.TryOpen(toolId, out var path, out var meta) || meta is null)
                return Results.NotFound(new { error = "Todavía no hay un paquete publicado para esa herramienta." });

            var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            return Results.File(stream, meta.ContentType, meta.FileName, enableRangeProcessing: true);
        });

        app.MapPost("/api/tools/{toolId}/upload", async (HttpContext ctx, string toolId, St2ToolsStore store) =>
        {
            if (!TryRequireSuperAdmin(ctx, out _, out var error))
                return error!;

            if (!ctx.Request.HasFormContentType)
                return Results.Json(new { error = "Enviá el archivo como multipart/form-data." }, statusCode: StatusCodes.Status400BadRequest);

            IFormFile? file;
            string? version;
            try
            {
                var form = await ctx.Request.ReadFormAsync(ctx.RequestAborted);
                file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
                version = form["version"].ToString();
            }
            catch (Exception ex)
            {
                return Results.Json(new { error = "No se pudo leer el formulario: " + ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }

            if (file is null || file.Length <= 0)
                return Results.Json(new { error = "Falta el archivo." }, statusCode: StatusCodes.Status400BadRequest);

            try
            {
                await using var stream = file.OpenReadStream();
                var saved = await store.SaveUploadAsync(toolId, file.FileName, stream, version, file.Length, ctx.RequestAborted);
                return Results.Ok(saved);
            }
            catch (ArgumentException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Results.Json(new
                {
                    error = "Sin permiso para escribir en el volume. Verificá mount /data/st2 y RAILWAY_RUN_UID=0 si hace falta.",
                    detail = ex.Message,
                    dataDir = store.RootPath,
                }, statusCode: StatusCodes.Status500InternalServerError);
            }
            catch (IOException ex)
            {
                return Results.Json(new
                {
                    error = "Error de disco al guardar el paquete.",
                    detail = ex.Message,
                    dataDir = store.RootPath,
                }, statusCode: StatusCodes.Status500InternalServerError);
            }
            catch (Exception ex)
            {
                return Results.Json(new
                {
                    error = "No se pudo guardar el paquete.",
                    detail = ex.Message,
                    dataDir = store.RootPath,
                }, statusCode: StatusCodes.Status500InternalServerError);
            }
        }).DisableAntiforgery();
    }

    private static bool TryRequireUser(HttpContext ctx, out string? email, out IResult? error)
    {
        email = PlanUserIdentity.GetFromRequest(ctx);
        error = null;
        if (email is null)
        {
            error = Results.Json(new { error = "Identificá tu usuario para continuar." }, statusCode: StatusCodes.Status401Unauthorized);
            return false;
        }
        return true;
    }

    private static bool TryRequireSuperAdmin(HttpContext ctx, out string? email, out IResult? error)
    {
        if (!TryRequireUser(ctx, out email, out error))
            return false;
        if (!St2SuperAdmin.Is(email))
        {
            error = Results.Json(new { error = "Solo el administrador puede subir paquetes." }, statusCode: StatusCodes.Status403Forbidden);
            return false;
        }
        return true;
    }
}
