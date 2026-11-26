/**
 * Nieve de diciembre (1 al 31, hora Argentina) en Planillas: una capa de fondo a
 * pantalla completa (con acumulación abajo) en el menú y en todos los módulos, y otra
 * dentro del recuadro del título del menú. Las dos van detrás del contenido.
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
  density: 0.45,
  flakeSize: 0.75,
  accumulate: true,
  pixelSize: 3,
  speed: 1,
  wind: 0.25,
  sway: 0.5,
  depth: 0.6,
  glow: 0.8,
  twinkle: 0.35,
  // Sin interacción con el mouse: la nieve no se aparta al pasar el puntero.
  mouseInteraction: false,
  intro: true,
};

/** Título: copos más chicos (flakeSize y pixelSize menores) y bastante densidad. */
const TITLE = {
  ...BACKGROUND,
  density: 0.75,
  flakeSize: 0.35,
  pixelSize: 2,
  glow: 0.6,
  opacity: 0.9,
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

/** Pestaña Planillas activa: menú o cualquier módulo (transferencia, referral, PDF…). */
function isPlanillasTab() {
  const tab = document.querySelector('.tab-btn[data-tab="planillas"]');
  if (!tab?.classList.contains("active")) return false;
  const panel = document.getElementById("panel-planillas");
  return !panel || panel.classList.contains("active");
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

/** Bola de nieve ASCII (Obelisco): script clásico que deja window.SnowGlobe; solo se baja en temporada. */
function loadSnowGlobe() {
  if (window.SnowGlobe) return Promise.resolve(window.SnowGlobe);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/js/st2-snowglobe.js";
    script.onload = () => resolve(window.SnowGlobe);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/** Ícono de bola de nieve (SVG nítido a cualquier tamaño): vidrio, Obelisco, pinitos y base. */
const GLOBE_ICON = `
<svg viewBox="0 0 64 72" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="st2-globe-glass" cx="40%" cy="32%" r="70%">
      <stop offset="0" stop-color="#1e3a6e"/>
      <stop offset="0.65" stop-color="#0b1730"/>
      <stop offset="1" stop-color="#02030a"/>
    </radialGradient>
    <clipPath id="st2-globe-clip"><circle cx="32" cy="30" r="23"/></clipPath>
  </defs>
  <circle cx="32" cy="30" r="24" fill="url(#st2-globe-glass)" stroke="#8ec8ff" stroke-width="2"/>
  <g clip-path="url(#st2-globe-clip)">
    <ellipse cx="32" cy="50" rx="26" ry="8" fill="#dbeafe"/>
    <polygon points="32,10 35,15 35,45 29,45 29,15" fill="#e8f0ff"/>
    <rect x="31" y="18" width="2" height="3" fill="#1e3a6e"/>
    <polygon points="14,45 19,33 24,45" fill="#16a34a"/>
    <polygon points="40,45 45,34 50,45" fill="#16a34a"/>
    <circle cx="18" cy="41" r="1.2" fill="#ff3c3c"/><circle cx="20" cy="38" r="1.1" fill="#ffd23c"/>
    <circle cx="45" cy="40" r="1.2" fill="#5096ff"/><circle cx="47" cy="43" r="1.1" fill="#ff6edc"/>
    <g class="st2-globe-flakes" fill="#ffffff">
      <circle cx="16" cy="18" r="1.1"/><circle cx="24" cy="10" r="0.9"/><circle cx="42" cy="14" r="1.1"/>
      <circle cx="49" cy="24" r="0.9"/><circle cx="20" cy="27" r="0.8"/><circle cx="40" cy="28" r="0.9"/>
      <circle cx="12" cy="31" r="0.8"/><circle cx="52" cy="33" r="0.8"/>
    </g>
  </g>
  <ellipse cx="25" cy="17" rx="7" ry="4" fill="#ffffff" opacity="0.18" transform="rotate(-30 25 17)"/>
  <path d="M15 52h34l4 12a3 3 0 0 1-3 4H14a3 3 0 0 1-3-4z" fill="#b45309"/>
  <rect x="13" y="50" width="38" height="5" rx="2" fill="#92400e"/>
</svg>`;

/** Arbolito con estrella, guirnaldas, bolitas que titilan y regalos: del otro lado del título. */
const TREE_ICON = `
<svg viewBox="0 0 64 76" aria-hidden="true" focusable="false">
  <polygon points="32,12 19,30 45,30" fill="#16a34a"/>
  <polygon points="32,22 14,44 50,44" fill="#15803d"/>
  <polygon points="32,34 9,60 55,60" fill="#166534"/>
  <path d="M22 27 Q32 32 42 26" stroke="#fbbf24" stroke-width="1.6" fill="none"/>
  <path d="M18 41 Q32 48 46 40" stroke="#fbbf24" stroke-width="1.6" fill="none"/>
  <path d="M13 56 Q32 64 51 55" stroke="#fbbf24" stroke-width="1.6" fill="none"/>
  <rect x="28" y="60" width="8" height="8" fill="#92400e"/>
  <g class="st2-tree-lights">
    <circle cx="27" cy="23" r="1.8" fill="#ff3c3c"/><circle cx="38" cy="21" r="1.6" fill="#5096ff"/>
    <circle cx="22" cy="37" r="1.9" fill="#ffd23c"/><circle cx="33" cy="34" r="1.6" fill="#ff6edc"/>
    <circle cx="43" cy="37" r="1.8" fill="#ff3c3c"/><circle cx="17" cy="52" r="1.9" fill="#5096ff"/>
    <circle cx="28" cy="50" r="1.7" fill="#ff3c3c"/><circle cx="39" cy="51" r="1.9" fill="#ffd23c"/>
    <circle cx="48" cy="52" r="1.7" fill="#ff6edc"/>
  </g>
  <polygon class="st2-tree-star" fill="#fde047" points="32,2 34.1,7.6 40,7.8 35.4,11.4 37,17 32,13.8 27,17 28.6,11.4 24,7.8 29.9,7.6"/>
  <rect x="7" y="64" width="13" height="11" rx="1" fill="#dc2626"/>
  <rect x="12.5" y="64" width="2" height="11" fill="#fde047"/>
  <rect x="44" y="66" width="12" height="9" rx="1" fill="#2563eb"/>
  <rect x="49" y="66" width="2" height="9" fill="#e8f0ff"/>
</svg>`;

let globeZoom = null;

/**
 * La bola ASCII se ve bien a partir de ~450 px: al tocar el ícono crece desde ahí mismo
 * (sin ventana ni fondo oscuro), se agita al tocarla y vuelve al ícono al tocar afuera,
 * con Esc o al scrollear. Se libera al cerrarse.
 */
async function toggleSnowGlobeZoom(icon) {
  if (globeZoom) {
    globeZoom.close();
    return;
  }
  let SnowGlobe;
  try {
    SnowGlobe = await loadSnowGlobe();
  } catch {
    return;
  }
  if (!SnowGlobe || globeZoom) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.round(Math.min(480, vw - 32, (vh - 72) * 0.876));
  const height = Math.round(width / 0.876) + 26;
  const r = icon.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const left = Math.round(Math.min(Math.max(16, cx - width / 2), vw - 16 - width));
  const top = Math.round(Math.min(Math.max(16, r.top - 8), vh - 16 - height));

  const pop = document.createElement("div");
  pop.className = "st2-snowglobe-zoom";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Bola de nieve con el Obelisco");
  pop.style.cssText = `left:${left}px;top:${top}px;width:${width}px;` +
    `transform-origin:${Math.round(cx - left)}px ${Math.round(cy - top)}px;` +
    `--st2-zoom-from:${(r.width / width).toFixed(3)}`;
  pop.innerHTML = `
    <div class="st2-snowglobe-zoom__globe"></div>
    <p class="st2-snowglobe-zoom__hint">Tocá la bola para agitarla</p>`;
  document.body.appendChild(pop);
  const globe = SnowGlobe.mount(pop.querySelector(".st2-snowglobe-zoom__globe"), { bg: "#02030a" });
  icon.classList.add("is-zoomed");
  icon.setAttribute("aria-expanded", "true");

  const onPointer = (e) => {
    if (!pop.contains(e.target) && !icon.contains(e.target)) close();
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  const close = () => {
    if (!globeZoom) return;
    globeZoom = null;
    document.removeEventListener("pointerdown", onPointer, true);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("scroll", close, true);
    window.removeEventListener("resize", close);
    icon.classList.remove("is-zoomed");
    icon.setAttribute("aria-expanded", "false");
    pop.classList.remove("is-open");
    const done = () => {
      globe?.destroy();
      pop.remove();
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) done();
    else window.setTimeout(done, 240);
  };
  globeZoom = { close };
  document.addEventListener("pointerdown", onPointer, true);
  document.addEventListener("keydown", onKey);
  window.addEventListener("scroll", close, true);
  window.addEventListener("resize", close);
  // Dos frames: primero se pinta chico sobre el ícono y después crece.
  requestAnimationFrame(() => requestAnimationFrame(() => pop.classList.add("is-open")));
}

/** Encabezado del módulo de Planillas que se está viendo (transferencia, referral, PDF…). */
function visibleModuleHead() {
  return [...document.querySelectorAll(".planillas-view .plan-module-sticky-head")]
    .find((head) => head.offsetParent !== null) || null;
}

/**
 * Un solo ícono que se mueve: en el menú va a la izquierda del título; en un módulo va arriba
 * a la derecha del encabezado, como los huevos, a la izquierda de la etiqueta del sistema
 * (BEJERMAN SQL…) y del huevo de esa persona si lo tiene.
 */
function placeSnowGlobe(host) {
  const hero = document.querySelector("#planillas-menu .planillas-hero");
  const target = hero && hero.offsetParent !== null ? hero : visibleModuleHead();
  if (!target) return;
  if (host.parentElement !== target) target.appendChild(host);
  host.classList.toggle("is-hero", target === hero);
  host.classList.toggle("is-module", target !== hero);
  if (target === hero) return;
  const head = target.getBoundingClientRect();
  const blockers = [...target.querySelectorAll(".plan-sistema-badge, .planillas-corner-easter:not(.is-hidden)")]
    .filter((el) => el.offsetParent !== null)
    .map((el) => el.getBoundingClientRect().left);
  const left = Math.min(head.right, ...blockers);
  host.style.setProperty("--st2-globe-right", `${Math.round(head.right - left + 10)}px`);
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

  // Bola de nieve: para todos en diciembre, en el título y en cada módulo. Ícono → zoom en el lugar.
  const globeHost = document.createElement("button");
  globeHost.type = "button";
  globeHost.className = "st2-snowglobe";
  globeHost.title = "Bola de nieve: tocá para agrandarla";
  globeHost.setAttribute("aria-label", "Agrandar la bola de nieve del Obelisco");
  globeHost.setAttribute("aria-expanded", "false");
  globeHost.innerHTML = GLOBE_ICON;
  globeHost.addEventListener("click", () => void toggleSnowGlobeZoom(globeHost));

  const mountTitle = () => {
    const hero = document.querySelector("#planillas-menu .planillas-hero");
    if (!hero || hero.querySelector(".st2-snow--title")) return;
    titleHost = document.createElement("div");
    titleHost.className = "st2-snow st2-snow--title";
    titleHost.setAttribute("aria-hidden", "true");
    hero.prepend(titleHost);
    title = createPixelSnow(titleHost, { ...TITLE, ...currentTheme() });
    const tree = document.createElement("div");
    tree.className = "st2-xmas-tree";
    tree.setAttribute("aria-hidden", "true");
    tree.innerHTML = TREE_ICON;
    hero.appendChild(tree);
  };

  const sync = () => {
    const show = isPlanillasTab();
    document.body.classList.toggle("st2-snow-on", show);
    if (show !== bodyBgMoved) moveBodyBackground(show);
    if (!show) return;
    if (!bg) bg = createPixelSnow(bgHost, { ...BACKGROUND, ...currentTheme() });
    if (!title) mountTitle();
    placeSnowGlobe(globeHost);
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
  document.addEventListener("st2:planillas-view-changed", () => requestAnimationFrame(sync));
  window.setInterval(sync, CHECK_MS);
  sync();
}
