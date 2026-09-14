/**
 * Splash AeroShards — arranca/para según restauración de sesión.
 */
import { mountAeroShards, DEFAULT_PROPS } from "./st2-aero-shards-core.js?v=20260914a";

const SPLASH_PROPS = {
  ...DEFAULT_PROPS,
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
};

let handle = null;
let opts = { ...SPLASH_PROPS };

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function webGpuAvailable() {
  return typeof navigator !== "undefined" && !!navigator.gpu;
}

export function startSplashAero(options = {}) {
  opts = { ...SPLASH_PROPS, ...options };
  const host = document.getElementById("st2-splash-aero");
  if (!host) return;

  if (prefersReducedMotion() || !webGpuAvailable()) {
    host.classList.add("is-fallback");
    host.classList.add("is-ready");
    return;
  }

  if (handle) {
    handle.update(opts);
    return;
  }

  host.classList.remove("is-fallback");
  handle = mountAeroShards(host, {
    ...opts,
    onError: (err) => {
      console.warn("[st2-aero-shards]", err);
      host.classList.add("is-fallback");
      host.classList.add("is-ready");
      try {
        handle?.destroy();
      } catch {
        /* ignore */
      }
      handle = null;
    },
  });
  host.classList.add("is-ready");
}

export function stopSplashAero() {
  if (handle) {
    try {
      handle.destroy();
    } catch {
      /* ignore */
    }
    handle = null;
  }
}

export function initSplashAero(options = {}) {
  opts = { ...SPLASH_PROPS, ...options };

  const sync = () => {
    if (document.body.classList.contains("st2-access-restoring")) {
      startSplashAero(opts);
    } else {
      stopSplashAero();
    }
  };

  document.addEventListener("st2:access-gate-hidden", sync);
  document.addEventListener("st2:session-changed", () => {
    if (!document.body.classList.contains("st2-access-restoring")) stopSplashAero();
  });
  if (document.body.classList.contains("st2-access-restoring")) {
    startSplashAero(opts);
  }
}
