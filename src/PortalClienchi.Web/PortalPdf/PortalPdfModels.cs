namespace PortalClienchi.Web.PortalPdf;

public sealed class PortalPdfGenerateRequest
{
    /// <summary>Marca izquierda del header (ej. FACTURA ELECTRÓNICA). Vacío = sin caja.</summary>
    public string? Brand { get; set; }

    /// <summary>HTML del cuerpo (formato enriquecido del contenteditable).</summary>
    public string? Html { get; set; }

    /// <summary>Texto plano de respaldo si no hay HTML.</summary>
    public string? Text { get; set; }
}

public sealed class PortalPdfBlock
{
    public string Text { get; init; } = "";
    public bool Italic { get; init; }
    public bool Bold { get; init; }
    public bool Underline { get; init; }
    public bool Strike { get; init; }
    /// <summary>left | center | right | justify</summary>
    public string Align { get; init; } = "left";
    /// <summary>Color CSS/hex (#rrggbb). Vacío = color por defecto del PDF.</summary>
    public string? Color { get; init; }
    /// <summary>Tamaño en puntos. Null = default.</summary>
    public float? FontSize { get; init; }
    /// <summary>URL de hipervínculo (si aplica).</summary>
    public string? LinkUrl { get; init; }
}

public abstract class PortalPdfElement
{
}

public sealed class PortalPdfParagraphElement : PortalPdfElement
{
    public List<PortalPdfBlock> Runs { get; set; } = new();
    public string Align { get; set; } = "left";
    public bool IsListItem { get; set; }
    public int HeadingLevel { get; set; } // 0 = normal, 1 = H1, 2 = H2, 3 = H3
}

public sealed class PortalPdfTableElement : PortalPdfElement
{
    public List<List<PortalPdfTableCell>> Rows { get; set; } = new();
}

public sealed class PortalPdfTableCell
{
    public List<PortalPdfBlock> Content { get; set; } = new();
    public bool IsHeader { get; set; }
    public string Align { get; set; } = "left";
}

public sealed class PortalPdfHrElement : PortalPdfElement
{
}

public sealed class PortalPdfImageElement : PortalPdfElement
{
    public byte[] ImageBytes { get; set; } = Array.Empty<byte>();
}
