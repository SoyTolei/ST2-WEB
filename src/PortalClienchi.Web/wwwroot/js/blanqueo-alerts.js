import { getPlanUserEmail, planUserFetch } from "./plan-user.js";
import { canSeeBlanqueoModule } from "./module-access.js";

const POLL_MS = 45000;
let pollTimer = null;
let cachedAlerts = [];
let toastBound = false;

export function getBlanqueoAlertCount() {
  return cachedAlerts.length;
}

export function getBlanqueoAlerts() {
  return cachedAlerts.slice();
}

export async function refreshBlanqueoAlerts() {
  const email = getPlanUserEmail();
  if (!email || !canSeeBlanqueoModule(email)) {
    cachedAlerts = [];
    renderBlanqueoAlertUi();
    return cachedAlerts;
  }

  try {
    const res = await planUserFetch("/api/planillas/blanqueo/alerts");
    if (res.status === 401 || res.status === 403) {
      cachedAlerts = [];
      renderBlanqueoAlertUi();
      return cachedAlerts;
    }
    const data = await res.json().catch(() => ({}));
    cachedAlerts = Array.isArray(data.items) ? data.items : [];
  } catch {
    // mantener cache anterior
  }

  renderBlanqueoAlertUi();
  return cachedAlerts;
}

export async function markBlanqueoAlertsSeen(ids = null) {
  if (!cachedAlerts.length && !ids?.length) return;
  try {
    await planUserFetch("/api/planillas/blanqueo/alerts/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids?.length ? { ids } : {}),
    });
  } catch {
    // ignore
  }
  if (!ids?.length) {
    cachedAlerts = [];
  } else {
    const drop = new Set(ids);
    cachedAlerts = cachedAlerts.filter((a) => !drop.has(a.id));
  }
  renderBlanqueoAlertUi();
}

export function renderBlanqueoAlertUi() {
  const count = cachedAlerts.length;
  const label = count > 99 ? "99+" : String(count);

  const tabBadge = document.querySelector('.tab-reminder-badge[data-reminder="planillas-blanqueo"]');
  if (tabBadge) {
    tabBadge.textContent = label;
    tabBadge.classList.toggle("hidden", count === 0);
    tabBadge.title = count
      ? (count === 1
        ? "Tenés 1 solicitud de blanqueo lista"
        : `Tenés ${count} solicitudes de blanqueo listas`)
      : "";
    tabBadge.setAttribute("aria-hidden", count ? "false" : "true");
  }

  const modBadge = document.getElementById("plan-modulo-blanqueo-badge");
  if (modBadge) {
    modBadge.textContent = label;
    modBadge.classList.toggle("hidden", count === 0);
    modBadge.setAttribute("aria-hidden", count ? "false" : "true");
  }

  const toast = document.getElementById("blanqueo-ready-toast");
  const toastText = document.getElementById("blanqueo-ready-toast-text");
  const toastCount = document.getElementById("blanqueo-ready-toast-count");
  if (toast && toastText) {
    if (count === 0) {
      toast.classList.add("hidden");
      toast.setAttribute("aria-hidden", "true");
    } else {
      if (toastCount) {
        toastCount.textContent = label;
        toastCount.setAttribute("aria-hidden", "false");
      }
      toastText.textContent = count === 1
        ? "Tenés 1 solicitud lista para usar"
        : `Tenés ${count} solicitudes listas para usar`;
      toast.classList.remove("hidden");
      toast.setAttribute("aria-hidden", "false");
    }
  }
}

export function startBlanqueoAlertsPolling() {
  stopBlanqueoAlertsPolling();
  void refreshBlanqueoAlerts();
  pollTimer = setInterval(() => {
    void refreshBlanqueoAlerts();
  }, POLL_MS);

  document.addEventListener("visibilitychange", onVisibility);
  bindToastOnce();
}

export function stopBlanqueoAlertsPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  document.removeEventListener("visibilitychange", onVisibility);
}

function onVisibility() {
  if (document.visibilityState === "visible") {
    void refreshBlanqueoAlerts();
  }
}

function bindToastOnce() {
  if (toastBound) return;
  toastBound = true;
  document.getElementById("blanqueo-ready-toast-open")?.addEventListener("click", () => {
    document.querySelector('.tab-btn[data-tab="planillas"]')?.click();
    document.dispatchEvent(new CustomEvent("st2:open-blanqueo-from-alert"));
  });
  document.getElementById("blanqueo-ready-toast-dismiss")?.addEventListener("click", () => {
    void markBlanqueoAlertsSeen();
  });
}
