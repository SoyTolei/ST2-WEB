using System.Text.Json;

namespace PortalClienchi.Core.Models;

public sealed class PortalSession
{
    public required string AuthToken { get; init; }

    public JsonElement? User { get; init; }
}
