import { getPlanUserEmail, planUserFetch } from "./plan-user.js";

const FORCE_KEY = "st2-modules-force-all";

let cachedFlags = null;
let loadPromise = null;

export function getCachedModuleFlags() {
  return cachedFlags || {
    oportunidad: false,
    pdfPortal: false,
    blanqueo: false,
    blanqueoConfirm: false,
  };
}

export async function refreshModuleFlags() {
  try {
    if (localStorage.getItem(FORCE_KEY) === "1") {
      cachedFlags = {
        oportunidad: true,
        pdfPortal: true,
        blanqueo: true,
        blanqueoConfirm: true,
      };
      return cachedFlags;
    }
  } catch { /* ignore */ }

  if (!getPlanUserEmail()) {
    cachedFlags = {
      oportunidad: false,
      pdfPortal: false,
      blanqueo: false,
      blanqueoConfirm: false,
    };
    return cachedFlags;
  }

  if (loadPromise) return loadPromise;

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
    } catch {
      cachedFlags = {
        oportunidad: false,
        pdfPortal: false,
        blanqueo: false,
        blanqueoConfirm: false,
      };
    } finally {
      loadPromise = null;
    }
    return cachedFlags;
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
