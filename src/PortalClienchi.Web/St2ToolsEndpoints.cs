using Microsoft.AspNetCore.Http.Features;
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

            return Results.Ok(new
            {
                tools = store.List(),
                dataDir = store.RootPath,
                lastError = store.ReadLastError(),
            });
        });

        app.MapGet("/api/tools/diag", (HttpContext ctx, St2ToolsStore store) =>
        {
            if (!TryRequireSuperAdmin(ctx, out _, out var error))
                return error!;

            try
            {
                var probe = store.WriteProbe();
                return Results.Ok(new
                {
                    ok = true,
                    dataDir = store.RootPath,
                    probe,
                    lastError = store.ReadLastError(),
                });
            }
            catch (Exception ex)
            {
                store.WriteLastError("diag", ex);
                return Results.Json(new
                {
                    ok = false,
                    dataDir = store.RootPath,
                    error = ex.Message,
                    lastError = store.ReadLastError(),
                }, statusCode: StatusCodes.Status500InternalServerError);
            }
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

        // Mismo esquema que /api/planillas/capturas/upload (ya funciona en Railway).
        app.MapPost("/api/tools/{toolId}/upload", async (HttpContext ctx, string toolId, St2ToolsStore store) =>
        {
            try
            {
                var sizeFeature = ctx.Features.Get<IHttpMaxRequestBodySizeFeature>();
                if (sizeFeature is not null && !sizeFeature.IsReadOnly)
                    sizeFeature.MaxRequestBodySize = 120L * 1024 * 1024;

                if (!TryRequireSuperAdmin(ctx, out _, out var error))
                    return error!;

                if (!ctx.Request.HasFormContentType)
                    return Fail(store, toolId, "Enviá el archivo como multipart/form-data.", StatusCodes.Status400BadRequest);

                var form = await ctx.Request.ReadFormAsync(ctx.RequestAborted).ConfigureAwait(false);
                var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
                var version = form["version"].ToString();

                if (file is null || file.Length <= 0)
                    return Fail(store, toolId, "Falta el archivo.", StatusCodes.Status400BadRequest);

                var tmpPath = store.BeginTempFile(toolId);
                try
                {
                    await using (var fs = new FileStream(
                                     tmpPath,
                                     FileMode.Create,
                                     FileAccess.Write,
                                     FileShare.None,
                                     64 * 1024,
                                     FileOptions.Asynchronous | FileOptions.SequentialScan))
                    await using (var input = file.OpenReadStream())
                    {
                        await input.CopyToAsync(fs, ctx.RequestAborted).ConfigureAwait(false);
                        await fs.FlushAsync(ctx.RequestAborted).ConfigureAwait(false);
                    }

                    var saved = store.CommitTempFile(toolId, tmpPath, file.FileName, version, new FileInfo(tmpPath).Length);
                    store.ClearLastError();
                    return Results.Ok(saved);
                }
                catch
                {
                    try { if (File.Exists(tmpPath)) File.Delete(tmpPath); } catch { /* ignore */ }
                    throw;
                }
            }
            catch (ArgumentException ex)
            {
                return Fail(store, toolId, ex.Message, StatusCodes.Status400BadRequest, ex);
            }
            catch (InvalidOperationException ex)
            {
                return Fail(store, toolId, ex.Message, StatusCodes.Status400BadRequest, ex);
            }
            catch (BadHttpRequestException ex)
            {
                return Fail(store, toolId, "Pedido inválido o archivo demasiado grande: " + ex.Message, StatusCodes.Status400BadRequest, ex);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Fail(
                    store,
                    toolId,
                    "Sin permiso para escribir en el volume. En Railway: Volume en /data/st2 y RAILWAY_RUN_UID=0.",
                    StatusCodes.Status500InternalServerError,
                    ex);
            }
            catch (Exception ex)
            {
                return Fail(
                    store,
                    toolId,
                    "No se pudo guardar el paquete: " + ex.GetType().Name + ": " + ex.Message,
                    StatusCodes.Status500InternalServerError,
                    ex);
            }
        }).DisableAntiforgery();
    }

    private static IResult Fail(St2ToolsStore store, string toolId, string message, int status, Exception? ex = null)
    {
        try { store.WriteLastError(toolId, ex ?? new Exception(message)); } catch { /* ignore */ }
        return Results.Json(new
        {
            error = message,
            detail = ex?.ToString(),
            dataDir = store.RootPath,
            toolId,
        }, statusCode: status);
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
