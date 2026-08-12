import { getPlanUserEmail, planUserFetch } from "./plan-user.js";

const FORCE_KEY = "st2-modules-force-all";
/** Acceso total permanente (coincide con backend St2SuperAdmin). */
const SUPER_ADMIN_EMAIL = "leonel.gallo@thomsonreuters.com";

let cachedFlags = null;
let loadPromise = null;
let lastLoadedAt = 0;

function fullFlags() {
  return {
    oportunidad: true,
    pdfPortal: true,
    blanqueo: true,
    blanqueoConfirm: true,
  };
}

function emptyFlags() {
  return {
    oportunidad: false,
    pdfPortal: false,
    blanqueo: false,
    blanqueoConfirm: false,
  };
}

export function isSt2SuperAdmin(email = getPlanUserEmail()) {
  return String(email || "").trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

export function getCachedModuleFlags() {
  if (isSt2SuperAdmin()) return fullFlags();
  return cachedFlags || emptyFlags();
}

export async function refreshModuleFlags({ force = false } = {}) {
  try {
    if (localStorage.getItem(FORCE_KEY) === "1" || isSt2SuperAdmin()) {
      cachedFlags = fullFlags();
      lastLoadedAt = Date.now();
      return cachedFlags;
    }
  } catch {
    if (isSt2SuperAdmin()) {
      cachedFlags = fullFlags();
      return cachedFlags;
    }
  }

  if (!getPlanUserEmail()) {
    cachedFlags = emptyFlags();
    return cachedFlags;
  }

  if (!force && loadPromise) return loadPromise;
  if (!force && cachedFlags && Date.now() - lastLoadedAt < 8000) {
    return cachedFlags;
  }

  loadPromise = (async () => {
    try {
      const res = await planUserFetch("/api/planillas/modules");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      const m = data.modules || {};
      cachedFlags = {
        oportunidad: !!m.oportunidad,
        pdfPortal: !!m.pdfPortal,
        blanqueo: !!m.blanqueo,
        blanqueoConfirm: !!m.blanqueoConfirm,
      };
      lastLoadedAt = Date.now();
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
