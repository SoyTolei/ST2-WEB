/* Login independiente de app.js: si el bundle grande falla o tarda, igual se puede entrar. */
(function () {
  const SUPER = "leonel.gallo@thomsonreuters.com";
  const DOMAIN = "thomsonreuters.com";
  const LOCAL_OK = /^[a-z]{2,}\.[a-z]{2,}$/;

  function $(id) {
    return document.getElementById(id);
  }

  function isAllowedEmail(email) {
    const normalized = String(email || "").trim().toLowerCase();
    const at = normalized.lastIndexOf("@");
    if (at <= 0) return false;
    const local = normalized.slice(0, at);
    const domain = normalized.slice(at + 1);
    return domain === DOMAIN && LOCAL_OK.test(local);
  }

  function isSuper(email) {
    return String(email || "").trim().toLowerCase() === SUPER;
  }

  function setPassVisible() {
    const wrap = $("st2-access-pass-wrap");
    const email = $("st2-access-email")?.value || "";
    wrap?.classList.toggle("hidden", !isSuper(email));
    if (!isSuper(email) && $("st2-access-pass")) $("st2-access-pass").value = "";
  }

  function setError(text) {
    const err = $("st2-access-error");
    if (err) err.textContent = text || "";
  }

  function showForm() {
    $("st2-access-form")?.classList.remove("hidden");
    $("st2-access-pending")?.classList.add("hidden");
  }

  function showPending(email) {
    $("st2-access-form")?.classList.add("hidden");
    const box = $("st2-access-pending");
    box?.classList.remove("hidden");
    const mail = $("st2-access-pending-email");
    if (mail) mail.textContent = email || "";
  }

  function unlock(email) {
    window.__ST2_SESSION_EMAIL = email;
    document.body.classList.remove("st2-access-pending");
    document.body.classList.add("st2-access-ok");
    $("st2-access-gate")?.classList.add("hidden");
    try {
      localStorage.setItem("st2_plan_user_hint", email);
    } catch {
      /* ignore */
    }
    document.dispatchEvent(new CustomEvent("st2:access-ready", { detail: { email } }));
  }

  function fetchJson(url, opts, timeoutMs) {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
    return fetch(url, { credentials: "include", cache: "no-store", signal: ctrl.signal, ...opts })
      .then((response) => response.json().catch(() => ({})).then((data) => ({ response, data })))
      .finally(() => window.clearTimeout(timer));
  }

  function applyResult(response, data, fallbackEmail) {
    const status = String(data.status || "").toLowerCase();
    const email = data.email || fallbackEmail || "";
    const submit = $("st2-access-submit");
    if (submit) submit.disabled = false;

    if (status === "pending" || (response.status === 403 && status !== "rejected" && status !== "password_required")) {
      showPending(email);
      return;
    }
    if (status === "rejected") {
      showForm();
      setError(data.error || "Este correo no está autorizado.");
      return;
    }
    if (status === "password_required" || data.requiresPassword) {
      showForm();
      setPassVisible();
      setError(data.error || "Este correo pide contraseña.");
      $("st2-access-pass")?.focus();
      return;
    }
    if (!response.ok) {
      showForm();
      setError(data.error || "No se pudo entrar. Probá de nuevo.");
      return;
    }
    if (!data.email) {
      setError("No se pudo confirmar la sesión.");
      return;
    }
    unlock(data.email);
  }

  function postSession(email, password) {
    const payload = { email };
    if (isSuper(email)) payload.password = password || "";
    return fetchJson("/api/planillas/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, 12000);
  }

  async function onSubmit() {
    const input = $("st2-access-email");
    const submit = $("st2-access-submit");
    const email = input?.value.trim() || "";
    const password = $("st2-access-pass")?.value || "";
    setError("");
    if (!email) {
      setError("Ingresá tu correo.");
      return;
    }
    if (!isAllowedEmail(email)) {
      setError("Correo incorrecto.");
      return;
    }
    if (isSuper(email) && !password) {
      setPassVisible();
      setError("Ingresá la contraseña de este correo.");
      $("st2-access-pass")?.focus();
      return;
    }
    if (submit) submit.disabled = true;
    try {
      const { response, data } = await postSession(email, password);
      applyResult(response, data, email);
    } catch (err) {
      setError(err?.name === "AbortError"
        ? "El servidor tardó demasiado. Probá de nuevo."
        : "No se pudo contactar al servidor.");
      if (submit) submit.disabled = false;
    }
  }

  async function tryCookie() {
    try {
      const { data } = await fetchJson("/api/planillas/session", {}, 4000);
      if (data?.email) unlock(data.email);
    } catch {
      /* el usuario entra a mano */
    }
  }

  function bind() {
    const gate = $("st2-access-gate");
    const input = $("st2-access-email");
    const submit = $("st2-access-submit");
    if (!gate || !input || !submit) return;

    gate.classList.remove("hidden");
    document.body.classList.add("st2-access-pending");
    try {
      input.value = localStorage.getItem("st2_plan_user_hint") || "";
    } catch {
      /* ignore */
    }
    setPassVisible();
    input.addEventListener("input", setPassVisible);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") void onSubmit();
    });
    $("st2-access-pass")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") void onSubmit();
    });
    submit.addEventListener("click", () => void onSubmit());
    $("st2-access-retry")?.addEventListener("click", () => {
      const email = $("st2-access-pending-email")?.textContent?.trim()
        || input.value.trim();
      if (isSuper(email)) {
        showForm();
        input.value = email;
        setPassVisible();
        $("st2-access-pass")?.focus();
        return;
      }
      if (!email) {
        showForm();
        return;
      }
      void postSession(email, "").then(({ response, data }) => applyResult(response, data, email));
    });
    input.focus();
    void tryCookie();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
