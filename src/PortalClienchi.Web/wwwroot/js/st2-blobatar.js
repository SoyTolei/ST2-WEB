import { _parts } from "./vendor/blobatar-internal.js";
import { gaze } from "./vendor/blobatar-gaze.js";
import {
  happy,
  surprised,
  sleepy,
  thinking,
  smug,
  unsure,
  scared,
  shy,
  wink,
  mad,
  love,
} from "./vendor/blobatar-expression.js";
import { isBirthdayGreetingForEmail } from "./planillas-easter-eggs.js";

const EXPR = {
  happy,
  surprised,
  sleepy,
  thinking,
  smug,
  unsure,
  scared,
  shy,
  wink,
  mad,
  love,
};

const POSE_VAR_KEYS = [
  "--mo-esx",
  "--mo-esy",
  "--mo-tilt",
  "--mo-edy",
  "--mo-edx",
  "--mo-esx2",
  "--mo-esy2",
  "--mo-tilt2",
  "--mo-edy2",
  "--mo-lock",
  "--mo-shake",
  "--mo-rock",
  "--mo-bdy",
];

const FLASH_MS = 3200;
const HOUR_TICK_MS = 60_000;

let gazeHandle = null;
let lastSeed = "";
let currentEmail = "";
let listenersBound = false;
let hourTimer = null;
let flashTimer = null;
let flashName = null;
/** Contexto de app: planillas view, tab portal/admin, pdf modal… */
let appContext = "menu";
let lastExprName = "";
let pdfPortalOpen = false;
let birthdayFlashedFor = "";

/** Semilla estable: parte local del mail (nombre.apellido…). */
export function blobatarSeedFromEmail(email) {
  const local = String(email || "").split("@")[0].trim().toLowerCase();
  return local || "st2";
}

/**
 * Monta el blobatar animado (idle + gaze). Mood: evento > módulo/tab > hora ART.
 */
export function mountSessionBlobatar(email) {
  ensureListeners();
  const host = document.getElementById("st2-session-avatar-host");
  if (!host) return;

  if (!email) {
    stopHourTicker();
    clearFlash();
    teardownGaze();
    host.replaceChildren();
    host.setAttribute("hidden", "");
    lastSeed = "";
    currentEmail = "";
    lastExprName = "";
    birthdayFlashedFor = "";
    return;
  }

  currentEmail = email;
  const seed = blobatarSeedFromEmail(email);
  const needsMount = seed !== lastSeed || !host.querySelector("svg.st2-session-blobatar");
  lastSeed = seed;

  if (needsMount) {
    teardownGaze();
    const exprName = resolveMoodName();
    const expression = EXPR[exprName] || surprised;
    let parts;
    try {
      parts = _parts(seed, {
        animate: "always",
        background: false,
        size: 80,
        expression,
      });
    } catch {
      host.replaceChildren();
      host.setAttribute("hidden", "");
      return;
    }

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("width", "40");
    svg.setAttribute("height", "40");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("st2-session-blobatar");
    applyPartsToSvg(svg, parts);
    svg.style.setProperty("--mo-track-travel", "4.2px");

    const root = document.createElementNS("http://www.w3.org/2000/svg", "g");
    if (parts.cls) root.setAttribute("class", parts.cls);
    root.innerHTML = parts.inner || "";
    svg.appendChild(root);

    host.replaceChildren(svg);
    host.removeAttribute("hidden");
    lastExprName = exprName;

    requestAnimationFrame(() => {
      if (!svg.isConnected) return;
      try {
        gazeHandle = gaze(svg, { target: "pointer" });
      } catch {
        gazeHandle = null;
      }
    });
  } else {
    applyMood();
  }

  startHourTicker();

  if (isBirthdayGreetingForEmail(email) && birthdayFlashedFor !== email) {
    birthdayFlashedFor = email;
    flashBlobatarExpression("love", 4500);
  }
}

/** Flash corto (OK, error, update…). */
export function flashBlobatarExpression(name, ms = FLASH_MS) {
  if (!EXPR[name]) return;
  flashName = name;
  if (flashTimer) window.clearTimeout(flashTimer);
  applyMood();
  flashTimer = window.setTimeout(() => {
    flashName = null;
    flashTimer = null;
    applyMood();
  }, Math.max(800, Number(ms) || FLASH_MS));
}

export function setBlobatarAppContext(context) {
  appContext = String(context || "menu");
  applyMood();
}

function ensureListeners() {
  if (listenersBound) return;
  listenersBound = true;

  document.addEventListener("st2:planillas-view-changed", (e) => {
    if (pdfPortalOpen) return;
    const tab = activeTabId();
    if (tab && tab !== "planillas") return;
    appContext = mapPlanillasView(e?.detail?.view);
    applyMood();
  });

  document.addEventListener("st2:tab-changed", (e) => {
    const tab = e?.detail?.tab || activeTabId();
    syncContextFromTab(tab);
  });

  document.addEventListener("st2:pdf-portal-open", () => {
    pdfPortalOpen = true;
    appContext = "pdfPortal";
    applyMood();
  });

  document.addEventListener("st2:pdf-portal-close", () => {
    pdfPortalOpen = false;
    syncContextFromTab(activeTabId());
  });

  document.addEventListener("st2:update-ui-changed", (e) => {
    if (e?.detail?.mode === "banner") flashBlobatarExpression("surprised", 4000);
  });

  document.addEventListener("st2:blobatar-flash", (e) => {
    const name = e?.detail?.expression;
    const ms = e?.detail?.ms;
    if (name) flashBlobatarExpression(name, ms);
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) applyMood();
  });

  syncContextFromTab(activeTabId());
}

function syncContextFromTab(tab) {
  if (pdfPortalOpen) {
    appContext = "pdfPortal";
    applyMood();
    return;
  }
  if (tab === "portal") appContext = "portal";
  else if (tab === "admin") appContext = "admin";
  else if (tab === "planillas") {
    const view = document.querySelector(".planillas-view:not(.hidden)")?.id || "";
    appContext = mapPlanillasDomId(view) || "menu";
  } else {
    appContext = "menu";
  }
  applyMood();
}

function mapPlanillasView(view) {
  const v = String(view || "");
  if (v === "blanqueo") return "blanqueo";
  if (v === "borradoBases") return "borradoBases";
  if (v === "transferencia") return "transferencia";
  if (v === "referral") return "referral";
  if (v.startsWith("oportunidad")) return "oportunidad";
  if (v === "pdfPortal") return "pdfPortal";
  if (v === "chileEmbed") return "chileEmbed";
  return "menu";
}

function mapPlanillasDomId(id) {
  if (id === "planillas-blanqueo") return "blanqueo";
  if (id === "planillas-borrado-bases") return "borradoBases";
  if (id === "planillas-transferencia") return "transferencia";
  if (id === "planillas-referral") return "referral";
  if (id?.startsWith("planillas-oportunidad")) return "oportunidad";
  if (id === "planillas-chile-embed") return "chileEmbed";
  return "menu";
}

function activeTabId() {
  return document.querySelector(".tab-btn.active")?.dataset?.tab || "planillas";
}

function resolveMoodName() {
  if (flashName && EXPR[flashName]) return flashName;

  const byCtx = expressionForContext(appContext);
  if (byCtx) return byCtx;

  return expressionForHourArt();
}

/**
 * Franjas ART (America/Argentina/Buenos_Aires):
 * 09:00–10:30 happy · 10:30–13:00 surprised · 13:00–14:30 sleepy
 * 14:30–16:30 thinking · 16:30–17:30 smug · 17:30+ y antes de 09 sleepy
 */
function expressionForHourArt() {
  const mins = argentinaMinutesNow();
  if (mins >= 9 * 60 && mins < 10 * 60 + 30) return "happy";
  if (mins >= 10 * 60 + 30 && mins < 13 * 60) return "surprised";
  if (mins >= 13 * 60 && mins < 14 * 60 + 30) return "sleepy";
  if (mins >= 14 * 60 + 30 && mins < 16 * 60 + 30) return "thinking";
  if (mins >= 16 * 60 + 30 && mins < 17 * 60 + 30) return "smug";
  return "sleepy";
}

function expressionForContext(ctx) {
  switch (ctx) {
    case "blanqueo":
      return "unsure";
    case "borradoBases":
      return "scared";
    case "transferencia":
    case "referral":
      return "thinking";
    case "oportunidad":
      return "happy";
    case "pdfPortal":
      return "shy";
    case "portal":
      return "wink";
    case "admin":
      return "smug";
    default:
      return null;
  }
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
    // en-GB a veces da "24" a medianoche
    const h = hour === 24 ? 0 : hour;
    return h * 60 + minute;
  } catch {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
}

function applyMood() {
  if (!currentEmail || !lastSeed) return;
  const host = document.getElementById("st2-session-avatar-host");
  const svg = host?.querySelector("svg.st2-session-blobatar");
  const root = svg?.querySelector(":scope > g");
  if (!svg || !root) return;

  const exprName = resolveMoodName();
  if (exprName === lastExprName) return;

  const expression = EXPR[exprName] || surprised;
  let parts;
  try {
    parts = _parts(lastSeed, {
      animate: "always",
      background: false,
      size: 80,
      expression,
    });
  } catch {
    return;
  }

  applyPartsToSvg(svg, parts);
  if (parts.cls) root.setAttribute("class", parts.cls);
  svg.style.setProperty("--mo-track-travel", "4.2px");
  lastExprName = exprName;
}

function applyPartsToSvg(svg, parts) {
  for (const key of POSE_VAR_KEYS) svg.style.removeProperty(key);
  if (parts?.vars) {
    for (const [key, value] of Object.entries(parts.vars)) {
      svg.style.setProperty(key, value);
    }
  }
}

function startHourTicker() {
  stopHourTicker();
  hourTimer = window.setInterval(() => applyMood(), HOUR_TICK_MS);
}

function stopHourTicker() {
  if (hourTimer) {
    window.clearInterval(hourTimer);
    hourTimer = null;
  }
}

function clearFlash() {
  if (flashTimer) window.clearTimeout(flashTimer);
  flashTimer = null;
  flashName = null;
}

function teardownGaze() {
  try {
    gazeHandle?.stop?.();
  } catch {
    /* ignore */
  }
  gazeHandle = null;
}
