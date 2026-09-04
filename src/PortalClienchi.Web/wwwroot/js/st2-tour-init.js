import {
  startTour,
  maybeStartTour,
  stopTour,
  isTourRunning,
  isTourCompleted,
  isTourSeen,
  shouldAutoStartTours,
} from "./st2-tour-engine.js";
import {
  resolveTour,
  resolveCurrentTourId,
  tourIdForReferralView,
  tourLabelForId,
} from "./st2-tour-catalog.js";

let tourContext = {};
let headerBound = false;
let homeAutoTimer = null;

export function setTourContext(partial) {
  tourContext = { ...tourContext, ...partial };
  syncHeaderTourButton();
}

export function getCurrentTourId() {
  return resolveCurrentTourId(tourContext);
}

export function playTour(tourId, { force = true } = {}) {
  const id = tourId || getCurrentTourId();
  const definition = resolveTour(id, tourContext);
  if (!definition) return Promise.resolve(false);
  return startTour(definition, { force, ctx: tourContext });
}

export function autoTour(tourId, options = {}) {
  const id = tourId || getCurrentTourId();
  const definition = resolveTour(id, tourContext);
  if (!definition) return;
  maybeStartTour(definition, { ...options, ctx: tourContext });
}

export function autoTourForReferral(delay = 700) {
  autoTour(tourIdForReferralView(tourContext), { delay });
}

export function syncHeaderTourButton() {
  const btn = document.getElementById("st2-tour-header-btn");
  const labelEl = document.getElementById("st2-tour-header-btn-label");
  if (!btn || !labelEl) return;

  const tourId = getCurrentTourId();
  const definition = tourId ? resolveTour(tourId, tourContext) : null;
  const show = !!definition?.steps?.length;

  btn.classList.toggle("hidden", !show);
  btn.toggleAttribute("hidden", !show);
  btn.dataset.tourId = tourId || "";

  if (show) {
    labelEl.textContent = "Tutorial";
    btn.title = "Tutorial";
    btn.setAttribute("aria-label", "Tutorial");
  }
}

function bindHeaderTourButton() {
  if (headerBound) return;
  headerBound = true;
  document.getElementById("st2-tour-header-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    const tourId = e.currentTarget?.dataset?.tourId || getCurrentTourId();
    void playTour(tourId, { force: true });
  });
}

export function initSt2Tours() {
  bindHeaderTourButton();
  document.getElementById("st2-tour-menu-help")?.closest(".plan-menu-tour-wrap")?.remove();
  syncHeaderTourButton();

  document.addEventListener("st2:planillas-home", () => {
    syncHeaderTourButton();
    // Debounce: planillas-home se dispara varias veces al iniciar.
    if (homeAutoTimer) clearTimeout(homeAutoTimer);
    homeAutoTimer = setTimeout(() => {
      homeAutoTimer = null;
      if (!shouldAutoStartTours()) return;
      autoTour(`planillas-menu:${tourContext.getSistema?.()}`, { delay: 0 });
    }, 700);
  });

  document.addEventListener("st2:planillas-view-changed", () => {
    syncHeaderTourButton();
  });

  document.addEventListener("st2:tour-context-changed", () => {
    syncHeaderTourButton();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isTourRunning()) {
      e.stopPropagation();
      stopTour();
    }
  });
}

export function notifyTourContextChanged() {
  document.dispatchEvent(new CustomEvent("st2:tour-context-changed"));
}

/** Bienvenida: solo usuarios nuevos (gate on). Ya no es un tour de un solo paso del tema. */
export function scheduleWelcomeTour(delay = 1800) {
  if (!shouldAutoStartTours()) return;
  if (isTourSeen("welcome") || isTourSeen("planillas-menu")) return;
  setTimeout(() => {
    if (isTourRunning()) return;
    if (!shouldAutoStartTours()) return;
    if (isTourSeen("welcome") || isTourSeen("planillas-menu")) return;
    // Preferimos el menú de planillas (incluye tema + módulos). Welcome queda de respaldo.
    const sistema = tourContext.getSistema?.() || "BejermanSql";
    autoTour(`planillas-menu:${sistema}`, { delay: 0, force: false });
  }, delay);
}

export {
  startTour,
  stopTour,
  isTourRunning,
  isTourCompleted,
  isTourSeen,
  resolveTour,
  tourIdForReferralView,
  resolveCurrentTourId,
  tourLabelForId,
};
