/**
 * Pantalla de carga navideña: Papá Noel en el tren Roca (st2-trenroca.js, puntos LED).
 * Va del 27/11 al 18/12/2026 (hora Argentina); el script inicial de index.html decide si
 * corresponde y deja html.st2-xmas-splash-on (y .st2-xmas-splash-full la primera vez del día).
 *
 * - Primera carga del día en este navegador: se ve la animación entera (~6 s, a 1,5×)
 *   aunque la app ya esté lista. Se puede saltar tocando o con Esc.
 * - Las demás cargas del día: el tren queda de fondo y se va apenas la app está lista,
 *   como el splash de siempre.
 *
 * Vista previa (también en localhost): ?splash=tren. ?splash=0 la apaga.
 */

const SPEED = 1.5;
/** Segundo de la animación en que el tren ya salió de cuadro. */
const END = 9.2;
/** Tope por si la app nunca termina de cargar: abajo queda el splash de siempre. */
const MAX_MS = 12000;
const SEEN_KEY = "st2-splash-tren-visto";

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

  const full = root.classList.contains("st2-xmas-splash-full");
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
    if (full) {
      try {
        localStorage.setItem(SEEN_KEY, root.dataset.st2Today || "");
      } catch {
        /* sin storage: la próxima carga la vuelve a mostrar entera */
      }
    }
    document.removeEventListener("keydown", onKey);
    el.classList.add("is-leaving");
    window.setTimeout(() => {
      cancelAnimationFrame(raf);
      player?.destroy();
      el.remove();
      root.classList.remove("st2-xmas-splash-on", "st2-xmas-splash-full");
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
    // Entera: esperar a que baje el tren y termine; si no carga, como el splash de siempre.
    const shownEnough = !full || reduce || loadFailed || (player && now - animStart >= minMs);
    if ((appReady() && shownEnough) || now - opened >= MAX_MS) finish();
  };

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
      minMs = full && !reduce ? (END / SPEED) * 1000 : 0;
      el.classList.add("is-playing");
    })
    .catch(() => {
      loadFailed = true;
    });

  tick();
}
