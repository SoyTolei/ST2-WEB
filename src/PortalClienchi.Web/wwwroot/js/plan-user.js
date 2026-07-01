let cachedEmail = null;
let modalPromise = null;
let accessPromise = null;
let appUnlocked = false;

const SESSION_OPTS = { credentials: "include" };
const CORPORATE_DOMAIN = "@thomsonreuters.com";

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

function showAccessGate(resolve) {
  const gate = document.getElementById("st2-access-gate");
  const input = document.getElementById("st2-access-email");
  const error = document.getElementById("st2-access-error");
  const submit = document.getElementById("st2-access-submit");
  if (!gate || !input || !submit) {
    resolve(null);
    return;
  }

  lockAppShell();
  input.value = localStorage.getItem("st2_plan_user_hint") || "";
  if (error) error.textContent = "";
  input.focus();
  input.select();

  const onSubmit = async () => {
    const email = input.value.trim();
    if (error) error.textContent = "";
    if (!email) {
      if (error) error.textContent = "Ingresá tu correo corporativo.";
      return;
    }
    if (!email.toLowerCase().includes(CORPORATE_DOMAIN)) {
      if (error) error.textContent = `Solo se permiten correos ${CORPORATE_DOMAIN}`;
      return;
    }

    submit.disabled = true;
    let response;
    try {
      response = await fetch("/api/planillas/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });
    } catch {
      if (error) error.textContent = "No se pudo contactar al servidor.";
      submit.disabled = false;
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      if (error) error.textContent = "Respuesta inesperada del servidor.";
      submit.disabled = false;
      return;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (error) error.textContent = data.error || "Correo no válido.";
      submit.disabled = false;
      return;
    }

    if (!data.email) {
      if (error) error.textContent = "No se pudo confirmar la sesión.";
      submit.disabled = false;
      return;
    }

    cachedEmail = data.email;
    localStorage.setItem("st2_plan_user_hint", data.email);
    await refreshPlanUserSession();
    if (!cachedEmail) {
      if (error) error.textContent = "No se pudo confirmar la sesión. Probá de nuevo.";
      submit.disabled = false;
      return;
    }

    cleanup();
    unlockAppShell();
    updatePlanUserBadge();
    resolve(cachedEmail);
  };

  const cleanup = () => {
    submit.removeEventListener("click", onSubmit);
    input.removeEventListener("keydown", onKey);
    submit.disabled = false;
  };

  const onKey = (e) => {
    if (e.key === "Enter") onSubmit();
  };

  submit.addEventListener("click", onSubmit);
  input.addEventListener("keydown", onKey);
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

  try {
    const response = await fetch("/api/planillas/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: hint }),
      credentials: "include",
    });
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      cachedEmail = data.email || null;
      updatePlanUserBadge();
      return cachedEmail;
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
  return fetch(url, { ...options, credentials: "include" });
}

function showPlanUserModal(resolve) {
  const overlay = document.getElementById("plan-user-overlay");
  const input = document.getElementById("plan-user-email");
  const error = document.getElementById("plan-user-error");
  if (!overlay || !input) {
    resolve(null);
    return;
  }

  input.value = localStorage.getItem("st2_plan_user_hint") || "";
  if (error) error.textContent = "";
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  input.focus();
  input.select();

  const onSubmit = async () => {
    const email = input.value.trim();
    if (error) error.textContent = "";
    if (!email) {
      if (error) error.textContent = "Ingresá tu correo corporativo.";
      return;
    }

    let response;
    try {
      response = await fetch("/api/planillas/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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
      if (error) error.textContent = data.error || "Correo no válido.";
      return;
    }

    if (!data.email) {
      if (error) error.textContent = "El servidor no confirmó el correo. Reiniciá la app e intentá de nuevo.";
      return;
    }

    cachedEmail = data.email;
    localStorage.setItem("st2_plan_user_hint", data.email);
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

  const cleanup = () => {
    document.getElementById("plan-user-submit")?.removeEventListener("click", onSubmit);
    document.getElementById("plan-user-cancel")?.removeEventListener("click", onCancel);
    input.removeEventListener("keydown", onKey);
  };

  const onKey = (e) => {
    if (e.key === "Enter") onSubmit();
    if (e.key === "Escape") onCancel();
  };

  document.getElementById("plan-user-submit")?.addEventListener("click", onSubmit);
  document.getElementById("plan-user-cancel")?.addEventListener("click", onCancel);
  input.addEventListener("keydown", onKey);
}

function updatePlanUserBadge() {
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
