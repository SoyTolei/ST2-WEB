using System.Text.Json;
using System.Text.Json.Serialization;

namespace PortalClienchi.Core.Api;

internal sealed class SessionResponse
{
    [JsonPropertyName("token")]
    public string Token { get; set; } = "";

    [JsonPropertyName("user")]
    public JsonElement? User { get; set; }
}

internal sealed class KnowledgeFindResponse
{
    [JsonPropertyName("items")]
    public List<KnowledgeListJson> Items { get; set; } = [];

    [JsonPropertyName("totalRecords")]
    public int TotalRecords { get; set; }
}

internal sealed class KnowledgeListJson
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("title")]
    public string Title { get; set; } = "";

    [JsonPropertyName("keywords")]
    [JsonConverter(typeof(FlexibleStringConverter))]
    public string? Keywords { get; set; }

    [JsonPropertyName("system_product_name")]
    [JsonConverter(typeof(FlexibleStringConverter))]
    public string? SystemProductName { get; set; }
}

internal sealed class KnowledgeDetailJson
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("title")]
    public string Title { get; set; } = "";

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("keywords")]
    [JsonConverter(typeof(FlexibleStringConverter))]
    public string? Keywords { get; set; }

    [JsonPropertyName("knowledge_type_id")]
    public int? KnowledgeTypeId { get; set; }

    [JsonPropertyName("system_product_name")]
    [JsonConverter(typeof(FlexibleStringConverter))]
    public string? SystemProductName { get; set; }

    [JsonPropertyName("duration")]
    [JsonConverter(typeof(FlexibleStringConverter))]
    public string? Duration { get; set; }

    [JsonPropertyName("updated_at")]
    public string? UpdatedAt { get; set; }

    [JsonPropertyName("knowledge_attachment")]
    public List<AttachmentJson>? KnowledgeAttachment { get; set; }

    [JsonPropertyName("products")]
    public JsonElement? Products { get; set; }
}

internal sealed class AttachmentJson
{
    [JsonPropertyName("url")]
    public string? Url { get; set; }
}
