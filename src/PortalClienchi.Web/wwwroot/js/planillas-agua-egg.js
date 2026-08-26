/**
 * Easter egg: contador de agua (solo menú principal de Planillas).
 * Perfil: jorgeeduardo.teti@thomsonreuters.com
 *
 * El progreso en “ver como” usa otra clave de storage: no toca el de Jorge real.
 */
import { getPlanUserEmail, getPlanUserDisplayName } from "./plan-user.js";
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
const STORAGE_LIVE = "st2-agua-egg-live-v1";
const STORAGE_VIEWAS = "st2-agua-egg-viewas-v1";
const VIEWAS_ARMED = "st2-agua-viewas-armed-v1";

let started = false;
let promptTimer = 0;
let animating = false;

function isViewAsTarget() {
  const viewAs = getViewAsProfile();
  return String(viewAs?.email || "").trim().toLowerCase() === TARGET_EMAIL;
}

function storageKey() {
  return isViewAsTarget() ? STORAGE_VIEWAS : STORAGE_LIVE;
}

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
    const raw = JSON.parse(localStorage.getItem(storageKey()) || "null");
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
    localStorage.setItem(storageKey(), JSON.stringify(state));
  } catch { /* ignore */ }
}

/** Reinicia solo el progreso de “ver como” (no el de Jorge en su PC). */
export function resetAguaEggViewAsProgress() {
  try {
    localStorage.removeItem(STORAGE_VIEWAS);
    // Limpia la clave vieja compartida si quedó de pruebas anteriores.
    localStorage.removeItem("st2-agua-egg-v1");
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

/** Primer nombre desde el display del admin / ver como; nunca del local del mail. */
function aguaFirstName() {
  const viewAs = getViewAsProfile();
  const raw = isViewAsTarget()
    ? String(viewAs?.displayName || "").trim()
    : String(getPlanUserDisplayName() || "").trim();
  const first = raw.split(/\s+/).filter(Boolean)[0] || "";
  if (first) {
    return first.charAt(0).toUpperCase() + first.slice(1);
  }
  return "Jorge";
}

function bottleBtn() {
  return document.getElementById("st2-agua-bottle");
}

function bottleImg() {
  return document.getElementById("st2-agua-bottle-img");
}

function aguaWidget() {
  return document.getElementById("st2-agua-widget");
}

function meterFill() {
  return document.getElementById("st2-agua-meter-fill");
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
  const widget = aguaWidget();
  const btn = bottleBtn();
  const img = bottleImg();
  const fill = meterFill();
  const on = isAguaEggUser() && isOnPlanillasMenu();
  if (!widget || !btn || !img) return;
  widget.classList.toggle("hidden", !on);
  widget.setAttribute("aria-hidden", on ? "false" : "true");
  if (!on) return;
  const state = readState();
  img.src = LEVELS[state.level];
  const pct = MAX_LEVEL > 0 ? Math.round((state.level / MAX_LEVEL) * 100) : 0;
  if (fill) {
    fill.style.height = `${pct}%`;
    fill.classList.toggle("is-full", state.level >= MAX_LEVEL);
  }
  widget.dataset.level = String(state.level);
  const tip = isViewAsTarget()
    ? "Agua (ver como) · doble clic reinicia la prueba"
    : null;
  btn.title = tip || (state.level >= MAX_LEVEL
    ? "Meta de agua del día cumplida"
    : `Agua de hoy · ${state.level}/${MAX_LEVEL}`);
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

  const name = aguaFirstName();
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
  bottleBtn()?.addEventListener("dblclick", (e) => {
    if (!isViewAsTarget()) return;
    e.preventDefault();
    e.stopPropagation();
    resetAguaEggViewAsProgress();
    hideToast();
    syncBottleUi();
    window.setTimeout(() => showToast(), 400);
  });
  overlayEl()?.addEventListener("click", (e) => {
    if (e.target === overlayEl() && !animating) {
      overlayEl()?.classList.add("hidden");
      overlayEl()?.classList.remove("is-open", "is-filling", "is-swap", "is-done", "has-gif");
    }
  });
}

/** Llamar al init y al volver al menú / cambio de sesión. */
export function syncAguaEgg() {
  bindOnce();

  // Una sola vez al entrar en ver como: progreso de prueba limpio (Jorge real no se toca).
  if (isViewAsTarget()) {
    try {
      if (sessionStorage.getItem(VIEWAS_ARMED) !== "1") {
        resetAguaEggViewAsProgress();
        sessionStorage.setItem(VIEWAS_ARMED, "1");
      }
    } catch {
      resetAguaEggViewAsProgress();
    }
  } else {
    try { sessionStorage.removeItem(VIEWAS_ARMED); } catch { /* ignore */ }
  }

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
  if (!state.lastPromptAt || Date.now() - state.lastPromptAt >= PROMPT_MS * 0.85) {
    window.setTimeout(() => showToast(), 1800);
  }
}
