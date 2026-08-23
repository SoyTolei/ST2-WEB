import { getPlanUserEmail } from "./plan-user.js";

export const TOAST_FOOD_MARK = "{{toast-food}}";
const TOAST_FOOD_KEY = "st2-toast-food-pizza-used";
const TOAST_FOOD_EMOJIS = [
  "🍕",
  "🍔", "🍟", "🌮", "🍣", "🍩", "🍦", "🥐", "🍜", "🥗", "🍪", "🍉",
  "🌭", "🍝", "🧁", "🍓", "🥑", "🧀",
];

const STACKED_TOAST_IDS = [
  "blanqueo-ready-toast",
  "borrado-ready-toast",
  "access-ready-toast",
];

export function firstNameFromEmail(email) {
  const local = String(email || "").split("@")[0] || "";
  const first = local.split(/[._\-]+/).filter(Boolean)[0] || "";
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
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

export function setToastText(el, text) {
  if (!el) return;
  const food = foodForToast(text);
  el.innerHTML = escapeToastHtml(text).replace(
    /\{\{toast-food\}\}/g,
    `<span class="toast-emoji" aria-hidden="true">${food}</span>`,
  );
}

export function formatToastMessage(body, { greet = false } = {}) {
  const msg = String(body || "").trim();
  if (!msg) return msg;
  const lowered = msg.charAt(0).toLowerCase() + msg.slice(1);
  const name = firstNameFromEmail(getPlanUserEmail());
  if (greet && name) return `Hola ${name}! ${TOAST_FOOD_MARK} ${lowered}`;
  return `${TOAST_FOOD_MARK} ${lowered}`;
}

/** El saludo “Hola …” solo en el primer toast visible. */
export function syncStackedToastGreetings() {
  const visible = STACKED_TOAST_IDS
    .map((id) => document.getElementById(id))
    .filter((el) => el && !el.classList.contains("hidden"));

  visible.forEach((toast, index) => {
    const body = toast.dataset.toastBody || "";
    const textEl = toast.querySelector(".blanqueo-ready-toast-text");
    setToastText(textEl, formatToastMessage(body, { greet: index === 0 }));
  });
}
