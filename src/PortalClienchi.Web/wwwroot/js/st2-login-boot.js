/**
 * Boot temprano: wallpaper Silk del login + AeroShards del splash (no espera a app.js).
 */
import { startLoginSilk, stopLoginSilk, initLoginSilk } from "./st2-silk.js?v=20260914a";
import { initBorderGlowCards } from "./st2-border-glow.js?v=20260907c";
import { initSplashAero, startSplashAero, stopSplashAero } from "./st2-splash-aero.js?v=20260914b";
import { initSuiteGlitchText } from "./st2-glitch-text.js?v=20260907d";
import { initSplashDecryptedText } from "./st2-decrypted-text.js?v=20260910b";
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
initSplashAero();

if (!restoring) {
  stopSplashAero();
  startLoginSilk();
  document.dispatchEvent(new CustomEvent("st2:access-gate-shown"));
} else {
  stopLoginSilk();
  startSplashAero();
  initSplashDecryptedText();
}
