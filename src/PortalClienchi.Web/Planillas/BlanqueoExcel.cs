using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using ClosedXML.Excel;

namespace PortalClienchi.Web.Planillas;

public static class BlanqueoExcel
{
    private static readonly string[] DetailHeaders =
    [
        "Fecha",
        "Plataforma",
        "NroCaso",
        "NroCliente",
        "Correo",
        "Solicitud",
        "Modulos",
        "SolicitadoPorNombre",
        "Listo",
        "ConfirmadoPor",
        "Aclaracion",
    ];

    public static byte[] BuildExportWorkbook(IReadOnlyList<BlanqueoRecordDto> items)
    {
        using var wb = new XLWorkbook();
        var detalle = wb.Worksheets.Add("Solicitudes");
        for (var i = 0; i < DetailHeaders.Length; i++)
            detalle.Cell(1, i + 1).Value = DetailHeaders[i];

        var row = 2;
        foreach (var item in items.OrderByDescending(x => x.FechaSolicitud).ThenByDescending(x => x.Id))
        {
            detalle.Cell(row, 1).Value = item.FechaSolicitud;
            detalle.Cell(row, 2).Value = PortalLabel(item.Portal);
            detalle.Cell(row, 3).Value = item.NroCaso;
            detalle.Cell(row, 4).Value = item.NroCliente;
            detalle.Cell(row, 5).Value = item.Correo;
            detalle.Cell(row, 6).Value = item.TipoSolicitud;
            detalle.Cell(row, 7).Value = item.ModulosDetalle?.Replace('|', ',') ?? "";
            detalle.Cell(row, 8).Value = item.SolicitadoPorNombre;
            detalle.Cell(row, 9).Value = item.Listo ? "Sí" : "No";
            detalle.Cell(row, 10).Value = item.ConfirmadoPorNombre ?? "";
            detalle.Cell(row, 11).Value = item.Aclaracion ?? "";
            row++;
        }

        detalle.Row(1).Style.Font.Bold = true;
        detalle.SheetView.FreezeRows(1);
        detalle.Columns().AdjustToContents(1, 40);

        var resumen = wb.Worksheets.Add("Resumen mensual");
        resumen.Cell(1, 1).Value = "Año";
        resumen.Cell(1, 2).Value = "Mes";
        resumen.Cell(1, 3).Value = "MesLabel";
        resumen.Cell(1, 4).Value = "Cantidad";
        resumen.Cell(1, 5).Value = "Listos";
        resumen.Cell(1, 6).Value = "Pendientes";
        resumen.Row(1).Style.Font.Bold = true;

        var groups = items
            .Select(x => new { Item = x, Key = MonthKey(x.FechaSolicitud) })
            .Where(x => !string.IsNullOrEmpty(x.Key))
            .GroupBy(x => x.Key!)
            .OrderByDescending(g => g.Key)
            .ToList();

        var r = 2;
        foreach (var g in groups)
        {
            var parts = g.Key.Split('-');
            var year = parts[0];
            var month = parts.Length > 1 ? parts[1] : "";
            resumen.Cell(r, 1).Value = year;
            resumen.Cell(r, 2).Value = month;
            resumen.Cell(r, 3).Value = MonthLabel(g.Key);
            resumen.Cell(r, 4).Value = g.Count();
            resumen.Cell(r, 5).Value = g.Count(x => x.Item.Listo);
            resumen.Cell(r, 6).Value = g.Count(x => !x.Item.Listo);
            r++;
        }

        resumen.SheetView.FreezeRows(1);
        resumen.Columns().AdjustToContents(1, 24);

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    public static byte[] BuildImportTemplate()
    {
        // Misma estructura que el export (hoja Solicitudes + encabezados idénticos).
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Solicitudes");
        for (var i = 0; i < DetailHeaders.Length; i++)
            ws.Cell(1, i + 1).Value = DetailHeaders[i];

        ws.Cell(2, 1).Value = "2026-07-15";
        ws.Cell(2, 2).Value = "On Balance";
        ws.Cell(2, 3).Value = "123456";
        ws.Cell(2, 4).Value = "7890";
        ws.Cell(2, 5).Value = "cliente@ejemplo.com";
        ws.Cell(2, 6).Value = "Blanqueo";
        ws.Cell(2, 7).Value = "";
        ws.Cell(2, 8).Value = "Leonel Gallo";
        ws.Cell(2, 9).Value = "Sí";
        ws.Cell(2, 10).Value = "Alexis Ruiz";
        ws.Cell(2, 11).Value = "";

        ws.Row(1).Style.Font.Bold = true;
        ws.SheetView.FreezeRows(1);
        ws.Columns().AdjustToContents(1, 36);

        var help = wb.Worksheets.Add("Ayuda");
        help.Cell(1, 1).Value = "Usá el mismo modelo que Exportar Excel.";
        help.Cell(2, 1).Value = "Completá o pegá filas en la hoja Solicitudes (mismos encabezados).";
        help.Cell(3, 1).Value = "SolicitadoPorNombre: nombre y apellido tal cual en Accesos (se asocia el mail solo).";
        help.Cell(4, 1).Value = "Plataforma: On Balance | ONVIO | Portal Cliente";
        help.Cell(5, 1).Value = "Listo: Sí / No · Aclaracion: vacío | No registrado | otra nota";
        help.Cell(6, 1).Value = "Portal Cliente · Habilitación de Módulos: en Modulos usá Sueldos SQL | Sueldos WEB | ONVIO | Bejerman SQL | Contabilidad WEB";
        help.Cell(7, 1).Value = "La hoja Resumen mensual del export se ignora al importar.";
        help.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    public static (List<BlanqueoHistoricalRow> Rows, List<string> Errors, List<string> PendingAgents) ParseImport(
        Stream stream,
        string fileName,
        IReadOnlyList<AppAccessRecordDto>? directory = null)
    {
        var errors = new List<string>();
        var pendingAgents = new List<string>();
        var rows = new List<BlanqueoHistoricalRow>();
        var users = BuildUserIndex(directory ?? []);
        using var wb = new XLWorkbook(stream);
        // Mismo modelo que el export: hoja "Solicitudes" (ignora Resumen/Ayuda).
        var ws = wb.Worksheets.FirstOrDefault(w => w.Name.Equals("Solicitudes", StringComparison.OrdinalIgnoreCase))
                 ?? wb.Worksheets.FirstOrDefault(w =>
                        !w.Name.Equals("Ayuda", StringComparison.OrdinalIgnoreCase)
                        && !w.Name.Equals("Resumen mensual", StringComparison.OrdinalIgnoreCase))
                 ?? wb.Worksheets.First();

        var headerMap = MapHeaders(ws);
        if (!headerMap.ContainsKey("correo") || !headerMap.ContainsKey("solicitadonombre"))
        {
            errors.Add("Faltan columnas obligatorias: Correo y SolicitadoPorNombre.");
            return (rows, errors, pendingAgents);
        }

        var last = ws.LastRowUsed()?.RowNumber() ?? 1;
        for (var r = 2; r <= last; r++)
        {
            string Cell(string key)
            {
                if (!headerMap.TryGetValue(key, out var col)) return "";
                return ws.Cell(r, col).GetFormattedString().Trim();
            }

            var correo = Cell("correo");
            var caso = Cell("nrocaso");
            var cliente = Cell("nrocliente");
            var nombrePeek = Cell("solicitadonombre");
            // Fila vacía: sin correo ni datos útiles.
            if (string.IsNullOrWhiteSpace(correo)
                && string.IsNullOrWhiteSpace(caso)
                && string.IsNullOrWhiteSpace(cliente)
                && string.IsNullOrWhiteSpace(nombrePeek))
                continue;

            // Histórico: caso/cliente pueden venir vacíos; el correo sí es obligatorio.
            if (string.IsNullOrWhiteSpace(correo))
            {
                errors.Add($"Fila {r}: falta el correo.");
                continue;
            }

            var portalRaw = Cell("plataforma");
            var tipoRaw = Cell("solicitud");
            var portal = NormalizePortal(portalRaw);
            if (portal is null)
            {
                errors.Add($"Fila {r}: plataforma inválida '{portalRaw}'.");
                continue;
            }

            var tipo = NormalizeTipo(tipoRaw, portal);
            if (tipo is null)
            {
                errors.Add($"Fila {r}: solicitud inválida '{tipoRaw}' para {portal}.");
                continue;
            }

            string? modulos = null;
            if (BlanqueoModulos.EsHabilitacion(tipo))
            {
                modulos = BlanqueoModulos.NormalizeList(Cell("modulos"));
                if (modulos is null)
                {
                    errors.Add($"Fila {r}: Habilitación de Módulos requiere al menos un módulo en la columna Modulos.");
                    continue;
                }
            }

            var fecha = ReadFechaCell(ws, r, headerMap);
            if (fecha is null)
            {
                errors.Add($"Fila {r}: fecha inválida.");
                continue;
            }

            var nombreSol = Cell("solicitadonombre");
            var emailSol = "";
            if (string.IsNullOrWhiteSpace(nombreSol))
            {
                errors.Add($"Fila {r}: falta SolicitadoPorNombre.");
                continue;
            }

            if (!ResolveRequesterByName(ref emailSol, ref nombreSol, users))
            {
                // Sin registro aún: importar igual con el nombre; se asocia al ingresar a ST2.
                emailSol = "";
                nombreSol = nombreSol.Trim();
                pendingAgents.Add(nombreSol);
            }

            var listoRaw = Cell("listo");
            var listo = ParseBool(listoRaw);
            var aclaracion = NullIfEmpty(Cell("aclaracion"));

            // Misma semántica que en vivo: Listo (verde) y No registrado (rojo) se respetan;
            // si vienen juntos, gana No registrado.
            if (LooksLikeNoRegistrado(aclaracion) || LooksLikeNoRegistrado(listoRaw))
            {
                listo = false;
                aclaracion = "No registrado";
            }

            rows.Add(new BlanqueoHistoricalRow
            {
                Portal = portal,
                NroCaso = caso ?? "",
                NroCliente = cliente ?? "",
                Correo = correo,
                FechaSolicitud = fecha,
                TipoSolicitud = tipo,
                SolicitadoPorEmail = emailSol.Trim().ToLowerInvariant(),
                SolicitadoPorNombre = nombreSol.Trim(),
                Listo = listo,
                Aclaracion = aclaracion,
                ModulosDetalle = modulos,
            });
        }

        return (rows, errors, pendingAgents.Distinct(StringComparer.OrdinalIgnoreCase).ToList());
    }

    private static bool LooksLikeNoRegistrado(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        if (BlanqueoAlertKinds.IsNoRegistrado(value)) return true;
        var n = NormalizeHeader(value);
        return n is "noregistrado" or "noinscrito" or "sinregistro";
    }

    private static Dictionary<string, int> MapHeaders(IXLWorksheet ws)
    {
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var lastCol = ws.LastColumnUsed()?.ColumnNumber() ?? 0;
        for (var c = 1; c <= lastCol; c++)
        {
            var raw = NormalizeHeader(ws.Cell(1, c).GetFormattedString());
            if (string.IsNullOrEmpty(raw)) continue;

            if (Matches(raw, "fecha", "fechasolicitud", "date"))
                map["fecha"] = c;
            else if (Matches(raw, "plataforma", "portal"))
                map["plataforma"] = c;
            else if (Matches(raw, "nrocaso", "numerocaso", "caso", "ncaso"))
                map["nrocaso"] = c;
            else if (Matches(raw, "nrocliente", "numerocliente", "cliente", "ncliente"))
                map["nrocliente"] = c;
            else if (Matches(raw, "correo", "email", "mail", "e-mail"))
                map["correo"] = c;
            else if (Matches(raw, "modulos", "modulo"))
                map["modulos"] = c;
            else if (Matches(raw, "solicitud", "tipo", "tiposolicitud"))
                map["solicitud"] = c;
            else if (Matches(raw, "solicitadopornombre", "solicitante", "nombre", "solicitadopor", "agente", "agent"))
                map["solicitadonombre"] = c;
            else if (Matches(raw, "listo", "estado", "confirmado"))
                map["listo"] = c;
            else if (Matches(raw, "aclaracion", "observacion", "nota", "comentario"))
                map["aclaracion"] = c;
            // SolicitadoPorEmail se ignoró a propósito: la asociación es solo por nombre.
        }

        return map;
    }

    private static bool Matches(string normalized, params string[] keys) =>
        keys.Any(k => normalized == k || normalized.Contains(k));

    private static string NormalizeHeader(string value)
    {
        var sb = new StringBuilder();
        foreach (var ch in value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD))
        {
            var cat = CharUnicodeInfo.GetUnicodeCategory(ch);
            if (cat == UnicodeCategory.NonSpacingMark) continue;
            if (char.IsLetterOrDigit(ch)) sb.Append(ch);
        }

        return sb.ToString();
    }

    private static string? NormalizePortal(string raw)
    {
        var v = raw.Trim();
        if (string.IsNullOrEmpty(v)) return "OnBalance";
        if (v.Equals("OnBalance", StringComparison.OrdinalIgnoreCase) || v.Equals("On Balance", StringComparison.OrdinalIgnoreCase))
            return "OnBalance";
        if (v.Equals("Onvio", StringComparison.OrdinalIgnoreCase) || v.Equals("ONVIO", StringComparison.OrdinalIgnoreCase))
            return "Onvio";
        if (v.Equals("PortalCliente", StringComparison.OrdinalIgnoreCase) || v.Equals("Portal Cliente", StringComparison.OrdinalIgnoreCase))
            return "PortalCliente";
        return null;
    }

    private static string? NormalizeTipo(string raw, string portal)
    {
        var v = raw.Trim();
        if (string.IsNullOrEmpty(v))
        {
            return portal switch
            {
                "OnBalance" => "Blanqueo",
                "Onvio" => "Blanqueo",
                "PortalCliente" => "Activación",
                _ => null,
            };
        }

        if (v.Equals("Blanqueo + MFA", StringComparison.OrdinalIgnoreCase)) return "Blanqueo + MFA";
        if (v.Equals("MFA", StringComparison.OrdinalIgnoreCase))
            return portal is "OnBalance" or "Onvio" ? "MFA" : null;
        if (v.Equals("Blanqueo MFA", StringComparison.OrdinalIgnoreCase) || v.Equals("Blanqueo+MFA", StringComparison.OrdinalIgnoreCase))
            return portal is "OnBalance" or "Onvio" ? "Blanqueo + MFA" : "Blanqueo MFA";
        if (v.Equals("Blanqueo", StringComparison.OrdinalIgnoreCase)) return "Blanqueo";
        if (v.Equals("Activación", StringComparison.OrdinalIgnoreCase) || v.Equals("Activacion", StringComparison.OrdinalIgnoreCase))
            return "Activación";
        if (v.Equals("Cambio de contraseña", StringComparison.OrdinalIgnoreCase)
            || v.Equals("Cambio de password", StringComparison.OrdinalIgnoreCase)
            || v.Contains("contrase", StringComparison.OrdinalIgnoreCase))
            return "Cambio de contraseña";
        if (v.Equals(BlanqueoModulos.TipoHabilitacion, StringComparison.OrdinalIgnoreCase)
            || v.Contains("habilit", StringComparison.OrdinalIgnoreCase))
            return portal is "PortalCliente" ? BlanqueoModulos.TipoHabilitacion : null;

        return null;
    }

    /// <summary>
    /// Lee la fecha de Excel (celda date, serial o texto) y la deja siempre como yyyy-MM-dd
    /// para ordenar y filtrar por mes.
    /// </summary>
    private static string? ReadFechaCell(IXLWorksheet ws, int row, Dictionary<string, int> headerMap)
    {
        if (!headerMap.TryGetValue("fecha", out var col))
            return NormalizeFecha("");

        var cell = ws.Cell(row, col);
        if (cell.TryGetValue(out DateTime dt))
            return dt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        if (cell.DataType == XLDataType.Number && cell.TryGetValue(out double serial))
        {
            try
            {
                return DateTime.FromOADate(serial).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            }
            catch
            {
                // seguir con texto
            }
        }

        return NormalizeFecha(cell.GetFormattedString().Trim());
    }

    private static string? NormalizeFecha(string raw)
    {
        var v = raw.Trim();
        if (string.IsNullOrEmpty(v))
            return DateTime.Now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        // Preferido / export: 2026-08-13 o 2026/08/13
        var iso = Regex.Match(v, @"^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})");
        if (iso.Success
            && int.TryParse(iso.Groups[2].Value, out var im)
            && int.TryParse(iso.Groups[3].Value, out var id)
            && im is >= 1 and <= 12 && id is >= 1 and <= 31)
            return $"{iso.Groups[1].Value}-{im:00}-{id:00}";

        // AR / común: 13/08/2026 · 13-08-2026 · 13.08.2026
        var dmy = Regex.Match(v, @"^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$");
        if (dmy.Success
            && int.TryParse(dmy.Groups[1].Value, out var day)
            && int.TryParse(dmy.Groups[2].Value, out var month)
            && int.TryParse(dmy.Groups[3].Value, out var year)
            && month is >= 1 and <= 12 && day is >= 1 and <= 31)
            return $"{year:0000}-{month:00}-{day:00}";

        // Solo mes/año: 08/2026 → día 01 (para agrupar por mes)
        var my = Regex.Match(v, @"^(\d{1,2})[/\-.](\d{4})$");
        if (my.Success
            && int.TryParse(my.Groups[1].Value, out var mOnly)
            && int.TryParse(my.Groups[2].Value, out var yOnly)
            && mOnly is >= 1 and <= 12)
            return $"{yOnly:0000}-{mOnly:00}-01";

        if (DateTime.TryParse(v, new CultureInfo("es-AR"), DateTimeStyles.AssumeLocal, out var d)
            || DateTime.TryParse(v, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out d)
            || DateTime.TryParse(v, CultureInfo.CurrentCulture, DateTimeStyles.AssumeLocal, out d))
            return d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        return null;
    }

    private static List<(string Email, string DisplayName, string Key)> BuildUserIndex(IReadOnlyList<AppAccessRecordDto> directory)
    {
        var list = new List<(string Email, string DisplayName, string Key)>();
        foreach (var user in directory)
        {
            var email = (user.Email ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
                continue;

            var display = string.IsNullOrWhiteSpace(user.DisplayName)
                ? BlanqueoEndpoints.DisplayNameFromEmail(email)
                : user.DisplayName.Trim();

            list.Add((email, display, NormalizePersonKey(display)));

            // También indexar por el nombre derivado del mail (por si el display custom difiere).
            var fromEmail = BlanqueoEndpoints.DisplayNameFromEmail(email);
            var fromEmailKey = NormalizePersonKey(fromEmail);
            if (!string.Equals(fromEmailKey, NormalizePersonKey(display), StringComparison.Ordinal))
                list.Add((email, display, fromEmailKey));
        }

        return list;
    }

    private static bool ResolveRequesterByName(
        ref string email,
        ref string nombre,
        IReadOnlyList<(string Email, string DisplayName, string Key)> users)
    {
        nombre = nombre.Trim();
        email = "";
        if (string.IsNullOrWhiteSpace(nombre))
            return false;

        var key = NormalizePersonKey(nombre);
        var match = users.FirstOrDefault(u => u.Key == key);
        if (!string.IsNullOrEmpty(match.Email))
        {
            email = match.Email;
            nombre = match.DisplayName;
            return true;
        }

        // Fallback: mail típico nombre.apellido@… solo si existe en Accesos.
        var guessed = GuessEmailFromName(nombre);
        if (guessed is null) return false;
        var guessMatch = users.FirstOrDefault(u => u.Email.Equals(guessed, StringComparison.OrdinalIgnoreCase));
        if (string.IsNullOrEmpty(guessMatch.Email)) return false;
        email = guessMatch.Email;
        nombre = guessMatch.DisplayName;
        return true;
    }

    /// <summary>Clave comparable de nombre (sin acentos, minúsculas, espacios normalizados).</summary>
    public static string PersonKey(string value) => NormalizePersonKey(value);

    public static bool NamesMatch(string a, string b) =>
        !string.IsNullOrWhiteSpace(a)
        && !string.IsNullOrWhiteSpace(b)
        && string.Equals(NormalizePersonKey(a), NormalizePersonKey(b), StringComparison.Ordinal);

    private static string NormalizePersonKey(string value)
    {
        var sb = new StringBuilder();
        var prevSpace = false;
        foreach (var ch in value.Trim().Normalize(NormalizationForm.FormD).ToLowerInvariant())
        {
            var cat = CharUnicodeInfo.GetUnicodeCategory(ch);
            if (cat == UnicodeCategory.NonSpacingMark) continue;
            if (char.IsLetterOrDigit(ch))
            {
                sb.Append(ch);
                prevSpace = false;
            }
            else if (char.IsWhiteSpace(ch) && !prevSpace && sb.Length > 0)
            {
                sb.Append(' ');
                prevSpace = true;
            }
        }

        return sb.ToString().Trim();
    }

    private static string? GuessEmailFromName(string nombre)
    {
        var parts = nombre.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length == 0) return null;
        var local = string.Join('.', parts.Select(p =>
        {
            var sb = new StringBuilder();
            foreach (var ch in p.Normalize(NormalizationForm.FormD).ToLowerInvariant())
            {
                var cat = CharUnicodeInfo.GetUnicodeCategory(ch);
                if (cat == UnicodeCategory.NonSpacingMark) continue;
                if (char.IsLetterOrDigit(ch)) sb.Append(ch);
            }

            return sb.ToString();
        }).Where(p => p.Length > 0));

        return local.Length > 0 ? $"{local}@thomsonreuters.com" : null;
    }

    private static bool ParseBool(string raw)
    {
        var v = raw.Trim().ToLowerInvariant();
        if (v is "1" or "true" or "si" or "sí" or "yes" or "listo" or "ok" or "x" or "verdadero")
            return true;
        // Excel a veces formatea "Sí" sin acento raro; también aceptar "s".
        var n = NormalizeHeader(raw);
        return n is "1" or "true" or "si" or "yes" or "listo" or "ok" or "x" or "verdadero";
    }

    private static string? NullIfEmpty(string value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string PortalLabel(string portal) => portal switch
    {
        "OnBalance" => "On Balance",
        "Onvio" => "ONVIO",
        _ => "Portal Cliente",
    };

    private static string? MonthKey(string fecha)
    {
        var m = Regex.Match(fecha ?? "", @"^(\d{4})-(\d{2})");
        return m.Success ? $"{m.Groups[1].Value}-{m.Groups[2].Value}" : null;
    }

    private static string MonthLabel(string key)
    {
        var parts = key.Split('-');
        if (parts.Length != 2 || !int.TryParse(parts[1], out var month) || month is < 1 or > 12)
            return key;
        var names = new[] { "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic" };
        return $"{names[month - 1]} {parts[0]}";
    }
}

public sealed class BlanqueoHistoricalRow
{
    public string Portal { get; set; } = "";
    public string NroCaso { get; set; } = "";
    public string NroCliente { get; set; } = "";
    public string Correo { get; set; } = "";
    public string FechaSolicitud { get; set; } = "";
    public string TipoSolicitud { get; set; } = "";
    public string SolicitadoPorEmail { get; set; } = "";
    public string SolicitadoPorNombre { get; set; } = "";
    public bool Listo { get; set; }
    public string? Aclaracion { get; set; }
    public string? ModulosDetalle { get; set; }
}
