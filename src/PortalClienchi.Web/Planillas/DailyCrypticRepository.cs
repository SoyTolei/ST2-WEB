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
        var normalizedEmail = PlanUserIdentity.ValidateAndNormalize(email)
            ?? throw new ArgumentException("Correo inválido.", nameof(email));
        var localNow = ToLocal(nowUtc ?? DateTimeOffset.UtcNow);
        var window = ResolveCompetition(localNow);
        var date = window.Date;
        if (!window.Closed)
            EnsureSchedule(date);

        using var conn = Open();
        var quarterStart = new DateOnly(date.Year, ((date.Month - 1) / 3) * 3 + 1, 1);
        var season = $"Q{(date.Month - 1) / 3 + 1} {date.Year}";
        var seasonRanking = LoadRanking(conn, quarterStart, quarterStart.AddMonths(3));
        if (window.Closed)
        {
            return new DailyCrypticStatusDto(
                date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                "America/Argentina/Buenos_Aires",
                "weekend",
                NextOpen(localNow, window, []).ToString("O"),
                [],
                [],
                season,
                seasonRanking);
        }

        var daySlots = ReadScheduledSlots(conn, null, date);
        var rounds = LoadRounds(conn, normalizedEmail, date, localNow, window.Overnight, daySlots);
        var ranking = LoadRanking(conn, date, date.AddDays(1));
        var nextAt = NextOpen(localNow, window, daySlots).ToString("O");

        return new DailyCrypticStatusDto(
            date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            "America/Argentina/Buenos_Aires",
            "active",
            nextAt,
            rounds,
            ranking,
            season,
            seasonRanking);
    }

    public int RevealHint(string email, int slot, string? kind, DateTimeOffset? nowUtc = null)
    {
        var normalizedEmail = PlanUserIdentity.ValidateAndNormalize(email)
            ?? throw new ArgumentException("Correo inválido.", nameof(email));
        var localNow = ToLocal(nowUtc ?? DateTimeOffset.UtcNow);
        var window = ResolveCompetition(localNow);
        if (window.Closed)
            throw new InvalidOperationException("El Críptico es de lunes a viernes.");
        var date = window.Date;
        EnsureSchedule(date);
        using var conn = Open();
        var daySlots = ReadScheduledSlots(conn, null, date);
        if (!daySlots.Contains(slot))
            throw new ArgumentException("Ronda inválida.", nameof(slot));
        if (!window.Overnight && MinuteOf(localNow) < SlotMinute(slot))
            throw new InvalidOperationException($"La ronda de las {SlotLabel(slot)} todavía no abrió.");

        using var tx = conn.BeginTransaction(deferred: false);
        if (LoadSolve(conn, tx, normalizedEmail, date, slot) is not null)
            throw new InvalidOperationException("Esta ronda ya está resuelta.");

        foreach (var priorSlot in daySlots.Where(item => SlotMinute(item) < SlotMinute(slot)))
        {
            if (LoadSolve(conn, tx, normalizedEmail, date, priorSlot) is null)
                throw new InvalidOperationException($"Primero resolvé la ronda de las {SlotLabel(priorSlot)}.");
        }

        var bit = NormalizeHintKind(kind);
        var mask = LoadHintMask(conn, tx, normalizedEmail, date, slot);
        if ((mask & bit) == 0 && PopCount(mask) < 4)
            mask |= bit;

        var next = PopCount(mask);
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
        var normalizedEmail = PlanUserIdentity.ValidateAndNormalize(email)
            ?? throw new ArgumentException("Correo inválido.", nameof(email));
        var normalizedAnswer = NormalizeAnswer(submittedAnswer);
        if (normalizedAnswer.Length == 0)
            throw new ArgumentException("Escribí una respuesta.");
        var localNow = ToLocal(nowUtc ?? DateTimeOffset.UtcNow);
        var window = ResolveCompetition(localNow);
        if (window.Closed)
            throw new InvalidOperationException("El Críptico es de lunes a viernes.");
        var date = window.Date;
        EnsureSchedule(date);
        using var conn = Open();
        var daySlots = ReadScheduledSlots(conn, null, date);
        if (!daySlots.Contains(slot))
            throw new ArgumentException("Ronda inválida.", nameof(slot));
        if (!window.Overnight && MinuteOf(localNow) < SlotMinute(slot))
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

        foreach (var priorSlot in daySlots.Where(item => SlotMinute(item) < SlotMinute(slot)))
        {
            if (LoadSolve(conn, tx, normalizedEmail, date, priorSlot) is null)
                throw new InvalidOperationException($"Primero resolvé la ronda de las {SlotLabel(priorSlot)}.");
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
            var roundPoints = Math.Max(0, 10 - hints * 2);
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
                var deducted = hints * 2;
                message = $"¡Correcto! Sumaste {points} {pointsLabel} (10 menos {deducted} por {(hints == 1 ? "la pista" : "las pistas")}).";
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

    private readonly record struct CompetitionWindow(DateOnly Date, bool Overnight, bool Closed);

    private static bool IsPlayDay(DateOnly date) =>
        date.DayOfWeek is >= DayOfWeek.Monday and <= DayOfWeek.Friday;

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

    private static DateTimeOffset NextOpen(DateTimeOffset localNow, CompetitionWindow window, IReadOnlyList<int> daySlots)
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
        IReadOnlyList<int> daySlots)
    {
        var rounds = new List<DailyCrypticRoundDto>(daySlots.Count);
        var priorSolved = true;
        var minute = MinuteOf(localNow);
        foreach (var slot in daySlots)
        {
            var clue = LoadScheduledClue(conn, null, date, slot)
                ?? throw new InvalidOperationException("Falta la pista programada.");
            var solve = LoadSolve(conn, null, email, date, slot);
            var attempts = CountAttempts(conn, null, email, date, slot);
            var opened = overnight || minute >= SlotMinute(slot);
            var state = solve is not null
                ? "solved"
                : !opened
                    ? "upcoming"
                    : !priorSolved
                        ? "blocked"
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
                hintMask));

            priorSolved = priorSolved && solve is not null;
        }
        return rounds;
    }

    private IReadOnlyList<DailyCrypticRankingDto> LoadRanking(SqliteConnection conn, DateOnly from, DateOnly to)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT email, SUM(points) AS total_points, COUNT(*) AS solved,
                   SUM(CASE WHEN position = 1 THEN 1 ELSE 0 END) AS wins,
                   MIN(solved_at) AS first_solve
            FROM daily_cryptic_solves
            WHERE play_date >= $from AND play_date < $to
            GROUP BY email
            ORDER BY total_points DESC, wins DESC, solved DESC, first_solve ASC
            LIMIT 50
            """;
        cmd.Parameters.AddWithValue("$from", DateKey(from));
        cmd.Parameters.AddWithValue("$to", DateKey(to));
        using var reader = cmd.ExecuteReader();
        var ranking = new List<DailyCrypticRankingDto>();
        var rank = 0;
        while (reader.Read())
        {
            rank++;
            var email = reader.GetString(0);
            ranking.Add(new DailyCrypticRankingDto(
                rank,
                ResolvePlayerName(email),
                reader.GetInt32(1),
                reader.GetInt32(2),
                reader.GetInt32(3)));
        }
        return ranking;
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
            return true;
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

    private static List<long> LoadCandidateIds(
        SqliteConnection conn,
        SqliteTransaction tx,
        DateOnly date,
        int difficulty)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            SELECT id
            FROM daily_cryptic_clues
            WHERE active = 1 AND reviewed = 1 AND difficulty = $difficulty
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
            ids.Add(reader.GetInt64(0));
        return ids;
    }

    private static List<long> LoadAllActiveIds(SqliteConnection conn, SqliteTransaction tx, int difficulty)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            SELECT id FROM daily_cryptic_clues
            WHERE active = 1 AND reviewed = 1 AND difficulty = $difficulty
            ORDER BY id
            """;
        cmd.Parameters.AddWithValue("$difficulty", difficulty);
        using var reader = cmd.ExecuteReader();
        var ids = new List<long>();
        while (reader.Read())
            ids.Add(reader.GetInt64(0));
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
        PopCount(LoadHintMask(conn, tx, email, date, slot));

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
        _ => throw new ArgumentException("Elegí un tipo de pista."),
    };

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
        (date.DayNumber % 3) switch
        {
            0 => (1, 2),
            1 => (2, 3),
            _ => (1, 3),
        };

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
