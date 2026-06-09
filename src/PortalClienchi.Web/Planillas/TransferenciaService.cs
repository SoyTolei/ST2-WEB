using PortalClienchi.Core.Configuration;
using PortalClienchi.Core.Models;
using PortalClienchi.Core.Services;

namespace PortalClienchi.Web.Planillas;

public sealed class TransferenciaService
{
    private readonly AppSettings _settings;

    public TransferenciaService(AppSettings settings) => _settings = settings;

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
        CancellationToken ct = default)
    {
        if (!_settings.CapturaHosting.IsActive)
            throw new InvalidOperationException("El hosting de capturas no está configurado en appsettings.");

        if (archivos.Count == 0)
            return Array.Empty<TransferenciaCapturaEnlace>();

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
        if (sistema is PlanillasSistema.None or PlanillasSistema.Legal)
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
        };
    }

    public static string? ValidarRequest(TransferenciaGenerateRequest req)
    {
        var sistema = PlanillasSistemaExtensions.Parse(req.Sistema);
        if (sistema is PlanillasSistema.None or PlanillasSistema.Legal)
            return "Elegí un sistema válido (Bejerman SQL u ONVIO/Bejerman WEB).";

        if (string.IsNullOrWhiteSpace(req.NumeroCliente))
            return "Completá el N° de Cliente.";

        if (string.IsNullOrWhiteSpace(req.Mesa))
            return "Elegí la mesa de destino (Técnico, Flex, SaaS o Sueldos).";

        if (string.IsNullOrWhiteSpace(req.Asunto))
            return "Completá el campo Asunto y/o Error.";

        return null;
    }
}
