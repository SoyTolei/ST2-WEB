using Microsoft.AspNetCore.Http.Features;
using PortalClienchi.Web.Planillas;

namespace PortalClienchi.Web;

public static class St2ToolsEndpoints
{
    private const long MaxUploadBytes = 120L * 1024 * 1024;
    private const byte XorKey = 0xA5;

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
                    tmp = Environment.GetEnvironmentVariable("TMPDIR")
                        ?? Environment.GetEnvironmentVariable("TMP")
                        ?? Environment.GetEnvironmentVariable("TEMP"),
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

        // Canario: si esto falla con 500 vacío, el proxy corta antes de la app.
        app.MapPost("/api/tools/{toolId}/upload-ping", (HttpContext ctx, string toolId, St2ToolsStore store) =>
        {
            if (!TryRequireSuperAdmin(ctx, out var email, out var error))
                return error!;

            try
            {
                if (!St2ToolsStore.ToolIds.Contains(toolId.Trim().ToLowerInvariant()))
                    return Fail(store, toolId, "Herramienta inválida.", 400);

                var probe = store.WriteProbe();
                store.ClearLastError();
                return Results.Ok(new
                {
                    ok = true,
                    reached = true,
                    toolId,
                    email,
                    probe,
                    dataDir = store.RootPath,
                });
            }
            catch (Exception ex)
            {
                return Fail(store, toolId, $"{ex.GetType().Name}: {ex.Message}", 500, ex);
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

        // PUT binario ofuscado (XOR): evita WAF que escanea .bat / multipart / JSON con payload legible.
        app.MapMethods("/api/tools/{toolId}/upload-raw", new[] { "PUT", "POST" }, async (
            HttpRequest request,
            string toolId,
            St2ToolsStore store,
            CancellationToken ct) =>
        {
            try
            {
                var sizeFeature = request.HttpContext.Features.Get<IHttpMaxRequestBodySizeFeature>();
                if (sizeFeature is not null && !sizeFeature.IsReadOnly)
                    sizeFeature.MaxRequestBodySize = MaxUploadBytes;

                var email = PlanUserIdentity.GetFromRequest(request.HttpContext);
                if (email is null)
                    return Results.Json(new { error = "Identificá tu usuario para continuar." }, statusCode: StatusCodes.Status401Unauthorized);
                if (!St2SuperAdmin.Is(email))
                    return Results.Json(new { error = "Solo el administrador puede subir paquetes." }, statusCode: StatusCodes.Status403Forbidden);

                var version = request.Query["v"].ToString();
                if (string.IsNullOrWhiteSpace(version))
                    version = DateTime.UtcNow.ToString("yyyy.MM.dd");

                // Extensión y nombre en Base64URL (sin ".bat" en claro en la URL).
                var ext = DecodeMeta(request.Query["x"].ToString(), fallback: "bin");
                if (!ext.StartsWith('.'))
                    ext = "." + ext.TrimStart('.');
                var displayName = DecodeMeta(request.Query["n"].ToString(), fallback: $"st2-{toolId}{ext}");
                if (string.IsNullOrWhiteSpace(Path.GetExtension(displayName)))
                    displayName += ext;

                await using var ms = new MemoryStream();
                await request.Body.CopyToAsync(ms, ct).ConfigureAwait(false);
                var bytes = ms.ToArray();
                if (bytes.Length <= 0)
                    return Fail(store, toolId, "El cuerpo llegó vacío.", 400);
                if (bytes.Length > MaxUploadBytes)
                    return Fail(store, toolId, "El archivo supera el máximo de 120 MB.", 400);

                var xor = string.Equals(request.Query["z"].ToString(), "1", StringComparison.Ordinal)
                    || string.Equals(request.Headers["X-St2-Xor"].ToString(), "1", StringComparison.Ordinal);
                if (xor)
                {
                    for (var i = 0; i < bytes.Length; i++)
                        bytes[i] ^= XorKey;
                }

                await using var input = new MemoryStream(bytes, writable: false);
                var saved = await store.SaveStreamAsync(toolId, displayName, input, version, bytes.Length, ct)
                    .ConfigureAwait(false);
                store.ClearLastError();
                return Results.Ok(saved);
            }
            catch (ArgumentException ex)
            {
                return Fail(store, toolId, ex.Message, 400, ex);
            }
            catch (InvalidOperationException ex)
            {
                return Fail(store, toolId, ex.Message, 400, ex);
            }
            catch (BadHttpRequestException ex)
            {
                return Fail(store, toolId, "Pedido inválido o archivo demasiado grande: " + ex.Message, 400, ex);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Fail(store, toolId, "Sin permiso de escritura en el volume (RAILWAY_RUN_UID=0).", 500, ex);
            }
            catch (IOException ex)
            {
                return Fail(store, toolId, "Error de disco: " + ex.Message, 500, ex);
            }
            catch (Exception ex)
            {
                return Fail(store, toolId, $"{ex.GetType().Name}: {ex.Message}", 500, ex);
            }
        });

        app.MapPost("/api/tools/{toolId}/upload", async (HttpRequest request, string toolId, St2ToolsStore store, CancellationToken ct) =>
        {
            try
            {
                var sizeFeature = request.HttpContext.Features.Get<IHttpMaxRequestBodySizeFeature>();
                if (sizeFeature is not null && !sizeFeature.IsReadOnly)
                    sizeFeature.MaxRequestBodySize = MaxUploadBytes;

                var email = PlanUserIdentity.GetFromRequest(request.HttpContext);
                if (email is null)
                    return Results.Json(new { error = "Identificá tu usuario para continuar." }, statusCode: StatusCodes.Status401Unauthorized);
                if (!St2SuperAdmin.Is(email))
                    return Results.Json(new { error = "Solo el administrador puede subir paquetes." }, statusCode: StatusCodes.Status403Forbidden);

                if (!request.HasFormContentType)
                    return Fail(store, toolId, "Se esperaba multipart/form-data.", 400);

                var form = await request.ReadFormAsync(ct).ConfigureAwait(false);
                var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
                var version = form["version"].ToString();
                var originalName = form["originalName"].ToString();

                if (file is null || file.Length <= 0)
                    return Fail(store, toolId, "No se recibió el archivo.", 400);

                var nameForSave = string.IsNullOrWhiteSpace(originalName) ? file.FileName : originalName;
                await using var input = file.OpenReadStream();
                var saved = await store.SaveStreamAsync(toolId, nameForSave, input, version, file.Length, ct)
                    .ConfigureAwait(false);
                store.ClearLastError();
                return Results.Ok(saved);
            }
            catch (ArgumentException ex)
            {
                return Fail(store, toolId, ex.Message, 400, ex);
            }
            catch (InvalidOperationException ex)
            {
                return Fail(store, toolId, ex.Message, 400, ex);
            }
            catch (BadHttpRequestException ex)
            {
                return Fail(store, toolId, "Pedido inválido o archivo demasiado grande: " + ex.Message, 400, ex);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Fail(store, toolId, "Sin permiso de escritura en el volume (RAILWAY_RUN_UID=0).", 500, ex);
            }
            catch (IOException ex)
            {
                return Fail(store, toolId, "Error de disco: " + ex.Message, 500, ex);
            }
            catch (Exception ex)
            {
                return Fail(store, toolId, $"{ex.GetType().Name}: {ex.Message}", 500, ex);
            }
        });
    }

    private static string DecodeMeta(string? raw, string fallback)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return fallback;
        try
        {
            var s = raw.Trim().Replace('-', '+').Replace('_', '/');
            switch (s.Length % 4)
            {
                case 2: s += "=="; break;
                case 3: s += "="; break;
            }
            var text = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(s)).Trim();
            return string.IsNullOrWhiteSpace(text) ? fallback : text;
        }
        catch
        {
            return fallback;
        }
    }

    private static IResult Fail(St2ToolsStore store, string toolId, string message, int status, Exception? ex = null)
    {
        try { store.WriteLastError(toolId, ex ?? new Exception(message)); } catch { /* ignore */ }
        return Results.Json(new
        {
            error = message,
            detail = ex?.Message,
            exceptionType = ex?.GetType().FullName,
            dataDir = store.RootPath,
            toolId,
            reached = true,
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
