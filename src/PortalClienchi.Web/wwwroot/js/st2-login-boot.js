/**
 * Boot temprano: Gradient ASCII en login y Silk en splash de carga (no espera a app.js).
 */
import { startLoginSilk, stopLoginSilk, startSplashSilk, stopSplashSilk, initLoginSilk } from "./st2-silk.js?v=20260915a";
import { initLoginGradientAscii, startLoginGradientAscii } from "./st2-gradient-ascii.js?v=20261023a";
import { initBorderGlowCards } from "./st2-border-glow.js?v=20260915a";
import { initSuiteGlitchText } from "./st2-glitch-text.js?v=20260907d";
import { initSplashDecryptedText } from "./st2-decrypted-text.js?v=20260915b";
import { initClickSpark } from "./st2-click-spark.js?v=20260910a";

const restoring = document.body.classList.contains("st2-access-restoring");

initBorderGlowCards();
const gradientAsciiEnabled = !restoring && initLoginGradientAscii({
  colors: ["#3a3391", "#6d63d8", "#f97316", "#d97706"],
  cellSize: 14,
  density: 0.7,
  glyphOpacity: 0.78,
  glow: 0.08,
  speed: 0.35,
  flow: 0.25,
  grain: 0.03,
});
if (!gradientAsciiEnabled) {
  initLoginSilk({
    speed: 9.2,
    scale: 1.2,
    color: "#dc6d20",
    noiseIntensity: 1.5,
    rotation: 0.27,
  });
}
initSuiteGlitchText();
initClickSpark({
  sparkColor: "auto",
  sparkSize: 11,
  sparkRadius: 17,
  sparkCount: 8,
  duration: 420,
  easing: "ease-out",
  extraScale: 1,
});

if (!restoring) {
  stopSplashSilk();
  if (gradientAsciiEnabled) startLoginGradientAscii();
  else startLoginSilk();
  document.dispatchEvent(new CustomEvent("st2:access-gate-shown"));
} else {
  stopLoginSilk();
  startSplashSilk();
  initSplashDecryptedText();
}
