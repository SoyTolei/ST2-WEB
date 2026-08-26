/**
 * Easter egg: contador de agua (solo menú principal de Planillas).
 * Perfil: jorgeeduardo.teti@thomsonreuters.com
 */
import { getPlanUserEmail } from "./plan-user.js";
import { getViewAsProfile } from "./module-access.js";
import { setToastText } from "./st2-toast-greet.js";

const TARGET_EMAIL = "jorgeeduardo.teti@thomsonreuters.com";
const LEVELS = [
  "/img/agua/botella-0.png?v=2",
  "/img/agua/botella-1.png?v=2",
  "/img/agua/botella-2.png?v=2",
];
/** GIF de llenado: dejar el archivo en wwwroot/img/agua/llenar.gif */
const FILL_GIF = "/img/agua/llenar.gif?v=2";
const MAX_LEVEL = LEVELS.length - 1;
/** Duración aproximada del gif en pantalla antes de mostrar el nivel final. */
const FILL_GIF_MS = 1800;
/** Cada ~2.5 h (entre 2 y 3). */
const PROMPT_MS = (2.5 * 60 * 60 * 1000);
const STORAGE_KEY = "st2-agua-egg-v1";

let started = false;
let promptTimer = 0;
let animating = false;

function argentinaDayKey() {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function readState() {
  const day = argentinaDayKey();
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (raw && raw.day === day) {
      return {
        day,
        level: Math.max(0, Math.min(MAX_LEVEL, Number(raw.level) || 0)),
        lastPromptAt: Number(raw.lastPromptAt) || 0,
      };
    }
  } catch { /* ignore */ }
  return { day, level: 0, lastPromptAt: 0 };
}

function writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

function effectiveEmail() {
  const viewAs = getViewAsProfile();
  if (viewAs?.email) return String(viewAs.email).trim().toLowerCase();
  return String(getPlanUserEmail() || "").trim().toLowerCase();
}

export function isAguaEggUser() {
  return effectiveEmail() === TARGET_EMAIL;
}

function bottleBtn() {
  return document.getElementById("st2-agua-bottle");
}

function bottleImg() {
  return document.getElementById("st2-agua-bottle-img");
}

function toastEl() {
  return document.getElementById("agua-ready-toast");
}

function overlayEl() {
  return document.getElementById("st2-agua-overlay");
}

function stageFrom() {
  return document.getElementById("st2-agua-stage-from");
}

function stageTo() {
  return document.getElementById("st2-agua-stage-to");
}

function stageGif() {
  return document.getElementById("st2-agua-stage-gif");
}

function syncBottleUi() {
  const btn = bottleBtn();
  const img = bottleImg();
  const on = isAguaEggUser() && isOnPlanillasMenu();
  if (!btn || !img) return;
  btn.classList.toggle("hidden", !on);
  btn.setAttribute("aria-hidden", on ? "false" : "true");
  if (!on) return;
  const state = readState();
  img.src = LEVELS[state.level];
  btn.title = state.level >= MAX_LEVEL
    ? "Meta de agua del día cumplida"
    : `Agua de hoy · ${state.level}/${MAX_LEVEL}`;
  btn.classList.toggle("is-full", state.level >= MAX_LEVEL);
}

function isOnPlanillasMenu() {
  const menu = document.getElementById("planillas-menu");
  return !!(menu && !menu.classList.contains("hidden") && menu.offsetParent !== null);
}

function hideToast() {
  const toast = toastEl();
  if (!toast) return;
  toast.classList.add("hidden");
  toast.setAttribute("aria-hidden", "true");
}

function showToast() {
  if (!isAguaEggUser() || !isOnPlanillasMenu()) return;
  const state = readState();
  const toast = toastEl();
  const text = document.getElementById("agua-ready-toast-text");
  if (!toast || !text) return;

  const name = "Jorge";
  const body = state.level >= MAX_LEVEL
    ? `${name}, ¡hoy ya cumpliste el agua! 💧`
    : `Hola ${name}, ¿tomaste agua hoy? 💧`;

  setToastText(text, body);
  toast.dataset.toastBody = body;
  toast.classList.remove("hidden");
  toast.setAttribute("aria-hidden", "false");
  state.lastPromptAt = Date.now();
  writeState(state);
}

function schedulePrompt() {
  if (promptTimer) window.clearTimeout(promptTimer);
  if (!isAguaEggUser()) return;

  const state = readState();
  const elapsed = Date.now() - (state.lastPromptAt || 0);
  const jitter = (Math.random() * 60 - 30) * 60 * 1000; // ±30 min
  const wait = Math.max(15_000, PROMPT_MS + jitter - elapsed);

  promptTimer = window.setTimeout(() => {
    showToast();
    schedulePrompt();
  }, wait);
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function playFillAnimation(fromLevel, toLevel) {
  const overlay = overlayEl();
  const from = stageFrom();
  const to = stageTo();
  const gif = stageGif();
  if (!overlay || !from || !to) return;

  from.src = LEVELS[fromLevel];
  to.src = LEVELS[toLevel];
  overlay.classList.remove("hidden", "is-done", "is-swap", "has-gif");
  overlay.classList.add("is-open", "is-filling");
  overlay.setAttribute("aria-hidden", "false");

  if (gif) {
    // Cache-bust para que el GIF se reinicie en cada click.
    gif.src = `${FILL_GIF.split("?")[0]}?v=${Date.now()}`;
    overlay.classList.add("has-gif");
    await wait(FILL_GIF_MS);
    overlay.classList.add("is-swap");
    await wait(500);
  } else {
    await wait(120);
    overlay.classList.add("is-swap");
    await wait(900);
  }

  overlay.classList.add("is-done");
  await wait(650);

  overlay.classList.remove("is-open", "is-filling", "is-swap", "is-done", "has-gif");
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  if (gif) gif.removeAttribute("src");
}

async function drinkOnce() {
  if (animating || !isAguaEggUser()) return;
  hideToast();
  const state = readState();
  if (state.level >= MAX_LEVEL) {
    animating = true;
    try {
      await playFillAnimation(MAX_LEVEL, MAX_LEVEL);
    } finally {
      animating = false;
      syncBottleUi();
    }
    return;
  }

  animating = true;
  const from = state.level;
  const to = from + 1;
  try {
    await playFillAnimation(from, to);
    state.level = to;
    writeState(state);
  } finally {
    animating = false;
    syncBottleUi();
  }
}

function bindOnce() {
  if (started) return;
  started = true;

  document.getElementById("agua-ready-toast-open")?.addEventListener("click", () => {
    void drinkOnce();
  });
  document.getElementById("agua-ready-toast-dismiss")?.addEventListener("click", () => {
    hideToast();
    const state = readState();
    state.lastPromptAt = Date.now();
    writeState(state);
  });
  bottleBtn()?.addEventListener("click", () => {
    void drinkOnce();
  });
  overlayEl()?.addEventListener("click", (e) => {
    if (e.target === overlayEl() && !animating) {
      overlayEl()?.classList.add("hidden");
      overlayEl()?.classList.remove("is-open", "is-filling", "is-swap", "is-done");
    }
  });
}

/** Llamar al init y al volver al menú / cambio de sesión. */
export function syncAguaEgg() {
  bindOnce();
  syncBottleUi();
  if (!isAguaEggUser()) {
    hideToast();
    if (promptTimer) {
      window.clearTimeout(promptTimer);
      promptTimer = 0;
    }
    return;
  }

  schedulePrompt();
  const state = readState();
  // Primer ingreso del día (o hace rato): avisar sin esperar el intervalo completo.
  if (!state.lastPromptAt || Date.now() - state.lastPromptAt >= PROMPT_MS * 0.85) {
    window.setTimeout(() => showToast(), 1800);
  }
}
