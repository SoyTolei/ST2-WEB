using System.Text.Json.Serialization;
using Microsoft.AspNetCore.HttpOverrides;
using PortalClienchi.Core.Configuration;
using PortalClienchi.Core.Models;
using PortalClienchi.Core.Services;
using PortalClienchi.Core.Utilities;
using PortalClienchi.Web;
using PortalClienchi.Web.Planillas;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 40 * 1024 * 1024;
});

PlanillasFeatureFlags.LegalEnabled = builder.Configuration.GetValue("Planillas:LegalEnabled", false);

var appSettings = WebSettingsLoader.Load(builder.Configuration, builder.Environment.ContentRootPath);
var thomEmbedConfig = await ThomEmbedResolver.ResolveAsync(appSettings, builder.Configuration);

builder.Services.AddSingleton(appSettings);
builder.Services.AddSingleton(thomEmbedConfig);
builder.Services.AddSingleton<PortalRegistry>();
builder.Services.AddSingleton<EmbedSiteProxy>();
builder.Services.AddSingleton<LocalCapturaStore>();
builder.Services.AddSingleton<TransferenciaService>();
builder.Services.AddSingleton<ReferralIdService>();
builder.Services.AddSingleton<OportunidadRepository>();
builder.Services.AddSingleton<OportunidadService>();
builder.Services.AddSingleton<AppAccessRepository>();

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 40 * 1024 * 1024; // 40 MB (capturas comprimidas en servidor)
    options.ValueLengthLimit = 40 * 1024 * 1024;
    options.MultipartHeadersLengthLimit = 64 * 1024;
});

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    options.SerializerOptions.PropertyNameCaseInsensitive = true;
});

var app = builder.Build();

try
{
    app.Services.GetRequiredService<LocalCapturaStore>().PurgeExpired();
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "No se pudo purgar capturas vencidas al iniciar");
}

app.UseForwardedHeaders();

app.Use(async (ctx, next) =>
{
    var path = ctx.Request.Path.Value ?? "/";
    if (EmbedSiteProxy.ShouldMirrorThomPath(ctx.Request.Path)
        || path.StartsWith("/embed/", StringComparison.OrdinalIgnoreCase))
    {
        ctx.Response.OnStarting(() =>
        {
            ctx.Response.Headers.Remove("X-Frame-Options");
            ctx.Response.Headers.ContentSecurityPolicy = "frame-ancestors *";
            return Task.CompletedTask;
        });
    }

    await next(ctx).ConfigureAwait(false);
});

app.Use(async (ctx, next) =>
{
    if (HttpMethods.IsGet(ctx.Request.Method)
        && (ctx.Request.Path == "/" || ctx.Request.Path.Equals("/index.html", StringComparison.OrdinalIgnoreCase)))
    {
        var env = ctx.RequestServices.GetRequiredService<IWebHostEnvironment>();
        var html = await St2IndexHtml.LoadAsync(env, ctx.RequestAborted).ConfigureAwait(false);
        ctx.Response.ContentType = "text/html; charset=utf-8";
        ctx.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
        ctx.Response.Headers.Pragma = "no-cache";
        ctx.Response.Headers.Expires = "0";
        await ctx.Response.WriteAsync(html, ctx.RequestAborted).ConfigureAwait(false);
        return;
    }

    await next(ctx).ConfigureAwait(false);
});

app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var file = ctx.File.Name;
        if (file.EndsWith(".html", StringComparison.OrdinalIgnoreCase)
            || file.EndsWith(".js", StringComparison.OrdinalIgnoreCase)
            || file.EndsWith(".css", StringComparison.OrdinalIgnoreCase))
        {
            ctx.Context.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
            ctx.Context.Response.Headers.Pragma = "no-cache";
            ctx.Context.Response.Headers.Expires = "0";
        }
    },
});

app.UseSt2AccessGate();

static IResult CredentialsMissing(string? portalId = null)
{
    var portalHint = string.IsNullOrWhiteSpace(portalId) ? "" : $" ({portalId})";
    return Results.Problem(
        detail: "Faltan credenciales del portal" + portalHint + ". Copiá appsettings.local.json.example a appsettings.local.json " +
                "en la carpeta del proyecto, o usá el mismo archivo en %LOCALAPPDATA%\\ST2\\appsettings.local.json (como ST2 de escritorio). " +
                "En Railway podés usar Portals__Bejerman__Email, Portals__Legal__Email, etc.",
        title: "Credenciales no configuradas",
        statusCode: StatusCodes.Status503ServiceUnavailable);
}

app.MapGet("/api/health", async (PortalRegistry registry, string? portal, CancellationToken ct) =>
{
    async Task<object> CheckOne(string id)
    {
        var runtime = registry.Resolve(id);
        if (!registry.HasCredentials(id))
        {
            return new
            {
                id = runtime.Info.Id,
                label = runtime.Info.Label,
                connected = false,
                credentialsConfigured = false,
                message = "Faltan Email/Password en la configuración.",
            };
        }

        try
        {
            await runtime.Search.EnsureConnectedAsync(ct);
            return new
            {
                id = runtime.Info.Id,
                label = runtime.Info.Label,
                connected = true,
                credentialsConfigured = true,
                message = "Conectado al portal.",
            };
        }
        catch (Exception ex)
        {
            return new
            {
                id = runtime.Info.Id,
                label = runtime.Info.Label,
                connected = false,
                credentialsConfigured = true,
                message = ex.Message,
            };
        }
    }

    if (!string.IsNullOrWhiteSpace(portal))
    {
        var single = await CheckOne(portal);
        return Results.Ok(single);
    }

    var statuses = new List<object>();
    foreach (var info in registry.List())
        statuses.Add(await CheckOne(info.Id));

    return Results.Ok(new { portals = statuses });
});

app.MapGet("/api/app-config", (AppSettings settings, PortalRegistry registry, ThomEmbedConfig thomEmbed) => Results.Ok(new
{
    settings.ThomTapUrl,
    settings.AiPlatformUrl,
    settings.PortalBaseUrl,
    defaultPortalId = registry.DefaultId,
    portals = registry.List().Select(p => new { id = p.Id, label = p.Label }),
    thomZoomFactor = settings.ThomZoomFactor,
    aiPlatformZoomFactor = settings.AiPlatformZoomFactor,
    thomAutoCloseHelpPanel = settings.ThomAutoCloseHelpPanel,
    thomEmbedMode = thomEmbed.Mode,
    thomFrameUrl = thomEmbed.FrameUrl,
    thomProxyReachable = thomEmbed.ProxyReachable,
    webBuild = St2WebBuild.GetBuild(),
    webVersionLabel = St2WebBuild.GetVersionLabel(),
    webUpdatedLabel = St2WebBuild.GetUpdatedLabel(),
}));

app.MapGet("/api/types", () =>
    Enum.GetValues<KnowledgeType>()
        .Select(t => new { key = t.ToFilterKey(), label = t.ToDisplayName() })
        .Prepend(new { key = "", label = "Todos los tipos" }));

app.MapPost("/api/organize", (List<SearchResult> results) =>
    Results.Ok(new { displayItems = SearchResultOrganizer.Organize(results) }));

app.MapGet("/api/media-proxy", async (string url, string? portal, PortalRegistry registry, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(url))
        return Results.BadRequest(new { error = "URL requerida." });

    var runtime = !string.IsNullOrWhiteSpace(portal)
        ? registry.Resolve(portal)
        : registry.ResolveByMediaUrl(url);

    try
    {
        var result = await runtime.Media.FetchAsync(url, ct);
        if (result is null)
            return Results.BadRequest(new { error = "URL no permitida." });

        return Results.File(result.Value.Data, result.Value.ContentType);
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, title: "No se pudo cargar el archivo");
    }
});

app.MapGet("/api/search", async (
    string q,
    string? type,
    string? portal,
    PortalRegistry registry,
    CancellationToken ct) =>
{
    var runtime = registry.Resolve(portal);
    if (!registry.HasCredentials(runtime.Info.Id))
        return CredentialsMissing(runtime.Info.Id);

    var query = (q ?? "").Trim();
    if (query.Length < 2)
    {
        return Results.BadRequest(new { error = "Escribí al menos 2 letras para buscar." });
    }

    try
    {
        var results = (await runtime.Search.SearchAsync(query, type, ct)).ToList();
        var displayItems = SearchResultOrganizer.Organize(results);
        var years = results
            .Select(r => r.SortYear)
            .Where(TopicYearHelper.IsPlausibleYear)
            .Distinct()
            .OrderByDescending(y => y)
            .ToList();
        var hasUndated = results.Any(r => r.SortYear == 0);

        return Results.Ok(new
        {
            portalId = runtime.Info.Id,
            results,
            displayItems,
            years,
            hasUndated,
            total = results.Count,
        });
    }
    catch (OperationCanceledException)
    {
        return Results.StatusCode(499);
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, title: "Error al buscar");
    }
});

app.MapGet("/api/knowledge/{id:int}/preview", async (
    int id,
    string? type,
    string? portal,
    PortalRegistry registry,
    HttpContext http,
    CancellationToken ct) =>
{
    var runtime = registry.Resolve(portal);
    if (!registry.HasCredentials(runtime.Info.Id))
        return CredentialsMissing(runtime.Info.Id);

    if (!Enum.TryParse<KnowledgeType>(type, true, out var knowledgeType))
        knowledgeType = KnowledgeType.Faq;

    try
    {
        var item = await runtime.Search.GetDetailAsync(id, knowledgeType, ct);
        var typeLabel = item.Type.ToDisplayName();
        var media = MediaContentResolver.Resolve(item, runtime.Settings);
        var html = WebPreviewBuilder.Build(
            item,
            typeLabel,
            media,
            runtime.Settings,
            WebPreviewBuilder.GetPageOrigin(http.Request));

        return Results.Content(html, "text/html; charset=utf-8");
    }
    catch (OperationCanceledException)
    {
        return Results.StatusCode(499);
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, title: "Error al cargar vista previa");
    }
});

app.MapGet("/api/knowledge/{id:int}", async (
    int id,
    string? type,
    string? portal,
    PortalRegistry registry,
    HttpContext http,
    CancellationToken ct) =>
{
    var runtime = registry.Resolve(portal);
    if (!registry.HasCredentials(runtime.Info.Id))
        return CredentialsMissing(runtime.Info.Id);

    if (!Enum.TryParse<KnowledgeType>(type, true, out var knowledgeType))
        knowledgeType = KnowledgeType.Faq;

    try
    {
        var item = await runtime.Search.GetDetailAsync(id, knowledgeType, ct);
        var typeLabel = item.Type.ToDisplayName();
        var media = MediaContentResolver.Resolve(item, runtime.Settings);
        var previewHtml = WebPreviewBuilder.Build(
            item,
            typeLabel,
            media,
            runtime.Settings,
            WebPreviewBuilder.GetPageOrigin(http.Request));
        var portalParam = $"portal={Uri.EscapeDataString(runtime.Info.Id)}&";
        var previewUrl =
            $"/api/knowledge/{id}/preview?{portalParam}type={Uri.EscapeDataString(knowledgeType.ToString().ToLowerInvariant())}";

        return Results.Ok(new
        {
            portalId = runtime.Info.Id,
            item,
            typeLabel,
            previewHtml,
            previewUrl,
            canExportPdf = item.Type is KnowledgeType.Faq or KnowledgeType.Manual or KnowledgeType.News or KnowledgeType.Link,
            media = media is null
                ? null
                : new
                {
                    kind = media.Kind.ToString(),
                    media.Url,
                    media.SuggestedFileName,
                    downloadFilter = media.DownloadFilter,
                },
        });
    }
    catch (OperationCanceledException)
    {
        return Results.StatusCode(499);
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, title: "Error al cargar detalle");
    }
});

app.MapMethods("/embed/{site}/{**path}", new[] { "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS" },
    async (HttpContext ctx, string site, string? path, EmbedSiteProxy proxy, CancellationToken ct) =>
        await proxy.HandleAsync(ctx, site, path ?? "", ct));

app.MapMethods("/embed/{site}", new[] { "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS" },
    async (HttpContext ctx, string site, EmbedSiteProxy proxy, CancellationToken ct) =>
        await proxy.HandleAsync(ctx, site, "", ct));

app.MapWhen(
    ctx => EmbedSiteProxy.ShouldMirrorThomPath(ctx.Request.Path),
    branch => branch.Run(async ctx =>
    {
        var proxy = ctx.RequestServices.GetRequiredService<EmbedSiteProxy>();
        await proxy.HandleMirrorAsync(ctx, ctx.RequestAborted);
    }));

app.MapPlanillasEndpoints();

// Capturas públicas (ANTES del fallback SPA).
// Importante: /c/ también está en EmbedSiteProxy.St2ReservedPrefixes para que
// el mirror de THOM no robe la ruta (eso causaba HTTP 500).
app.MapGet("/c/{id}", (string id, LocalCapturaStore store) =>
{
    try
    {
        if (!store.TryOpenById(id, out var path, out var contentType))
            return Results.NotFound(new { error = "Captura no encontrada.", id });

        var bytes = File.ReadAllBytes(path);
        return Results.File(bytes, contentType);
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, title: "Error al abrir captura", statusCode: 500);
    }
});

app.MapGet("/media/capturas/{fileName}", (string fileName, LocalCapturaStore store) =>
{
    try
    {
        if (!store.TryOpen(fileName, out var path, out var contentType))
            return Results.NotFound(new { error = "Captura no encontrada.", fileName });

        var bytes = File.ReadAllBytes(path);
        return Results.File(bytes, contentType);
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, title: "Error al abrir captura", statusCode: 500);
    }
});

app.MapGet("/api/capturas/status", (LocalCapturaStore store) =>
{
    try
    {
        var root = store.RootPath;
        var exists = Directory.Exists(root);
        var count = exists ? Directory.GetFiles(root).Length : 0;
        return Results.Ok(new
        {
            ok = true,
            root,
            exists,
            files = count,
            provider = "Local",
        });
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, title: "capturas status");
    }
});

app.MapFallbackToFile("index.html");

app.Run();
