using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace PortalClienchi.Web;

public static class St2IndexHtml
{
    private static readonly string[] JsModules =
    [
        "app.js",
        "planillas.js",
        "planillas-referral.js",
        "planillas-oportunidad.js",
        "plan-user.js",
        "plan-build.js",
        "daily-tab-reminder.js",
        "plan-ia-undo.js",
        "planillas-icons.js",
        "planillas-referral-dialogs.js",
        "planillas-blanqueo.js",
        "planillas-borrado-bases.js",
        "blanqueo-alerts.js",
        "borrado-alerts.js",
        "access-alerts.js",
        "st2-toast-greet.js",
        "module-access.js",
        "pdf-portal.js",
    ];

    public static string Inject(string html, string build, IWebHostEnvironment env)
    {
        var v = build.Length > 7 ? build[..7] : build;
        var dates = St2BundledToolDates.Load(env);
        dates.TryGetValue("sql", out var sqlPub);
        dates.TryGetValue("bat", out var batPub);
        var sqlLabel = string.IsNullOrWhiteSpace(sqlPub.LabelAr) ? "" : sqlPub.LabelAr;
        var batLabel = string.IsNullOrWhiteSpace(batPub.LabelAr) ? "" : batPub.LabelAr;
        var sqlStamp = sqlPub.Utc == default ? "" : sqlPub.Utc.ToString("o");
        var batStamp = batPub.Utc == default ? "" : batPub.Utc.ToString("o");
        var sb = new StringBuilder();
        sb.AppendLine("<script type=\"importmap\">");
        sb.AppendLine("{");
        sb.AppendLine("  \"imports\": {");
        for (var i = 0; i < JsModules.Length; i++)
        {
            var file = JsModules[i];
            sb.Append($"    \"/js/{file}\": \"/js/{file}?v={v}\"");
            sb.AppendLine(i < JsModules.Length - 1 ? "," : "");
        }
        sb.AppendLine("  },");
        sb.AppendLine("  \"scopes\": {");
        sb.AppendLine("    \"/js/\": {");
        for (var i = 0; i < JsModules.Length; i++)
        {
            var file = JsModules[i];
            sb.Append($"      \"./{file}\": \"/js/{file}?v={v}\"");
            sb.AppendLine(i < JsModules.Length - 1 ? "," : "");
        }
        sb.AppendLine("    }");
        sb.AppendLine("  }");
        sb.AppendLine("}");
        sb.AppendLine("</script>");
        sb.AppendLine($"<meta name=\"st2-build\" content=\"{WebUtility.HtmlEncode(build)}\"/>");
        var icoV = GetIconVersion(env, v);
        sb.AppendLine($"<meta name=\"st2-icon\" content=\"/st2.ico?v={WebUtility.HtmlEncode(icoV)}\"/>");
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

        html = html.Replace("</head>", sb + "</head>", StringComparison.OrdinalIgnoreCase);
        html = html.Replace(
            "<p id=\"st2-about-updated\" class=\"st2-about-updated\" aria-live=\"polite\">Última actualización de la web</p>",
            $"<p id=\"st2-about-updated\" class=\"st2-about-updated\" aria-live=\"polite\">{WebUtility.HtmlEncode(St2WebBuild.GetUpdatedLabel())}</p>",
            StringComparison.Ordinal);
        html = html.Replace("/css/styles.css", $"/css/styles.css?v={v}", StringComparison.Ordinal);
        html = html.Replace("/css/planillas.css", $"/css/planillas.css?v={v}", StringComparison.Ordinal);
        html = html.Replace("/css/blanqueo.css", $"/css/blanqueo.css?v={v}", StringComparison.Ordinal);
        html = html.Replace("/css/borrado-bases.css", $"/css/borrado-bases.css?v={v}", StringComparison.Ordinal);
        html = html.Replace("/css/pdf-portal.css", $"/css/pdf-portal.css?v={v}", StringComparison.Ordinal);
        html = html.Replace("/css/theme-dark.css", $"/css/theme-dark.css?v={v}", StringComparison.Ordinal);
        html = html.Replace("/js/app.js", $"/js/app.js?v={v}", StringComparison.Ordinal);
        html = html.Replace("/st2.ico", $"/st2.ico?v={icoV}", StringComparison.Ordinal);
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
        html = html.Replace("<link rel=\"stylesheet\" href=\"/css/planillas.css", $"<link rel=\"modulepreload\" href=\"/js/planillas.js?v={v}\"/><link rel=\"modulepreload\" href=\"/js/planillas-icons.js?v={v}\"/><link rel=\"stylesheet\" href=\"/css/planillas.css", StringComparison.Ordinal);
        return html;
    }

    private static string GetIconVersion(IWebHostEnvironment env, string fallback)
    {
        try
        {
            var path = Path.Combine(env.WebRootPath, "st2.ico");
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
