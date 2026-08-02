namespace PortalClienchi.Core.Configuration;

/// <summary>
/// Subida de capturas: Local (Volume Railway / disco ST2) o proveedores externos (ImgBB / Catbox).
/// </summary>
public sealed class CapturaHostingSettings
{
    public bool Enabled { get; set; }

    /// <summary>Local (default), ImgBB, Catbox o Auto (Local si está habilitado).</summary>
    public string Provider { get; set; } = "Local";

    /// <summary>Clave gratuita en https://api.imgbb.com/ (solo si Provider = ImgBB).</summary>
    public string ImgBbApiKey { get; set; } = "";

    public int TimeoutSeconds { get; set; } = 90;

    /// <summary>Días de retención en disco Local (0 = no borrar).</summary>
    public int TtlDays { get; set; } = 45;

    /// <summary>Tamaño máximo por archivo de imagen (bytes). Se guarda sin recomprimir.</summary>
    public int MaxFileBytes { get; set; } = 12 * 1024 * 1024;

    /// <summary>Tamaño máximo por video mp4/webm (bytes). Se guarda sin recomprimir.</summary>
    public int MaxVideoFileBytes { get; set; } = 25 * 1024 * 1024;

    /// <summary>Máximo de archivos por request.</summary>
    public int MaxFilesPerRequest { get; set; } = 20;

    /// <summary>Máximo de videos por request (además de imágenes).</summary>
    public int MaxVideosPerRequest { get; set; } = 2;

    /// <summary>Reservado (ya no se reescala; se conserva calidad original).</summary>
    public int MaxWidthPx { get; set; } = 0;

    /// <summary>Reservado (ya no se recomprime).</summary>
    public int JpegQuality { get; set; } = 100;

    /// <summary>
    /// Base pública de los links (ej. https://st2.tolei.dev). Si está vacío, se arma desde el request HTTP.
    /// </summary>
    public string PublicBaseUrl { get; set; } = "https://st2.tolei.dev";

    public bool TieneImgBbKey =>
        !string.IsNullOrWhiteSpace(ImgBbApiKey)
        && !ImgBbApiKey.Contains("PEGAR", StringComparison.OrdinalIgnoreCase)
        && !ImgBbApiKey.Contains("TU_CLAVE", StringComparison.OrdinalIgnoreCase);

    public bool IsActive => Enabled;

    public bool IsLocal =>
        ProveedorEfectivo.Equals("Local", StringComparison.OrdinalIgnoreCase);

    public string ProveedorEfectivo =>
        Provider.Trim().ToUpperInvariant() switch
        {
            "IMGBB" => "ImgBB",
            "CATBOX" => "Catbox",
            "LOCAL" => "Local",
            // Auto: preferir Local (Volume) sobre ImgBB/Catbox
            _ => "Local",
        };
}
