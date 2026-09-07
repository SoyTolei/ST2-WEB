/**
 * Boot temprano del wallpaper de login (no espera a app.js).
 */
import { startLoginTopography, stopLoginTopography, initLoginTopography } from "./st2-topography.js?v=20260907b";
import { initBorderGlowCards } from "./st2-border-glow.js?v=20260907c";

const restoring = document.body.classList.contains("st2-access-restoring");

initBorderGlowCards();
initLoginTopography();

if (!restoring) {
  // Arranque inmediato: no esperar eventos ni al grafo enorme de app.js.
  startLoginTopography();
  document.dispatchEvent(new CustomEvent("st2:access-gate-shown"));
} else {
  stopLoginTopography();
}
