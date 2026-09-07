/**
 * LightRays — port vanilla WebGL (sin React/ogl) del efecto React Bits.
 * Reemplaza SideRays como wallpaper detrás de pestañas y panel principal.
 */

const VERT = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;

uniform float iTime;
uniform vec2  iResolution;

uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2  mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;
uniform float lightMode;

varying vec2 vUv;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                  float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);

  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;

  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));

  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);

  float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
  float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;

  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0, 1.0
  );

  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);

  vec2 finalRayDir = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  vec4 rays1 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349,
                           1.5 * raysSpeed);
  vec4 rays2 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234,
                           1.1 * raysSpeed);

  fragColor = rays1 * 0.5 + rays2 * 0.4;

  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.01 + iTime * 0.1);
    fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
  }

  float brightness = 1.0 - (coord.y / iResolution.y);
  fragColor.x *= 0.1 + brightness * 0.8;
  fragColor.y *= 0.3 + brightness * 0.6;
  fragColor.z *= 0.5 + brightness * 0.5;

  if (saturation != 1.0) {
    float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
    fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
  }

  fragColor.rgb *= raysColor;

  if (lightMode > 0.5) {
    vec3 mapped = vec3(1.0) - exp(-max(fragColor.rgb, vec3(0.0)) * 1.35);
    float energy = clamp(max(mapped.r, max(mapped.g, mapped.b)), 0.0, 1.0);
    vec3 hue = mapped / max(energy, 0.0001);
    vec3 ink = mix(hue * 0.25, hue * 0.72, energy);
    fragColor = vec4(mix(vec3(1.0), ink, energy), 1.0);
  }
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}`;

const DEFAULTS = {
  raysOrigin: "top-center",
  raysColor: "#cd601c",
  raysSpeed: 0.3,
  lightSpread: 1.7,
  rayLength: 3,
  pulsating: false,
  fadeDistance: 1.7,
  saturation: 1.3,
  followMouse: true,
  mouseInfluence: 0,
  noiseAmount: 0.3,
  distortion: 0,
  lightMode: false,
};

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  return m
    ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
    : [1, 1, 1];
}

function getAnchorAndDir(origin, w, h) {
  const outside = 0.2;
  switch (origin) {
    case "top-left":
      return { anchor: [0, -outside * h], dir: [0, 1] };
    case "top-right":
      return { anchor: [w, -outside * h], dir: [0, 1] };
    case "left":
      return { anchor: [-outside * w, 0.5 * h], dir: [1, 0] };
    case "right":
      return { anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0] };
    case "bottom-left":
      return { anchor: [0, (1 + outside) * h], dir: [0, -1] };
    case "bottom-center":
      return { anchor: [0.5 * w, (1 + outside) * h], dir: [0, -1] };
    case "bottom-right":
      return { anchor: [w, (1 + outside) * h], dir: [0, -1] };
    default:
      return { anchor: [0.5 * w, -outside * h], dir: [0, 1] };
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

const mouse = { x: 0.5, y: 0.5 };
const smoothMouse = { x: 0.5, y: 0.5 };

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function syncStaticUniforms() {
  if (!gl || !program) return;
  gl.uniform3fv(locs.raysColor, hexToRgb(opts.raysColor));
  gl.uniform1f(locs.raysSpeed, opts.raysSpeed);
  gl.uniform1f(locs.lightSpread, opts.lightSpread);
  gl.uniform1f(locs.rayLength, opts.rayLength);
  gl.uniform1f(locs.pulsating, opts.pulsating ? 1 : 0);
  gl.uniform1f(locs.fadeDistance, opts.fadeDistance);
  gl.uniform1f(locs.saturation, opts.saturation);
  gl.uniform1f(locs.mouseInfluence, opts.followMouse ? opts.mouseInfluence : 0);
  gl.uniform1f(locs.noiseAmount, opts.noiseAmount);
  gl.uniform1f(locs.distortion, opts.distortion);
  gl.uniform1f(locs.lightMode, opts.lightMode ? 1 : 0);
}

function updatePlacement() {
  if (!container || !canvas || !gl || !program) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const wCss = Math.max(1, container.clientWidth);
  const hCss = Math.max(1, container.clientHeight);
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

  const { anchor, dir } = getAnchorAndDir(opts.raysOrigin, bw, bh);
  gl.uniform2f(locs.rayPos, anchor[0], anchor[1]);
  gl.uniform2f(locs.rayDir, dir[0], dir[1]);
}

function frame(t) {
  if (!running || !gl || !program) return;

  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform1f(locs.iTime, t * 0.001);

  if (opts.followMouse && opts.mouseInfluence > 0) {
    const smoothing = 0.92;
    smoothMouse.x = smoothMouse.x * smoothing + mouse.x * (1 - smoothing);
    smoothMouse.y = smoothMouse.y * smoothing + mouse.y * (1 - smoothing);
    gl.uniform2f(locs.mousePos, smoothMouse.x, smoothMouse.y);
  }

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

function onMouseMove(e) {
  if (!container) return;
  const rect = container.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  mouse.x = (e.clientX - rect.left) / rect.width;
  mouse.y = (e.clientY - rect.top) / rect.height;
}

function destroyGl() {
  stopLoop();
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("resize", updatePlacement);
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
  canvas.className = "st2-light-rays-canvas";
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
    "rayPos",
    "rayDir",
    "raysColor",
    "raysSpeed",
    "lightSpread",
    "rayLength",
    "pulsating",
    "fadeDistance",
    "saturation",
    "mousePos",
    "mouseInfluence",
    "noiseAmount",
    "distortion",
    "lightMode",
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
  syncStaticUniforms();
  updatePlacement();

  if (typeof ResizeObserver !== "undefined") {
    resizeObs = new ResizeObserver(() => updatePlacement());
    resizeObs.observe(container);
  } else {
    window.addEventListener("resize", updatePlacement);
  }

  if (opts.followMouse) {
    window.addEventListener("mousemove", onMouseMove, { passive: true });
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
export function initLightRays(options = {}) {
  opts = { ...DEFAULTS, ...options };
  container = document.getElementById("st2-light-rays");
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
    console.warn("[st2-light-rays] WebGL no disponible:", err);
    destroyGl();
    container.hidden = true;
    return false;
  }

  document.addEventListener("visibilitychange", onVisibility);
  return true;
}

/** Alias de compatibilidad por si quedó alguna referencia vieja. */
export function initSideRays(options = {}) {
  return initLightRays(options);
}

export function setLightRaysOptions(partial = {}) {
  opts = { ...opts, ...partial };
  if (gl && program) {
    gl.useProgram(program);
    syncStaticUniforms();
    updatePlacement();
  }
  if (opts.followMouse) {
    window.removeEventListener("mousemove", onMouseMove);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
  } else {
    window.removeEventListener("mousemove", onMouseMove);
  }
}

export function destroyLightRays() {
  document.removeEventListener("visibilitychange", onVisibility);
  destroyGl();
  container = null;
}
