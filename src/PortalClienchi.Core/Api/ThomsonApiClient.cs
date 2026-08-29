using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using PortalClienchi.Core.Configuration;
using PortalClienchi.Core.Models;
using PortalClienchi.Core.Utilities;

namespace PortalClienchi.Core.Api;

public sealed class ThomsonApiClient : IDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new FlexibleStringConverter() },
    };

    private readonly HttpClient _http;
    private readonly AppSettings _settings;
    private string? _token;

    public ThomsonApiClient(AppSettings settings, HttpMessageHandler? handler = null)
    {
        _settings = settings;
        _http = handler is null ? new HttpClient() : new HttpClient(handler);
        _http.BaseAddress = new Uri(_settings.ApiBaseUrl.TrimEnd('/') + "/");
        _http.Timeout = TimeSpan.FromMinutes(5);
    }

    public async Task LoginAsync(CancellationToken ct = default)
    {
        var body = new { email = _settings.Email.Trim().ToLowerInvariant(), password = _settings.Password };
        var response = await _http.PostAsJsonAsync("session", body, ct);
        response.EnsureSuccessStatusCode();
        var session = await response.Content.ReadFromJsonAsync<SessionResponse>(JsonOptions, ct)
            ?? throw new InvalidOperationException("Respuesta de login vacía.");
        _token = session.Token;
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _token);
    }

    public async Task<PagedKnowledgeResponse> FindByTypeAsync(
        KnowledgeType type,
        int pageNumber,
        int pageSize,
        CancellationToken ct = default)
    {
        await EnsureLoggedInAsync(ct);
        var payload = new
        {
            filter = new { },
            searchText = "",
            sortField = "id",
            sortOrder = "desc",
            pageNumber,
            pageSize,
        };
        var response = await _http.PostAsJsonAsync($"knowledge/find/type/{(int)type}", payload, ct);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        var root = doc.RootElement;
        var total = root.TryGetProperty("totalRecords", out var tr) ? tr.GetInt32() : 0;
        var items = new List<KnowledgeListEntry>();

        if (root.TryGetProperty("items", out var itemsEl) && itemsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in itemsEl.EnumerateArray())
            {
                items.Add(new KnowledgeListEntry
                {
                    Id = el.GetProperty("id").GetInt32(),
                    Title = FlexibleJson.ReadString(el, "title") ?? "",
                    Keywords = FlexibleJson.ReadString(el, "keywords"),
                    SystemProductName = FlexibleJson.ReadString(el, "system_product_name"),
                });
            }
        }

        return new PagedKnowledgeResponse
        {
            TotalRecords = total,
            Items = items,
        };
    }

    public async Task<IReadOnlyList<SearchResult>> SearchOnlineAsync(
        string query,
        KnowledgeType? typeFilter,
        int pageSize = 80,
        CancellationToken ct = default)
    {
        await EnsureLoggedInAsync(ct);
        var variants = TextNormalizer.GetSearchVariants(query, maxVariants: 10);
        var merged = new Dictionary<int, SearchResult>();
        using var gate = new SemaphoreSlim(5);

        var tasks = variants.Select(async variant =>
        {
            await gate.WaitAsync(ct);
            try
            {
                return await FetchSearchPageAsync(variant, typeFilter, pageSize, ct);
            }
            finally
            {
                gate.Release();
            }
        }).ToList();

        foreach (var batch in await Task.WhenAll(tasks))
            MergeResults(merged, batch);

        return RankResults(merged.Values, query);
    }

    private async Task<IReadOnlyList<SearchResult>> FetchSearchPageAsync(
        string searchText,
        KnowledgeType? typeFilter,
        int pageSize,
        CancellationToken ct)
    {
        var path = typeFilter.HasValue
            ? $"knowledge/find/type/{(int)typeFilter.Value}"
            : "knowledge/find";

        var payload = new
        {
            filter = new { },
            searchText = searchText.Trim(),
            sortField = "id",
            sortOrder = "desc",
            pageNumber = 0,
            pageSize,
        };

        var response = await _http.PostAsJsonAsync(path, payload, ct);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        var results = new List<SearchResult>();
        if (!doc.RootElement.TryGetProperty("items", out var items) ||
            items.ValueKind != JsonValueKind.Array)
            return results;

        foreach (var el in items.EnumerateArray())
        {
            var type = MapKnowledgeType(FlexibleJson.ReadString(el, "knowledge_type"), typeFilter);
            var id = el.GetProperty("id").GetInt32();
            var title = FlexibleJson.ReadString(el, "title") ?? "";
            var snippet = BuildSnippet(el);
            var yearInfo = TopicYearHelper.Resolve(title, el, snippet);
            results.Add(new SearchResult
            {
                Id = id,
                Type = type.ToFilterKey(),
                TypeLabel = type.ToDisplayName(),
                Title = title,
                ProductName = ReadProductName(el),
                Snippet = snippet,
                PortalUrl = BuildPortalUrl(type, id),
                Year = yearInfo.Year,
                PublishedAt = yearInfo.PublishedAt,
                SortYear = yearInfo.SortYear,
                GroupKey = TopicYearHelper.NormalizeTopicKey(title),
                GroupTitle = TopicYearHelper.BuildGroupTitle(title),
            });
        }
        return results;
    }

    private static void MergeResults(Dictionary<int, SearchResult> merged, IReadOnlyList<SearchResult> batch)
    {
        foreach (var r in batch)
            merged[r.Id] = r;
    }

    private static List<SearchResult> RankResults(IEnumerable<SearchResult> items, string query)
    {
        return items
            .Select(r => (Result: r, Score: ScoreResult(r, query)))
            .Where(x => x.Score > 0)
            .OrderByDescending(x => x.Score)
            .ThenByDescending(x => TopicYearHelper.IsPlausibleYear(x.Result.SortYear))
            .ThenByDescending(x => TopicYearHelper.IsPlausibleYear(x.Result.SortYear) ? x.Result.SortYear : 0)
            .ThenBy(x => x.Result.Title, StringComparer.OrdinalIgnoreCase)
            .Select(x => x.Result)
            .ToList();
    }

    private static int ScoreResult(SearchResult r, string query)
    {
        if (!TextNormalizer.MatchesAnyField(r.Title, r.Snippet, r.ProductName, query))
            return 0;

        var score = 10;
        var nq = TextNormalizer.NormalizeForSearch(query);
        var nt = TextNormalizer.NormalizeForSearch(r.Title);

        if (nt.Contains(nq, StringComparison.Ordinal))
            score += 100;
        else if (nq.Split(' ', StringSplitOptions.RemoveEmptyEntries).All(w => nt.Contains(w, StringComparison.Ordinal)))
            score += 60;

        if (TextNormalizer.MatchesLoose(r.Snippet, query))
            score += 30;
        if (TextNormalizer.MatchesLoose(r.ProductName, query))
            score += 15;

        return score;
    }

    private string? ReadProductName(JsonElement el)
    {
        var direct = FlexibleJson.ReadString(el, "system_product_name");
        if (!string.IsNullOrWhiteSpace(direct))
            return direct;

        if (!el.TryGetProperty("products", out var products) || products.ValueKind != JsonValueKind.Array)
            return null;

        var names = products.EnumerateArray()
            .Select(p => FlexibleJson.ReadString(p, "name"))
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .ToList();
        return names.Count == 0 ? null : string.Join(", ", names);
    }

    private static string BuildSnippet(JsonElement el)
    {
        var kw = FlexibleJson.ReadString(el, "keywords");
        if (!string.IsNullOrWhiteSpace(kw))
            return kw;
        return FlexibleJson.ReadString(el, "title") ?? "";
    }

    private static KnowledgeType MapKnowledgeType(string? apiType, KnowledgeType? fallback)
    {
        if (string.IsNullOrWhiteSpace(apiType))
            return fallback ?? KnowledgeType.Other;

        return apiType.ToLowerInvariant() switch
        {
            "faq" or "faqs" => KnowledgeType.Faq,
            "video" or "videos" => KnowledgeType.Video,
            "manual" or "manuals" => KnowledgeType.Manual,
            "news" or "update" or "updates" => KnowledgeType.News,
            "link" or "links" => KnowledgeType.Link,
            _ => fallback ?? KnowledgeType.Other,
        };
    }

    public async Task<KnowledgeItem> GetDetailAsync(int id, KnowledgeType fallbackType, CancellationToken ct = default)
    {
        await EnsureLoggedInAsync(ct);
        var response = await _http.GetAsync($"knowledge/{id}", ct);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var root = doc.RootElement;
        var el = root.ValueKind == JsonValueKind.Array
            ? root.EnumerateArray().FirstOrDefault()
            : root;

        if (el.ValueKind == JsonValueKind.Undefined)
            throw new InvalidOperationException($"No se encontró detalle para id {id}.");

        var typeId = el.TryGetProperty("knowledge_type_id", out var tid) && tid.ValueKind == JsonValueKind.Number
            ? tid.GetInt32()
            : (int)fallbackType;
        var type = Enum.IsDefined(typeof(KnowledgeType), typeId)
            ? (KnowledgeType)typeId
            : fallbackType;

        var attachmentUrls = new List<string>();
        string? externalUrl = null;
        if (el.TryGetProperty("knowledge_attachment", out var att) && att.ValueKind == JsonValueKind.Array)
        {
            foreach (var a in att.EnumerateArray())
            {
                var u = FlexibleJson.ReadString(a, "url");
                if (string.IsNullOrWhiteSpace(u))
                    continue;
                attachmentUrls.Add(u);
                externalUrl ??= u;
            }
        }

        var description = FlexibleJson.ReadString(el, "description");
        if (string.IsNullOrWhiteSpace(externalUrl))
            externalUrl = ExtractLinkFromHtml(description);

        DateTime? updated = null;
        var updatedStr = FlexibleJson.ReadString(el, "updated_at");
        if (DateTime.TryParse(updatedStr, out var dt))
            updated = dt;

        return new KnowledgeItem
        {
            Id = el.GetProperty("id").GetInt32(),
            Type = type,
            Title = FlexibleJson.ReadString(el, "title") ?? "",
            ProductName = FlexibleJson.ReadString(el, "system_product_name"),
            Keywords = FlexibleJson.ReadString(el, "keywords"),
            DescriptionHtml = description,
            ExternalUrl = externalUrl,
            AttachmentUrls = attachmentUrls,
            Duration = FlexibleJson.ReadString(el, "duration"),
            UpdatedAt = updated,
            PortalUrl = BuildPortalUrl(type, el.GetProperty("id").GetInt32()),
        };
    }

    private static string? ExtractLinkFromHtml(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
            return null;
        var match = System.Text.RegularExpressions.Regex.Match(
            html,
            @"href=[""'](https?://[^""']+)[""']",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value : null;
    }

    private string BuildPortalUrl(KnowledgeType type, int id)
    {
        var baseUrl = _settings.PortalBaseUrl.TrimEnd('/');
        return $"{baseUrl}/knowledge-base/view/{id}";
    }

    public async Task DownloadFileAsync(string url, string destinationPath, CancellationToken ct = default)
    {
        await EnsureLoggedInAsync(ct);
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        await using var file = File.Create(destinationPath);
        await stream.CopyToAsync(file, ct);
    }

    private async Task EnsureLoggedInAsync(CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_token))
            await LoginAsync(ct);
    }

    public void Dispose() => _http.Dispose();
}
