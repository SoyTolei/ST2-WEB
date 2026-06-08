namespace PortalClienchi.Web.Planillas;

public static class OportunidadTextBuilder
{
    public static string Build(OportunidadCargaForm form)
    {
        var correo = string.IsNullOrWhiteSpace(form.Correo) ? "No informado" : form.Correo.Trim();
        var sistema = form.Sistema.ToDisplayName();
        if (string.IsNullOrEmpty(sistema))
            sistema = "No indicado";

        return string.Join(Environment.NewLine, new[]
        {
            "OPORTUNIDAD DE VENTA",
            $"Sistema seleccionado: {sistema}",
            "",
            $"1) Método de ingreso del contacto: {form.MetodoContacto}",
            $"2) N° de Cliente: {form.NumeroCliente.Trim()}",
            $"3) Razón Social: {form.RazonSocial.Trim()}",
            $"4) Nombre del Contacto: {form.NombreContacto.Trim()}",
            $"5) Teléfono: {form.Telefono.Trim()}",
            $"6) Correo: {correo}",
            $"7) Horarios de contacto: {form.Horarios.Trim()}",
            "",
            "8) Descripción solicitada:",
            form.Descripcion.Trim(),
        });
    }

    public static string PdfTitle(OportunidadCargaForm form)
    {
        var razon = string.IsNullOrWhiteSpace(form.RazonSocial) ? "Sin razón social" : form.RazonSocial.Trim();
        return $"Oportunidad de Venta - {form.NumeroCliente.Trim()} > {razon}";
    }

    public static string SuggestedFileName(OportunidadCargaForm form)
    {
        var num = form.NumeroCliente.Trim();
        var razon = SanitizeFileName(form.RazonSocial.Trim());
        return $"Oportunidad de Venta - {num} - {razon}.pdf";
    }

    private static string SanitizeFileName(string name)
    {
        foreach (var c in Path.GetInvalidFileNameChars())
            name = name.Replace(c, '_');
        return string.IsNullOrWhiteSpace(name) ? "Sin razon social" : name;
    }
}
