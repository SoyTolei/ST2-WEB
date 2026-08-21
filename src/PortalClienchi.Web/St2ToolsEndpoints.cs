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
                    bundledRoots = store.BundledPackageRoots,
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
            // octet-stream evita que el proxy bloquee descargas .bat/.exe
            return Results.File(stream, "application/octet-stream", meta.FileName, enableRangeProcessing: true);
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

                using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(15) };
                http.DefaultRequestHeaders.UserAgent.ParseAdd("ST2-Web/1.0");
                using var resp = await http.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead, ct)
                    .ConfigureAwait(false);
                if (!resp.IsSuccessStatusCode)
                    return Fail(store, toolId, $"No se pudo descargar la URL (HTTP {(int)resp.StatusCode}).", 400);

                var len = resp.Content.Headers.ContentLength ?? -1;
                if (len > 120L * 1024 * 1024)
                    return Fail(store, toolId, "El archivo remoto supera 120 MB.", 400);

                var headerName = resp.Content.Headers.ContentDisposition?.FileNameStar
                    ?? resp.Content.Headers.ContentDisposition?.FileName;
                if (!string.IsNullOrWhiteSpace(headerName))
                    headerName = headerName.Trim().Trim('"');

                var fileName = ResolvePackageFileName(
                    toolId,
                    body.FileName,
                    Path.GetFileName(uri.AbsolutePath),
                    headerName,
                    resp.Content.Headers.ContentType?.MediaType);

                await using var remote = await resp.Content.ReadAsStreamAsync(ct).ConfigureAwait(false);
                // Buffer mínimo para rechazar páginas HTML (links de landing, no el archivo).
                var probe = new byte[512];
                var probed = await remote.ReadAsync(probe.AsMemory(0, probe.Length), ct).ConfigureAwait(false);
                if (probed > 0 && LooksLikeHtml(probe.AsSpan(0, probed)))
                {
                    return Fail(store, toolId,
                        "El link devolvió una página web, no el archivo. Usá un link de descarga directa.", 400);
                }

                var tmp = store.BeginTempFile(toolId);
                try
                {
                    await using (var fs = new FileStream(tmp, FileMode.Create, FileAccess.Write, FileShare.None))
                    {
                        if (probed > 0)
                            await fs.WriteAsync(probe.AsMemory(0, probed), ct).ConfigureAwait(false);
                        await remote.CopyToAsync(fs, ct).ConfigureAwait(false);
                        await fs.FlushAsync(ct).ConfigureAwait(false);
                    }

                    await using var input = new FileStream(tmp, FileMode.Open, FileAccess.Read, FileShare.Read);
                    var saved = await store.SaveStreamAsync(toolId, fileName, input, body.Version, input.Length, ct)
                        .ConfigureAwait(false);
                    store.ClearLastError();
                    return Results.Ok(saved);
                }
                finally
                {
                    try { if (File.Exists(tmp)) File.Delete(tmp); } catch { /* ignore */ }
                }
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

    private static readonly HashSet<string> KnownExtTokens = new(StringComparer.OrdinalIgnoreCase)
    {
        "zip", "7z", "rar", "exe", "msi", "bat", "cmd", "ps1", "bin",
    };

    /// <summary>
    /// Los hosts temporales a menudo dan path sin extensión (ej. ".../zip" → nombre "zip").
    /// </summary>
    private static string ResolvePackageFileName(
        string toolId,
        string? fromBody,
        string? fromUrlPath,
        string? fromContentDisposition,
        string? contentType)
    {
        foreach (var raw in new[] { fromBody, fromContentDisposition, fromUrlPath })
        {
            var candidate = (raw ?? "").Trim().Trim('"');
            if (string.IsNullOrWhiteSpace(candidate) || candidate is "." or "..")
                continue;

            candidate = Path.GetFileName(candidate);
            if (string.IsNullOrWhiteSpace(candidate))
                continue;

            // "zip" / "bat" sin punto → ".zip" / ".bat"
            if (KnownExtTokens.Contains(candidate))
                return $"st2-{toolId}.{candidate.ToLowerInvariant()}";

            var ext = Path.GetExtension(candidate);
            if (!string.IsNullOrWhiteSpace(ext) && KnownExtTokens.Contains(ext.TrimStart('.')))
                return candidate;
        }

        var byMime = contentType?.ToLowerInvariant() switch
        {
            "application/zip" or "application/x-zip-compressed" => ".zip",
            "application/x-7z-compressed" => ".7z",
            "application/vnd.rar" or "application/x-rar-compressed" => ".rar",
            "application/vnd.microsoft.portable-executable" or "application/x-msdownload" => ".exe",
            "application/octet-stream" => toolId.Equals("bat", StringComparison.OrdinalIgnoreCase) ? ".bat" : ".zip",
            _ => null,
        };
        if (byMime is not null)
            return $"st2-{toolId}{byMime}";

        // Default sensato por herramienta
        return toolId.Equals("bat", StringComparison.OrdinalIgnoreCase)
            ? $"st2-{toolId}.bat"
            : $"st2-{toolId}.zip";
    }

    private static bool LooksLikeHtml(ReadOnlySpan<byte> bytes)
    {
        var i = 0;
        while (i < bytes.Length && (bytes[i] is 0x20 or 0x09 or 0x0D or 0x0A or 0xEF or 0xBB or 0xBF))
            i++;
        if (i >= bytes.Length) return false;
        // <! or <html or <HTML
        if (bytes[i] != (byte)'<') return false;
        if (i + 1 < bytes.Length && bytes[i + 1] == (byte)'!') return true;
        if (i + 4 < bytes.Length)
        {
            var c1 = (char)bytes[i + 1];
            var c2 = (char)bytes[i + 2];
            var c3 = (char)bytes[i + 3];
            var c4 = (char)bytes[i + 4];
            var tag = string.Concat(c1, c2, c3, c4).ToLowerInvariant();
            if (tag is "html" or "head" or "body") return true;
        }
        return false;
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
