/**
 * Bridge Sonner (sonner-wc) para las notificaciones persistentes de ST2.
 */
import { toast } from "/lib/sonner-wc/sonner-wc.bundle.js";
import {
  formatToastMessage,
  foodForToast,
  TOAST_FOOD_MARK,
  syncSessionGreetBubble,
} from "./st2-toast-greet.js?v=20260917a";

export const ST2_TOAST = {
  /** Versión web / módulos nuevos: siempre arriba del stack. */
  update: "st2-toast-update",
  tools: "st2-toast-tools",
  blanqueo: "st2-toast-blanqueo",
  /** Avisos personales del solicitante cuando además es confirmador. */
  blanqueoMine: "st2-toast-blanqueo-mine",
  borrado: "st2-toast-borrado",
  borradoMine: "st2-toast-borrado-mine",
  access: "st2-toast-access",
  accessOwner: "st2-toast-access-owner",
  agua: "st2-toast-agua",
};

/** Orden del stack (saludo solo en el primero). Agua queda afuera. */
const GREET_STACK = [
  ST2_TOAST.update,
  ST2_TOAST.tools,
  ST2_TOAST.blanqueo,
  ST2_TOAST.blanqueoMine,
  ST2_TOAST.borrado,
  ST2_TOAST.borradoMine,
  ST2_TOAST.access,
  ST2_TOAST.accessOwner,
];

const TOASTER_ID = "st2-sonner";

/**
 * Duración “persistente”. No usar Infinity en setTimeout (en engines se clamp a 1ms).
 * Sonner evita el timer si duration===Infinity, pero un número alto es más seguro.
 */
const STICKY_MS = 1000 * 60 * 60 * 24 * 7; // 7 días

/** @type {Map<string, { body: string, tone: string, actionLabel: string, sticky?: boolean, onAction?: () => void, onDismiss?: () => void }>} */
const registry = new Map();

let inited = false;
/**
 * Evita que onDismiss dispare callbacks de “cerré el toast” cuando lo cerramos nosotros
 * (Sonner llama onDismiss ~200ms después del dismiss por la animación).
 */
const dismissingLocally = new Set();
const DISMISS_GUARD_MS = 500;

function dismissProgrammatically(id) {
  if (!id) return;
  dismissingLocally.add(id);
  try {
    toast.dismiss(id);
  } catch {
    /* ignore */
  }
  window.setTimeout(() => dismissingLocally.delete(id), DISMISS_GUARD_MS);
}

function toneToMethod(tone) {
  if (tone === "bad" || tone === "error") return "error";
  if (tone === "warn" || tone === "warning") return "warning";
  if (tone === "tools" || tone === "info" || tone === "agua") return "info";
  return "success";
}

function plainTitle(text) {
  const raw = String(text || "");
  return raw.replace(new RegExp(TOAST_FOOD_MARK.replace(/[{}]/g, "\\$&"), "g"), () => foodForToast(raw));
}

function currentTheme() {
  return document.documentElement.classList.contains("st2-theme-dark") ? "dark" : "light";
}

function toneClass(tone) {
  if (tone === "bad" || tone === "error") return "st2-sonner-bad";
  if (tone === "warn" || tone === "warning") return "st2-sonner-warn";
  if (tone === "agua") return "st2-sonner-agua";
  if (tone === "tools" || tone === "info") return "st2-sonner-tools";
  return "st2-sonner-ok";
}

/** Ancla el stack a la izquierda, justo bajo el blobatar (o el ícono ST2). */
export function syncSonnerPlacement() {
  const toaster = document.getElementById(TOASTER_ID);
  if (!toaster) return;

  const session = document.getElementById("st2-session-email");
  const sessionVisible =
    !!session && !session.classList.contains("hidden") && session.getClientRects().length > 0;
  const brand =
    document.getElementById("homeBtn") ||
    document.querySelector(".brand-home-btn") ||
    document.querySelector(".app-header-left");
  const anchor = sessionVisible ? session : brand;

  if (!anchor) {
    toaster.style.setProperty("--offset-top", "68px");
    toaster.style.setProperty("--offset-left", "22px");
    toaster.style.setProperty("--width", "300px");
    toaster.style.setProperty("--mobile-offset-top", "68px");
    toaster.style.setProperty("--mobile-offset-left", "12px");
    return;
  }

  const rect = anchor.getBoundingClientRect();
  const top = Math.max(52, Math.round(rect.bottom + 6));
  const left = Math.max(10, Math.round(rect.left));

  // En 14"/17" no chocar con "Sistema de Planillas": achicar al hueco libre.
  let width = 300;
  const firstTab =
    document.querySelector('.tab-bar .tab-btn[data-tab="planillas"]') ||
    document.querySelector(".tab-bar .tab-btn");
  if (firstTab) {
    const tr = firstTab.getBoundingClientRect();
    if (tr.left > left) {
      width = Math.max(210, Math.min(300, Math.round(tr.left - left - 14)));
    }
  }

  toaster.style.setProperty("--offset-top", `${top}px`);
  toaster.style.setProperty("--offset-left", `${left}px`);
  toaster.style.setProperty("--width", `${width}px`);
  toaster.style.setProperty("--mobile-offset-top", `${top}px`);
  toaster.style.setProperty("--mobile-offset-left", `${Math.max(8, Math.min(left, 14))}px`);
}

/** Solo home de Planillas (menú principal), no otras pestañas ni módulos. */
export function isPlanillasHomeSurface() {
  const tab = document.querySelector('.tab-btn[data-tab="planillas"]');
  if (!tab?.classList.contains("active")) return false;
  const panel = document.getElementById("panel-planillas");
  if (panel && !panel.classList.contains("active")) return false;
  const menu = document.getElementById("planillas-menu");
  return !!(menu && !menu.classList.contains("hidden"));
}

/** Visible solo en home de Planillas y fuera del tutorial. */
export function shouldShowSonnerToasts() {
  return isPlanillasHomeSurface() && !document.body.classList.contains("st2-tour-active");
}

/** Muestra/oculta el toaster según home + tutorial. */
export function syncSonnerHomeVisibility() {
  const show = shouldShowSonnerToasts();
  document.body.classList.toggle("st2-sonner-home", show);
  const toaster = document.getElementById(TOASTER_ID);
  if (toaster) {
    toaster.toggleAttribute("hidden", !show);
    toaster.setAttribute("aria-hidden", show ? "false" : "true");
  }
  if (show) {
    syncSonnerPlacement();
    if (registry.size) syncStackedToastGreetings();
  } else {
    // Sacar del DOM sin “marcar visto”: el registry se conserva y al volver a home se re-pinta.
    for (const id of [...registry.keys()]) {
      dismissProgrammatically(id);
    }
  }
}

export function syncSonnerTheme() {
  const el = document.getElementById(TOASTER_ID);
  if (el) el.setAttribute("theme", currentTheme());
}

export function initSt2Sonner() {
  if (inited) {
    syncSonnerTheme();
    syncSonnerPlacement();
    syncSonnerHomeVisibility();
    return;
  }
  inited = true;

  let toaster = document.getElementById(TOASTER_ID);
  if (!toaster) {
    toaster = document.createElement("sonner-toaster");
    toaster.id = TOASTER_ID;
    document.body.appendChild(toaster);
  }

  toaster.setAttribute("position", "top-left");
  toaster.setAttribute("rich-colors", "");
  toaster.setAttribute("close-button", "");
  toaster.setAttribute("visible-toasts", "5");
  toaster.setAttribute("duration", String(STICKY_MS));
  toaster.setAttribute("container-aria-label", "Notificaciones");
  toaster.setAttribute("theme", currentTheme());
  toaster.removeAttribute("offset");

  syncSonnerTheme();
  syncSonnerPlacement();
  syncSonnerHomeVisibility();

  window.addEventListener("resize", syncSonnerPlacement, { passive: true });
  if (typeof ResizeObserver !== "undefined") {
    const header = document.querySelector(".app-header");
    if (header) {
      const ro = new ResizeObserver(() => syncSonnerPlacement());
      ro.observe(header);
    }
    const tabBar = document.querySelector(".main-shell > .tab-bar") || document.querySelector(".tab-bar");
    if (tabBar) {
      const tro = new ResizeObserver(() => syncSonnerPlacement());
      tro.observe(tabBar);
    }
    const leftZone = document.querySelector(".app-header-left");
    if (leftZone) {
      const lro = new ResizeObserver(() => syncSonnerPlacement());
      lro.observe(leftZone);
    }
  }

  const refreshGreet = () => {
    syncStackedToastGreetings();
  };
  document.addEventListener("st2:view-as-changed", refreshGreet);
  document.addEventListener("st2:session-changed", refreshGreet);
  document.addEventListener("st2:planillas-view-changed", () => syncSonnerHomeVisibility());
  document.addEventListener("st2:planillas-home", () => {
    requestAnimationFrame(() => syncSonnerHomeVisibility());
  });
  document.addEventListener("st2:tour-active-changed", () => syncSonnerHomeVisibility());
  document.addEventListener("st2:update-ui-changed", () => {
    syncSonnerPlacement();
    syncSonnerHomeVisibility();
  });
}

/**
 * Muestra o actualiza un toast de alerta (stack con saludo).
 * Pasá body vacío / null para ocultarlo.
 */
export function setSt2AlertToast({
  id,
  body,
  tone = "ok",
  actionLabel = "Ver",
  sticky = false,
  onAction,
  onDismiss,
}) {
  initSt2Sonner();
  const text = String(body || "").trim();
  if (!text) {
    clearSt2AlertToast(id);
    return;
  }

  registry.set(id, {
    body: text,
    tone,
    actionLabel,
    sticky: !!sticky,
    onAction,
    onDismiss,
  });
  paintGreetStack();
}

/** Toast de agua: texto propio, fuera del stack de saludo. */
export function setSt2AguaToast({ body, onAction }) {
  initSt2Sonner();
  const text = String(body || "").trim();
  if (!text) {
    clearSt2AlertToast(ST2_TOAST.agua);
    return;
  }

  registry.set(ST2_TOAST.agua, {
    body: text,
    tone: "agua",
    actionLabel: "¡Sí!",
    onAction,
  });
  paintOne(ST2_TOAST.agua, plainTitle(text), "agua");
}

export function clearSt2AlertToast(id) {
  if (!id) return;
  const had = registry.delete(id);
  lastPainted.delete(id);
  dismissProgrammatically(id);
  if (had && GREET_STACK.includes(id)) paintGreetStack();
}

const FLASH_TOAST_ID = "st2-toast-flash";
let flashHideTimer = 0;

/**
 * Toast efímero (validación / feedback). Visible también fuera del home de Planillas.
 * No entra al stack sticky de alertas.
 */
export function showSt2FlashToast({ body, tone = "warn", duration = 4800 } = {}) {
  initSt2Sonner();
  const text = String(body || "").trim();
  if (!text) return;

  const toaster = document.getElementById(TOASTER_ID);
  document.body.classList.add("st2-sonner-home");
  if (toaster) {
    toaster.removeAttribute("hidden");
    toaster.setAttribute("aria-hidden", "false");
  }
  syncSonnerPlacement();

  const method = toneToMethod(tone);
  const title = plainTitle(text);
  const opts = {
    id: FLASH_TOAST_ID,
    toasterId: TOASTER_ID,
    duration: Math.max(1800, Number(duration) || 4800),
    richColors: true,
    closeButton: true,
    dismissible: true,
    className: `st2-sonner-toast ${toneClass(tone)}`,
    onDismiss: () => {
      window.clearTimeout(flashHideTimer);
      flashHideTimer = window.setTimeout(() => syncSonnerHomeVisibility(), 120);
    },
    onAutoClose: () => {
      window.clearTimeout(flashHideTimer);
      flashHideTimer = window.setTimeout(() => syncSonnerHomeVisibility(), 120);
    },
  };

  if (method === "error") toast.error(title, opts);
  else if (method === "warning") toast.warning(title, opts);
  else if (method === "info") toast.info(title, opts);
  else toast.success(title, opts);
}

/** @type {Map<string, { title: string, tone: string }>} */
const lastPainted = new Map();

function paintGreetStack() {
  const visible = GREET_STACK.filter((id) => registry.has(id));
  visible.forEach((id, index) => {
    const entry = registry.get(id);
    if (!entry) return;
    const title = plainTitle(
      formatToastMessage(entry.body),
    );
    paintOne(id, title, entry.tone);
  });

  for (const id of GREET_STACK) {
    if (!registry.has(id)) {
      lastPainted.delete(id);
      dismissProgrammatically(id);
    }
  }
}

function makeActionButton(id, entry, tone) {
  const btn = document.createElement("button");
  btn.type = "button";
  const toneKey =
    tone === "bad" || tone === "error"
      ? "bad"
      : tone === "warn" || tone === "warning"
        ? "warn"
        : tone === "agua"
          ? "agua"
          : tone === "tools" || tone === "info"
            ? "tools"
            : "ok";
  btn.className = `st2-sonner-action st2-sonner-action--${toneKey}`;
  btn.textContent = entry.actionLabel || "Ver";
  btn.addEventListener("click", () => {
    entry.onAction?.();
    lastPainted.delete(id);
    if (entry.sticky) {
      // Seguir en registry: al volver al home se re-pinta (pendientes / obs).
      dismissProgrammatically(id);
      return;
    }
    registry.delete(id);
    dismissProgrammatically(id);
    // No re-pintar el stack: evita que el resto “rote” / se remonte.
  });
  return btn;
}

function paintOne(id, title, tone, { force = false } = {}) {
  const entry = registry.get(id);
  if (!entry) return;
  if (!shouldShowSonnerToasts()) return;

  const prev = lastPainted.get(id);
  let existing = null;
  try {
    existing = toast.getToast?.(id) || null;
  } catch {
    existing = null;
  }
  // Evitar re-crear el toast si el contenido no cambió (glitches / “rotación” de Sonner).
  if (!force && prev && prev.title === title && prev.tone === tone && existing) return;
  if (!force && prev && prev.title === title && prev.tone === tone && dismissingLocally.has(id)) return;

  const method = toneToMethod(tone);
  const opts = {
    id,
    toasterId: TOASTER_ID,
    duration: STICKY_MS,
    richColors: true,
    closeButton: true,
    dismissible: true,
    className: `st2-sonner-toast ${toneClass(tone)}`,
    action: entry.onAction ? makeActionButton(id, entry, tone) : undefined,
    onAutoClose: () => {
      dismissingLocally.add(id);
      lastPainted.delete(id);
      window.setTimeout(() => {
        dismissingLocally.delete(id);
        if (registry.has(id) && shouldShowSonnerToasts()) {
          paintOne(id, plainTitle(formatToastMessage(registry.get(id)?.body || "")), registry.get(id)?.tone || tone, { force: true });
        }
      }, DISMISS_GUARD_MS);
    },
    onDismiss: () => {
      if (dismissingLocally.has(id)) return;
      lastPainted.delete(id);
      if (entry.sticky) {
        // X / cierre fantasma: no “tragar” el aviso; reponer solo este.
        window.setTimeout(() => {
          if (registry.has(id) && shouldShowSonnerToasts()) {
            const e = registry.get(id);
            if (e) paintOne(id, plainTitle(formatToastMessage(e.body)), e.tone, { force: true });
          }
        }, 280);
        return;
      }
      registry.delete(id);
      entry.onDismiss?.();
    },
  };

  lastPainted.set(id, { title, tone });
  if (method === "error") toast.error(title, opts);
  else if (method === "warning") toast.warning(title, opts);
  else if (method === "info") toast.info(title, opts);
  else toast.success(title, opts);
}

/** Re-pinta el stack (p. ej. al volver al home). El saludo va en el globo, no acá. */
export function syncStackedToastGreetings() {
  syncSessionGreetBubble();
  if (!registry.size) return;
  paintGreetStack();
  const agua = registry.get(ST2_TOAST.agua);
  if (agua) paintOne(ST2_TOAST.agua, plainTitle(agua.body), "agua");
}
