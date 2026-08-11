namespace PortalClienchi.Web.PortalPdf;

public sealed class PortalPdfGenerateRequest
{
    /// <summary>Marca izquierda del header (ej. BEJERMAN). Vacío = sin caja.</summary>
    public string? Brand { get; set; }

    /// <summary>HTML simple del cuerpo (p, br, em/i, strong/b, u, div/p con text-align).</summary>
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
    public string Align { get; init; } = "left"; // left | center | right | justify
}
