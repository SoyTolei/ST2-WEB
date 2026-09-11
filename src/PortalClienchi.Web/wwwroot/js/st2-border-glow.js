/**
 * BorderGlow (vanilla) — borde luminoso reactivo al cursor + sweep opcional.
 */

function parseHSL(hslStr) {
  const match = String(hslStr || "").match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  if (!match) return { h: 24, s: 95, l: 55 };
  return { h: parseFloat(match[1]), s: parseFloat(match[2]), l: parseFloat(match[3]) };
}

function buildGlowVars(glowColor, intensity) {
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

function buildGradientVars(colors) {
  const list = Array.isArray(colors) && colors.length ? colors : ["#fb923c", "#f97316", "#38bdf8"];
  const vars = {};
  for (let i = 0; i < 7; i += 1) {
    const c = list[Math.min(COLOR_MAP[i], list.length - 1)];
    vars[GRADIENT_KEYS[i]] = `radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${c} 0px, transparent 50%)`;
  }
  vars["--gradient-base"] = `linear-gradient(${list[0]} 0 100%)`;
  return vars;
}

function isLightColor(color) {
  const value = String(color || "").trim().replace("#", "");
  if (!/^[\da-f]{3}([\da-f]{3})?$/i.test(value)) return false;
  const hex = value.length === 3 ? value.split("").map((ch) => ch + ch).join("") : value;
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722 > 180;
}

function easeOutCubic(x) {
  return 1 - (1 - x) ** 3;
}
function easeInCubic(x) {
  return x * x * x;
}

function animateValue({ start = 0, end = 100, duration = 1000, delay = 0, ease = easeOutCubic, onUpdate, onEnd }) {
  const t0 = performance.now() + delay;
  function tick(now) {
    const elapsed = now - t0;
    const t = Math.min(Math.max(elapsed / duration, 0), 1);
    onUpdate(start + (end - start) * ease(t));
    if (t < 1) requestAnimationFrame(tick);
    else if (onEnd) onEnd();
  }
  if (delay > 0) {
    setTimeout(() => requestAnimationFrame(tick), delay);
  } else {
    requestAnimationFrame(tick);
  }
}

function applyStyleVars(el, vars) {
  for (const [k, v] of Object.entries(vars)) {
    el.style.setProperty(k, v);
  }
}

function getCenterOfElement(el) {
  const { width, height } = el.getBoundingClientRect();
  return [width / 2, height / 2];
}

function getEdgeProximity(el, x, y) {
  const [cx, cy] = getCenterOfElement(el);
  const dx = x - cx;
  const dy = y - cy;
  let kx = Infinity;
  let ky = Infinity;
  if (dx !== 0) kx = cx / Math.abs(dx);
  if (dy !== 0) ky = cy / Math.abs(dy);
  return Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
}

function getCursorAngle(el, x, y) {
  const [cx, cy] = getCenterOfElement(el);
  const dx = x - cx;
  const dy = y - cy;
  if (dx === 0 && dy === 0) return 0;
  const radians = Math.atan2(dy, dx);
  let degrees = (radians * 180) / Math.PI + 90;
  if (degrees < 0) degrees += 360;
  return degrees;
}

function playSweep(card) {
  if (!card || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  const angleStart = 110;
  const angleEnd = 465;
  card.classList.add("sweep-active");
  card.style.setProperty("--cursor-angle", `${angleStart}deg`);

  animateValue({
    duration: 500,
    onUpdate: (v) => card.style.setProperty("--edge-proximity", String(v)),
  });
  animateValue({
    ease: easeInCubic,
    duration: 1500,
    end: 50,
    onUpdate: (v) => {
      card.style.setProperty(
        "--cursor-angle",
        `${(angleEnd - angleStart) * (v / 100) + angleStart}deg`,
      );
    },
  });
  animateValue({
    ease: easeOutCubic,
    delay: 1500,
    duration: 2250,
    start: 50,
    end: 100,
    onUpdate: (v) => {
      card.style.setProperty(
        "--cursor-angle",
        `${(angleEnd - angleStart) * (v / 100) + angleStart}deg`,
      );
    },
  });
  animateValue({
    ease: easeInCubic,
    delay: 2500,
    duration: 1500,
    start: 100,
    end: 0,
    onUpdate: (v) => card.style.setProperty("--edge-proximity", String(v)),
    onEnd: () => card.classList.remove("sweep-active"),
  });
}

/**
 * @param {HTMLElement} card
 * @param {{
 *   edgeSensitivity?: number,
 *   glowColor?: string,
 *   backgroundColor?: string,
 *   borderRadius?: number,
 *   glowRadius?: number,
 *   glowIntensity?: number,
 *   coneSpread?: number,
 *   animated?: boolean,
 *   colors?: string[],
 *   fillOpacity?: number,
 * }} [options]
 */
export function enhanceBorderGlow(card, options = {}) {
  if (!card || !(card instanceof HTMLElement)) return null;
  if (card.dataset.borderGlowReady === "1") {
    if (options.animated) playSweep(card);
    return card;
  }

  const opts = {
    edgeSensitivity: 30,
    glowColor: "24 95 58",
    backgroundColor: "#ffffff",
    borderRadius: 22,
    glowRadius: 36,
    glowIntensity: 1,
    coneSpread: 25,
    animated: false,
    colors: ["#fb923c", "#f97316", "#38bdf8"],
    fillOpacity: 0.45,
    ...options,
  };

  card.dataset.borderGlowReady = "1";
  card.classList.add("border-glow-card");
  if (isLightColor(opts.backgroundColor)) {
    card.classList.add("border-glow-card--light");
  }

  // Envolver hijos existentes.
  const inner = document.createElement("div");
  inner.className = "border-glow-inner";
  while (card.firstChild) inner.appendChild(card.firstChild);

  const edge = document.createElement("span");
  edge.className = "edge-light";
  edge.setAttribute("aria-hidden", "true");

  card.appendChild(edge);
  card.appendChild(inner);

  applyStyleVars(card, {
    "--card-bg": opts.backgroundColor,
    "--edge-sensitivity": String(opts.edgeSensitivity),
    "--border-radius": `${opts.borderRadius}px`,
    "--glow-padding": `${opts.glowRadius}px`,
    "--cone-spread": String(opts.coneSpread),
    "--fill-opacity": String(opts.fillOpacity),
    ...buildGlowVars(opts.glowColor, opts.glowIntensity),
    ...buildGradientVars(opts.colors),
  });

  const onMove = (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const edgeProx = getEdgeProximity(card, x, y);
    const angle = getCursorAngle(card, x, y);
    card.style.setProperty("--edge-proximity", (edgeProx * 100).toFixed(3));
    card.style.setProperty("--cursor-angle", `${angle.toFixed(3)}deg`);
  };
  card.addEventListener("pointermove", onMove);

  if (opts.animated) playSweep(card);
  return card;
}

function themeBackground() {
  return document.documentElement.classList.contains("st2-theme-dark") ? "#1a1a1a" : "#ffffff";
}

/** Login. */
export function initBorderGlowCards() {
  enhanceAccessCardGlow({ animated: false });

  document.addEventListener("st2:access-gate-shown", () => {
    enhanceAccessCardGlow({ animated: true });
  });

  // Tema: actualizar fondo de cards glow.
  document.addEventListener("st2:theme-changed", () => {
    document.querySelectorAll(".border-glow-card[data-border-glow-ready='1']").forEach((el) => {
      const bg = themeBackground();
      el.style.setProperty("--card-bg", bg);
      el.classList.toggle("border-glow-card--light", isLightColor(bg));
    });
  });
}

function enhanceAccessCardGlow({ animated = false } = {}) {
  const access = document.querySelector("#st2-access-gate .st2-access-card");
  if (!access) return;
  enhanceBorderGlow(access, {
    backgroundColor: themeBackground(),
    borderRadius: 22,
    glowRadius: 40,
    glowIntensity: 1.15,
    animated,
    colors: ["#fb923c", "#f97316", "#38bdf8"],
  });
  if (animated) playSweep(access);
}

export { playSweep };
