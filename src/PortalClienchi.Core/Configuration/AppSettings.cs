namespace PortalClienchi.Core.Configuration;

public sealed class AppSettings
{
    public string ApiBaseUrl { get; set; } = "https://clientes.thomsonreuters.com.ar:3333";
    public string PortalBaseUrl { get; set; } = "https://clientes.thomsonreuters.com.ar";
    /// <summary>THOM / CSS-TAP (requiere VPN o red corporativa y Authy).</summary>
    public string ThomTapUrl { get; set; } = "https://css-latam.int.thomsonreuters.com/css-tap";
    /// <summary>Zoom del visor THOM (0.9 = 90%).</summary>
    public double ThomZoomFactor { get; set; } = 0.9;
    /// <summary>Intentar cerrar el panel de ayuda al cargar CSS-TAP.</summary>
    public bool ThomAutoCloseHelpPanel { get; set; } = true;
    /// <summary>AI Platform / Core AI &amp; Data Platforms.</summary>
    public string AiPlatformUrl { get; set; } = "https://aiplatform.thomsonreuters.com/ai-platform/ai-experiences/";
    /// <summary>Zoom del visor AI Platform (0.9 = 90%).</summary>
    public double AiPlatformZoomFactor { get; set; } = 0.9;
    /// <summary>Intentar cerrar el panel de ayuda al cargar AI Platform.</summary>
    public bool AiPlatformAutoCloseHelpPanel { get; set; } = true;
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
    public int SyncPageSize { get; set; } = 100;
    public int[] SyncTypes { get; set; } = [1, 2, 3, 4, 5, 6];

    /// <summary>
    /// Repositorio de GitHub para releases (sin barra final).
    /// Ej: https://github.com/tu-usuario/st2-releases
    /// </summary>
    public string? GitHubRepoUrl { get; set; }

    /// <summary>
    /// Token de lectura de GitHub (solo si el repo de releases es privado).
    /// </summary>
    public string? GitHubUpdateToken { get; set; }

    /// <summary>Mejora de redacción con IA (OpenAI, Azure OpenAI u Ollama).</summary>
    public RedaccionIaSettings RedaccionIa { get; set; } = new();

    /// <summary>Subida de capturas a hosting público (enlaces directos en planillas).</summary>
    public CapturaHostingSettings CapturaHosting { get; set; } = new();
}
