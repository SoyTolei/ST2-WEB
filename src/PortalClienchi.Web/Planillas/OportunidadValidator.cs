namespace PortalClienchi.Web.Planillas;

public static class OportunidadValidator
{
    private static readonly HashSet<string> MetodosValidos = new(StringComparer.Ordinal)
    {
        "Telefónicamente", "WhatsApp", "Email",
    };

    public static IReadOnlyList<string> ValidateCarga(OportunidadCargaForm form)
    {
        var errores = new List<string>();
        if (!MetodosValidos.Contains(form.MetodoContacto))
            errores.Add("Seleccione cómo ingresó el contacto.");

        var nc = form.NumeroCliente.Trim();
        if (string.IsNullOrEmpty(nc))
            errores.Add("El N° de Cliente es obligatorio.");
        else if (!nc.All(char.IsDigit))
            errores.Add("El N° de Cliente solo puede contener números.");

        if (string.IsNullOrWhiteSpace(form.RazonSocial))
            errores.Add("La Razón Social es obligatoria.");
        if (string.IsNullOrWhiteSpace(form.NombreContacto))
            errores.Add("El nombre del contacto es obligatorio.");
        if (string.IsNullOrWhiteSpace(form.Telefono))
            errores.Add("El teléfono es obligatorio.");
        if (string.IsNullOrWhiteSpace(form.Horarios))
            errores.Add("Los horarios de contacto son obligatorios.");
        if (string.IsNullOrWhiteSpace(form.Descripcion))
            errores.Add("La descripción de la oportunidad es obligatoria.");

        return errores;
    }

    public static string? ValidateGestorUpsert(OportunidadUpsertRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Fecha))
            return "La fecha es obligatoria.";
        if (string.IsNullOrWhiteSpace(req.Descripcion))
            return "La descripción es obligatoria.";
        if (string.IsNullOrWhiteSpace(req.Link))
            return "El link es obligatorio.";
        return null;
    }
}

public sealed class OportunidadCargaForm
{
    public PlanillasSistema Sistema { get; init; }
    public string MetodoContacto { get; set; } = "NINGUNO";
    public string NumeroCliente { get; set; } = "";
    public string RazonSocial { get; set; } = "";
    public string NombreContacto { get; set; } = "";
    public string Telefono { get; set; } = "";
    public string Correo { get; set; } = "";
    public string Horarios { get; set; } = "";
    public string Descripcion { get; set; } = "";
}
