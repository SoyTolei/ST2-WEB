namespace PortalClienchi.Core.Services;

public sealed class SyncProgress
{
    public string Phase { get; set; } = "";
    public int Current { get; set; }
    public int Total { get; set; }
    public string? CurrentTitle { get; set; }

    public double Percent => Total <= 0 ? 0 : Math.Min(100, Current * 100.0 / Total);
}
