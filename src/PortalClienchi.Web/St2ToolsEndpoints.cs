using System.Text;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using PortalClienchi.Web.Planillas;

namespace PortalClienchi.Web;

public static class St2ToolsEndpoints
{
    private const byte XorKey = 0xA5;
    private const int MaxPartBytes = 8 * 1024;

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
                    reached = true,
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

        // Inicio de subida por partes (JSON chico, solo hex después).
        app.MapPost("/api/tools/{toolId}/parts/begin", async (HttpContext ctx, string toolId, St2ToolsStore store, CancellationToken ct) =>
        {
            try
            {
                if (!TryRequireSuperAdmin(ctx, out _, out var error))
                    return error!;

                var body = await ctx.Request.ReadFromJsonAsync<PartsBeginRequest>(ct).ConfigureAwait(false);
                if (body is null || string.IsNullOrWhiteSpace(body.U) || body.T < 1)
                    return Fail(store, toolId, "Pedido de inicio inválido.", 400);

                var session = store.BeginPartUpload(toolId, body.U, body.T);
                store.ClearLastError();
                return Results.Ok(new { ok = true, reached = true, u = session, t = body.T, dataDir = store.RootPath });
            }
            catch (ArgumentException ex)
            {
                return Fail(store, toolId, ex.Message, 400, ex);
            }
            catch (Exception ex)
            {
                return Fail(store, toolId, $"{ex.GetType().Name}: {ex.Message}", 500, ex);
            }
        });

        app.MapPost("/api/tools/{toolId}/parts/push", async (HttpContext ctx, string toolId, St2ToolsStore store, CancellationToken ct) =>
        {
            try
            {
                if (!TryRequireSuperAdmin(ctx, out _, out var error))
                    return error!;

                var body = await ctx.Request.ReadFromJsonAsync<PartsPushRequest>(ct).ConfigureAwait(false);
                if (body is null || string.IsNullOrWhiteSpace(body.U) || string.IsNullOrWhiteSpace(body.H))
                    return Fail(store, toolId, "Parte inválida.", 400);

                byte[] payload;
                try
                {
                    payload = Convert.FromHexString(body.H.Trim());
                }
                catch (FormatException ex)
                {
                    return Fail(store, toolId, "Hex inválido en la parte.", 400, ex);
                }

                if (payload.Length is 0 or > MaxPartBytes)
                    return Fail(store, toolId, "Tamaño de parte inválido.", 400);

                store.SavePart(toolId, body.U, body.I, body.T, payload);
                return Results.Ok(new { ok = true, reached = true, i = body.I, t = body.T });
            }
            catch (ArgumentException ex)
            {
                return Fail(store, toolId, ex.Message, 400, ex);
            }
            catch (InvalidOperationException ex)
            {
                return Fail(store, toolId, ex.Message, 400, ex);
            }
            catch (Exception ex)
            {
                return Fail(store, toolId, $"{ex.GetType().Name}: {ex.Message}", 500, ex);
            }
        });

        app.MapPost("/api/tools/{toolId}/parts/commit", async (HttpContext ctx, string toolId, St2ToolsStore store, CancellationToken ct) =>
        {
            try
            {
                if (!TryRequireSuperAdmin(ctx, out _, out var error))
                    return error!;

                var body = await ctx.Request.ReadFromJsonAsync<PartsCommitRequest>(ct).ConfigureAwait(false);
                if (body is null || string.IsNullOrWhiteSpace(body.U) || body.T < 1)
                    return Fail(store, toolId, "Commit inválido.", 400);

                var fileName = DecodeMeta(body.N, fallback: $"st2-{toolId}.bin");
                var saved = await store.CommitPartsAsync(
                        toolId,
                        body.U,
                        body.T,
                        fileName,
                        body.V,
                        xor: body.Z,
                        xorKey: XorKey,
                        ct)
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

        // Compat: publicar desde captura (si se usa otro cliente).
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
            var text = Encoding.UTF8.GetString(Convert.FromBase64String(s)).Trim();
            return string.IsNullOrWhiteSpace(text) ? fallback : text;
        }
        catch
        {
            return fallback;
        }
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
            error = Results.Json(new { error = "Identificá tu usuario para continuar.", reached = true }, statusCode: StatusCodes.Status401Unauthorized);
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
            error = Results.Json(new { error = "Solo el administrador puede subir paquetes.", reached = true }, statusCode: StatusCodes.Status403Forbidden);
            return false;
        }
        return true;
    }

    private sealed class PartsBeginRequest
    {
        public string? U { get; set; }
        public int T { get; set; }
    }

    private sealed class PartsPushRequest
    {
        public string? U { get; set; }
        public int I { get; set; }
        public int T { get; set; }
        public string? H { get; set; }
    }

    private sealed class PartsCommitRequest
    {
        public string? U { get; set; }
        public int T { get; set; }
        public string? N { get; set; }
        public string? V { get; set; }
        public bool Z { get; set; } = true;
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
