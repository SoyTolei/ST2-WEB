using System.Globalization;
using Microsoft.Data.Sqlite;

namespace PortalClienchi.Web.Planillas;

public sealed class AppAccessRepository
{
    private readonly string _dbPath;
    private readonly ILogger<AppAccessRepository> _logger;

    public AppAccessRepository(ILogger<AppAccessRepository> logger)
    {
        _logger = logger;
        var st2Dir = St2Paths.GetDataDirectory();
        Directory.CreateDirectory(st2Dir);
        _dbPath = Path.Combine(st2Dir, "app_access.db");
        EnsureWritable(st2Dir);
        EnsureSchema();
        _logger.LogInformation("Accesos ST2 SQLite en {DbPath}", _dbPath);
    }

    public string DatabasePath => _dbPath;

    public bool StorageReady { get; private set; }

    public void RecordAccess(string email)
    {
        if (!StorageReady || AppAccessExclusions.IsExcluded(email))
            return;

        var now = UtcNowIso();
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO app_access (email, first_seen_at, last_seen_at, login_count)
            VALUES ($email, $now, $now, 1)
            ON CONFLICT(email) DO UPDATE SET
                last_seen_at = excluded.last_seen_at,
                login_count = login_count + 1
            """;
        cmd.Parameters.AddWithValue("$email", email);
        cmd.Parameters.AddWithValue("$now", now);
        cmd.ExecuteNonQuery();
    }

    public void TouchActivity(string email)
    {
        if (!StorageReady || AppAccessExclusions.IsExcluded(email))
            return;

        var now = UtcNowIso();
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            UPDATE app_access
            SET last_seen_at = $now
            WHERE email = $email
              AND (
                julianday($now) - julianday(last_seen_at)
              ) * 86400 >= 45
            """;
        cmd.Parameters.AddWithValue("$email", email);
        cmd.Parameters.AddWithValue("$now", now);
        cmd.ExecuteNonQuery();
    }

    private static readonly TimeZoneInfo ArgentinaTimeZone = ResolveArgentinaTimeZone();

    public static bool IsRecentlyActive(string? lastSeenAtIso, TimeSpan window)
    {
        if (!TryParseUtc(lastSeenAtIso, out var instant))
            return false;

        return DateTime.UtcNow - instant <= window;
    }

    public static bool IsRegisteredToday(string? firstSeenAtIso)
    {
        if (!TryParseUtc(firstSeenAtIso, out var instant))
            return false;

        var local = TimeZoneInfo.ConvertTimeFromUtc(instant, ArgentinaTimeZone);
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ArgentinaTimeZone);
        return local.Date == nowLocal.Date;
    }

    public static bool IsNewTodayRegistration(string? firstSeenAtIso, int loginCount)
    {
        return loginCount == 1 && IsRegisteredToday(firstSeenAtIso);
    }

    public AccessSummaryDto BuildSummary(IReadOnlyList<AppAccessRecordDto> items, TimeSpan activeWindow)
    {
        var newToday = 0;
        var active = 0;

        foreach (var item in items)
        {
            if (IsNewTodayRegistration(item.FirstSeenAt, item.LoginCount))
                newToday++;
            if (IsRecentlyActive(item.LastSeenAt, activeWindow))
                active++;
        }

        return new AccessSummaryDto
        {
            Total = items.Count,
            ActiveCount = active,
            NewTodayCount = newToday,
            ActiveWindowMinutes = (int)activeWindow.TotalMinutes,
        };
    }

    private static bool TryParseUtc(string? iso, out DateTime instant)
    {
        instant = default;
        if (string.IsNullOrWhiteSpace(iso))
            return false;

        if (!DateTime.TryParse(iso, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsed))
            return false;

        instant = parsed.ToUniversalTime();
        return true;
    }

    private static TimeZoneInfo ResolveArgentinaTimeZone()
    {
        foreach (var id in new[] { "America/Argentina/Buenos_Aires", "Argentina Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        return TimeZoneInfo.Utc;
    }

    public IReadOnlyList<AppAccessRecordDto> ListAll()
    {
        var list = new List<AppAccessRecordDto>();
        if (!StorageReady)
            return list;

        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT email, first_seen_at, last_seen_at, login_count
            FROM app_access
            ORDER BY last_seen_at DESC
            """;
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            var email = reader.GetString(0);
            if (AppAccessExclusions.IsExcluded(email))
                continue;

            list.Add(new AppAccessRecordDto
            {
                Email = email,
                FirstSeenAt = reader.GetString(1),
                LastSeenAt = reader.GetString(2),
                LoginCount = reader.GetInt32(3),
            });
        }

        return list;
    }

    private void EnsureSchema()
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS app_access (
                email TEXT PRIMARY KEY,
                first_seen_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                login_count INTEGER NOT NULL DEFAULT 1
            )
            """;
        cmd.ExecuteNonQuery();
    }

    private void EnsureWritable(string dir)
    {
        try
        {
            var probe = Path.Combine(dir, ".write-test-access");
            File.WriteAllText(probe, DateTime.UtcNow.ToString(CultureInfo.InvariantCulture));
            File.Delete(probe);
            StorageReady = true;
        }
        catch (Exception ex)
        {
            StorageReady = false;
            _logger.LogError(ex, "Sin permiso de escritura en {Dir}", dir);
        }
    }

    private SqliteConnection Open()
    {
        var conn = new SqliteConnection($"Data Source={_dbPath}");
        conn.Open();
        using (var pragma = conn.CreateCommand())
        {
            pragma.CommandText = "PRAGMA journal_mode=WAL;";
            pragma.ExecuteNonQuery();
        }

        return conn;
    }

    private static string UtcNowIso() =>
        DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture);
}

public sealed class AppAccessRecordDto
{
    public string Email { get; init; } = "";
    public string FirstSeenAt { get; init; } = "";
    public string LastSeenAt { get; init; } = "";
    public int LoginCount { get; init; }
}

public sealed class AccessSummaryDto
{
    public int Total { get; init; }
    public int ActiveCount { get; init; }
    public int NewTodayCount { get; init; }
    public int ActiveWindowMinutes { get; init; }
}
