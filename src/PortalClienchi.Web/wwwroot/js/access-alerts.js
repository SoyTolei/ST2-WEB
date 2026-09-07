import { getPlanUserEmail, planUserFetch } from "./plan-user.js";
import { isSt2SuperAdmin, isPrimarySuperAdmin, isViewingAsProfile } from "./module-access.js";
import { notifyOwnerPresetDesktop } from "./st2-desktop-notif.js";
import { setSt2AlertToast, clearSt2AlertToast, ST2_TOAST } from "./st2-sonner.js";

const POLL_MS_VISIBLE = 5000;
const POLL_MS_HIDDEN = 30000;
const REFRESH_THROTTLE_MS = 2500;
const DISMISS_KEY = "st2-access-confirm-toast-dismissed-v3";
const OWNER_DISMISS_KEY = "st2-access-owner-toast-dismissed-v3";

let pollTimer = null;
let retryTimer = null;
let retryCount = 0;
let cachedAlerts = [];
let cachedOwnerNotices = [];
let refreshInFlight = null;
let lastRefreshAt = 0;
let confirmToastDismissedSig = "";
let ownerToastDismissedSig = "";
let lastOwnerDesktopSig = "";

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
    cachedOwnerNotices = [];
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
        cachedOwnerNotices = [];
        renderAccessAlertUi();
        return cachedAlerts;
      }
      const data = await res.json().catch(() => ({}));
      cachedAlerts = (Array.isArray(data.items) ? data.items : []).map(normalizeAlert);
      cachedOwnerNotices = isPrimarySuperAdmin()
        ? (Array.isArray(data.ownerNotices) ? data.ownerNotices : []).map(normalizeOwnerNotice)
        : [];

      const sig = pendingSignature(cachedAlerts);
      const stored = readDismissedSig();
      if (stored && stored !== sig) {
        confirmToastDismissedSig = "";
        writeDismissedSig("");
      } else if (stored && stored === sig) {
        confirmToastDismissedSig = sig;
      }

      const ownerSig = ownerNoticesSignature(cachedOwnerNotices);
      const ownerStored = readOwnerDismissedSig();
      if (ownerStored && ownerStored !== ownerSig) {
        ownerToastDismissedSig = "";
        writeOwnerDismissedSig("");
      } else if (ownerStored && ownerStored === ownerSig) {
        ownerToastDismissedSig = ownerSig;
      }

      if (cachedOwnerNotices.length && ownerSig && ownerSig !== lastOwnerDesktopSig) {
        lastOwnerDesktopSig = ownerSig;
        const first = cachedOwnerNotices[0];
        notifyOwnerPresetDesktop(cachedOwnerNotices.length, first?.actorEmail, first?.targetEmail, ownerSig);
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

function ownerNoticesSignature(notices) {
  return notices
    .map((n) => String(n.id || ""))
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

function readOwnerDismissedSig() {
  try {
    return sessionStorage.getItem(OWNER_DISMISS_KEY) || "";
  } catch {
    return "";
  }
}

function writeOwnerDismissedSig(sig) {
  try {
    if (!sig) sessionStorage.removeItem(OWNER_DISMISS_KEY);
    else sessionStorage.setItem(OWNER_DISMISS_KEY, sig);
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

function normalizeOwnerNotice(raw) {
  const src = raw || {};
  return {
    id: Number(src.id ?? src.Id ?? 0) || 0,
    kind: src.kind ?? src.Kind ?? "",
    targetEmail: src.targetEmail ?? src.TargetEmail ?? "",
    actorEmail: src.actorEmail ?? src.ActorEmail ?? "",
    message: src.message ?? src.Message ?? "",
    createdAt: src.createdAt ?? src.CreatedAt ?? "",
  };
}

export function markAccessAlertsSeen() {
  const sig = pendingSignature(cachedAlerts);
  confirmToastDismissedSig = sig;
  writeDismissedSig(sig);
  renderAccessAlertUi();
}

/** Cerrar la X del toast de owner: solo oculta; no marca seen en servidor. */
function dismissOwnerToastOnly() {
  const sig = ownerNoticesSignature(cachedOwnerNotices);
  if (!sig) return;
  ownerToastDismissedSig = sig;
  writeOwnerDismissedSig(sig);
  renderAccessAlertUi();
}

export async function markOwnerNoticesSeen() {
  if (!isPrimarySuperAdmin() || !cachedOwnerNotices.length) {
    ownerToastDismissedSig = ownerNoticesSignature(cachedOwnerNotices);
    writeOwnerDismissedSig(ownerToastDismissedSig);
    renderAccessAlertUi();
    return;
  }
  const ids = cachedOwnerNotices.map((n) => n.id).filter((id) => id > 0);
  try {
    await planUserFetch("/api/access/owner-notices/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
  } catch {
    // ignore
  }
  cachedOwnerNotices = [];
  ownerToastDismissedSig = "";
  writeOwnerDismissedSig("");
  lastOwnerDesktopSig = "";
  renderAccessAlertUi();
}

function summarizeAlerts(alerts) {
  const n = alerts.length;
  const text = n === 1
    ? "Tenés 1 solicitud de acceso para aprobar"
    : `Tenés ${n} solicitudes de acceso para aprobar`;
  return { tone: "warn", text };
}

function summarizeOwnerNotices(notices) {
  const n = notices.length;
  if (n === 1) {
    const item = notices[0];
    const actor = String(item.actorEmail || "").split("@")[0] || "ADMIN WEB";
    const target = String(item.targetEmail || "").split("@")[0] || "perfil";
    return {
      tone: "warn",
      text: item.message || `${actor} creó el perfil ${target}`,
    };
  }
  return {
    tone: "warn",
    text: `ADMIN WEB creó ${n} perfiles nuevos`,
  };
}

export function renderAccessAlertUi() {
  const count = cachedAlerts.length;
  const label = count > 99 ? "99+" : String(count);
  const summary = count ? summarizeAlerts(cachedAlerts) : null;
  const hideToast = !!count
    && (confirmToastDismissedSig === pendingSignature(cachedAlerts) || readDismissedSig() === pendingSignature(cachedAlerts));

  const ownerCount = cachedOwnerNotices.length;
  const ownerLabel = ownerCount > 99 ? "99+" : String(ownerCount);
  const ownerSummary = ownerCount ? summarizeOwnerNotices(cachedOwnerNotices) : null;
  const ownerSig = ownerNoticesSignature(cachedOwnerNotices);
  const hideOwnerToast = !!ownerCount
    && (ownerToastDismissedSig === ownerSig || readOwnerDismissedSig() === ownerSig);

  const badgeTotal = count + (isPrimarySuperAdmin() ? ownerCount : 0);
  const badgeLabel = badgeTotal > 99 ? "99+" : String(badgeTotal);
  const adminBadge = document.getElementById("st2-admin-tab-badge");
  if (adminBadge) {
    adminBadge.textContent = badgeLabel;
    adminBadge.classList.toggle("hidden", badgeTotal === 0 || !isSt2SuperAdmin());
    adminBadge.setAttribute("aria-hidden", badgeTotal && isSt2SuperAdmin() ? "false" : "true");
  }

  const openAdmin = () => {
    document.dispatchEvent(new CustomEvent("st2:open-admin-from-alert"));
  };

  if (count === 0 || !summary || hideToast) {
    clearSt2AlertToast(ST2_TOAST.access);
  } else {
    setSt2AlertToast({
      id: ST2_TOAST.access,
      body: summary.text,
      tone: "warn",
      actionLabel: "Ver",
      onAction: openAdmin,
      onDismiss: markAccessAlertsSeen,
    });
  }

  if (!isPrimarySuperAdmin() || ownerCount === 0 || !ownerSummary || hideOwnerToast) {
    clearSt2AlertToast(ST2_TOAST.accessOwner);
  } else {
    setSt2AlertToast({
      id: ST2_TOAST.accessOwner,
      body: ownerSummary.text,
      tone: "warn",
      actionLabel: "Ver",
      onAction: () => {
        void markOwnerNoticesSeen();
        openAdmin();
      },
      onDismiss: dismissOwnerToastOnly,
    });
  }
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
  ownerToastDismissedSig = readOwnerDismissedSig();
  void refreshAccessAlerts({ force: true });
  schedulePollTick();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", onWindowFocus);
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
