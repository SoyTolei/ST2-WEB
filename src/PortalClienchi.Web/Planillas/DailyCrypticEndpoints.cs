namespace PortalClienchi.Web.Planillas;

public static class DailyCrypticEndpoints
{
    public static void MapDailyCrypticEndpoints(this WebApplication app)
    {
        app.MapGet("/api/cryptic/status", (
            HttpContext ctx,
            DailyCrypticRepository repository) =>
        {
            var email = PlanUserIdentity.GetFromRequest(ctx);
            if (email is null)
                return Results.Json(
                    new { error = "Identificá tu usuario para continuar." },
                    statusCode: StatusCodes.Status401Unauthorized);

            St2HttpCache.NoStore(ctx);
            try
            {
                return Results.Ok(repository.GetStatus(email));
            }
            catch (Exception ex)
            {
                app.Logger.LogError(ex, "No se pudo cargar el Críptico diario");
                return Results.Json(
                    new { error = "No se pudo cargar el Críptico diario." },
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        });

        app.MapPost("/api/cryptic/attempt", (
            HttpContext ctx,
            DailyCrypticRepository repository,
            DailyCrypticAttemptRequest body) =>
        {
            var email = PlanUserIdentity.GetFromRequest(ctx);
            if (email is null)
                return Results.Json(
                    new { error = "Identificá tu usuario para continuar." },
                    statusCode: StatusCodes.Status401Unauthorized);

            St2HttpCache.NoStore(ctx);
            try
            {
                return Results.Ok(repository.Submit(email, body.Slot, body.Answer));
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(
                    new { error = ex.Message },
                    statusCode: StatusCodes.Status409Conflict);
            }
            catch (Exception ex)
            {
                app.Logger.LogError(ex, "No se pudo registrar el intento del Críptico para {Email}", email);
                return Results.Json(
                    new { error = "No se pudo registrar el intento." },
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        });

        app.MapPost("/api/cryptic/hint", (
            HttpContext ctx,
            DailyCrypticRepository repository,
            DailyCrypticAttemptRequest body) =>
        {
            var email = PlanUserIdentity.GetFromRequest(ctx);
            if (email is null)
                return Results.Json(
                    new { error = "Identificá tu usuario para continuar." },
                    statusCode: StatusCodes.Status401Unauthorized);

            St2HttpCache.NoStore(ctx);
            try
            {
                var level = repository.RevealHint(email, body.Slot);
                return Results.Ok(new { level });
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(
                    new { error = ex.Message },
                    statusCode: StatusCodes.Status409Conflict);
            }
            catch (Exception ex)
            {
                app.Logger.LogError(ex, "No se pudo revelar una pista del Críptico para {Email}", email);
                return Results.Json(
                    new { error = "No se pudo revelar la pista." },
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        });

        app.MapGet("/api/cryptic/admin/clues", (
            HttpContext ctx,
            IConfiguration configuration,
            AppAccessRepository accessRepository,
            DailyCrypticRepository repository) =>
        {
            if (!AccessPanelGate.TryAuthorize(
                    ctx,
                    configuration,
                    accessRepository,
                    out _,
                    out var denied,
                    ownerOnly: true))
            {
                return denied!;
            }

            St2HttpCache.NoStore(ctx);
            return Results.Ok(new { items = repository.ListAdminClues() });
        });

        app.MapPost("/api/cryptic/admin/clues", (
            HttpContext ctx,
            IConfiguration configuration,
            AppAccessRepository accessRepository,
            DailyCrypticRepository repository,
            DailyCrypticAdminRequest body) =>
        {
            if (!AccessPanelGate.TryAuthorize(
                    ctx,
                    configuration,
                    accessRepository,
                    out _,
                    out var denied,
                    ownerOnly: true))
            {
                return denied!;
            }

            try
            {
                var actor = AccessPanelGate.ResolveActorLabel(ctx, configuration);
                var id = repository.UpsertAdminClue(body, actor);
                accessRepository.AddAudit(actor, body.Id is > 0 ? "cryptic_update" : "cryptic_create", id.ToString());
                return Results.Ok(new { ok = true, id });
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                app.Logger.LogError(ex, "No se pudo guardar la pista críptica");
                return Results.Json(
                    new { error = "No se pudo guardar la pista." },
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        });
    }
}
