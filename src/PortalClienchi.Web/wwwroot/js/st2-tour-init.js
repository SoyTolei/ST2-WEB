import {
  startTour,
  maybeStartTour,
  stopTour,
  isTourRunning,
  isTourCompleted,
  isTourSeen,
} from "./st2-tour-engine.js";
import { resolveTour, tourIdForReferralView } from "./st2-tour-catalog.js";

let tourContext = {};

export function setTourContext(partial) {
  tourContext = { ...tourContext, ...partial };
}

export function playTour(tourId, { force = true } = {}) {
  const definition = resolveTour(tourId, tourContext);
  if (!definition) return Promise.resolve(false);
  return startTour(definition, { force, ctx: tourContext });
}

export function autoTour(tourId, options = {}) {
  const definition = resolveTour(tourId, tourContext);
  if (!definition) return;
  maybeStartTour(definition, { ...options, ctx: tourContext });
}

export function autoTourForReferral(delay = 700) {
  const tourId = tourIdForReferralView(tourContext);
  autoTour(tourId, { delay });
}

function createHelpButton(tourId, label = "Ver tutorial") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "st2-tour-help-btn";
  btn.dataset.tourId = tourId;
  btn.title = "Ver tutorial de esta pantalla";
  btn.setAttribute("aria-label", "Ver tutorial de esta pantalla");
  btn.textContent = label;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    void playTour(tourId, { force: true });
  });
  return btn;
}

export function mountModuleTourButtons() {
  const map = [
    { viewId: "planillas-transferencia", tourId: () => `transferencia:${tourContext.getSistema?.()}` },
    { viewId: "planillas-referral", tourId: () => tourIdForReferralView(tourContext) },
    { viewId: "planillas-oportunidad-menu", tourId: () => "oportunidad-menu" },
    { viewId: "planillas-oportunidad-cargar", tourId: () => "oportunidad-menu" },
    { viewId: "planillas-oportunidad-gestor", tourId: () => "oportunidad-menu" },
    { viewId: "planillas-blanqueo", tourId: null },
    { viewId: "planillas-borrado-bases", tourId: null },
    { viewId: "planillas-pdf-portal", tourId: null },
  ];

  map.forEach(({ viewId, tourId }) => {
    if (!tourId) return;
    const view = document.getElementById(viewId);
    const bar = view?.querySelector(".plan-module-header-bar");
    if (!bar || bar.querySelector(".st2-tour-help-btn")) return;
    const id = tourId();
    if (!id || !resolveTour(id, tourContext)) return;
    bar.appendChild(createHelpButton(id));
  });
}

export function mountMenuTourHelp() {
  if (document.getElementById("st2-tour-menu-help")) {
    refreshMenuTourHelp();
    return;
  }

  const anchor = document.getElementById("plan-opciones-section-title")
    || document.getElementById("plan-legal-products-wrap")
    || document.getElementById("plan-sistema-section");
  if (!anchor) return;

  const wrap = document.createElement("div");
  wrap.className = "plan-menu-tour-wrap";
  const sistema = tourContext.getSistema?.() || "BejermanSql";
  const btn = createHelpButton(`planillas-menu:${sistema}`, "Ver tutorial del menú");
  btn.id = "st2-tour-menu-help";
  wrap.appendChild(btn);
  anchor.insertAdjacentElement("afterend", wrap);
}

export function refreshMenuTourHelp() {
  const btn = document.getElementById("st2-tour-menu-help");
  const sistema = tourContext.getSistema?.() || "BejermanSql";
  const tourId = `planillas-menu:${sistema}`;
  if (btn) btn.dataset.tourId = tourId;
}

export function initSt2Tours() {
  mountMenuTourHelp();
  mountModuleTourButtons();

  document.addEventListener("st2:planillas-home", () => {
    refreshMenuTourHelp();
    mountModuleTourButtons();
    autoTour(`planillas-menu:${tourContext.getSistema?.()}`, { delay: 600 });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isTourRunning()) {
      e.stopPropagation();
      stopTour();
    }
  });
}

export function scheduleWelcomeTour(delay = 1800) {
  if (isTourSeen("welcome")) return;
  setTimeout(() => {
    if (isTourRunning()) return;
    autoTour("welcome", { delay: 0, force: false });
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
};
