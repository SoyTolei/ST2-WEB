import { getPlanUserEmail, getPlanUserDisplayName } from "./plan-user.js";
import { getViewAsProfile } from "./module-access.js";
import { isBirthdayGreetingForEmail } from "./planillas-easter-eggs.js";

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

export function greetLine(name) {
  if (!name) return "";
  const mins = argentinaMinutesNow();
  const birthday = isBirthdayGreetingForEmail(toastUserEmail());

  if (mins >= 19 * 60) {
    const night = `Buenas noches ${name}? ¿Qué haces a esta hora por acá?`;
    return birthday ? `${night} Feliz Cumpleaños! 🎂` : night;
  }

  const hello = mins < 12 * 60 ? `Buenos días ${name}!` : `Buenas tardes ${name}!`;
  return birthday ? `${hello} Feliz Cumpleaños! 🎂` : hello;
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
    return;
  }

  const name = toastFirstName();
  const line = greetLine(name);
  if (!line) {
    bubble.classList.add("hidden");
    bubble.setAttribute("hidden", "");
    textEl.textContent = "";
    return;
  }

  if (textEl.textContent !== line) {
    textEl.textContent = line;
    bubble.classList.remove("st2-blobatar-greet--pop");
    // Reinicia la entrada spring al cambiar franja horaria / nombre.
    void bubble.offsetWidth;
    bubble.classList.add("st2-blobatar-greet--pop");
  }
  bubble.classList.remove("hidden");
  bubble.removeAttribute("hidden");
}

document.addEventListener("st2:greet-bubble-sync", () => syncSessionGreetBubble());
document.addEventListener("st2:session-changed", () => syncSessionGreetBubble());
document.addEventListener("st2:view-as-changed", () => syncSessionGreetBubble());
document.addEventListener("st2:theme-changed", () => syncSessionGreetBubble());
