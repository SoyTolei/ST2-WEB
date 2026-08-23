import { getPlanUserEmail, planUserFetch } from "./plan-user.js";
import { isSt2SuperAdmin, isViewingAsProfile } from "./module-access.js";
import { syncStackedToastGreetings } from "./st2-toast-greet.js";

const POLL_MS_VISIBLE = 5000;
const POLL_MS_HIDDEN = 30000;
const REFRESH_THROTTLE_MS = 2500;
const DISMISS_KEY = "st2-access-confirm-toast-dismissed-v1";

let pollTimer = null;
let retryTimer = null;
let retryCount = 0;
let cachedAlerts = [];
let toastBound = false;
let refreshInFlight = null;
let lastRefreshAt = 0;
let confirmToastDismissedSig = "";

export function getAccessAlertCount() {
  return cachedAlerts.length;
}

export function notifyAccessChanged() {
  void refreshAccessAlerts({ force: true });
}

export async function refreshAccessAlerts({ force = false } = {}) {
  const email = getPlanUserEmail();
  if (!email || !isSt2SuperAdmin() || isViewingAsProfile()) {
    cachedAlerts = [];
    renderAccessAlertUi();
    if (!email) scheduleAlertsRetry();
    return cachedAlerts;
  }

  retryCount = 0;
  const now = Date.now();
  if (!force && refreshInFlight) return refreshInFlight;
  if (!force && lastRefreshAt > 0 && now - lastRefreshAt < REFRESH_THROTTLE_MS) {
    renderAccessAlertUi();
    return cachedAlerts;
  }

  refreshInFlight = (async () => {
    try {
      const res = await planUserFetch("/api/access/alerts");
      if (res.status === 401 || res.status === 403) {
        cachedAlerts = [];
        renderAccessAlertUi();
        return cachedAlerts;
      }
      const data = await res.json().catch(() => ({}));
      cachedAlerts = (Array.isArray(data.items) ? data.items : []).map(normalizeAlert);
      const sig = pendingSignature(cachedAlerts);
      const stored = readDismissedSig();
      if (stored && stored !== sig) {
        confirmToastDismissedSig = "";
        writeDismissedSig("");
      } else if (stored && stored === sig) {
        confirmToastDismissedSig = sig;
      }
      lastRefreshAt = Date.now();
    } catch {
      // mantener cache
    } finally {
      refreshInFlight = null;
    }

    renderAccessAlertUi();
    return cachedAlerts;
  })();

  return refreshInFlight;
}

function scheduleAlertsRetry() {
  if (retryCount >= 8 || retryTimer) return;
  retryCount += 1;
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    void refreshAccessAlerts({ force: true });
  }, 600 * retryCount);
}

function pendingSignature(alerts) {
  return alerts
    .map((a) => String(a.email || "").toLowerCase())
    .filter(Boolean)
    .sort()
    .join(",");
}

function readDismissedSig() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) || "";
  } catch {
    return "";
  }
}

function writeDismissedSig(sig) {
  try {
    if (!sig) sessionStorage.removeItem(DISMISS_KEY);
    else sessionStorage.setItem(DISMISS_KEY, sig);
  } catch {
    // ignore
  }
}

function normalizeAlert(raw) {
  const src = raw || {};
  return {
    email: src.email ?? src.Email ?? "",
    displayName: src.displayName ?? src.DisplayName ?? "",
    createdAt: src.createdAt ?? src.CreatedAt ?? src.firstSeenAt ?? src.FirstSeenAt ?? "",
  };
}

export function markAccessAlertsSeen() {
  const sig = pendingSignature(cachedAlerts);
  confirmToastDismissedSig = sig;
  writeDismissedSig(sig);
  renderAccessAlertUi();
}

function summarizeAlerts(alerts) {
  const n = alerts.length;
  const text = n === 1
    ? "Tenés 1 solicitud de acceso para aprobar"
    : `Tenés ${n} solicitudes de acceso para aprobar`;
  return { tone: "warn", text };
}

export function renderAccessAlertUi() {
  const count = cachedAlerts.length;
  const label = count > 99 ? "99+" : String(count);
  const summary = count ? summarizeAlerts(cachedAlerts) : null;
  const hideToast = !!count
    && (confirmToastDismissedSig === pendingSignature(cachedAlerts) || readDismissedSig() === pendingSignature(cachedAlerts));

  const adminBadge = document.getElementById("st2-admin-tab-badge");
  if (adminBadge) {
    adminBadge.textContent = label;
    adminBadge.classList.toggle("hidden", count === 0 || !isSt2SuperAdmin());
    adminBadge.setAttribute("aria-hidden", count && isSt2SuperAdmin() ? "false" : "true");
  }

  const toast = document.getElementById("access-ready-toast");
  const toastText = document.getElementById("access-ready-toast-text");
  const toastCount = document.getElementById("access-ready-toast-count");
  if (toast && toastText) {
    toast.classList.remove("is-ok", "is-warn", "is-bad");
    if (count === 0 || !summary || hideToast) {
      toast.classList.add("hidden");
      toast.setAttribute("aria-hidden", "true");
      delete toast.dataset.toastBody;
    } else {
      if (toastCount) {
        toastCount.textContent = label;
        toastCount.setAttribute("aria-hidden", "false");
      }
      toast.dataset.toastBody = summary.text;
      toast.classList.add("is-warn");
      toast.classList.remove("hidden");
      toast.setAttribute("aria-hidden", "false");
    }
  }

  syncStackedToastGreetings();
}

function pollIntervalMs() {
  return document.visibilityState === "visible" ? POLL_MS_VISIBLE : POLL_MS_HIDDEN;
}

function schedulePollTick() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  pollTimer = setInterval(() => {
    void refreshAccessAlerts();
  }, pollIntervalMs());
}

export function startAccessAlertsPolling() {
  stopAccessAlertsPolling();
  confirmToastDismissedSig = readDismissedSig();
  void refreshAccessAlerts({ force: true });
  schedulePollTick();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", onWindowFocus);
  bindToastOnce();
}

export function stopAccessAlertsPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("focus", onWindowFocus);
}

function onVisibility() {
  schedulePollTick();
  if (document.visibilityState === "visible") {
    void refreshAccessAlerts({ force: true });
  }
}

function onWindowFocus() {
  if (document.visibilityState !== "visible") return;
  void refreshAccessAlerts({ force: true });
}

function bindToastOnce() {
  if (toastBound) return;
  toastBound = true;
  document.getElementById("access-ready-toast-open")?.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("st2:open-admin-from-alert"));
  });
  document.getElementById("access-ready-toast-dismiss")?.addEventListener("click", () => {
    markAccessAlertsSeen();
  });
}
