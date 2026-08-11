namespace PortalClienchi.Web.PortalPdf;

public static class PortalPdfEndpoints
{
    public static void MapPortalPdfEndpoints(this WebApplication app)
    {
        app.MapPost("/api/portal-pdf/generate", async (
            PortalPdfGenerateRequest? body,
            IWebHostEnvironment env,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("PortalPdf");
            try
            {
                if (body is null)
                    return Results.BadRequest(new { error = "Body JSON inválido." });

                var brand = (body.Brand ?? "").Trim();
                var html = body.Html ?? "";
                var text = body.Text ?? "";
                if (string.IsNullOrWhiteSpace(html) && string.IsNullOrWhiteSpace(text) && string.IsNullOrWhiteSpace(brand))
                    return Results.BadRequest(new { error = "Pegá contenido o indicá una marca." });

                // Igual que Oportunidad: generar off-thread.
                var pdf = await Task.Run(() => PortalPdfService.GeneratePdfBytes(body, env.ContentRootPath), ct)
                    .ConfigureAwait(false);

                var safeBrand = string.IsNullOrWhiteSpace(brand)
                    ? "portal"
                    : string.Concat(brand.Where(ch => char.IsLetterOrDigit(ch) || ch is '-' or '_')).ToLowerInvariant();
                if (string.IsNullOrEmpty(safeBrand))
                    safeBrand = "portal";
                var fileName = $"portal-{safeBrand}-{DateTime.Now:yyyyMMdd-HHmm}.pdf";
                return Results.File(pdf, "application/pdf", fileName);
            }
            catch (OperationCanceledException)
            {
                return Results.StatusCode(499);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error al generar PDF del portal");
                return Results.Json(new
                {
                    error = "Error al generar PDF del portal",
                    detail = ex.Message,
                    type = ex.GetType().Name,
                }, statusCode: 500);
            }
        });
    }
}
