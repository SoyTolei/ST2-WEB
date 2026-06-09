let cachedEmail = null;
let modalPromise = null;

const SESSION_OPTS = { credentials: "include" };

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
    badge.classList.remove("hidden");
  } else {
    badge.textContent = "";
    badge.classList.add("hidden");
  }
}
