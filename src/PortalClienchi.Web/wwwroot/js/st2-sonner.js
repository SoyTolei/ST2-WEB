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

export function syncSonnerTheme() {
  const el = document.getElementById(TOASTER_ID);
  if (el) el.setAttribute("theme", currentTheme());
}

export function initSt2Sonner() {
  if (inited) {
    syncSonnerTheme();
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
  toaster.setAttribute("offset", "72px");
  toaster.setAttribute("container-aria-label", "Notificaciones");
  toaster.setAttribute("theme", currentTheme());

  syncSonnerTheme();
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

function paintOne(id, title, tone) {
  const entry = registry.get(id);
  if (!entry) return;
  const method = toneToMethod(tone);
  const opts = {
    id,
    toasterId: TOASTER_ID,
    duration: Infinity,
    richColors: true,
    closeButton: true,
    dismissible: true,
    action: entry.onAction
      ? {
          label: entry.actionLabel || "Ver",
          onClick: () => {
            entry.onAction?.();
          },
        }
      : undefined,
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
