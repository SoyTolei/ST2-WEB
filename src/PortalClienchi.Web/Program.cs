using System.Text.Json.Serialization;
using Microsoft.AspNetCore.HttpOverrides;
using PortalClienchi.Core.Configuration;
using PortalClienchi.Core.Models;
using PortalClienchi.Core.Services;
using PortalClienchi.Core.Utilities;
using PortalClienchi.Web;
using PortalClienchi.Web.Planillas;

var builder = WebApplication.CreateBuilder(args);

PlanillasFeatureFlags.LegalEnabled = builder.Configuration.GetValue("Planillas:LegalEnabled", false);

var appSettings = WebSettingsLoader.Load(builder.Configuration, builder.Environment.ContentRootPath);
var thomEmbedConfig = await ThomEmbedResolver.ResolveAsync(appSettings, builder.Configuration);

builder.Services.AddSingleton(appSettings);
builder.Services.AddSingleton(thomEmbedConfig);
builder.Services.AddSingleton<PortalSearchService>();
builder.Services.AddSingleton<PortalMediaProxy>();
builder.Services.AddSingleton<EmbedSiteProxy>();
builder.Services.AddSingleton<TransferenciaService>();
builder.Services.AddSingleton<ReferralIdService>();
builder.Services.AddSingleton<OportunidadRepository>();
builder.Services.AddSingleton<OportunidadService>();

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    options.SerializerOptions.PropertyNameCaseInsensitive = true;
});

var app = builder.Build();

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

static IResult CredentialsMissing() =>
    Results.Problem(
        detail: "Faltan credenciales del portal. Copiá appsettings.local.json.example a appsettings.local.json " +
                "en la carpeta del proyecto, o usá el mismo archivo en %LOCALAPPDATA%\\ST2\\appsettings.local.json (como ST2 de escritorio).",
        title: "Credenciales no configuradas",
        statusCode: StatusCodes.Status503ServiceUnavailable);

app.MapGet("/api/health", async (PortalSearchService search, AppSettings settings, CancellationToken ct) =>
{
    if (!WebSettingsLoader.HasPortalCredentials(settings))
    {
        return Results.Ok(new
        {
            connected = false,
            credentialsConfigured = false,
            message = "Faltan Email/Password en la configuración.",
        });
    }

    try
    {
        await search.EnsureConnectedAsync(ct);
        return Results.Ok(new { connected = true, credentialsConfigured = true, message = "Conectado al portal." });
    }
    catch (Exception ex)
    {
        return Results.Ok(new
        {
            connected = false,
            credentialsConfigured = true,
            message = ex.Message,
        });
    }
});

app.MapGet("/api/app-config", (AppSettings settings, ThomEmbedConfig thomEmbed) => Results.Ok(new
{
    settings.ThomTapUrl,
    settings.AiPlatformUrl,
    settings.PortalBaseUrl,
    thomZoomFactor = settings.ThomZoomFactor,
    aiPlatformZoomFactor = settings.AiPlatformZoomFactor,
    thomEmbedMode = thomEmbed.Mode,
    thomFrameUrl = thomEmbed.FrameUrl,
    thomProxyReachable = thomEmbed.ProxyReachable,
    thomProxyBaseUrl = thomEmbed.RemoteProxyBase,
    webBuild = St2WebBuild.GetBuild(),
    webVersionLabel = St2WebBuild.GetVersionLabel(),
}));

app.MapGet("/api/types", () =>
    Enum.GetValues<KnowledgeType>()
        .Select(t => new { key = t.ToFilterKey(), label = t.ToDisplayName() })
        .Prepend(new { key = "", label = "Todos los tipos" }));

app.MapPost("/api/organize", (List<SearchResult> results) =>
    Results.Ok(new { displayItems = SearchResultOrganizer.Organize(results) }));

app.MapGet("/api/media-proxy", async (string url, PortalMediaProxy proxy, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(url))
        return Results.BadRequest(new { error = "URL requerida." });

    try
    {
        var result = await proxy.FetchAsync(url, ct);
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
    PortalSearchService search,
    AppSettings settings,
    CancellationToken ct) =>
{
    if (!WebSettingsLoader.HasPortalCredentials(settings))
        return CredentialsMissing();

    var query = (q ?? "").Trim();
    if (query.Length < 2)
    {
        return Results.BadRequest(new { error = "Escribí al menos 2 letras para buscar." });
    }

    try
    {
        var results = (await search.SearchAsync(query, type, ct)).ToList();
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
    PortalSearchService search,
    AppSettings settings,
    HttpContext http,
    CancellationToken ct) =>
{
    if (!WebSettingsLoader.HasPortalCredentials(settings))
        return CredentialsMissing();

    if (!Enum.TryParse<KnowledgeType>(type, true, out var knowledgeType))
        knowledgeType = KnowledgeType.Faq;

    try
    {
        var item = await search.GetDetailAsync(id, knowledgeType, ct);
        var typeLabel = item.Type.ToDisplayName();
        var media = MediaContentResolver.Resolve(item, settings);
        var html = WebPreviewBuilder.Build(
            item,
            typeLabel,
            media,
            settings,
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
    PortalSearchService search,
    AppSettings settings,
    HttpContext http,
    CancellationToken ct) =>
{
    if (!WebSettingsLoader.HasPortalCredentials(settings))
        return CredentialsMissing();

    if (!Enum.TryParse<KnowledgeType>(type, true, out var knowledgeType))
        knowledgeType = KnowledgeType.Faq;

    try
    {
        var item = await search.GetDetailAsync(id, knowledgeType, ct);
        var typeLabel = item.Type.ToDisplayName();
        var media = MediaContentResolver.Resolve(item, settings);
        var previewHtml = WebPreviewBuilder.Build(
            item,
            typeLabel,
            media,
            settings,
            WebPreviewBuilder.GetPageOrigin(http.Request));
        var previewUrl = $"/api/knowledge/{id}/preview?type={Uri.EscapeDataString(knowledgeType.ToString().ToLowerInvariant())}";

        return Results.Ok(new
        {
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

app.MapFallbackToFile("index.html");

app.Run();
