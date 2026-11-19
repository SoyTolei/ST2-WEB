using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace PortalClienchi.Web.Planillas;

public sealed class DailyCrypticRepository
{
    public const int MorningSlot = 9 * 60;
    public const int AfternoonSlot = 13 * 60 + 30;
    public static readonly int[] Slots = [MorningSlot, AfternoonSlot];
    public const int MaxAttempts = 5;
    public const int HintDefinition = 1;
    public const int HintMechanism = 2;
    public const int HintIndicator = 4;
    public const int HintFodder = 8;
    public const int HintAlmost = 16;

    private readonly string _dbPath;
    private readonly AppAccessRepository _accessRepo;
    private readonly ILogger<DailyCrypticRepository> _logger;
    private readonly TimeZoneInfo _argentinaTimeZone;

    public DailyCrypticRepository(
        AppAccessRepository accessRepo,
        ILogger<DailyCrypticRepository> logger)
    {
        _accessRepo = accessRepo;
        _logger = logger;
        _argentinaTimeZone = ResolveArgentinaTimeZone();

        var dataDir = St2Paths.GetDataDirectory();
        Directory.CreateDirectory(dataDir);
        _dbPath = Path.Combine(dataDir, "daily_cryptic.db");
        EnsureSchema();
        SeedClues();
        _logger.LogInformation("Críptico diario SQLite en {DbPath}", _dbPath);
    }

    public DailyCrypticStatusDto GetStatus(string email, DateTimeOffset? nowUtc = null)
    {
        var normalizedEmail = NormalizePlayer(email);
        var ranked = !CrypticGuestIdentity.IsPlayer(normalizedEmail);
        var localNow = ToLocal(nowUtc ?? DateTimeOffset.UtcNow);
        var window = ResolveForPlayer(localNow, normalizedEmail);
        var date = window.Date;
        if (!window.Closed)
            EnsureSchedule(date);

        using var conn = Open();
        EnsureRankingBonus(conn);
        var yearStart = new DateOnly(date.Year, 1, 1);
        var yearEnd = new DateOnly(date.Year + 1, 1, 1);
        var season = date.Year.ToString(CultureInfo.InvariantCulture);
        var seasonRanking = ranked
            ? LoadRanking(conn, yearStart, yearEnd, includeBonus: true)
            : [];
        if (window.Closed)
        {
            var holiday = ArgentinaHolidays.TryGetName(date, out var holidayName);
            return new DailyCrypticStatusDto(
                date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                "America/Argentina/Buenos_Aires",
                holiday ? "holiday" : "weekend",
                NextOpen(localNow, window, []).ToString("O"),
                [],
                [],
                season,
                seasonRanking,
                ranked,
                holiday ? holidayName : null);
        }

        var daySlots = ReadScheduledSlots(conn, null, date);
        var rounds = LoadRounds(conn, normalizedEmail, date, localNow, window.Overnight, daySlots, window.ForceOpen);
        var ranking = ranked ? LoadRanking(conn, date, date.AddDays(1)) : [];
        var nextAt = NextOpen(localNow, window, daySlots).ToString("O");

        return new DailyCrypticStatusDto(
            date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            "America/Argentina/Buenos_Aires",
            "active",
            nextAt,
            rounds,
            ranking,
            season,
            seasonRanking,
            ranked);
    }

    public int RevealHint(string email, int slot, string? kind, DateTimeOffset? nowUtc = null)
    {
        var normalizedEmail = NormalizePlayer(email);
        var localNow = ToLocal(nowUtc ?? DateTimeOffset.UtcNow);
        var window = ResolveForPlayer(localNow, normalizedEmail);
        if (window.Closed)
            throw new InvalidOperationException("El Críptico es de lunes a viernes.");
        var date = window.Date;
        EnsureSchedule(date);
        using var conn = Open();
        var daySlots = ReadScheduledSlots(conn, null, date);
        if (!daySlots.Contains(slot))
            throw new ArgumentException("Ronda inválida.", nameof(slot));
        if (!window.ForceOpen && !window.Overnight && MinuteOf(localNow) < SlotMinute(slot))
            throw new InvalidOperationException($"La ronda de las {SlotLabel(slot)} todavía no abrió.");

        using var tx = conn.BeginTransaction(deferred: false);
        if (LoadSolve(conn, tx, normalizedEmail, date, slot) is not null)
            throw new InvalidOperationException("Esta ronda ya está resuelta.");

        var bit = NormalizeHintKind(kind);
        var mask = LoadHintMask(conn, tx, normalizedEmail, date, slot);
        if (bit == HintAlmost)
        {
            var scheduled = LoadScheduledClue(conn, tx, date, slot)
                ?? throw new InvalidOperationException("No se pudo cargar la pista de esta ronda.");
            var maxLetters = Math.Max(0, LetterCountOf(scheduled.Answer) - 1);
            var shown = RevealedLetterCount(mask);
            if (shown < maxLetters)
                mask = (mask & 31) | ((shown + 1) << 5);
        }
        else if ((mask & bit) == 0)
        {
            mask |= bit;
        }

        var next = HintCost(mask);
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            INSERT INTO daily_cryptic_hints (play_date, slot_hour, email, level, kinds)
            VALUES ($date, $slot, $email, $level, $kinds)
            ON CONFLICT (play_date, slot_hour, email) DO UPDATE SET
                level = excluded.level,
                kinds = excluded.kinds
            """;
        cmd.Parameters.AddWithValue("$date", DateKey(date));
        cmd.Parameters.AddWithValue("$slot", slot);
        cmd.Parameters.AddWithValue("$email", normalizedEmail);
        cmd.Parameters.AddWithValue("$level", next);
        cmd.Parameters.AddWithValue("$kinds", mask);
        cmd.ExecuteNonQuery();
        tx.Commit();
        return next;
    }

    public DailyCrypticAttemptResult Submit(
        string email,
        int slot,
        string? submittedAnswer,
        DateTimeOffset? nowUtc = null)
    {
        var normalizedEmail = NormalizePlayer(email);
        var normalizedAnswer = NormalizeAnswer(submittedAnswer);
        if (normalizedAnswer.Length == 0)
            throw new ArgumentException("Escribí una respuesta.");
        var localNow = ToLocal(nowUtc ?? DateTimeOffset.UtcNow);
        var window = ResolveForPlayer(localNow, normalizedEmail);
        if (window.Closed)
            throw new InvalidOperationException("El Críptico es de lunes a viernes.");
        var date = window.Date;
        EnsureSchedule(date);
        using var conn = Open();
        var daySlots = ReadScheduledSlots(conn, null, date);
        if (!daySlots.Contains(slot))
            throw new ArgumentException("Ronda inválida.", nameof(slot));
        if (!window.ForceOpen && !window.Overnight && MinuteOf(localNow) < SlotMinute(slot))
            throw new InvalidOperationException($"La ronda de las {SlotLabel(slot)} todavía no abrió.");

        using var tx = conn.BeginTransaction(deferred: false);

        var scheduled = LoadScheduledClue(conn, tx, date, slot)
            ?? throw new InvalidOperationException("No se pudo cargar la pista de esta ronda.");

        var solved = LoadSolve(conn, tx, normalizedEmail, date, slot);
        if (solved is not null)
        {
            tx.Commit();
            return new DailyCrypticAttemptResult(
                true,
                "Esta ronda ya estaba resuelta.",
                Math.Max(0, MaxAttempts - solved.AttemptCount),
                GetStatus(normalizedEmail, nowUtc));
        }

        var attemptsUsed = CountAttempts(conn, tx, normalizedEmail, date, slot);
        if (attemptsUsed >= MaxAttempts)
            throw new InvalidOperationException("Ya usaste los cinco intentos de esta ronda.");

        var correct = scheduled.AcceptedAnswers
            .Append(scheduled.Answer)
            .Select(NormalizeAnswer)
            .Any(answer => answer == normalizedAnswer);

        using (var insertAttempt = conn.CreateCommand())
        {
            insertAttempt.Transaction = tx;
            insertAttempt.CommandText = """
                INSERT INTO daily_cryptic_attempts
                    (play_date, slot_hour, clue_id, email, submitted_answer, correct, created_at)
                VALUES ($date, $slot, $clue, $email, $answer, $correct, $created)
                """;
            insertAttempt.Parameters.AddWithValue("$date", DateKey(date));
            insertAttempt.Parameters.AddWithValue("$slot", slot);
            insertAttempt.Parameters.AddWithValue("$clue", scheduled.Id);
            insertAttempt.Parameters.AddWithValue("$email", normalizedEmail);
            insertAttempt.Parameters.AddWithValue("$answer", submittedAnswer?.Trim() ?? "");
            insertAttempt.Parameters.AddWithValue("$correct", correct ? 1 : 0);
            insertAttempt.Parameters.AddWithValue("$created", DateTimeOffset.UtcNow.ToString("O"));
            insertAttempt.ExecuteNonQuery();
        }

        var remaining = MaxAttempts - attemptsUsed - 1;
        var message = remaining > 0
            ? "No es esa."
            : "No era esa. Se terminaron los intentos de esta ronda.";

        if (correct)
        {
            var position = CountSolves(conn, tx, date, slot) + 1;
            var hints = CountHints(conn, tx, normalizedEmail, date, slot);
            var roundPoints = Math.Max(1, 10 - hints);
            var alreadySolved = CountPlayerSolves(conn, tx, normalizedEmail, date);
            var completesDay = daySlots.Count == 2 && alreadySolved + 1 == 2;
            var cleanDay = completesDay
                && hints == 0
                && daySlots.Where(item => item != slot).All(item => CountHints(conn, tx, normalizedEmail, date, item) == 0);
            var points = roundPoints + (cleanDay ? 5 : 0);
            var solvedAt = DateTimeOffset.UtcNow.ToString("O");
            using var insertSolve = conn.CreateCommand();
            insertSolve.Transaction = tx;
            insertSolve.CommandText = """
                INSERT INTO daily_cryptic_solves
                    (play_date, slot_hour, clue_id, email, position, points, attempt_count, solved_at)
                VALUES ($date, $slot, $clue, $email, $position, $points, $attempts, $solved)
                """;
            insertSolve.Parameters.AddWithValue("$date", DateKey(date));
            insertSolve.Parameters.AddWithValue("$slot", slot);
            insertSolve.Parameters.AddWithValue("$clue", scheduled.Id);
            insertSolve.Parameters.AddWithValue("$email", normalizedEmail);
            insertSolve.Parameters.AddWithValue("$position", position);
            insertSolve.Parameters.AddWithValue("$points", points);
            insertSolve.Parameters.AddWithValue("$attempts", attemptsUsed + 1);
            insertSolve.Parameters.AddWithValue("$solved", solvedAt);
            insertSolve.ExecuteNonQuery();
            var pointsLabel = points == 1 ? "punto" : "puntos";
            if (completesDay)
            {
                var total = SumPlayerPoints(conn, tx, normalizedEmail, date);
                message = $"¡Correcto! Cerraste las dos rondas y el día suma {total} puntos.";
            }
            else if (hints > 0)
            {
                message = points == 1
                    ? "¡Correcto! Sumaste 1 punto, el mínimo."
                    : $"¡Correcto! Sumaste {points} {pointsLabel} (10 menos {hints} por {(hints == 1 ? "la pista" : "las pistas")}).";
            }
            else if (daySlots.Count == 2)
            {
                message = $"¡Correcto! Sumaste {points} puntos. Si cerrás la otra sin pistas, el día suma 25.";
            }
            else
            {
                message = $"¡Correcto! Sumaste {points} {pointsLabel}.";
            }
        }

        tx.Commit();
        return new DailyCrypticAttemptResult(
            correct,
            message,
            remaining,
            GetStatus(normalizedEmail, nowUtc));
    }

    public IReadOnlyList<object> ListAdminClues()
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, clue, answer, enumeration, definition, wordplay, mechanism,
                   indicator, fodder, parse, difficulty, accepted_answers,
                   author, reviewer, reviewed, active, created_at, updated_at
            FROM daily_cryptic_clues
            ORDER BY active DESC, reviewed DESC, difficulty, id
            """;
        using var reader = cmd.ExecuteReader();
        var items = new List<object>();
        while (reader.Read())
        {
            items.Add(new
            {
                id = reader.GetInt64(0),
                clue = reader.GetString(1),
                answer = reader.GetString(2),
                enumeration = reader.GetString(3),
                definition = reader.GetString(4),
                wordplay = reader.GetString(5),
                mechanism = reader.GetString(6),
                indicator = reader.GetString(7),
                fodder = reader.GetString(8),
                parse = reader.GetString(9),
                difficulty = reader.GetInt32(10),
                acceptedAnswers = ParseAnswers(reader.GetString(11)),
                author = reader.GetString(12),
                reviewer = reader.GetString(13),
                reviewed = reader.GetInt32(14) != 0,
                active = reader.GetInt32(15) != 0,
                createdAt = reader.GetString(16),
                updatedAt = reader.GetString(17),
            });
        }
        return items;
    }

    public long UpsertAdminClue(DailyCrypticAdminRequest request, string actor)
    {
        ValidateAdminClue(request);
        var now = DateTimeOffset.UtcNow.ToString("O");
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        if (request.Id is > 0)
        {
            cmd.CommandText = """
                UPDATE daily_cryptic_clues
                SET clue = $clue, answer = $answer, enumeration = $enumeration,
                    definition = $definition, wordplay = $wordplay, mechanism = $mechanism,
                    indicator = $indicator, fodder = $fodder, parse = $parse,
                    difficulty = $difficulty, accepted_answers = $accepted,
                    reviewer = $reviewer, reviewed = $reviewed, active = $active,
                    updated_at = $updated
                WHERE id = $id
                """;
            cmd.Parameters.AddWithValue("$id", request.Id.Value);
        }
        else
        {
            cmd.CommandText = """
                INSERT INTO daily_cryptic_clues
                    (seed_key, clue, answer, enumeration, definition, wordplay, mechanism,
                     indicator, fodder, parse, difficulty, accepted_answers, author,
                     reviewer, reviewed, active, created_at, updated_at)
                VALUES
                    ($seed, $clue, $answer, $enumeration, $definition, $wordplay, $mechanism,
                     $indicator, $fodder, $parse, $difficulty, $accepted, $author,
                     $reviewer, $reviewed, $active, $created, $updated)
                """;
            cmd.Parameters.AddWithValue("$seed", $"admin:{Guid.NewGuid():N}");
            cmd.Parameters.AddWithValue("$author", actor);
            cmd.Parameters.AddWithValue("$created", now);
        }

        cmd.Parameters.AddWithValue("$clue", request.Clue.Trim());
        cmd.Parameters.AddWithValue("$answer", request.Answer.Trim());
        cmd.Parameters.AddWithValue("$enumeration", request.Enumeration.Trim());
        cmd.Parameters.AddWithValue("$definition", request.Definition.Trim());
        cmd.Parameters.AddWithValue("$wordplay", request.Wordplay.Trim());
        cmd.Parameters.AddWithValue("$mechanism", request.Mechanism.Trim());
        cmd.Parameters.AddWithValue("$indicator", request.Indicator.Trim());
        cmd.Parameters.AddWithValue("$fodder", request.Fodder.Trim());
        cmd.Parameters.AddWithValue("$parse", request.Parse.Trim());
        cmd.Parameters.AddWithValue("$difficulty", Math.Clamp(request.Difficulty, 1, 3));
        cmd.Parameters.AddWithValue("$accepted", JsonSerializer.Serialize(request.AcceptedAnswers ?? []));
        cmd.Parameters.AddWithValue("$reviewer", request.Reviewed ? actor : "");
        cmd.Parameters.AddWithValue("$reviewed", request.Reviewed ? 1 : 0);
        cmd.Parameters.AddWithValue("$active", request.Active ? 1 : 0);
        cmd.Parameters.AddWithValue("$updated", now);
        var changed = cmd.ExecuteNonQuery();
        if (changed == 0)
            throw new InvalidOperationException("No se encontró la pista.");

        if (request.Id is > 0)
            return request.Id.Value;

        using var idCmd = conn.CreateCommand();
        idCmd.CommandText = "SELECT last_insert_rowid()";
        return (long)(idCmd.ExecuteScalar() ?? 0L);
    }

    private static string NormalizePlayer(string player)
    {
        if (CrypticGuestIdentity.IsPlayer(player))
            return player;
        return PlanUserIdentity.ValidateAndNormalize(player)
            ?? throw new ArgumentException("Correo inválido.", nameof(player));
    }

    private readonly record struct CompetitionWindow(DateOnly Date, bool Overnight, bool Closed);

    private readonly record struct PlayerWindow(DateOnly Date, bool Overnight, bool Closed, bool ForceOpen);

    private static PlayerWindow ResolveForPlayer(DateTimeOffset localNow, string email)
    {
        var window = ResolveCompetition(localNow);
        if (!St2SuperAdmin.Is(email) || !window.Closed)
            return new PlayerWindow(window.Date, window.Overnight, window.Closed, false);

        var next = window.Date;
        while (!IsPlayDay(next))
            next = next.AddDays(1);
        return new PlayerWindow(next, Overnight: false, Closed: false, ForceOpen: true);
    }

    private static bool IsPlayDay(DateOnly date) =>
        date.DayOfWeek is >= DayOfWeek.Monday and <= DayOfWeek.Friday
        && !ArgentinaHolidays.IsHoliday(date);

    private static CompetitionWindow ResolveCompetition(DateTimeOffset localNow)
    {
        var date = DateOnly.FromDateTime(localNow.DateTime);
        if (MinuteOf(localNow) < SlotMinute(MorningSlot))
        {
            var previous = date.AddDays(-1);
            if (IsPlayDay(previous))
                return new CompetitionWindow(previous, Overnight: true, Closed: false);
            return new CompetitionWindow(date, Overnight: false, Closed: true);
        }

        if (!IsPlayDay(date))
            return new CompetitionWindow(date, Overnight: false, Closed: true);
        return new CompetitionWindow(date, Overnight: false, Closed: false);
    }

    private static DateTimeOffset NextOpen(DateTimeOffset localNow, PlayerWindow window, IReadOnlyList<int> daySlots)
    {
        if (window.Closed)
        {
            var openOn = window.Date;
            if (!IsPlayDay(openOn))
            {
                openOn = openOn.AddDays(1);
                while (!IsPlayDay(openOn))
                    openOn = openOn.AddDays(1);
            }

            return new DateTimeOffset(openOn.ToDateTime(TimeOnly.MinValue).AddMinutes(MorningSlot), TimeSpan.FromHours(-3));
        }

        var minute = MinuteOf(localNow);
        var nextSlot = window.Overnight ? 0 : daySlots.FirstOrDefault(slot => minute < SlotMinute(slot));
        var boundary = nextSlot > 0
            ? localNow.Date.AddMinutes(SlotMinute(nextSlot))
            : localNow.Date.AddDays(window.Overnight ? 0 : 1).AddMinutes(SlotMinute(MorningSlot));
        return new DateTimeOffset(boundary, TimeSpan.FromHours(-3));
    }

    private IReadOnlyList<DailyCrypticRoundDto> LoadRounds(
        SqliteConnection conn,
        string email,
        DateOnly date,
        DateTimeOffset localNow,
        bool overnight,
        IReadOnlyList<int> daySlots,
        bool forceOpen = false)
    {
        var rounds = new List<DailyCrypticRoundDto>(daySlots.Count);
        var minute = MinuteOf(localNow);
        foreach (var slot in daySlots)
        {
            var clue = LoadScheduledClue(conn, null, date, slot)
                ?? throw new InvalidOperationException("Falta la pista programada.");
            var solve = LoadSolve(conn, null, email, date, slot);
            var attempts = CountAttempts(conn, null, email, date, slot);
            var opened = forceOpen || overnight || minute >= SlotMinute(slot);
            var state = solve is not null
                ? "solved"
                : !opened
                    ? "upcoming"
                    : attempts >= MaxAttempts
                        ? "failed"
                        : "available";

            var revealClue = state is "available" or "solved" or "failed";
            var revealSolution = state == "solved";
            var hintMask = LoadHintMask(conn, null, email, date, slot);
            var showDefinition = revealSolution || (hintMask & HintDefinition) != 0;
            var showMechanism = revealSolution || (hintMask & (HintMechanism | HintIndicator)) != 0;
            var showIndicator = revealSolution || (hintMask & HintIndicator) != 0;
            var showFodder = revealSolution || (hintMask & HintFodder) != 0;
            rounds.Add(new DailyCrypticRoundDto(
                slot,
                SlotLabel(slot),
                state,
                revealClue ? clue.Clue : null,
                revealClue ? clue.Enumeration : null,
                clue.Difficulty,
                attempts,
                Math.Max(0, MaxAttempts - attempts),
                solve?.Position,
                solve?.Points,
                solve?.SolvedAt,
                revealSolution ? clue.Answer : null,
                showDefinition ? clue.Definition : null,
                showMechanism ? clue.Mechanism : null,
                showIndicator ? clue.Indicator : null,
                showFodder ? clue.Fodder : null,
                revealSolution ? clue.Parse : null,
                PopCount(hintMask),
                hintMask,
                RevealedLetters(
                    clue.Answer,
                    RevealedLetterCount(hintMask),
                    $"{DateKey(date)}|{slot}|{email}")));
        }
        return rounds;
    }

    private IReadOnlyList<DailyCrypticRankingDto> LoadRanking(
        SqliteConnection conn,
        DateOnly from,
        DateOnly to,
        bool includeBonus = false)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT email, SUM(points) AS total_points, COUNT(*) AS solved,
                   SUM(CASE WHEN position = 1 THEN 1 ELSE 0 END) AS wins,
                   MIN(solved_at) AS first_solve
            FROM daily_cryptic_solves
            WHERE play_date >= $from AND play_date < $to
              AND email != $owner
              AND email NOT LIKE 'guest:%'
            GROUP BY email
            ORDER BY total_points DESC, wins DESC, solved DESC, first_solve ASC
            LIMIT 50
            """;
        cmd.Parameters.AddWithValue("$from", DateKey(from));
        cmd.Parameters.AddWithValue("$to", DateKey(to));
        cmd.Parameters.AddWithValue("$owner", St2SuperAdmin.PrimaryEmail);
        using var reader = cmd.ExecuteReader();
        var rows = new List<(string Email, int Points, int Solved, int Wins, string First)>();
        while (reader.Read())
        {
            rows.Add((
                reader.GetString(0),
                reader.GetInt32(1),
                reader.GetInt32(2),
                reader.GetInt32(3),
                reader.IsDBNull(4) ? "" : reader.GetString(4)));
        }

        if (includeBonus)
            ApplyRankingBonus(conn, rows, from, to);

        rows.Sort(static (a, b) =>
        {
            var points = b.Points.CompareTo(a.Points);
            if (points != 0) return points;
            var wins = b.Wins.CompareTo(a.Wins);
            if (wins != 0) return wins;
            var solved = b.Solved.CompareTo(a.Solved);
            if (solved != 0) return solved;
            return string.Compare(a.First, b.First, StringComparison.Ordinal);
        });

        var ranking = new List<DailyCrypticRankingDto>(Math.Min(50, rows.Count));
        for (var i = 0; i < rows.Count && ranking.Count < 50; i++)
        {
            var row = rows[i];
            ranking.Add(new DailyCrypticRankingDto(
                ranking.Count + 1,
                ResolvePlayerName(row.Email),
                row.Points,
                row.Solved,
                row.Wins));
        }
        return ranking;
    }

    private void ApplyRankingBonus(
        SqliteConnection conn,
        List<(string Email, int Points, int Solved, int Wins, string First)> rows,
        DateOnly from,
        DateOnly to)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT email, points, season_from, season_to FROM daily_cryptic_bonus";
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            var seasonFrom = reader.IsDBNull(2) ? "" : reader.GetString(2);
            var seasonTo = reader.IsDBNull(3) ? "" : reader.GetString(3);
            if (!string.Equals(seasonFrom, DateKey(from), StringComparison.Ordinal)
                || !string.Equals(seasonTo, DateKey(to), StringComparison.Ordinal))
                continue;

            var email = reader.GetString(0);
            var extra = reader.GetInt32(1);
            var index = rows.FindIndex(row => string.Equals(row.Email, email, StringComparison.OrdinalIgnoreCase));
            if (index >= 0)
            {
                var row = rows[index];
                rows[index] = (row.Email, row.Points + extra, row.Solved, row.Wins, row.First);
                continue;
            }

            rows.Add((email, extra, 0, 0, ""));
        }
    }

    private string ResolvePlayerName(string email)
    {
        var record = _accessRepo.Find(email);
        if (!string.IsNullOrWhiteSpace(record?.DisplayName))
            return record.DisplayName.Trim();

        var local = email.Split('@')[0];
        return CultureInfo.GetCultureInfo("es-AR").TextInfo.ToTitleCase(local.Replace('.', ' '));
    }

    private void EnsureSchedule(DateOnly date)
    {
        using var conn = Open();
        using var tx = conn.BeginTransaction(deferred: false);
        if (KeepOrMigrateSchedule(conn, tx, date))
        {
            tx.Commit();
            return;
        }

        if (date >= DailyCrypticSeed.ProgressiveStartsOn && TryScheduleProgressive(conn, tx, date))
        {
            tx.Commit();
            return;
        }

        var selected = new HashSet<long>();
        var difficulties = DifficultiesFor(date);
        foreach (var (slot, difficulty) in new[] { (MorningSlot, difficulties.Morning), (AfternoonSlot, difficulties.Afternoon) })
        {
            InsertScheduledClue(conn, tx, date, slot, difficulty, selected);
        }
        tx.Commit();
    }

    private bool KeepOrMigrateSchedule(SqliteConnection conn, SqliteTransaction tx, DateOnly date)
    {
        var slots = ReadScheduledSlots(conn, tx, date);
        if (slots.Count == 0)
            return false;
        if (slots.Count == Slots.Length && Slots.All(slots.Contains))
        {
            RepairReusedProgressiveSlots(conn, tx, date);
            return true;
        }
        if (slots.Any(slot => slot >= 24))
            return true;

        var solvedSlots = ReadSolvedSlots(conn, tx, date);
        if (solvedSlots.Any(slot => slot != 8))
            return true;

        foreach (var table in new[] { "daily_cryptic_schedule", "daily_cryptic_solves", "daily_cryptic_attempts", "daily_cryptic_hints" })
        {
            using var remap = conn.CreateCommand();
            remap.Transaction = tx;
            remap.CommandText = $"""
                UPDATE {table}
                SET slot_hour = $next
                WHERE play_date = $date AND slot_hour = 8
                """;
            remap.Parameters.AddWithValue("$next", MorningSlot);
            remap.Parameters.AddWithValue("$date", DateKey(date));
            remap.ExecuteNonQuery();

            using var drop = conn.CreateCommand();
            drop.Transaction = tx;
            drop.CommandText = $"""
                DELETE FROM {table}
                WHERE play_date = $date AND slot_hour IN (12, 16)
                """;
            drop.Parameters.AddWithValue("$date", DateKey(date));
            drop.ExecuteNonQuery();
        }

        if (!ReadScheduledSlots(conn, tx, date).Contains(AfternoonSlot))
        {
            InsertScheduledClue(
                conn,
                tx,
                date,
                AfternoonSlot,
                DifficultiesFor(date).Afternoon,
                new HashSet<long>());
        }
        return true;
    }

    private static bool TryScheduleProgressive(SqliteConnection conn, SqliteTransaction tx, DateOnly date)
    {
        var queue = LoadProgressiveQueue(conn, tx);
        if (queue.Count == 0)
            return false;

        // Siguiente par libre de la cola (no el índice por día): si entra un feriado
        // a mitad de camino, no reusa las pistas ya jugadas.
        var available = NextUnusedProgressive(conn, tx, queue, excludeDate: null);
        if (available.Count < 2)
            return false;

        InsertFixedClue(conn, tx, date, MorningSlot, available[0]);
        InsertFixedClue(conn, tx, date, AfternoonSlot, available[1]);
        return true;
    }

    private static void RepairReusedProgressiveSlots(
        SqliteConnection conn,
        SqliteTransaction tx,
        DateOnly date)
    {
        var queue = LoadProgressiveQueue(conn, tx);
        if (queue.Count == 0)
            return;

        foreach (var slot in Slots)
        {
            var clueId = LoadScheduledClueId(conn, tx, date, slot);
            if (clueId is null)
                continue;
            if (!ClueScheduledBefore(conn, tx, date, clueId.Value))
                continue;
            if (CountSolvesForSlot(conn, tx, date, slot) > 0)
                continue;

            // Incluye la otra ronda de hoy para no clonar el mismo par en el día.
            var available = NextUnusedProgressive(conn, tx, queue, excludeDate: null)
                .Where(id => id != clueId.Value)
                .ToList();
            if (available.Count == 0)
                return;

            UpdateScheduledClue(conn, tx, date, slot, available[0]);
        }
    }

    private static List<long> NextUnusedProgressive(
        SqliteConnection conn,
        SqliteTransaction tx,
        IReadOnlyList<long> queue,
        DateOnly? excludeDate)
    {
        var taken = LoadScheduledClueIds(conn, tx, excludeDate);
        return queue.Where(id => !taken.Contains(id)).ToList();
    }

    private static HashSet<long> LoadScheduledClueIds(
        SqliteConnection conn,
        SqliteTransaction tx,
        DateOnly? excludeDate)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = excludeDate is null
            ? "SELECT clue_id FROM daily_cryptic_schedule"
            : "SELECT clue_id FROM daily_cryptic_schedule WHERE play_date != $date";
        if (excludeDate is not null)
            cmd.Parameters.AddWithValue("$date", DateKey(excludeDate.Value));

        var ids = new HashSet<long>();
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
            ids.Add(reader.GetInt64(0));
        return ids;
    }

    private static long? LoadScheduledClueId(
        SqliteConnection conn,
        SqliteTransaction tx,
        DateOnly date,
        int slot)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            SELECT clue_id FROM daily_cryptic_schedule
            WHERE play_date = $date AND slot_hour = $slot
            """;
        cmd.Parameters.AddWithValue("$date", DateKey(date));
        cmd.Parameters.AddWithValue("$slot", slot);
        var value = cmd.ExecuteScalar();
        return value is long id ? id : value is int small ? small : null;
    }

    private static bool ClueScheduledBefore(
        SqliteConnection conn,
        SqliteTransaction tx,
        DateOnly date,
        long clueId)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            SELECT 1 FROM daily_cryptic_schedule
            WHERE clue_id = $clue AND play_date < $date
            LIMIT 1
            """;
        cmd.Parameters.AddWithValue("$clue", clueId);
        cmd.Parameters.AddWithValue("$date", DateKey(date));
        return cmd.ExecuteScalar() is not null;
    }

    private static int CountSolvesForSlot(
        SqliteConnection conn,
        SqliteTransaction tx,
        DateOnly date,
        int slot)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            SELECT COUNT(*) FROM daily_cryptic_solves
            WHERE play_date = $date AND slot_hour = $slot
            """;
        cmd.Parameters.AddWithValue("$date", DateKey(date));
        cmd.Parameters.AddWithValue("$slot", slot);
        return Convert.ToInt32(cmd.ExecuteScalar(), CultureInfo.InvariantCulture);
    }

    private static void UpdateScheduledClue(
        SqliteConnection conn,
        SqliteTransaction tx,
        DateOnly date,
        int slot,
        long clueId)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            UPDATE daily_cryptic_schedule
            SET clue_id = $clue
            WHERE play_date = $date AND slot_hour = $slot
            """;
        cmd.Parameters.AddWithValue("$clue", clueId);
        cmd.Parameters.AddWithValue("$date", DateKey(date));
        cmd.Parameters.AddWithValue("$slot", slot);
        cmd.ExecuteNonQuery();
    }

    private static List<long> LoadProgressiveQueue(SqliteConnection conn, SqliteTransaction tx)
    {
        var keys = DailyCrypticSeed.Items
            .Skip(DailyCrypticSeed.ProgressiveFrom)
            .Select(item => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{item.Clue}\n{item.Answer}"))).ToLowerInvariant())
            .ToList();
        if (keys.Count == 0)
            return [];

        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        var names = keys.Select((_, index) => $"$k{index}").ToArray();
        cmd.CommandText = $"""
            SELECT seed_key, id
            FROM daily_cryptic_clues
            WHERE seed_key IN ({string.Join(", ", names)})
            """;
        for (var index = 0; index < keys.Count; index++)
            cmd.Parameters.AddWithValue(names[index], keys[index]);

        var byKey = new Dictionary<string, long>(StringComparer.Ordinal);
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
            byKey[reader.GetString(0)] = reader.GetInt64(1);

        var ordered = keys.Select(key => byKey.TryGetValue(key, out var id) ? id : 0L).Where(id => id > 0).ToList();
        return MixFreshClues(ordered);
    }

    /// <summary>
    /// Las pistas nuevas entran desde el 19/11/2026, intercaladas con las que ya quedaban en la cola.
    /// Lo ya sorteado antes de esa fecha no se mueve.
    /// </summary>
    private static List<long> MixFreshClues(List<long> ordered)
    {
        var freshCount = DailyCrypticSeed.FreshCount;
        if (ordered.Count <= freshCount)
            return ordered;

        var prior = ordered.Take(ordered.Count - freshCount).ToList();
        var fresh = ordered.Skip(ordered.Count - freshCount).ToList();
        var reserved = PlayDaysBetween(DailyCrypticSeed.ProgressiveStartsOn, DailyCrypticSeed.FreshStartsOn) * 2;
        var cut = Math.Min(reserved, prior.Count);
        var mixed = prior.Take(cut).ToList();
        var tail = prior.Skip(cut).ToList();
        var index = 0;
        while (index < fresh.Count || index < tail.Count)
        {
            if (index < fresh.Count)
                mixed.Add(fresh[index]);
            if (index < tail.Count)
                mixed.Add(tail[index]);
            index++;
        }
        return mixed;
    }

    private static int PlayDaysBetween(DateOnly from, DateOnly to)
    {
        var count = 0;
        for (var day = from; day < to; day = day.AddDays(1))
        {
            if (IsPlayDay(day))
                count++;
        }
        return count;
    }

    private static void InsertFixedClue(
        SqliteConnection conn,
        SqliteTransaction tx,
        DateOnly date,
        int slot,
        long clueId)
    {
        using var insert = conn.CreateCommand();
        insert.Transaction = tx;
        insert.CommandText = """
            INSERT OR IGNORE INTO daily_cryptic_schedule (play_date, slot_hour, clue_id, created_at)
            VALUES ($date, $slot, $clue, $created)
            """;
        insert.Parameters.AddWithValue("$date", DateKey(date));
        insert.Parameters.AddWithValue("$slot", slot);
        insert.Parameters.AddWithValue("$clue", clueId);
        insert.Parameters.AddWithValue("$created", DateTimeOffset.UtcNow.ToString("O"));
        insert.ExecuteNonQuery();
    }

    private static List<long> LoadCandidateIds(
        SqliteConnection conn,
        SqliteTransaction tx,
        DateOnly date,
        int difficulty)
    {
        var reserved = LoadProgressiveQueue(conn, tx);
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            SELECT id
            FROM daily_cryptic_clues
            WHERE active = 1 AND reviewed = 1 AND difficulty = $difficulty
              AND mechanism != 'Charada'
              AND id NOT IN (
                  SELECT clue_id FROM daily_cryptic_schedule
                  WHERE play_date >= $since AND play_date < $date
              )
            ORDER BY id
            """;
        cmd.Parameters.AddWithValue("$difficulty", difficulty);
        cmd.Parameters.AddWithValue("$since", DateKey(date.AddDays(-30)));
        cmd.Parameters.AddWithValue("$date", DateKey(date));
        using var reader = cmd.ExecuteReader();
        var ids = new List<long>();
        while (reader.Read())
        {
            var id = reader.GetInt64(0);
            if (!reserved.Contains(id))
                ids.Add(id);
        }
        return ids;
    }

    private static List<long> LoadAllActiveIds(SqliteConnection conn, SqliteTransaction tx, int difficulty)
    {
        var reserved = LoadProgressiveQueue(conn, tx);
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            SELECT id FROM daily_cryptic_clues
            WHERE active = 1 AND reviewed = 1 AND difficulty = $difficulty
              AND mechanism != 'Charada'
            ORDER BY id
            """;
        cmd.Parameters.AddWithValue("$difficulty", difficulty);
        using var reader = cmd.ExecuteReader();
        var ids = new List<long>();
        while (reader.Read())
        {
            var id = reader.GetInt64(0);
            if (!reserved.Contains(id))
                ids.Add(id);
        }
        return ids;
    }

    private static ScheduledClue? LoadScheduledClue(
        SqliteConnection conn,
        SqliteTransaction? tx,
        DateOnly date,
        int slot)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            SELECT c.id, c.clue, c.answer, c.enumeration, c.definition, c.wordplay,
                   c.mechanism, c.indicator, c.fodder, c.parse, c.difficulty,
                   c.accepted_answers
            FROM daily_cryptic_schedule s
            JOIN daily_cryptic_clues c ON c.id = s.clue_id
            WHERE s.play_date = $date AND s.slot_hour = $slot
            """;
        cmd.Parameters.AddWithValue("$date", DateKey(date));
        cmd.Parameters.AddWithValue("$slot", slot);
        using var reader = cmd.ExecuteReader();
        if (!reader.Read())
            return null;
        return new ScheduledClue(
            reader.GetInt64(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4),
            reader.GetString(5),
            reader.GetString(6),
            reader.GetString(7),
            reader.GetString(8),
            reader.GetString(9),
            reader.GetInt32(10),
            ParseAnswers(reader.GetString(11)));
    }

    private static SolveRecord? LoadSolve(
        SqliteConnection conn,
        SqliteTransaction? tx,
        string email,
        DateOnly date,
        int slot)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            SELECT position, points, attempt_count, solved_at
            FROM daily_cryptic_solves
            WHERE play_date = $date AND slot_hour = $slot AND email = $email
            """;
        cmd.Parameters.AddWithValue("$date", DateKey(date));
        cmd.Parameters.AddWithValue("$slot", slot);
        cmd.Parameters.AddWithValue("$email", email);
        using var reader = cmd.ExecuteReader();
        return reader.Read()
            ? new SolveRecord(reader.GetInt32(0), reader.GetInt32(1), reader.GetInt32(2), reader.GetString(3))
            : null;
    }

    private static int CountAttempts(
        SqliteConnection conn,
        SqliteTransaction? tx,
        string email,
        DateOnly date,
        int slot)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            SELECT COUNT(*) FROM daily_cryptic_attempts
            WHERE play_date = $date AND slot_hour = $slot AND email = $email
            """;
        cmd.Parameters.AddWithValue("$date", DateKey(date));
        cmd.Parameters.AddWithValue("$slot", slot);
        cmd.Parameters.AddWithValue("$email", email);
        return Convert.ToInt32(cmd.ExecuteScalar(), CultureInfo.InvariantCulture);
    }

    private static int CountHints(
        SqliteConnection conn,
        SqliteTransaction? tx,
        string email,
        DateOnly date,
        int slot) =>
        HintCost(LoadHintMask(conn, tx, email, date, slot));

    private static int LoadHintMask(
        SqliteConnection conn,
        SqliteTransaction? tx,
        string email,
        DateOnly date,
        int slot)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            SELECT level, kinds FROM daily_cryptic_hints
            WHERE play_date = $date AND slot_hour = $slot AND email = $email
            """;
        cmd.Parameters.AddWithValue("$date", DateKey(date));
        cmd.Parameters.AddWithValue("$slot", slot);
        cmd.Parameters.AddWithValue("$email", email);
        using var reader = cmd.ExecuteReader();
        if (!reader.Read())
            return 0;

        var level = reader.GetInt32(0);
        var kinds = reader.GetInt32(1);
        return kinds > 0 ? kinds : LegacyHintMask(level);
    }

    private static int LegacyHintMask(int level) => level switch
    {
        <= 0 => 0,
        1 => HintDefinition,
        2 => HintDefinition | HintMechanism,
        3 => HintDefinition | HintMechanism | HintIndicator,
        _ => HintDefinition | HintMechanism | HintIndicator | HintFodder,
    };

    private static int NormalizeHintKind(string? kind) => kind?.Trim().ToLowerInvariant() switch
    {
        "definition" or "definicion" => HintDefinition,
        "mechanism" or "mecanismo" => HintMechanism,
        "indicator" or "indicador" => HintIndicator,
        "fodder" or "material" => HintFodder,
        "letters" or "letras" or "almost" => HintAlmost,
        _ => throw new ArgumentException("Elegí un tipo de pista."),
    };

    private static int LetterCountOf(string? answer) =>
        (answer ?? "").Count(ch => !char.IsWhiteSpace(ch));

    private static int RevealedLetterCount(int mask) => (mask >> 5) & 31;

    private static string? RevealedLetters(string? answer, int count, string seed)
    {
        if (count <= 0)
            return null;
        var letters = new string((answer ?? "").Where(ch => !char.IsWhiteSpace(ch)).ToArray());
        var take = Math.Min(count, Math.Max(0, letters.Length - 1));
        if (take <= 0)
            return null;

        var order = Enumerable.Range(0, letters.Length).ToArray();
        var rng = new Random(StableSeed(seed));
        for (var i = order.Length - 1; i > 0; i--)
        {
            var j = rng.Next(i + 1);
            (order[i], order[j]) = (order[j], order[i]);
        }

        var chars = new char[letters.Length];
        Array.Fill(chars, '_');
        for (var i = 0; i < take; i++)
            chars[order[i]] = letters[order[i]];
        return new string(chars);
    }

    private static int StableSeed(string text)
    {
        unchecked
        {
            var hash = 2166136261u;
            foreach (var ch in text)
            {
                hash ^= ch;
                hash *= 16777619u;
            }
            return (int)hash;
        }
    }

    private static int HintCost(int mask) =>
        PopCount(mask & 15) + RevealedLetterCount(mask);

    private static int PopCount(int mask)
    {
        var count = 0;
        var bits = mask;
        while (bits != 0)
        {
            count += bits & 1;
            bits >>= 1;
        }
        return count;
    }

    private static int CountSolves(SqliteConnection conn, SqliteTransaction tx, DateOnly date, int slot)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            SELECT COUNT(*) FROM daily_cryptic_solves
            WHERE play_date = $date AND slot_hour = $slot
              AND email NOT LIKE 'guest:%'
            """;
        cmd.Parameters.AddWithValue("$date", DateKey(date));
        cmd.Parameters.AddWithValue("$slot", slot);
        return Convert.ToInt32(cmd.ExecuteScalar(), CultureInfo.InvariantCulture);
    }

    private void EnsureSchema()
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS daily_cryptic_clues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                seed_key TEXT NOT NULL UNIQUE,
                clue TEXT NOT NULL,
                answer TEXT NOT NULL,
                enumeration TEXT NOT NULL,
                definition TEXT NOT NULL,
                wordplay TEXT NOT NULL,
                mechanism TEXT NOT NULL,
                indicator TEXT NOT NULL,
                fodder TEXT NOT NULL,
                parse TEXT NOT NULL,
                difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
                accepted_answers TEXT NOT NULL DEFAULT '[]',
                author TEXT NOT NULL DEFAULT 'ST2',
                reviewer TEXT NOT NULL DEFAULT '',
                reviewed INTEGER NOT NULL DEFAULT 0,
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS daily_cryptic_schedule (
                play_date TEXT NOT NULL,
                slot_hour INTEGER NOT NULL,
                clue_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (play_date, slot_hour)
            );

            CREATE TABLE IF NOT EXISTS daily_cryptic_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                play_date TEXT NOT NULL,
                slot_hour INTEGER NOT NULL,
                clue_id INTEGER NOT NULL,
                email TEXT NOT NULL,
                submitted_answer TEXT NOT NULL,
                correct INTEGER NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS daily_cryptic_solves (
                play_date TEXT NOT NULL,
                slot_hour INTEGER NOT NULL,
                clue_id INTEGER NOT NULL,
                email TEXT NOT NULL,
                position INTEGER NOT NULL,
                points INTEGER NOT NULL,
                attempt_count INTEGER NOT NULL,
                solved_at TEXT NOT NULL,
                PRIMARY KEY (play_date, slot_hour, email)
            );

            CREATE INDEX IF NOT EXISTS ix_daily_cryptic_attempts_player
                ON daily_cryptic_attempts (play_date, slot_hour, email);
            CREATE INDEX IF NOT EXISTS ix_daily_cryptic_solves_ranking
                ON daily_cryptic_solves (play_date, points DESC, solved_at);

            CREATE TABLE IF NOT EXISTS daily_cryptic_hints (
                play_date TEXT NOT NULL,
                slot_hour INTEGER NOT NULL,
                email TEXT NOT NULL,
                level INTEGER NOT NULL,
                kinds INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (play_date, slot_hour, email)
            );
            """;
        cmd.ExecuteNonQuery();
        EnsureHintKindsColumn(conn);
        EnsureRankingBonus(conn);
    }

    private void EnsureRankingBonus(SqliteConnection conn)
    {
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = """
                CREATE TABLE IF NOT EXISTS daily_cryptic_bonus (
                    email TEXT PRIMARY KEY,
                    points INTEGER NOT NULL,
                    note TEXT NOT NULL
                );
                """;
            cmd.ExecuteNonQuery();
        }

        EnsureBonusColumn(conn, "season_from", "TEXT NOT NULL DEFAULT ''");
        EnsureBonusColumn(conn, "season_to", "TEXT NOT NULL DEFAULT ''");

        const string email = "yohanaelizabeth.orellana@thomsonreuters.com";
        const string fixedNote = "Fijado 392";
        const int fixedTotal = 392;

        var now = ToLocal(DateTimeOffset.UtcNow);
        var yearStart = new DateOnly(now.Year, 1, 1);
        var yearEnd = new DateOnly(now.Year + 1, 1, 1);
        using var earnedCmd = conn.CreateCommand();
        earnedCmd.CommandText = """
            SELECT COALESCE(SUM(points), 0)
            FROM daily_cryptic_solves
            WHERE lower(email) = lower($email)
              AND play_date >= $from AND play_date < $to
            """;
        earnedCmd.Parameters.AddWithValue("$email", email);
        earnedCmd.Parameters.AddWithValue("$from", DateKey(yearStart));
        earnedCmd.Parameters.AddWithValue("$to", DateKey(yearEnd));
        var earned = Convert.ToInt32(earnedCmd.ExecuteScalar(), CultureInfo.InvariantCulture);
        // Bonus = tope fijo menos lo ya ganado en el año, para que el total no se mueva al jugar.
        var bonus = Math.Max(0, fixedTotal - earned);

        using var upsert = conn.CreateCommand();
        upsert.CommandText = """
            INSERT INTO daily_cryptic_bonus (email, points, note, season_from, season_to)
            VALUES ($email, $points, $note, $from, $to)
            ON CONFLICT(email) DO UPDATE SET
                points = excluded.points,
                note = excluded.note,
                season_from = excluded.season_from,
                season_to = excluded.season_to
            """;
        upsert.Parameters.AddWithValue("$email", email);
        upsert.Parameters.AddWithValue("$points", bonus);
        upsert.Parameters.AddWithValue("$note", fixedNote);
        upsert.Parameters.AddWithValue("$from", DateKey(yearStart));
        upsert.Parameters.AddWithValue("$to", DateKey(yearEnd));
        upsert.ExecuteNonQuery();
    }

    private static void EnsureBonusColumn(SqliteConnection conn, string column, string definition)
    {
        using var info = conn.CreateCommand();
        info.CommandText = "PRAGMA table_info(daily_cryptic_bonus)";
        using var reader = info.ExecuteReader();
        while (reader.Read())
        {
            if (string.Equals(reader.GetString(1), column, StringComparison.OrdinalIgnoreCase))
                return;
        }

        using var alter = conn.CreateCommand();
        alter.CommandText = $"ALTER TABLE daily_cryptic_bonus ADD COLUMN {column} {definition}";
        alter.ExecuteNonQuery();
    }

    private static void EnsureHintKindsColumn(SqliteConnection conn)
    {
        using var info = conn.CreateCommand();
        info.CommandText = "PRAGMA table_info(daily_cryptic_hints)";
        using var reader = info.ExecuteReader();
        while (reader.Read())
        {
            if (string.Equals(reader.GetString(1), "kinds", StringComparison.OrdinalIgnoreCase))
                return;
        }

        using var alter = conn.CreateCommand();
        alter.CommandText = "ALTER TABLE daily_cryptic_hints ADD COLUMN kinds INTEGER NOT NULL DEFAULT 0";
        alter.ExecuteNonQuery();
    }

    private void SeedClues()
    {
        var items = DailyCrypticSeed.Items;
        if (items.Count == 0)
            return;

        using var conn = Open();
        using var tx = conn.BeginTransaction();
        var liveKeys = new List<string>(items.Count);
        foreach (var item in items)
        {
            using var cmd = conn.CreateCommand();
            cmd.Transaction = tx;
            var seedKey = Convert.ToHexString(
                SHA256.HashData(Encoding.UTF8.GetBytes($"{item.Clue}\n{item.Answer}")))
                .ToLowerInvariant();
            liveKeys.Add(seedKey);
            var now = DateTimeOffset.UtcNow.ToString("O");
            cmd.CommandText = """
                INSERT INTO daily_cryptic_clues
                    (seed_key, clue, answer, enumeration, definition, wordplay, mechanism,
                     indicator, fodder, parse, difficulty, accepted_answers, author,
                     reviewer, reviewed, active, created_at, updated_at)
                VALUES
                    ($seed, $clue, $answer, $enumeration, $definition, $wordplay, $mechanism,
                     $indicator, $fodder, $parse, $difficulty, $accepted, 'ST2',
                     'ST2 editorial', 1, 1, $created, $updated)
                ON CONFLICT(seed_key) DO UPDATE SET
                    clue = excluded.clue,
                    answer = excluded.answer,
                    enumeration = excluded.enumeration,
                    definition = excluded.definition,
                    wordplay = excluded.wordplay,
                    mechanism = excluded.mechanism,
                    indicator = excluded.indicator,
                    fodder = excluded.fodder,
                    parse = excluded.parse,
                    difficulty = excluded.difficulty,
                    accepted_answers = excluded.accepted_answers,
                    updated_at = excluded.updated_at
                """;
            cmd.Parameters.AddWithValue("$seed", seedKey);
            cmd.Parameters.AddWithValue("$clue", item.Clue);
            cmd.Parameters.AddWithValue("$answer", item.Answer);
            cmd.Parameters.AddWithValue("$enumeration", item.Enumeration);
            cmd.Parameters.AddWithValue("$definition", item.Definition);
            cmd.Parameters.AddWithValue("$wordplay", item.Wordplay);
            cmd.Parameters.AddWithValue("$mechanism", item.Mechanism);
            cmd.Parameters.AddWithValue("$indicator", item.Indicator);
            cmd.Parameters.AddWithValue("$fodder", item.Fodder);
            cmd.Parameters.AddWithValue("$parse", item.Parse);
            cmd.Parameters.AddWithValue("$difficulty", Math.Clamp(item.Difficulty, 1, 3));
            cmd.Parameters.AddWithValue("$accepted", JsonSerializer.Serialize(item.AcceptedAnswers ?? []));
            cmd.Parameters.AddWithValue("$created", now);
            cmd.Parameters.AddWithValue("$updated", now);
            cmd.ExecuteNonQuery();
        }

        using (var retire = conn.CreateCommand())
        {
            retire.Transaction = tx;
            var names = new string[liveKeys.Count];
            for (var index = 0; index < liveKeys.Count; index++)
            {
                names[index] = $"$k{index}";
                retire.Parameters.AddWithValue(names[index], liveKeys[index]);
            }

            retire.Parameters.AddWithValue("$updated", DateTimeOffset.UtcNow.ToString("O"));
            retire.CommandText = $"""
                UPDATE daily_cryptic_clues
                SET active = 0, updated_at = $updated
                WHERE reviewer = 'ST2 editorial'
                  AND seed_key NOT IN ({string.Join(", ", names)})
                """;
            retire.ExecuteNonQuery();
        }

        tx.Commit();
    }

    private SqliteConnection Open()
    {
        var conn = new SqliteConnection($"Data Source={_dbPath};Cache=Shared");
        conn.Open();
        using var pragma = conn.CreateCommand();
        pragma.CommandText = "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;";
        pragma.ExecuteNonQuery();
        return conn;
    }

    private DateTimeOffset ToLocal(DateTimeOffset utc) =>
        TimeZoneInfo.ConvertTime(utc, _argentinaTimeZone);

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
                // Probar el siguiente id.
            }
        }
        return TimeZoneInfo.CreateCustomTimeZone(
            "Argentina",
            TimeSpan.FromHours(-3),
            "Argentina",
            "Argentina");
    }

    private static string NormalizeAnswer(string? value)
    {
        var decomposed = (value ?? "").Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        foreach (var ch in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark)
                continue;
            if (char.IsLetterOrDigit(ch))
                builder.Append(ch);
        }
        return builder.ToString().Normalize(NormalizationForm.FormC);
    }

    private static string[] ParseAnswers(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<string[]>(json) ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static int MinuteOf(DateTimeOffset local) => local.Hour * 60 + local.Minute;

    private static int SlotMinute(int slot) => slot < 24 ? slot * 60 : slot;

    private static string SlotLabel(int slot)
    {
        var minute = SlotMinute(slot);
        return $"{minute / 60:00}:{minute % 60:00}";
    }

    private static (int Morning, int Afternoon) DifficultiesFor(DateOnly date) =>
        date.DayNumber % 2 == 0 ? (2, 3) : (3, 2);

    private static List<int> ReadScheduledSlots(SqliteConnection conn, SqliteTransaction? tx, DateOnly date)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            SELECT slot_hour FROM daily_cryptic_schedule
            WHERE play_date = $date
            ORDER BY slot_hour
            """;
        cmd.Parameters.AddWithValue("$date", DateKey(date));
        using var reader = cmd.ExecuteReader();
        var slots = new List<int>();
        while (reader.Read())
            slots.Add(reader.GetInt32(0));
        return slots;
    }

    private static List<int> ReadSolvedSlots(SqliteConnection conn, SqliteTransaction tx, DateOnly date)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            SELECT DISTINCT slot_hour FROM daily_cryptic_solves
            WHERE play_date = $date
            """;
        cmd.Parameters.AddWithValue("$date", DateKey(date));
        using var reader = cmd.ExecuteReader();
        var slots = new List<int>();
        while (reader.Read())
            slots.Add(reader.GetInt32(0));
        return slots;
    }

    private static int CountPlayerSolves(SqliteConnection conn, SqliteTransaction tx, string email, DateOnly date)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            SELECT COUNT(*) FROM daily_cryptic_solves
            WHERE play_date = $date AND email = $email
            """;
        cmd.Parameters.AddWithValue("$date", DateKey(date));
        cmd.Parameters.AddWithValue("$email", email);
        return Convert.ToInt32(cmd.ExecuteScalar(), CultureInfo.InvariantCulture);
    }

    private static int SumPlayerPoints(SqliteConnection conn, SqliteTransaction tx, string email, DateOnly date)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            SELECT COALESCE(SUM(points), 0) FROM daily_cryptic_solves
            WHERE play_date = $date AND email = $email
            """;
        cmd.Parameters.AddWithValue("$date", DateKey(date));
        cmd.Parameters.AddWithValue("$email", email);
        return Convert.ToInt32(cmd.ExecuteScalar(), CultureInfo.InvariantCulture);
    }

    private static void InsertScheduledClue(
        SqliteConnection conn,
        SqliteTransaction tx,
        DateOnly date,
        int slot,
        int difficulty,
        ISet<long> selected)
    {
        var candidates = LoadCandidateIds(conn, tx, date, difficulty)
            .Where(id => !selected.Contains(id))
            .ToList();
        if (candidates.Count == 0)
            candidates = LoadAllActiveIds(conn, tx, difficulty).Where(id => !selected.Contains(id)).ToList();
        if (candidates.Count == 0)
            throw new InvalidOperationException($"No hay pistas revisadas de dificultad {difficulty}.");

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes($"{date:yyyy-MM-dd}:{slot}:st2"));
        var index = BitConverter.ToUInt32(hash, 0) % (uint)candidates.Count;
        var clueId = candidates[(int)index];
        using var insert = conn.CreateCommand();
        insert.Transaction = tx;
        insert.CommandText = """
            INSERT OR IGNORE INTO daily_cryptic_schedule (play_date, slot_hour, clue_id, created_at)
            VALUES ($date, $slot, $clue, $created)
            """;
        insert.Parameters.AddWithValue("$date", DateKey(date));
        insert.Parameters.AddWithValue("$slot", slot);
        insert.Parameters.AddWithValue("$clue", clueId);
        insert.Parameters.AddWithValue("$created", DateTimeOffset.UtcNow.ToString("O"));
        insert.ExecuteNonQuery();
        selected.Add(clueId);
    }

    private static string DateKey(DateOnly date) =>
        date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private static void ValidateAdminClue(DailyCrypticAdminRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Clue)
            || string.IsNullOrWhiteSpace(request.Answer)
            || string.IsNullOrWhiteSpace(request.Enumeration)
            || string.IsNullOrWhiteSpace(request.Definition)
            || string.IsNullOrWhiteSpace(request.Wordplay)
            || string.IsNullOrWhiteSpace(request.Mechanism)
            || string.IsNullOrWhiteSpace(request.Parse))
        {
            throw new ArgumentException("Completá pista, respuesta, definición, construcción y explicación.");
        }

        var expectedLetters = new string(request.Enumeration.Where(char.IsDigit).ToArray());
        if (int.TryParse(expectedLetters, out var count)
            && NormalizeAnswer(request.Answer).Length != count)
        {
            throw new ArgumentException("La enumeración no coincide con la respuesta.");
        }
    }

    private sealed record ScheduledClue(
        long Id,
        string Clue,
        string Answer,
        string Enumeration,
        string Definition,
        string Wordplay,
        string Mechanism,
        string Indicator,
        string Fodder,
        string Parse,
        int Difficulty,
        string[] AcceptedAnswers);

    private sealed record SolveRecord(int Position, int Points, int AttemptCount, string SolvedAt);
}
