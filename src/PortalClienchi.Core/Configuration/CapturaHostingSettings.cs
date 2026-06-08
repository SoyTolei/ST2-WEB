namespace PortalClienchi.Core.Configuration;

/// <summary>
/// Subida de capturas a hosting público para obtener enlaces directos (ImgBB / Catbox).
/// </summary>
public sealed class CapturaHostingSettings
{
    public bool Enabled { get; set; }

    /// <summary>Auto (ImgBB si hay clave, si no Catbox), ImgBB o Catbox.</summary>
    public string Provider { get; set; } = "Auto";

    /// <summary>Clave gratuita en https://api.imgbb.com/</summary>
    public string ImgBbApiKey { get; set; } = "";

    public int TimeoutSeconds { get; set; } = 90;

    public bool TieneImgBbKey =>
        !string.IsNullOrWhiteSpace(ImgBbApiKey)
        && !ImgBbApiKey.Contains("PEGAR", StringComparison.OrdinalIgnoreCase)
        && !ImgBbApiKey.Contains("TU_CLAVE", StringComparison.OrdinalIgnoreCase);

    public bool IsActive => Enabled;

    public string ProveedorEfectivo =>
        Provider.Trim().ToUpperInvariant() switch
        {
            "IMGBB" => "ImgBB",
            "CATBOX" => "Catbox",
            _ => TieneImgBbKey ? "ImgBB" : "Catbox",
        };
}
