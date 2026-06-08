using PortalClienchi.Core.Api;
using PortalClienchi.Core.Configuration;
using PortalClienchi.Core.Data;
using PortalClienchi.Core.Models;

namespace PortalClienchi.Core.Services;

public sealed class SyncService
{
    private readonly AppSettings _settings;
    private readonly ContentRepository _repository;

    public SyncService(AppSettings settings, ContentRepository repository)
    {
        _settings = settings;
        _repository = repository;
    }

    public async Task SyncAllAsync(
        IProgress<SyncProgress>? progress = null,
        CancellationToken ct = default)
    {
        _repository.Initialize();
        _repository.ClearAll();

        using var api = new ThomsonApiClient(_settings);
        await api.LoginAsync(ct);

        var allEntries = new List<(KnowledgeType Type, KnowledgeListEntry Entry)>();

        foreach (var typeId in _settings.SyncTypes)
        {
            if (!Enum.IsDefined(typeof(KnowledgeType), typeId))
                continue;

            var type = (KnowledgeType)typeId;
            progress?.Report(new SyncProgress
            {
                Phase = $"Listando {type.ToDisplayName()}…",
                Current = 0,
                Total = 1,
            });

            var page = 0;
            var pageSize = _settings.SyncPageSize;
            var total = int.MaxValue;
            while (page * pageSize < total)
            {
                ct.ThrowIfCancellationRequested();
                var batch = await api.FindByTypeAsync(type, page, pageSize, ct);
                total = batch.TotalRecords;
                foreach (var item in batch.Items)
                    allEntries.Add((type, item));
                if (batch.Items.Count == 0)
                    break;
                page++;
            }
        }

        var totalWork = allEntries.Count;
        var done = 0;
        var syncedAt = DateTime.UtcNow;

        foreach (var (type, entry) in allEntries)
        {
            ct.ThrowIfCancellationRequested();
            progress?.Report(new SyncProgress
            {
                Phase = "Descargando contenido",
                Current = done,
                Total = totalWork,
                CurrentTitle = entry.Title,
            });

            try
            {
                var detail = await api.GetDetailAsync(entry.Id, type, ct);
                detail.ProductName ??= entry.SystemProductName;
                detail.Keywords ??= entry.Keywords;
                detail.SyncedAt = syncedAt;
                _repository.Upsert(detail);
            }
            catch
            {
                _repository.Upsert(new KnowledgeItem
                {
                    Id = entry.Id,
                    Type = type,
                    Title = entry.Title,
                    ProductName = entry.SystemProductName,
                    Keywords = entry.Keywords,
                    PortalUrl = BuildPortalUrl(_settings, type, entry.Id),
                    SyncedAt = syncedAt,
                });
            }

            done++;
        }

        _repository.SetMeta("last_sync_utc", syncedAt.ToString("O"));
        _repository.SetMeta("item_count", _repository.Count().ToString());

        progress?.Report(new SyncProgress
        {
            Phase = "Completado",
            Current = totalWork,
            Total = totalWork,
        });
    }

    private static string BuildPortalUrl(AppSettings settings, KnowledgeType type, int id)
    {
        var baseUrl = settings.PortalBaseUrl.TrimEnd('/');
        return $"{baseUrl}/knowledge-base/view/{id}";
    }
}
