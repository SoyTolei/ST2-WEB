using System.Collections.Concurrent;
using PortalClienchi.Core.Api;
using PortalClienchi.Core.Models;

namespace PortalClienchi.Web;

internal sealed class PortalEmbedSessionService
{
    private static readonly TimeSpan CacheLifetime = TimeSpan.FromMinutes(25);

    private readonly PortalRegistry _registry;
    private readonly ConcurrentDictionary<string, CachedSession> _cache = new(StringComparer.OrdinalIgnoreCase);
    private readonly SemaphoreSlim _loginLock = new(1, 1);

    public PortalEmbedSessionService(PortalRegistry registry)
    {
        _registry = registry;
    }

    public bool HasCredentials(string? portalId) => _registry.HasCredentials(portalId);

    public async Task<PortalSession?> GetSessionAsync(string? portalId, CancellationToken ct = default)
    {
        var runtime = _registry.Resolve(portalId);
        var id = runtime.Info.Id;

        if (_cache.TryGetValue(id, out var cached) && cached.ExpiresAt > DateTimeOffset.UtcNow)
            return cached.Session;

        await _loginLock.WaitAsync(ct);
        try
        {
            if (_cache.TryGetValue(id, out cached) && cached.ExpiresAt > DateTimeOffset.UtcNow)
                return cached.Session;

            using var api = new ThomsonApiClient(runtime.Settings);
            var session = await api.LoginAndGetSessionAsync(ct);
            _cache[id] = new CachedSession(session, DateTimeOffset.UtcNow.Add(CacheLifetime));
            return session;
        }
        finally
        {
            _loginLock.Release();
        }
    }

    private sealed record CachedSession(PortalSession Session, DateTimeOffset ExpiresAt);
}
