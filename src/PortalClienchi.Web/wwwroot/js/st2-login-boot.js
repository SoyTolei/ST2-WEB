/**
 * Boot temprano: Silk naranja en login y en splash de carga (no espera a app.js).
 */
import { startLoginSilk, stopLoginSilk, startSplashSilk, stopSplashSilk, initLoginSilk } from "./st2-silk.js?v=20260915a";
import { initBorderGlowCards } from "./st2-border-glow.js?v=20260907c";
import { initSuiteGlitchText } from "./st2-glitch-text.js?v=20260907d";
import { initSplashDecryptedText } from "./st2-decrypted-text.js?v=20260915b";
import { initClickSpark } from "./st2-click-spark.js?v=20260910a";

const restoring = document.body.classList.contains("st2-access-restoring");

initBorderGlowCards();
initLoginSilk({
  speed: 9.2,
  scale: 1.2,
  color: "#dc6d20",
  noiseIntensity: 1.5,
  rotation: 0.27,
});
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
  startLoginSilk();
  document.dispatchEvent(new CustomEvent("st2:access-gate-shown"));
} else {
  stopLoginSilk();
  startSplashSilk();
  initSplashDecryptedText();
}
