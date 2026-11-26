/**
 * Nieve de diciembre (1 al 31, hora Argentina) en el menú principal de Planillas:
 * una capa de fondo a pantalla completa (con acumulación abajo) y otra dentro del
 * recuadro del título. Las dos van detrás del contenido: nunca tapan menús ni botones.
 *
 * Vista previa fuera de temporada: agregar ?nieve=1 a la URL (queda guardado en esta
 * pestaña). ?nieve=0 la apaga.
 */

const PREVIEW_KEY = "st2-nieve-preview";
const CHECK_MS = 800;

/** Colores: azul hielo (no blanco) para que se lea en los dos temas. */
const THEME = {
  dark: { color: "#bfe3ff", lightMode: false },
  light: { color: "#3b82c4", lightMode: true },
};

const BACKGROUND = {
  variant: "snowflake",
  density: 0.9,
  accumulate: true,
  pixelSize: 3,
  speed: 1,
  wind: 0.25,
  sway: 0.5,
  depth: 0.6,
  glow: 0.8,
  twinkle: 0.35,
  mouseInteraction: true,
  intro: true,
};

const TITLE = {
  ...BACKGROUND,
  density: 1,
  glow: 0.6,
  opacity: 0.9,
  mouseInteraction: false,
};

function argentinaMonthDay() {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
        month: "numeric",
        day: "numeric",
      })
        .formatToParts(new Date())
        .map((p) => [p.type, p.value]),
    );
    return { month: Number(parts.month), day: Number(parts.day) };
  } catch {
    const d = new Date();
    return { month: d.getMonth() + 1, day: d.getDate() };
  }
}

function previewFlag() {
  try {
    const param = new URLSearchParams(window.location.search).get("nieve");
    if (param === "1") sessionStorage.setItem(PREVIEW_KEY, "1");
    if (param === "0") sessionStorage.removeItem(PREVIEW_KEY);
    return sessionStorage.getItem(PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}

/** Temporada: todo diciembre (1 al 31) en Argentina, o vista previa. */
export function isSnowSeason() {
  return argentinaMonthDay().month === 12 || previewFlag();
}

function currentTheme() {
  return document.documentElement.classList.contains("st2-theme-dark") ? THEME.dark : THEME.light;
}

function isPlanillasHome() {
  const tab = document.querySelector('.tab-btn[data-tab="planillas"]');
  if (!tab?.classList.contains("active")) return false;
  const panel = document.getElementById("panel-planillas");
  if (panel && !panel.classList.contains("active")) return false;
  const menu = document.getElementById("planillas-menu");
  return !!(menu && !menu.classList.contains("hidden"));
}

const BG_PROPS = [
  "backgroundColor",
  "backgroundImage",
  "backgroundSize",
  "backgroundPosition",
  "backgroundRepeat",
  "backgroundAttachment",
];
let bodyBgMoved = false;

/**
 * El body tiene fondo propio y se pinta encima de cualquier capa con z-index negativo.
 * Mientras nieva, ese mismo fondo lo pinta <html> (debajo de todo) y el body queda
 * transparente: se ve igual y la nieve aparece entre el fondo y el contenido.
 */
function moveBodyBackground(on) {
  const html = document.documentElement;
  const body = document.body;
  if (bodyBgMoved) {
    for (const prop of BG_PROPS) {
      html.style[prop] = "";
      body.style[prop] = "";
    }
    bodyBgMoved = false;
  }
  if (!on) return;
  const cs = getComputedStyle(body);
  for (const prop of BG_PROPS) html.style[prop] = cs[prop];
  body.style.backgroundColor = "transparent";
  body.style.backgroundImage = "none";
  bodyBgMoved = true;
}

let started = false;

export async function initDecemberSnow() {
  if (started || !isSnowSeason()) return;
  started = true;

  // El código WebGL solo se descarga en temporada.
  const { createPixelSnow } = await import("./st2-pixel-snow.js");

  const bgHost = document.createElement("div");
  bgHost.className = "st2-snow st2-snow--bg";
  bgHost.setAttribute("aria-hidden", "true");
  document.body.appendChild(bgHost);

  let titleHost = null;
  let bg = null;
  let title = null;

  const mountTitle = () => {
    const hero = document.querySelector("#planillas-menu .planillas-hero");
    if (!hero || hero.querySelector(".st2-snow--title")) return;
    titleHost = document.createElement("div");
    titleHost.className = "st2-snow st2-snow--title";
    titleHost.setAttribute("aria-hidden", "true");
    hero.prepend(titleHost);
    title = createPixelSnow(titleHost, { ...TITLE, ...currentTheme() });
  };

  const sync = () => {
    const show = isPlanillasHome();
    document.body.classList.toggle("st2-snow-on", show);
    if (show !== bodyBgMoved) moveBodyBackground(show);
    if (!show) return;
    if (!bg) bg = createPixelSnow(bgHost, { ...BACKGROUND, ...currentTheme() });
    if (!title) mountTitle();
  };

  // Tema claro/oscuro: cambiar color sin recrear.
  new MutationObserver(() => {
    // El fondo del body cambia con el tema: volver a tomarlo.
    if (bodyBgMoved) moveBodyBackground(true);
    const theme = currentTheme();
    bg?.set(theme);
    title?.set(theme);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  document.addEventListener("st2:planillas-home", sync);
  window.setInterval(sync, CHECK_MS);
  sync();
}
