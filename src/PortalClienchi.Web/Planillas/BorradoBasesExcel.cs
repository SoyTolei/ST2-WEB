using System.Text.RegularExpressions;
using ClosedXML.Excel;

namespace PortalClienchi.Web.Planillas;

public static class BorradoBasesExcel
{
    private static readonly string[] DetailHeaders =
    [
        "Fecha",
        "NroCaso",
        "NroCliente",
        "CodigoEmpresa",
        "NombreEmpresa",
        "CUIT",
        "Bases",
        "Ejercicios",
        "SolicitadoPorNombre",
        "Listo",
        "ConfirmadoPor",
        "Aclaracion",
    ];

    public static byte[] BuildExportWorkbook(IReadOnlyList<BorradoBasesRecordDto> items)
    {
        using var wb = new XLWorkbook();
        var detalle = wb.Worksheets.Add("Solicitudes");
        for (var i = 0; i < DetailHeaders.Length; i++)
            detalle.Cell(1, i + 1).Value = DetailHeaders[i];

        var row = 2;
        foreach (var item in items.OrderByDescending(x => x.FechaSolicitud).ThenByDescending(x => x.Id))
        {
            detalle.Cell(row, 1).Value = item.FechaSolicitud;
            detalle.Cell(row, 2).Value = item.NroCaso;
            detalle.Cell(row, 3).Value = item.NroCliente;
            detalle.Cell(row, 4).Value = item.NroEmpresa;
            detalle.Cell(row, 5).Value = item.NombreEmpresa;
            detalle.Cell(row, 6).Value = item.Cuit;
            detalle.Cell(row, 7).Value = BasesLabel(item);
            detalle.Cell(row, 8).Value = item.EjerciciosDetalle ?? "";
            detalle.Cell(row, 9).Value = item.SolicitadoPorNombre;
            detalle.Cell(row, 10).Value = item.Listo ? "Sí" : "No";
            detalle.Cell(row, 11).Value = item.ConfirmadoPorNombre ?? "";
            detalle.Cell(row, 12).Value = item.Aclaracion ?? "";
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

    private static string BasesLabel(BorradoBasesRecordDto item)
    {
        var parts = new List<string>();
        if (item.Iva) parts.Add("IVA");
        if (item.Sueldos) parts.Add("Sueldos y Jornales");
        if (item.Contabilidad) parts.Add("Contabilidad General");
        return string.Join(", ", parts);
    }

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
