import { getPlanUserEmail, planUserFetch } from "./plan-user.js";
import {
  canSeeBorradoBasesModule,
  canConfirmBorradoBasesModule,
  isViewingAsProfile,
} from "./module-access.js";

const POLL_MS_VISIBLE = 5000;
const POLL_MS_HIDDEN = 30000;
const REFRESH_THROTTLE_MS = 2500;
const DISMISS_KEY = "st2-borrado-confirm-toast-dismissed-v1";

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
const KIND_PARTIAL = "partial";
const KIND_PENDING = "pending";

export function getBorradoAlertCount() {
  return cachedAlerts.length;
}

export function getBorradoAlerts() {
  return cachedAlerts.slice();
}

/** Refresca alertas al instante (p. ej. tras confirmar o cargar una solicitud). */
export function notifyBorradoChanged() {
  void refreshBorradoAlerts({ force: true });
}

export async function refreshBorradoAlerts({ force = false } = {}) {
  const email = getPlanUserEmail();
  const canSee = canSeeBorradoBasesModule() || canConfirmBorradoBasesModule();
  if (!email || !canSee) {
    cachedAlerts = [];
    alertMode = "requester";
    renderBorradoAlertUi();
    if (!email) scheduleAlertsRetry();
    return cachedAlerts;
  }

  retryCount = 0;
  const now = Date.now();
  if (!force && refreshInFlight) return refreshInFlight;
  if (!force && lastRefreshAt > 0 && now - lastRefreshAt < REFRESH_THROTTLE_MS) {
    renderBorradoAlertUi();
    return cachedAlerts;
  }

  refreshInFlight = (async () => {
    try {
      // Vista previa de perfil: simular alertas como las vería esa persona.
      if (isViewingAsProfile() && !canConfirmBorradoBasesModule()) {
        cachedAlerts = [];
        alertMode = "requester";
        lastRefreshAt = Date.now();
        renderBorradoAlertUi();
        return cachedAlerts;
      }

      const alertsUrl = isViewingAsProfile() && canConfirmBorradoBasesModule()
        ? "/api/planillas/borrado-bases/alerts?mode=confirm"
        : "/api/planillas/borrado-bases/alerts";
      const res = await planUserFetch(alertsUrl);
      if (res.status === 401 || res.status === 403) {
        cachedAlerts = [];
        alertMode = "requester";
        renderBorradoAlertUi();
        return cachedAlerts;
      }
      const data = await res.json().catch(() => ({}));
      // Respetar el mode del API (si hay avisos personales, vienen como requester
      // aunque el usuario también pueda confirmar).
      alertMode = String(data.mode || "").toLowerCase() === "confirm" ? "confirm" : "requester";
      cachedAlerts = (Array.isArray(data.items) ? data.items : []).map(normalizeAlert);
      if (alertMode === "confirm") {
        const sig = pendingSignature(cachedAlerts);
        const stored = readDismissedSig();
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

    renderBorradoAlertUi();
    return cachedAlerts;
  })();

  return refreshInFlight;
}

function scheduleAlertsRetry() {
  if (retryCount >= 8 || retryTimer) return;
  retryCount += 1;
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    void refreshBorradoAlerts({ force: true });
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
  else if (kindRaw === KIND_PARTIAL || kindRaw === "parcial") kind = KIND_PARTIAL;
  else if (kindRaw === KIND_NOTE || kindRaw === "aclaracion" || kindRaw === "observacion") kind = KIND_NOTE;

  return {
    id: src.id ?? src.Id ?? 0,
    solicitudId: src.solicitudId ?? src.SolicitudId ?? 0,
    nroCaso: src.nroCaso ?? src.NroCaso ?? "",
    nroEmpresa: src.nroEmpresa ?? src.NroEmpresa ?? "",
    nombreEmpresa: src.nombreEmpresa ?? src.NombreEmpresa ?? "",
    cuit: src.cuit ?? src.Cuit ?? "",
    kind,
    createdAt: src.createdAt ?? src.CreatedAt ?? "",
  };
}

export async function markBorradoAlertsSeen(ids = null) {
  if (alertMode === "confirm") {
    const sig = pendingSignature(cachedAlerts);
    confirmToastDismissedSig = sig;
    writeDismissedSig(sig);
    renderBorradoAlertUi();
    return;
  }

  if (!cachedAlerts.length && !ids?.length) return;
  try {
    await planUserFetch("/api/planillas/borrado-bases/alerts/seen", {
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
  renderBorradoAlertUi();
}

function firstNameFromEmail(email) {
  const local = String(email || "").split("@")[0] || "";
  const first = local.split(/[._\-]+/).filter(Boolean)[0] || "";
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Saludo personal solo para quien carga solicitudes (no confirmadores). */
function greetRequester(message) {
  if (alertMode === "confirm") return message;
  const name = firstNameFromEmail(getPlanUserEmail());
  if (!name || !message) return message;
  const body = message.charAt(0).toLowerCase() + message.slice(1);
  return `Hola ${name} 🫡 ${body}`;
}

function escapeToastHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** El toast usa font-weight bold: el emoji hay que sacarlo de la negrita o Windows lo pixela. */
function setToastText(el, text) {
  if (!el) return;
  el.innerHTML = escapeToastHtml(text).replace(
    /🫡/g,
    '<span class="toast-emoji" aria-hidden="true">🫡</span>',
  );
}

function summarizeAlerts(alerts) {
  if (alertMode === "confirm") {
    const n = alerts.length;
    return {
      tone: "warn",
      text: n === 1
        ? "Tenés 1 borrado de bases para confirmar o revisar"
        : `Tenés ${n} borrados de bases para confirmar o revisar`,
      counts: { pending: n },
    };
  }

  const counts = { ready: 0, note: 0, partial: 0 };
  for (const a of alerts) {
    if (a.kind === KIND_PARTIAL) counts.partial += 1;
    else if (a.kind === KIND_NOTE) counts.note += 1;
    else counts.ready += 1;
  }

  const parts = [];
  if (counts.ready > 0) {
    parts.push(counts.ready === 1
      ? "una solicitud de borrado de bases ya eliminada"
      : `${counts.ready} solicitudes de borrado de bases ya eliminadas`);
  }
  if (counts.partial > 0) {
    parts.push(counts.partial === 1
      ? "una solicitud de borrado parcialmente realizada (revisá las aclaraciones)"
      : `${counts.partial} solicitudes de borrado parcialmente realizadas (revisá las aclaraciones)`);
  }
  if (counts.note > 0) {
    parts.push(counts.note === 1
      ? "una observación nueva en borrado de bases"
      : `${counts.note} observaciones nuevas en borrado de bases`);
  }

  const tone = (counts.partial > 0 || counts.note > 0) ? "warn" : "ok";
  const text = parts.length
    ? `Tenés ${parts.join(" y ")}`
    : "Tenés novedades en borrado de bases";

  return { tone, text: greetRequester(text), counts };
}

export function renderBorradoAlertUi() {
  const count = cachedAlerts.length;
  const label = count > 99 ? "99+" : String(count);
  const summary = count ? summarizeAlerts(cachedAlerts) : null;
  const hideToast = alertMode === "confirm"
    && !!count
    && (confirmToastDismissedSig === pendingSignature(cachedAlerts) || readDismissedSig() === pendingSignature(cachedAlerts));
  const sistema = document.body.dataset.planSistema;
  const hideForSistema = sistema === "Legal" || sistema === "Chile";

  const tabBadge = document.querySelector('.tab-reminder-badge[data-reminder="planillas-borrado"]');
  if (tabBadge) {
    tabBadge.textContent = label;
    tabBadge.classList.toggle("hidden", count === 0 || hideForSistema);
    tabBadge.title = hideForSistema ? "" : (summary?.text || "");
    tabBadge.setAttribute("aria-hidden", count && !hideForSistema ? "false" : "true");
  }

  const modBadge = document.getElementById("plan-modulo-borrado-badge");
  if (modBadge) {
    modBadge.textContent = label;
    modBadge.classList.toggle("hidden", count === 0 || hideForSistema);
    modBadge.setAttribute("aria-hidden", count && !hideForSistema ? "false" : "true");
  }

  const toast = document.getElementById("borrado-ready-toast");
  const toastText = document.getElementById("borrado-ready-toast-text");
  const toastCount = document.getElementById("borrado-ready-toast-count");
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
      setToastText(toastText, summary.text);
      toast.classList.add(summary.tone === "warn" ? "is-warn" : "is-ok");
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
    void refreshBorradoAlerts();
  }, pollIntervalMs());
}

export function startBorradoAlertsPolling() {
  stopBorradoAlertsPolling();
  confirmToastDismissedSig = readDismissedSig();
  void refreshBorradoAlerts({ force: true });
  schedulePollTick();

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", onWindowFocus);
  bindToastOnce();
}

export function stopBorradoAlertsPolling() {
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
    void refreshBorradoAlerts({ force: true });
  }
}

function onWindowFocus() {
  if (document.visibilityState !== "visible") return;
  void refreshBorradoAlerts({ force: true });
}

function bindToastOnce() {
  if (toastBound) return;
  toastBound = true;
  document.getElementById("borrado-ready-toast-open")?.addEventListener("click", () => {
    document.querySelector('.tab-btn[data-tab="planillas"]')?.click();
    document.dispatchEvent(new CustomEvent("st2:open-borrado-from-alert"));
  });
  document.getElementById("borrado-ready-toast-dismiss")?.addEventListener("click", () => {
    void markBorradoAlertsSeen();
  });
}
