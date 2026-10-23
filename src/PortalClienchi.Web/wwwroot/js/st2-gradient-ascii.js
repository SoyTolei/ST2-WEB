/**
 * Gradient ASCII — fondo liviano del login, sin React ni dependencias.
 * Dibuja una cuadrícula de caracteres en Canvas 2D para evitar otro contexto WebGL.
 */

const DEFAULTS = {
  colors: ["#3a3391", "#6d63d8", "#f97316", "#d97706"],
  cellSize: 14,
  density: 0.7,
  glyphOpacity: 0.78,
  speed: 0.35,
  flow: 0.25,
  grain: 0.03,
  characters: " .:-=+*#%@",
  maxDpr: 1.25,
};

let host = null;
let canvas = null;
let ctx = null;
let resizeObserver = null;
let raf = 0;
let running = false;
let startTime = 0;
let lastFrame = 0;
let options = { ...DEFAULTS };
let pointer = { x: 0.5, y: 0.5, active: false };
const MIN_FRAME_MS = 1000 / 60;

const prefersReducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hex = (value) => {
  const raw = String(value || "").replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(raw)) return [0.2, 0.2, 0.2];
  return [
    parseInt(raw.slice(0, 2), 16) / 255,
    parseInt(raw.slice(2, 4), 16) / 255,
    parseInt(raw.slice(4, 6), 16) / 255,
  ];
};

const mix = (left, right, amount) =>
  left.map((value, index) => value + (right[index] - value) * amount);

const hash = (x, y) => {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
};

const smoothNoise = (x, y) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return (a + (b - a) * ux) + ((c - a) + (a - b - c + d) * ux) * uy;
};

function sizeCanvas() {
  if (!host || !canvas || !ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, options.maxDpr);
  const width = Math.max(1, host.clientWidth);
  const height = Math.max(1, host.clientHeight);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = `${Math.max(10, options.cellSize * 0.78)}px "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textBaseline = "top";
}

function draw(timestamp) {
  raf = 0;
  if (!running || !ctx || !host || document.hidden) return;
  if (lastFrame && timestamp - lastFrame < MIN_FRAME_MS) {
    raf = requestAnimationFrame(draw);
    return;
  }
  lastFrame = timestamp;

  const width = host.clientWidth;
  const height = host.clientHeight;
  const time = (timestamp - startTime) / 1000 * options.speed;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#110d24";
  ctx.fillRect(0, 0, width, height);

  const colors = options.colors.map(hex);
  const columns = Math.ceil(width / options.cellSize) + 1;
  const rows = Math.ceil(height / options.cellSize) + 1;
  const chars = [...options.characters];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = column * options.cellSize;
      const y = row * options.cellSize;
      const nx = column / Math.max(1, columns - 1);
      const ny = row / Math.max(1, rows - 1);
      const wave = Math.sin(nx * 4.2 + time * 1.7) * 0.08
        + Math.sin(ny * 5.3 - time * 1.1) * 0.05;
      const horizon = 0.48 + 0.12 * Math.sin(nx * 2.5 + time * 0.8) + wave;
      const distance = Math.abs(ny - horizon);
      const glow = clamp(1 - distance * 2.4, 0, 1);
      const noise = smoothNoise(nx * 3.2 + time * options.flow, ny * 3.2 - time * options.flow);
      const mouseDistance = Math.hypot(nx - pointer.x, ny - pointer.y);
      const mouseGlow = pointer.active ? clamp(1 - mouseDistance * 2.6, 0, 1) * 0.2 : 0;
      const intensity = clamp((glow * 0.72 + noise * 0.35 + mouseGlow) * options.density, 0, 1);
      if (intensity < 0.04 || hash(column, row) > options.density) continue;

      const colorPosition = clamp(nx * 1.1 + ny * 0.15 + glow * 0.3, 0, 0.999) * (colors.length - 1);
      const colorIndex = Math.floor(colorPosition);
      const color = mix(colors[colorIndex], colors[Math.min(colorIndex + 1, colors.length - 1)], colorPosition - colorIndex);
      const alpha = options.glyphOpacity * (0.35 + intensity * 0.65);
      const glyphIndex = Math.min(chars.length - 1, Math.floor(intensity * chars.length));
      ctx.fillStyle = `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${alpha})`;
      ctx.fillText(chars[glyphIndex], x, y);
    }
  }

  raf = requestAnimationFrame(draw);
}

function stopLoop() {
  running = false;
  lastFrame = 0;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function startLoop() {
  if (running || prefersReducedMotion() || document.hidden) return;
  running = true;
  startTime = performance.now();
  raf = requestAnimationFrame(draw);
}

function syncVisibility() {
  const gate = document.getElementById("st2-access-gate");
  const visible = gate && !gate.classList.contains("hidden")
    && document.body.classList.contains("st2-access-pending");
  if (visible) startLoop();
  else stopLoop();
}

function destroy() {
  stopLoop();
  resizeObserver?.disconnect();
  resizeObserver = null;
  document.removeEventListener("visibilitychange", syncVisibility);
  document.removeEventListener("st2:access-gate-shown", syncVisibility);
  document.removeEventListener("st2:access-gate-hidden", syncVisibility);
  window.removeEventListener("pointermove", onPointerMove);
  host?.classList.remove("is-ready", "is-fallback");
  canvas?.remove();
  host = null;
  canvas = null;
  ctx = null;
}

function onPointerMove(event) {
  if (!host) return;
  const rect = host.getBoundingClientRect();
  pointer = {
    x: clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
    y: clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1),
    active: true,
  };
}

export function initLoginGradientAscii(partial = {}) {
  destroy();
  options = { ...DEFAULTS, ...partial };
  host = document.getElementById("st2-login-silk");
  if (!host || prefersReducedMotion()) return false;
  canvas = document.createElement("canvas");
  canvas.className = "st2-login-gradient-ascii-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);
  ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    destroy();
    return false;
  }
  host.classList.add("st2-login-gradient-ascii");
  resizeObserver = new ResizeObserver(sizeCanvas);
  resizeObserver.observe(host);
  document.addEventListener("visibilitychange", syncVisibility);
  document.addEventListener("st2:access-gate-shown", syncVisibility);
  document.addEventListener("st2:access-gate-hidden", syncVisibility);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  sizeCanvas();
  requestAnimationFrame(() => host?.classList.add("is-ready"));
  syncVisibility();
  return true;
}

export function startLoginGradientAscii() {
  startLoop();
}

export function stopLoginGradientAscii() {
  stopLoop();
}

export function destroyLoginGradientAscii() {
  destroy();
}
