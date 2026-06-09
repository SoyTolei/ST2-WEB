using System.Globalization;
using PortalClienchi.Core.Configuration;
using PortalClienchi.Core.Services;

namespace PortalClienchi.Web.Planillas;

public sealed class OportunidadService
{
    private readonly AppSettings _settings;
    private readonly OportunidadRepository _repo;
    private readonly string? _contentRoot;

    public OportunidadService(AppSettings settings, OportunidadRepository repo, IWebHostEnvironment env)
    {
        _settings = settings;
        _repo = repo;
        _contentRoot = env.ContentRootPath;
    }

    public bool IaConfigured
    {
        get
        {
            using var ia = new RedaccionIaService(_settings.RedaccionIa);
            return ia.IsConfigured;
        }
    }

    public OportunidadCargaForm FromRequest(OportunidadCargaRequest req)
    {
        var sistema = PlanillasSistemaExtensions.Parse(req.Sistema);
        if (sistema is PlanillasSistema.None or PlanillasSistema.Legal or PlanillasSistema.Chile)
            throw new ArgumentException("Sistema no válido para Oportunidad de Venta.");

        return new OportunidadCargaForm
        {
            Sistema = sistema,
            MetodoContacto = req.MetodoContacto,
            NumeroCliente = req.NumeroCliente.Trim(),
            RazonSocial = req.RazonSocial.Trim(),
            NombreContacto = req.NombreContacto.Trim(),
            Telefono = req.Telefono.Trim(),
            Correo = req.Correo?.Trim() ?? "",
            Horarios = req.Horarios.Trim(),
            Descripcion = req.Descripcion.Trim(),
        };
    }

    public byte[] GenerarPdf(OportunidadCargaForm form) =>
        OportunidadPdfService.GeneratePdfBytes(form, _contentRoot);

    public async Task<OportunidadCargaRequest> MejorarConIaAsync(OportunidadCargaForm form, CancellationToken ct = default)
    {
        using var ia = new RedaccionIaService(_settings.RedaccionIa);
        if (!ia.IsConfigured)
            throw new InvalidOperationException("La redacción con IA no está configurada.");

        var documento = OportunidadTextBuilder.Build(form);
        var mejorado = await ia.MejorarDocumentoPlanillaAsync(documento, ct).ConfigureAwait(false);
        var parsed = PlanillaDocumentoParser.ParseOportunidadCarga(mejorado);

        var result = new OportunidadCargaRequest
        {
            Sistema = form.Sistema.ToString(),
            MetodoContacto = parsed.GetValueOrDefault(PlanillaDocumentoKeys.MetodoContacto, form.MetodoContacto),
            NumeroCliente = parsed.GetValueOrDefault(PlanillaDocumentoKeys.NumeroCliente, form.NumeroCliente),
            RazonSocial = parsed.GetValueOrDefault(PlanillaDocumentoKeys.RazonSocial, form.RazonSocial),
            NombreContacto = parsed.GetValueOrDefault(PlanillaDocumentoKeys.NombreContacto, form.NombreContacto),
            Telefono = parsed.GetValueOrDefault(PlanillaDocumentoKeys.Telefono, form.Telefono),
            Correo = parsed.GetValueOrDefault(PlanillaDocumentoKeys.Correo, form.Correo),
            Horarios = parsed.GetValueOrDefault(PlanillaDocumentoKeys.Horarios, form.Horarios),
            Descripcion = parsed.GetValueOrDefault(PlanillaDocumentoKeys.Descripcion, form.Descripcion),
        };

        if (result.Correo == "No informado")
            result.Correo = "";

        return result;
    }

    public IReadOnlyList<OportunidadRecordDto> ListarGestor(string usuario, int? year, int? month, bool soloNoConfirmadas) =>
        _repo.LoadAll(usuario)
            .Where(r => MatchFilter(r, year, month, soloNoConfirmadas))
            .ToList();

    public OportunidadRecordDto Crear(OportunidadUpsertRequest req, string usuario)
    {
        var id = _repo.Insert(req, usuario);
        return new OportunidadRecordDto
        {
            Id = id,
            Fecha = req.Fecha.Trim(),
            Descripcion = req.Descripcion.Trim(),
            Link = req.Link.Trim(),
            Confirmada = req.Confirmada,
            Porcentaje = string.IsNullOrWhiteSpace(req.Porcentaje) ? "N/D" : req.Porcentaje.Trim(),
        };
    }

    public bool Actualizar(int id, OportunidadUpsertRequest req, string usuario) =>
        _repo.Update(id, req, usuario);

    public bool Eliminar(int id, string usuario) =>
        _repo.Delete(id, usuario);

    private static bool MatchFilter(OportunidadRecordDto r, int? year, int? month, bool soloNoConfirmadas)
    {
        if (soloNoConfirmadas && r.Confirmada)
            return false;

        if (year is null && month is null)
            return true;

        if (!DateTime.TryParse(r.Fecha, CultureInfo.InvariantCulture, DateTimeStyles.None, out var fecha)
            && !DateTime.TryParse(r.Fecha, new CultureInfo("es-AR"), DateTimeStyles.None, out fecha))
            return year is null && month is null;

        if (year is not null && fecha.Year != year)
            return false;
        if (month is not null && fecha.Month != month)
            return false;
        return true;
    }
}
