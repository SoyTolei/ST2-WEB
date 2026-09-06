const STORAGE_KEY = "st2-tour-progress-v1";
/** Gate permanente: "on" = puede autoiniciar; "off" = solo manual (usuarios que ya usaban ST2). */
const AUTOS_GATE_KEY = "st2-tour-autos-v1";

let root = null;
let overlay = null;
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
let renderToken = 0;
let glowPointerBound = false;

const GLOW_COLORS = ["#c084fc", "#f472b6", "#38bdf8"];
const GLOW_COLOR_HSL = "40 80 80";
const GLOW_INTENSITY = 1;
const GRADIENT_POSITIONS = ["80% 55%", "69% 34%", "8% 6%", "41% 38%", "86% 85%", "82% 18%", "51% 4%"];
const GRADIENT_KEYS = [
  "--gradient-one",
  "--gradient-two",
  "--gradient-three",
  "--gradient-four",
  "--gradient-five",
  "--gradient-six",
  "--gradient-seven",
];
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];

function parseHSL(hslStr) {
  const match = String(hslStr || "").match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  if (!match) return { h: 40, s: 80, l: 80 };
  return { h: parseFloat(match[1]), s: parseFloat(match[2]), l: parseFloat(match[3]) };
}

function buildGlowColorVars(glowColor, intensity) {
  const { h, s, l } = parseHSL(glowColor);
  const base = `${h}deg ${s}% ${l}%`;
  const opacities = [100, 60, 50, 40, 30, 20, 10];
  const keys = ["", "-60", "-50", "-40", "-30", "-20", "-10"];
  const vars = {};
  for (let i = 0; i < opacities.length; i += 1) {
    vars[`--glow-color${keys[i]}`] = `hsl(${base} / ${Math.min(opacities[i] * intensity, 100)}%)`;
  }
  return vars;
}

function buildGradientVars(colors) {
  const vars = {};
  for (let i = 0; i < 7; i += 1) {
    const c = colors[Math.min(COLOR_MAP[i], colors.length - 1)];
    vars[GRADIENT_KEYS[i]] = `radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${c} 0px, transparent 50%)`;
  }
  vars["--gradient-base"] = `linear-gradient(${colors[0]} 0 100%)`;
  return vars;
}

function applyGlowVars(el) {
  if (!el) return;
  const vars = {
    ...buildGlowColorVars(GLOW_COLOR_HSL, GLOW_INTENSITY),
    ...buildGradientVars(GLOW_COLORS),
  };
  Object.entries(vars).forEach(([key, value]) => el.style.setProperty(key, value));
  el.style.setProperty("--edge-sensitivity", "30");
  el.style.setProperty("--border-radius", "28px");
  el.style.setProperty("--glow-padding", "40px");
  el.style.setProperty("--cone-spread", "25");
  el.style.setProperty("--fill-opacity", "0.5");
  el.style.setProperty("--card-bg", "#120F17");
}

function getCardCenter(el) {
  const { width, height } = el.getBoundingClientRect();
  return [width / 2, height / 2];
}

function getEdgeProximity(el, x, y) {
  const [cx, cy] = getCardCenter(el);
  const dx = x - cx;
  const dy = y - cy;
  let kx = Infinity;
  let ky = Infinity;
  if (dx !== 0) kx = cx / Math.abs(dx);
  if (dy !== 0) ky = cy / Math.abs(dy);
  return Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
}

function getCursorAngle(el, x, y) {
  const [cx, cy] = getCardCenter(el);
  const dx = x - cx;
  const dy = y - cy;
  if (dx === 0 && dy === 0) return 0;
  const radians = Math.atan2(dy, dx);
  let degrees = radians * (180 / Math.PI) + 90;
  if (degrees < 0) degrees += 360;
  return degrees;
}

function onTourCardPointerMove(e) {
  if (!activeTour || !card) return;
  const rect = card.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return;
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
    card.style.setProperty("--edge-proximity", "0");
    return;
  }
  const edge = getEdgeProximity(card, x, y);
  const angle = getCursorAngle(card, x, y);
  card.style.setProperty("--edge-proximity", `${(edge * 100).toFixed(3)}`);
  card.style.setProperty("--cursor-angle", `${angle.toFixed(3)}deg`);
}

function onTourCardPointerLeave() {
  if (!card) return;
  card.style.setProperty("--edge-proximity", "0");
}

function bindGlowPointer() {
  if (glowPointerBound || !card) return;
  card.addEventListener("pointermove", onTourCardPointerMove);
  card.addEventListener("pointerleave", onTourCardPointerLeave);
  glowPointerBound = true;
}

function unbindGlowPointer() {
  if (!glowPointerBound || !card) return;
  card.removeEventListener("pointermove", onTourCardPointerMove);
  card.removeEventListener("pointerleave", onTourCardPointerLeave);
  glowPointerBound = false;
  card.style.setProperty("--edge-proximity", "0");
}

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

/** Autos solo para usuarios realmente nuevos. Quien ya usaba ST2 no recibe popups automáticos. */
export function shouldAutoStartTours() {
  ensureAutosGate();
  try {
    if (localStorage.getItem(AUTOS_GATE_KEY) === "off") return false;
  } catch {
    return false;
  }

  const data = loadProgress();
  return !Object.values(data).some(
    (entry) => entry?.status === "completed" || entry?.status === "skipped",
  );
}

function looksLikeReturningUser() {
  try {
    if (localStorage.getItem("st2_plan_user_hint")) return true;
    if (localStorage.getItem("st2-plan-sistema")) return true;
    if (localStorage.getItem("st2-tools-notice-v3")) return true;
    const progress = loadProgress();
    if (Object.keys(progress).length > 0) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function ensureAutosGate() {
  try {
    const gate = localStorage.getItem(AUTOS_GATE_KEY);
    if (gate === "on" || gate === "off") return;
    // Evaluar UNA vez al primer load: usuarios previos → off; navegador limpio → on.
    const returning = looksLikeReturningUser();
    localStorage.setItem(AUTOS_GATE_KEY, returning ? "off" : "on");
    if (returning) {
      const data = loadProgress();
      if (!Object.keys(data).length) {
        data.__autos_opt_out__ = { status: "skipped", at: new Date().toISOString() };
        saveProgress(data);
      }
    }
  } catch {
    /* ignore */
  }
}

// Al cargar el módulo (antes del login) fijamos el gate con el estado del navegador.
ensureAutosGate();

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

function ensureFocusCorners(host) {
  if (!host) return;
  host.querySelectorAll(":scope > .st2-tour-edge-light").forEach((el) => el.remove());
  const needed = ["top-left", "top-right", "bottom-left", "bottom-right"];
  const existing = new Set(
    [...host.querySelectorAll(":scope > .st2-tour-focus-corner")].map((el) => {
      for (const name of needed) if (el.classList.contains(name)) return name;
      return "";
    }),
  );
  for (const name of needed) {
    if (existing.has(name)) continue;
    const corner = document.createElement("span");
    corner.className = `st2-tour-focus-corner ${name}`;
    corner.setAttribute("aria-hidden", "true");
    host.appendChild(corner);
  }
}

function ensureDom() {
  if (root) {
    if (card && !card.querySelector(":scope > .st2-tour-edge-light")) {
      const edge = document.createElement("span");
      edge.className = "st2-tour-edge-light";
      edge.setAttribute("aria-hidden", "true");
      card.prepend(edge);
    }
    ensureFocusCorners(spotlight);
    applyGlowVars(card);
    return;
  }

  root = document.createElement("div");
  root.id = "st2-tour-root";
  root.className = "st2-tour-root";
  root.hidden = true;
  root.innerHTML = `
    <div class="st2-tour-overlay" aria-hidden="true"></div>
    <div class="st2-tour-spotlight" aria-hidden="true">
      <span class="st2-tour-focus-corner top-left" aria-hidden="true"></span>
      <span class="st2-tour-focus-corner top-right" aria-hidden="true"></span>
      <span class="st2-tour-focus-corner bottom-left" aria-hidden="true"></span>
      <span class="st2-tour-focus-corner bottom-right" aria-hidden="true"></span>
    </div>
    <div class="st2-tour-card" role="dialog" aria-modal="true" aria-labelledby="st2-tour-title">
      <span class="st2-tour-edge-light" aria-hidden="true"></span>
      <div class="st2-tour-card-accent" aria-hidden="true"></div>
      <div class="st2-tour-card-inner">
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

  overlay = root.querySelector(".st2-tour-overlay");
  spotlight = root.querySelector(".st2-tour-spotlight");
  card = root.querySelector(".st2-tour-card");
  applyGlowVars(card);
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
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      if (stepIndex >= activeSteps.length - 1) finishTour("completed");
      else goStep(stepIndex + 1);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      if (stepIndex > 0) goStep(stepIndex - 1);
    }
  });

  window.addEventListener("resize", scheduleReposition);
  window.addEventListener("scroll", scheduleReposition, true);
}

function scheduleReposition() {
  if (!activeTour) return;
  if (repositionTimer) clearTimeout(repositionTimer);
  repositionTimer = setTimeout(() => repositionCurrentStep(), 40);
}

function isVisible(el) {
  if (!el) return false;
  if (el.closest(".hidden,[hidden]")) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** Primer elemento visible del selector (evita remarcar un match oculto). */
function queryVisible(selector) {
  if (!selector) return null;
  const nodes = document.querySelectorAll(selector);
  for (const el of nodes) {
    if (isVisible(el)) return el;
  }
  return null;
}

function queryVisibleAll(selector) {
  if (!selector) return [];
  return [...document.querySelectorAll(selector)].filter(isVisible);
}

function revealTourTargets(selector) {
  const nodes = [...document.querySelectorAll(selector)];
  for (const el of nodes) {
    el.classList.remove("hidden");
    el.removeAttribute("hidden");
    el.closest(".plan-ia-group")?.classList.remove("hidden");
  }
  return nodes.filter((el) => {
    if (el.closest(".hidden,[hidden]") && !el.matches(selector)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function unionRect(els) {
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  return {
    top,
    left,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function rectAsTarget(rect) {
  return {
    getBoundingClientRect: () => ({
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      x: rect.left,
      y: rect.top,
      toJSON() {},
    }),
  };
}

function resolveStepTargets(step) {
  if (!step?.selector) return [];
  let nodes = queryVisibleAll(step.selector);
  if (!nodes.length && step.revealHidden) {
    nodes = revealTourTargets(step.selector);
  }
  return nodes;
}

async function waitForElement(selector, timeout = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = queryVisible(selector);
    if (!selector || el) return el;
    await new Promise((r) => setTimeout(r, 80));
  }
  return queryVisible(selector);
}

function filterSteps(steps, ctx) {
  return (steps || []).filter((step) => {
    if (typeof step.when === "function" && !step.when(ctx)) return false;
    if (!step.selector || step.center) return true;
    if (queryVisible(step.selector)) return true;
    if (step.revealHidden && document.querySelector(step.selector)) return true;
    return false;
  });
}

async function waitFrames(count = 2) {
  for (let i = 0; i < count; i += 1) {
    await new Promise((r) => requestAnimationFrame(r));
  }
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

function positionOverlayHole(target) {
  if (!overlay) return;
  if (!target) {
    overlay.style.clipPath = "none";
    overlay.classList.add("is-full");
    return;
  }
  overlay.classList.remove("is-full");
  const rect = target.getBoundingClientRect();
  const pad = 8;
  const t = Math.max(0, rect.top - pad);
  const l = Math.max(0, rect.left - pad);
  const r = Math.min(window.innerWidth, rect.right + pad);
  const b = Math.min(window.innerHeight, rect.bottom + pad);
  // Hueco nítido: el blur/oscurecido queda solo afuera del target.
  overlay.style.clipPath = `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${l}px ${t}px, ${l}px ${b}px, ${r}px ${b}px, ${r}px ${t}px, ${l}px ${t}px)`;
}

function positionSpotlight(target) {
  if (!spotlight) return;
  positionOverlayHole(target);
  if (!target) {
    spotlight.classList.add("is-center");
    return;
  }
  spotlight.classList.remove("is-center");
  const rect = target.getBoundingClientRect();
  const pad = 8;
  spotlight.style.top = `${Math.max(0, rect.top - pad)}px`;
  spotlight.style.left = `${Math.max(0, rect.left - pad)}px`;
  spotlight.style.width = `${Math.max(24, rect.width + pad * 2)}px`;
  spotlight.style.height = `${Math.max(24, rect.height + pad * 2)}px`;
}

function currentStepTarget() {
  const step = activeSteps[stepIndex];
  if (!step || step.center) return null;
  const nodes = resolveStepTargets(step);
  if (!nodes.length) return null;
  if (nodes.length === 1) return nodes[0];
  return rectAsTarget(unionRect(nodes));
}

/** Solo mueve spotlight/card — sin fade ni re-render de texto (evita titileo). */
function repositionCurrentStep() {
  if (!activeTour) return;
  const step = activeSteps[stepIndex];
  if (!step) return;
  const target = currentStepTarget();
  positionSpotlight(target);
  positionCard(target, step.placement || "bottom");
}

async function softStepTransition() {
  if (!card) return;
  card.classList.add("is-step-changing");
  await new Promise((r) => setTimeout(r, 120));
  if (!activeTour) return;
  card.classList.remove("is-step-changing");
}

async function renderStep() {
  const token = ++renderToken;
  const step = activeSteps[stepIndex];
  if (!step) return;

  await softStepTransition();
  if (token !== renderToken || !activeTour) return;

  if (typeof step.beforeShow === "function") {
    await step.beforeShow(activeTour.ctx);
    if (token !== renderToken || !activeTour) return;
  }

  let nodes = [];
  if (!step.center && step.selector) {
    const start = Date.now();
    while (Date.now() - start < 4000) {
      nodes = resolveStepTargets(step);
      if (nodes.length) break;
      await new Promise((r) => setTimeout(r, 80));
      if (token !== renderToken || !activeTour) return;
    }
  }

  if (token !== renderToken || !activeTour) return;

  if (step.selector && !step.center && !nodes.length) {
    if (stepIndex < activeSteps.length - 1) {
      goStep(stepIndex + 1);
      return;
    }
    finishTour("skipped");
    return;
  }

  const target = nodes.length > 1
    ? rectAsTarget(unionRect(nodes))
    : (nodes[0] || null);

  if (nodes[0]) {
    nodes[0].scrollIntoView({ block: "nearest", behavior: "auto", inline: "nearest" });
    await waitFrames(2);
    if (token !== renderToken || !activeTour) return;
  }

  titleEl.textContent = step.title || "";
  bodyEl.textContent = step.body || "";
  progressEl.textContent = `Paso ${stepIndex + 1} de ${activeSteps.length}`;

  btnPrev.disabled = stepIndex === 0;
  btnNext.textContent = stepIndex >= activeSteps.length - 1 ? "Finalizar" : "Siguiente";

  await waitFrames(1);
  if (token !== renderToken || !activeTour) return;

  positionSpotlight(target);
  positionCard(target, step.placement || "bottom");
  root?.focus?.({ preventScroll: true });

  if (resizeObserver) resizeObserver.disconnect();
  if (nodes.length && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(scheduleReposition);
    nodes.forEach((el) => resizeObserver.observe(el));
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

  renderToken += 1;
  activeTour = null;
  activeSteps = [];
  stepIndex = 0;
  if (repositionTimer) clearTimeout(repositionTimer);
  repositionTimer = null;
  if (resizeObserver) resizeObserver.disconnect();
  resizeObserver = null;
  unbindGlowPointer();
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
  root.tabIndex = -1;
  document.body.classList.add("st2-tour-active");
  bindGlowPointer();
  await renderStep();
  root.focus({ preventScroll: true });
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
