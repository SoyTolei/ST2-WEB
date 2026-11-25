using System.Text.RegularExpressions;
using PortalClienchi.Web;
using Xunit;

namespace PortalClienchi.Web.Tests;

public sealed class St2IndexHtmlTests
{
    [Fact]
    public void Versions_every_script_and_stylesheet_but_not_images()
    {
        const string html = """
            <link rel="stylesheet" href="/css/planillas.css"/>
            <link rel="stylesheet" href="/css/vendor/blobatar-gaze.css"/>
            <script type="module" src="/js/st2-login-boot.js"></script>
            <img src="/img/agua/botella-0.png?v=3"/>
            """;

        var result = St2IndexHtml.VersionAssetRefs(html, "abc1234");

        Assert.Contains("href=\"/css/planillas.css?v=abc1234\"", result);
        Assert.Contains("href=\"/css/vendor/blobatar-gaze.css?v=abc1234\"", result);
        Assert.Contains("src=\"/js/st2-login-boot.js?v=abc1234\"", result);
        Assert.Contains("src=\"/img/agua/botella-0.png?v=3\"", result);
    }

    /// <summary>
    /// Un ?v= escrito a mano en un import hace que el navegador cargue el mismo módulo
    /// dos veces (con estado separado) si otro archivo lo importa con otra versión.
    /// El versionado lo pone el import map del servidor.
    /// </summary>
    [Fact]
    public void Js_imports_and_html_assets_have_no_manual_versions()
    {
        var wwwroot = Path.Combine(FindRepoRoot(), "src", "PortalClienchi.Web", "wwwroot");
        var manual = new Regex("""["']\.{1,2}/[^"']+\.js\?v=""");
        var offenders = Directory.EnumerateFiles(Path.Combine(wwwroot, "js"), "*.js", SearchOption.AllDirectories)
            .Where(path => manual.IsMatch(File.ReadAllText(path)))
            .Select(Path.GetFileName)
            .ToList();
        Assert.Empty(offenders);

        var htmlAsset = new Regex("""(src|href)="/(js|css)/[^"]+\.(js|css)\?v=""");
        foreach (var page in new[] { "index.html", "criptico.html" })
            Assert.DoesNotMatch(htmlAsset, File.ReadAllText(Path.Combine(wwwroot, page)));
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "PortalClienchiWEB.sln")))
            dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("No se encontró la raíz del repo.");
    }
}
