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
        PurgeInvalidEmails();
        _logger.LogInformation("Accesos ST2 SQLite en {DbPath}", _dbPath);
    }

    public string DatabasePath => _dbPath;

    public bool StorageReady { get; private set; }

    /// <summary>
    /// Elimina registros cuyo correo ya no pasa la validación corporativa
    /// (p. ej. test.upload@thomsonreuters.com).
    /// </summary>
    public int PurgeInvalidEmails()
    {
        if (!StorageReady)
            return 0;

        var removed = 0;
        using var conn = Open();
        using (var list = conn.CreateCommand())
        {
            list.CommandText = "SELECT email FROM app_access";
            using var reader = list.ExecuteReader();
            var toDelete = new List<string>();
            while (reader.Read())
            {
                var email = reader.GetString(0);
                if (PlanUserIdentity.ValidateAndNormalize(email) is null)
                    toDelete.Add(email);
            }

            reader.Close();
            foreach (var email in toDelete)
            {
                using var del = conn.CreateCommand();
                del.CommandText = "DELETE FROM app_access WHERE email = $email";
                del.Parameters.AddWithValue("$email", email);
                removed += del.ExecuteNonQuery();
            }
        }

        if (removed > 0)
            _logger.LogInformation("Purga de accesos inválidos: {Count} eliminado(s)", removed);

        return removed;
    }

    public int DeleteByEmail(string email)
    {
        if (!StorageReady || string.IsNullOrWhiteSpace(email))
            return 0;

        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM app_access WHERE lower(email) = lower($email)";
        cmd.Parameters.AddWithValue("$email", email.Trim());
        return cmd.ExecuteNonQuery();
    }

    public int UpdateDisplayName(string email, string? displayName)
    {
        if (!StorageReady || string.IsNullOrWhiteSpace(email))
            return 0;

        var value = string.IsNullOrWhiteSpace(displayName) ? null : displayName.Trim();
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            UPDATE app_access
            SET display_name = $name
            WHERE lower(email) = lower($email)
            """;
        cmd.Parameters.AddWithValue("$email", email.Trim());
        cmd.Parameters.AddWithValue("$name", (object?)value ?? DBNull.Value);
        return cmd.ExecuteNonQuery();
    }

    public const string StatusPending = "pending";
    public const string StatusApproved = "approved";
    public const string StatusRejected = "rejected";

    public bool IsApprovedForApp(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return false;
        if (St2SuperAdmin.Is(email))
            return true;
        var rec = Find(email);
        return rec is not null
            && string.Equals(rec.Status, StatusApproved, StringComparison.OrdinalIgnoreCase);
    }

    public AppAccessRecordDto? Find(string email)
    {
        if (!StorageReady || string.IsNullOrWhiteSpace(email))
            return null;

        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT email, first_seen_at, last_seen_at, login_count, display_name, last_login_at, status
            FROM app_access
            WHERE lower(email) = lower($email)
            LIMIT 1
            """;
        cmd.Parameters.AddWithValue("$email", email.Trim());
        using var reader = cmd.ExecuteReader();
        return reader.Read() ? ReadRecord(reader) : null;
    }

    public string RequestAccess(string email)
    {
        if (!StorageReady || AppAccessExclusions.IsExcluded(email))
            return StatusRejected;

        var existing = Find(email);
        if (existing is not null)
        {
            if (existing.Status is StatusApproved)
                return StatusApproved;

            if (existing.Status is StatusRejected)
            {
                SetStatus(email, StatusPending);
                TouchActivity(email);
                return StatusPending;
            }

            TouchActivity(email);
            return StatusPending;
        }

        var nowIso = UtcNowIso();
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO app_access (email, first_seen_at, last_seen_at, login_count, last_login_at, status)
            VALUES ($email, $now, $now, 0, NULL, $status)
            """;
        cmd.Parameters.AddWithValue("$email", email);
        cmd.Parameters.AddWithValue("$now", nowIso);
        cmd.Parameters.AddWithValue("$status", StatusPending);
        cmd.ExecuteNonQuery();
        return StatusPending;
    }

    public void EnsureApproved(string email)
    {
        if (!StorageReady || string.IsNullOrWhiteSpace(email))
            return;

        var existing = Find(email);
        if (existing is null)
        {
            var nowIso = UtcNowIso();
            using var conn = Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                INSERT INTO app_access (email, first_seen_at, last_seen_at, login_count, last_login_at, status)
                VALUES ($email, $now, $now, 0, NULL, $status)
                """;
            cmd.Parameters.AddWithValue("$email", email);
            cmd.Parameters.AddWithValue("$now", nowIso);
            cmd.Parameters.AddWithValue("$status", StatusApproved);
            cmd.ExecuteNonQuery();
            return;
        }

        if (!string.Equals(existing.Status, StatusApproved, StringComparison.OrdinalIgnoreCase))
            SetStatus(email, StatusApproved);
    }

    public int SetStatus(string email, string status)
    {
        if (!StorageReady || string.IsNullOrWhiteSpace(email))
            return 0;

        var normalized = status.Trim().ToLowerInvariant();
        if (normalized is not StatusPending and not StatusApproved and not StatusRejected)
            return 0;

        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            UPDATE app_access
            SET status = $status
            WHERE lower(email) = lower($email)
            """;
        cmd.Parameters.AddWithValue("$email", email.Trim());
        cmd.Parameters.AddWithValue("$status", normalized);
        return cmd.ExecuteNonQuery();
    }

    public void RecordAccess(string email)
    {
        if (!StorageReady || AppAccessExclusions.IsExcluded(email))
            return;

        var now = DateTime.UtcNow;
        var nowIso = now.ToString("O", CultureInfo.InvariantCulture);

        using var conn = Open();
        using var tx = conn.BeginTransaction();

        string? lastLoginAt = null;
        string? firstSeenAt = null;
        string status = StatusApproved;
        var exists = false;
        using (var sel = conn.CreateCommand())
        {
            sel.Transaction = tx;
            sel.CommandText = """
                SELECT last_login_at, first_seen_at, status
                FROM app_access
                WHERE lower(email) = lower($email)
                """;
            sel.Parameters.AddWithValue("$email", email);
            using var reader = sel.ExecuteReader();
            if (reader.Read())
            {
                exists = true;
                lastLoginAt = reader.IsDBNull(0) ? null : reader.GetString(0);
                firstSeenAt = reader.IsDBNull(1) ? null : reader.GetString(1);
                status = reader.IsDBNull(2) || string.IsNullOrWhiteSpace(reader.GetString(2))
                    ? StatusApproved
                    : reader.GetString(2);
            }
        }

        if (!exists)
            return;

        if (!string.Equals(status, StatusApproved, StringComparison.OrdinalIgnoreCase))
        {
            using var seen = conn.CreateCommand();
            seen.Transaction = tx;
            seen.CommandText = """
                UPDATE app_access
                SET last_seen_at = $now
                WHERE lower(email) = lower($email)
                """;
            seen.Parameters.AddWithValue("$email", email);
            seen.Parameters.AddWithValue("$now", nowIso);
            seen.ExecuteNonQuery();
            tx.Commit();
            return;
        }

        var previousIso = lastLoginAt ?? firstSeenAt;
        var increment = lastLoginAt is null
            || !TryParseUtc(previousIso, out var previousUtc)
            || ArgentinaDate(previousUtc) != ArgentinaDate(now);

        using var upd = conn.CreateCommand();
        upd.Transaction = tx;
        upd.CommandText = increment
            ? """
                UPDATE app_access
                SET last_seen_at = $now,
                    last_login_at = $now,
                    login_count = login_count + 1
                WHERE lower(email) = lower($email)
                """
            : """
                UPDATE app_access
                SET last_seen_at = $now,
                    last_login_at = COALESCE(last_login_at, $now)
                WHERE lower(email) = lower($email)
                """;
        upd.Parameters.AddWithValue("$email", email);
        upd.Parameters.AddWithValue("$now", nowIso);
        upd.ExecuteNonQuery();
        tx.Commit();
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

    /// <summary>
    /// Primer día de acceso (zona Argentina), independientemente de cuántas veces ingresó hoy.
    /// </summary>
    public static bool IsNewTodayRegistration(string? firstSeenAtIso, int loginCount = 0)
    {
        _ = loginCount;
        return IsRegisteredToday(firstSeenAtIso);
    }

    public static bool IsLoggedInToday(string? lastLoginAtIso)
    {
        if (!TryParseUtc(lastLoginAtIso, out var instant))
            return false;

        var local = TimeZoneInfo.ConvertTimeFromUtc(instant, ArgentinaTimeZone);
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ArgentinaTimeZone);
        return local.Date == nowLocal.Date;
    }

    public AccessSummaryDto BuildSummary(IReadOnlyList<AppAccessRecordDto> items, TimeSpan activeWindow)
    {
        var newToday = 0;
        var active = 0;
        var pending = 0;
        var loggedInToday = 0;

        foreach (var item in items)
        {
            if (string.Equals(item.Status, StatusPending, StringComparison.OrdinalIgnoreCase))
                pending++;
            if (IsNewTodayRegistration(item.FirstSeenAt))
                newToday++;
            if (IsRecentlyActive(item.LastSeenAt, activeWindow))
                active++;
            if (IsLoggedInToday(item.LastLoginAt))
                loggedInToday++;
        }

        return new AccessSummaryDto
        {
            Total = items.Count,
            ActiveCount = active,
            NewTodayCount = newToday,
            PendingCount = pending,
            LoggedInTodayCount = loggedInToday,
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

        return TimeZoneInfo.CreateCustomTimeZone("ART", TimeSpan.FromHours(-3), "Argentina", "Argentina");
    }

    public IReadOnlyList<AppAccessRecordDto> ListAll()
    {
        var list = new List<AppAccessRecordDto>();
        if (!StorageReady)
            return list;

        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT email, first_seen_at, last_seen_at, login_count, display_name, last_login_at, status
            FROM app_access
            ORDER BY last_seen_at DESC
            """;
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            var item = ReadRecord(reader);
            if (AppAccessExclusions.IsExcluded(item.Email))
                continue;
            list.Add(item);
        }

        return list;
    }

    public IReadOnlyList<AppAccessRecordDto> ListDirectory()
    {
        var list = new List<AppAccessRecordDto>();
        if (!StorageReady)
            return list;

        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT email, first_seen_at, last_seen_at, login_count, display_name, last_login_at, status
            FROM app_access
            ORDER BY email COLLATE NOCASE
            """;
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
            list.Add(ReadRecord(reader));

        return list;
    }

    private void EnsureSchema()
    {
        using var conn = Open();
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = """
                CREATE TABLE IF NOT EXISTS app_access (
                    email TEXT PRIMARY KEY,
                    first_seen_at TEXT NOT NULL,
                    last_seen_at TEXT NOT NULL,
                    login_count INTEGER NOT NULL DEFAULT 1,
                    display_name TEXT NULL
                )
                """;
            cmd.ExecuteNonQuery();
        }

        EnsureColumn(conn, "app_access", "display_name", "TEXT NULL");
        EnsureColumn(conn, "app_access", "last_login_at", "TEXT NULL");
        EnsureColumn(conn, "app_access", "status", "TEXT NOT NULL DEFAULT 'approved'");
        EnsureColumn(conn, "app_access", "is_st2_admin", "INTEGER NOT NULL DEFAULT 0");
        using (var backfill = conn.CreateCommand())
        {
            backfill.CommandText = """
                UPDATE app_access
                SET status = 'approved'
                WHERE status IS NULL OR trim(status) = ''
                """;
            backfill.ExecuteNonQuery();
        }
    }

    public bool IsSt2Admin(string? email)
    {
        if (St2SuperAdmin.Is(email))
            return true;
        if (!StorageReady || string.IsNullOrWhiteSpace(email))
            return false;

        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT is_st2_admin FROM app_access
            WHERE lower(email) = lower($email)
            LIMIT 1
            """;
        cmd.Parameters.AddWithValue("$email", email.Trim());
        var raw = cmd.ExecuteScalar();
        if (raw is null || raw is DBNull)
            return false;
        return Convert.ToInt32(raw, CultureInfo.InvariantCulture) != 0;
    }

    public int SetSt2Admin(string email, bool isAdmin)
    {
        if (!StorageReady || string.IsNullOrWhiteSpace(email))
            return 0;
        if (St2SuperAdmin.Is(email))
            return 0;

        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            UPDATE app_access
            SET is_st2_admin = $admin
            WHERE lower(email) = lower($email)
            """;
        cmd.Parameters.AddWithValue("$email", email.Trim());
        cmd.Parameters.AddWithValue("$admin", isAdmin ? 1 : 0);
        return cmd.ExecuteNonQuery();
    }

    private static AppAccessRecordDto ReadRecord(SqliteDataReader reader)
    {
        var status = reader.FieldCount > 6 && !reader.IsDBNull(6) ? reader.GetString(6) : StatusApproved;
        if (string.IsNullOrWhiteSpace(status))
            status = StatusApproved;

        return new AppAccessRecordDto
        {
            Email = reader.GetString(0),
            FirstSeenAt = reader.GetString(1),
            LastSeenAt = reader.GetString(2),
            LoginCount = reader.GetInt32(3),
            DisplayName = reader.IsDBNull(4) ? null : reader.GetString(4),
            LastLoginAt = reader.FieldCount > 5 && !reader.IsDBNull(5) ? reader.GetString(5) : null,
            Status = status.Trim().ToLowerInvariant(),
        };
    }

    private static void EnsureColumn(SqliteConnection conn, string table, string column, string typeSql)
    {
        using var check = conn.CreateCommand();
        check.CommandText = $"PRAGMA table_info({table})";
        using var reader = check.ExecuteReader();
        while (reader.Read())
        {
            if (string.Equals(reader.GetString(1), column, StringComparison.OrdinalIgnoreCase))
                return;
        }

        reader.Close();
        using var alter = conn.CreateCommand();
        alter.CommandText = $"ALTER TABLE {table} ADD COLUMN {column} {typeSql}";
        alter.ExecuteNonQuery();
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

    private static DateTime ArgentinaDate(DateTime utc)
    {
        var instant = DateTime.SpecifyKind(utc, DateTimeKind.Utc);
        return TimeZoneInfo.ConvertTimeFromUtc(instant, ArgentinaTimeZone).Date;
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
    public string? DisplayName { get; init; }
    public string? LastLoginAt { get; init; }
    public string Status { get; init; } = AppAccessRepository.StatusApproved;
}

public sealed class AccessSummaryDto
{
    public int Total { get; init; }
    public int ActiveCount { get; init; }
    public int NewTodayCount { get; init; }
    public int PendingCount { get; init; }
    public int LoggedInTodayCount { get; init; }
    public int ActiveWindowMinutes { get; init; }
}

public sealed class AccessDecisionRequest
{
    [System.Text.Json.Serialization.JsonPropertyName("email")]
    public string Email { get; set; } = "";

    [System.Text.Json.Serialization.JsonPropertyName("action")]
    public string Action { get; set; } = "";
}

public sealed class AccessDisplayNameRequest
{
    public string Email { get; set; } = "";
    public string? DisplayName { get; set; }
}
