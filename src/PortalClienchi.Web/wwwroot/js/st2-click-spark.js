/**
 * ClickSpark (vanilla) — port del efecto React Bits a un canvas global.
 */

const DEFAULTS = {
  sparkColor: "#f97316",
  sparkSize: 10,
  sparkRadius: 15,
  sparkCount: 8,
  duration: 400,
  easing: "ease-out",
  extraScale: 1,
};

const EASINGS = {
  linear: (t) => t,
  "ease-in": (t) => t * t,
  "ease-in-out": (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  "ease-out": (t) => t * (2 - t),
};

let opts = { ...DEFAULTS };
let canvas = null;
let ctx = null;
let sparks = [];
let rafId = 0;
let started = false;

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function stopLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

function draw(timestamp) {
  if (!ctx || !canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

  const ease = EASINGS[opts.easing] || EASINGS["ease-out"];
  sparks = sparks.filter((spark) => {
    const elapsed = timestamp - spark.startTime;
    if (elapsed >= opts.duration) return false;

    const eased = ease(elapsed / opts.duration);
    const distance = eased * opts.sparkRadius * opts.extraScale;
    const lineLength = opts.sparkSize * (1 - eased);
    const cos = Math.cos(spark.angle);
    const sin = Math.sin(spark.angle);

    ctx.strokeStyle = spark.color;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(spark.x + distance * cos, spark.y + distance * sin);
    ctx.lineTo(spark.x + (distance + lineLength) * cos, spark.y + (distance + lineLength) * sin);
    ctx.stroke();
    return true;
  });

  // Sin chispas vivas no seguimos consumiendo frames.
  if (!sparks.length) {
    stopLoop();
    return;
  }
  rafId = requestAnimationFrame(draw);
}

function ensureLoop() {
  if (rafId) return;
  rafId = requestAnimationFrame(draw);
}

/** Color del glow según el tema (naranja ST2 en oscuro, más saturado en claro). */
function themeSparkColor() {
  return document.documentElement.classList.contains("st2-theme-dark") ? "#fb923c" : "#d64000";
}

function spawn(x, y) {
  const now = performance.now();
  const color = opts.sparkColor === "auto" ? themeSparkColor() : opts.sparkColor;
  for (let i = 0; i < opts.sparkCount; i += 1) {
    sparks.push({
      x,
      y,
      angle: (2 * Math.PI * i) / opts.sparkCount,
      startTime: now,
      color,
    });
  }
  ensureLoop();
}

function onPointerDown(e) {
  if (e.button !== undefined && e.button !== 0) return;
  if (!canvas) return;
  if (isTextEntryEvent(e)) return;
  spawn(e.clientX, e.clientY);
}

function isTextEntryEvent(e) {
  const raw = e.target;
  const el = raw instanceof Element ? raw : raw?.parentElement;
  if (!el) return false;
  const hit = el.closest("input, textarea, select, option, [contenteditable]:not([contenteditable='false'])");
  if (!hit) return false;
  if (hit instanceof HTMLInputElement) {
    const type = (hit.type || "text").toLowerCase();
    if (["button", "submit", "reset", "image", "hidden"].includes(type)) return false;
  }
  return true;
}

export function initClickSpark(options = {}) {
  if (started) return;
  if (prefersReducedMotion()) return;
  started = true;
  opts = { ...DEFAULTS, ...options };

  canvas = document.createElement("canvas");
  canvas.className = "st2-click-spark";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    canvas = null;
    started = false;
    return;
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("pointerdown", onPointerDown, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      sparks = [];
      stopLoop();
    }
  });
}

export function setClickSparkOptions(partial = {}) {
  opts = { ...opts, ...partial };
}
