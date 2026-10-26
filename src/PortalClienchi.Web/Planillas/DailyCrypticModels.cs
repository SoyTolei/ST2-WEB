using System.Text.Json.Serialization;

namespace PortalClienchi.Web.Planillas;

public sealed class DailyCrypticAttemptRequest
{
    [JsonPropertyName("slot")]
    public int Slot { get; set; }

    [JsonPropertyName("answer")]
    public string Answer { get; set; } = "";

    [JsonPropertyName("kind")]
    public string Kind { get; set; } = "";
}

public sealed class DailyCrypticAdminRequest
{
    [JsonPropertyName("id")]
    public long? Id { get; set; }

    [JsonPropertyName("clue")]
    public string Clue { get; set; } = "";

    [JsonPropertyName("answer")]
    public string Answer { get; set; } = "";

    [JsonPropertyName("enumeration")]
    public string Enumeration { get; set; } = "";

    [JsonPropertyName("definition")]
    public string Definition { get; set; } = "";

    [JsonPropertyName("wordplay")]
    public string Wordplay { get; set; } = "";

    [JsonPropertyName("mechanism")]
    public string Mechanism { get; set; } = "";

    [JsonPropertyName("indicator")]
    public string Indicator { get; set; } = "";

    [JsonPropertyName("fodder")]
    public string Fodder { get; set; } = "";

    [JsonPropertyName("parse")]
    public string Parse { get; set; } = "";

    [JsonPropertyName("difficulty")]
    public int Difficulty { get; set; } = 1;

    [JsonPropertyName("acceptedAnswers")]
    public string[] AcceptedAnswers { get; set; } = [];

    [JsonPropertyName("reviewed")]
    public bool Reviewed { get; set; }

    [JsonPropertyName("active")]
    public bool Active { get; set; } = true;
}

public sealed record DailyCrypticRoundDto(
    int Slot,
    string Label,
    string State,
    string? Clue,
    string? Enumeration,
    int Difficulty,
    int AttemptsUsed,
    int AttemptsRemaining,
    int? Position,
    int? Points,
    string? SolvedAt,
    string? Answer,
    string? Definition,
    string? Mechanism,
    string? Indicator,
    string? Fodder,
    string? Parse,
    int HintsUsed,
    int HintMask);

public sealed record DailyCrypticStatusDto(
    string Date,
    string TimeZone,
    string Phase,
    string? NextAt,
    IReadOnlyList<DailyCrypticRoundDto> Rounds,
    IReadOnlyList<DailyCrypticRankingDto> Ranking,
    string Season,
    IReadOnlyList<DailyCrypticRankingDto> SeasonRanking,
    bool Ranked);

public sealed record DailyCrypticRankingDto(
    int Rank,
    string Player,
    int Points,
    int Solved,
    int Wins);

public sealed record DailyCrypticAttemptResult(
    bool Correct,
    string Message,
    int AttemptsRemaining,
    DailyCrypticStatusDto Status);
