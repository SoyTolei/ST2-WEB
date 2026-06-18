namespace PortalClienchi.Core.Configuration;

public sealed class PortalProfileSettings
{
    public string Label { get; set; } = "";
    public string ApiBaseUrl { get; set; } = "";
    public string PortalBaseUrl { get; set; } = "";
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
}
