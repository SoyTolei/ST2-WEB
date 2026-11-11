/** Port ligero de React Bits StarBorder (frost ST²). */

const BLEED = 48;
const TAU = Math.PI * 2;
const WHITE = [255, 255, 255];

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const wrap = (value, total) => ((value % total) + total) % total;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (rgb, alpha) =>
  `rgba(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}, ${clamp(alpha, 0, 1).toFixed(3)})`;

let colorContext = null;
function toRgb(color) {
  colorContext = colorContext ?? document.createElement("canvas").getContext("2d");
  if (!colorContext) return WHITE;
  colorContext.fillStyle = "#000000";
  colorContext.fillStyle = color;
  const value = String(colorContext.fillStyle);
  if (value.startsWith("#")) {
    const hex = parseInt(value.slice(1, 7), 16);
    return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  }
  const parts = value.match(/[\d.]+/g)?.map(Number) ?? WHITE;
  return [parts[0], parts[1], parts[2]];
}

function outline(width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const arc = (Math.PI * r) / 2;
  const across = Math.max(0, width - 2 * r);
  const down = Math.max(0, height - 2 * r);
  const segments = [
    { length: across, x: r, y: 0, dx: 1, dy: 0, angle: null },
    { length: arc, x: width - r, y: r, dx: 0, dy: 0, angle: -Math.PI / 2 },
    { length: down, x: width, y: r, dx: 0, dy: 1, angle: null },
    { length: arc, x: width - r, y: height - r, dx: 0, dy: 0, angle: 0 },
    { length: across, x: width - r, y: height, dx: -1, dy: 0, angle: null },
    { length: arc, x: r, y: height - r, dx: 0, dy: 0, angle: Math.PI / 2 },
    { length: down, x: 0, y: height - r, dx: 0, dy: -1, angle: null },
    { length: arc, x: r, y: r, dx: 0, dy: 0, angle: Math.PI },
  ];
  return {
    r,
    segments,
    total: Math.max(1, segments.reduce((sum, segment) => sum + segment.length, 0)),
  };
}

function pointAt(shape, distance, point) {
  let s = wrap(distance, shape.total);
  for (const segment of shape.segments) {
    if (segment.length > 0 && s <= segment.length) {
      if (segment.angle === null) {
        point.x = segment.x + segment.dx * s;
        point.y = segment.y + segment.dy * s;
        point.nx = segment.dy;
        point.ny = -segment.dx;
      } else {
        const angle = segment.angle + s / shape.r;
        point.nx = Math.cos(angle);
        point.ny = Math.sin(angle);
        point.x = segment.x + point.nx * shape.r;
        point.y = segment.y + point.ny * shape.r;
      }
      return point;
    }
    s -= segment.length;
  }
  return point;
}

const mounted = new WeakSet();

/**
 * Envuelve un elemento con Star Border suave (preset frost ST²).
 * @param {HTMLElement | null} el
 * @param {{
 *   color?: string,
 *   trailColor?: string,
 *   duration?: number,
 *   thickness?: number,
 *   radius?: number,
 *   trailLength?: number,
 *   glow?: number,
 * }=} opts
 */
export function mountStarBorder(el, opts = {}) {
  if (!(el instanceof HTMLElement) || mounted.has(el) || el.closest(".star-border-host")) return el;

  const settings = {
    color: opts.color || "#fdba74",
    trailColor: opts.trailColor || "#fb923c",
    duration: Math.max(0.3, opts.duration ?? 6),
    thickness: Math.max(0.5, opts.thickness ?? 1.5),
    radius: Math.max(0, opts.radius ?? 16),
    trailLength: clamp(opts.trailLength ?? 0.28, 0, 1),
    glow: clamp(opts.glow ?? 0.42, 0, 1),
    direction: 1,
  };

  const host = document.createElement("div");
  host.className = "star-border-host";
  host.style.setProperty("--star-border-radius", `${settings.radius}px`);
  host.style.setProperty("--star-border-thickness", `${settings.thickness}px`);

  const canvas = document.createElement("canvas");
  canvas.className = "star-border-host__canvas";
  canvas.setAttribute("aria-hidden", "true");

  const inner = document.createElement("div");
  inner.className = "star-border-host__inner";

  const parent = el.parentNode;
  if (!parent) return el;
  parent.insertBefore(host, el);
  inner.appendChild(el);
  host.append(canvas, inner);
  mounted.add(el);

  const ctx = canvas.getContext("2d");
  if (!ctx) return el;

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  const point = { x: 0, y: 0, nx: 0, ny: -1 };
  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    phase: 0,
    velocity: 0,
    motion: 0,
    time: 0,
    reveal: 1,
    visible: true,
  };
  const colors = { head: toRgb(settings.color), tail: toRgb(settings.trailColor) };
  let raf = 0;
  let last = performance.now();
  let alive = true;
  let resizePending = true;

  const applyMeasure = () => {
    state.width = host.offsetWidth;
    state.height = host.offsetHeight;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round((state.width + BLEED * 2) * state.dpr));
    canvas.height = Math.max(1, Math.round((state.height + BLEED * 2) * state.dpr));
  };

  const shapeFor = () =>
    outline(
      Math.max(1, state.width - settings.thickness),
      Math.max(1, state.height - settings.thickness),
      settings.radius - settings.thickness / 2
    );

  const stroke = (x1, y1, x2, y2, width, style) => {
    ctx.lineWidth = width;
    ctx.strokeStyle = style;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const drawTrail = (shape, head, length, sign, intensity) => {
    if (length < 0.5 || intensity <= 0) return;
    const steps = clamp(Math.ceil(length / 2), 2, 70);
    pointAt(shape, head, point);
    let px = point.x;
    let py = point.y;
    for (let i = 1; i <= steps; i++) {
      pointAt(shape, head - sign * length * (i / steps), point);
      const u = 1 - (i - 0.5) / steps;
      const fade = u * u * intensity;
      let tone = mix(colors.tail, colors.head, u);
      tone = mix(tone, WHITE, u ** 6 * 0.55);
      ctx.lineCap = i === 1 ? "round" : "butt";
      stroke(px, py, point.x, point.y, 2 + 5 * settings.glow, rgba(tone, fade * 0.16 * settings.glow));
      stroke(px, py, point.x, point.y, settings.thickness, rgba(tone, fade * 0.9));
      px = point.x;
      py = point.y;
    }
  };

  const drawHead = (x, y, intensity, twinkle) => {
    if (intensity <= 0) return;
    const tone = colors.head;
    const reach = (10 + 32 * settings.glow) * intensity;
    const bloom = ctx.createRadialGradient(x, y, 0, x, y, reach);
    const strength = 0.32 * settings.glow * intensity;
    bloom.addColorStop(0, rgba(tone, strength));
    bloom.addColorStop(0.25, rgba(tone, strength * 0.35));
    bloom.addColorStop(1, rgba(tone, 0));
    ctx.fillStyle = bloom;
    ctx.fillRect(x - reach, y - reach, reach * 2, reach * 2);

    const size = 1 + settings.thickness * 0.55;
    const core = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
    core.addColorStop(0, rgba(WHITE, intensity * 0.85 * twinkle));
    core.addColorStop(0.45, rgba(tone, intensity * 0.7));
    core.addColorStop(1, rgba(tone, 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y, size * 2, 0, TAU);
    ctx.fill();
  };

  const draw = (shape) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state.width < 2 || state.height < 2) return;
    const offset = (BLEED + settings.thickness / 2) * state.dpr;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, offset, offset);
    ctx.globalCompositeOperation = "lighter";

    const total = shape.total;
    const speed = Math.abs(state.motion);
    const sign = state.motion >= 0 ? 1 : -1;
    const length = Math.min(speed * settings.trailLength * settings.duration, total * 0.42);
    const intensity = state.reveal;

    drawTrail(shape, state.phase, length, sign, intensity);
    pointAt(shape, state.phase, point);
    const twinkle = 0.85 + 0.15 * Math.sin(state.time * 5.2);
    drawHead(point.x, point.y, intensity, twinkle);
  };

  const frame = (now) => {
    raf = 0;
    if (!alive) return;
    if (resizePending) {
      resizePending = false;
      applyMeasure();
    }
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    state.time += dt;

    const shape = shapeFor();
    const total = shape.total;
    const cruise = reduce ? 0 : (settings.direction * total) / settings.duration;
    state.velocity += (cruise - state.velocity) * (1 - Math.exp(-dt / 0.5));
    state.motion = state.velocity;
    state.phase = wrap(state.phase + state.velocity * dt, total);
    draw(shape);

    if (state.visible && (!reduce || state.reveal > 0)) {
      raf = requestAnimationFrame(frame);
    }
  };

  const wake = () => {
    if (raf || !alive || !state.visible) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const ro = new ResizeObserver(() => {
    resizePending = true;
    wake();
  });
  ro.observe(host);

  const io = new IntersectionObserver((entries) => {
    state.visible = entries.some((e) => e.isIntersecting);
    if (state.visible) wake();
  });
  io.observe(host);

  wake();
  return host;
}
