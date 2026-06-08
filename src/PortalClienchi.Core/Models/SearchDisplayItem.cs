namespace PortalClienchi.Core.Models;

/// <summary>
/// Fila de la lista de resultados: encabezado de grupo o versión elegible.
/// </summary>
public sealed class SearchDisplayItem
{
    public bool IsGroupHeader { get; init; }
    public string? HeaderText { get; init; }
    public string? YearsHint { get; init; }
    public SearchResult? Result { get; init; }

    public static SearchDisplayItem Header(string text, string yearsHint) => new()
    {
        IsGroupHeader = true,
        HeaderText = text,
        YearsHint = yearsHint,
    };

    public static SearchDisplayItem Row(SearchResult result, bool indented) => new()
    {
        Result = result,
        IsGroupHeader = false,
    };
}
