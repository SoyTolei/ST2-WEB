namespace PortalClienchi.Core.Configuration;

/// <summary>
/// API compatible con OpenAI Chat Completions (Groq, OpenAI, Ollama /v1/chat/completions).
/// </summary>
public sealed class RedaccionIaSettings
{
    public bool Enabled { get; set; }

    /// <summary>URL completa del endpoint (Groq por defecto).</summary>
    public string Endpoint { get; set; } = "https://api.groq.com/openai/v1/chat/completions";

    public string ApiKey { get; set; } = "";

    public string Model { get; set; } = "openai/gpt-oss-120b";

    public int TimeoutSeconds { get; set; } = 60;

    /// <summary>Modelo efectivo: reemplaza IDs deprecados de Groq sin tocar variables de entorno.</summary>
    public string ResolvedModel => ResolveModel(Model);

    public static string ResolveModel(string? model)
    {
        var id = (model ?? "").Trim();
        if (id.Length == 0)
            return "openai/gpt-oss-120b";

        return id.ToLowerInvariant() switch
        {
            "llama-3.3-70b-versatile" or "llama-3.3-70b-specdec" => "openai/gpt-oss-120b",
            "llama-3.1-8b-instant" => "openai/gpt-oss-20b",
            "llama-3.1-70b-versatile" or "llama-3.1-70b-specdec" => "openai/gpt-oss-120b",
            _ => id,
        };
    }

    /// <summary>Activo si está habilitado explícitamente o hay API key cargada.</summary>
    public bool IsActive => Enabled || TieneApiKeyValida;

    public bool TieneApiKeyValida => !string.IsNullOrWhiteSpace(ApiKey) && !EsPlaceholder(ApiKey);

    private static bool EsPlaceholder(string key)
    {
        var k = key.Trim();
        if (k.StartsWith("gsk_", StringComparison.Ordinal) && k.Length > 20)
            return false;

        return k.Contains("PEGAR", StringComparison.OrdinalIgnoreCase)
               || k.Contains("TU_CLAVE", StringComparison.OrdinalIgnoreCase);
    }
}
