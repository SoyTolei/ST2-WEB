using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace PortalClienchi.Web;

/// <summary>
/// Arma el index con el build inyectado. Versionado de JS/CSS: automático por deploy.
/// En el código no se escriben <c>?v=</c> a mano: los imports van limpios (<c>./x.js</c>)
/// y el import map los resuelve a <c>/js/x.js?v=&lt;commit&gt;</c>. Así cada módulo tiene
/// una sola URL (si dos imports usan versiones distintas, el navegador lo carga dos veces).
/// Las imágenes sí llevan <c>?v=</c> manual porque se cachean.
/// </summary>
public static partial class St2IndexHtml
{
    [System.Text.RegularExpressions.GeneratedRegex(@"(src|href)=""(/(?:js|css)/[^""?]+\.(?:js|css))""")]
    private static partial System.Text.RegularExpressions.Regex AssetRefRegex();

    /// <summary>Todos los módulos de wwwroot/js (incluye subcarpetas), con ruta relativa a /js/.</summary>
    private static IReadOnlyList<string> ListJsModules(IWebHostEnvironment env)
    {
        var dir = Path.Combine(env.WebRootPath, "js");
        if (!Directory.Exists(dir))
            return [];
        return Directory.EnumerateFiles(dir, "*.js", SearchOption.AllDirectories)
            .Select(path => Path.GetRelativePath(dir, path).Replace('\\', '/'))
            .OrderBy(path => path, StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>Agrega ?v= a cada &lt;script src="/js/…"&gt; y &lt;link href="/css/…"&gt; del HTML.</summary>
    public static string VersionAssetRefs(string html, string v) =>
        AssetRefRegex().Replace(html, match => $"{match.Groups[1].Value}=\"{match.Groups[2].Value}?v={v}\"");

    public static string Inject(string html, string build, IWebHostEnvironment env)
    {
        var v = build.Length > 7 ? build[..7] : build;
        // Antes de inyectar el import map, para no tocar sus claves.
        html = VersionAssetRefs(html, v);
        var jsModules = ListJsModules(env);
        var dates = St2BundledToolDates.Load(env);
        dates.TryGetValue("sql", out var sqlPub);
        dates.TryGetValue("bat", out var batPub);
        dates.TryGetValue("chile", out var chilePub);
        var sqlLabel = string.IsNullOrWhiteSpace(sqlPub.LabelAr) ? "" : sqlPub.LabelAr;
        var batLabel = string.IsNullOrWhiteSpace(batPub.LabelAr) ? "" : batPub.LabelAr;
        var chileLabel = string.IsNullOrWhiteSpace(chilePub.LabelAr) ? "" : chilePub.LabelAr;
        var sqlStamp = sqlPub.Utc == default ? "" : sqlPub.Utc.ToString("o");
        var batStamp = batPub.Utc == default ? "" : batPub.Utc.ToString("o");
        var chileStamp = chilePub.Utc == default ? "" : chilePub.Utc.ToString("o");
        var map = new StringBuilder();
        map.AppendLine("<script type=\"importmap\">");
        map.AppendLine("{");
        // Los imports relativos (./x.js) se resuelven a /js/x.js antes de consultar el mapa,
        // así que con las claves absolutas alcanza para todos los módulos.
        map.AppendLine("  \"imports\": {");
        for (var i = 0; i < jsModules.Count; i++)
        {
            var file = jsModules[i];
            map.Append($"    \"/js/{file}\": \"/js/{file}?v={v}\"");
            map.AppendLine(i < jsModules.Count - 1 ? "," : "");
        }
        map.AppendLine("  }");
        map.AppendLine("}");
        map.AppendLine("</script>");
        var sb = new StringBuilder();
        sb.AppendLine($"<meta name=\"st2-build\" content=\"{WebUtility.HtmlEncode(build)}\"/>");
        sb.AppendLine($"<meta name=\"st2-build-at\" content=\"{WebUtility.HtmlEncode(St2WebBuild.GetBuildStamp())}\"/>");
        var icoV = GetIconVersion(env, v);
        sb.AppendLine($"<meta name=\"st2-icon\" content=\"/img/st2-brand.png?v={WebUtility.HtmlEncode(icoV)}\"/>");
        sb.AppendLine($"<meta name=\"st2-version-label\" content=\"{WebUtility.HtmlEncode(St2WebBuild.GetVersionLabel())}\"/>");
        sb.AppendLine($"<meta name=\"st2-updated-label\" content=\"{WebUtility.HtmlEncode(St2WebBuild.GetUpdatedLabel())}\"/>");
        if (!string.IsNullOrWhiteSpace(sqlLabel))
        {
            sb.AppendLine($"<meta name=\"st2-tool-sql-uploaded\" content=\"{WebUtility.HtmlEncode(sqlLabel)}\"/>");
            sb.AppendLine($"<meta name=\"st2-tool-sql-stamp\" content=\"{WebUtility.HtmlEncode(sqlStamp)}\"/>");
        }
        if (!string.IsNullOrWhiteSpace(batLabel))
        {
            sb.AppendLine($"<meta name=\"st2-tool-bat-uploaded\" content=\"{WebUtility.HtmlEncode(batLabel)}\"/>");
            sb.AppendLine($"<meta name=\"st2-tool-bat-stamp\" content=\"{WebUtility.HtmlEncode(batStamp)}\"/>");
        }
        if (!string.IsNullOrWhiteSpace(chileLabel))
        {
            sb.AppendLine($"<meta name=\"st2-tool-chile-uploaded\" content=\"{WebUtility.HtmlEncode(chileLabel)}\"/>");
            sb.AppendLine($"<meta name=\"st2-tool-chile-stamp\" content=\"{WebUtility.HtmlEncode(chileStamp)}\"/>");
        }

        // El ícono se versiona antes de inyectar el <meta name="st2-icon">, que ya trae su ?v=.
        html = html.Replace("/img/st2-brand.png", $"/img/st2-brand.png?v={icoV}", StringComparison.Ordinal);
        // El import map va antes del primer <link>: tiene que estar antes de cualquier
        // modulepreload o script de módulo para que todos los navegadores lo respeten.
        var firstLink = html.IndexOf("<link", StringComparison.OrdinalIgnoreCase);
        var headEnd = html.IndexOf("</head>", StringComparison.OrdinalIgnoreCase);
        var mapAt = firstLink >= 0 && (headEnd < 0 || firstLink < headEnd) ? firstLink : headEnd;
        if (mapAt >= 0)
            html = html.Insert(mapAt, map.ToString());
        html = html.Replace("</head>", sb + "</head>", StringComparison.OrdinalIgnoreCase);
        html = html.Replace(
            """<p id="st2-about-updated" class="st2-about-updated" aria-live="polite">Último update de la web: —</p>""",
            $"""<p id="st2-about-updated" class="st2-about-updated" aria-live="polite">{WebUtility.HtmlEncode(St2WebBuild.GetUpdatedLabel())}</p>""",
            StringComparison.Ordinal);
        html = html.Replace(
            "<p id=\"st2-about-updated\" class=\"st2-about-updated\" aria-live=\"polite\">Última actualización de la web</p>",
            $"<p id=\"st2-about-updated\" class=\"st2-about-updated\" aria-live=\"polite\">{WebUtility.HtmlEncode(St2WebBuild.GetUpdatedLabel())}</p>",
            StringComparison.Ordinal);
        if (!string.IsNullOrWhiteSpace(sqlLabel))
        {
            html = html.Replace(
                """<span class="st2-about-tool-date" data-tool-date="sql" hidden></span>""",
                $"""<span class="st2-about-tool-date" data-tool-date="sql">Subido {WebUtility.HtmlEncode(sqlLabel)}</span>""",
                StringComparison.Ordinal);
        }
        if (!string.IsNullOrWhiteSpace(batLabel))
        {
            html = html.Replace(
                """<span class="st2-about-tool-date" data-tool-date="bat" hidden></span>""",
                $"""<span class="st2-about-tool-date" data-tool-date="bat">Subido {WebUtility.HtmlEncode(batLabel)}</span>""",
                StringComparison.Ordinal);
        }
        if (!string.IsNullOrWhiteSpace(chileLabel))
        {
            html = html.Replace(
                """<span class="st2-about-tool-date" data-tool-date="chile" hidden></span>""",
                $"""<span class="st2-about-tool-date" data-tool-date="chile">Subido {WebUtility.HtmlEncode(chileLabel)}</span>""",
                StringComparison.Ordinal);
        }
        html = html.Replace("<link rel=\"stylesheet\" href=\"/css/planillas.css", $"<link rel=\"modulepreload\" href=\"/js/planillas.js?v={v}\"/><link rel=\"modulepreload\" href=\"/js/planillas-icons.js?v={v}\"/><link rel=\"stylesheet\" href=\"/css/planillas.css", StringComparison.Ordinal);
        return html;
    }

    private static string GetIconVersion(IWebHostEnvironment env, string fallback)
    {
        try
        {
            var path = Path.Combine(env.WebRootPath, "img", "st2-brand.png");
            if (!File.Exists(path))
                path = Path.Combine(env.WebRootPath, "st2.ico");
            if (!File.Exists(path))
                return fallback;

            var hash = SHA256.HashData(File.ReadAllBytes(path));
            return Convert.ToHexString(hash)[..8].ToLowerInvariant();
        }
        catch
        {
            return fallback;
        }
    }

    public static async Task<string> LoadAsync(IWebHostEnvironment env, CancellationToken ct = default)
    {
        var path = Path.Combine(env.WebRootPath, "index.html");
        var html = await File.ReadAllTextAsync(path, ct).ConfigureAwait(false);
        return Inject(html, St2WebBuild.GetBuild(), env);
    }
}
