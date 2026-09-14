/**
 * Silk — fondo WebGL del login (shader de React Bits, sin React/Three).
 * Params: speed, scale, color, noiseIntensity, rotation.
 */

const VERT = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform float uTime;
uniform vec3  uColor;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uNoiseIntensity;
uniform float uLightMode;

const float e = 2.71828182845904523536;

float noise(vec2 texCoord) {
  float G = e;
  vec2  r = (G * sin(G * texCoord));
  return fract(r.x * r.y * (1.0 + texCoord.x));
}

vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  mat2  rot = mat2(c, -s, s, c);
  return rot * uv;
}

void main() {
  float rnd        = noise(gl_FragCoord.xy);
  vec2  uv         = rotateUvs(vUv * uScale, uRotation);
  vec2  tex        = uv * uScale;
  float tOffset    = uSpeed * uTime;

  tex.y += 0.03 * sin(8.0 * tex.x - tOffset);

  float pattern = 0.6 +
                  0.4 * sin(5.0 * (tex.x + tex.y +
                                   cos(3.0 * tex.x + 5.0 * tex.y) +
                                   0.02 * tOffset) +
                           sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));

  float grain = rnd / 15.0 * uNoiseIntensity;
  vec3 result = uColor * pattern - vec3(grain);
  if (uLightMode > 0.5) {
    float fold = smoothstep(0.28, 0.9, pattern);
    float specular = smoothstep(0.72, 0.98, pattern);
    vec3 shadowColor = uColor * 0.72;
    vec3 bodyColor = min(uColor * 1.18, vec3(1.0));
    vec3 lightBase = mix(shadowColor, bodyColor, fold);
    lightBase = mix(lightBase, vec3(1.0), specular * 0.92);
    float fineNoise = noise(gl_FragCoord.xy * 0.63 + vec2(17.0, 41.0));
    float grainSignal = (rnd + fineNoise - 1.0);
    float grainStrength = clamp(uNoiseIntensity * 0.038, 0.0, 0.16);
    result = lightBase + grainSignal * grainStrength;
  }
  fragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}
`;

const DEFAULTS = {
  speed: 9.2,
  scale: 1.2,
  color: "#dc6d20",
  noiseIntensity: 1.5,
  rotation: 0.27,
  lightMode: false,
};

let opts = { ...DEFAULTS };
let container = null;
let canvas = null;
let gl = null;
let program = null;
let buffer = null;
let locs = {};
let raf = 0;
let lastTs = 0;
let uTime = 0;
let resizeObs = null;

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "").trim();
  if (h.length !== 6) return [0.863, 0.427, 0.125];
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function compile(glCtx, type, src) {
  const sh = glCtx.createShader(type);
  glCtx.shaderSource(sh, src);
  glCtx.compileShader(sh);
  if (!glCtx.getShaderParameter(sh, glCtx.COMPILE_STATUS)) {
    console.warn("[st2-silk]", glCtx.getShaderInfoLog(sh));
    glCtx.deleteShader(sh);
    return null;
  }
  return sh;
}

function stopLoop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  lastTs = 0;
}

function frame(ts) {
  raf = requestAnimationFrame(frame);
  if (!gl || !program) return;
  const delta = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
  lastTs = ts;
  uTime += 0.1 * delta;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.1, 0.05, 0.02, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.uniform1f(locs.uTime, uTime);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function startLoop() {
  if (raf || !gl) return;
  raf = requestAnimationFrame(frame);
}

function setSize() {
  if (!canvas || !container || !gl) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.floor(container.clientWidth * dpr));
  const h = Math.max(1, Math.floor(container.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function syncUniforms() {
  if (!gl || !program) return;
  gl.useProgram(program);
  const [r, g, b] = hexToRgb(opts.color);
  gl.uniform1f(locs.uSpeed, opts.speed);
  gl.uniform1f(locs.uScale, opts.scale);
  gl.uniform1f(locs.uNoiseIntensity, opts.noiseIntensity);
  gl.uniform3f(locs.uColor, r, g, b);
  gl.uniform1f(locs.uRotation, opts.rotation);
  gl.uniform1f(locs.uLightMode, opts.lightMode ? 1 : 0);
  gl.uniform1f(locs.uTime, uTime);
}

function destroyGl() {
  stopLoop();
  if (resizeObs) {
    try { resizeObs.disconnect(); } catch { /* ignore */ }
    resizeObs = null;
  }
  document.removeEventListener("visibilitychange", onVisibility);
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
  container = null;
}

function onVisibility() {
  if (document.hidden) stopLoop();
  else if (
    container
    && !container.closest(".hidden")
    && !document.getElementById("st2-access-gate")?.classList.contains("hidden")
  ) {
    startLoop();
  }
}

function initGl(host) {
  destroyGl();
  container = host;
  canvas = document.createElement("canvas");
  canvas.className = "st2-login-silk-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    powerPreference: "low-power",
  });
  if (!gl) {
    host.classList.add("is-fallback");
    return false;
  }

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) {
    destroyGl();
    host.classList.add("is-fallback");
    return false;
  }

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

  for (const n of ["uTime", "uColor", "uSpeed", "uScale", "uRotation", "uNoiseIntensity", "uLightMode"]) {
    locs[n] = gl.getUniformLocation(program, n);
  }

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

  syncUniforms();
  setSize();
  resizeObs = new ResizeObserver(() => setSize());
  resizeObs.observe(host);
  document.addEventListener("visibilitychange", onVisibility);
  uTime = 0;
  startLoop();
  requestAnimationFrame(() => host.classList.add("is-ready"));
  return true;
}

export function startLoginSilk(options = {}) {
  opts = { ...DEFAULTS, ...options };
  const host = document.getElementById("st2-login-silk");
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

export function stopLoginSilk() {
  stopLoop();
}

export function destroyLoginSilk() {
  destroyGl();
}

export function initLoginSilk(options = {}) {
  opts = { ...DEFAULTS, ...options };

  const sync = () => {
    const gate = document.getElementById("st2-access-gate");
    const visible = !!gate && !gate.classList.contains("hidden")
      && document.body.classList.contains("st2-access-pending")
      && !document.body.classList.contains("st2-access-restoring");
    if (visible) startLoginSilk(opts);
    else stopLoginSilk();
  };

  document.addEventListener("st2:access-gate-shown", () => startLoginSilk(opts));
  document.addEventListener("st2:access-gate-hidden", () => stopLoginSilk());
  document.addEventListener("st2:session-changed", sync);
  requestAnimationFrame(sync);
}
