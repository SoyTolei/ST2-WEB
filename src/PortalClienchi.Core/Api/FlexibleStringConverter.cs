using System.Text.Json;
using System.Text.Json.Serialization;

namespace PortalClienchi.Core.Api;

/// <summary>
/// El API a veces devuelve strings, arrays de strings u objetos con "name".
/// </summary>
public sealed class FlexibleStringConverter : JsonConverter<string?>
{
    public override string? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        return reader.TokenType switch
        {
            JsonTokenType.Null => null,
            JsonTokenType.String => reader.GetString(),
            JsonTokenType.Number => reader.GetInt64().ToString(),
            JsonTokenType.True => "true",
            JsonTokenType.False => "false",
            JsonTokenType.StartArray => ReadArray(ref reader),
            JsonTokenType.StartObject => ReadObject(ref reader),
            _ => JsonDocument.ParseValue(ref reader).RootElement.ToString(),
        };
    }

    public override void Write(Utf8JsonWriter writer, string? value, JsonSerializerOptions options)
    {
        if (value is null)
            writer.WriteNullValue();
        else
            writer.WriteStringValue(value);
    }

    private static string? ReadArray(ref Utf8JsonReader reader)
    {
        var parts = new List<string>();
        while (reader.Read() && reader.TokenType != JsonTokenType.EndArray)
        {
            if (reader.TokenType == JsonTokenType.String)
            {
                var s = reader.GetString();
                if (!string.IsNullOrWhiteSpace(s))
                    parts.Add(s);
            }
            else if (reader.TokenType == JsonTokenType.StartObject)
            {
                var name = ReadObjectName(ref reader);
                if (!string.IsNullOrWhiteSpace(name))
                    parts.Add(name);
            }
        }
        return parts.Count == 0 ? null : string.Join(", ", parts);
    }

    private static string? ReadObject(ref Utf8JsonReader reader)
    {
        string? name = null;
        string? fallback = null;
        while (reader.Read() && reader.TokenType != JsonTokenType.EndObject)
        {
            if (reader.TokenType != JsonTokenType.PropertyName)
                continue;
            var prop = reader.GetString();
            reader.Read();
            if (prop is "name" or "label" or "title")
                name = ReadScalar(ref reader);
            else if (fallback is null)
                fallback = ReadScalar(ref reader);
        }
        return name ?? fallback;
    }

    private static string? ReadObjectName(ref Utf8JsonReader reader)
    {
        string? name = null;
        while (reader.Read() && reader.TokenType != JsonTokenType.EndObject)
        {
            if (reader.TokenType != JsonTokenType.PropertyName)
                continue;
            var prop = reader.GetString();
            reader.Read();
            if (prop is "name" or "label" or "title")
                name = ReadScalar(ref reader);
            else
                SkipValue(ref reader);
        }
        return name;
    }

    private static string? ReadScalar(ref Utf8JsonReader reader) =>
        reader.TokenType switch
        {
            JsonTokenType.String => reader.GetString(),
            JsonTokenType.Number => reader.GetInt64().ToString(),
            _ => null,
        };

    private static void SkipValue(ref Utf8JsonReader reader)
    {
        if (reader.TokenType is JsonTokenType.StartObject or JsonTokenType.StartArray)
            JsonDocument.ParseValue(ref reader);
    }
}
