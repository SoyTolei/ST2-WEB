/**
 * Pantalla de carga navideña: Papá Noel en el tren Roca (st2-trenroca.js, puntos LED).
 * Va del 26/11 al 18/12/2026 (hora Argentina); el script inicial de index.html decide si
 * corresponde y deja html.st2-xmas-splash-on.
 *
 * En cada carga se ve la animación entera (~6 s, a 1,5×) aunque la app ya esté lista.
 * Se puede saltar tocando o con Esc.
 *
 * Vista previa (también en localhost): ?splash=tren. ?splash=0 la apaga.
 */

import { initSplashDecryptedText } from "./st2-decrypted-text.js";

const SPEED = 1.5;
/** Segundo de la animación en que el tren ya salió de cuadro. */
const END = 9.2;
/** Tope por si la app nunca termina de cargar: abajo queda el splash de siempre. */
const MAX_MS = 12000;

function loadTrenRoca() {
  if (window.TrenRoca) return Promise.resolve(window.TrenRoca);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/js/st2-trenroca.js";
    script.onload = () => resolve(window.TrenRoca);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/** App lista: sesión validada o formulario de acceso a la vista. */
function appReady() {
  const cls = document.body.classList;
  return cls.contains("st2-access-ok") || cls.contains("show-access-gate");
}

export function initXmasSplash() {
  const root = document.documentElement;
  const el = document.getElementById("st2-xmas-splash");
  if (!el) return;
  if (!root.classList.contains("st2-xmas-splash-on")) {
    el.remove();
    return;
  }

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const opened = performance.now();
  let animStart = 0;
  let minMs = 0;
  let player = null;
  let raf = 0;
  let closed = false;
  let loadFailed = false;

  const finish = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    el.classList.add("is-leaving");
    window.setTimeout(() => {
      cancelAnimationFrame(raf);
      player?.destroy();
      el.remove();
      root.classList.remove("st2-xmas-splash-on");
    }, 450);
  };

  const onKey = (e) => {
    if (e.key === "Escape") finish();
  };

  const tick = () => {
    if (closed) return;
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    if (player && !reduce) {
      player.renderAt(Math.min(((now - animStart) / 1000) * SPEED, END));
    }
    // Esperar a que baje el tren y termine; si no carga, como el splash de siempre.
    const shownEnough = reduce || loadFailed || (player && now - animStart >= minMs);
    if ((appReady() && shownEnough) || now - opened >= MAX_MS) finish();
  };

  // Misma marca y mismo efecto (texto que se descifra) que el splash de siempre.
  initSplashDecryptedText(el);
  el.addEventListener("click", finish);
  document.addEventListener("keydown", onKey);
  window.setTimeout(() => el.classList.add("show-skip"), 1500);

  loadTrenRoca()
    .then((TrenRoca) => {
      if (closed) return;
      if (!TrenRoca) {
        loadFailed = true;
        return;
      }
      // freeze: monta sin su propio reloj; acá se maneja el tiempo (más rápido que el original).
      player = TrenRoca.mount(el.querySelector(".st2-xmas-splash__scene"), { freeze: reduce ? 3 : 0, timer: false });
      animStart = performance.now();
      minMs = reduce ? 0 : (END / SPEED) * 1000;
      el.classList.add("is-playing");
    })
    .catch(() => {
      loadFailed = true;
    });

  tick();
}
