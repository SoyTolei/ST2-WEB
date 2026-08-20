import { getPlanUserEmail, planUserFetch } from "./plan-user.js";
import { canSeeBlanqueoModule, canConfirmBlanqueoModule } from "./module-access.js";

const POLL_MS_VISIBLE = 5000;
const POLL_MS_HIDDEN = 30000;
const REFRESH_THROTTLE_MS = 2500;
const DISMISS_KEY = "st2-blanqueo-confirm-toast-dismissed-v2";

let pollTimer = null;
let retryTimer = null;
let retryCount = 0;
let cachedAlerts = [];
let alertMode = "requester"; // "confirm" | "requester"
let toastBound = false;
let refreshInFlight = null;
let lastRefreshAt = 0;
/** En modo confirm: oculta el toast hasta que cambie la cola. */
let confirmToastDismissedSig = "";

const KIND_READY = "ready";
const KIND_NOTE = "note";
const KIND_NO_REG = "no_registrado";
const KIND_PENDING = "pending";

export function getBlanqueoAlertCount() {
  return cachedAlerts.length;
}

export function getBlanqueoAlerts() {
  return cachedAlerts.slice();
}

/** Refresca alertas al instante (p. ej. tras confirmar o cargar una solicitud). */
export function notifyBlanqueoChanged() {
  void refreshBlanqueoAlerts({ force: true });
}

export async function refreshBlanqueoAlerts({ force = false } = {}) {
  const email = getPlanUserEmail();
  const canSee = canSeeBlanqueoModule() || canConfirmBlanqueoModule();
  if (!email || !canSee) {
    cachedAlerts = [];
    alertMode = "requester";
    renderBlanqueoAlertUi();
    if (!email) scheduleAlertsRetry();
    return cachedAlerts;
  }

  retryCount = 0;
  const now = Date.now();
  if (!force && refreshInFlight) return refreshInFlight;
  if (!force && lastRefreshAt > 0 && now - lastRefreshAt < REFRESH_THROTTLE_MS) {
    renderBlanqueoAlertUi();
    return cachedAlerts;
  }

  refreshInFlight = (async () => {
    try {
      const res = await planUserFetch("/api/planillas/blanqueo/alerts");
      if (res.status === 401 || res.status === 403) {
        cachedAlerts = [];
        alertMode = "requester";
        renderBlanqueoAlertUi();
        return cachedAlerts;
      }
      const data = await res.json().catch(() => ({}));
      alertMode = String(data.mode || "").toLowerCase() === "confirm" || canConfirmBlanqueoModule()
        ? "confirm"
        : "requester";
      cachedAlerts = (Array.isArray(data.items) ? data.items : []).map(normalizeAlert);
      if (alertMode === "confirm") {
        const sig = pendingSignature(cachedAlerts);
        const stored = readDismissedSig();
        // Si la cola cambió (nuevas / resueltas), reabrir el toast.
        if (stored && stored !== sig) {
          confirmToastDismissedSig = "";
          writeDismissedSig("");
        } else if (stored && stored === sig) {
          confirmToastDismissedSig = sig;
        }
      }
      lastRefreshAt = Date.now();
    } catch {
      // mantener cache anterior
    } finally {
      refreshInFlight = null;
    }

    renderBlanqueoAlertUi();
    return cachedAlerts;
  })();

  return refreshInFlight;
}

function scheduleAlertsRetry() {
  if (retryCount >= 8 || retryTimer) return;
  retryCount += 1;
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    void refreshBlanqueoAlerts({ force: true });
  }, 600 * retryCount);
}

function pendingSignature(alerts) {
  return alerts
    .map((a) => a.solicitudId || a.id)
    .filter((id) => id > 0)
    .sort((a, b) => a - b)
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
  const kindRaw = String(src.kind ?? src.Kind ?? KIND_READY).trim().toLowerCase();
  let kind = KIND_READY;
  if (kindRaw === KIND_PENDING || kindRaw === "review") kind = KIND_PENDING;
  else if (kindRaw === KIND_NO_REG || kindRaw === "no-registrado") kind = KIND_NO_REG;
  else if (kindRaw === KIND_NOTE || kindRaw === "aclaracion" || kindRaw === "observacion") kind = KIND_NOTE;

  return {
    id: src.id ?? src.Id ?? 0,
    solicitudId: src.solicitudId ?? src.SolicitudId ?? 0,
    portal: src.portal ?? src.Portal ?? "",
    nroCaso: src.nroCaso ?? src.NroCaso ?? "",
    correo: src.correo ?? src.Correo ?? "",
    tipoSolicitud: src.tipoSolicitud ?? src.TipoSolicitud ?? "",
    kind,
    createdAt: src.createdAt ?? src.CreatedAt ?? "",
  };
}

export async function markBlanqueoAlertsSeen(ids = null) {
  if (alertMode === "confirm") {
    const sig = pendingSignature(cachedAlerts);
    confirmToastDismissedSig = sig;
    writeDismissedSig(sig);
    renderBlanqueoAlertUi();
    return;
  }

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

function summarizeAlerts(alerts) {
  if (alertMode === "confirm") {
    const n = alerts.length;
    return {
      tone: "warn",
      text: n === 1
        ? "Tenés 1 blanqueo para confirmar o revisar"
        : `Tenés ${n} blanqueos para confirmar o revisar`,
      counts: { pending: n },
    };
  }

  const counts = { ready: 0, note: 0, no_registrado: 0 };
  for (const a of alerts) {
    if (a.kind === KIND_NO_REG) counts.no_registrado += 1;
    else if (a.kind === KIND_NOTE) counts.note += 1;
    else counts.ready += 1;
  }

  // Prioridad visual: rojo > amarillo > verde
  let tone = "ok";
  let text = "";
  if (counts.no_registrado > 0) {
    tone = "bad";
    text = counts.no_registrado === 1
      ? "Tenés 1 blanqueo no registrado"
      : `Tenés ${counts.no_registrado} blanqueos no registrados`;
  } else if (counts.note > 0) {
    tone = "warn";
    text = counts.note === 1
      ? "Tenés 1 blanqueo con una observación"
      : `Tenés ${counts.note} blanqueos con observación`;
  } else {
    tone = "ok";
    text = counts.ready === 1
      ? "Tenés un blanqueo de clave confirmado"
      : `Tenés ${counts.ready} blanqueos de clave confirmados`;
  }

  return { tone, text, counts };
}

export function renderBlanqueoAlertUi() {
  const count = cachedAlerts.length;
  const label = count > 99 ? "99+" : String(count);
  const summary = count ? summarizeAlerts(cachedAlerts) : null;
  const hideToast = alertMode === "confirm"
    && !!count
    && (confirmToastDismissedSig === pendingSignature(cachedAlerts) || readDismissedSig() === pendingSignature(cachedAlerts));
  const sistema = document.body.dataset.planSistema;
  const hideForSistema = sistema === "Legal" || sistema === "Chile";

  const tabBadge = document.querySelector('.tab-reminder-badge[data-reminder="planillas-blanqueo"]');
  if (tabBadge) {
    tabBadge.textContent = label;
    tabBadge.classList.toggle("hidden", count === 0 || hideForSistema);
    tabBadge.title = hideForSistema ? "" : (summary?.text || "");
    tabBadge.setAttribute("aria-hidden", count && !hideForSistema ? "false" : "true");
  }

  const modBadge = document.getElementById("plan-modulo-blanqueo-badge");
  if (modBadge) {
    modBadge.textContent = label;
    modBadge.classList.toggle("hidden", count === 0 || hideForSistema);
    modBadge.setAttribute("aria-hidden", count && !hideForSistema ? "false" : "true");
  }

  const toast = document.getElementById("blanqueo-ready-toast");
  const toastText = document.getElementById("blanqueo-ready-toast-text");
  const toastCount = document.getElementById("blanqueo-ready-toast-count");
  if (toast && toastText) {
    toast.classList.remove("is-ok", "is-warn", "is-bad");
    if (count === 0 || !summary || hideToast || hideForSistema) {
      toast.classList.add("hidden");
      toast.setAttribute("aria-hidden", "true");
    } else {
      if (toastCount) {
        toastCount.textContent = label;
        toastCount.setAttribute("aria-hidden", "false");
      }
      toastText.textContent = summary.text;
      toast.classList.add(summary.tone === "bad" ? "is-bad" : summary.tone === "warn" ? "is-warn" : "is-ok");
      toast.classList.remove("hidden");
      toast.setAttribute("aria-hidden", "false");
    }
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
    void refreshBlanqueoAlerts();
  }, pollIntervalMs());
}

export function startBlanqueoAlertsPolling() {
  stopBlanqueoAlertsPolling();
  confirmToastDismissedSig = readDismissedSig();
  void refreshBlanqueoAlerts({ force: true });
  schedulePollTick();

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", onWindowFocus);
  bindToastOnce();
}

export function stopBlanqueoAlertsPolling() {
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
    void refreshBlanqueoAlerts({ force: true });
  }
}

function onWindowFocus() {
  if (document.visibilityState !== "visible") return;
  void refreshBlanqueoAlerts({ force: true });
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
