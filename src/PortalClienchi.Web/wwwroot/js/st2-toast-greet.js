import { getPlanUserEmail, getPlanUserDisplayName } from "./plan-user.js";
import { getViewAsProfile } from "./module-access.js";
import { isBirthdayGreetingForEmail } from "./planillas-easter-eggs.js?v=20261013d";

export const TOAST_FOOD_MARK = "{{toast-food}}";
const TOAST_FOOD_KEY = "st2-toast-food-pizza-used";
const TOAST_FOOD_EMOJIS = [
  "🍕",
  "🍔", "🍟", "🌮", "🍣", "🍩", "🍦", "🥐", "🍜", "🥗", "🍪", "🍉",
  "🌭", "🍝", "🧁", "🍓", "🥑", "🧀",
];

export function firstNameFromEmail(email) {
  const local = String(email || "").split("@")[0] || "";
  const first = local.split(/[._\-]+/).filter(Boolean)[0] || "";
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Primer nombre del display (admin / ver como); si no hay, cae al correo. */
export function toastFirstName() {
  const viewAs = getViewAsProfile();
  const display = String(viewAs?.displayName || getPlanUserDisplayName() || "").trim();
  const fromDisplay = display.split(/\s+/).filter(Boolean)[0] || "";
  if (fromDisplay) {
    return fromDisplay.charAt(0).toUpperCase() + fromDisplay.slice(1);
  }
  return firstNameFromEmail(toastUserEmail());
}

function nextFoodEmoji() {
  try {
    if (sessionStorage.getItem(TOAST_FOOD_KEY) !== "1") {
      sessionStorage.setItem(TOAST_FOOD_KEY, "1");
      return TOAST_FOOD_EMOJIS[0];
    }
  } catch {
    return TOAST_FOOD_EMOJIS[0];
  }
  const rest = TOAST_FOOD_EMOJIS.slice(1);
  return rest[Math.floor(Math.random() * rest.length)] || "🍕";
}

export function foodForToast(text) {
  const key = `st2-toast-food:${String(text || "").slice(0, 160)}`;
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) return cached;
    const food = nextFoodEmoji();
    sessionStorage.setItem(key, food);
    return food;
  } catch {
    return nextFoodEmoji();
  }
}

export function escapeToastHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** @deprecated Prefer plain text + Sonner; se mantiene por compat. */
export function setToastText(el, text) {
  if (!el) return;
  const food = foodForToast(text);
  el.innerHTML = escapeToastHtml(text).replace(
    /\{\{toast-food\}\}/g,
    `<span class="toast-emoji" aria-hidden="true">${food}</span>`,
  );
}

export function toastUserEmail() {
  const viewAs = getViewAsProfile();
  if (viewAs?.email) return String(viewAs.email).trim().toLowerCase();
  return String(getPlanUserEmail() || "").trim().toLowerCase();
}

function argentinaMinutesNow() {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
    const h = hour === 24 ? 0 : hour;
    return h * 60 + minute;
  } catch {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
}

const TOAST_MERIENDA_EMOJIS = ["🧉", "☕", "🥐", "🍪", "🫖"];

function nextMeriendaEmoji() {
  return TOAST_MERIENDA_EMOJIS[Math.floor(Math.random() * TOAST_MERIENDA_EMOJIS.length)] || "🧉";
}

function meriendaForGreet() {
  const key = "st2-greet-merienda";
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) return cached;
    const emoji = nextMeriendaEmoji();
    sessionStorage.setItem(key, emoji);
    return emoji;
  } catch {
    return nextMeriendaEmoji();
  }
}

export function greetLine(_name) {
  const mins = argentinaMinutesNow();
  const birthday = isBirthdayGreetingForEmail(toastUserEmail());
  const bday = birthday ? " Feliz Cumpleaños! 🎂" : "";

  // 19:00–04:59 → Buenas noches (+ mensaje corto)
  // 05:00–11:59 → Buenos días + ☕
  // 12:00–14:59 → Buenas tardes + comida
  // 15:00–18:59 → Buenas tardes + merienda
  const isNight = mins >= 19 * 60 || mins < 5 * 60;
  if (isNight) {
    return `Buenas noches… ¿a esta hora por acá?${bday}`;
  }

  if (mins < 12 * 60) {
    return `Buenos días! ☕${bday}`;
  }

  if (mins < 15 * 60) {
    return `Buenas tardes! ${foodForToast("greet-almuerzo")}${bday}`;
  }

  return `Buenas tardes! ${meriendaForGreet()}${bday}`;
}

/** El saludo vive en el globo del blobatar; las notifs solo llevan el aviso. */
export function formatToastMessage(body, { greet: _greet = false } = {}) {
  return String(body || "").trim();
}

export function syncSessionGreetBubble() {
  const bubble = document.getElementById("st2-blobatar-greet");
  const textEl = document.getElementById("st2-blobatar-greet-text");
  const card = document.getElementById("st2-session-email");
  if (!bubble || !textEl) return;

  const visible = !!card && !card.classList.contains("hidden") && !!toastUserEmail();
  if (!visible) {
    bubble.classList.add("hidden");
    bubble.setAttribute("hidden", "");
    textEl.textContent = "";
    syncCrypticGreet(false);
    return;
  }

  const line = greetLine();
  if (!line) {
    bubble.classList.add("hidden");
    bubble.setAttribute("hidden", "");
    textEl.textContent = "";
    syncCrypticGreet(false);
    return;
  }

  if (textEl.textContent !== line) {
    textEl.textContent = line;
    bubble.classList.remove("st2-blobatar-greet--pop");
    void bubble.offsetWidth;
    bubble.classList.add("st2-blobatar-greet--pop");
  }
  bubble.classList.remove("hidden");
  bubble.removeAttribute("hidden");
  syncCrypticGreet();
}

const CRYPTIC_POP_MS = 5 * 60 * 1000;
let crypticPending = false;
let crypticAfternoon = false;
let crypticPopTimer = 0;
let crypticBubbleBound = false;

function crypticLinkCopy() {
  return crypticAfternoon ? "Ya está el de la tarde →" : "¿Ya hiciste el Críptico?";
}

function openCrypticFromGreet(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  document.dispatchEvent(new CustomEvent("st2:open-cryptic"));
}

function popCrypticBubble() {
  const bubble = document.getElementById("st2-blobatar-greet");
  if (!bubble || bubble.classList.contains("hidden") || !crypticPending) return;
  bubble.classList.remove("st2-blobatar-greet--pop");
  void bubble.offsetWidth;
  bubble.classList.add("st2-blobatar-greet--pop");
  document.dispatchEvent(new CustomEvent("st2:blobatar-flash", {
    detail: { expression: "wink", ms: 2200 },
  }));
}

function syncCrypticPopTimer(on) {
  window.clearInterval(crypticPopTimer);
  crypticPopTimer = 0;
  if (!on) return;
  crypticPopTimer = window.setInterval(popCrypticBubble, CRYPTIC_POP_MS);
}

function syncCrypticGreet(pending = crypticPending) {
  const link = document.getElementById("st2-blobatar-cryptic");
  const bubble = document.getElementById("st2-blobatar-greet");
  const avatar = document.getElementById("st2-session-avatar-host");
  if (!link) return;
  const show = pending && bubble && !bubble.classList.contains("hidden");
  link.textContent = crypticLinkCopy();
  link.classList.toggle("hidden", !show);
  if (show) link.removeAttribute("hidden");
  else link.setAttribute("hidden", "");
  bubble?.classList.toggle("st2-blobatar-greet--cryptic", !!show);
  avatar?.classList.toggle("st2-blobatar-cryptic-dot", !!show);
  if (!crypticBubbleBound && bubble) {
    crypticBubbleBound = true;
    bubble.addEventListener("click", (event) => {
      if (!crypticPending) return;
      if (event.target?.closest?.("#st2-session-menu-btn, #st2-session-menu")) return;
      openCrypticFromGreet(event);
    });
  }
  if (link.dataset.crypticBound !== "1") {
    link.dataset.crypticBound = "1";
    link.addEventListener("click", openCrypticFromGreet);
  }
}

document.addEventListener("st2:cryptic-pending", (event) => {
  const next = Boolean(event.detail?.pending);
  const afternoon = Boolean(event.detail?.afternoon);
  const becamePending = next && !crypticPending;
  crypticPending = next;
  crypticAfternoon = afternoon;
  syncCrypticGreet();
  syncCrypticPopTimer(next);
  if (becamePending) {
    window.setTimeout(popCrypticBubble, 280);
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && crypticPending) popCrypticBubble();
});

document.addEventListener("st2:greet-bubble-sync", () => syncSessionGreetBubble());
document.addEventListener("st2:session-changed", () => syncSessionGreetBubble());
document.addEventListener("st2:view-as-changed", () => syncSessionGreetBubble());
document.addEventListener("st2:theme-changed", () => syncSessionGreetBubble());
