namespace PortalClienchi.Web;

internal static class PortalEmbedBridge
{
    private const string AutoFillBlock = """

  function setReactInput(el, value) {
    if (!el || value == null) return;
    var proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function tryAutoFillLogin() {
    if (bootstrapSession()) return true;
    var creds = syncGet("/api/portal-embed/credentials?portal=" + encodeURIComponent(PORTAL_ID));
    if (!creds || !creds.email || !creds.password) return false;

    var email = document.querySelector('input[type="email"], input[name="email"], input[autocomplete="username"], input[placeholder*="@" i]');
    var pass = document.querySelector('input[type="password"], input[name="password"], input[autocomplete="current-password"]');
    if (!email || !pass) return false;

    setReactInput(email, creds.email);
    setReactInput(pass, creds.password);

    var btn = document.querySelector('button[type="submit"], button.btn-primary, button[class*="btn"]');
    if (btn) {
      window.setTimeout(function () { btn.click(); }, 120);
      return true;
    }
    return false;
  }

  if (!bootstrapSession()) {
    window.setTimeout(tryAutoFillLogin, 600);
    window.setTimeout(tryAutoFillLogin, 1800);
    window.setTimeout(tryAutoFillLogin, 3500);
    try {
      new MutationObserver(function () { tryAutoFillLogin(); })
        .observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
    window.addEventListener("load", function () { tryAutoFillLogin(); });
  }
""";

    private const string ScriptTemplate = """
<script>
(function () {
  var PORTAL_ID = "__PORTAL_ID__";
  var HOME_PATH = "__HOME_PATH__";
  var API_SESSION = "__API_SESSION__";

  function syncGet(url) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    xhr.withCredentials = true;
    xhr.send();
    if (xhr.status < 200 || xhr.status >= 300) return null;
    try { return JSON.parse(xhr.responseText || "{}"); } catch (e) { return null; }
  }

  function syncPost(url, body) {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", url, false);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(body || {}));
    if (xhr.status < 200 || xhr.status >= 300) return null;
    try { return JSON.parse(xhr.responseText || "{}"); } catch (e) { return null; }
  }

  function applyAuth(token, user) {
    if (!token) return false;
    try {
      localStorage.setItem("authToken", token);
      if (user) {
        localStorage.setItem("user", typeof user === "string" ? user : JSON.stringify(user));
      }
      var authState = { authToken: token, user: user || null, isAuthorized: true };
      localStorage.setItem("persist:root", JSON.stringify({
        auth: JSON.stringify(authState),
        _persist: JSON.stringify({ version: -1, rehydrated: true })
      }));
    } catch (e) {}
    return true;
  }

  function goHome() {
    try {
      if (location.pathname !== HOME_PATH) location.replace(HOME_PATH);
    } catch (e) {}
  }

  function bootstrapSession() {
    var data = syncGet("/api/portal-embed/session?portal=" + encodeURIComponent(PORTAL_ID));
    if (data && applyAuth(data.authToken || data.token, data.user)) {
      goHome();
      return true;
    }

    var creds = syncGet("/api/portal-embed/credentials?portal=" + encodeURIComponent(PORTAL_ID));
    if (!creds || !creds.email || !creds.password) return false;

    var login = syncPost(API_SESSION, { email: creds.email, password: creds.password });
    if (login && applyAuth(login.token || login.authToken, login.user)) {
      goHome();
      return true;
    }
    return false;
  }
__AUTO_FILL_BLOCK__
})();
</script>
""";

    public static string BuildEarlyScript(string portalId, string embedSite) =>
        BuildScript(portalId, embedSite, includeAutoFill: false);

    public static string BuildLateScript(string portalId, string embedSite) =>
        BuildScript(portalId, embedSite, includeAutoFill: true);

    private static string BuildScript(string portalId, string embedSite, bool includeAutoFill)
    {
        var apiSite = embedSite + "-api";
        var autoFill = includeAutoFill ? AutoFillBlock : "  bootstrapSession();";

        return ScriptTemplate
            .Replace("__PORTAL_ID__", portalId, StringComparison.Ordinal)
            .Replace("__HOME_PATH__", $"/embed/{embedSite}/home", StringComparison.Ordinal)
            .Replace("__API_SESSION__", $"/embed/{apiSite}/session", StringComparison.Ordinal)
            .Replace("__AUTO_FILL_BLOCK__", autoFill, StringComparison.Ordinal);
    }
}
