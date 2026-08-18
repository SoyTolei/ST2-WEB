using PortalClienchi.Core.Configuration;
using PortalClienchi.Core.Models;
using PortalClienchi.Core.Services;

namespace PortalClienchi.Web.Planillas;

public sealed class TransferenciaService
{
    private readonly AppSettings _settings;
    private readonly LocalCapturaStore _localCapturas;

    public TransferenciaService(AppSettings settings, LocalCapturaStore localCapturas)
    {
        _settings = settings;
        _localCapturas = localCapturas;
    }

    public bool IaConfigured
    {
        get
        {
            using var ia = new RedaccionIaService(_settings.RedaccionIa);
            return ia.IsConfigured;
        }
    }

    public bool CapturaHostingConfigured => _settings.CapturaHosting.IsActive;

    public string? CapturaHostingProveedor =>
        _settings.CapturaHosting.IsActive ? _settings.CapturaHosting.ProveedorEfectivo : null;

    public async Task<IReadOnlyList<TransferenciaCapturaEnlace>> SubirCapturasAsync(
        IReadOnlyList<(string FileName, Stream Content)> archivos,
        string? publicBaseUrl = null,
        CancellationToken ct = default)
    {
        if (!_settings.CapturaHosting.IsActive)
            throw new InvalidOperationException("El hosting de capturas no está configurado en appsettings.");

        if (archivos.Count == 0)
            return Array.Empty<TransferenciaCapturaEnlace>();

        if (_settings.CapturaHosting.IsLocal)
            return await SubirLocalAsync(archivos, publicBaseUrl, ct).ConfigureAwait(false);

        return await SubirExternoAsync(archivos, ct).ConfigureAwait(false);
    }

    private async Task<IReadOnlyList<TransferenciaCapturaEnlace>> SubirLocalAsync(
        IReadOnlyList<(string FileName, Stream Content)> archivos,
        string? publicBaseUrl,
        CancellationToken ct)
    {
        var results = await _localCapturas.GuardarAsync(archivos, publicBaseUrl ?? "", ct).ConfigureAwait(false);
        return MapResults(results);
    }

    private async Task<IReadOnlyList<TransferenciaCapturaEnlace>> SubirExternoAsync(
        IReadOnlyList<(string FileName, Stream Content)> archivos,
        CancellationToken ct)
    {
        var tempDir = Path.Combine(Path.GetTempPath(), $"st2_capturas_{Guid.NewGuid():N}");
        Directory.CreateDirectory(tempDir);

        try
        {
            var paths = new List<string>(archivos.Count);
            foreach (var (fileName, content) in archivos)
            {
                var safeName = Path.GetFileName(fileName);
                if (string.IsNullOrWhiteSpace(safeName))
                    safeName = $"captura_{paths.Count + 1}.png";

                var path = Path.Combine(tempDir, safeName);
                await using (var fs = File.Create(path))
                    await content.CopyToAsync(fs, ct).ConfigureAwait(false);
                paths.Add(path);
            }

            using var hosting = new CapturaHostingService(_settings.CapturaHosting);
            var results = await hosting.SubirArchivosAsync(paths, progress: null, ct).ConfigureAwait(false);
            return MapResults(results);
        }
        finally
        {
            try
            {
                if (Directory.Exists(tempDir))
                    Directory.Delete(tempDir, recursive: true);
            }
            catch
            {
                // ignorar limpieza de temporales
            }
        }
    }

    private static IReadOnlyList<TransferenciaCapturaEnlace> MapResults(IReadOnlyList<CapturaSubidaResult> results)
    {
        var enlaces = new List<TransferenciaCapturaEnlace>();
        var errores = new List<string>();
        foreach (var r in results)
        {
            if (!string.IsNullOrWhiteSpace(r.Url))
                enlaces.Add(new TransferenciaCapturaEnlace(r.FileName, r.Url!));
            else if (!string.IsNullOrWhiteSpace(r.Error))
                errores.Add($"{r.FileName}: {r.Error}");
        }

        if (enlaces.Count == 0 && errores.Count > 0)
            throw new InvalidOperationException(string.Join(Environment.NewLine, errores));

        return enlaces;
    }

    public Task<string> GenerarTextoAsync(TransferenciaCase caso, CancellationToken ct = default) =>
        Task.FromResult(TransferenciaTextBuilder.Build(caso));

    public async Task<TransferenciaIaBorrador> MejorarConIaAsync(TransferenciaCase caso, CancellationToken ct = default)
    {
        using var ia = new RedaccionIaService(_settings.RedaccionIa);
        if (!ia.IsConfigured)
            throw new InvalidOperationException("La redacción con IA no está configurada.");

        if (string.IsNullOrWhiteSpace(caso.Mesa))
            throw new InvalidOperationException("Elegí la mesa de destino antes de usar IA.");

        return await ia.GenerarBorradorTransferenciaAsync(
            caso.Sistema.ToDisplayName(),
            caso.Mesa,
            caso.NumeroCliente,
            caso.Asunto,
            string.IsNullOrWhiteSpace(caso.Descripcion) ? null : caso.Descripcion,
            ct).ConfigureAwait(false);
    }

    public static TransferenciaCase FromRequest(TransferenciaGenerateRequest req)
    {
        var sistema = PlanillasSistemaExtensions.Parse(req.Sistema);
        if (sistema is PlanillasSistema.None)
            throw new ArgumentException("Sistema no válido para transferencia.");
        if (sistema is PlanillasSistema.Legal && !PlanillasFeatureFlags.LegalEnabled)
            throw new ArgumentException("Sistema no válido para transferencia.");

        var enlaces = (req.CapturasEnlaces ?? [])
            .Where(e => !string.IsNullOrWhiteSpace(e.Url))
            .Select(e => new TransferenciaCapturaEnlace(e.FileName, e.Url))
            .ToList();

        var descripcion = req.Descripcion?.Trim() ?? "";
        if (descripcion == TransferenciaCase.DescripcionPlaceholder)
            descripcion = "";

        return new TransferenciaCase
        {
            Sistema = sistema,
            NumeroCliente = req.NumeroCliente.Trim(),
            Mesa = string.IsNullOrWhiteSpace(req.Mesa) ? null : req.Mesa.Trim().ToUpperInvariant(),
            Asunto = req.Asunto.Trim(),
            Descripcion = descripcion,
            Capturas = req.Capturas,
            CapturasArchivos = enlaces.Select(e => e.FileName).ToList(),
            CapturasEnlaces = enlaces,
            TicketSolicitado = req.TicketSolicitado,
            NumeroTicket = req.NumeroTicket?.Trim(),
            PortalLink = req.PortalLink?.Trim(),
            PortalTitulo = req.PortalTitulo?.Trim(),
            Legal = MapLegalTransfer(req.Legal),
        };
    }

    private static LegalTransferFields MapLegalTransfer(LegalTransferDto? dto)
    {
        if (dto is null)
            return new LegalTransferFields();

        return new LegalTransferFields
        {
            Produto = dto.Produto?.Trim() ?? "",
            Modulo = dto.Modulo?.Trim() ?? "",
            Ambiente = dto.Ambiente?.Trim() ?? "",
            UsuarioOnePass = dto.UsuarioOnePass?.Trim() ?? "",
            Escritorio = dto.Escritorio?.Trim() ?? "",
        };
    }

    public static string? ValidarRequest(TransferenciaGenerateRequest req)
    {
        var sistema = PlanillasSistemaExtensions.Parse(req.Sistema);
        if (sistema is PlanillasSistema.None)
            return "Elegí un sistema válido (Bejerman SQL, ONVIO/Bejerman WEB, LEGAL o Chile).";
        if (sistema is PlanillasSistema.Legal && !PlanillasFeatureFlags.LegalEnabled)
            return "El módulo LEGAL estará disponible en una próxima versión.";

        if (string.IsNullOrWhiteSpace(req.Asunto))
            return "Completá el campo Asunto y/o Error.";

        if (sistema == PlanillasSistema.Legal)
            return ValidarLegalTransfer(req);

        if (string.IsNullOrWhiteSpace(req.NumeroCliente))
            return "Completá el N° de Cliente.";

        if (string.IsNullOrWhiteSpace(req.Mesa))
            return "Elegí la mesa de destino (Técnico, Flex, SaaS o Sueldos).";

        return null;
    }

    private static string? ValidarLegalTransfer(TransferenciaGenerateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.NumeroCliente))
            return "Completá la clave de registro.";

        var legal = req.Legal;
        if (legal is null
            || string.IsNullOrWhiteSpace(legal.Produto)
            || legal.Produto == LegalConstants.PlaceholderProduto)
            return "Seleccioná el producto Legal One.";

        if (string.IsNullOrWhiteSpace(legal.Modulo)
            || legal.Modulo == LegalConstants.PlaceholderModulo)
            return "Seleccioná el módulo.";

        if (string.IsNullOrWhiteSpace(legal.Ambiente)
            || legal.Ambiente == LegalConstants.PlaceholderAmbiente)
            return "Seleccioná el ambiente.";

        if (string.IsNullOrWhiteSpace(req.Mesa))
            return "Elegí la mesa de destino.";

        if (string.IsNullOrWhiteSpace(legal.UsuarioOnePass))
            return "Completá el usuario OnePass.";

        if (string.IsNullOrWhiteSpace(legal.Escritorio))
            return "Completá el estudio / empresa.";

        return null;
    }
}
