using System.Net;
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
    ];

    public static string Inject(string html, string build)
    {
        var v = build.Length > 7 ? build[..7] : build;
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

        html = html.Replace("</head>", sb + "</head>", StringComparison.OrdinalIgnoreCase);
        html = html.Replace("/css/styles.css", $"/css/styles.css?v={v}", StringComparison.Ordinal);
        html = html.Replace("/css/planillas.css", $"/css/planillas.css?v={v}", StringComparison.Ordinal);
        html = html.Replace("/js/app.js", $"/js/app.js?v={v}", StringComparison.Ordinal);
        return html;
    }

    public static async Task<string> LoadAsync(IWebHostEnvironment env, CancellationToken ct = default)
    {
        var path = Path.Combine(env.WebRootPath, "index.html");
        var html = await File.ReadAllTextAsync(path, ct).ConfigureAwait(false);
        return Inject(html, St2WebBuild.GetBuild());
    }
}
