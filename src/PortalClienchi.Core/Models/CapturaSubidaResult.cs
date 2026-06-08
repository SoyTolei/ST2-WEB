namespace PortalClienchi.Core.Models;

public sealed record CapturaSubidaResult(string FileName, string? Url, string? Error)
{
    public bool Ok => !string.IsNullOrWhiteSpace(Url);
}
