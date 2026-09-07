/**
 * Topography — fondo WebGL2 (sin React/ogl) para la pantalla de login.
 * Params alineados al usage de React Bits.
 */

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uMorphAmount;
uniform float uBands;
uniform float uThickness;
uniform float uScale;
uniform float uPixelSize;
uniform float uGlow;
uniform float uColorMode;
uniform float uContrast;
uniform float uBrightness;
uniform float uFillBands;
uniform float uOpacity;
uniform float uLightMode;
uniform vec3 uLow;
uniform vec3 uMid;
uniform vec3 uHigh;
uniform vec2 uMouse;
uniform float uMouseEnabled;
uniform float uMouseRadius;
uniform float uMouseStrength;
uniform float uMouseActive;
uniform float uGrain;
uniform float uGrainIntensity;
uniform vec4 uCtrlA;
uniform vec4 uCtrlB;
uniform vec4 uCtrlC;
uniform vec4 uCtrlD;
out vec4 fragColor;

float bez(float t, vec4 c) {
  float w = 6.2831853 * t;
  return 0.5 * (c.x * sin(w) + c.y * cos(w) + c.z * sin(2.0 * w) + c.w * cos(2.0 * w));
}

float field(vec2 uv) {
  vec2 a = vec2(bez(uv.x, uCtrlA), bez(uv.x, uCtrlB));
  vec2 b = vec2(bez(uv.y, uCtrlC), bez(uv.y, uCtrlD));
  return distance(a, b);
}

vec3 elevationColor(float e) {
  vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.5, e));
  c = mix(c, uHigh, smoothstep(0.5, 1.0, e));
  return c;
}

void main() {
  vec2 res = iResolution.xy;
  vec2 uv = gl_FragCoord.xy / res;
  vec2 suv = (uv - 0.5) / max(uScale, 0.001) + 0.5;
  vec2 sampleUv = suv;
  if (uPixelSize > 1.0) {
    vec2 px = res / uPixelSize;
    sampleUv = (floor(suv * px) + 0.5) / px;
  }

  float fv = field(sampleUv);
  if (uMouseEnabled > 0.5) {
    vec2 d = uv - uMouse;
    d.x *= res.x / max(res.y, 1.0);
    float r = max(uMouseRadius, 0.001);
    float bump = exp(-dot(d, d) / (r * r)) * uMouseStrength * uMouseActive;
    fv += bump;
  }

  float f = fv * uBands;
  float frac = fract(f);
  float lineDist = min(frac, 1.0 - frac);
  float aa = fwidth(f) + 0.0001;
  float mask = 1.0 - smoothstep(uThickness - aa, uThickness + aa, lineDist);
  float glowR = uThickness + uGlow * 0.5 + aa;
  float glow = (1.0 - smoothstep(uThickness, glowR, lineDist)) * step(0.0001, uGlow);
  float elev = clamp(fv / (uMorphAmount * 2.5 + 0.001), 0.0, 1.0);

  vec3 lineCol;
  if (uColorMode < 0.5) {
    lineCol = elevationColor(elev);
  } else if (uColorMode < 1.5) {
    lineCol = uMid;
  } else {
    float parity = mod(floor(f), 2.0);
    lineCol = mix(uMid, uHigh, parity);
  }

  float coverage = clamp(mask + glow * 0.55, 0.0, 1.0);
  coverage = pow(coverage, max(uContrast, 0.001));
  vec3 outColor = lineCol;
  float outAlpha = coverage;

  if (uFillBands > 0.5) {
    vec3 fillCol = elevationColor(elev);
    float fillA = 0.1 * elev;
    outColor = mix(fillCol, lineCol, coverage);
    outAlpha = clamp(coverage + fillA, 0.0, 1.0);
  }

  if (uGrain > 0.5) {
    float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + iTime) * 43758.5453);
    outAlpha += (g - 0.5) * uGrainIntensity;
  }

  outColor *= uBrightness;
  outColor = clamp(outColor, 0.0, 1.0);
  float a = clamp(outAlpha, 0.0, 1.0) * uOpacity;
  if (uLightMode > 0.5) {
    float peak = max(outColor.r, max(outColor.g, outColor.b));
    vec3 chroma = pow(clamp(outColor / max(peak, 0.0001), 0.0, 1.0), vec3(1.18));
    fragColor = vec4(mix(vec3(1.0), chroma, a * 0.94), 1.0);
  } else {
    fragColor = vec4(outColor * a, a);
  }
}
`;

const CTRL_INDICES = [
  [1, -2, 3, -4],
  [9, -8, 7, -6],
  [5, 2, 5, -5],
  [-1, -3, 8, 9],
];

const DEFAULTS = {
  lowColor: "#FF9FFC",
  midColor: "#F97316",
  highColor: "#06B6D4",
  speed: 0.3,
  morphAmount: 2.3,
  morphSpeed: 0.05,
  bands: 3.5,
  thickness: 0.03,
  scale: 1.3,
  pixelSize: 1,
  glow: 0.3,
  colorMode: "elevation",
  contrast: 3,
  brightness: 0.75,
  fillBands: false,
  opacity: 1,
  grain: true,
  grainIntensity: 0.08,
  mouseInteraction: true,
  mouseRadius: 0.32,
  mouseStrength: 0.4,
  lightMode: false,
};

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ""));
  if (!result) return [1, 1, 1];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ];
}

function colorModeToFloat(mode) {
  if (mode === "uniform") return 1;
  if (mode === "alternating") return 2;
  return 0;
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

let container = null;
let canvas = null;
let gl = null;
let program = null;
let buffer = null;
let locs = {};
let opts = { ...DEFAULTS };
let rafId = 0;
let running = false;
let resizeObs = null;
let t0 = 0;
const currentMouse = [0.5, 0.5];
const targetMouse = [0.5, 0.5];
let mouseActive = 0;
let mouseActiveTarget = 0;
const ctrlA = new Float32Array(4);
const ctrlB = new Float32Array(4);
const ctrlC = new Float32Array(4);
const ctrlD = new Float32Array(4);

function setSize() {
  if (!container || !canvas || !gl) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const wCss = Math.max(1, container.clientWidth || window.innerWidth);
  const hCss = Math.max(1, container.clientHeight || window.innerHeight);
  const bw = Math.max(1, Math.floor(wCss * dpr));
  const bh = Math.max(1, Math.floor(hCss * dpr));
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  gl.viewport(0, 0, bw, bh);
  gl.uniform2f(locs.iResolution, bw, bh);
}

function syncUniforms() {
  if (!gl || !program) return;
  gl.uniform1f(locs.uMorphAmount, opts.morphAmount);
  gl.uniform1f(locs.uBands, opts.bands);
  gl.uniform1f(locs.uThickness, opts.thickness);
  gl.uniform1f(locs.uScale, opts.scale);
  gl.uniform1f(locs.uPixelSize, opts.pixelSize);
  gl.uniform1f(locs.uGlow, opts.glow);
  gl.uniform1f(locs.uColorMode, colorModeToFloat(opts.colorMode));
  gl.uniform1f(locs.uContrast, opts.contrast);
  gl.uniform1f(locs.uBrightness, opts.brightness);
  gl.uniform1f(locs.uFillBands, opts.fillBands ? 1 : 0);
  gl.uniform1f(locs.uOpacity, opts.opacity);
  gl.uniform1f(locs.uLightMode, opts.lightMode ? 1 : 0);
  gl.uniform1f(locs.uGrain, opts.grain ? 1 : 0);
  gl.uniform1f(locs.uGrainIntensity, opts.grainIntensity);
  gl.uniform3fv(locs.uLow, hexToRgb(opts.lowColor));
  gl.uniform3fv(locs.uMid, hexToRgb(opts.midColor));
  gl.uniform3fv(locs.uHigh, hexToRgb(opts.highColor));
  gl.uniform1f(locs.uMouseEnabled, opts.mouseInteraction ? 1 : 0);
  gl.uniform1f(locs.uMouseRadius, opts.mouseRadius);
  gl.uniform1f(locs.uMouseStrength, opts.mouseStrength);
}

function updateCtrls(time) {
  const ma = opts.morphAmount;
  const sp = opts.speed;
  const msp = opts.morphSpeed;
  const arrays = [ctrlA, ctrlB, ctrlC, ctrlD];
  for (let g = 0; g < 4; g += 1) {
    const arr = arrays[g];
    const idx = CTRL_INDICES[g];
    for (let j = 0; j < 4; j += 1) {
      const i = idx[j];
      arr[j] = ma * Math.sin(time * sp * Math.sin(i * msp) + i);
    }
  }
  gl.uniform4fv(locs.uCtrlA, ctrlA);
  gl.uniform4fv(locs.uCtrlB, ctrlB);
  gl.uniform4fv(locs.uCtrlC, ctrlC);
  gl.uniform4fv(locs.uCtrlD, ctrlD);
}

function frame(t) {
  if (!running || !gl || !program) return;
  const time = (t - t0) * 0.001;
  gl.clearColor(0.04, 0.04, 0.06, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform1f(locs.iTime, time);
  updateCtrls(time);

  currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0]);
  currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1]);
  gl.uniform2f(locs.uMouse, currentMouse[0], currentMouse[1]);
  mouseActive += 0.05 * (mouseActiveTarget - mouseActive);
  gl.uniform1f(locs.uMouseActive, mouseActive);

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
  if (!t0) t0 = performance.now();
  running = true;
  rafId = requestAnimationFrame(frame);
}

function onMouseMove(e) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  targetMouse[0] = (e.clientX - rect.left) / rect.width;
  targetMouse[1] = 1 - (e.clientY - rect.top) / rect.height;
  mouseActiveTarget = 1;
}

function onMouseLeave() {
  mouseActiveTarget = 0;
}

function destroyGl() {
  stopLoop();
  canvas?.removeEventListener("mousemove", onMouseMove);
  canvas?.removeEventListener("mouseleave", onMouseLeave);
  document.removeEventListener("visibilitychange", onVisibility);
  if (resizeObs) {
    resizeObs.disconnect();
    resizeObs = null;
  }
  if (gl && program) {
    try {
      gl.deleteProgram(program);
    } catch {
      /* ignore */
    }
  }
  if (gl && buffer) {
    try {
      gl.deleteBuffer(buffer);
    } catch {
      /* ignore */
    }
  }
  if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
  try {
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    /* ignore */
  }
  canvas = null;
  gl = null;
  program = null;
  buffer = null;
  locs = {};
}

function onVisibility() {
  if (document.hidden) stopLoop();
  else if (container && !container.closest(".hidden") && !document.getElementById("st2-access-gate")?.classList.contains("hidden")) {
    startLoop();
  }
}

function initGl(host) {
  destroyGl();
  container = host;
  canvas = document.createElement("canvas");
  canvas.className = "st2-login-topo-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
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
    "iResolution", "iTime", "uMorphAmount", "uBands", "uThickness", "uScale", "uPixelSize",
    "uGlow", "uColorMode", "uContrast", "uBrightness", "uFillBands", "uOpacity", "uLightMode",
    "uLow", "uMid", "uHigh", "uMouse", "uMouseEnabled", "uMouseRadius", "uMouseStrength",
    "uMouseActive", "uGrain", "uGrainIntensity", "uCtrlA", "uCtrlB", "uCtrlC", "uCtrlD",
  ];
  for (const n of names) locs[n] = gl.getUniformLocation(program, n);

  buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
      3, -1,
      -1, 3,
    ]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  syncUniforms();
  setSize();
  resizeObs = new ResizeObserver(() => setSize());
  resizeObs.observe(host);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mouseleave", onMouseLeave);
  document.addEventListener("visibilitychange", onVisibility);
  t0 = performance.now();
  startLoop();
  return true;
}

export function startLoginTopography(options = {}) {
  opts = { ...DEFAULTS, ...options };
  const host = document.getElementById("st2-login-topo");
  if (!host) return;
  if (prefersReducedMotion()) {
    host.classList.add("is-fallback");
    return;
  }
  if (!gl || container !== host) initGl(host);
  else {
    syncUniforms();
    setSize();
    startLoop();
  }
}

export function stopLoginTopography() {
  stopLoop();
}

export function destroyLoginTopography() {
  destroyGl();
}

/** Arranca/para según gate de acceso. */
export function initLoginTopography(options = {}) {
  opts = { ...DEFAULTS, ...options };

  const sync = () => {
    const gate = document.getElementById("st2-access-gate");
    const visible = !!gate && !gate.classList.contains("hidden")
      && document.body.classList.contains("st2-access-pending")
      && !document.body.classList.contains("st2-access-restoring");
    if (visible) startLoginTopography(opts);
    else stopLoginTopography();
  };

  document.addEventListener("st2:access-gate-shown", () => startLoginTopography(opts));
  document.addEventListener("st2:access-gate-hidden", () => stopLoginTopography());
  document.addEventListener("st2:session-changed", sync);
  // Si el gate ya está visible al boot.
  requestAnimationFrame(sync);
}
