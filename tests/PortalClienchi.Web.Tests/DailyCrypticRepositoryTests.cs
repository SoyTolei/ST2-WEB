using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Logging.Abstractions;
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
        var at1230 = AtArgentina(2026, 10, 23, 12, 30);
        var initial = _repository.GetStatus(Email, at1230);

        Assert.Equal("active", initial.Phase);
        Assert.Equal("available", initial.Rounds[0].State);
        Assert.Equal("blocked", initial.Rounds[1].State);
        Assert.Equal("upcoming", initial.Rounds[2].State);

        var first = _repository.Submit(Email, 8, ScheduledAnswer(initial.Date, 8), at1230);
        Assert.True(first.Correct);
        Assert.Equal(10, first.Status.Rounds[0].Points);
        Assert.Equal("available", first.Status.Rounds[1].State);

        var second = _repository.Submit(Email, 12, ScheduledAnswer(initial.Date, 12), at1230);
        Assert.True(second.Correct);
        Assert.Equal(20, second.Status.Ranking.Single().Points);

        var at1630 = AtArgentina(2026, 10, 23, 16, 30);
        var thirdReady = _repository.GetStatus(Email, at1630);
        Assert.Equal("available", thirdReady.Rounds[2].State);

        var third = _repository.Submit(Email, 16, ScheduledAnswer(initial.Date, 16), at1630);
        Assert.True(third.Correct);
        Assert.Equal(30, third.Status.Ranking.Single().Points);
        Assert.Equal(3, third.Status.Ranking.Single().Solved);
    }

    [Fact]
    public void Limits_attempts_and_resets_progress_on_the_next_day()
    {
        var at0900 = AtArgentina(2026, 10, 23, 9, 0);
        for (var attempt = 1; attempt <= DailyCrypticRepository.MaxAttempts; attempt++)
        {
            var result = _repository.Submit(Email, 8, "respuesta-imposible-xyz", at0900);
            Assert.False(result.Correct);
            Assert.Equal(DailyCrypticRepository.MaxAttempts - attempt, result.AttemptsRemaining);
        }

        var failed = _repository.GetStatus(Email, at0900);
        Assert.Equal("failed", failed.Rounds[0].State);
        Assert.Throws<InvalidOperationException>(
            () => _repository.Submit(Email, 8, "otro-intento", at0900));

        var nextDay = AtArgentina(2026, 10, 24, 9, 0);
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
        Assert.Equal("blocked", overnight.Rounds[1].State);

        var answer = ScheduledAnswer(overnight.Date, 8);
        var solved = _repository.Submit(Email, 8, answer, earlyMorning);
        Assert.True(solved.Correct);

        var nextCompetition = _repository.GetStatus(Email, AtArgentina(2026, 10, 24, 8, 0));
        Assert.Equal("2026-10-24", nextCompetition.Date);
        Assert.Equal("available", nextCompetition.Rounds[0].State);
        Assert.Equal(0, nextCompetition.Rounds[0].AttemptsUsed);
    }

    [Fact]
    public void Assigns_points_by_arrival_order()
    {
        const string secondEmail = "otra.persona@thomsonreuters.com";
        var at0900 = AtArgentina(2026, 10, 23, 9, 0);
        var date = _repository.GetStatus(Email, at0900).Date;
        var answer = ScheduledAnswer(date, 8);

        var first = _repository.Submit(Email, 8, answer, at0900);
        var second = _repository.Submit(secondEmail, 8, answer, at0900.AddMinutes(1));

        Assert.Equal(10, first.Status.Rounds[0].Points);
        Assert.Equal(7, second.Status.Rounds[0].Points);
        Assert.Equal([10, 7], second.Status.Ranking.Select(item => item.Points).ToArray());
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
