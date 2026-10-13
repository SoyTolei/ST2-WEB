namespace PortalClienchi.Web.Planillas;

/// <summary>Adjuntos del paquete Office (Excel, Word, PowerPoint) + CSV / RTF / OpenDocument.</summary>
public static class OfficeFileTypes
{
    private static readonly Dictionary<string, string> MimeByExt = new(StringComparer.OrdinalIgnoreCase)
    {
        [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        [".xlsm"] = "application/vnd.ms-excel.sheet.macroEnabled.12",
        [".xlsb"] = "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
        [".xls"] = "application/vnd.ms-excel",
        [".csv"] = "text/csv",
        [".ods"] = "application/vnd.oasis.opendocument.spreadsheet",
        [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        [".docm"] = "application/vnd.ms-word.document.macroEnabled.12",
        [".dotx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
        [".doc"] = "application/msword",
        [".dot"] = "application/msword",
        [".rtf"] = "application/rtf",
        [".odt"] = "application/vnd.oasis.opendocument.text",
        [".pptx"] = "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        [".pptm"] = "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
        [".ppsx"] = "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
        [".ppt"] = "application/vnd.ms-powerpoint",
        [".pps"] = "application/vnd.ms-powerpoint",
        [".odp"] = "application/vnd.oasis.opendocument.presentation",
    };

    private static readonly HashSet<string> SpreadsheetExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".xlsx", ".xlsm", ".xlsb", ".xls", ".csv", ".ods",
    };

    /// <summary>Formatos legacy con cabecera OLE (D0 CF 11 E0).</summary>
    private static readonly HashSet<string> OleExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".xls", ".doc", ".dot", ".ppt", ".pps",
    };

    private static readonly HashSet<string> TextExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".csv", ".rtf",
    };

    public static IReadOnlyCollection<string> Extensions => MimeByExt.Keys;

    public static bool IsOffice(string? ext) => !string.IsNullOrEmpty(ext) && MimeByExt.ContainsKey(ext);

    public static bool IsOfficeMime(string? contentType) =>
        !string.IsNullOrWhiteSpace(contentType)
        && MimeByExt.Values.Any(m => m.Equals(contentType, StringComparison.OrdinalIgnoreCase));

    public static bool IsSpreadsheet(string? ext) => !string.IsNullOrEmpty(ext) && SpreadsheetExt.Contains(ext);

    public static string? MimeFor(string ext) => MimeByExt.TryGetValue(ext, out var mime) ? mime : null;

    /// <summary>Chequeo de firma: evita guardar cualquier binario renombrado como .docx.</summary>
    public static bool LooksValid(byte[] raw, string ext)
    {
        if (TextExt.Contains(ext))
        {
            if (ext.Equals(".rtf", StringComparison.OrdinalIgnoreCase))
                return raw.Length >= 5 && raw[0] == (byte)'{' && raw[1] == (byte)'\\' && raw[2] == (byte)'r';
            return raw.Length > 0;
        }

        if (OleExt.Contains(ext))
            return raw.Length >= 8 && raw[0] == 0xD0 && raw[1] == 0xCF && raw[2] == 0x11 && raw[3] == 0xE0;

        return raw.Length >= 4 && raw[0] == 0x50 && raw[1] == 0x4B && raw[2] == 0x03 && raw[3] == 0x04;
    }
}
