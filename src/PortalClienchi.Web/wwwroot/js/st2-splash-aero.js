/**
 * Splash AeroShards — arranca/para según restauración de sesión.
 * Import dinámico: si WebGPU/vgpu falla, no tumba el boot del login.
 */
const SPLASH_PROPS = {
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
let fallbackTimer = 0;
let starting = false;

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

function hostEl() {
  return document.getElementById("st2-splash-aero");
}

function showFallback(host, reason) {
  if (!host) return;
  if (reason) console.warn("[st2-aero-shards]", reason);
  host.classList.add("is-fallback");
  host.classList.add("is-ready");
}

function clearFallbackTimer() {
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = 0;
  }
}

export async function startSplashAero(options = {}) {
  opts = { ...SPLASH_PROPS, ...options };
  const host = hostEl();
  if (!host || starting) return;
  if (handle) {
    handle.update(opts);
    return;
  }

  if (prefersReducedMotion() || !webGpuAvailable()) {
    showFallback(host, !webGpuAvailable() ? "WebGPU no disponible" : "reduced-motion");
    return;
  }

  starting = true;
  // Mientras carga el GPU, el fallback naranja evita pantalla negra.
  host.classList.add("is-fallback");
  host.classList.add("is-ready");
  clearFallbackTimer();
  fallbackTimer = window.setTimeout(() => {
    if (!handle) showFallback(host, "timeout arranque AeroShards");
  }, 2500);

  try {
    const mod = await import("./st2-aero-shards-core.js?v=20260914b");
    if (!document.body.classList.contains("st2-access-restoring")) {
      clearFallbackTimer();
      starting = false;
      return;
    }
    handle = mod.mountAeroShards(host, {
      ...opts,
      onError: (err) => {
        showFallback(host, err);
        try { handle?.destroy(); } catch { /* ignore */ }
        handle = null;
      },
    });
    // Cuando el canvas pinta, sacamos el fallback sólido.
    const watchReady = () => {
      const root = handle?.root;
      if (!root) return;
      if (root.dataset.ready === "true") {
        clearFallbackTimer();
        host.classList.remove("is-fallback");
        return;
      }
      requestAnimationFrame(watchReady);
    };
    requestAnimationFrame(watchReady);
  } catch (err) {
    showFallback(host, err);
    handle = null;
  } finally {
    starting = false;
  }
}

export function stopSplashAero() {
  clearFallbackTimer();
  starting = false;
  if (handle) {
    try { handle.destroy(); } catch { /* ignore */ }
    handle = null;
  }
  const host = hostEl();
  host?.classList.remove("is-fallback", "is-ready");
}

export function initSplashAero(options = {}) {
  opts = { ...SPLASH_PROPS, ...options };

  const sync = () => {
    if (document.body.classList.contains("st2-access-restoring")) {
      void startSplashAero(opts);
    } else {
      stopSplashAero();
    }
  };

  document.addEventListener("st2:access-gate-hidden", sync);
  document.addEventListener("st2:session-changed", () => {
    if (!document.body.classList.contains("st2-access-restoring")) stopSplashAero();
  });
  if (document.body.classList.contains("st2-access-restoring")) {
    void startSplashAero(opts);
  }
}
