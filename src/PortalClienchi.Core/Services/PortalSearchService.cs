using PortalClienchi.Core.Api;
using PortalClienchi.Core.Configuration;
using PortalClienchi.Core.Models;
using PortalClienchi.Core.Utilities;

namespace PortalClienchi.Core.Services;

/// <summary>
/// Búsqueda en vivo contra el portal (sin descargar todo el catálogo).
/// </summary>
public sealed class PortalSearchService : IDisposable
{
    private readonly AppSettings _settings;
    private readonly ThomsonApiClient _api;
    private readonly SemaphoreSlim _loginLock = new(1, 1);

    public PortalSearchService(AppSettings settings)
    {
        _settings = settings;
        _api = new ThomsonApiClient(settings);
    }

    public async Task EnsureConnectedAsync(CancellationToken ct = default)
    {
        await _loginLock.WaitAsync(ct);
        try
        {
            await _api.LoginAsync(ct);
        }
        finally
        {
            _loginLock.Release();
        }
    }

    public async Task<IReadOnlyList<SearchResult>> SearchAsync(
        string query,
        string? typeFilterKey,
        CancellationToken ct = default)
    {
        await EnsureConnectedAsync(ct);
        KnowledgeType? type = null;
        if (!string.IsNullOrEmpty(typeFilterKey) &&
            Enum.TryParse<KnowledgeType>(typeFilterKey, true, out var parsed))
            type = parsed;

        return await _api.SearchOnlineAsync(query, type, pageSize: 60, ct);
    }

    public async Task<KnowledgeItem> GetDetailAsync(
        int id,
        KnowledgeType fallbackType,
        CancellationToken ct = default)
    {
        await EnsureConnectedAsync(ct);
        var item = await _api.GetDetailAsync(id, fallbackType, ct);
        item.DescriptionPlain = HtmlTextHelper.ToPlainText(item.DescriptionHtml);
        return item;
    }

    public Task DownloadFileAsync(string url, string destinationPath, CancellationToken ct = default) =>
        _api.DownloadFileAsync(url, destinationPath, ct);

    public void Dispose() => _api.Dispose();
}
