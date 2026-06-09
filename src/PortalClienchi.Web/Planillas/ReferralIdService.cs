using PortalClienchi.Core.Configuration;
using PortalClienchi.Core.Services;

namespace PortalClienchi.Web.Planillas;

public sealed class ReferralIdService
{
    private readonly AppSettings _settings;
    private readonly TransferenciaService _capturas;

    public ReferralIdService(AppSettings settings, TransferenciaService capturas)
    {
        _settings = settings;
        _capturas = capturas;
    }

    public bool IaConfigured => _capturas.IaConfigured;

    public ReferralIdCase FromRequest(ReferralGenerateRequest req)
    {
        var sistema = PlanillasSistemaExtensions.Parse(req.Sistema);
        if (sistema is PlanillasSistema.None or PlanillasSistema.Legal)
            throw new ArgumentException("Sistema no válido para Referral I+D.");

        var caso = new ReferralIdCase { Sistema = sistema };
        caso.Version = string.IsNullOrWhiteSpace(req.Version) ? ReferralIdConstants.PlaceholderVersion : req.Version.Trim();
        caso.Modulo = string.IsNullOrWhiteSpace(req.Modulo) ? ReferralIdConstants.PlaceholderModulo : req.Modulo.Trim();
        caso.Collation = string.IsNullOrWhiteSpace(req.Collation) ? ReferralIdConstants.PlaceholderCollation : req.Collation.Trim();
        caso.SqlServer = string.IsNullOrWhiteSpace(req.SqlServer) ? ReferralIdConstants.PlaceholderSqlServer : req.SqlServer.Trim();
        caso.Asunto = req.Asunto.Trim();
        caso.Descripcion = NormalizePlaceholder(req.Descripcion, ReferralIdConstants.PlaceholderDescripcion);
        caso.PasoAPaso = NormalizePlaceholder(req.PasoAPaso, ReferralIdConstants.PlaceholderPasoAPaso);

        if (req.MamSelections is not null)
        {
            foreach (var kv in req.MamSelections)
                if (caso.Mam.Selections.ContainsKey(kv.Key))
                    caso.Mam.Selections[kv.Key] = kv.Value;
        }
        caso.Mam.PersActuNombre = req.MamPersActuNombre?.Trim() ?? "";
        caso.Mam.TriggersDesactivados = req.MamTriggersDesactivados?.Trim() ?? "";

        if (req.SdkSelections is not null)
        {
            foreach (var kv in req.SdkSelections)
                if (caso.Sdk.Selections.ContainsKey(kv.Key))
                    caso.Sdk.Selections[kv.Key] = kv.Value;
        }
        caso.Sdk.AplicacionIntegracion = req.SdkAplicacionIntegracion?.Trim() ?? "";

        if (req.Planilla is not null)
        {
            caso.Planilla.Relevada = req.Planilla.Relevada;
            caso.Planilla.ProcesoFuncionaba = req.Planilla.ProcesoFuncionaba;
            caso.Planilla.ReproduceError = req.Planilla.ReproduceError;
            caso.Planilla.UltimaActualizOk = req.Planilla.UltimaActualizOk;
            caso.Planilla.OptVinculos = req.Planilla.OptVinculos;
            caso.Planilla.OptBaseModelo = req.Planilla.OptBaseModelo;
            caso.Planilla.OptSoloCliente = req.Planilla.OptSoloCliente;
            caso.Planilla.OptReproduceSistematicamente = req.Planilla.OptReproduceSistematicamente;
        }

        if (req.Onvio is not null)
        {
            caso.Onvio.ProcesoFuncionaba = req.Onvio.ProcesoFuncionaba;
            caso.Onvio.ReproduceSistematicamente = req.Onvio.ReproduceSistematicamente;
            caso.Onvio.HayTicket = req.Onvio.HayTicket;
            caso.Onvio.NumeroTicket = req.Onvio.NumeroTicket?.Trim() ?? "";
            caso.Onvio.Tecnico = req.Onvio.Tecnico?.Trim() ?? "";
            caso.Onvio.ReproduceConTicket = req.Onvio.ReproduceConTicket;
            caso.Onvio.ReproduceEmpresaPrueba = req.Onvio.ReproduceEmpresaPrueba;
            caso.Onvio.AdjuntaPantallas = req.Onvio.AdjuntaPantallas;
            caso.Onvio.UsuarioContador = req.Onvio.UsuarioContador?.Trim() ?? "";
            caso.Onvio.Empresa = req.Onvio.Empresa?.Trim() ?? "";
        }
        caso.Onvio.TicketAvisoOmitido = req.TicketAvisoOmitido;

        if (req.Adjuntos is not null)
        {
            caso.Adjuntos.Pantallas = req.Adjuntos.Pantallas;
            caso.Adjuntos.TrazaSql = req.Adjuntos.TrazaSql;
            caso.Adjuntos.BackupBases = req.Adjuntos.BackupBases;
            caso.Adjuntos.BackupManager = req.Adjuntos.BackupManager;
            caso.Adjuntos.BackupSbda = req.Adjuntos.BackupSbda;
            caso.Adjuntos.BackupCg = req.Adjuntos.BackupCg;
            caso.Adjuntos.BackupSj = req.Adjuntos.BackupSj;
        }

        caso.CapturasEnlaces = (req.CapturasEnlaces ?? [])
            .Where(e => !string.IsNullOrWhiteSpace(e.Url))
            .Select(e => new TransferenciaCapturaEnlace(e.FileName, e.Url))
            .ToList();

        return caso;
    }

    public bool QuiereAdjuntarPantallas(ReferralIdCase caso) =>
        caso.Sistema == PlanillasSistema.BejermanSql
            ? caso.Adjuntos.Pantallas
            : caso.Onvio.AdjuntaPantallas;

    public async Task<ReferralIdCase> ApplyCapturasUploadAsync(
        ReferralIdCase caso,
        IReadOnlyList<IFormFile> files,
        CancellationToken ct)
    {
        var enlaces = caso.CapturasEnlaces.ToList();
        if (files.Count == 0)
        {
            caso.CapturasEnlaces = enlaces;
            return caso;
        }

        var buffers = new List<(string FileName, MemoryStream Content)>();
        try
        {
            foreach (var file in files.Where(f => f.Length > 0))
            {
                var ms = new MemoryStream();
                await file.CopyToAsync(ms, ct).ConfigureAwait(false);
                ms.Position = 0;
                buffers.Add((file.FileName, ms));
            }

            if (buffers.Count == 0)
            {
                caso.CapturasEnlaces = enlaces;
                return caso;
            }

            var archivos = buffers.Select(b => (b.FileName, (Stream)b.Content)).ToList();
            var subidos = await _capturas.SubirCapturasAsync(archivos, ct).ConfigureAwait(false);
            enlaces.AddRange(subidos);

            if (enlaces.Count == 0)
            {
                throw new InvalidOperationException(
                    "No se pudieron subir las capturas. Verificá el formato (PNG, JPG, etc.) y la configuración de hosting.");
            }

            if (caso.Sistema == PlanillasSistema.BejermanSql)
                caso.Adjuntos.Pantallas = true;
            else if (caso.Sistema == PlanillasSistema.OnvioWeb)
                caso.Onvio.AdjuntaPantallas = true;
        }
        finally
        {
            foreach (var (_, stream) in buffers)
                await stream.DisposeAsync().ConfigureAwait(false);
        }

        caso.CapturasEnlaces = enlaces;
        return caso;
    }

    public string GenerarTexto(ReferralIdCase caso) => ReferralIdTextBuilder.Build(caso);

    public async Task<string> MejorarConIaAsync(ReferralIdCase caso, CancellationToken ct = default)
    {
        using var ia = new RedaccionIaService(_settings.RedaccionIa);
        if (!ia.IsConfigured)
            throw new InvalidOperationException("La redacción con IA no está configurada.");

        var documento = ReferralIdTextBuilder.Build(caso);
        return await ia.MejorarDocumentoPlanillaAsync(documento, ct).ConfigureAwait(false);
    }

    private static string NormalizePlaceholder(string? text, string placeholder)
    {
        var t = text?.Trim() ?? "";
        return t == placeholder ? "" : t;
    }
}
