using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Logging.Abstractions;
using PortalClienchi.Web;
using PortalClienchi.Web.Planillas;
using Xunit;

[assembly: CollectionBehavior(DisableTestParallelization = true)]

namespace PortalClienchi.Web.Tests;

public sealed class DailyCrypticRepositoryTests : IDisposable
{
    private const string Email = "prueba.criptico@thomsonreuters.com";
    private readonly string _dataDir;
    private readonly DailyCrypticRepository _repository;

    public DailyCrypticRepositoryTests()
    {
        _dataDir = Path.Combine(Path.GetTempPath(), "st2-cryptic-tests", Guid.NewGuid().ToString("N"));
        Environment.SetEnvironmentVariable("ST2_DATA_DIR", _dataDir);
        var access = new AppAccessRepository(NullLogger<AppAccessRepository>.Instance);
        access.EnsureApproved(Email);
        _repository = new DailyCrypticRepository(
            access,
            NullLogger<DailyCrypticRepository>.Instance);
    }

    [Fact]
    public void Unlocks_rounds_in_order_and_accumulates_ranking()
    {
        var morning = DailyCrypticRepository.MorningSlot;
        var afternoon = DailyCrypticRepository.AfternoonSlot;
        var at1000 = AtArgentina(2026, 10, 23, 10, 0);
        var initial = _repository.GetStatus(Email, at1000);

        Assert.Equal("active", initial.Phase);
        Assert.Equal(2, initial.Rounds.Count);
        Assert.Equal("09:00", initial.Rounds[0].Label);
        Assert.Equal("13:30", initial.Rounds[1].Label);
        Assert.Equal("available", initial.Rounds[0].State);
        Assert.Equal("upcoming", initial.Rounds[1].State);

        var first = _repository.Submit(Email, morning, ScheduledAnswer(initial.Date, morning), at1000);
        Assert.True(first.Correct);
        Assert.Equal(10, first.Status.Rounds[0].Points);
        Assert.Equal("upcoming", first.Status.Rounds[1].State);

        var at1330 = AtArgentina(2026, 10, 23, 13, 30);
        var secondReady = _repository.GetStatus(Email, at1330);
        Assert.Equal("available", secondReady.Rounds[1].State);

        var second = _repository.Submit(Email, afternoon, ScheduledAnswer(initial.Date, afternoon), at1330);
        Assert.True(second.Correct);
        Assert.Equal(30, second.Status.Ranking.Single().Points);
        Assert.Equal(2, second.Status.Ranking.Single().Solved);
    }

    [Fact]
    public void Limits_attempts_and_resets_progress_on_the_next_day()
    {
        var at0900 = AtArgentina(2026, 10, 23, 9, 0);
        for (var attempt = 1; attempt <= DailyCrypticRepository.MaxAttempts; attempt++)
        {
            var result = _repository.Submit(Email, DailyCrypticRepository.MorningSlot, "respuesta-imposible-xyz", at0900);
            Assert.False(result.Correct);
            Assert.Equal(DailyCrypticRepository.MaxAttempts - attempt, result.AttemptsRemaining);
        }

        var failed = _repository.GetStatus(Email, at0900);
        Assert.Equal("failed", failed.Rounds[0].State);
        Assert.Throws<InvalidOperationException>(
            () => _repository.Submit(Email, DailyCrypticRepository.MorningSlot, "otro-intento", at0900));

        var saturday = _repository.GetStatus(Email, AtArgentina(2026, 10, 24, 9, 0));
        Assert.Equal("weekend", saturday.Phase);
        Assert.Empty(saturday.Rounds);

        var nextDay = AtArgentina(2026, 10, 26, 9, 0);
        var reset = _repository.GetStatus(Email, nextDay);
        Assert.Equal("available", reset.Rounds[0].State);
        Assert.Equal(0, reset.Rounds[0].AttemptsUsed);
    }

    [Fact]
    public void Keeps_the_competition_open_through_the_night()
    {
        var evening = AtArgentina(2026, 10, 23, 23, 30);
        var eveningStatus = _repository.GetStatus(Email, evening);
        Assert.Equal("2026-10-23", eveningStatus.Date);
        Assert.Equal("available", eveningStatus.Rounds[0].State);

        var earlyMorning = AtArgentina(2026, 10, 24, 2, 15);
        var overnight = _repository.GetStatus(Email, earlyMorning);
        Assert.Equal("2026-10-23", overnight.Date);
        Assert.Equal("available", overnight.Rounds[0].State);
        Assert.Equal("available", overnight.Rounds[1].State);

        var answer = ScheduledAnswer(overnight.Date, DailyCrypticRepository.MorningSlot);
        var solved = _repository.Submit(Email, DailyCrypticRepository.MorningSlot, answer, earlyMorning);
        Assert.True(solved.Correct);

        var saturdayMorning = _repository.GetStatus(Email, AtArgentina(2026, 10, 24, 9, 0));
        Assert.Equal("weekend", saturdayMorning.Phase);
        Assert.Empty(saturdayMorning.Rounds);
        Assert.StartsWith("2026-10-26T09:00:00", saturdayMorning.NextAt);

        var nextCompetition = _repository.GetStatus(Email, AtArgentina(2026, 10, 26, 9, 0));
        Assert.Equal("2026-10-26", nextCompetition.Date);
        Assert.Equal("available", nextCompetition.Rounds[0].State);
        Assert.Equal(0, nextCompetition.Rounds[0].AttemptsUsed);
    }

    [Fact]
    public void Assigns_points_by_arrival_order()
    {
        const string secondEmail = "otra.persona@thomsonreuters.com";
        var at0900 = AtArgentina(2026, 10, 23, 9, 0);
        var date = _repository.GetStatus(Email, at0900).Date;
        var answer = ScheduledAnswer(date, DailyCrypticRepository.MorningSlot);

        var first = _repository.Submit(Email, DailyCrypticRepository.MorningSlot, answer, at0900);
        var second = _repository.Submit(secondEmail, DailyCrypticRepository.MorningSlot, answer, at0900.AddMinutes(1));

        Assert.Equal(10, first.Status.Rounds[0].Points);
        Assert.Equal(10, second.Status.Rounds[0].Points);
        Assert.Equal([10, 10], second.Status.Ranking.Select(item => item.Points).ToArray());
        Assert.Equal(1, second.Status.Ranking[0].Wins);
    }

    [Fact]
    public void Each_hint_costs_two_ranking_points()
    {
        var at0900 = AtArgentina(2026, 10, 23, 9, 0);
        var date = _repository.GetStatus(Email, at0900).Date;
        var answer = ScheduledAnswer(date, DailyCrypticRepository.MorningSlot);

        Assert.Null(_repository.GetStatus(Email, at0900).Rounds[0].Definition);
        Assert.Equal(1, _repository.RevealHint(Email, DailyCrypticRepository.MorningSlot, "definition", at0900));
        Assert.Equal(2, _repository.RevealHint(Email, DailyCrypticRepository.MorningSlot, "indicator", at0900));
        Assert.Equal(2, _repository.RevealHint(Email, DailyCrypticRepository.MorningSlot, "indicator", at0900));

        var hinted = _repository.GetStatus(Email, at0900);
        Assert.NotNull(hinted.Rounds[0].Definition);
        Assert.NotNull(hinted.Rounds[0].Indicator);
        Assert.Null(hinted.Rounds[0].Fodder);

        var solved = _repository.Submit(Email, DailyCrypticRepository.MorningSlot, answer, at0900);

        Assert.Equal(8, solved.Status.Rounds[0].Points);
        Assert.Equal(2, solved.Status.Rounds[0].HintsUsed);
        Assert.Equal(DailyCrypticRepository.HintDefinition | DailyCrypticRepository.HintIndicator, solved.Status.Rounds[0].HintMask);
        Assert.Equal(8, solved.Status.Ranking[0].Points);
    }

    [Fact]
    public void Hints_on_one_round_drop_the_clean_day_bonus()
    {
        var morning = DailyCrypticRepository.MorningSlot;
        var afternoon = DailyCrypticRepository.AfternoonSlot;
        var at0900 = AtArgentina(2026, 10, 23, 9, 0);
        var date = _repository.GetStatus(Email, at0900).Date;

        Assert.Equal(1, _repository.RevealHint(Email, morning, "definition", at0900));
        var first = _repository.Submit(Email, morning, ScheduledAnswer(date, morning), at0900);
        Assert.Equal(9, first.Status.Rounds[0].Points);

        var at1330 = AtArgentina(2026, 10, 23, 13, 30);
        var second = _repository.Submit(Email, afternoon, ScheduledAnswer(date, afternoon), at1330);

        Assert.True(second.Correct);
        Assert.Equal(10, second.Status.Rounds[1].Points);
        Assert.Equal(19, second.Status.Ranking.Single().Points);
    }

    [Fact]
    public void Weekend_has_no_cryptic_until_monday()
    {
        var saturday = _repository.GetStatus(Email, AtArgentina(2026, 10, 24, 15, 0));
        var sunday = _repository.GetStatus(Email, AtArgentina(2026, 10, 25, 11, 0));
        var mondayEarly = _repository.GetStatus(Email, AtArgentina(2026, 10, 26, 8, 30));

        Assert.Equal("weekend", saturday.Phase);
        Assert.Empty(saturday.Rounds);
        Assert.Equal("weekend", sunday.Phase);
        Assert.Empty(sunday.Rounds);
        Assert.Equal("weekend", mondayEarly.Phase);
        Assert.Empty(mondayEarly.Rounds);
        Assert.Throws<InvalidOperationException>(
            () => _repository.Submit(Email, DailyCrypticRepository.MorningSlot, "algo", AtArgentina(2026, 10, 24, 15, 0)));
    }

    [Fact]
    public void Owner_previews_the_next_weekday_and_stays_out_of_the_ranking()
    {
        const string owner = St2SuperAdmin.PrimaryEmail;
        var sunday = AtArgentina(2026, 10, 25, 22, 0);
        var preview = _repository.GetStatus(owner, sunday);

        Assert.Equal("active", preview.Phase);
        Assert.Equal("2026-10-26", preview.Date);
        Assert.Equal("available", preview.Rounds[0].State);
        Assert.Equal("available", preview.Rounds[1].State);

        var answer = ScheduledAnswer(preview.Date, DailyCrypticRepository.MorningSlot);
        var ownerSolve = _repository.Submit(owner, DailyCrypticRepository.MorningSlot, answer, sunday);
        Assert.True(ownerSolve.Correct);
        Assert.Empty(ownerSolve.Status.Ranking);

        var teammate = _repository.Submit(Email, DailyCrypticRepository.MorningSlot, answer, AtArgentina(2026, 10, 26, 9, 0));
        Assert.Single(teammate.Status.Ranking);
        Assert.DoesNotContain(teammate.Status.Ranking, item => item.Player.Contains("Leonel", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Guest_plays_without_a_ranking_and_does_not_take_first_place()
    {
        const string guest = "guest:0123456789abcdef0123456789abcdef";
        var at = AtArgentina(2026, 10, 23, 10, 0);
        var status = _repository.GetStatus(guest, at);

        Assert.False(status.Ranked);
        Assert.Empty(status.Ranking);
        Assert.Empty(status.SeasonRanking);

        var answer = ScheduledAnswer(status.Date, DailyCrypticRepository.MorningSlot);
        var guestSolve = _repository.Submit(guest, DailyCrypticRepository.MorningSlot, answer, at);
        Assert.True(guestSolve.Correct);
        Assert.False(guestSolve.Status.Ranked);
        Assert.Empty(guestSolve.Status.Ranking);

        var teammate = _repository.Submit(Email, DailyCrypticRepository.MorningSlot, answer, at);
        Assert.True(teammate.Status.Ranked);
        Assert.Equal(1, teammate.Status.Rounds[0].Position);
        Assert.Single(teammate.Status.Ranking);
        Assert.DoesNotContain(teammate.Status.Ranking, item => item.Player.StartsWith("guest", StringComparison.OrdinalIgnoreCase));

        Assert.True(St2AccessMiddleware.IsPublicPath("/api/cryptic/status", "GET"));
        Assert.True(St2AccessMiddleware.IsPublicPath("/api/cryptic/attempt", "POST"));
        Assert.True(St2AccessMiddleware.IsPublicPath("/api/cryptic/hint", "POST"));
        Assert.False(St2AccessMiddleware.IsPublicPath("/api/cryptic/admin/clues", "GET"));
    }

    [Fact]
    public void Letter_hints_fill_random_slots_and_leave_one_hidden()
    {
        var at0900 = AtArgentina(2026, 10, 23, 9, 0);
        var date = _repository.GetStatus(Email, at0900).Date;
        var answer = new string(ScheduledAnswer(date, DailyCrypticRepository.MorningSlot)
            .Where(ch => !char.IsWhiteSpace(ch))
            .ToArray());
        Assert.True(answer.Length > 2);

        for (var i = 0; i < answer.Length - 1; i++)
            Assert.Equal(i + 1, _repository.RevealHint(Email, DailyCrypticRepository.MorningSlot, "letters", at0900));

        var almost = _repository.GetStatus(Email, at0900).Rounds[0].Almost;
        Assert.NotNull(almost);
        Assert.Equal(answer.Length, almost!.Length);
        Assert.Equal(answer.Length - 1, almost.Count(ch => ch != '_'));
        Assert.Contains('_', almost);
        for (var i = 0; i < answer.Length; i++)
        {
            if (almost[i] == '_') continue;
            Assert.Equal(answer[i], almost[i]);
        }

        Assert.Equal(answer.Length - 1, _repository.RevealHint(Email, DailyCrypticRepository.MorningSlot, "letters", at0900));
        Assert.Equal(almost, _repository.GetStatus(Email, at0900).Rounds[0].Almost);
    }

    [Fact]
    public void Progressive_queue_starts_after_today_and_the_afternoon_opens_on_its_own()
    {
        var monday = AtArgentina(2026, 10, 26, 10, 0);
        var today = _repository.GetStatus(Email, monday);
        Assert.NotEqual("Se mira para pedir, llega por correo (5)", today.Rounds[0].Clue);

        var tuesday = AtArgentina(2026, 10, 27, 10, 0);
        var next = _repository.GetStatus(Email, tuesday);
        Assert.Equal("Se mira para pedir, llega por correo (5)", next.Rounds[0].Clue);
        Assert.Equal("upcoming", next.Rounds[1].State);
        Assert.Null(next.Rounds[1].Clue);

        var afternoonOpen = AtArgentina(2026, 10, 27, 13, 30);
        var opened = _repository.GetStatus(Email, afternoonOpen);
        Assert.Equal("available", opened.Rounds[1].State);
        Assert.Equal("Donde vivís: el lodo se traga el uno (6)", opened.Rounds[1].Clue);

        var holiday = _repository.GetStatus(Email, AtArgentina(2026, 11, 23, 10, 0));
        Assert.Equal("holiday", holiday.Phase);
        Assert.Equal("Día de la Soberanía Nacional", holiday.Closure);
        Assert.Empty(holiday.Rounds);
    }

    [Fact]
    public void Progressive_days_do_not_reuse_clues_even_after_a_midstream_holiday()
    {
        var monday = _repository.GetStatus(Email, AtArgentina(2026, 11, 16, 13, 30));
        var tuesday = _repository.GetStatus(Email, AtArgentina(2026, 11, 17, 13, 30));
        Assert.NotNull(monday.Rounds[0].Clue);
        Assert.NotNull(monday.Rounds[1].Clue);
        Assert.NotEqual(monday.Rounds[0].Clue, tuesday.Rounds[0].Clue);
        Assert.NotEqual(monday.Rounds[1].Clue, tuesday.Rounds[1].Clue);

        // Simula el bug del 18/11: el feriado del 9 corrió el índice y clonó el día anterior.
        CloneSchedule(monday.Date, tuesday.Date);
        var repaired = _repository.GetStatus(Email, AtArgentina(2026, 11, 17, 13, 30));
        Assert.NotEqual(monday.Rounds[0].Clue, repaired.Rounds[0].Clue);
        Assert.NotEqual(monday.Rounds[1].Clue, repaired.Rounds[1].Clue);
    }

    [Fact]
    public void Yohana_starts_at_417_and_keeps_counting_after_solving()
    {
        const string yohana = "yohanaelizabeth.orellana@thomsonreuters.com";
        new AppAccessRepository(NullLogger<AppAccessRepository>.Instance).EnsureApproved(yohana);

        var at = AtArgentina(2026, 10, 23, 10, 0);
        var before = _repository.GetStatus(yohana, at);
        Assert.Equal(417, before.SeasonRanking.Single(item => item.Player.Contains("Yohana", StringComparison.OrdinalIgnoreCase)).Points);

        var answer = ScheduledAnswer(before.Date, DailyCrypticRepository.MorningSlot);
        var after = _repository.Submit(yohana, DailyCrypticRepository.MorningSlot, answer, at).Status;
        var points = after.SeasonRanking.Single(item => item.Player.Contains("Yohana", StringComparison.OrdinalIgnoreCase)).Points;
        Assert.Equal(417 + after.Rounds[0].Points, points);
    }

    [Fact]
    public void Fresh_mix_starts_on_november_19()
    {
        var fresh = _repository.GetStatus(Email, AtArgentina(2026, 11, 19, 13, 30));
        Assert.Equal("¡Oye! Estoy muerto por dentro. (2)", fresh.Rounds[0].Clue);
        Assert.NotEqual(fresh.Rounds[0].Clue, fresh.Rounds[1].Clue);
    }

    [Fact]
    public void Losing_the_morning_round_keeps_the_afternoon_playable()
    {
        var at0900 = AtArgentina(2026, 10, 23, 9, 0);
        for (var attempt = 0; attempt < DailyCrypticRepository.MaxAttempts; attempt++)
            _repository.Submit(Email, DailyCrypticRepository.MorningSlot, "respuesta-imposible-xyz", at0900);

        var at1330 = AtArgentina(2026, 10, 23, 13, 30);
        var status = _repository.GetStatus(Email, at1330);
        Assert.Equal("failed", status.Rounds[0].State);
        Assert.Equal("available", status.Rounds[1].State);

        var answer = ScheduledAnswer(status.Date, DailyCrypticRepository.AfternoonSlot);
        Assert.True(_repository.Submit(Email, DailyCrypticRepository.AfternoonSlot, answer, at1330).Correct);
    }

    [Fact]
    public void Previous_days_stay_playable_for_five_weekdays_and_show_what_was_solved()
    {
        // Programa los días como si la suite hubiera estado abierta cada día hábil.
        foreach (var day in new[] { 12, 13, 16, 17, 18, 19, 20 })
            _repository.GetStatus(Email, AtArgentina(2026, 11, day, 13, 30));

        // 23/11 es feriado: el martes 24 ofrece los 5 días hábiles anteriores.
        var tuesday = AtArgentina(2026, 11, 24, 10, 0);
        var today = _repository.GetStatus(Email, tuesday);
        Assert.Equal("2026-11-24", today.Current);
        Assert.Equal(
            ["2026-11-20", "2026-11-19", "2026-11-18", "2026-11-17", "2026-11-16"],
            today.Archive!.Select(day => day.Date).ToArray());
        Assert.All(today.Archive!, day => Assert.Equal(0, day.Solved));

        // Un día anterior se juega entero, incluida la ronda de la tarde, aunque sean las 10.
        var friday = _repository.GetStatus(Email, tuesday, "2026-11-20");
        Assert.Equal("archive", friday.Phase);
        Assert.Equal("2026-11-20", friday.Date);
        Assert.All(friday.Rounds, round => Assert.Equal("available", round.State));

        var answer = ScheduledAnswer("2026-11-20", DailyCrypticRepository.AfternoonSlot);
        var solved = _repository.Submit(Email, DailyCrypticRepository.AfternoonSlot, answer, tuesday, "2026-11-20");
        Assert.True(solved.Correct);
        Assert.Equal("archive", solved.Status.Phase);
        Assert.Equal("solved", solved.Status.Rounds[1].State);
        Assert.Equal(10, solved.Status.Rounds[1].Points);
        Assert.Equal(0, solved.Status.Ranking.Single().Wins);
        Assert.Equal(1, solved.Status.Archive!.Single(day => day.Date == "2026-11-20").Solved);

        // Resuelto queda resuelto: no se vuelve a sumar.
        var again = _repository.Submit(Email, DailyCrypticRepository.AfternoonSlot, answer, tuesday, "2026-11-20");
        Assert.Equal(10, again.Status.Ranking.Single().Points);

        // Las dos rondas sin pistas en un día anterior: 10 + 10, sin el bonus del día.
        var morningAnswer = ScheduledAnswer("2026-11-20", DailyCrypticRepository.MorningSlot);
        var both = _repository.Submit(Email, DailyCrypticRepository.MorningSlot, morningAnswer, tuesday, "2026-11-20");
        Assert.Equal(10, both.Status.Rounds[0].Points);
        Assert.Equal(20, both.Status.Ranking.Single().Points);
        Assert.Equal(2, both.Status.Archive!.Single(day => day.Date == "2026-11-20").Solved);

        // El 13 ya quedó afuera de la ventana: no se juega y el estado vuelve al día vigente.
        Assert.Throws<InvalidOperationException>(
            () => _repository.Submit(Email, DailyCrypticRepository.MorningSlot, "algo", tuesday, "2026-11-13"));
        Assert.Equal("active", _repository.GetStatus(Email, tuesday, "2026-11-13").Phase);
        Assert.Throws<ArgumentException>(
            () => _repository.RevealHint(Email, DailyCrypticRepository.MorningSlot, "definition", tuesday, "no-es-fecha"));
    }

    [Fact]
    public void Weekend_still_offers_the_previous_days()
    {
        foreach (var day in new[] { 19, 20 })
            _repository.GetStatus(Email, AtArgentina(2026, 11, day, 13, 30));

        var saturday = _repository.GetStatus(Email, AtArgentina(2026, 11, 21, 15, 0));
        Assert.Equal("weekend", saturday.Phase);
        Assert.Equal("2026-11-20", saturday.Archive![0].Date);

        var past = _repository.GetStatus(Email, AtArgentina(2026, 11, 21, 15, 0), "2026-11-20");
        Assert.Equal("archive", past.Phase);
        Assert.Equal(2, past.Rounds.Count);
    }

    [Fact]
    public void Days_without_a_cryptic_do_not_stretch_the_window_further_back()
    {
        // Solo hubo Críptico el 11/11; dos semanas después ya no entra en los 5 días hábiles.
        _repository.GetStatus(Email, AtArgentina(2026, 11, 11, 13, 30));
        var later = _repository.GetStatus(Email, AtArgentina(2026, 11, 25, 10, 0));
        Assert.Empty(later.Archive!);
    }

    private string ScheduledAnswer(string date, int slot)
    {
        using var conn = new SqliteConnection($"Data Source={Path.Combine(_dataDir, "daily_cryptic.db")}");
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT c.answer
            FROM daily_cryptic_schedule s
            JOIN daily_cryptic_clues c ON c.id = s.clue_id
            WHERE s.play_date = $date AND s.slot_hour = $slot
            """;
        cmd.Parameters.AddWithValue("$date", date);
        cmd.Parameters.AddWithValue("$slot", slot);
        return Assert.IsType<string>(cmd.ExecuteScalar());
    }

    private void CloneSchedule(string fromDate, string toDate)
    {
        using var conn = new SqliteConnection($"Data Source={Path.Combine(_dataDir, "daily_cryptic.db")}");
        conn.Open();
        using var wipe = conn.CreateCommand();
        wipe.CommandText = "DELETE FROM daily_cryptic_schedule WHERE play_date = $date";
        wipe.Parameters.AddWithValue("$date", toDate);
        wipe.ExecuteNonQuery();

        using var copy = conn.CreateCommand();
        copy.CommandText = """
            INSERT INTO daily_cryptic_schedule (play_date, slot_hour, clue_id, created_at)
            SELECT $to, slot_hour, clue_id, created_at
            FROM daily_cryptic_schedule
            WHERE play_date = $from
            """;
        copy.Parameters.AddWithValue("$to", toDate);
        copy.Parameters.AddWithValue("$from", fromDate);
        copy.ExecuteNonQuery();
    }

    private static DateTimeOffset AtArgentina(
        int year,
        int month,
        int day,
        int hour,
        int minute) =>
        new(year, month, day, hour, minute, 0, TimeSpan.FromHours(-3));

    public void Dispose()
    {
        Environment.SetEnvironmentVariable("ST2_DATA_DIR", null);
        try
        {
            if (Directory.Exists(_dataDir))
                Directory.Delete(_dataDir, recursive: true);
        }
        catch
        {
            // El runner puede retener brevemente un handle de SQLite en Windows.
        }
    }
}
