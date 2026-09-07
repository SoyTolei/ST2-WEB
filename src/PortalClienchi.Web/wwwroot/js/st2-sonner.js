/**
 * Bridge Sonner (sonner-wc) para las notificaciones persistentes de ST2.
 */
import { toast } from "/lib/sonner-wc/sonner-wc.bundle.js";
import {
  formatToastMessage,
  foodForToast,
  TOAST_FOOD_MARK,
} from "./st2-toast-greet.js";

export const ST2_TOAST = {
  tools: "st2-toast-tools",
  blanqueo: "st2-toast-blanqueo",
  borrado: "st2-toast-borrado",
  access: "st2-toast-access",
  accessOwner: "st2-toast-access-owner",
  agua: "st2-toast-agua",
};

/** Orden del stack (saludo solo en el primero). Agua queda afuera. */
const GREET_STACK = [
  ST2_TOAST.tools,
  ST2_TOAST.blanqueo,
  ST2_TOAST.borrado,
  ST2_TOAST.access,
  ST2_TOAST.accessOwner,
];

const TOASTER_ID = "st2-sonner";

/** @type {Map<string, { body: string, tone: string, actionLabel: string, onAction?: () => void, onDismiss?: () => void }>} */
const registry = new Map();

let inited = false;
/** Evita que onDismiss dispare markSeen cuando nosotros cerramos el toast. */
const dismissingLocally = new Set();

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

/** Ancla el stack justo debajo de Tutorial / Acerca de. */
export function syncSonnerPlacement() {
  const toaster = document.getElementById(TOASTER_ID);
  const anchor =
    document.querySelector(".app-header-actions") ||
    document.getElementById("aboutBtn") ||
    document.querySelector(".app-header-right");
  if (!toaster) return;

  if (!anchor) {
    toaster.style.setProperty("--offset-top", "72px");
    toaster.style.setProperty("--offset-right", "16px");
    return;
  }

  const rect = anchor.getBoundingClientRect();
  const top = Math.max(56, Math.round(rect.bottom + 10));
  const right = Math.max(10, Math.round(window.innerWidth - rect.right));
  toaster.style.setProperty("--offset-top", `${top}px`);
  toaster.style.setProperty("--offset-right", `${right}px`);
  toaster.style.setProperty("--mobile-offset-top", `${top}px`);
  toaster.style.setProperty("--mobile-offset-right", `${Math.max(8, right)}px`);
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

/** Muestra/oculta el toaster según si estamos en la página principal. */
export function syncSonnerHomeVisibility() {
  const onHome = isPlanillasHomeSurface();
  document.body.classList.toggle("st2-sonner-home", onHome);
  const toaster = document.getElementById(TOASTER_ID);
  if (toaster) {
    toaster.toggleAttribute("hidden", !onHome);
    toaster.setAttribute("aria-hidden", onHome ? "false" : "true");
  }
  if (onHome) {
    syncSonnerPlacement();
    if (registry.size) syncStackedToastGreetings();
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

  toaster.setAttribute("position", "top-right");
  toaster.setAttribute("rich-colors", "");
  toaster.setAttribute("close-button", "");
  toaster.setAttribute("visible-toasts", "5");
  toaster.setAttribute("container-aria-label", "Notificaciones");
  toaster.setAttribute("theme", currentTheme());
  // Evitar que el attr offset pise el ancla dinámico
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
  }

  // Al entrar/salir de “ver como”, rearmar el saludo con el nombre correcto.
  const refreshGreet = () => {
    syncStackedToastGreetings();
  };
  document.addEventListener("st2:view-as-changed", refreshGreet);
  document.addEventListener("st2:session-changed", refreshGreet);
  document.addEventListener("st2:planillas-view-changed", () => syncSonnerHomeVisibility());
  document.addEventListener("st2:planillas-home", () => {
    // El menú puede montarse un tick después del evento.
    requestAnimationFrame(() => syncSonnerHomeVisibility());
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
  dismissingLocally.add(id);
  try {
    toast.dismiss(id);
  } finally {
    queueMicrotask(() => dismissingLocally.delete(id));
  }
  if (had && GREET_STACK.includes(id)) paintGreetStack();
}

function paintGreetStack() {
  const visible = GREET_STACK.filter((id) => registry.has(id));
  visible.forEach((id, index) => {
    const entry = registry.get(id);
    if (!entry) return;
    const title = plainTitle(
      formatToastMessage(entry.body, { greet: index === 0, stackIndex: index }),
    );
    paintOne(id, title, entry.tone);
  });

  // Quitar del DOM los del stack que ya no están en registry
  for (const id of GREET_STACK) {
    if (!registry.has(id)) {
      dismissingLocally.add(id);
      try {
        toast.dismiss(id);
      } finally {
        queueMicrotask(() => dismissingLocally.delete(id));
      }
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
    // Mismo comportamiento que el action nativo de Sonner: cierra al clickear.
    try {
      toast.dismiss(id);
    } catch {
      /* ignore */
    }
  });
  return btn;
}

function paintOne(id, title, tone) {
  const entry = registry.get(id);
  if (!entry) return;
  // Fuera del home: guardar estado pero no mostrar.
  if (!isPlanillasHomeSurface()) return;
  const method = toneToMethod(tone);
  const opts = {
    id,
    toasterId: TOASTER_ID,
    duration: Infinity,
    richColors: true,
    closeButton: true,
    dismissible: true,
    className: `st2-sonner-toast ${toneClass(tone)}`,
    action: entry.onAction ? makeActionButton(id, entry, tone) : undefined,
    onDismiss: () => {
      if (dismissingLocally.has(id)) return;
      registry.delete(id);
      entry.onDismiss?.();
      if (GREET_STACK.includes(id)) paintGreetStack();
    },
  };

  if (method === "error") toast.error(title, opts);
  else if (method === "warning") toast.warning(title, opts);
  else if (method === "info") toast.info(title, opts);
  else toast.success(title, opts);
}

/** Re-pinta el stack (p. ej. al cambiar nombre / cumpleaños). */
export function syncStackedToastGreetings() {
  if (!registry.size) return;
  paintGreetStack();
  const agua = registry.get(ST2_TOAST.agua);
  if (agua) paintOne(ST2_TOAST.agua, plainTitle(agua.body), "agua");
}
