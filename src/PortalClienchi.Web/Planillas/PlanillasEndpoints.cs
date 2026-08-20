using System.Text.Json;
using PortalClienchi.Core.Configuration;

namespace PortalClienchi.Web.Planillas;

public static class PlanillasEndpoints
{
    private static readonly HashSet<string> ImagenExtensiones = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp",
    };

    private static readonly HashSet<string> VideoExtensiones = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".webm",
    };

    private static readonly HashSet<string> PdfExtensiones = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf",
    };

    private static readonly HashSet<string> TxtExtensiones = new(StringComparer.OrdinalIgnoreCase)
    {
        ".txt",
    };

    private static readonly HashSet<string> TrazaExtensiones = new(StringComparer.OrdinalIgnoreCase)
    {
        ".trc", ".csv", ".txt",
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
                new { id = "Chile", label = PlanillasSistemaExtensions.ChileLabel, placeholder = false, beta = true },
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
            var videos = 0;
            foreach (var file in files)
            {
                if (file.Length == 0)
                    continue;

                var ext = Path.GetExtension(file.FileName);
                var contentType = file.ContentType ?? "";
                var esImagen = ImagenExtensiones.Contains(ext)
                    || contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
                var esVideo = VideoExtensiones.Contains(ext)
                    || contentType.Equals("video/mp4", StringComparison.OrdinalIgnoreCase)
                    || contentType.Equals("video/webm", StringComparison.OrdinalIgnoreCase);
                var esPdf = PdfExtensiones.Contains(ext)
                    || contentType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase);
                var esTxt = TxtExtensiones.Contains(ext)
                    || (string.IsNullOrEmpty(ext)
                        && contentType.Equals("text/plain", StringComparison.OrdinalIgnoreCase));

                if (!esImagen && !esVideo && !esPdf && !esTxt)
                    return Results.BadRequest(new { error = $"Formato no permitido: {file.FileName}. Usá imagen, PDF, TXT o video mp4/webm." });

                if (esVideo)
                    videos++;

                var uploadName = file.FileName;
                if (esTxt && !TxtExtensiones.Contains(ext))
                    uploadName = Path.ChangeExtension(
                        string.IsNullOrWhiteSpace(Path.GetFileNameWithoutExtension(file.FileName))
                            ? "adjunto"
                            : Path.GetFileNameWithoutExtension(file.FileName),
                        ".txt");

                archivos.Add((uploadName, file.OpenReadStream()));
            }

            if (archivos.Count == 0)
                return Results.BadRequest(new { error = "No hay archivos válidos." });
            if (videos > 1)
                return Results.BadRequest(new { error = "Solo se permite 1 video por subida (máx. 100 MB). Si pesa más, subilo en los comentarios del caso." });

            try
            {
                var enlaces = await svc.SubirCapturasAsync(archivos, PublicBaseUrl(request), ct).ConfigureAwait(false);
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

        app.MapPost("/api/planillas/trazas/upload", async (
            HttpRequest request,
            LocalCapturaStore store,
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
                if (!TrazaExtensiones.Contains(ext))
                    return Results.BadRequest(new { error = $"Formato no permitido: {file.FileName}. Solo .trc, .csv o .txt." });

                archivos.Add((file.FileName, file.OpenReadStream()));
            }

            if (archivos.Count == 0)
                return Results.BadRequest(new { error = "No hay archivos válidos." });

            try
            {
                var resultados = await store.GuardarDescargasAsync(archivos, PublicBaseUrl(request), ct)
                    .ConfigureAwait(false);
                var enlaces = resultados
                    .Where(r => !string.IsNullOrWhiteSpace(r.Url))
                    .Select(r => new CapturaEnlaceDto(r.FileName, r.Url!))
                    .ToList();

                if (enlaces.Count == 0)
                {
                    var err = resultados.FirstOrDefault(r => !string.IsNullOrWhiteSpace(r.Error))?.Error
                        ?? "No se pudo guardar la traza.";
                    return Results.BadRequest(new { error = err });
                }

                return Results.Ok(new { enlaces });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, title: "Error al subir traza");
            }
        });

        // Las rutas GET /c/{id} y /media/capturas se registran en Program.cs (antes del fallback SPA).

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

                    var subidos = await svc.SubirCapturasAsync(archivos, PublicBaseUrl(request), ct).ConfigureAwait(false);
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
                caso = await svc.ApplyCapturasUploadAsync(caso, files, PublicBaseUrl(request), ct).ConfigureAwait(false);

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

        app.MapGet("/api/planillas/session", (HttpContext ctx, AppAccessRepository accessRepo, BlanqueoRepository blanqueoRepo) =>
        {
            var email = PlanUserIdentity.GetFromRequest(ctx);
            if (email is null)
                return Results.Ok(new { email = (string?)null, status = "anon" });

            if (!CanEnter(email, accessRepo))
            {
                PlanUserIdentity.ClearCookie(ctx);
                return Results.Ok(new { email = (string?)null, status = "anon" });
            }

            accessRepo.RecordAccess(email);
            blanqueoRepo.AssociatePendingRequester(email);
            return Results.Ok(new { email, status = "ok" });
        });

        app.MapPost("/api/planillas/session/heartbeat", (HttpContext ctx, AppAccessRepository accessRepo, BlanqueoRepository blanqueoRepo) =>
        {
            var email = PlanUserIdentity.GetFromRequest(ctx);
            if (email is null)
                return Results.Json(new { error = "Identificá tu usuario para continuar." }, statusCode: StatusCodes.Status401Unauthorized);

            accessRepo.TouchActivity(email);
            blanqueoRepo.AssociatePendingRequester(email);
            return Results.Ok(new { ok = true, webBuild = St2WebBuild.GetBuild() });
        });

        app.MapPost("/api/planillas/session", (
            HttpContext ctx,
            PlanUserSessionRequest body,
            AppAccessRepository accessRepo,
            BlanqueoRepository blanqueoRepo,
            IConfiguration config) =>
        {
            var email = PlanUserIdentity.ValidateAndNormalize(body.Email);
            if (email is null)
            {
                return Results.BadRequest(new
                {
                    error = "Correo inválido.",
                });
            }

            if (St2SuperAdminGate.RequiresPassword(email))
            {
                if (!St2SuperAdminGate.IsConfigured(config))
                {
                    return Results.Json(new
                    {
                        email,
                        status = "password_required",
                        requiresPassword = true,
                        error = "Acceso de administrador no configurado en el servidor (falta ST2_SUPER_ADMIN_PASSWORD).",
                    }, statusCode: StatusCodes.Status503ServiceUnavailable);
                }

                if (!St2SuperAdminGate.ValidatePassword(config, body.Password))
                {
                    return Results.Json(new
                    {
                        email,
                        status = "password_required",
                        requiresPassword = true,
                        error = string.IsNullOrEmpty(body.Password)
                            ? "Este correo pide contraseña."
                            : "Contraseña incorrecta.",
                    }, statusCode: StatusCodes.Status401Unauthorized);
                }
            }

            return OpenUserSession(ctx, email, accessRepo, blanqueoRepo);
        });

        app.MapDelete("/api/planillas/session", (HttpContext ctx) =>
        {
            PlanUserIdentity.ClearCookie(ctx);
            return Results.Ok(new { ok = true });
        });

        app.MapGet("/api/planillas/modules", (HttpContext ctx, ModuleAccessRepository modules) =>
        {
            var email = PlanUserIdentity.GetFromRequest(ctx);
            if (email is null)
                return Results.Json(new { error = "Identificá tu usuario para continuar." }, statusCode: StatusCodes.Status401Unauthorized);

            var flags = modules.GetFlags(email);
            return Results.Ok(new
            {
                email,
                modules = new
                {
                    oportunidad = flags.Oportunidad,
                    pdfPortal = flags.PdfPortal,
                    blanqueo = flags.Blanqueo,
                    blanqueoConfirm = flags.BlanqueoConfirm,
                    blanqueoLoad = flags.BlanqueoLoad,
                },
            });
        });

        app.MapGet("/api/access/admin/session", (HttpContext ctx, IConfiguration config) =>
        {
            if (!St2AccessAdminAuth.IsConfigured(config))
                return Results.Json(new { error = "Panel no configurado.", authenticated = false }, statusCode: StatusCodes.Status404NotFound);

            return Results.Ok(new { authenticated = St2AccessAdminAuth.IsAuthenticated(config, ctx) });
        });

        app.MapPost("/api/access/admin/session", async (HttpContext ctx, IConfiguration config, CancellationToken ct) =>
        {
            if (!St2AccessAdminAuth.IsConfigured(config))
                return Results.Json(new { error = "Panel no configurado en el servidor (faltan variables de admin)." }, statusCode: StatusCodes.Status404NotFound);

            St2AccessAdminLoginRequest? body;
            try
            {
                body = await ctx.Request.ReadFromJsonAsync<St2AccessAdminLoginRequest>(cancellationToken: ct).ConfigureAwait(false);
            }
            catch (Exception)
            {
                return Results.BadRequest(new { error = "Datos inválidos." });
            }

            if (body is null)
                return Results.BadRequest(new { error = "Datos inválidos." });

            if (!St2AccessAdminAuth.ValidateLogin(config, body.Username, body.Password))
            {
                return Results.Json(new { error = "Usuario o contraseña incorrectos." }, statusCode: StatusCodes.Status401Unauthorized);
            }

            St2AccessAdminAuth.SetCookie(ctx, config);
            return Results.Ok(new { ok = true });
        });

        app.MapDelete("/api/access/admin/session", (HttpContext ctx) =>
        {
            St2AccessAdminAuth.ClearCookie(ctx);
            return Results.Ok(new { ok = true });
        });

        app.MapGet("/api/access/registrations", (HttpContext ctx, IConfiguration config, AppAccessRepository accessRepo, ModuleAccessRepository modules) =>
        {
            if (!St2AccessAdminAuth.IsConfigured(config))
                return Results.NotFound();

            if (!St2AccessAdminAuth.IsAuthenticated(config, ctx))
                return Results.Json(new { error = "Acceso denegado." }, statusCode: StatusCodes.Status401Unauthorized);

            try
            {
                var items = accessRepo.ListAll();
                const int activeMinutes = 5;
                var activeWindow = TimeSpan.FromMinutes(activeMinutes);
                IReadOnlyDictionary<string, ModuleAccessFlagsDto> flagsMap;
                try
                {
                    flagsMap = modules.GetFlagsForEmails(items.Select(i => i.Email));
                }
                catch
                {
                    flagsMap = new Dictionary<string, ModuleAccessFlagsDto>(StringComparer.OrdinalIgnoreCase);
                }

                var mapped = items.Select(item =>
                {
                    flagsMap.TryGetValue(item.Email, out var flags);
                    flags ??= new ModuleAccessFlagsDto();
                    var status = string.IsNullOrWhiteSpace(item.Status)
                        ? AppAccessRepository.StatusApproved
                        : item.Status;
                    return new
                    {
                        item.Email,
                        item.FirstSeenAt,
                        item.LastSeenAt,
                        item.LoginCount,
                        item.DisplayName,
                        item.LastLoginAt,
                        status,
                        isActive = status == AppAccessRepository.StatusApproved
                            && AppAccessRepository.IsRecentlyActive(item.LastSeenAt, activeWindow),
                        isNewToday = status == AppAccessRepository.StatusApproved
                            && AppAccessRepository.IsNewTodayRegistration(item.FirstSeenAt),
                        isReturning = item.LoginCount > 1,
                        isPending = status == AppAccessRepository.StatusPending,
                        isRejected = status == AppAccessRepository.StatusRejected,
                        loggedInToday = AppAccessRepository.IsLoggedInToday(item.LastLoginAt),
                        modules = new
                        {
                            oportunidad = flags.Oportunidad,
                            pdfPortal = flags.PdfPortal,
                            blanqueo = flags.Blanqueo,
                            blanqueoConfirm = flags.BlanqueoConfirm,
                            blanqueoLoad = flags.BlanqueoLoad,
                        },
                    };
                }).ToList();

                var summary = accessRepo.BuildSummary(items, activeWindow);

                return Results.Ok(new
                {
                    items = mapped,
                    total = summary.Total,
                    activeCount = summary.ActiveCount,
                    newTodayCount = summary.NewTodayCount,
                    pendingCount = summary.PendingCount,
                    loggedInTodayCount = summary.LoggedInTodayCount,
                    activeWindowMinutes = summary.ActiveWindowMinutes,
                });
            }
            catch (Exception ex)
            {
                return Results.Json(new { error = "No se pudo cargar la lista de accesos.", detail = ex.Message }, statusCode: StatusCodes.Status500InternalServerError);
            }
        });

        app.MapDelete("/api/access/registrations", (
            HttpContext ctx,
            IConfiguration config,
            AppAccessRepository accessRepo,
            ModuleAccessRepository modules,
            string? email) =>
        {
            if (!St2AccessAdminAuth.IsConfigured(config))
                return Results.NotFound();

            if (!St2AccessAdminAuth.IsAuthenticated(config, ctx))
                return Results.Json(new { error = "Acceso denegado." }, statusCode: StatusCodes.Status401Unauthorized);

            if (string.IsNullOrWhiteSpace(email))
                return Results.BadRequest(new { error = "Falta el correo." });

            var removed = accessRepo.DeleteByEmail(email);
            modules.DeleteByEmail(email);
            if (removed <= 0)
                return Results.NotFound(new { error = "No se encontró ese acceso." });

            return Results.Ok(new { ok = true, email = email.Trim().ToLowerInvariant(), removed });
        });

        app.MapPost("/api/access/registrations/decision", (
            HttpContext ctx,
            IConfiguration config,
            AppAccessRepository accessRepo,
            AccessDecisionRequest body) =>
        {
            if (!St2AccessAdminAuth.IsConfigured(config))
                return Results.NotFound();

            if (!St2AccessAdminAuth.IsAuthenticated(config, ctx))
                return Results.Json(new { error = "Acceso denegado." }, statusCode: StatusCodes.Status401Unauthorized);

            var email = PlanUserIdentity.ValidateAndNormalize(body.Email);
            if (email is null)
                return Results.BadRequest(new { error = "Correo inválido." });

            var action = (body.Action ?? "").Trim().ToLowerInvariant();
            var status = action switch
            {
                "approve" or "aprobar" => AppAccessRepository.StatusApproved,
                "reject" or "rechazar" => AppAccessRepository.StatusRejected,
                _ => null,
            };
            if (status is null)
                return Results.BadRequest(new { error = "Acción inválida." });

            if (accessRepo.SetStatus(email, status) <= 0)
                return Results.NotFound(new { error = "No se encontró esa solicitud." });

            return Results.Ok(new { ok = true, email, status });
        });

        app.MapPut("/api/access/registrations/modules", (HttpContext ctx, IConfiguration config, ModuleAccessRepository modules, ModuleAccessUpdateRequest body) =>
        {
            if (!St2AccessAdminAuth.IsConfigured(config))
                return Results.NotFound();

            if (!St2AccessAdminAuth.IsAuthenticated(config, ctx))
                return Results.Json(new { error = "Acceso denegado." }, statusCode: StatusCodes.Status401Unauthorized);

            try
            {
                var flags = modules.Upsert(body);
                return Results.Ok(new
                {
                    ok = true,
                    email = PlanUserIdentity.ValidateAndNormalize(body.Email),
                    modules = new
                    {
                        oportunidad = flags.Oportunidad,
                        pdfPortal = flags.PdfPortal,
                        blanqueo = flags.Blanqueo,
                        blanqueoConfirm = flags.BlanqueoConfirm,
                        blanqueoLoad = flags.BlanqueoLoad,
                    },
                });
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        app.MapPatch("/api/access/registrations", async (
            HttpContext ctx,
            IConfiguration config,
            AppAccessRepository accessRepo,
            BlanqueoRepository blanqueoRepo,
            CancellationToken ct) =>
        {
            if (!St2AccessAdminAuth.IsConfigured(config))
                return Results.NotFound();

            if (!St2AccessAdminAuth.IsAuthenticated(config, ctx))
                return Results.Json(new { error = "Acceso denegado." }, statusCode: StatusCodes.Status401Unauthorized);

            var body = await ctx.Request.ReadFromJsonAsync<AccessDisplayNameRequest>(cancellationToken: ct).ConfigureAwait(false);
            if (body is null || string.IsNullOrWhiteSpace(body.Email))
                return Results.BadRequest(new { error = "Falta el correo." });

            var updated = accessRepo.UpdateDisplayName(body.Email, body.DisplayName);
            if (updated <= 0)
                return Results.NotFound(new { error = "No se encontró ese acceso." });

            var email = body.Email.Trim().ToLowerInvariant();
            var displayName = string.IsNullOrWhiteSpace(body.DisplayName) ? null : body.DisplayName.Trim();
            blanqueoRepo.AssociatePendingRequester(email, displayName);

            return Results.Ok(new
            {
                ok = true,
                email,
                displayName,
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

    private static bool CanEnter(string email, AppAccessRepository accessRepo)
    {
        if (St2SuperAdmin.Is(email))
            accessRepo.EnsureApproved(email);
        return accessRepo.IsApprovedForApp(email);
    }

    private static IResult OpenUserSession(
        HttpContext ctx,
        string email,
        AppAccessRepository accessRepo,
        BlanqueoRepository blanqueoRepo)
    {
        if (St2SuperAdmin.Is(email))
        {
            accessRepo.EnsureApproved(email);
            PlanUserIdentity.SetCookie(ctx, email);
            accessRepo.RecordAccess(email);
            blanqueoRepo.AssociatePendingRequester(email);
            return Results.Ok(new { email, status = "ok" });
        }

        var rec = accessRepo.Find(email);
        var status = rec?.Status ?? "";
        if (rec is null || string.Equals(status, AppAccessRepository.StatusPending, StringComparison.OrdinalIgnoreCase))
        {
            accessRepo.RequestAccess(email);
            return Results.Json(new
            {
                email,
                status = AppAccessRepository.StatusPending,
                error = "Tu acceso quedó pendiente de aprobación. Cuando te habiliten, volvé a ingresar con el mismo correo.",
            }, statusCode: StatusCodes.Status403Forbidden);
        }

        if (string.Equals(status, AppAccessRepository.StatusRejected, StringComparison.OrdinalIgnoreCase))
        {
            return Results.Json(new
            {
                email,
                status = AppAccessRepository.StatusRejected,
                error = "Este correo no está autorizado. Pedile acceso a quien administra ST2.",
            }, statusCode: StatusCodes.Status403Forbidden);
        }

        PlanUserIdentity.SetCookie(ctx, email);
        accessRepo.RecordAccess(email);
        blanqueoRepo.AssociatePendingRequester(email);
        return Results.Ok(new { email, status = "ok" });
    }

    internal static string PublicBaseUrl(HttpRequest request)
    {
        // Preferir la base configurada (evita hosts internos de Railway en el TXT).
        var configured = request.HttpContext.RequestServices.GetService<AppSettings>();
        var fromSettings = configured?.CapturaHosting.PublicBaseUrl?.Trim();
        if (!string.IsNullOrWhiteSpace(fromSettings))
            return fromSettings.TrimEnd('/');

        var proto = request.Headers["X-Forwarded-Proto"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(proto))
            proto = request.Scheme;
        var host = request.Headers["X-Forwarded-Host"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(host))
            host = request.Host.Value;
        var url = $"{proto}://{host}".TrimEnd('/');
        if (url.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            && url.Contains("tolei.dev", StringComparison.OrdinalIgnoreCase))
            url = "https://" + url["http://".Length..];
        return url;
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
