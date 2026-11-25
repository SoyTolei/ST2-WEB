using System.Text.RegularExpressions;
using Xunit;

namespace PortalClienchi.Web.Tests;

public sealed class CssTokensTests
{
    /// <summary>
    /// Un var(--c-…), var(--font-…) o var(--z-…) que no existe se ignora sin avisar.
    /// Todos esos tokens tienen que estar en css/st2-tokens.css.
    /// </summary>
    [Fact]
    public void Every_palette_token_used_in_css_is_defined()
    {
        var css = Path.Combine(FindRepoRoot(), "src", "PortalClienchi.Web", "wwwroot", "css");
        var tokensFile = Path.Combine(css, "st2-tokens.css");
        var defined = Regex.Matches(File.ReadAllText(tokensFile), @"(--(?:c|font|z|radius|text)-[a-z0-9-]+)\s*:")
            .Select(m => m.Groups[1].Value)
            .ToHashSet(StringComparer.Ordinal);
        Assert.NotEmpty(defined);

        var missing = Directory.EnumerateFiles(css, "*.css", SearchOption.TopDirectoryOnly)
            .Where(path => path != tokensFile)
            .SelectMany(path => Regex.Matches(File.ReadAllText(path), @"var\((--(?:c|font|z|radius|text)-[a-z0-9-]+)")
                .Select(m => $"{Path.GetFileName(path)}: {m.Groups[1].Value}"))
            .Where(entry => !defined.Contains(entry[(entry.IndexOf(": ", StringComparison.Ordinal) + 2)..]))
            .Distinct()
            .ToList();
        Assert.Empty(missing);
    }

    [Fact]
    public void Pages_load_the_tokens_before_the_rest_of_the_styles()
    {
        var wwwroot = Path.Combine(FindRepoRoot(), "src", "PortalClienchi.Web", "wwwroot");
        foreach (var page in new[] { "index.html", "criptico.html" })
        {
            var html = File.ReadAllText(Path.Combine(wwwroot, page));
            var tokens = html.IndexOf("/css/st2-tokens.css", StringComparison.Ordinal);
            var styles = html.IndexOf("/css/styles.css", StringComparison.Ordinal);
            Assert.True(tokens >= 0 && tokens < styles, $"{page}: st2-tokens.css tiene que ir antes que styles.css");
        }
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "PortalClienchiWEB.sln")))
            dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("No se encontró la raíz del repo.");
    }
}
