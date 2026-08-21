using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.Features;
using PortalClienchi.Web.Planillas;

namespace PortalClienchi.Web;

public static class St2ToolsEndpoints
{
    private const long MaxUploadBytes = 120L * 1024 * 1024;
    private const byte XorKey = 0xA5;

    private static readonly Regex CapturaIdRegex = new(
        @"^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{8}$",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);

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

        // Publica un paquete ya subido por el canal de capturas (TXT), que en prod sí funciona.
        app.MapPost("/api/tools/{toolId}/publish", async (
            HttpContext ctx,
            string toolId,
            St2ToolsStore store,
            LocalCapturaStore capturas,
            CancellationToken ct) =>
        {
            try
            {
                if (!TryRequireSuperAdmin(ctx, out _, out var error))
                    return error!;

                var body = await ctx.Request.ReadFromJsonAsync<PublishRequest>(ct).ConfigureAwait(false);
                if (body is null)
                    return Fail(store, toolId, "Cuerpo inválido.", 400);

                var capturaId = ParseCapturaId(body.CapturaId ?? body.Url);
                if (capturaId is null)
                    return Fail(store, toolId, "Falta el id de captura (/c/…).", 400);

                if (!capturas.TryOpenById(capturaId, out LocalMediaOpen? open) || open is null)
                    return Fail(store, toolId, "No se encontró el archivo temporal de captura.", 404);

                var bytes = await File.ReadAllBytesAsync(open.FullPath, ct).ConfigureAwait(false);
                if (bytes.Length <= 0)
                    return Fail(store, toolId, "El archivo temporal está vacío.", 400);
                if (bytes.Length > MaxUploadBytes)
                    return Fail(store, toolId, "El archivo supera el máximo de 120 MB.", 400);

                if (body.Xor)
                {
                    for (var i = 0; i < bytes.Length; i++)
                        bytes[i] ^= XorKey;
                }

                var fileName = string.IsNullOrWhiteSpace(body.FileName)
                    ? $"st2-{toolId}.bin"
                    : body.FileName.Trim();

                await using var input = new MemoryStream(bytes, writable: false);
                var saved = await store.SaveStreamAsync(toolId, fileName, input, body.Version, bytes.Length, ct)
                    .ConfigureAwait(false);

                try { capturas.TryDeleteById(capturaId); } catch { /* ignore */ }
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

        // Fallback legacy multipart (zip grandes, etc.).
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

    private static string? ParseCapturaId(string? urlOrId)
    {
        if (string.IsNullOrWhiteSpace(urlOrId))
            return null;

        var s = urlOrId.Trim();
        if (CapturaIdRegex.IsMatch(s))
            return s;

        try
        {
            if (Uri.TryCreate(s, UriKind.Absolute, out var abs))
                s = abs.AbsolutePath;
            var marker = s.LastIndexOf("/c/", StringComparison.OrdinalIgnoreCase);
            if (marker >= 0)
                s = s[(marker + 3)..];
            s = s.Split('?', '#')[0].Trim('/');
            var id = s.Split('/')[0];
            return CapturaIdRegex.IsMatch(id) ? id : null;
        }
        catch
        {
            return null;
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

    private sealed class PublishRequest
    {
        public string? CapturaId { get; set; }
        public string? Url { get; set; }
        public string? FileName { get; set; }
        public string? Version { get; set; }
        [JsonPropertyName("xor")]
        public bool Xor { get; set; } = true;
    }
}
