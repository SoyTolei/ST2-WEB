/**
 * Lightfall — fondo WebGL1 (sin React/ogl) para el splash de carga.
 */

const MAX_COLORS = 8;

const VERT = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform vec3  iResolution;
uniform vec2  iMouse;
uniform float iTime;

uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform vec3  uColor4;
uniform vec3  uColor5;
uniform vec3  uColor6;
uniform vec3  uColor7;
uniform int   uColorCount;

uniform vec3  uBgColor;
uniform vec3  uMouseColor;
uniform float uSpeed;
uniform int   uStreakCount;
uniform float uStreakWidth;
uniform float uStreakLength;
uniform float uGlow;
uniform float uDensity;
uniform float uTwinkle;
uniform float uZoom;
uniform float uBgGlow;
uniform float uOpacity;
uniform float uMouseEnabled;
uniform float uMouseStrength;
uniform float uMouseRadius;
uniform float uLightMode;

varying vec2 vUv;

vec3 palette(float h) {
  int count = uColorCount;
  if (count < 1) count = 1;
  int idx = int(floor(clamp(h, 0.0, 0.999999) * float(count)));
  if (idx <= 0) return uColor0;
  if (idx == 1) return uColor1;
  if (idx == 2) return uColor2;
  if (idx == 3) return uColor3;
  if (idx == 4) return uColor4;
  if (idx == 5) return uColor5;
  if (idx == 6) return uColor6;
  return uColor7;
}

vec3 tanhv(vec3 x) {
  vec3 e = exp(-2.0 * x);
  return (1.0 - e) / (1.0 + e);
}

vec2 sceneC(vec2 frag, vec2 r) {
  vec2 P = (frag + frag - r) / r.x;
  float z = 0.0;
  float d = 1e3;
  vec4 O = vec4(0.0);
  for (int k = 0; k < 39; k++) {
    if (d <= 1e-4) break;
    O = z * normalize(vec4(P, uZoom, 0.0)) - vec4(0.0, 4.0, 1.0, 0.0) / 4.5;
    d = 1.0 - sqrt(length(O * O));
    z += d;
  }
  return vec2(O.x, atan(O.z, O.y));
}

void mainImage(out vec4 o, vec2 C) {
  vec2 r = iResolution.xy;
  vec2 uv0 = (C + C - r) / r.x;
  float T = 0.1 * iTime * uSpeed + 9.0;
  float angRings = max(1.0, floor(6.28318530718 * max(uDensity, 0.05) + 0.5));
  vec2 Y = vec2(5e-3, 6.28318530718 / angRings);

  vec2 c0 = sceneC(C, r);
  vec2 cdx = sceneC(C + vec2(1.0, 0.0), r);
  vec2 cdy = sceneC(C + vec2(0.0, 1.0), r);
  vec2 dCx = cdx - c0;
  vec2 dCy = cdy - c0;
  dCx.y -= 6.28318530718 * floor(dCx.y / 6.28318530718 + 0.5);
  dCy.y -= 6.28318530718 * floor(dCy.y / 6.28318530718 + 0.5);
  vec2 fw = abs(dCx) + abs(dCy);
  C = c0;

  vec2 P = vec2(2.0, 1.0) * uv0 - (r / r.x) * vec2(0.0, 1.0);
  vec4 O = uLightMode > 0.5
    ? vec4(0.0)
    : vec4(uBgColor * 90.0 * uBgGlow / (1e3 * dot(P, P) + 6.0), 0.0);

  float mGlow = 0.0;
  if (uMouseEnabled > 0.5) {
    vec2 mN = (iMouse + iMouse - r) / r.x;
    float md = length(uv0 - mN);
    mGlow = exp(-md * md / max(uMouseRadius * uMouseRadius, 1e-4)) * uMouseStrength;
    O.rgb += uMouseColor * mGlow * 0.25;
  }

  float zr = 5e-4 * uStreakWidth;
  vec2 rr = vec2(max(length(fw), 1e-5));
  float tail = 19.0 / max(uStreakLength, 0.05);

  for (int m = 0; m < 16; m++) {
    if (m >= uStreakCount) break;
    float jf = float(m) + 1.0;
    float ic = fract(sin(dot(vec2(jf, floor(C.x / Y.x + 0.5)), vec2(7.0, 11.0)) * 73.0));
    vec2 Pp = C - (T + T * ic) * vec2(0.0, 1.0);
    Pp -= floor(Pp / Y + 0.5) * Y;
    float h = fract(8663.0 * ic);
    vec3 col = palette(h);
    float weight = mix(1.5, 1.0 + sin(T + 7.0 * h + 4.0), uTwinkle);
    weight *= (1.0 + mGlow * 2.0);
    vec2 inner = vec2(length(max(Pp, vec2(-1.0, 0.0))), length(Pp) - zr) - zr;
    vec2 sm = vec2(1.0) - smoothstep(-rr, rr, inner);
    O.rgb += dot(sm, vec2(exp(tail * Pp.y), 3.0)) * col * weight;
    C.x += Y.x / 8.0;
  }

  vec3 colr = sqrt(tanhv(max(O.rgb * uGlow - vec3(0.04, 0.08, 0.02), 0.0)));
  if (uLightMode > 0.5) {
    float peak = max(colr.r, max(colr.g, colr.b));
    float coverage = smoothstep(0.035, 0.58, peak) * uOpacity;
    vec3 chroma = clamp(colr / max(peak, 1e-4), 0.0, 1.0);
    chroma = pow(chroma, vec3(1.35));
    float chromaPeak = max(chroma.r, max(chroma.g, chroma.b));
    chroma /= max(chromaPeak, 1e-4);
    o = vec4(mix(vec3(1.0), chroma, coverage * 0.94), 1.0);
  } else {
    o = vec4(colr, uOpacity);
  }
}

void main() {
  vec4 color;
  mainImage(color, vUv * iResolution.xy);
  gl_FragColor = color;
}
`;

const DEFAULTS = {
  colors: ["#FF9FFC", "#F97316", "#F97316"],
  backgroundColor: "#ce6319",
  speed: 0.5,
  streakCount: 2,
  streakWidth: 1,
  streakLength: 1,
  glow: 1,
  density: 0.6,
  twinkle: 0.9,
  zoom: 3,
  backgroundGlow: 0.5,
  opacity: 1,
  mouseInteraction: true,
  mouseStrength: 0,
  mouseRadius: 1,
  mouseDampening: 0.15,
  lightMode: false,
};

function hexToRGB(hex) {
  const c = String(hex || "").replace("#", "").padEnd(6, "0");
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ];
}

function prepColors(input) {
  const base = (input && input.length ? input : DEFAULTS.colors).slice(0, MAX_COLORS);
  const count = base.length;
  const arr = [];
  for (let i = 0; i < MAX_COLORS; i += 1) {
    arr.push(hexToRGB(base[Math.min(i, base.length - 1)]));
  }
  const avg = [0, 0, 0];
  for (let i = 0; i < count; i += 1) {
    avg[0] += arr[i][0];
    avg[1] += arr[i][1];
    avg[2] += arr[i][2];
  }
  avg[0] /= count;
  avg[1] /= count;
  avg[2] /= count;
  return { arr, count, avg };
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh) || "shader error";
    gl.deleteShader(sh);
    throw new Error(info);
  }
  return sh;
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

let host = null;
let canvas = null;
let gl = null;
let program = null;
let buffer = null;
let locs = {};
let opts = { ...DEFAULTS };
let rafId = 0;
let running = false;
let resizeObs = null;
let lastTime = 0;
const mouseTarget = [0, 0];
const mouseCur = [0, 0];

function setSize() {
  if (!host || !canvas || !gl) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  const wCss = Math.max(1, host.clientWidth || window.innerWidth);
  const hCss = Math.max(1, host.clientHeight || window.innerHeight);
  const bw = Math.max(1, Math.floor(wCss * dpr));
  const bh = Math.max(1, Math.floor(hCss * dpr));
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  gl.viewport(0, 0, bw, bh);
  gl.uniform3f(locs.iResolution, bw, bh, 1);
}

function syncUniforms() {
  if (!gl || !program) return;
  const { arr, count, avg } = prepColors(opts.colors);
  const colorLocs = [
    locs.uColor0, locs.uColor1, locs.uColor2, locs.uColor3,
    locs.uColor4, locs.uColor5, locs.uColor6, locs.uColor7,
  ];
  for (let i = 0; i < 8; i += 1) gl.uniform3fv(colorLocs[i], arr[i]);
  gl.uniform1i(locs.uColorCount, count);
  gl.uniform3fv(locs.uBgColor, hexToRGB(opts.backgroundColor));
  gl.uniform3fv(locs.uMouseColor, avg);
  gl.uniform1f(locs.uSpeed, opts.speed);
  gl.uniform1i(locs.uStreakCount, Math.max(1, Math.min(16, Math.round(opts.streakCount))));
  gl.uniform1f(locs.uStreakWidth, opts.streakWidth);
  gl.uniform1f(locs.uStreakLength, opts.streakLength);
  gl.uniform1f(locs.uGlow, opts.glow);
  gl.uniform1f(locs.uDensity, opts.density);
  gl.uniform1f(locs.uTwinkle, opts.twinkle);
  gl.uniform1f(locs.uZoom, opts.zoom);
  gl.uniform1f(locs.uBgGlow, opts.backgroundGlow);
  gl.uniform1f(locs.uOpacity, opts.opacity);
  gl.uniform1f(locs.uMouseEnabled, opts.mouseInteraction ? 1 : 0);
  gl.uniform1f(locs.uMouseStrength, opts.mouseStrength);
  gl.uniform1f(locs.uMouseRadius, opts.mouseRadius);
  gl.uniform1f(locs.uLightMode, opts.lightMode ? 1 : 0);
}

function frame(t) {
  if (!running || !gl || !program) return;
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform1f(locs.iTime, t * 0.001);

  if (opts.mouseDampening > 0) {
    if (!lastTime) lastTime = t;
    const dt = (t - lastTime) / 1000;
    lastTime = t;
    const tau = Math.max(1e-4, opts.mouseDampening);
    let factor = 1 - Math.exp(-dt / tau);
    if (factor > 1) factor = 1;
    mouseCur[0] += (mouseTarget[0] - mouseCur[0]) * factor;
    mouseCur[1] += (mouseTarget[1] - mouseCur[1]) * factor;
  } else {
    lastTime = t;
    mouseCur[0] = mouseTarget[0];
    mouseCur[1] = mouseTarget[1];
  }
  gl.uniform2f(locs.iMouse, mouseCur[0], mouseCur[1]);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  rafId = requestAnimationFrame(frame);
}

function stopLoop() {
  running = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

function startLoop() {
  if (running || prefersReducedMotion() || document.hidden) return;
  if (!gl || !program) return;
  running = true;
  lastTime = 0;
  rafId = requestAnimationFrame(frame);
}

function onPointerMove(e) {
  if (!canvas || !gl) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / Math.max(1, rect.width);
  const scaleY = canvas.height / Math.max(1, rect.height);
  mouseTarget[0] = (e.clientX - rect.left) * scaleX;
  mouseTarget[1] = (rect.height - (e.clientY - rect.top)) * scaleY;
}

function onVisibility() {
  if (document.hidden) stopLoop();
  else if (document.body.classList.contains("st2-access-restoring")) startLoop();
}

function destroyGl() {
  stopLoop();
  canvas?.removeEventListener("pointermove", onPointerMove);
  document.removeEventListener("visibilitychange", onVisibility);
  if (resizeObs) {
    resizeObs.disconnect();
    resizeObs = null;
  }
  if (gl && program) {
    try { gl.deleteProgram(program); } catch { /* ignore */ }
  }
  if (gl && buffer) {
    try { gl.deleteBuffer(buffer); } catch { /* ignore */ }
  }
  if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
  try { gl?.getExtension("WEBGL_lose_context")?.loseContext(); } catch { /* ignore */ }
  canvas = null;
  gl = null;
  program = null;
  buffer = null;
  locs = {};
}

function initGl(container) {
  destroyGl();
  host = container;
  canvas = document.createElement("canvas");
  canvas.className = "st2-lightfall-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    powerPreference: "low-power",
  });
  if (!gl) {
    host.classList.add("is-fallback");
    return false;
  }

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "position");
  gl.bindAttribLocation(program, 1, "uv");
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    destroyGl();
    host.classList.add("is-fallback");
    return false;
  }
  gl.useProgram(program);

  const names = [
    "iResolution", "iMouse", "iTime",
    "uColor0", "uColor1", "uColor2", "uColor3", "uColor4", "uColor5", "uColor6", "uColor7",
    "uColorCount", "uBgColor", "uMouseColor", "uSpeed", "uStreakCount", "uStreakWidth",
    "uStreakLength", "uGlow", "uDensity", "uTwinkle", "uZoom", "uBgGlow", "uOpacity",
    "uMouseEnabled", "uMouseStrength", "uMouseRadius", "uLightMode",
  ];
  for (const n of names) locs[n] = gl.getUniformLocation(program, n);

  // Fullscreen triangle with UVs (ogl Triangle layout)
  buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      // x, y, u, v
      -1, -1, 0, 0,
      3, -1, 2, 0,
      -1, 3, 0, 2,
    ]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  syncUniforms();
  setSize();
  mouseTarget[0] = canvas.width * 0.5;
  mouseTarget[1] = canvas.height * 0.5;
  mouseCur[0] = mouseTarget[0];
  mouseCur[1] = mouseTarget[1];

  resizeObs = new ResizeObserver(() => setSize());
  resizeObs.observe(host);
  if (opts.mouseInteraction) canvas.addEventListener("pointermove", onPointerMove);
  document.addEventListener("visibilitychange", onVisibility);
  startLoop();
  requestAnimationFrame(() => host.classList.add("is-ready"));
  return true;
}

export function startSplashLightfall(options = {}) {
  opts = { ...DEFAULTS, ...options };
  if (options.color1 || options.color2 || options.color3) {
    opts.colors = [
      options.color1 || DEFAULTS.colors[0],
      options.color2 || DEFAULTS.colors[1],
      options.color3 || DEFAULTS.colors[2],
    ];
  }
  const el = document.getElementById("st2-splash-lightfall");
  if (!el) return;
  if (prefersReducedMotion()) {
    el.classList.add("is-fallback");
    return;
  }
  if (!gl || host !== el) initGl(el);
  else {
    syncUniforms();
    setSize();
    startLoop();
  }
}

export function stopSplashLightfall() {
  stopLoop();
}

export function destroySplashLightfall() {
  destroyGl();
}

export function initSplashLightfall(options = {}) {
  opts = { ...DEFAULTS, ...options };

  const sync = () => {
    if (document.body.classList.contains("st2-access-restoring")) {
      startSplashLightfall(opts);
    } else {
      stopSplashLightfall();
    }
  };

  document.addEventListener("st2:access-gate-hidden", sync);
  document.addEventListener("st2:session-changed", () => {
    if (!document.body.classList.contains("st2-access-restoring")) stopSplashLightfall();
  });
  // Restauración: splash ya visible al boot.
  if (document.body.classList.contains("st2-access-restoring")) {
    startSplashLightfall(opts);
  }
}
