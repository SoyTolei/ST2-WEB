using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using PortalClienchi.Core.Configuration;
using PortalClienchi.Core.Models;

namespace PortalClienchi.Core.Services;

public sealed class RedaccionIaService : IDisposable
{
    private readonly RedaccionIaSettings _settings;
    private readonly HttpClient _http;

    public RedaccionIaService(RedaccionIaSettings settings)
    {
        _settings = settings;
        var timeout = Math.Clamp(settings.TimeoutSeconds, 15, 120);
        _http = new HttpClient { Timeout = TimeSpan.FromSeconds(timeout) };
    }

    public bool IsConfigured =>
        _settings.Enabled
        && !string.IsNullOrWhiteSpace(_settings.Endpoint)
        && !string.IsNullOrWhiteSpace(_settings.Model)
        && (ApiKeyOpcional(_settings.Endpoint) || _settings.TieneApiKeyValida);

    /// <summary>
    /// Mejora el documento completo de planilla (.txt) conservando estructura y etiquetas.
    /// </summary>
    public async Task<string> MejorarDocumentoPlanillaAsync(string documento, CancellationToken ct = default)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("La redacción con IA no está configurada en appsettings.json.");

        if (string.IsNullOrWhiteSpace(documento))
            throw new InvalidOperationException("No hay texto de planilla para mejorar.");

        return await EnviarChatAsync(
            DocumentoSystemPrompt,
            "Mejorá la redacción del siguiente documento de planilla. " +
            "Devolvé el documento completo, sin explicaciones ni markdown:\n\n" +
            documento.Trim(),
            ct,
            temperature: 0.2).ConfigureAwait(false);
    }

    /// <summary>
    /// Mejora asunto y descripción existentes (ortografía, claridad) sin reescribir desde cero.
    /// </summary>
    public async Task<TransferenciaIaBorrador> MejorarRedaccionTransferenciaAsync(
        string sistema,
        string mesa,
        string numeroCliente,
        string? asuntoOperador,
        string? notasOperador,
        CancellationToken ct = default)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("La redacción con IA no está configurada.");

        if (string.IsNullOrWhiteSpace(mesa))
            throw new InvalidOperationException("Elegí una mesa de destino.");

        var user = new StringBuilder()
            .AppendLine($"Sistema/producto: {sistema.Trim()}")
            .AppendLine($"Mesa destino (código interno): {mesa.Trim().ToUpperInvariant()}")
            .AppendLine($"N° de cliente: {numeroCliente.Trim()}")
            .AppendLine(string.IsNullOrWhiteSpace(asuntoOperador)
                ? "ASUNTO actual del operador: (vacío)"
                : $"ASUNTO actual del operador:\n{asuntoOperador.Trim()}")
            .AppendLine(string.IsNullOrWhiteSpace(notasOperador)
                ? "DESCRIPCIÓN actual del operador: (vacía)"
                : $"DESCRIPCIÓN actual del operador:\n{notasOperador.Trim()}")
            .ToString();

        var raw = await EnviarChatAsync(TransferenciaMejorarSystemPrompt, user, ct, temperature: 0.2).ConfigureAwait(false);
        return ParseTransferenciaBorrador(raw);
    }

    /// <summary>
    /// Redacta asunto (frase de derivación) y descripción según mesa y datos del formulario.
    /// </summary>
    public async Task<TransferenciaIaBorrador> GenerarBorradorTransferenciaAsync(
        string sistema,
        string mesa,
        string numeroCliente,
        string? asuntoOperador,
        string? notasOperador,
        CancellationToken ct = default)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("La redacción con IA no está configurada.");

        if (string.IsNullOrWhiteSpace(mesa))
            throw new InvalidOperationException("Elegí una mesa de destino.");

        var user = new StringBuilder()
            .AppendLine($"Sistema/producto: {sistema.Trim()}")
            .AppendLine($"Mesa destino (código interno): {mesa.Trim().ToUpperInvariant()}")
            .AppendLine($"N° de cliente: {numeroCliente.Trim()}")
            .AppendLine(string.IsNullOrWhiteSpace(asuntoOperador)
                ? "Asunto o error del operador: (sin indicar — proponé un requerimiento breve y editable acorde a la mesa)"
                : $"Asunto o error del operador: {asuntoOperador.Trim()}")
            .AppendLine(string.IsNullOrWhiteSpace(notasOperador)
                ? "Detalle actual del operador: (sin indicar)"
                : $"Detalle actual del operador: {notasOperador.Trim()}")
            .ToString();

        var raw = await EnviarChatAsync(TransferenciaBorradorSystemPrompt, user, ct, temperature: 0.35).ConfigureAwait(false);
        return ParseTransferenciaBorrador(raw);
    }

    public void Dispose() => _http.Dispose();

    private async Task<string> EnviarChatAsync(string systemPrompt, string userContent, CancellationToken ct, double temperature = 0.35)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, _settings.Endpoint.Trim());
        if (!string.IsNullOrWhiteSpace(_settings.ApiKey))
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _settings.ApiKey.Trim());

        var payload = new
        {
            model = _settings.Model.Trim(),
            temperature,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userContent },
            },
        };

        request.Content = JsonContent.Create(payload);

        using var response = await _http.SendAsync(request, ct).ConfigureAwait(false);
        var body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(ExtractErrorMessage(body, response.StatusCode));

        var text = ExtractAssistantContent(body);
        if (string.IsNullOrWhiteSpace(text))
            throw new InvalidOperationException("La IA no devolvió texto.");

        return text.Trim();
    }

    private const string TransferenciaMejorarSystemPrompt =
        """
        Sos un agente de mesa de ayuda técnica en español (Argentina).
        Tu trabajo es pulir la redacción de una transferencia de caso entre mesas.

        REGLAS ESTRICTAS:
        - Corregí SOLO ortografía, tildes/acentos, puntuación y orden de frases para mayor claridad.
        - Mantené un tono profesional, directo y claro, propio de soporte de mesa de ayuda.
        - NO inventes datos, pasos técnicos, versiones, tickets ni causas que el operador no mencionó.
        - NO cambies el sentido, el nivel de detalle ni agregues información nueva.
        - NO reescribas desde cero: partí del texto del operador si existe.
        - NO agregues saludos, despedidas, recomendaciones ni explicaciones sobre tu trabajo.
        - Si el ASUNTO ya tiene formato de derivación ("Se deriva a..."), conservalo y solo pulí la redacción.
        - Si un campo viene vacío, devolvé una frase mínima neutra y editable; no inventes el caso.

        Respondé ÚNICAMENTE con este formato (sin markdown ni texto extra):
        ASUNTO: [texto mejorado]
        DESCRIPCION:
        [texto mejorado]
        """;

    private const string TransferenciaBorradorSystemPrompt =
        """
        Sos asistente de soporte técnico en español (Argentina).
        Generás el borrador de una transferencia de caso a otra mesa de ayuda.

        Códigos de mesa → frase exacta en el ASUNTO:
        - TECNICO → la mesa TECNICA
        - FLEX → la mesa FUNCIONAL
        - SAAS → la mesa SAAS / ONVIO
        - SUELDOS → la mesa de Sueldos y Jornales

        Respondé ÚNICAMENTE con este formato (sin markdown ni texto extra):
        ASUNTO: Se deriva a [frase de mesa] debido a la siguiente consulta o requerimiento: [requerimiento claro]
        DESCRIPCION:
        [uno o más párrafos profesionales; si faltan datos, redactá un borrador editable y neutro]

        No inventes números de ticket, versiones de software ni pasos técnicos que el operador no mencionó.
        """;

    private static TransferenciaIaBorrador ParseTransferenciaBorrador(string raw)
    {
        var asunto = "";
        var descLines = new List<string>();
        var inDescripcion = false;

        foreach (var rawLine in raw.Split('\n'))
        {
            var line = rawLine.TrimEnd();
            var trimmed = line.Trim();

            if (trimmed.StartsWith("ASUNTO:", StringComparison.OrdinalIgnoreCase))
            {
                asunto = trimmed["ASUNTO:".Length..].Trim();
                inDescripcion = false;
                continue;
            }

            if (trimmed.StartsWith("DESCRIPCION:", StringComparison.OrdinalIgnoreCase)
                || trimmed.StartsWith("DESCRIPCIÓN:", StringComparison.OrdinalIgnoreCase))
            {
                var labelLen = trimmed.StartsWith("DESCRIPCION:", StringComparison.OrdinalIgnoreCase) ? 12 : 13;
                var inline = trimmed[labelLen..].Trim();
                if (inline.Length > 0)
                    descLines.Add(inline);
                inDescripcion = true;
                continue;
            }

            if (inDescripcion)
                descLines.Add(line);
        }

        if (string.IsNullOrWhiteSpace(asunto))
            throw new InvalidOperationException("La IA no devolvió un ASUNTO válido.");

        var descripcion = string.Join(Environment.NewLine, descLines).Trim();
        if (descripcion.Length == 0)
            descripcion = "Completar detalle del caso y pasos realizados por el usuario.";

        return new TransferenciaIaBorrador(asunto, descripcion);
    }

    private const string DocumentoSystemPrompt =
        """
        Sos un agente de mesa de ayuda técnica en español (Argentina).
        Recibirás un documento de planilla (.txt) con formato fijo corporativo (Bejerman / planillas internas).

        REGLAS ESTRICTAS:
        - Tu ÚNICA tarea es pulir la redacción: ortografía, tildes, puntuación y orden de frases para mayor claridad.
        - Mantené un tono profesional, directo y claro, propio de soporte de mesa de ayuda.
        - NO agregues información, pasos, causas, versiones, tickets ni datos que no figuren en el original.
        - NO reescribas por completo ni cambies el sentido ni el nivel de detalle.
        - NO agregues saludos, despedidas, recomendaciones ni explicaciones sobre tu trabajo.
        - Conservá EXACTAMENTE la estructura: líneas ==========, títulos de sección, emojis, etiquetas (ej. ASUNTO Y/O ERROR:, DESCRIPCIÓN DEL CASO:, SISTEMA:, VERSIÓN:).
        - Conservá valores estructurados: SÍ/NO, listas de comprobaciones, adjuntos, datos de sistema, tickets, MAM, SDK, planilla técnica.
        - Mejorá SOLO la redacción de textos narrativos (asunto, descripciones, paso a paso, párrafos explicativos en DETALLES DEL CASO).
        - No elimines secciones ni líneas de encabezado.
        - Mantené saltos de línea y separadores (────────────────────────) donde existan.
        """;

    private static bool ApiKeyOpcional(string endpoint) =>
        endpoint.Contains("localhost", StringComparison.OrdinalIgnoreCase)
        || endpoint.Contains("127.0.0.1", StringComparison.OrdinalIgnoreCase)
        || endpoint.Contains("://ollama", StringComparison.OrdinalIgnoreCase);

    private static string ExtractAssistantContent(string json)
    {
        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("choices", out var choices) || choices.GetArrayLength() == 0)
            return "";

        var message = choices[0].GetProperty("message");
        var content = message.GetProperty("content").GetString() ?? "";
        return StripMarkdownFences(content);
    }

    private static string StripMarkdownFences(string text)
    {
        var t = text.Trim();
        if (!t.StartsWith("```", StringComparison.Ordinal))
            return t;

        var firstLineEnd = t.IndexOf('\n');
        if (firstLineEnd < 0)
            return t;

        t = t[(firstLineEnd + 1)..];
        var lastFence = t.LastIndexOf("```", StringComparison.Ordinal);
        if (lastFence >= 0)
            t = t[..lastFence];

        return t.Trim();
    }

    private static string ExtractErrorMessage(string body, System.Net.HttpStatusCode status)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (!doc.RootElement.TryGetProperty("error", out var err))
                return FormatoErrorGenerico(status, body);

            var code = err.TryGetProperty("code", out var codeEl) ? codeEl.GetString() : null;
            var msg = err.TryGetProperty("message", out var msgEl) ? msgEl.GetString() : null;

            return code switch
            {
                "insufficient_quota" =>
                    "El proveedor de IA no tiene crédito disponible.\n\n" +
                    "Si usás OpenAI, activá billing en platform.openai.com. Si usás Groq, revisá límites en console.groq.com.",
                "invalid_api_key" =>
                    "La API key no es válida.\n\n" +
                    "Groq: creá una en https://console.groq.com/keys y pegala en appsettings.local.json (junto a ST2.exe).",
                "rate_limit_exceeded" =>
                    "Demasiadas solicitudes seguidas (límite del proveedor). Esperá unos segundos e intentá de nuevo.",
                _ => $"IA ({(int)status}): {msg ?? code ?? "error desconocido"}",
            };
        }
        catch
        {
            return FormatoErrorGenerico(status, body);
        }
    }

    private static string FormatoErrorGenerico(System.Net.HttpStatusCode status, string body)
    {
        var snippet = body.Length > 200 ? body[..200] + "…" : body;
        return $"IA ({(int)status}): {snippet}";
    }
}
