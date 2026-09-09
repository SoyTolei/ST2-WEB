/**
 * Uso por módulo: cuenta qué opciones abren los usuarios (agregado por día en el server).
 */

const PING_URL = "/api/planillas/usage";
/** Mismo módulo dos veces seguidas dentro de esta ventana no vuelve a contar. */
const DEDUPE_MS = 20000;

const lastSent = new Map();

/** Vistas de planillas → clave estable para el panel. */
const VIEW_KEYS = {
  transferencia: "transferencia",
  referral: "referral",
  oportunidadMenu: "oportunidad",
  oportunidadCargar: "oportunidad",
  oportunidadGestor: "oportunidad",
  blanqueo: "blanqueo",
  borradoBases: "borradoBases",
  chileEmbed: "chileEmbed",
  placeholder: "",
  menu: "",
};

export function trackUsage(module) {
  const key = String(module || "").trim().toLowerCase();
  if (!key) return;

  const now = Date.now();
  const prev = lastSent.get(key) || 0;
  if (now - prev < DEDUPE_MS) return;
  lastSent.set(key, now);

  void fetch(PING_URL, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ module: key }),
    keepalive: true,
  }).catch(() => {
    // Métrica best-effort: si falla, no molestamos al usuario.
    lastSent.delete(key);
  });
}

export function initUsageTracking() {
  document.addEventListener("st2:planillas-view-changed", (e) => {
    const view = String(e.detail?.view || "");
    const key = VIEW_KEYS[view];
    if (key) trackUsage(key);
  });
}
