/**
 * SideRays — port vanilla WebGL (sin React/ogl) del efecto React Bits.
 * Fondo animado detrás de pestañas y panel principal.
 */

const VERT = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform float iSpeed;
uniform vec3 iRayColor1;
uniform vec3 iRayColor2;
uniform float iIntensity;
uniform float iSpread;
uniform float iFlipX;
uniform float iFlipY;
uniform float iTilt;
uniform float iSaturation;
uniform float iBlend;
uniform float iFalloff;
uniform float iOpacity;

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);
  return clamp(
    (0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-cosAngle * seedB + iTime * speed)),
    0.0, 1.0) *
    clamp((iResolution.x - length(sourceToCoord)) / iResolution.x, 0.5, 1.0);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  if (iFlipX > 0.5) fragCoord.x = iResolution.x - fragCoord.x;
  if (iFlipY > 0.5) fragCoord.y = iResolution.y - fragCoord.y;

  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec2 rayPos = vec2(iResolution.x * 1.1, -0.5 * iResolution.y);

  float tiltRad = iTilt * 3.14159265 / 180.0;
  float cs = cos(tiltRad);
  float sn = sin(tiltRad);
  vec2 rel = coord - rayPos;
  vec2 tiltedCoord = vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs) + rayPos;

  float halfSpread = iSpread * 0.275;
  vec2 rayRefDir1 = normalize(vec2(cos(0.785398 + halfSpread), sin(0.785398 + halfSpread)));
  vec2 rayRefDir2 = normalize(vec2(cos(0.785398 - halfSpread), sin(0.785398 - halfSpread)));

  vec4 rays1 = vec4(iRayColor1, 1.0) * rayStrength(rayPos, rayRefDir1, tiltedCoord, 36.2214, 21.11349, iSpeed);
  vec4 rays2 = vec4(iRayColor2, 1.0) * rayStrength(rayPos, rayRefDir2, tiltedCoord, 22.3991, 18.0234, iSpeed * 0.2);

  vec4 color = rays1 * (1.0 - iBlend) * 0.9 + rays2 * iBlend * 0.9;

  float distanceToLight = length(fragCoord.xy - vec2(rayPos.x, iResolution.y - rayPos.y)) / iResolution.y;
  float brightness = iIntensity * 0.4 / pow(max(distanceToLight, 0.001), iFalloff);
  color.rgb *= brightness;

  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb = mix(vec3(gray), color.rgb, iSaturation);

  color.a = max(color.r, max(color.g, color.b)) * iOpacity;
  gl_FragColor = color;
}`;

const DEFAULTS = {
  speed: 2.5,
  rayColor1: "#F97316",
  rayColor2: "#ab8468",
  intensity: 2,
  spread: 2,
  origin: "top-right",
  tilt: 0,
  saturation: 1.5,
  blend: 0.75,
  falloff: 1.6,
  opacity: 1,
};

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  return m
    ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
    : [1, 1, 1];
}

function originToFlip(origin) {
  switch (origin) {
    case "top-left":
      return [1, 0];
    case "bottom-right":
      return [0, 1];
    case "bottom-left":
      return [1, 1];
    default:
      return [0, 0];
  }
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(info || "Shader compile failed");
  }
  return shader;
}

function createProgram(gl, vertSrc, fragSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(info || "Program link failed");
  }
  return program;
}

let container = null;
let canvas = null;
let gl = null;
let program = null;
let buffer = null;
let rafId = 0;
let running = false;
let resizeObs = null;
let opts = { ...DEFAULTS };
const locs = {};

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function syncUniforms() {
  if (!gl || !program) return;
  const [flipX, flipY] = originToFlip(opts.origin);
  gl.uniform1f(locs.iSpeed, opts.speed);
  gl.uniform3fv(locs.iRayColor1, hexToRgb(opts.rayColor1));
  gl.uniform3fv(locs.iRayColor2, hexToRgb(opts.rayColor2));
  gl.uniform1f(locs.iIntensity, opts.intensity);
  gl.uniform1f(locs.iSpread, opts.spread);
  gl.uniform1f(locs.iFlipX, flipX);
  gl.uniform1f(locs.iFlipY, flipY);
  gl.uniform1f(locs.iTilt, opts.tilt);
  gl.uniform1f(locs.iSaturation, opts.saturation);
  gl.uniform1f(locs.iBlend, opts.blend);
  gl.uniform1f(locs.iFalloff, opts.falloff);
  gl.uniform1f(locs.iOpacity, opts.opacity);
}

function updateSize() {
  if (!container || !canvas || !gl) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, container.clientWidth);
  const h = Math.max(1, container.clientHeight);
  const bw = Math.max(1, Math.floor(w * dpr));
  const bh = Math.max(1, Math.floor(h * dpr));
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  gl.viewport(0, 0, bw, bh);
  gl.uniform2f(locs.iResolution, bw, bh);
}

function frame(t) {
  if (!running || !gl || !program) return;
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform1f(locs.iTime, t * 0.001);
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
  rafId = requestAnimationFrame(frame);
}

function destroyGl() {
  stopLoop();
  if (resizeObs) {
    resizeObs.disconnect();
    resizeObs = null;
  }
  if (gl && program) {
    try {
      gl.deleteProgram(program);
    } catch { /* ignore */ }
  }
  if (gl && buffer) {
    try {
      gl.deleteBuffer(buffer);
    } catch { /* ignore */ }
  }
  if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
  try {
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch { /* ignore */ }
  canvas = null;
  gl = null;
  program = null;
  buffer = null;
}

function initGl() {
  if (!container || prefersReducedMotion()) return false;
  destroyGl();

  canvas = document.createElement("canvas");
  canvas.className = "st2-side-rays-canvas";
  canvas.setAttribute("aria-hidden", "true");
  gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: "low-power",
  });
  if (!gl) {
    canvas = null;
    return false;
  }

  program = createProgram(gl, VERT, FRAG);
  gl.useProgram(program);

  [
    "iTime",
    "iResolution",
    "iSpeed",
    "iRayColor1",
    "iRayColor2",
    "iIntensity",
    "iSpread",
    "iFlipX",
    "iFlipY",
    "iTilt",
    "iSaturation",
    "iBlend",
    "iFalloff",
    "iOpacity",
  ].forEach((name) => {
    locs[name] = gl.getUniformLocation(program, name);
  });

  buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  container.appendChild(canvas);
  syncUniforms();
  updateSize();

  if (typeof ResizeObserver !== "undefined") {
    resizeObs = new ResizeObserver(() => updateSize());
    resizeObs.observe(container);
  } else {
    window.addEventListener("resize", updateSize);
  }

  startLoop();
  return true;
}

function onVisibility() {
  if (document.hidden || prefersReducedMotion()) stopLoop();
  else startLoop();
}

/**
 * @param {Partial<typeof DEFAULTS>} [options]
 */
export function initSideRays(options = {}) {
  opts = { ...DEFAULTS, ...options };
  container = document.getElementById("st2-side-rays");
  if (!container) return false;

  if (prefersReducedMotion()) {
    container.hidden = true;
    return false;
  }

  try {
    if (!initGl()) {
      container.hidden = true;
      return false;
    }
  } catch (err) {
    console.warn("[st2-side-rays] WebGL no disponible:", err);
    destroyGl();
    container.hidden = true;
    return false;
  }

  document.addEventListener("visibilitychange", onVisibility);
  return true;
}

export function setSideRaysOptions(partial = {}) {
  opts = { ...opts, ...partial };
  if (gl && program) {
    gl.useProgram(program);
    syncUniforms();
  }
}

export function destroySideRays() {
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("resize", updateSize);
  destroyGl();
  container = null;
}
