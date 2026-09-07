import { getPlanUserEmail, planUserFetch } from "./plan-user.js";
import {
  canSeeBorradoBasesModule,
  canConfirmBorradoBasesModule,
  isViewingAsProfile,
} from "./module-access.js";
import { setPlanillasTabAlertPart } from "./planillas-tab-badge.js";
import { notifyBorradoDesktop } from "./st2-desktop-notif.js";
import { setSt2AlertToast, clearSt2AlertToast, ST2_TOAST } from "./st2-sonner.js";

const POLL_MS_VISIBLE = 5000;
const POLL_MS_HIDDEN = 30000;
const REFRESH_THROTTLE_MS = 2500;
const DISMISS_KEYS_LEGACY = [
  "st2-borrado-confirm-toast-dismissed-v1",
  "st2-borrado-confirm-toast-dismissed-v2",
  "st2-borrado-confirm-toast-dismissed-v3",
  "st2-borrado-confirm-toast-dismissed-v4",
];

let pollTimer = null;
let retryTimer = null;
let retryCount = 0;
let cachedAlerts = [];
let alertMode = "requester"; // "confirm" | "requester"
let refreshInFlight = null;
let lastRefreshAt = 0;

function clearLegacyDismissKeys() {
  try {
    for (const key of DISMISS_KEYS_LEGACY) sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

const KIND_READY = "ready";
const KIND_NOTE = "note";
const KIND_PARTIAL = "partial";
const KIND_PENDING = "pending";
const KIND_INCORRECTO = "incorrecto";

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
    // No vaciar cache por flicker de permisos: solo ocultar UI.
    renderBorradoAlertUi({ forceHide: true });
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

      // Confirmador: cola pendiente. Vista previa / ver como: ?mode=confirm.
      const alertsUrl = isViewingAsProfile() && canConfirmBorradoBasesModule()
        ? "/api/planillas/borrado-bases/alerts?mode=confirm"
        : "/api/planillas/borrado-bases/alerts";
      const res = await planUserFetch(alertsUrl);
      if (res.status === 401 || res.status === 403) {
        // No vaciar cache por un 403 momentáneo de flags.
        renderBorradoAlertUi();
        return cachedAlerts;
      }
      const data = await res.json().catch(() => ({}));
      alertMode = String(data.mode || "").toLowerCase() === "confirm" ? "confirm" : "requester";
      cachedAlerts = (Array.isArray(data.items) ? data.items : []).map(normalizeAlert);
      if (alertMode === "confirm") {
        notifyBorradoDesktop(cachedAlerts.length, pendingSignature(cachedAlerts));
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

function normalizeAlert(raw) {
  const src = raw || {};
  const kindRaw = String(src.kind ?? src.Kind ?? KIND_READY).trim().toLowerCase();
  let kind = KIND_READY;
  if (kindRaw === KIND_PENDING || kindRaw === "review") kind = KIND_PENDING;
  else if (kindRaw === KIND_PARTIAL || kindRaw === "parcial") kind = KIND_PARTIAL;
  else if (kindRaw === KIND_INCORRECTO) kind = KIND_INCORRECTO;
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
  if (alertMode === "confirm") return;

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

/**
 * Al entrar al módulo:
 * - confirm/pendientes: no tocar el toast.
 * - solicitante: solo “eliminada/listo” sin observación; el resto espera a abrirla.
 */
export async function markBorradoAlertsSeenOnEnter() {
  if (alertMode === "confirm") return;
  const readyIds = cachedAlerts
    .filter((a) => a.kind === KIND_READY)
    .map((a) => a.id)
    .filter((id) => id > 0);
  if (!readyIds.length) return;
  await markBorradoAlertsSeen(readyIds);
}

/** Al abrir/ver una observación o resultado con nota (pop / modal). */
export async function markBorradoObservationOpened(solicitudId) {
  if (alertMode === "confirm") return;
  const sid = Number(solicitudId) || 0;
  if (!sid) return;
  const ids = cachedAlerts
    .filter((a) => (a.solicitudId || a.id) === sid)
    .filter((a) => a.kind === KIND_NOTE || a.kind === KIND_PARTIAL || a.kind === KIND_INCORRECTO)
    .map((a) => a.id)
    .filter((id) => id > 0);
  if (!ids.length) return;
  await markBorradoAlertsSeen(ids);
}

function summarizeAlerts(alerts) {
  if (alertMode === "confirm") {
    const n = alerts.length;
    const text = n === 1
      ? "Tenés 1 borrado de bases pendiente para confirmar"
      : `Tenés ${n} borrados de bases pendientes para confirmar`;
    return {
      tone: "warn",
      text,
      counts: { pending: n },
    };
  }

  const counts = { ready: 0, note: 0, partial: 0, incorrecto: 0 };
  for (const a of alerts) {
    if (a.kind === KIND_PARTIAL) counts.partial += 1;
    else if (a.kind === KIND_NOTE) counts.note += 1;
    else if (a.kind === KIND_INCORRECTO) counts.incorrecto += 1;
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
  if (counts.incorrecto > 0) {
    parts.push(counts.incorrecto === 1
      ? "una solicitud de borrado marcada como incorrecta"
      : `${counts.incorrecto} solicitudes de borrado marcadas como incorrectas`);
  }
  if (counts.note > 0) {
    parts.push(counts.note === 1
      ? "una observación nueva en borrado de bases"
      : `${counts.note} observaciones nuevas en borrado de bases`);
  }

  const tone = (counts.partial > 0 || counts.note > 0 || counts.incorrecto > 0) ? "warn" : "ok";
  const text = parts.length
    ? `Tenés ${parts.join(" y ")}`
    : "Tenés novedades en borrado de bases";

  return { tone, text, counts };
}

export function renderBorradoAlertUi({ forceHide = false } = {}) {
  const count = cachedAlerts.length;
  const label = count > 99 ? "99+" : String(count);
  const summary = count ? summarizeAlerts(cachedAlerts) : null;
  const sistema = document.body.dataset.planSistema;
  const hideForSistema = forceHide || sistema === "Legal" || sistema === "Chile";

  const tabHidden = count === 0 || hideForSistema;
  setPlanillasTabAlertPart("borrado", {
    count: hideForSistema ? 0 : count,
    title: summary?.text || "",
    hidden: tabHidden,
  });

  const modBadge = document.getElementById("plan-modulo-borrado-badge");
  if (modBadge) {
    modBadge.textContent = label;
    modBadge.classList.toggle("hidden", count === 0 || hideForSistema);
    modBadge.setAttribute("aria-hidden", count && !hideForSistema ? "false" : "true");
  }

  if (count === 0 || !summary || hideForSistema) {
    clearSt2AlertToast(ST2_TOAST.borrado);
  } else {
    const openBorrado = () => {
      document.querySelector('.tab-btn[data-tab="planillas"]')?.click();
      document.dispatchEvent(new CustomEvent("st2:open-borrado-from-alert"));
    };
    setSt2AlertToast({
      id: ST2_TOAST.borrado,
      body: summary.text,
      tone: "warn",
      actionLabel: "Ver",
      sticky: true,
      onAction: openBorrado,
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
    void refreshBorradoAlerts();
  }, pollIntervalMs());
}

export function startBorradoAlertsPolling() {
  stopBorradoAlertsPolling();
  clearLegacyDismissKeys();
  void refreshBorradoAlerts({ force: true });
  schedulePollTick();

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", onWindowFocus);
  document.addEventListener("st2:view-as-changed", onViewAsChanged);
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
  document.removeEventListener("st2:view-as-changed", onViewAsChanged);
}

function onViewAsChanged() {
  clearLegacyDismissKeys();
  void refreshBorradoAlerts({ force: true });
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
