const STORAGE_KEY = "st2-tour-progress-v1";

let root = null;
let spotlight = null;
let card = null;
let titleEl = null;
let bodyEl = null;
let progressEl = null;
let btnSkip = null;
let btnPrev = null;
let btnNext = null;

let activeTour = null;
let activeSteps = [];
let stepIndex = 0;
let resizeObserver = null;
let repositionTimer = null;

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveProgress(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function getTourStatus(tourId) {
  return loadProgress()[tourId]?.status || null;
}

/** Agrupa tours por familia (p. ej. planillas-menu:BejermanSql → planillas-menu). */
function tourFamilyId(tourId) {
  if (!tourId) return null;
  const colon = tourId.indexOf(":");
  if (colon > 0) return tourId.slice(0, colon);
  return tourId;
}

export function isTourCompleted(tourId) {
  return getTourStatus(tourId) === "completed";
}

export function isTourSeen(tourId) {
  const status = getTourStatus(tourId);
  if (status === "completed" || status === "skipped") return true;

  const family = tourFamilyId(tourId);
  if (!family) return false;

  const data = loadProgress();
  if (family !== tourId) {
    const familyStatus = data[family]?.status;
    if (familyStatus === "completed" || familyStatus === "skipped") return true;
  }

  return Object.entries(data).some(([id, entry]) => {
    if (id === tourId) return false;
    if (!(id === family || id.startsWith(`${family}:`))) return false;
    return entry?.status === "completed" || entry?.status === "skipped";
  });
}

/** Autos solo para usuarios nuevos (sin ningún tutorial visto). Después: solo botón manual. */
export function shouldAutoStartTours() {
  const data = loadProgress();
  return !Object.values(data).some(
    (entry) => entry?.status === "completed" || entry?.status === "skipped",
  );
}

export function markTourStatus(tourId, status) {
  if (!tourId) return;
  const data = loadProgress();
  const at = new Date().toISOString();
  data[tourId] = { status, at };
  const family = tourFamilyId(tourId);
  if (family && family !== tourId) {
    data[family] = { status, at };
  }
  saveProgress(data);
}

function ensureDom() {
  if (root) return;

  root = document.createElement("div");
  root.id = "st2-tour-root";
  root.className = "st2-tour-root";
  root.hidden = true;
  root.innerHTML = `
    <div class="st2-tour-spotlight" aria-hidden="true"></div>
    <div class="st2-tour-card" role="dialog" aria-modal="true" aria-labelledby="st2-tour-title">
      <div class="st2-tour-card-accent" aria-hidden="true"></div>
      <div class="st2-tour-card-inner">
        <p class="st2-tour-kicker">Tutorial</p>
        <h3 id="st2-tour-title" class="st2-tour-title"></h3>
        <p class="st2-tour-body"></p>
        <p class="st2-tour-progress"></p>
        <div class="st2-tour-actions">
          <button type="button" class="st2-tour-btn st2-tour-btn--ghost" data-tour-skip>Salir</button>
          <button type="button" class="st2-tour-btn st2-tour-btn--ghost" data-tour-prev>Anterior</button>
          <button type="button" class="st2-tour-btn st2-tour-btn--primary" data-tour-next>Siguiente</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  spotlight = root.querySelector(".st2-tour-spotlight");
  card = root.querySelector(".st2-tour-card");
  titleEl = root.querySelector(".st2-tour-title");
  bodyEl = root.querySelector(".st2-tour-body");
  progressEl = root.querySelector(".st2-tour-progress");
  btnSkip = root.querySelector("[data-tour-skip]");
  btnPrev = root.querySelector("[data-tour-prev]");
  btnNext = root.querySelector("[data-tour-next]");

  btnSkip.addEventListener("click", () => finishTour("skipped"));
  btnPrev.addEventListener("click", () => goStep(stepIndex - 1));
  btnNext.addEventListener("click", () => {
    if (stepIndex >= activeSteps.length - 1) finishTour("completed");
    else goStep(stepIndex + 1);
  });

  root.addEventListener("keydown", (e) => {
    if (!activeTour) return;
    if (e.key === "Escape") {
      e.preventDefault();
      finishTour("skipped");
    }
  });

  window.addEventListener("resize", scheduleReposition);
  window.addEventListener("scroll", scheduleReposition, true);
}

function scheduleReposition() {
  if (!activeTour) return;
  if (repositionTimer) clearTimeout(repositionTimer);
  repositionTimer = setTimeout(() => renderStep(), 60);
}

function isVisible(el) {
  if (!el) return false;
  if (el.closest(".hidden,[hidden]")) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

async function waitForElement(selector, timeout = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = selector ? document.querySelector(selector) : null;
    if (!selector || isVisible(el)) return el;
    await new Promise((r) => setTimeout(r, 80));
  }
  return selector ? document.querySelector(selector) : null;
}

function filterSteps(steps, ctx) {
  return (steps || []).filter((step) => {
    if (typeof step.when === "function" && !step.when(ctx)) return false;
    if (step.selector && !document.querySelector(step.selector)) return false;
    return true;
  });
}

function positionCard(target, placement = "bottom") {
  if (!card) return;
  const margin = 12;
  const cardRect = card.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!target) {
    card.style.top = `${Math.max(margin, (vh - cardRect.height) / 2)}px`;
    card.style.left = `${Math.max(margin, (vw - cardRect.width) / 2)}px`;
    return;
  }

  const rect = target.getBoundingClientRect();
  let top = rect.bottom + margin;
  let left = rect.left;

  if (placement === "top") {
    top = rect.top - cardRect.height - margin;
    left = rect.left;
  } else if (placement === "left") {
    top = rect.top;
    left = rect.left - cardRect.width - margin;
  } else if (placement === "right") {
    top = rect.top;
    left = rect.right + margin;
  } else if (placement === "bottom") {
    top = rect.bottom + margin;
    left = rect.left;
  }

  if (left + cardRect.width > vw - margin) left = vw - cardRect.width - margin;
  if (left < margin) left = margin;
  if (top + cardRect.height > vh - margin) {
    top = Math.max(margin, rect.top - cardRect.height - margin);
  }
  if (top < margin) top = margin;

  card.style.top = `${top}px`;
  card.style.left = `${left}px`;
}

function positionSpotlight(target) {
  if (!spotlight) return;
  if (!target) {
    spotlight.classList.add("is-center");
    return;
  }
  spotlight.classList.remove("is-center");
  const rect = target.getBoundingClientRect();
  const pad = 6;
  spotlight.style.top = `${Math.max(0, rect.top - pad)}px`;
  spotlight.style.left = `${Math.max(0, rect.left - pad)}px`;
  spotlight.style.width = `${rect.width + pad * 2}px`;
  spotlight.style.height = `${rect.height + pad * 2}px`;
}

async function renderStep() {
  const step = activeSteps[stepIndex];
  if (!step) return;

  if (typeof step.beforeShow === "function") {
    await step.beforeShow(activeTour.ctx);
  }

  const target = step.center ? null : await waitForElement(step.selector);
  if (step.selector && !step.center && !isVisible(target)) {
    if (stepIndex < activeSteps.length - 1) {
      goStep(stepIndex + 1);
      return;
    }
    finishTour("skipped");
    return;
  }

  if (target) {
    target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    await new Promise((r) => setTimeout(r, 120));
  }

  titleEl.textContent = step.title || "";
  bodyEl.textContent = step.body || "";
  progressEl.textContent = `Paso ${stepIndex + 1} de ${activeSteps.length}`;

  btnPrev.disabled = stepIndex === 0;
  btnNext.textContent = stepIndex >= activeSteps.length - 1 ? "Finalizar" : "Siguiente";

  positionSpotlight(target);
  positionCard(target, step.placement || "bottom");

  if (resizeObserver) resizeObserver.disconnect();
  if (target && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(scheduleReposition);
    resizeObserver.observe(target);
  }
}

function goStep(index) {
  if (!activeTour) return;
  if (index < 0 || index >= activeSteps.length) return;
  stepIndex = index;
  void renderStep();
}

function finishTour(status) {
  if (!activeTour) return;
  const tourId = activeTour.id;
  if (status === "completed") markTourStatus(tourId, "completed");
  else if (status === "skipped") markTourStatus(tourId, "skipped");

  activeTour = null;
  activeSteps = [];
  stepIndex = 0;
  if (resizeObserver) resizeObserver.disconnect();
  resizeObserver = null;
  root.classList.remove("is-active");
  root.hidden = true;
  document.body.classList.remove("st2-tour-active");
}

export function stopTour() {
  finishTour("skipped");
}

export function isTourRunning() {
  return !!activeTour;
}

export async function startTour(definition, { force = false, ctx = {} } = {}) {
  if (!definition?.id || !definition.steps?.length) return false;
  if (!force && !shouldAutoStartTours()) return false;
  if (!force && isTourSeen(definition.id)) return false;
  if (activeTour) stopTour();

  ensureDom();
  activeSteps = filterSteps(definition.steps, ctx);
  if (!activeSteps.length) return false;

  activeTour = { id: definition.id, ctx };
  stepIndex = 0;
  root.hidden = false;
  root.classList.add("is-active");
  document.body.classList.add("st2-tour-active");
  await renderStep();
  return true;
}

export function maybeStartTour(resolveDefinition, options = {}) {
  const { delay = 500, force = false, ctx = {} } = options;
  const definition = typeof resolveDefinition === "function"
    ? resolveDefinition(ctx)
    : resolveDefinition;
  if (!definition?.id) return;
  if (!force && !shouldAutoStartTours()) return;
  if (!force && isTourSeen(definition.id)) return;

  setTimeout(() => {
    if (isTourRunning()) return;
    if (!force && !shouldAutoStartTours()) return;
    if (!force && isTourSeen(definition.id)) return;
    void startTour(definition, { force, ctx });
  }, delay);
}
