let cachedEmail = null;
let modalPromise = null;
let accessPromise = null;
let appUnlocked = false;

const SESSION_OPTS = { credentials: "include" };
const ALLOWED_DOMAIN = "thomsonreuters.com";
const SUPER_ADMIN_EMAIL = "leonel.gallo@thomsonreuters.com";
const LOCAL_NAME_PATTERN = /^[a-z]{2,}\.[a-z]{2,}$/;

function isAllowedEmail(email) {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at >= normalized.length - 1) return false;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!local || local.includes(" ") || local.includes("@")) return false;
  if (domain !== ALLOWED_DOMAIN) return false;
  return LOCAL_NAME_PATTERN.test(local);
}

function isSuperAdminEmail(email) {
  return String(email || "").trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

function syncPasswordFieldVisibility(emailInput, wrapEl, passInput) {
  const needsPass = isSuperAdminEmail(emailInput?.value || "");
  wrapEl?.classList.toggle("hidden", !needsPass);
  if (!needsPass && passInput) passInput.value = "";
}

const EMAIL_HINT = "Incorrecto.";
const PENDING_COPY = "Tu acceso quedó pendiente de aprobación. Podés esperar acá hasta que te habiliten, o volver más tarde con el mismo correo.";
let lastPendingAccess = null;
let pendingPollTimer = null;
let pendingRetryFn = null;

function accessFormEl() {
  return document.getElementById("st2-access-form");
}

function accessPendingEl() {
  return document.getElementById("st2-access-pending");
}

function showAccessFormState() {
  stopPendingPoll();
  accessFormEl()?.classList.remove("hidden");
  accessPendingEl()?.classList.add("hidden");
}

function setPendingError(message) {
  const err = document.getElementById("st2-access-pending-error");
  if (!err) return;
  const text = String(message || "").trim();
  err.textContent = text;
  err.classList.toggle("hidden", !text);
}

function showAccessPendingState(email) {
  const box = accessPendingEl();
  const mailEl = document.getElementById("st2-access-pending-email");
  const textEl = document.getElementById("st2-access-pending-text");
  accessFormEl()?.classList.add("hidden");
  if (box) box.classList.remove("hidden");
  if (mailEl) mailEl.textContent = email || "";
  if (textEl) textEl.textContent = PENDING_COPY;
  setPendingError("");
  lockAppShell();
  startPendingPoll();
}

function startPendingPoll() {
  stopPendingPoll();
  pendingPollTimer = window.setInterval(() => {
    void pendingRetryFn?.(true);
  }, 5000);
}

function stopPendingPoll() {
  if (pendingPollTimer) {
    window.clearInterval(pendingPollTimer);
    pendingPollTimer = null;
  }
}

function updateSessionEmailDisplay() {
  const el = document.getElementById("st2-session-email");
  if (!el) return;
  if (cachedEmail) {
    el.textContent = cachedEmail;
    el.title = cachedEmail;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.title = "";
    el.classList.add("hidden");
  }
}

export function isAppAccessGranted() {
  return appUnlocked && !!cachedEmail;
}

export async function ensureAppAccess() {
  if (accessPromise) return accessPromise;

  accessPromise = (async () => {
    const synced = await syncPlanUserSession();
    if (synced) {
      unlockAppShell();
      return synced;
    }
    return waitForAccessGate();
  })().finally(() => {
    accessPromise = null;
  });

  return accessPromise;
}

function unlockAppShell() {
  appUnlocked = true;
  document.body.classList.remove("st2-access-pending");
  document.body.classList.add("st2-access-ok");
  document.getElementById("st2-access-gate")?.classList.add("hidden");
  document.dispatchEvent(new CustomEvent("st2:session-changed"));
}

function lockAppShell() {
  appUnlocked = false;
  document.body.classList.add("st2-access-pending");
  document.body.classList.remove("st2-access-ok");
  document.getElementById("st2-access-gate")?.classList.remove("hidden");
}

function waitForAccessGate() {
  return new Promise((resolve) => {
    showAccessGate(resolve);
  });
}

async function postAccessSession(email, password = "") {
  const payload = { email };
  if (isSuperAdminEmail(email)) payload.password = password || "";
  const response = await fetch("/api/planillas/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function showAccessGate(resolve) {
  const gate = document.getElementById("st2-access-gate");
  const input = document.getElementById("st2-access-email");
  const passInput = document.getElementById("st2-access-pass");
  const passWrap = document.getElementById("st2-access-pass-wrap");
  const error = document.getElementById("st2-access-error");
  const submit = document.getElementById("st2-access-submit");
  const retry = document.getElementById("st2-access-retry");
  if (!gate || !input || !submit) {
    resolve(null);
    return;
  }

  lockAppShell();
  showAccessFormState();
  input.value = localStorage.getItem("st2_plan_user_hint") || "";
  if (passInput) passInput.value = "";
  syncPasswordFieldVisibility(input, passWrap, passInput);
  if (error) error.textContent = "";
  if (lastPendingAccess) {
    showAccessPendingState(lastPendingAccess.email);
    lastPendingAccess = null;
  } else {
    input.focus();
    input.select();
  }

  const finishOk = async (email) => {
    cachedEmail = email;
    localStorage.setItem("st2_plan_user_hint", email);
    if (passInput) passInput.value = "";
    await refreshPlanUserSession();
    if (!cachedEmail) return false;
    cleanup();
    unlockAppShell();
    updatePlanUserBadge();
    resolve(cachedEmail);
    return true;
  };

  const applySessionResult = async (response, data, fallbackEmail) => {
    const status = String(data.status || "").toLowerCase();
    const email = data.email || fallbackEmail || "";
    if (status === "pending" || (response.status === 403 && status !== "rejected" && status !== "password_required")) {
      if (email) localStorage.setItem("st2_plan_user_hint", email);
      showAccessPendingState(email);
      if (submit) submit.disabled = false;
      return;
    }
    if (status === "rejected") {
      showAccessFormState();
      if (error) error.textContent = data.error || "Este correo no está autorizado.";
      if (submit) submit.disabled = false;
      return;
    }
    if (status === "password_required" || data.requiresPassword) {
      showAccessFormState();
      syncPasswordFieldVisibility(input, passWrap, passInput);
      if (error) error.textContent = data.error || "Este correo pide contraseña.";
      passInput?.focus();
      if (submit) submit.disabled = false;
      return;
    }
    if (!response.ok) {
      showAccessFormState();
      if (error) error.textContent = data.error || EMAIL_HINT;
      if (submit) submit.disabled = false;
      return;
    }
    if (!data.email) {
      if (error) error.textContent = "No se pudo confirmar la sesión.";
      if (submit) submit.disabled = false;
      return;
    }
    const ok = await finishOk(data.email);
    if (!ok && error) error.textContent = "No se pudo confirmar la sesión. Probá de nuevo.";
    if (submit) submit.disabled = false;
  };

  const onSubmit = async () => {
    const email = input.value.trim();
    const password = passInput?.value || "";
    if (error) error.textContent = "";
    if (!email) {
      if (error) error.textContent = "Ingresá tu correo.";
      return;
    }
    if (!isAllowedEmail(email)) {
      if (error) error.textContent = EMAIL_HINT;
      return;
    }
    if (isSuperAdminEmail(email) && !password) {
      syncPasswordFieldVisibility(input, passWrap, passInput);
      if (error) error.textContent = "Ingresá la contraseña de este correo.";
      passInput?.focus();
      return;
    }

    submit.disabled = true;
    try {
      const { response, data } = await postAccessSession(email, password);
      await applySessionResult(response, data, email);
    } catch {
      if (error) error.textContent = "No se pudo contactar al servidor.";
      submit.disabled = false;
    }
  };

  const onRetry = async (silent = false) => {
    const email = document.getElementById("st2-access-pending-email")?.textContent?.trim()
      || localStorage.getItem("st2_plan_user_hint")
      || "";
    if (!email) {
      showAccessFormState();
      input.focus();
      return;
    }
    if (isSuperAdminEmail(email)) {
      showAccessFormState();
      input.value = email;
      syncPasswordFieldVisibility(input, passWrap, passInput);
      passInput?.focus();
      return;
    }
    if (!silent && retry) retry.disabled = true;
    try {
      const { response, data } = await postAccessSession(email);
      await applySessionResult(response, data, email);
    } catch {
      showAccessPendingState(email);
      setPendingError("No se pudo contactar al servidor. Probá de nuevo en un momento.");
    } finally {
      if (retry) retry.disabled = false;
    }
  };
  pendingRetryFn = onRetry;

  const onEmailInput = () => {
    syncPasswordFieldVisibility(input, passWrap, passInput);
  };

  const cleanup = () => {
    stopPendingPoll();
    pendingRetryFn = null;
    submit.removeEventListener("click", onSubmit);
    input.removeEventListener("keydown", onKey);
    passInput?.removeEventListener("keydown", onKey);
    input.removeEventListener("input", onEmailInput);
    retry?.removeEventListener("click", onRetry);
    submit.disabled = false;
  };

  const onKey = (e) => {
    if (e.key === "Enter") onSubmit();
  };

  submit.addEventListener("click", onSubmit);
  input.addEventListener("keydown", onKey);
  passInput?.addEventListener("keydown", onKey);
  input.addEventListener("input", onEmailInput);
  retry?.addEventListener("click", () => { void onRetry(false); });
}

export function getPlanUserEmail() {
  return cachedEmail;
}

export async function refreshPlanUserSession() {
  try {
    const response = await fetch("/api/planillas/session", SESSION_OPTS);
    const data = await response.json().catch(() => ({}));
    cachedEmail = data.email || null;
  } catch {
    cachedEmail = null;
  }
  updatePlanUserBadge();
  return cachedEmail;
}

/** Re-establece la cookie de sesión desde el correo guardado en el navegador. */
export async function syncPlanUserSession() {
  const hint = localStorage.getItem("st2_plan_user_hint");
  if (!hint) return refreshPlanUserSession();

  // Super-admin: no reabrir sesión solo con el mail guardado; hace falta cookie o contraseña.
  if (isSuperAdminEmail(hint)) {
    return refreshPlanUserSession();
  }

  try {
    const response = await fetch("/api/planillas/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: hint }),
      credentials: "include",
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      cachedEmail = data.email || null;
      updatePlanUserBadge();
      return cachedEmail;
    }
    const status = String(data.status || "").toLowerCase();
    if (status === "pending" || (response.status === 403 && status !== "rejected")) {
      lastPendingAccess = {
        email: data.email || hint,
      };
      return null;
    }
  } catch {
    /* fallback a GET */
  }
  return refreshPlanUserSession();
}

export async function ensurePlanUser({ forcePrompt = false } = {}) {
  const synced = await syncPlanUserSession();
  if (!forcePrompt && synced) return synced;
  await refreshPlanUserSession();
  if (!forcePrompt && cachedEmail) return cachedEmail;

  if (modalPromise) return modalPromise;

  modalPromise = new Promise((resolve) => {
    showPlanUserModal(resolve);
  }).finally(() => {
    modalPromise = null;
  });

  return modalPromise;
}

export async function clearPlanUserSession() {
  await fetch("/api/planillas/session", { method: "DELETE", ...SESSION_OPTS });
  cachedEmail = null;
  updatePlanUserBadge();
  lockAppShell();
  return ensureAppAccess();
}

export function planUserFetch(url, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const canCoalesce = method === "GET" && !options.body && !options.signal;
  if (canCoalesce) {
    const existing = inflightGets.get(url);
    if (existing) return existing;
  }

  const run = fetchWithRetry(url, { ...options, credentials: "include" });
  if (canCoalesce) {
    inflightGets.set(url, run);
    void run.finally(() => {
      if (inflightGets.get(url) === run) inflightGets.delete(url);
    });
  }
  return run;
}

const inflightGets = new Map();

async function fetchWithRetry(url, options) {
  const maxAttempts = 4;
  let lastRes = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    lastRes = await fetch(url, options);
    // Cloudflare 1015 llega como 429; también reintentamos 503 ocasionales.
    if (lastRes.status !== 429 && lastRes.status !== 503) return lastRes;
    if (attempt >= maxAttempts - 1) break;
    const retryAfter = Number(lastRes.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 12000)
      : 700 * (2 ** attempt) + Math.floor(Math.random() * 350);
    await sleep(waitMs);
  }
  return lastRes;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showPlanUserModal(resolve) {
  const overlay = document.getElementById("plan-user-overlay");
  const input = document.getElementById("plan-user-email");
  const passInput = document.getElementById("plan-user-pass");
  const passWrap = document.getElementById("plan-user-pass-wrap");
  const error = document.getElementById("plan-user-error");
  if (!overlay || !input) {
    resolve(null);
    return;
  }

  input.value = localStorage.getItem("st2_plan_user_hint") || "";
  if (passInput) passInput.value = "";
  syncPasswordFieldVisibility(input, passWrap, passInput);
  if (error) error.textContent = "";
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  input.focus();
  input.select();

  const onSubmit = async () => {
    const email = input.value.trim();
    const password = passInput?.value || "";
    if (error) error.textContent = "";
    if (!email) {
      if (error) error.textContent = "Ingresá tu correo.";
      return;
    }
    if (!isAllowedEmail(email)) {
      if (error) error.textContent = EMAIL_HINT;
      return;
    }
    if (isSuperAdminEmail(email) && !password) {
      syncPasswordFieldVisibility(input, passWrap, passInput);
      if (error) error.textContent = "Ingresá la contraseña de este correo.";
      passInput?.focus();
      return;
    }

    let response;
    try {
      const payload = { email };
      if (isSuperAdminEmail(email)) payload.password = password;
      response = await fetch("/api/planillas/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
    } catch {
      if (error) error.textContent = "No se pudo contactar al servidor. ¿Está corriendo dotnet run?";
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      if (error) {
        error.textContent = response.status === 404 || response.status === 405
          ? "El servidor es una versión anterior. Cerrá PortalClienchi.Web y volvé a ejecutar dotnet run."
          : "Respuesta inesperada del servidor. Reiniciá la app y probá de nuevo.";
      }
      return;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (data.requiresPassword || String(data.status || "").toLowerCase() === "password_required") {
        syncPasswordFieldVisibility(input, passWrap, passInput);
        if (error) error.textContent = data.error || "Este correo pide contraseña.";
        passInput?.focus();
        return;
      }
      if (error) error.textContent = data.error || EMAIL_HINT;
      return;
    }

    if (!data.email) {
      if (error) error.textContent = "El servidor no confirmó el correo. Reiniciá la app e intentá de nuevo.";
      return;
    }

    cachedEmail = data.email;
    localStorage.setItem("st2_plan_user_hint", data.email);
    if (passInput) passInput.value = "";
    await refreshPlanUserSession();
    if (!cachedEmail) {
      if (error) error.textContent = "No se pudo confirmar la sesión. Probá de nuevo.";
      return;
    }
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    cleanup();
    updatePlanUserBadge();
    resolve(cachedEmail);
  };

  const onCancel = () => {
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    cleanup();
    resolve(null);
  };

  const onEmailInput = () => {
    syncPasswordFieldVisibility(input, passWrap, passInput);
  };

  const cleanup = () => {
    document.getElementById("plan-user-submit")?.removeEventListener("click", onSubmit);
    document.getElementById("plan-user-cancel")?.removeEventListener("click", onCancel);
    input.removeEventListener("keydown", onKey);
    passInput?.removeEventListener("keydown", onKey);
    input.removeEventListener("input", onEmailInput);
  };

  const onKey = (e) => {
    if (e.key === "Enter") onSubmit();
    if (e.key === "Escape") onCancel();
  };

  document.getElementById("plan-user-submit")?.addEventListener("click", onSubmit);
  document.getElementById("plan-user-cancel")?.addEventListener("click", onCancel);
  input.addEventListener("keydown", onKey);
  passInput?.addEventListener("keydown", onKey);
  input.addEventListener("input", onEmailInput);
}

function updatePlanUserBadge() {
  updateSessionEmailDisplay();
  const badge = document.getElementById("op-gestor-user-badge");
  if (!badge) return;
  if (cachedEmail) {
    badge.textContent = cachedEmail;
    badge.title = "Clic para cambiar usuario";
    badge.classList.remove("hidden");
    if (!badge.dataset.bound) {
      badge.dataset.bound = "1";
      badge.style.cursor = "pointer";
      badge.addEventListener("click", async () => {
        await clearPlanUserSession();
        const email = await ensurePlanUser({ forcePrompt: true });
        if (email && typeof window.__st2ReloadGestor === "function") {
          await window.__st2ReloadGestor(email);
        }
      });
    }
  } else {
    badge.textContent = "";
    badge.title = "";
    badge.classList.add("hidden");
  }
}
