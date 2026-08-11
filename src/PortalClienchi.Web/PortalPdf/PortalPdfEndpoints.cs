namespace PortalClienchi.Web.PortalPdf;

public static class PortalPdfEndpoints
{
    public static void MapPortalPdfEndpoints(this WebApplication app)
    {
        app.MapPost("/api/portal-pdf/generate", (
            PortalPdfGenerateRequest body,
            IWebHostEnvironment env) =>
        {
            try
            {
                var brand = (body.Brand ?? "").Trim();
                var html = body.Html ?? "";
                var text = body.Text ?? "";
                if (string.IsNullOrWhiteSpace(html) && string.IsNullOrWhiteSpace(text) && string.IsNullOrWhiteSpace(brand))
                    return Results.BadRequest(new { error = "Pegá contenido o indicá una marca." });

                var pdf = PortalPdfService.GeneratePdfBytes(body, env.ContentRootPath);
                var safeBrand = string.IsNullOrWhiteSpace(brand)
                    ? "portal"
                    : string.Concat(brand.Where(ch => char.IsLetterOrDigit(ch) || ch is '-' or '_')).ToLowerInvariant();
                if (string.IsNullOrEmpty(safeBrand))
                    safeBrand = "portal";
                var fileName = $"portal-{safeBrand}-{DateTime.Now:yyyyMMdd-HHmm}.pdf";
                return Results.File(pdf, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, title: "Error al generar PDF del portal");
            }
        });
    }
}
