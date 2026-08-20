import { getPlanUserEmail, planUserFetch } from "./plan-user.js";

const FORCE_KEY = "st2-modules-force-all";
/** Acceso total permanente (coincide con backend St2SuperAdmin). */
const SUPER_ADMIN_EMAIL = "leonel.gallo@thomsonreuters.com";
const MODULES_POLL_MS = 20000;

const MODULE_LABELS = {
  oportunidad: "Oportunidad de Venta",
  pdfPortal: "Generador de PDFs",
  blanqueo: "Blanqueo de accesos",
  blanqueoConfirm: "confirmar blanqueo",
  blanqueoLoad: "cargar blanqueo",
  borradoBases: "Borrado de bases",
  borradoBasesConfirm: "confirmar borrado de bases",
  borradoBasesLoad: "cargar borrado de bases",
};

let cachedFlags = null;
let loadPromise = null;
let lastLoadedAt = 0;
/** Snapshot de flags ya “conocidos” por el usuario (para detectar altas nuevas). */
let knownFlags = null;
let modulesPollTimer = null;
let modulesBannerBound = false;

function fullFlags() {
  return {
    oportunidad: true,
    pdfPortal: true,
    blanqueo: true,
    blanqueoConfirm: true,
    blanqueoLoad: true,
    borradoBases: true,
    borradoBasesConfirm: true,
    borradoBasesLoad: true,
  };
}

function emptyFlags() {
  return {
    oportunidad: false,
    pdfPortal: false,
    blanqueo: false,
    blanqueoConfirm: false,
    blanqueoLoad: false,
    borradoBases: false,
    borradoBasesConfirm: false,
    borradoBasesLoad: false,
  };
}

function cloneFlags(flags) {
  return { ...(flags || emptyFlags()) };
}

function newlyEnabledKeys(prev, next) {
  const keys = [];
  for (const key of Object.keys(MODULE_LABELS)) {
    if (!prev?.[key] && next?.[key]) keys.push(key);
  }
  return keys;
}

function describeNewModules(keys) {
  if (!keys.length) return "Se actualizaron tus permisos de módulos. Recargá para ver los cambios.";
  const labels = keys.map((k) => MODULE_LABELS[k] || k);
  if (labels.length === 1) {
    return `Se habilitó: ${labels[0]}. Recargá para verlo en Planillas.`;
  }
  if (labels.length === 2) {
    return `Se habilitaron: ${labels[0]} y ${labels[1]}. Recargá para verlos.`;
  }
  return `Se habilitaron ${labels.length} permisos nuevos. Recargá para verlos en Planillas.`;
}

function setModulesBannerVisible(show, message) {
  const banner = document.getElementById("st2-modules-banner");
  const text = document.getElementById("st2-modules-banner-text");
  if (!banner) return;
  if (message && text) text.textContent = message;
  banner.classList.toggle("hidden", !show);
  banner.toggleAttribute("hidden", !show);
  document.body.classList.toggle("st2-has-modules-update", !!show);
}

function bindModulesBanner() {
  if (modulesBannerBound) return;
  modulesBannerBound = true;
  document.getElementById("st2-modules-reload")?.addEventListener("click", () => {
    window.location.reload();
  });
}

export function isSt2SuperAdmin(email = getPlanUserEmail()) {
  return String(email || "").trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

export function getCachedModuleFlags() {
  if (isSt2SuperAdmin()) return fullFlags();
  return cachedFlags || emptyFlags();
}

function parseFlagsFromApi(m) {
  return {
    oportunidad: !!m.oportunidad,
    pdfPortal: !!m.pdfPortal,
    blanqueo: !!m.blanqueo,
    blanqueoConfirm: !!m.blanqueoConfirm,
    blanqueoLoad: m.blanqueoLoad == null ? !m.blanqueoConfirm : !!m.blanqueoLoad,
    borradoBases: !!m.borradoBases,
    borradoBasesConfirm: !!m.borradoBasesConfirm,
    borradoBasesLoad: m.borradoBasesLoad == null ? !m.borradoBasesConfirm : !!m.borradoBasesLoad,
  };
}

/**
 * @param {{ force?: boolean, baseline?: boolean, detectNew?: boolean }} [opts]
 * baseline: guarda el snapshot sin avisar (primer carga).
 * detectNew: compara contra knownFlags y muestra banner si hay altas.
 */
export async function refreshModuleFlags({ force = false, baseline = false, detectNew = false } = {}) {
  try {
    if (localStorage.getItem(FORCE_KEY) === "1" || isSt2SuperAdmin()) {
      cachedFlags = fullFlags();
      lastLoadedAt = Date.now();
      if (baseline || !knownFlags) knownFlags = cloneFlags(cachedFlags);
      return cachedFlags;
    }
  } catch {
    if (isSt2SuperAdmin()) {
      cachedFlags = fullFlags();
      if (baseline || !knownFlags) knownFlags = cloneFlags(cachedFlags);
      return cachedFlags;
    }
  }

  if (!getPlanUserEmail()) {
    cachedFlags = emptyFlags();
    if (baseline) knownFlags = cloneFlags(cachedFlags);
    return cachedFlags;
  }

  if (!force && loadPromise) return loadPromise;
  if (!force && cachedFlags && Date.now() - lastLoadedAt < 60000) {
    return cachedFlags;
  }

  loadPromise = (async () => {
    try {
      const res = await planUserFetch("/api/planillas/modules");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      const next = parseFlagsFromApi(data.modules || {});
      const prevKnown = knownFlags ? cloneFlags(knownFlags) : null;

      cachedFlags = next;
      lastLoadedAt = Date.now();

      if (baseline || !knownFlags) {
        knownFlags = cloneFlags(next);
      } else if (detectNew && prevKnown) {
        const gained = newlyEnabledKeys(prevKnown, next);
        if (gained.length) {
          setModulesBannerVisible(true, describeNewModules(gained));
          document.dispatchEvent(new CustomEvent("st2:modules-access-changed", {
            detail: { gained, flags: cloneFlags(next) },
          }));
          // Actualiza baseline para no re-avisar lo mismo, pero el banner sigue hasta recargar.
          knownFlags = cloneFlags(next);
        }
      }
    } catch {
      // No pisar flags buenos por un fallo momentáneo de red.
      if (!cachedFlags) cachedFlags = emptyFlags();
    } finally {
      loadPromise = null;
    }
    return getCachedModuleFlags();
  })();

  return loadPromise;
}

export function startModuleAccessPolling() {
  bindModulesBanner();
  if (modulesPollTimer) return;

  const tick = () => {
    if (document.visibilityState === "hidden") return;
    if (isSt2SuperAdmin()) return;
    void refreshModuleFlags({ force: true, detectNew: true }).then((flags) => {
      document.dispatchEvent(new CustomEvent("st2:modules-flags-refreshed", {
        detail: { flags: cloneFlags(flags) },
      }));
    });
  };

  modulesPollTimer = setInterval(tick, MODULES_POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tick();
  });
}

export function canSeeOportunidadModule() {
  return !!getCachedModuleFlags().oportunidad;
}

export function canSeePdfPortalModule() {
  return !!getCachedModuleFlags().pdfPortal;
}

export function canSeeBlanqueoModule() {
  return !!getCachedModuleFlags().blanqueo;
}

export function canConfirmBlanqueoModule() {
  return !!getCachedModuleFlags().blanqueoConfirm;
}

export function canLoadBlanqueoModule() {
  return !!getCachedModuleFlags().blanqueoLoad;
}

export function canSeeBorradoBasesModule() {
  return !!getCachedModuleFlags().borradoBases;
}

export function canConfirmBorradoBasesModule() {
  return !!getCachedModuleFlags().borradoBasesConfirm;
}

export function canLoadBorradoBasesModule() {
  return !!getCachedModuleFlags().borradoBasesLoad;
}
