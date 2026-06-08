using System.Text.Json;

namespace PortalClienchi.Core.Api;

public static class FlexibleJson
{
    public static string? ReadString(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var prop))
            return null;
        return ReadString(prop);
    }

    public static string? ReadString(JsonElement prop)
    {
        return prop.ValueKind switch
        {
            JsonValueKind.Null or JsonValueKind.Undefined => null,
            JsonValueKind.String => prop.GetString(),
            JsonValueKind.Number => prop.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            JsonValueKind.Array => string.Join(
                ", ",
                prop.EnumerateArray()
                    .Select(ReadString)
                    .Where(s => !string.IsNullOrWhiteSpace(s))),
            JsonValueKind.Object => ReadStringFromObject(prop),
            _ => prop.ToString(),
        };
    }

    private static string? ReadStringFromObject(JsonElement obj)
    {
        foreach (var key in new[] { "name", "label", "title" })
        {
            if (obj.TryGetProperty(key, out var v))
            {
                var s = ReadString(v);
                if (!string.IsNullOrWhiteSpace(s))
                    return s;
            }
        }
        return null;
    }
}
