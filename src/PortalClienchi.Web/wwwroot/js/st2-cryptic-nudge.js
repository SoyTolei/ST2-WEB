/**
 * Recordatorio del Críptico: uno por día, a las 14:00 (Argentina), solo si quedan rondas
 * por jugar. Va a la campanita y, con la pestaña oculta, como notificación de escritorio.
 * "Una vez por día" se guarda en localStorage: no se repite al recargar ni entre pestañas.
 */
import { clearSt2AlertToast, ST2_TOAST } from "./st2-sonner.js";
import { notifyCrypticDesktop } from "./st2-desktop-notif.js";
import { removeNotifInboxEntry, upsertNotifInboxEntry } from "./st2-notif-inbox.js";

/** Hora del recordatorio (minutos desde 00:00, hora Argentina): después de que abre la ronda de 13:30. */
const REMIND_AT_MINUTE = 14 * 60;
const DAY_ID = "st2-toast-cryptic-day";
const LAST_DAY_KEY = "st2-cryptic-reminder-day-v1";
const BODY = "¿Ya jugaste el Críptico de hoy? Todavía tenés rondas por resolver.";
const TICK_MS = 60 * 1000;

let inited = false;
let lastDetail = { pending: false };

function argentinaNow() {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date())
        .map((p) => [p.type, p.value]),
    );
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      minute: Number(parts.hour) * 60 + Number(parts.minute),
    };
  } catch {
    const d = new Date();
    return { date: d.toISOString().slice(0, 10), minute: d.getHours() * 60 + d.getMinutes() };
  }
}

function readLastDay() {
  try {
    return localStorage.getItem(LAST_DAY_KEY) || "";
  } catch {
    return "";
  }
}

function writeLastDay(date) {
  try {
    localStorage.setItem(LAST_DAY_KEY, date);
  } catch {
    /* ignore */
  }
}

function sync(detail = lastDetail) {
  clearSt2AlertToast(ST2_TOAST.cryptic);
  const now = argentinaNow();
  const today = String(detail?.date || "") === now.date;
  const due = !!detail?.pending && today && now.minute >= REMIND_AT_MINUTE;

  if (!due) {
    // Ya jugó todo, todavía no son las 14 o no es día de Críptico: sin recordatorio.
    removeNotifInboxEntry(DAY_ID);
    return;
  }
  if (readLastDay() === now.date) return; // ya se avisó hoy (en esta u otra pestaña)

  writeLastDay(now.date);
  // Sacar el de ayer antes de agregar: así entra como "sin ver" aunque el texto sea el mismo.
  removeNotifInboxEntry(DAY_ID);
  upsertNotifInboxEntry({ id: DAY_ID, title: "Críptico", body: BODY, tone: "warn" });
  notifyCrypticDesktop(BODY, `day-${now.date}`, { allowWhileVisible: false });
}

// Se escucha desde que carga el módulo: el Críptico puede avisar antes de initCrypticNudge().
document.addEventListener("st2:cryptic-pending", (event) => {
  lastDetail = event?.detail && typeof event.detail === "object"
    ? event.detail
    : { pending: Boolean(event?.detail?.pending) };
  if (inited) sync(lastDetail);
});

export function initCrypticNudge() {
  if (inited) return;
  inited = true;
  sync(lastDetail);
  document.addEventListener("st2:planillas-home", () => sync());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) sync();
  });
  // Por si la pestaña quedó abierta desde la mañana: a las 14 aparece sola.
  window.setInterval(() => sync(), TICK_MS);
}
