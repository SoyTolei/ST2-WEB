namespace PortalClienchi.Core.Models;

public sealed class MediaResource
{
    public required string Url { get; init; }
    public MediaKind Kind { get; init; }
    public string SuggestedFileName { get; init; } = "archivo";
    public string DownloadFilter { get; init; } = "Todos los archivos|*.*";
}
