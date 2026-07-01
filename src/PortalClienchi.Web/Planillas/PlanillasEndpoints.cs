using System.Text.Json;

namespace PortalClienchi.Web.Planillas;

public static class PlanillasEndpoints
{
    private static readonly HashSet<string> ImagenExtensiones = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp",
    };

    public static void MapPlanillasEndpoints(this WebApplication app)
    {
        app.MapGet("/api/planillas/config", (TransferenciaService svc, ReferralIdService referral) => Results.Ok(new
        {
            webBuild = St2WebBuild.GetBuild(),
            mesas = new[] { "TECNICO", "FLEX", "SAAS", "SUELDOS" },
            sistemas = new[]
            {
                new { id = "BejermanSql", label = PlanillasSistemaExtensions.BejermanSqlLabel, placeholder = false, beta = false },
                new { id = "OnvioWeb", label = PlanillasSistemaExtensions.OnvioWebLabel, placeholder = false, beta = false },
                new { id = "Legal", label = PlanillasSistemaExtensions.LegalLabel, placeholder = !PlanillasFeatureFlags.LegalEnabled, beta = PlanillasFeatureFlags.LegalEnabled },
                new { id = "Chile", label = PlanillasSistemaExtensions.ChileLabel, placeholder = true, beta = true },
            },
            iaConfigured = svc.IaConfigured,
            capturaHosting = new
            {
                configured = svc.CapturaHostingConfigured,
                proveedor = svc.CapturaHostingProveedor,
            },
            referral = new
            {
                versiones = ReferralIdConstants.Versiones,
                modulos = ReferralIdConstants.Modulos,
                collations = ReferralIdConstants.Collations,
                sqlServers = ReferralIdConstants.SqlServerVersions,
                mamOpciones = ReferralIdConstants.MamOpciones,
                sdkOpciones = ReferralIdConstants.SdkOpciones,
                triggersSql = new[]
                {
                    new { num = "1", title = "Consultar triggers y su estado", explanation = "Lista cada trigger de usuario con su tabla, esquema y si está habilitado o deshabilitado.", query = ReferralIdConstants.TriggersConsultarEstado },
                    new { num = "2", title = "Tablas con triggers en la base", explanation = "Resumen por tabla: cuántos triggers tiene y cuántos están habilitados o deshabilitados.", query = ReferralIdConstants.TriggersTablasConTriggers },
                    new { num = "3", title = "Deshabilitar todos los triggers", explanation = "Genera las sentencias ALTER TABLE … DISABLE TRIGGER ALL. Copiá las columnas del resultado (a + TABLA + b) y ejecutalas.", query = ReferralIdConstants.TriggersDeshabilitar },
                    new { num = "4", title = "Habilitar todos los triggers", explanation = "Genera las sentencias ALTER TABLE … ENABLE TRIGGER ALL para volver a habilitar los triggers deshabilitados.", query = ReferralIdConstants.TriggersHabilitar },
                },
                iaConfigured = referral.IaConfigured,
            },
            legal = new
            {
                beta = PlanillasFeatureFlags.LegalEnabled,
                produtos = LegalConstants.Produtos,
                modulos = LegalConstants.Modulos,
                ambientes = LegalConstants.Ambientes,
                mesas = LegalConstants.Mesas.Select(m => new { id = m.Id, label = m.Label }),
                referralHub = LegalReferralHubCatalog.Products.Select(p => new
                {
                    id = p.Id,
                    label = p.Label,
                    icon = p.Icon,
                    layout = p.Layout,
                    catalogProductId = p.CatalogProductId,
                    items = p.Items.Select(i => new
                    {
                        id = i.Id,
                        label = i.Label,
                        icon = i.Icon,
                        catalogCategoryId = i.CatalogCategoryId,
                    }),
                }),
                templatesCatalogUrl = "/data/legalone-templates-catalog.json",
            },
            oportunidad = new
            {
                metodosContacto = new[] { "Telefónicamente", "WhatsApp", "Email" },
                iaConfigured = svc.IaConfigured,
            },
        }));

        app.MapPost("/api/planillas/capturas/upload", async (
            HttpRequest request,
            TransferenciaService svc,
            CancellationToken ct) =>
        {
            if (!request.HasFormContentType)
                return Results.BadRequest(new { error = "Se esperaba multipart/form-data." });

            var form = await request.ReadFormAsync(ct).ConfigureAwait(false);
            var files = form.Files;
            if (files.Count == 0)
                return Results.BadRequest(new { error = "No se recibieron archivos." });

            var archivos = new List<(string FileName, Stream Content)>();
            foreach (var file in files)
            {
                if (file.Length == 0)
                    continue;

                var ext = Path.GetExtension(file.FileName);
                var contentType = file.ContentType ?? "";
                var esImagen = ImagenExtensiones.Contains(ext)
                    || contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
                if (!esImagen)
                    return Results.BadRequest(new { error = $"Formato no permitido: {file.FileName}" });

                archivos.Add((file.FileName, file.OpenReadStream()));
            }

            if (archivos.Count == 0)
                return Results.BadRequest(new { error = "No hay imágenes válidas." });

            try
            {
                var enlaces = await svc.SubirCapturasAsync(archivos, ct).ConfigureAwait(false);
                return Results.Ok(new
                {
                    enlaces = enlaces.Select(e => new CapturaEnlaceDto(e.FileName, e.Url)),
                });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, title: "Error al subir capturas");
            }
        });

        app.MapPost("/api/planillas/transferencia/generar", async (
            HttpRequest request,
            TransferenciaService svc,
            CancellationToken ct) =>
        {
            TransferenciaGenerateRequest? payload;
            IReadOnlyList<IFormFile> uploadFiles = Array.Empty<IFormFile>();

            if (request.HasFormContentType)
            {
                var form = await request.ReadFormAsync(ct).ConfigureAwait(false);
                var json = form["payload"].ToString();
                if (string.IsNullOrWhiteSpace(json))
                    return Results.BadRequest(new { error = "Falta el campo payload (JSON)." });

                payload = JsonSerializer.Deserialize<TransferenciaGenerateRequest>(
                    json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                uploadFiles = form.Files.GetFiles("capturas");
            }
            else
            {
                payload = await request.ReadFromJsonAsync<TransferenciaGenerateRequest>(ct).ConfigureAwait(false);
            }

            if (payload is null)
                return Results.BadRequest(new { error = "Cuerpo de solicitud inválido." });

            var error = TransferenciaService.ValidarRequest(payload);
            if (error is not null)
                return Results.BadRequest(new { error });

            try
            {
                var enlaces = (payload.CapturasEnlaces ?? [])
                    .Where(e => !string.IsNullOrWhiteSpace(e.Url))
                    .Select(e => new TransferenciaCapturaEnlace(e.FileName, e.Url))
                    .ToList();

                if (payload.Capturas && uploadFiles.Count > 0)
                {
                    var archivos = uploadFiles
                        .Where(f => f.Length > 0)
                        .Select(f => (f.FileName, (Stream)f.OpenReadStream()))
                        .ToList();

                    var subidos = await svc.SubirCapturasAsync(archivos, ct).ConfigureAwait(false);
                    enlaces.AddRange(subidos);
                }

                var caso = TransferenciaService.FromRequest(payload);
                caso = new TransferenciaCase
                {
                    Sistema = caso.Sistema,
                    NumeroCliente = caso.NumeroCliente,
                    Mesa = caso.Mesa,
                    Asunto = caso.Asunto,
                    Descripcion = caso.Descripcion,
                    Capturas = caso.Capturas,
                    CapturasArchivos = enlaces.Select(e => e.FileName).ToList(),
                    CapturasEnlaces = enlaces,
                    TicketSolicitado = caso.TicketSolicitado,
                    NumeroTicket = caso.NumeroTicket,
                    PortalLink = caso.PortalLink,
                    PortalTitulo = caso.PortalTitulo,
                    Legal = caso.Legal,
                };

                var texto = await svc.GenerarTextoAsync(caso, ct).ConfigureAwait(false);
                var stamp = $"transferencia_{DateTime.Now:yyyyMMdd_HHmmss}";

                return Results.Ok(new
                {
                    texto,
                    fileName = $"{stamp}.txt",
                    iaUsada = false,
                    capturasSubidas = enlaces.Count,
                });
            }
            catch (OperationCanceledException)
            {
                return Results.StatusCode(499);
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, title: "Error al generar transferencia");
            }
        });

        app.MapPost("/api/planillas/transferencia/mejorar", async (
            TransferenciaGenerateRequest body,
            TransferenciaService svc,
            CancellationToken ct) =>
        {
            var error = TransferenciaService.ValidarRequest(body);
            if (error is not null)
                return Results.BadRequest(new { error });

            try
            {
                var caso = TransferenciaService.FromRequest(body);
                var borrador = await svc.MejorarConIaAsync(caso, ct).ConfigureAwait(false);
                return Results.Ok(new { asunto = borrador.Asunto, descripcion = borrador.Descripcion });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, title: "Error al mejorar con IA");
            }
        });

        app.MapPost("/api/planillas/referral/generar", async (
            HttpRequest request,
            ReferralIdService svc,
            CancellationToken ct) =>
        {
            var (payload, files) = await ReadReferralPayloadAsync(request, ct).ConfigureAwait(false);
            if (payload is null)
                return Results.BadRequest(new { error = "Cuerpo de solicitud inválido." });

            try
            {
                var caso = svc.FromRequest(payload);
                caso = await svc.ApplyCapturasUploadAsync(caso, files, ct).ConfigureAwait(false);

                var capturasError = ReferralIdService.ValidateCapturasLinks(caso);
                if (capturasError is not null)
                    return Results.BadRequest(new { error = capturasError });

                var error = ReferralIdValidator.ValidateForGenerate(caso);
                if (error == ReferralIdValidator.CodeTicketConfirm)
                    return Results.BadRequest(new { error = "¿Se solicitó ticket de servicio?", code = error });
                if (error is not null)
                    return Results.BadRequest(new { error });

                var texto = svc.GenerarTexto(caso);
                var stamp = $"referral_id_{DateTime.Now:yyyyMMdd_HHmmss}";
                return Results.Ok(new
                {
                    texto,
                    fileName = $"{stamp}.txt",
                    capturasSubidas = caso.CapturasEnlaces.Count,
                });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, title: "Error al generar Referral I+D");
            }
        });

        app.MapPost("/api/planillas/referral/mejorar", async (
            ReferralMejorarRequest body,
            ReferralIdService svc,
            CancellationToken ct) =>
        {
            try
            {
                var caso = svc.FromRequest(body.Form);
                var mejorado = await svc.MejorarConIaAsync(caso, ct).ConfigureAwait(false);
                var parsed = PlanillaDocumentoParser.ParseReferral(mejorado);
                return Results.Ok(new
                {
                    asunto = parsed.GetValueOrDefault(PlanillaDocumentoKeys.Asunto),
                    descripcion = parsed.GetValueOrDefault(PlanillaDocumentoKeys.Descripcion),
                    pasoAPaso = parsed.GetValueOrDefault(PlanillaDocumentoKeys.PasoAPaso),
                    texto = mejorado,
                });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, title: "Error al mejorar con IA");
            }
        });

        app.MapPost("/api/planillas/oportunidad/pdf", async (
            OportunidadCargaRequest body,
            OportunidadService svc,
            CancellationToken ct) =>
        {
            try
            {
                var form = svc.FromRequest(body);
                var errores = OportunidadValidator.ValidateCarga(form);
                if (errores.Count > 0)
                    return Results.BadRequest(new { errors = errores });

                var pdf = await Task.Run(() => svc.GenerarPdf(form), ct).ConfigureAwait(false);
                var fileName = OportunidadTextBuilder.SuggestedFileName(form);
                return Results.File(pdf, "application/pdf", fileName);
            }
            catch (OperationCanceledException)
            {
                return Results.StatusCode(499);
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, title: "Error al generar PDF");
            }
        });

        app.MapPost("/api/planillas/oportunidad/mejorar", async (
            OportunidadCargaRequest body,
            OportunidadService svc,
            CancellationToken ct) =>
        {
            try
            {
                var form = svc.FromRequest(body);
                var mejorado = await svc.MejorarConIaAsync(form, ct).ConfigureAwait(false);
                return Results.Ok(mejorado);
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, title: "Error al mejorar con IA");
            }
        });

        app.MapGet("/api/planillas/session", (HttpContext ctx) =>
        {
            var email = PlanUserIdentity.GetFromRequest(ctx);
            return Results.Ok(new { email });
        });

        app.MapPost("/api/planillas/session", (HttpContext ctx, PlanUserSessionRequest body, AppAccessRepository accessRepo) =>
        {
            var email = PlanUserIdentity.ValidateAndNormalize(body.Email);
            if (email is null)
            {
                return Results.BadRequest(new
                {
                    error = "Correo inválido.",
                });
            }

            PlanUserIdentity.SetCookie(ctx, email);
            accessRepo.RecordAccess(email);
            return Results.Ok(new { email });
        });

        app.MapDelete("/api/planillas/session", (HttpContext ctx) =>
        {
            PlanUserIdentity.ClearCookie(ctx);
            return Results.Ok(new { ok = true });
        });

        app.MapGet("/api/access/registrations", (HttpContext ctx, AppAccessRepository accessRepo) =>
        {
            var usuario = PlanUserIdentity.GetFromRequest(ctx);
            if (usuario is null)
                return Results.Json(new { error = "Identificá tu usuario para continuar." }, statusCode: StatusCodes.Status401Unauthorized);

            var items = accessRepo.ListAll();
            return Results.Ok(new
            {
                items,
                total = items.Count,
                storage = new { ready = accessRepo.StorageReady, path = accessRepo.DatabasePath },
            });
        });

        app.MapGet("/api/planillas/oportunidad/gestor", (
            HttpContext ctx,
            OportunidadService svc,
            OportunidadRepository repo,
            int? year,
            int? month,
            bool soloNoConfirmadas = false) =>
        {
            var usuario = PlanUserIdentity.GetFromRequest(ctx);
            if (usuario is null)
                return Results.Json(new { error = "Identificá tu usuario para continuar." }, statusCode: StatusCodes.Status401Unauthorized);

            var items = svc.ListarGestor(usuario, year, month, soloNoConfirmadas);
            return Results.Ok(new
            {
                items,
                usuario,
                total = items.Count,
                storage = new { ready = repo.StorageReady, path = repo.DatabasePath },
            });
        });

        app.MapPost("/api/planillas/oportunidad/gestor", (HttpContext ctx, OportunidadUpsertRequest body, OportunidadService svc) =>
        {
            var usuario = PlanUserIdentity.GetFromRequest(ctx);
            if (usuario is null)
                return Results.Json(new { error = "Identificá tu usuario para continuar." }, statusCode: StatusCodes.Status401Unauthorized);

            var error = OportunidadValidator.ValidateGestorUpsert(body);
            if (error is not null)
                return Results.BadRequest(new { error });

            try
            {
                return Results.Ok(svc.Crear(body, usuario));
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, title: "No se pudo guardar la oportunidad");
            }
        });

        app.MapPut("/api/planillas/oportunidad/gestor/{id:int}", (HttpContext ctx, int id, OportunidadUpsertRequest body, OportunidadService svc) =>
        {
            var usuario = PlanUserIdentity.GetFromRequest(ctx);
            if (usuario is null)
                return Results.Json(new { error = "Identificá tu usuario para continuar." }, statusCode: StatusCodes.Status401Unauthorized);

            var error = OportunidadValidator.ValidateGestorUpsert(body);
            if (error is not null)
                return Results.BadRequest(new { error });

            if (!svc.Actualizar(id, body, usuario))
                return Results.NotFound(new { error = "Oportunidad no encontrada." });

            return Results.Ok(new { ok = true });
        });

        app.MapDelete("/api/planillas/oportunidad/gestor/{id:int}", (HttpContext ctx, int id, OportunidadService svc) =>
        {
            var usuario = PlanUserIdentity.GetFromRequest(ctx);
            if (usuario is null)
                return Results.Json(new { error = "Identificá tu usuario para continuar." }, statusCode: StatusCodes.Status401Unauthorized);

            if (!svc.Eliminar(id, usuario))
                return Results.NotFound(new { error = "Oportunidad no encontrada." });

            return Results.Ok(new { ok = true });
        });
    }

    private static async Task<(ReferralGenerateRequest? Payload, IReadOnlyList<IFormFile> Files)> ReadReferralPayloadAsync(
        HttpRequest request,
        CancellationToken ct)
    {
        if (request.HasFormContentType)
        {
            var form = await request.ReadFormAsync(ct).ConfigureAwait(false);
            var json = form["payload"].ToString();
            if (string.IsNullOrWhiteSpace(json))
                return (null, Array.Empty<IFormFile>());

            var payload = JsonSerializer.Deserialize<ReferralGenerateRequest>(
                json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            return (payload, form.Files.GetFiles("capturas"));
        }

        var body = await request.ReadFromJsonAsync<ReferralGenerateRequest>(ct).ConfigureAwait(false);
        return (body, Array.Empty<IFormFile>());
    }
}
