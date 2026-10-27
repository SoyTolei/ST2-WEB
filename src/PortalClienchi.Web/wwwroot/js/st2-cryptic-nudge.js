/**
 * Aviso del Críptico: toast en Planillas, globo del blobatar y notif de escritorio.
 * Se repite hasta que jueguen la ronda abierta; si lo cierran, vuelve a los 40 min.
 */
import { setSt2AlertToast, clearSt2AlertToast, ST2_TOAST } from "./st2-sonner.js?v=20261027a";
import { notifyCrypticDesktop } from "./st2-desktop-notif.js?v=20261027a";

const DISMISS_KEY = "st2-cryptic-nudge-v1";
const SNOOZE_MS = 40 * 60 * 1000;
const RETRY_MS = 60 * 1000;

let inited = false;
let lastDetail = { pending: false };
let retryTimer = 0;

function pendingSignature(detail) {
  const date = String(detail?.date || "");
  const slots = (detail?.slots || []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!date || !slots.length) return "";
  return `${date}:${slots.join(",")}`;
}

function nudgeCopy(detail) {
  if (detail?.afternoon) return "Ya salió el Críptico de la tarde.";
  return "Falta el Críptico de hoy.";
}

function readSnooze() {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || "null");
  } catch {
    return null;
  }
}

function writeSnooze(sig) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify({ sig, until: Date.now() + SNOOZE_MS }));
  } catch { /* ignore */ }
}

function isSnoozed(sig) {
  if (!sig) return false;
  const row = readSnooze();
  if (!row || row.sig !== sig) return false;
  return Number(row.until) > Date.now();
}

function openCryptic() {
  document.dispatchEvent(new CustomEvent("st2:open-cryptic"));
}

function paintToast(detail = lastDetail) {
  const pending = Boolean(detail?.pending);
  const sig = pendingSignature(detail);
  if (!pending || !sig) {
    clearSt2AlertToast(ST2_TOAST.cryptic);
    return;
  }
  if (isSnoozed(sig)) {
    clearSt2AlertToast(ST2_TOAST.cryptic);
    return;
  }

  const body = nudgeCopy(detail);
  setSt2AlertToast({
    id: ST2_TOAST.cryptic,
    body,
    tone: "ok",
    actionLabel: "Jugar",
    onAction: () => {
      writeSnooze(sig);
      openCryptic();
    },
    onDismiss: () => writeSnooze(sig),
  });
}

function onPending(event) {
  const detail = event?.detail && typeof event.detail === "object"
    ? event.detail
    : { pending: Boolean(event?.detail?.pending) };
  const prevSig = pendingSignature(lastDetail);
  const nextSig = pendingSignature(detail);
  lastDetail = detail;

  if (nextSig && nextSig !== prevSig) {
    const row = readSnooze();
    if (row && row.sig !== nextSig) {
      try { localStorage.removeItem(DISMISS_KEY); } catch { /* ignore */ }
    }
    if (detail.pending) {
      notifyCrypticDesktop(nudgeCopy(detail), nextSig, { allowWhileVisible: false });
    }
  }

  paintToast(detail);
}

function tickSnooze() {
  if (!lastDetail?.pending) return;
  const sig = pendingSignature(lastDetail);
  if (sig && !isSnoozed(sig)) paintToast(lastDetail);
}

export function initCrypticNudge() {
  if (inited) return;
  inited = true;
  document.addEventListener("st2:cryptic-pending", onPending);
  document.addEventListener("st2:planillas-home", () => paintToast(lastDetail));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) paintToast(lastDetail);
  });
  window.clearInterval(retryTimer);
  retryTimer = window.setInterval(tickSnooze, RETRY_MS);
}
