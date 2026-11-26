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

let globeModal = null;

/** La bola ASCII solo se ve bien grande (~600 px): se abre en una ventana y se libera al cerrar. */
async function openSnowGlobeModal() {
  if (globeModal) return;
  const overlay = document.createElement("div");
  overlay.className = "st2-snowglobe-modal";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Bola de nieve con el Obelisco");
  overlay.innerHTML = `
    <div class="st2-snowglobe-modal__box">
      <button type="button" class="st2-snowglobe-modal__close" aria-label="Cerrar">×</button>
      <div class="st2-snowglobe-modal__globe"></div>
      <p class="st2-snowglobe-modal__hint">Tocá la bola para agitarla</p>
    </div>`;
  document.body.appendChild(overlay);
  let globe = null;
  const close = () => {
    globe?.destroy();
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    globeModal = null;
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  globeModal = { close };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.closest(".st2-snowglobe-modal__close")) close();
  });
  document.addEventListener("keydown", onKey);
  try {
    const SnowGlobe = await loadSnowGlobe();
    if (globeModal && SnowGlobe) {
      globe = SnowGlobe.mount(overlay.querySelector(".st2-snowglobe-modal__globe"), { bg: "#02030a" });
    }
  } catch {
    close();
  }
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

  // Bola de nieve: para todos en diciembre, en el título y en cada módulo. Ícono → ventana grande.
  const globeHost = document.createElement("button");
  globeHost.type = "button";
  globeHost.className = "st2-snowglobe";
  globeHost.title = "Bola de nieve: tocá para verla grande";
  globeHost.setAttribute("aria-label", "Abrir la bola de nieve del Obelisco");
  globeHost.innerHTML = GLOBE_ICON;
  globeHost.addEventListener("click", () => void openSnowGlobeModal());

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
