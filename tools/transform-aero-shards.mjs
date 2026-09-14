/**
 * Transform AeroShards.jsx (React) → st2-aero-shards.js (vanilla mount API).
 */
import fs from "node:fs";

const srcPath = process.argv[2];
const outPath = process.argv[3];
const vgpuImport = process.argv[4] || "./vendor/vgpu.js";

let src = fs.readFileSync(srcPath, "utf8");

// Drop React + CSS imports
src = src.replace(/^import \{ useEffect, useRef, useState \} from 'react';\r?\n/, "");
src = src.replace(/^import \{ draw, effect, frame, init, sampler, surface, target, uniforms \} from 'vgpu';\r?\n/, "");
src = src.replace(/^import ['\"]\.\/AeroShards\.css['\"];\r?\n+/m, "");
src = src.replace(/^import ['\"]\.\/AeroShards\.css['\"];\r?\n+/gm, "");

const header = `/**
 * AeroShards (vanilla) — fondo WebGPU del splash ST2.
 * Port de React Bits / AeroShards, sin React.
 */
import { draw, effect, frame, init, sampler, surface, target, uniforms } from "${vgpuImport}";

`;

// Replace the React component with a mount factory
const componentStart = src.indexOf("export default function AeroShards({");
if (componentStart < 0) throw new Error("AeroShards export not found");

const helpers = src.slice(0, componentStart);

const mountFn = `
const DEFAULT_PROPS = {
  backgroundColor: "#000000",
  shardColor: "#F97316",
  accentColor: "#EF4444",
  placement: "center",
  flow: "stream",
  material: "pearl",
  detail: "balanced",
  effect: "none",
  scale: 0.8,
  spread: 1,
  depth: 1,
  speed: 1.05,
  spin: 1,
  interaction: "repel",
  density: 1.5,
  shardSize: 1.15,
  stretch: 0.8,
  turbulence: 1,
  glow: 1,
  edgeSoftness: 2,
  bloom: 0.5,
  grain: 0.05,
  chromaticAberration: 0.007,
  transitionDuration: 1,
  interactionRadius: 1.5,
  interactionStrength: 0.7,
  rippleIntensity: 1,
  holdToGather: true,
  paused: false,
  className: "",
};

function applySettings(settingsRef, onErrorRef, props) {
  const {
    backgroundColor = DEFAULT_PROPS.backgroundColor,
    shardColor = DEFAULT_PROPS.shardColor,
    accentColor = DEFAULT_PROPS.accentColor,
    placement = DEFAULT_PROPS.placement,
    flow = DEFAULT_PROPS.flow,
    material = DEFAULT_PROPS.material,
    detail = DEFAULT_PROPS.detail,
    effect = DEFAULT_PROPS.effect,
    scale = DEFAULT_PROPS.scale,
    spread = DEFAULT_PROPS.spread,
    depth = DEFAULT_PROPS.depth,
    speed = DEFAULT_PROPS.speed,
    spin = DEFAULT_PROPS.spin,
    interaction = DEFAULT_PROPS.interaction,
    density = DEFAULT_PROPS.density,
    shardSize = DEFAULT_PROPS.shardSize,
    stretch = DEFAULT_PROPS.stretch,
    turbulence = DEFAULT_PROPS.turbulence,
    glow = DEFAULT_PROPS.glow,
    edgeSoftness = DEFAULT_PROPS.edgeSoftness,
    bloom = DEFAULT_PROPS.bloom,
    grain = DEFAULT_PROPS.grain,
    chromaticAberration = DEFAULT_PROPS.chromaticAberration,
    transitionDuration = DEFAULT_PROPS.transitionDuration,
    interactionRadius = DEFAULT_PROPS.interactionRadius,
    interactionStrength = DEFAULT_PROPS.interactionStrength,
    rippleIntensity = DEFAULT_PROPS.rippleIntensity,
    holdToGather = DEFAULT_PROPS.holdToGather,
    paused = DEFAULT_PROPS.paused,
    onError,
  } = props;

  const resolvedMaterial = MATERIAL_PRESETS[material] || MATERIAL_PRESETS.pearl;
  const resolvedDetail = DETAIL_PRESETS[detail] || DETAIL_PRESETS.balanced;
  const resolvedEffect = EFFECTS[effect] ?? EFFECTS.none;
  const effectDetail = resolvedEffect === EFFECTS.none ? 1 : 0.4;
  const effectSize = resolvedEffect === EFFECTS.none ? 1 : 1.75;
  const resolvedScale = clamp(scale, 0.5, 2.5);
  const resolvedBackground = parseColor(backgroundColor, "#000000");
  const resolvedShardColor = parseColor(shardColor, "#F97316");
  const resolvedAccentColor = parseColor(accentColor, "#EF4444");
  const resolvedSpread = clamp(spread, 0.15, 1.1);
  const resolvedDepth = clamp(depth, 0, 1.25);
  const resolvedSpeed = clamp(speed, 0, 2);
  const resolvedSpin = clamp(spin, 0, 2);
  const resolvedInteraction = INTERACTIONS[interaction] ?? INTERACTIONS.repel;
  const resolvedDensity = clamp(density, 0.5, 1.5);
  const resolvedShardSize = clamp(shardSize, 0.5, 1.5);
  const resolvedStretch = clamp(stretch, 0.6, 1.8);
  const resolvedTurbulence = clamp(turbulence, 0, 2);
  const resolvedGlow = clamp(glow, 0, 2);
  const resolvedEdgeSoftness = clamp(edgeSoftness, 0, 2);
  const resolvedBloom = clamp(bloom, 0, 3);
  const resolvedGrain = clamp(grain, 0, 0.12);
  const resolvedChromaticAberration = clamp(chromaticAberration, 0, 0.01);
  const resolvedTransitionDuration = clamp(transitionDuration, 0.2, 2);
  const resolvedInteractionRadius = clamp(interactionRadius, 0.5, 2);
  const resolvedInteractionStrength = clamp(interactionStrength, 0, 2);
  const backgroundLuma =
    resolvedBackground[0] * 0.2126 + resolvedBackground[1] * 0.7152 + resolvedBackground[2] * 0.0722;
  const lightBackground = clamp((backgroundLuma - 0.58) / 0.24, 0, 1);
  const lightSurface = lightBackground * lightBackground * (3 - 2 * lightBackground);

  onErrorRef.current = onError;
  settingsRef.current = {
    background: resolvedBackground,
    shard: resolvedShardColor,
    highlight: mixColor(resolvedAccentColor, [1, 1, 1, 1], resolvedMaterial.highlightMix),
    accent: resolvedAccentColor,
    composition: PLACEMENTS[placement] ?? PLACEMENTS.full,
    flow: FLOWS[flow] ?? FLOWS.stream,
    material: MATERIALS[material] ?? MATERIALS.pearl,
    effect: resolvedEffect,
    detailCount: resolvedDetail.count * resolvedDensity * effectDetail,
    shardSize: resolvedDetail.size * resolvedShardSize * effectSize,
    scale: resolvedScale,
    stretch: resolvedStretch * (1 + Math.min(resolvedSpeed * 0.34, 1.2) * 0.1),
    speed: resolvedSpeed,
    spin: resolvedSpin,
    turbulence: 0.36 * resolvedTurbulence,
    spread: resolvedSpread,
    depth: resolvedDepth,
    roughness: resolvedMaterial.roughness,
    brightness: resolvedMaterial.brightness,
    glow: resolvedMaterial.glow * resolvedGlow,
    edgeSoftness: resolvedEdgeSoftness,
    bloom: resolvedBloom,
    grain: resolvedGrain,
    chromaticAberration: resolvedChromaticAberration * (resolvedEffect === EFFECTS.none ? 1 : 0.2),
    exposure: 1.12 + (0.96 - 1.12) * lightSurface,
    lightSurface,
    transitionDuration: resolvedTransitionDuration,
    interaction: resolvedInteraction,
    interactionRadius: (interaction === "attract" ? 0.27 : 0.18) * resolvedInteractionRadius,
    interactionStrength: resolvedInteractionStrength,
    rippleIntensity: clamp(rippleIntensity, 0, 2),
    holdToGather,
    paused,
    signature: [
      backgroundColor, shardColor, accentColor, placement, flow, material, detail, effect,
      resolvedScale, resolvedSpread, resolvedDepth, resolvedSpeed, resolvedSpin, interaction,
      resolvedDensity, resolvedShardSize, resolvedStretch, resolvedTurbulence, resolvedGlow,
      resolvedEdgeSoftness, resolvedBloom, resolvedGrain, resolvedChromaticAberration,
      resolvedTransitionDuration, resolvedInteractionRadius, resolvedInteractionStrength,
      rippleIntensity, holdToGather, paused,
    ].join("|"),
  };
}

/**
 * Monta AeroShards en un host. Devuelve { destroy, update, setPaused }.
 */
export function mountAeroShards(host, props = {}) {
  if (!host) return { destroy() {}, update() {}, setPaused() {} };

  const options = { ...DEFAULT_PROPS, ...props };
  const root = document.createElement("div");
  root.className = \`aero-shards \${options.className || ""}\`.trim();
  root.style.backgroundColor = options.backgroundColor;
  root.setAttribute("aria-hidden", "true");
  root.dataset.ready = "false";

  const canvas = document.createElement("canvas");
  canvas.className = "aero-shards__canvas";
  root.appendChild(canvas);
  host.appendChild(root);

  const onErrorRef = { current: options.onError };
  const settingsRef = { current: null };
  const wakeRef = { current: () => {} };
  const pointerRef = {
    current: {
      raw: [0.5, 0.5],
      position: [0.5, 0.5],
      velocity: [0, 0],
      active: 0,
      presence: 0,
      presenceVelocity: 0,
      initialized: false,
    },
  };
  const ripplesRef = { current: createRipples() };
  const holdRef = { current: createHold() };

  applySettings(settingsRef, onErrorRef, options);

  let disposed = false;
  let runtimeFailed = false;
  let gpu;
  let animationFrameId = 0;
  let timeoutId = 0;
  let unsubscribeResize;
  let unsubscribeGpuError;
  let visibilityObserver;
  let resizeObserver;
  let visible = true;
  let visibilityRatio = 1;
  let needsRender = true;
  let interactionDeadline = 0;
  let settlingDeadline = 0;
  let bounds = root.getBoundingClientRect();
  let boundsDirty = false;
  let resumePending = true;
  let wakeRenderer = () => {
    needsRender = true;
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const reportFailure = (error) => {
    if (disposed || runtimeFailed) return;
    runtimeFailed = true;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (timeoutId) window.clearTimeout(timeoutId);
    resizeObserver?.disconnect();
    visibilityObserver?.disconnect();
    unsubscribeResize?.();
    unsubscribeGpuError?.();
    const failedGpu = gpu;
    gpu = undefined;
    failedGpu?.dispose();
    root.classList.add("is-fallback");
    const resolved = error instanceof Error ? error : new Error(String(error));
    onErrorRef.current?.(resolved);
  };

  const updateBounds = () => {
    bounds = root.getBoundingClientRect();
    boundsDirty = false;
  };

  const pointFromClient = (clientX, clientY) => {
    if (boundsDirty) updateBounds();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const x = (clientX - bounds.left) / bounds.width;
    const y = (clientY - bounds.top) / bounds.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return [x, y];
  };

  const updatePointerTarget = (next) => {
    const pointer = pointerRef.current;
    if (!pointer.initialized || (!pointer.active && pointer.presence === 0)) {
      pointer.raw = [...next];
      pointer.position = [...next];
      pointer.presence = 0;
      resetPointerMotion(pointer);
      pointer.initialized = true;
    } else {
      pointer.raw[0] = next[0];
      pointer.raw[1] = next[1];
    }
    pointer.active = 1;
  };

  const deactivatePointer = () => {
    pointerRef.current.active = 0;
    holdRef.current.pointerId = null;
    const now = performance.now();
    interactionDeadline = now + 140;
    settlingDeadline = now + 680;
    wakeRenderer();
  };

  const handlePointerMove = (event) => {
    const settings = settingsRef.current;
    if (!event.isPrimary || !visible || settings.interaction === INTERACTIONS.none) return;
    const next = pointFromClient(event.clientX, event.clientY);
    if (!next) {
      const pointer = pointerRef.current;
      if (pointer.active || pointer.presence > 0) deactivatePointer();
      return;
    }
    updatePointerTarget(next);
    const now = performance.now();
    interactionDeadline = now + 140;
    settlingDeadline = now + 680;
    wakeRenderer();
  };

  const handlePointerDown = (event) => {
    const settings = settingsRef.current;
    if (!event.isPrimary || event.button !== 0 || !visible || settings.interaction === INTERACTIONS.none) return;
    if (
      event.target instanceof Element &&
      event.target.closest('a, button, input, textarea, select, [role="button"], [contenteditable="true"]')
    )
      return;
    const next = pointFromClient(event.clientX, event.clientY);
    if (!next) return;
    if (!settings.paused && !reduceMotion.matches && settings.speed > 0.0001) {
      startRipple(ripplesRef.current, next, bounds.width / Math.max(bounds.height, 1));
      if (settings.holdToGather) {
        holdRef.current.pointerId = event.pointerId;
        holdRef.current.elapsed = 0;
      }
    }
    updatePointerTarget(next);
    const now = performance.now();
    interactionDeadline = now + 220;
    settlingDeadline = now + 800;
    wakeRenderer();
  };

  const handlePointerEnd = (event) => {
    const hold = holdRef.current;
    if (hold.pointerId === event.pointerId) {
      hold.pointerId = null;
      const settings = settingsRef.current;
      if (
        hold.amount > 0.1 &&
        !settings.paused &&
        !reduceMotion.matches &&
        settings.interaction !== INTERACTIONS.none
      ) {
        startRipple(
          ripplesRef.current,
          pointerRef.current.raw,
          bounds.width / Math.max(bounds.height, 1),
          1 + hold.amount * 0.8,
        );
      }
      wakeRenderer();
    }
    if (event.pointerType !== "mouse") deactivatePointer();
  };

  const markBoundsDirty = () => {
    boundsDirty = true;
  };

  const handleVisibilityChange = () => {
    resumePending = true;
    holdRef.current.pointerId = null;
    resetPointerMotion(pointerRef.current);
    wakeRenderer();
  };

  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerdown", handlePointerDown, { passive: true });
  window.addEventListener("pointerup", handlePointerEnd, { passive: true });
  window.addEventListener("pointercancel", deactivatePointer, { passive: true });
  window.addEventListener("blur", deactivatePointer);
  window.addEventListener("scroll", markBoundsDirty, { passive: true, capture: true });
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleVisibilityChange);
  reduceMotion.addEventListener("change", handleVisibilityChange);

  visibilityObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      visibilityRatio = entry?.intersectionRatio ?? 1;
      visible = entry ? entry.isIntersecting && visibilityRatio >= 0.02 : true;
      if (visible) {
        resumePending = true;
      } else {
        interactionDeadline = 0;
        settlingDeadline = 0;
        const pointer = pointerRef.current;
        pointer.active = 0;
        pointer.presence = 0;
        holdRef.current.pointerId = null;
        resetPointerMotion(pointer);
      }
      wakeRenderer();
    },
    { threshold: [0, 0.02, 0.25] },
  );
  visibilityObserver.observe(root);

  // The rest of the GPU boot + render loop is injected below from the React source.
  /* __GPU_BOOT__ */

  const destroy = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerdown", handlePointerDown);
    window.removeEventListener("pointerup", handlePointerEnd);
    window.removeEventListener("pointercancel", deactivatePointer);
    window.removeEventListener("blur", deactivatePointer);
    window.removeEventListener("scroll", markBoundsDirty, true);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("focus", handleVisibilityChange);
    reduceMotion.removeEventListener("change", handleVisibilityChange);
    visibilityObserver?.disconnect();
    resizeObserver?.disconnect();
    unsubscribeResize?.();
    unsubscribeGpuError?.();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (timeoutId) window.clearTimeout(timeoutId);
    wakeRef.current = () => {};
    gpu?.dispose();
    if (root.parentNode) root.parentNode.removeChild(root);
  };

  return {
    destroy,
    root,
    update(nextProps = {}) {
      const merged = { ...DEFAULT_PROPS, ...options, ...nextProps };
      Object.assign(options, merged);
      root.style.backgroundColor = merged.backgroundColor;
      applySettings(settingsRef, onErrorRef, merged);
      wakeRef.current();
    },
    setPaused(value) {
      options.paused = !!value;
      applySettings(settingsRef, onErrorRef, options);
      wakeRef.current();
    },
  };
}

export { DEFAULT_PROPS };
`;

// Extract the async IIFE body from the React useEffect (from `void (async () => {` to before `return () => {`)
const reactBody = src.slice(componentStart);
const asyncStart = reactBody.indexOf("void (async () => {");
const cleanupStart = reactBody.indexOf("\n    return () => {");
if (asyncStart < 0 || cleanupStart < 0) throw new Error("Could not find GPU boot block");

let gpuBoot = reactBody.slice(asyncStart, cleanupStart);
// Adapt refs / setReady for vanilla
gpuBoot = gpuBoot
  .replace(/void \(async \(\) => \{/, "void (async () => {")
  .replace(/setReady\(false\);/g, 'root.dataset.ready = "false";')
  .replace(/setReady\(true\)/g, 'root.dataset.ready = "true"')
  .replace(/canvasRef\.current/g, "canvas")
  .replace(/rootRef\.current/g, "root");

const out = header + helpers + mountFn.replace("/* __GPU_BOOT__ */", gpuBoot);
fs.writeFileSync(outPath, out, "utf8");
console.log("Wrote", outPath, "bytes", out.length);
