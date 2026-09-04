using System.Globalization;
using System.Linq;
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
        using (var hist = conn.CreateCommand())
        {
            hist.CommandText = "DELETE FROM app_access_client_history WHERE lower(email) = lower($email)";
            hist.Parameters.AddWithValue("$email", email.Trim());
            hist.ExecuteNonQuery();
        }

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

    /// <summary>Cumpleaños como MM-DD (ej. 08-25). Null limpia.</summary>
    public int UpdateBirthday(string email, string? birthdayMmDd)
    {
        if (!StorageReady || string.IsNullOrWhiteSpace(email))
            return 0;

        var value = NormalizeBirthday(birthdayMmDd);
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            UPDATE app_access
            SET birthday_mmdd = $bday
            WHERE lower(email) = lower($email)
            """;
        cmd.Parameters.AddWithValue("$email", email.Trim());
        cmd.Parameters.AddWithValue("$bday", (object?)value ?? DBNull.Value);
        return cmd.ExecuteNonQuery();
    }

    public static string? NormalizeBirthday(string? raw)
    {
        var v = (raw ?? "").Trim();
        if (v.Length == 0) return null;
        // DD/MM o MM-DD
        var dmy = System.Text.RegularExpressions.Regex.Match(v, @"^(\d{1,2})[/\-.](\d{1,2})$");
        if (!dmy.Success) return null;
        if (!int.TryParse(dmy.Groups[1].Value, out var a) || !int.TryParse(dmy.Groups[2].Value, out var b))
            return null;
        int day;
        int month;
        // Si el primero > 12, es día; si el segundo > 12, es mes/día invertido raro → inválido
        if (a > 12)
        {
            day = a;
            month = b;
        }
        else if (b > 12)
        {
            month = a;
            day = b;
        }
        else
        {
            // Preferimos DD/MM (AR)
            day = a;
            month = b;
        }
        if (month is < 1 or > 12 || day is < 1 or > 31) return null;
        return $"{month:00}-{day:00}";
    }

    public static string? FormatBirthdayDisplay(string? mmDd)
    {
        var m = System.Text.RegularExpressions.Regex.Match(mmDd ?? "", @"^(\d{2})-(\d{2})$");
        if (!m.Success) return null;
        return $"{m.Groups[2].Value}/{m.Groups[1].Value}";
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
            SELECT email, first_seen_at, last_seen_at, login_count, display_name, last_login_at, status, birthday_mmdd,
                   last_client_ip, last_client_host, last_client_hint, last_user_agent, last_client_device
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
                // Queda rechazado: no reabrir pending solo por reintentar el login.
                return StatusRejected;
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

    public void UpdateClientPresence(string email, HttpContext? ctx, string? clientHint = null, string? deviceId = null)
    {
        if (!StorageReady || AppAccessExclusions.IsExcluded(email))
            return;

        var ip = ctx is null ? null : AppAccessClientInfo.GetClientIp(ctx);
        var userAgent = ctx is null ? null : AppAccessClientInfo.GetUserAgent(ctx);
        var hint = AppAccessClientInfo.NormalizeClientHint(clientHint);
        var device = AppAccessClientInfo.ResolveDeviceId(deviceId, hint);
        // Solo DNS reverso real; no rellenar con el hint (antes Host y Cliente salían iguales).
        var host = AppAccessClientInfo.TryResolveHost(ip);
        var browser = AppAccessClientInfo.SummarizeBrowser(userAgent);
        var nowIso = UtcNowIso();

        using var conn = Open();
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = """
                UPDATE app_access
                SET last_client_ip = $ip,
                    last_client_host = $host,
                    last_client_hint = COALESCE($hint, last_client_hint),
                    last_client_device = COALESCE($device, last_client_device),
                    last_user_agent = COALESCE($ua, last_user_agent)
                WHERE lower(email) = lower($email)
                """;
            cmd.Parameters.AddWithValue("$email", email.Trim());
            cmd.Parameters.AddWithValue("$ip", (object?)ip ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$host", (object?)host ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$hint", (object?)hint ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$device", (object?)device ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$ua", (object?)userAgent ?? DBNull.Value);
            cmd.ExecuteNonQuery();
        }

        if (!string.IsNullOrWhiteSpace(device))
            UpsertClientHistory(conn, email.Trim(), device!, hint, userAgent, browser, ip, host, nowIso);
    }

    private static void UpsertClientHistory(
        SqliteConnection conn,
        string email,
        string deviceId,
        string? hint,
        string? userAgent,
        string? browser,
        string? ip,
        string? host,
        string nowIso)
    {
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = """
                INSERT INTO app_access_client_history (
                    email, device_id, client_hint, user_agent, browser, client_ip, client_host, first_seen_at, last_seen_at)
                VALUES ($email, $device, $hint, $ua, $browser, $ip, $host, $now, $now)
                ON CONFLICT(email, device_id) DO UPDATE SET
                    client_hint = COALESCE(excluded.client_hint, app_access_client_history.client_hint),
                    user_agent = COALESCE(excluded.user_agent, app_access_client_history.user_agent),
                    browser = COALESCE(excluded.browser, app_access_client_history.browser),
                    client_ip = COALESCE(excluded.client_ip, app_access_client_history.client_ip),
                    client_host = COALESCE(excluded.client_host, app_access_client_history.client_host),
                    last_seen_at = excluded.last_seen_at
                """;
            cmd.Parameters.AddWithValue("$email", email.ToLowerInvariant());
            cmd.Parameters.AddWithValue("$device", deviceId);
            cmd.Parameters.AddWithValue("$hint", (object?)hint ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$ua", (object?)userAgent ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$browser", (object?)browser ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$ip", (object?)ip ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$host", (object?)host ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$now", nowIso);
            cmd.ExecuteNonQuery();
        }

        // Mantener solo las 5 identidades más recientes por correo.
        using (var trim = conn.CreateCommand())
        {
            trim.CommandText = """
                DELETE FROM app_access_client_history
                WHERE lower(email) = lower($email)
                  AND id NOT IN (
                    SELECT id FROM app_access_client_history
                    WHERE lower(email) = lower($email)
                    ORDER BY last_seen_at DESC, id DESC
                    LIMIT 5
                  )
                """;
            trim.Parameters.AddWithValue("$email", email);
            trim.ExecuteNonQuery();
        }
    }

    public IReadOnlyDictionary<string, IReadOnlyList<AppAccessClientHistoryDto>> ListClientHistoryByEmail(
        IEnumerable<string> emails,
        int perEmail = 5)
    {
        var result = new Dictionary<string, IReadOnlyList<AppAccessClientHistoryDto>>(StringComparer.OrdinalIgnoreCase);
        if (!StorageReady)
            return result;

        var targets = emails
            .Select(e => (e ?? "").Trim().ToLowerInvariant())
            .Where(e => e.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (targets.Count == 0)
            return result;

        var take = Math.Clamp(perEmail, 1, 10);
        using var conn = Open();
        foreach (var email in targets)
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                SELECT device_id, client_hint, user_agent, browser, client_ip, client_host, first_seen_at, last_seen_at
                FROM app_access_client_history
                WHERE lower(email) = lower($email)
                ORDER BY last_seen_at DESC, id DESC
                LIMIT $limit
                """;
            cmd.Parameters.AddWithValue("$email", email);
            cmd.Parameters.AddWithValue("$limit", take);
            var rows = new List<AppAccessClientHistoryDto>();
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                var device = reader.IsDBNull(0) ? "" : reader.GetString(0);
                var hint = reader.IsDBNull(1) ? null : reader.GetString(1);
                var ua = reader.IsDBNull(2) ? null : reader.GetString(2);
                var browser = reader.IsDBNull(3) ? null : reader.GetString(3);
                browser ??= AppAccessClientInfo.SummarizeBrowser(ua);
                rows.Add(new AppAccessClientHistoryDto
                {
                    DeviceId = device,
                    ClientHint = hint,
                    UserAgent = ua,
                    Browser = browser,
                    ClientIp = reader.IsDBNull(4) ? null : reader.GetString(4),
                    ClientHost = reader.IsDBNull(5) ? null : reader.GetString(5),
                    FirstSeenAt = reader.IsDBNull(6) ? "" : reader.GetString(6),
                    LastSeenAt = reader.IsDBNull(7) ? "" : reader.GetString(7),
                    Label = AppAccessClientInfo.BuildDisplayLabel(
                        reader.IsDBNull(5) ? null : reader.GetString(5),
                        hint,
                        reader.IsDBNull(4) ? null : reader.GetString(4),
                        device,
                        browser) ?? "—",
                });
            }

            if (rows.Count > 0)
                result[email] = rows;
        }

        return result;
    }

    /// <summary>Correos con 2+ device ids distintos activos dentro de la ventana.</summary>
    public IReadOnlySet<string> ListConcurrentSessionEmails(TimeSpan activeWindow)
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (!StorageReady)
            return set;

        var since = DateTime.UtcNow.Subtract(activeWindow).ToString("O", CultureInfo.InvariantCulture);
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT lower(email)
            FROM app_access_client_history
            WHERE last_seen_at >= $since
            GROUP BY lower(email)
            HAVING COUNT(DISTINCT device_id) >= 2
            """;
        cmd.Parameters.AddWithValue("$since", since);
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            if (!reader.IsDBNull(0))
                set.Add(reader.GetString(0));
        }

        return set;
    }

    public void AddAudit(string actorEmail, string action, string targetEmail, string? detail = null)
    {
        if (!StorageReady) return;
        var actor = (actorEmail ?? "").Trim().ToLowerInvariant();
        var target = (targetEmail ?? "").Trim().ToLowerInvariant();
        var act = (action ?? "").Trim().ToLowerInvariant();
        if (actor.Length == 0 || target.Length == 0 || act.Length == 0) return;

        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO app_access_audit (created_at, actor_email, action, target_email, detail)
            VALUES ($created, $actor, $action, $target, $detail)
            """;
        cmd.Parameters.AddWithValue("$created", UtcNowIso());
        cmd.Parameters.AddWithValue("$actor", actor);
        cmd.Parameters.AddWithValue("$action", act);
        cmd.Parameters.AddWithValue("$target", target);
        cmd.Parameters.AddWithValue("$detail", (object?)detail ?? DBNull.Value);
        cmd.ExecuteNonQuery();
    }

    public IReadOnlyList<AppAccessAuditDto> ListRecentAudit(int limit = 40, bool todayOnly = false)
    {
        if (!StorageReady) return Array.Empty<AppAccessAuditDto>();
        var take = Math.Clamp(limit, 1, 100);
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        if (todayOnly)
        {
            var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ArgentinaTimeZone);
            var startLocal = nowLocal.Date;
            var startUtc = TimeZoneInfo.ConvertTimeToUtc(startLocal, ArgentinaTimeZone);
            cmd.CommandText = """
                SELECT id, created_at, actor_email, action, target_email, detail
                FROM app_access_audit
                WHERE created_at >= $since
                ORDER BY created_at DESC, id DESC
                LIMIT $limit
                """;
            cmd.Parameters.AddWithValue("$since", startUtc.ToString("O", CultureInfo.InvariantCulture));
        }
        else
        {
            cmd.CommandText = """
                SELECT id, created_at, actor_email, action, target_email, detail
                FROM app_access_audit
                ORDER BY created_at DESC, id DESC
                LIMIT $limit
                """;
        }

        cmd.Parameters.AddWithValue("$limit", take);
        var list = new List<AppAccessAuditDto>();
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            list.Add(new AppAccessAuditDto
            {
                Id = reader.GetInt32(0),
                CreatedAt = reader.IsDBNull(1) ? "" : reader.GetString(1),
                ActorEmail = reader.IsDBNull(2) ? "" : reader.GetString(2),
                Action = reader.IsDBNull(3) ? "" : reader.GetString(3),
                TargetEmail = reader.IsDBNull(4) ? "" : reader.GetString(4),
                Detail = reader.IsDBNull(5) ? null : reader.GetString(5),
            });
        }

        return list;
    }

    public AppAccessRecordDto CreatePresetProfile(
        string email,
        string? displayName,
        string? birthdayMmDd,
        bool clearBirthday)
    {
        if (!StorageReady)
            throw new InvalidOperationException("El almacenamiento de accesos no está disponible.");

        var normalized = PlanUserIdentity.ValidateAndNormalize(email)
            ?? throw new ArgumentException("Correo inválido.");

        EnsureApproved(normalized);

        if (!string.IsNullOrWhiteSpace(displayName))
            UpdateDisplayName(normalized, displayName.Trim());

        if (clearBirthday)
            UpdateBirthday(normalized, null);
        else if (!string.IsNullOrWhiteSpace(birthdayMmDd))
        {
            var bday = NormalizeBirthday(birthdayMmDd);
            if (bday is null)
                throw new ArgumentException("Cumpleaños inválido. Usá DD/MM.");
            UpdateBirthday(normalized, bday);
        }

        return Find(normalized) ?? throw new InvalidOperationException("No se pudo crear el perfil precargado.");
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
            SELECT email, first_seen_at, last_seen_at, login_count, display_name, last_login_at, status, birthday_mmdd,
                   last_client_ip, last_client_host, last_client_hint, last_user_agent, last_client_device
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

    public IReadOnlyList<AppAccessRecordDto> ListPending() =>
        ListAll()
            .Where(item => string.Equals(item.Status, StatusPending, StringComparison.OrdinalIgnoreCase))
            .ToList();

    public IReadOnlyList<AppAccessRecordDto> ListDirectory()
    {
        var list = new List<AppAccessRecordDto>();
        if (!StorageReady)
            return list;

        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT email, first_seen_at, last_seen_at, login_count, display_name, last_login_at, status, birthday_mmdd,
                   last_client_ip, last_client_host, last_client_hint, last_user_agent, last_client_device
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
        EnsureColumn(conn, "app_access", "birthday_mmdd", "TEXT NULL");
        EnsureColumn(conn, "app_access", "last_client_ip", "TEXT NULL");
        EnsureColumn(conn, "app_access", "last_client_host", "TEXT NULL");
        EnsureColumn(conn, "app_access", "last_client_hint", "TEXT NULL");
        EnsureColumn(conn, "app_access", "last_user_agent", "TEXT NULL");
        EnsureColumn(conn, "app_access", "last_client_device", "TEXT NULL");
        using (var notices = conn.CreateCommand())
        {
            notices.CommandText = """
                CREATE TABLE IF NOT EXISTS app_access_owner_notices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    kind TEXT NOT NULL,
                    target_email TEXT NOT NULL,
                    actor_email TEXT NOT NULL,
                    message TEXT NULL,
                    created_at TEXT NOT NULL,
                    seen INTEGER NOT NULL DEFAULT 0
                )
                """;
            notices.ExecuteNonQuery();
        }
        using (var idx = conn.CreateCommand())
        {
            idx.CommandText = """
                CREATE INDEX IF NOT EXISTS idx_app_access_owner_notices_seen
                ON app_access_owner_notices (seen, created_at)
                """;
            idx.ExecuteNonQuery();
        }
        using (var hist = conn.CreateCommand())
        {
            hist.CommandText = """
                CREATE TABLE IF NOT EXISTS app_access_client_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL,
                    device_id TEXT NOT NULL,
                    client_hint TEXT NULL,
                    user_agent TEXT NULL,
                    browser TEXT NULL,
                    client_ip TEXT NULL,
                    client_host TEXT NULL,
                    first_seen_at TEXT NOT NULL,
                    last_seen_at TEXT NOT NULL,
                    UNIQUE(email, device_id)
                )
                """;
            hist.ExecuteNonQuery();
        }
        using (var histIdx = conn.CreateCommand())
        {
            histIdx.CommandText = """
                CREATE INDEX IF NOT EXISTS idx_app_access_client_history_email_last
                ON app_access_client_history (email, last_seen_at DESC)
                """;
            histIdx.ExecuteNonQuery();
        }
        using (var audit = conn.CreateCommand())
        {
            audit.CommandText = """
                CREATE TABLE IF NOT EXISTS app_access_audit (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    actor_email TEXT NOT NULL,
                    action TEXT NOT NULL,
                    target_email TEXT NOT NULL,
                    detail TEXT NULL
                )
                """;
            audit.ExecuteNonQuery();
        }
        using (var auditIdx = conn.CreateCommand())
        {
            auditIdx.CommandText = """
                CREATE INDEX IF NOT EXISTS idx_app_access_audit_created
                ON app_access_audit (created_at DESC, id DESC)
                """;
            auditIdx.ExecuteNonQuery();
        }
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

    public void AddOwnerNotice(string kind, string targetEmail, string actorEmail, string? message = null)
    {
        if (!StorageReady) return;
        var target = PlanUserIdentity.ValidateAndNormalize(targetEmail);
        var actor = PlanUserIdentity.ValidateAndNormalize(actorEmail);
        if (target is null || actor is null) return;
        var kindNorm = string.IsNullOrWhiteSpace(kind) ? "preset_created" : kind.Trim().ToLowerInvariant();

        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO app_access_owner_notices (kind, target_email, actor_email, message, created_at, seen)
            VALUES ($kind, $target, $actor, $msg, $created, 0)
            """;
        cmd.Parameters.AddWithValue("$kind", kindNorm);
        cmd.Parameters.AddWithValue("$target", target);
        cmd.Parameters.AddWithValue("$actor", actor);
        cmd.Parameters.AddWithValue("$msg", (object?)message ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$created", DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture));
        cmd.ExecuteNonQuery();
    }

    public IReadOnlyList<AppAccessOwnerNoticeDto> ListUnseenOwnerNotices(int limit = 40)
    {
        if (!StorageReady) return Array.Empty<AppAccessOwnerNoticeDto>();
        var take = Math.Clamp(limit, 1, 100);
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, kind, target_email, actor_email, message, created_at
            FROM app_access_owner_notices
            WHERE seen = 0
            ORDER BY created_at DESC, id DESC
            LIMIT $limit
            """;
        cmd.Parameters.AddWithValue("$limit", take);
        var list = new List<AppAccessOwnerNoticeDto>();
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            list.Add(new AppAccessOwnerNoticeDto
            {
                Id = reader.GetInt32(0),
                Kind = reader.IsDBNull(1) ? "" : reader.GetString(1),
                TargetEmail = reader.IsDBNull(2) ? "" : reader.GetString(2),
                ActorEmail = reader.IsDBNull(3) ? "" : reader.GetString(3),
                Message = reader.IsDBNull(4) ? null : reader.GetString(4),
                CreatedAt = reader.IsDBNull(5) ? "" : reader.GetString(5),
            });
        }
        return list;
    }

    public int MarkOwnerNoticesSeen(IEnumerable<int>? ids = null)
    {
        if (!StorageReady) return 0;
        using var conn = Open();
        var idList = ids?.Where(id => id > 0).Distinct().ToList();
        using var cmd = conn.CreateCommand();
        if (idList is { Count: > 0 })
        {
            var placeholders = string.Join(",", idList.Select((_, i) => $"$id{i}"));
            cmd.CommandText = $"UPDATE app_access_owner_notices SET seen = 1 WHERE seen = 0 AND id IN ({placeholders})";
            for (var i = 0; i < idList.Count; i++)
                cmd.Parameters.AddWithValue($"$id{i}", idList[i]);
        }
        else
        {
            cmd.CommandText = "UPDATE app_access_owner_notices SET seen = 1 WHERE seen = 0";
        }
        return cmd.ExecuteNonQuery();
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
            BirthdayMmDd = reader.FieldCount > 7 && !reader.IsDBNull(7) ? reader.GetString(7) : null,
            LastClientIp = reader.FieldCount > 8 && !reader.IsDBNull(8) ? reader.GetString(8) : null,
            LastClientHost = reader.FieldCount > 9 && !reader.IsDBNull(9) ? reader.GetString(9) : null,
            LastClientHint = reader.FieldCount > 10 && !reader.IsDBNull(10) ? reader.GetString(10) : null,
            LastUserAgent = reader.FieldCount > 11 && !reader.IsDBNull(11) ? reader.GetString(11) : null,
            LastClientDevice = reader.FieldCount > 12 && !reader.IsDBNull(12) ? reader.GetString(12) : null,
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
    /// <summary>MM-DD opcional (calendario Argentina para cumpleaños).</summary>
    public string? BirthdayMmDd { get; init; }
    public string? LastClientIp { get; init; }
    public string? LastClientHost { get; init; }
    public string? LastClientHint { get; init; }
    public string? LastUserAgent { get; init; }
    public string? LastClientDevice { get; init; }
}

public sealed class AppAccessClientHistoryDto
{
    public string DeviceId { get; init; } = "";
    public string? ClientHint { get; init; }
    public string? UserAgent { get; init; }
    public string? Browser { get; init; }
    public string? ClientIp { get; init; }
    public string? ClientHost { get; init; }
    public string FirstSeenAt { get; init; } = "";
    public string LastSeenAt { get; init; } = "";
    public string Label { get; init; } = "";
}

public sealed class AppAccessAuditDto
{
    public int Id { get; init; }
    public string CreatedAt { get; init; } = "";
    public string ActorEmail { get; init; } = "";
    public string Action { get; init; } = "";
    public string TargetEmail { get; init; } = "";
    public string? Detail { get; init; }
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

public sealed class AccessPresetRequest
{
    public string Email { get; set; } = "";
    public string? DisplayName { get; set; }
    public string? BirthdayMmDd { get; set; }
    public bool ClearBirthday { get; set; }
    public bool? Oportunidad { get; set; }
    public bool? PdfPortal { get; set; }
    public bool? Blanqueo { get; set; }
    public bool? BlanqueoConfirm { get; set; }
    public bool? BlanqueoLoad { get; set; }
    public bool? BorradoBases { get; set; }
    public bool? BorradoBasesConfirm { get; set; }
    public bool? BorradoBasesLoad { get; set; }
    public bool? PlanillasSqlOnvio { get; set; }
    public bool? PlanillasTransferencia { get; set; }
    public bool? PlanillasReferral { get; set; }
    public bool? PlanillasLegal { get; set; }
    public bool? LegalFirm { get; set; }
    public bool? LegalHighq { get; set; }
    public bool? LegalWestlaw { get; set; }
    public bool? LegalCocounsel { get; set; }
    public bool? PlanillasChile { get; set; }
    public bool? ChileTransferencia { get; set; }
    public bool? ChileReferral { get; set; }
    public bool? ChileSaad { get; set; }
    public bool? ChileHr { get; set; }
    public bool? ChileWiki { get; set; }
    public bool? ChileLp { get; set; }
    public bool? ChilePowerapps { get; set; }
    public bool? St2Admin { get; set; }
}

public sealed class AccessDisplayNameRequest
{
    public string Email { get; set; } = "";
    public string? DisplayName { get; set; }
    /// <summary>DD/MM o MM-DD. Enviar vacío + ClearBirthday para borrar.</summary>
    public string? BirthdayMmDd { get; set; }
    public bool ClearBirthday { get; set; }
}

public sealed class OwnerNoticesSeenRequest
{
    public List<int>? Ids { get; set; }
}

public sealed class AppAccessOwnerNoticeDto
{
    public int Id { get; set; }
    public string Kind { get; set; } = "";
    public string TargetEmail { get; set; } = "";
    public string ActorEmail { get; set; } = "";
    public string? Message { get; set; }
    public string CreatedAt { get; set; } = "";
}
