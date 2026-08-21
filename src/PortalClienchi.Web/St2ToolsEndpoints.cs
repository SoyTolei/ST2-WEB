using System.Text;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using PortalClienchi.Web.Planillas;

namespace PortalClienchi.Web;

public static class St2ToolsEndpoints
{
    private const byte XorKey = 0xA5;
    private const int MaxPartBytes = 64 * 1024;

    private static readonly Regex CapturaIdRegex = new(
        @"^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{8}$",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);

    public static void MapSt2ToolsEndpoints(this WebApplication app)
    {
        app.MapGet("/api/tools", (HttpContext ctx, St2ToolsStore store) =>
        {
            if (!TryRequireUser(ctx, out _, out var error))
                return error!;

            try
            {
                var tools = store.List();
                var lastError = store.ReadLastError();
                if (lastError is { Length: > 2000 })
                    lastError = lastError[..2000] + "…";

                return Results.Ok(new
                {
                    tools,
                    dataDir = store.RootPath,
                    lastError,
                    reached = true,
                });
            }
            catch (Exception ex)
            {
                try { store.WriteLastError("list", ex); } catch { /* ignore */ }
                return Results.Json(new
                {
                    error = "No se pudo listar herramientas: " + ex.Message,
                    exceptionType = ex.GetType().FullName,
                    dataDir = store.RootPath,
                    reached = true,
                }, statusCode: StatusCodes.Status500InternalServerError);
            }
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

        app.MapGet("/api/tools/{toolId}/download", (HttpContext ctx, string toolId, St2ToolsStore store) =>
        {
            if (!TryRequireUser(ctx, out _, out var error))
                return error!;

            if (!store.TryOpen(toolId, out var path, out var meta) || meta is null)
                return Results.NotFound(new { error = "Todavía no hay un paquete publicado para esa herramienta." });

            var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            return Results.File(stream, meta.ContentType, meta.FileName, enableRangeProcessing: true);
        });

        // Rutas "kit" bajo /api/planillas (mismo estilo que el resto de la app; evita WAF sobre /upload*).
        app.MapPost("/api/planillas/kit/{toolId}/ping", HandlePing);
        app.MapPost("/api/planillas/kit/{toolId}/begin", HandlePartsBegin);
        app.MapPost("/api/planillas/kit/{toolId}/push", HandlePartsPush);
        app.MapPost("/api/planillas/kit/{toolId}/commit", HandlePartsCommit);
        app.MapPost("/api/planillas/kit/{toolId}/from-url", HandleFromUrl);

        // Compat con rutas viejas.
        app.MapPost("/api/tools/{toolId}/upload-ping", HandlePing);
        app.MapPost("/api/tools/{toolId}/parts/begin", HandlePartsBegin);
        app.MapPost("/api/tools/{toolId}/parts/push", HandlePartsPush);
        app.MapPost("/api/tools/{toolId}/parts/commit", HandlePartsCommit);
        app.MapPost("/api/tools/{toolId}/from-url", HandleFromUrl);

        Task<IResult> HandlePing(HttpContext ctx, string toolId, St2ToolsStore store)
        {
            if (!TryRequireSuperAdmin(ctx, out var email, out var error))
                return Task.FromResult(error!);

            try
            {
                if (!St2ToolsStore.ToolIds.Contains(toolId.Trim().ToLowerInvariant()))
                    return Task.FromResult(Fail(store, toolId, "Herramienta inválida.", 400));

                var probe = store.WriteProbe();
                return Task.FromResult(Results.Ok(new
                {
                    ok = true,
                    reached = true,
                    toolId,
                    email,
                    probe,
                    dataDir = store.RootPath,
                }));
            }
            catch (Exception ex)
            {
                return Task.FromResult(Fail(store, toolId, $"{ex.GetType().Name}: {ex.Message}", 500, ex));
            }
        }

        async Task<IResult> HandlePartsBegin(HttpContext ctx, string toolId, St2ToolsStore store, CancellationToken ct)
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
        }

        async Task<IResult> HandlePartsPush(HttpContext ctx, string toolId, St2ToolsStore store, CancellationToken ct)
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
        }

        async Task<IResult> HandlePartsCommit(HttpContext ctx, string toolId, St2ToolsStore store, CancellationToken ct)
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
        }

        async Task<IResult> HandleFromUrl(HttpContext ctx, string toolId, St2ToolsStore store, CancellationToken ct)
        {
            try
            {
                if (!TryRequireSuperAdmin(ctx, out _, out var error))
                    return error!;

                var body = await ctx.Request.ReadFromJsonAsync<FromUrlRequest>(ct).ConfigureAwait(false);
                if (body is null || string.IsNullOrWhiteSpace(body.Url))
                    return Fail(store, toolId, "Falta la URL.", 400);

                var normalized = NormalizeDownloadUrl(body.Url.Trim());
                if (!Uri.TryCreate(normalized, UriKind.Absolute, out var uri)
                    || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
                    return Fail(store, toolId, "URL inválida (solo http/https).", 400);

                var fileName = string.IsNullOrWhiteSpace(body.FileName)
                    ? Path.GetFileName(uri.AbsolutePath)
                    : body.FileName.Trim();
                if (string.IsNullOrWhiteSpace(fileName) || fileName is "." or "..")
                    fileName = $"st2-{toolId}.bin";
                if (string.IsNullOrWhiteSpace(Path.GetExtension(fileName))
                    && !string.IsNullOrWhiteSpace(body.FileName)
                    && body.FileName.Contains('.'))
                    fileName = body.FileName.Trim();

                using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(15) };
                http.DefaultRequestHeaders.UserAgent.ParseAdd("ST2-Web/1.0");
                using var resp = await http.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead, ct)
                    .ConfigureAwait(false);
                if (!resp.IsSuccessStatusCode)
                    return Fail(store, toolId, $"No se pudo descargar la URL (HTTP {(int)resp.StatusCode}).", 400);

                var len = resp.Content.Headers.ContentLength ?? -1;
                if (len > 120L * 1024 * 1024)
                    return Fail(store, toolId, "El archivo remoto supera 120 MB.", 400);

                await using var remote = await resp.Content.ReadAsStreamAsync(ct).ConfigureAwait(false);
                var saved = await store.SaveStreamAsync(toolId, fileName, remote, body.Version, len, ct)
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
            catch (HttpRequestException ex)
            {
                return Fail(store, toolId, "Error al descargar: " + ex.Message, 400, ex);
            }
            catch (TaskCanceledException ex)
            {
                return Fail(store, toolId, "Timeout descargando la URL.", 400, ex);
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
        }
    }

    private static string NormalizeDownloadUrl(string url)
    {
        var driveFile = Regex.Match(url, @"drive\.google\.com/file/d/([^/]+)", RegexOptions.IgnoreCase);
        if (driveFile.Success)
            return $"https://drive.google.com/uc?export=download&id={driveFile.Groups[1].Value}&confirm=t";

        var driveOpen = Regex.Match(url, @"[?&]id=([a-zA-Z0-9_-]+)", RegexOptions.IgnoreCase);
        if (url.Contains("drive.google.com", StringComparison.OrdinalIgnoreCase) && driveOpen.Success)
            return $"https://drive.google.com/uc?export=download&id={driveOpen.Groups[1].Value}&confirm=t";

        if (url.Contains("dropbox.com", StringComparison.OrdinalIgnoreCase))
        {
            if (url.Contains("dl=0", StringComparison.OrdinalIgnoreCase))
                return url.Replace("dl=0", "dl=1", StringComparison.OrdinalIgnoreCase);
            if (!url.Contains("dl=", StringComparison.OrdinalIgnoreCase))
                return url + (url.Contains('?', StringComparison.Ordinal) ? "&dl=1" : "?dl=1");
        }

        return url;
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

    private sealed class FromUrlRequest
    {
        public string? Url { get; set; }
        public string? FileName { get; set; }
        public string? Version { get; set; }
    }
}
