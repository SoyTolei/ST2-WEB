/**
 * Boot temprano: wallpaper de login + Lightfall del splash (no espera a app.js).
 */
import { startLoginTopography, stopLoginTopography, initLoginTopography } from "./st2-topography.js?v=20260907b";
import { initBorderGlowCards } from "./st2-border-glow.js?v=20260907c";
import { initSplashLightfall, startSplashLightfall, stopSplashLightfall } from "./st2-lightfall.js?v=20260907b";
import { initSuiteGlitchText } from "./st2-glitch-text.js?v=20260907d";
import { initSplashDecryptedText } from "./st2-decrypted-text.js?v=20260907c";

const restoring = document.body.classList.contains("st2-access-restoring");

initBorderGlowCards();
initLoginTopography();
initSuiteGlitchText();
initSplashLightfall({
  colors: ["#FF9FFC", "#F97316", "#F97316"],
  backgroundColor: "#ce6319",
  speed: 0.5,
  streakCount: 2,
  streakWidth: 1,
  streakLength: 1,
  glow: 1,
  density: 0.6,
  twinkle: 0.9,
  zoom: 3,
  backgroundGlow: 0.85,
  opacity: 1,
  mouseInteraction: true,
  mouseStrength: 0,
  mouseRadius: 1,
});

if (!restoring) {
  stopSplashLightfall();
  startLoginTopography();
  document.dispatchEvent(new CustomEvent("st2:access-gate-shown"));
} else {
  stopLoginTopography();
  startSplashLightfall();
  initSplashDecryptedText();
}
