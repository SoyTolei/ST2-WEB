import { getPlanUserEmail, planUserFetch } from "./plan-user.js";

const FORCE_KEY = "st2-modules-force-all";
/** Acceso total permanente (coincide con backend St2SuperAdmin). */
const SUPER_ADMIN_EMAIL = "leonel.gallo@thomsonreuters.com";
const VIEW_AS_KEY = "st2-view-as-profile-v1";
const MODULES_POLL_MS = 20000;

const MODULE_LABELS = {
  oportunidad: "Oportunidad de Venta",
  pdfPortal: "Generador PDF-Portal",
  blanqueo: "Blanqueo Claves",
  blanqueoConfirm: "puede confirmar blanqueo",
  blanqueoLoad: "puede cargar blanqueo",
  borradoBases: "Borrado de Bases Web",
  borradoBasesConfirm: "puede confirmar borrado",
  borradoBasesLoad: "puede cargar borrado",
};

let cachedFlags = null;
let cachedSt2Admin = false;
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
    planillasSqlOnvio: true,
    planillasTransferencia: true,
    planillasReferral: true,
    planillasLegal: true,
    legalTransferencia: true,
    legalEscalamiento: true,
    planillasChile: true,
    chileTransferencia: true,
    chileReferral: true,
    chileSaad: true,
    chileHr: true,
    chileWiki: true,
    chileLp: true,
    chilePowerapps: true,
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
    planillasSqlOnvio: false,
    planillasTransferencia: false,
    planillasReferral: false,
    planillasLegal: false,
    legalTransferencia: false,
    legalEscalamiento: false,
    planillasChile: false,
    chileTransferencia: false,
    chileReferral: false,
    chileSaad: false,
    chileHr: false,
    chileWiki: false,
    chileLp: false,
    chilePowerapps: false,
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

function setModulesBannerVisible(show) {
  // Unificado: mismo cartel naranja de “actu nueva” (el teal de permisos confunde y se omite).
  if (show) {
    document.dispatchEvent(new CustomEvent("st2:request-reload-banner"));
  }
  // Ocultar el banner legacy por si quedó en el DOM.
  const banner = document.getElementById("st2-modules-banner");
  if (banner) {
    banner.classList.add("hidden");
    banner.setAttribute("hidden", "");
  }
  document.body.classList.remove("st2-has-modules-update");
}

function bindModulesBanner() {
  if (modulesBannerBound) return;
  modulesBannerBound = true;
  // El reload vive en el cartel unificado (#st2-update-reload).
}

function readViewAs() {
  try {
    const raw = sessionStorage.getItem(VIEW_AS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.email || !data.modules) return null;
    return data;
  } catch {
    return null;
  }
}

export function getViewAsProfile() {
  return readViewAs();
}

export function isViewingAsProfile() {
  return !!readViewAs();
}

export function startViewAsProfile({ email, displayName, modules, st2Admin = false }) {
  const payload = {
    email: String(email || "").trim().toLowerCase(),
    displayName: String(displayName || "").trim() || email,
    modules: cloneFlags(parseFlagsFromApi(modules || {})),
    st2Admin: !!st2Admin,
  };
  sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify(payload));
  try {
    sessionStorage.removeItem("st2-blanqueo-preview-list-only");
    sessionStorage.removeItem("st2-borrado-preview-list-only");
  } catch { /* ignore */ }
  document.dispatchEvent(new CustomEvent("st2:view-as-changed", { detail: payload }));
}

export function clearViewAsProfile() {
  sessionStorage.removeItem(VIEW_AS_KEY);
  document.dispatchEvent(new CustomEvent("st2:view-as-changed", { detail: null }));
}

export function isPrimarySuperAdmin(email = getPlanUserEmail()) {
  const viewAs = readViewAs();
  if (viewAs?.email) {
    return String(viewAs.email).trim().toLowerCase() === SUPER_ADMIN_EMAIL;
  }
  return String(email || "").trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

/**
 * Panel Admin / privilegios de administración.
 * En “ver como”, usa el flag ADMIN WEB del perfil previsualizado.
 */
export function isSt2SuperAdmin(email = getPlanUserEmail()) {
  const viewAs = readViewAs();
  if (viewAs) {
    if (String(viewAs.email || "").trim().toLowerCase() === SUPER_ADMIN_EMAIL) return true;
    return !!viewAs.st2Admin;
  }
  const target = String(email || "").trim().toLowerCase();
  const me = String(getPlanUserEmail() || "").trim().toLowerCase();
  if (target && target !== me) {
    return target === SUPER_ADMIN_EMAIL;
  }
  if (String(me).trim().toLowerCase() === SUPER_ADMIN_EMAIL) return true;
  return !!cachedSt2Admin;
}

export function getCachedModuleFlags() {
  const viewAs = readViewAs();
  if (viewAs?.modules) return cloneFlags(viewAs.modules);
  if (isPrimarySuperAdmin()) return fullFlags();
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
    planillasSqlOnvio: m.planillasSqlOnvio == null ? true : !!m.planillasSqlOnvio,
    planillasTransferencia: m.planillasTransferencia == null ? true : !!m.planillasTransferencia,
    planillasReferral: m.planillasReferral == null ? true : !!m.planillasReferral,
    planillasLegal: m.planillasLegal == null ? true : !!m.planillasLegal,
    legalTransferencia: m.legalTransferencia == null ? true : !!m.legalTransferencia,
    legalEscalamiento: m.legalEscalamiento == null ? true : !!m.legalEscalamiento,
    planillasChile: m.planillasChile == null ? true : !!m.planillasChile,
    chileTransferencia: m.chileTransferencia == null ? true : !!m.chileTransferencia,
    chileReferral: m.chileReferral == null ? true : !!m.chileReferral,
    chileSaad: m.chileSaad == null ? true : !!m.chileSaad,
    chileHr: m.chileHr == null ? true : !!m.chileHr,
    chileWiki: m.chileWiki == null ? true : !!m.chileWiki,
    chileLp: m.chileLp == null ? true : !!m.chileLp,
    chilePowerapps: m.chilePowerapps == null ? true : !!m.chilePowerapps,
  };
}

/**
 * @param {{ force?: boolean, baseline?: boolean, detectNew?: boolean }} [opts]
 * baseline: guarda el snapshot sin avisar (primer carga).
 * detectNew: compara contra knownFlags y muestra banner si hay altas.
 */
export async function refreshModuleFlags({ force = false, baseline = false, detectNew = false } = {}) {
  try {
    if (localStorage.getItem(FORCE_KEY) === "1" || isPrimarySuperAdmin()) {
      cachedFlags = fullFlags();
      cachedSt2Admin = true;
      lastLoadedAt = Date.now();
      if (baseline || !knownFlags) knownFlags = cloneFlags(cachedFlags);
      return getCachedModuleFlags();
    }
  } catch {
    if (isPrimarySuperAdmin()) {
      cachedFlags = fullFlags();
      cachedSt2Admin = true;
      if (baseline || !knownFlags) knownFlags = cloneFlags(cachedFlags);
      return getCachedModuleFlags();
    }
  }

  if (!getPlanUserEmail()) {
    cachedFlags = emptyFlags();
    cachedSt2Admin = false;
    if (baseline) knownFlags = cloneFlags(cachedFlags);
    return getCachedModuleFlags();
  }

  if (!force && loadPromise) return loadPromise;
  if (!force && cachedFlags && Date.now() - lastLoadedAt < 60000) {
    return getCachedModuleFlags();
  }

  loadPromise = (async () => {
    try {
      const res = await planUserFetch("/api/planillas/modules");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      const next = parseFlagsFromApi(data.modules || {});
      cachedSt2Admin = !!data.st2Admin || isPrimarySuperAdmin();
      const prevKnown = knownFlags ? cloneFlags(knownFlags) : null;

      cachedFlags = next;
      lastLoadedAt = Date.now();

      if (baseline || !knownFlags) {
        knownFlags = cloneFlags(next);
      } else if (detectNew && prevKnown) {
        const gained = newlyEnabledKeys(prevKnown, next);
        if (gained.length) {
          setModulesBannerVisible(true);
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
    if (isPrimarySuperAdmin()) return;
    if (readViewAs()) return;
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

export function canSeePlanillasSqlOnvio() {
  return !!getCachedModuleFlags().planillasSqlOnvio;
}

export function canSeePlanillasLegal() {
  return !!getCachedModuleFlags().planillasLegal;
}

export function canSeePlanillasChile() {
  return !!getCachedModuleFlags().planillasChile;
}

export function canSeePlanillasTransferencia() {
  return !!getCachedModuleFlags().planillasTransferencia;
}

export function canSeePlanillasReferral() {
  return !!getCachedModuleFlags().planillasReferral;
}

export function canSeeLegalTransferencia() {
  return !!getCachedModuleFlags().legalTransferencia;
}

export function canSeeLegalEscalamiento() {
  return !!getCachedModuleFlags().legalEscalamiento;
}

export function canSeeChileTransferencia() {
  return !!getCachedModuleFlags().chileTransferencia;
}

export function canSeeChileReferral() {
  return !!getCachedModuleFlags().chileReferral;
}

export function canSeeChileSaad() {
  return !!getCachedModuleFlags().chileSaad;
}

export function canSeeChileHr() {
  return !!getCachedModuleFlags().chileHr;
}

export function canSeeChileWiki() {
  return !!getCachedModuleFlags().chileWiki;
}

export function canSeeChileLp() {
  return !!getCachedModuleFlags().chileLp;
}

export function canSeeChilePowerapps() {
  return !!getCachedModuleFlags().chilePowerapps;
}
