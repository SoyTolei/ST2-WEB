namespace PortalClienchi.Web.PortalPdf;

public sealed class PortalPdfGenerateRequest
{
    /// <summary>Marca izquierda del header (ej. BEJERMAN). Vacío = sin caja.</summary>
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
    /// <summary>Tamaño en puntos. Null = default (12).</summary>
    public float? FontSize { get; init; }
    /// <summary>URL de hipervínculo (si aplica).</summary>
    public string? LinkUrl { get; init; }
}
