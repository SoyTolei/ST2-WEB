using System.Text.RegularExpressions;

namespace PortalClienchi.Web.Planillas;

public static class PlanillaDocumentoKeys
{
    public const string Asunto = "asunto";
    public const string Descripcion = "descripcion";
    public const string PasoAPaso = "pasoAPaso";
    public const string MetodoContacto = "metodoContacto";
    public const string NumeroCliente = "numeroCliente";
    public const string RazonSocial = "razonSocial";
    public const string NombreContacto = "nombreContacto";
    public const string Telefono = "telefono";
    public const string Correo = "correo";
    public const string Horarios = "horarios";
    public const string LegalDescripcion = "descripcion";
    public const string LegalPasos = "pasos";
    public const string LegalFound = "found";
    public const string LegalExpected = "expected";
}

public static class PlanillaDocumentoParser
{
    private static readonly Regex DerivaAsuntoRegex = new(
        @"Se deriva a .+ debido a la siguiente consulta o requerimiento:\s*(.+)$",
        RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static IReadOnlyDictionary<string, string> ParseReferral(string documento)
    {
        var bloque = ExtractBlock(
            documento,
            "DETALLES DEL CASO",
            "COMPROBACIONES Y PROCESOS REALIZADOS",
            "SE ADJUNTA EN COMENTARIOS");

        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        if (TryLineValue(bloque, "ASUNTO Y/O ERROR:", out var asunto))
            result[PlanillaDocumentoKeys.Asunto] = asunto;

        if (TryLineValue(bloque, "DESCRIPCIÓN DEL CASO:", out var desc))
            result[PlanillaDocumentoKeys.Descripcion] = desc;
        else if (TryMultilineAfterLabel(bloque, "DESCRIPCIÓN DEL CASO:", out desc))
            result[PlanillaDocumentoKeys.Descripcion] = desc;

        if (TryLineValue(bloque, "PASO A PASO REALIZADO:", out var paso))
            result[PlanillaDocumentoKeys.PasoAPaso] = paso;
        else if (TryMultilineAfterLabel(bloque, "PASO A PASO REALIZADO:", out paso))
            result[PlanillaDocumentoKeys.PasoAPaso] = paso;

        return result;
    }

    public static IReadOnlyDictionary<string, string> ParseOportunidadCarga(string documento)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        TryRegexField(documento, @"1\)\s*Método de ingreso del contacto:\s*(.+)", PlanillaDocumentoKeys.MetodoContacto, result);
        TryRegexField(documento, @"2\)\s*N° de Cliente:\s*(.+)", PlanillaDocumentoKeys.NumeroCliente, result);
        TryRegexField(documento, @"3\)\s*Razón Social:\s*(.+)", PlanillaDocumentoKeys.RazonSocial, result);
        TryRegexField(documento, @"4\)\s*Nombre del Contacto:\s*(.+)", PlanillaDocumentoKeys.NombreContacto, result);
        TryRegexField(documento, @"5\)\s*Teléfono:\s*(.+)", PlanillaDocumentoKeys.Telefono, result);
        TryRegexField(documento, @"6\)\s*Correo:\s*(.+)", PlanillaDocumentoKeys.Correo, result);
        TryRegexField(documento, @"7\)\s*Horarios de contacto:\s*(.+)", PlanillaDocumentoKeys.Horarios, result);

        if (TryMultilineAfterLabel(documento, "8) Descripción solicitada:", out var desc))
            result[PlanillaDocumentoKeys.Descripcion] = desc;

        return result;
    }

    public static IReadOnlyDictionary<string, string> ParseLegalN2(string documento)
    {
        var bloque = ExtractBlock(documento, "DETALLES DEL CASO", "==========================================");
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var fields = new (string Label, string Key)[]
        {
            ("DESCRIPCIÓN DE LA INCIDENCIA:", PlanillaDocumentoKeys.LegalDescripcion),
            ("PASOS REALIZADOS:", PlanillaDocumentoKeys.LegalPasos),
            ("RESULTADO OBSERVADO:", PlanillaDocumentoKeys.LegalFound),
            ("RESULTADO ESPERADO:", PlanillaDocumentoKeys.LegalExpected),
        };

        foreach (var field in fields)
        {
            var stopLabels = fields
                .Where(f => !string.Equals(f.Label, field.Label, StringComparison.OrdinalIgnoreCase))
                .Select(f => f.Label)
                .ToArray();
            if (TryMultilineLegalField(bloque, field.Label, stopLabels, out var value))
                result[field.Key] = value;
        }

        return result;
    }

    private static bool TryMultilineLegalField(string text, string label, string[] stopLabels, out string value)
    {
        value = "";
        var lines = text.Split('\n');
        var capture = false;
        var buffer = new List<string>();

        foreach (var raw in lines)
        {
            var line = raw.TrimEnd();
            if (!capture)
            {
                if (line.TrimStart().StartsWith(label, StringComparison.OrdinalIgnoreCase))
                {
                    var rest = line.Trim();
                    var inline = rest[label.Length..].Trim();
                    if (inline.Length > 0)
                        buffer.Add(inline);
                    capture = true;
                }

                continue;
            }

            var trimmed = line.TrimStart();
            if (line.StartsWith("========", StringComparison.Ordinal)
                || line.StartsWith("────────────────", StringComparison.Ordinal)
                || trimmed.StartsWith("PASO A PASO", StringComparison.OrdinalIgnoreCase)
                || stopLabels.Any(s => trimmed.StartsWith(s, StringComparison.OrdinalIgnoreCase)))
                break;

            if (line.Length == 0 && buffer.Count == 0)
                continue;

            buffer.Add(line);
        }

        value = string.Join(Environment.NewLine, buffer).Trim();
        return value.Length > 0;
    }

    private static void TryRegexField(string documento, string pattern, string key, Dictionary<string, string> result)
    {
        var m = Regex.Match(documento, pattern, RegexOptions.Multiline | RegexOptions.IgnoreCase);
        if (!m.Success)
            return;

        var value = m.Groups[1].Value.Trim();
        if (value.Length > 0)
            result[key] = value;
    }

    private static string ExtractBlock(string doc, string startMarker, params string[] endMarkers)
    {
        var idx = doc.IndexOf(startMarker, StringComparison.OrdinalIgnoreCase);
        if (idx < 0)
            return doc;

        var start = idx + startMarker.Length;
        var end = doc.Length;
        foreach (var marker in endMarkers)
        {
            var pos = doc.IndexOf(marker, start, StringComparison.OrdinalIgnoreCase);
            if (pos >= 0 && pos < end)
                end = pos;
        }

        return doc[start..end];
    }

    private static bool TryLineValue(string text, string label, out string value)
    {
        value = "";
        foreach (var line in text.Split('\n'))
        {
            var t = line.Trim();
            if (!t.StartsWith(label, StringComparison.OrdinalIgnoreCase))
                continue;

            value = t[label.Length..].Trim();
            return value.Length > 0;
        }

        return false;
    }

    private static bool TryMultilineAfterLabel(string text, string label, out string value)
    {
        value = "";
        var lines = text.Split('\n');
        var capture = false;
        var buffer = new List<string>();

        foreach (var raw in lines)
        {
            var line = raw.TrimEnd();
            if (!capture)
            {
                if (line.TrimStart().StartsWith(label, StringComparison.OrdinalIgnoreCase))
                {
                    var rest = line.Trim();
                    var inline = rest[label.Length..].Trim();
                    if (inline.Length > 0)
                        buffer.Add(inline);
                    capture = true;
                }

                continue;
            }

            if (line.StartsWith("========", StringComparison.Ordinal)
                || line.StartsWith("────────────────", StringComparison.Ordinal)
                || line.StartsWith("PASO A PASO", StringComparison.OrdinalIgnoreCase)
                || line.StartsWith("ASUNTO Y/O", StringComparison.OrdinalIgnoreCase)
                || line.StartsWith("Se deriva a", StringComparison.OrdinalIgnoreCase)
                || Regex.IsMatch(line, @"^\d+\)"))
                break;

            if (line.Length == 0 && buffer.Count == 0)
                continue;

            buffer.Add(line);
        }

        value = string.Join(Environment.NewLine, buffer).Trim();
        return value.Length > 0;
    }
}
