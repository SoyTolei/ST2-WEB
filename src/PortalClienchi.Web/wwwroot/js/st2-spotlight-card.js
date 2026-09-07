/**
 * SpotlightCard — port vanilla del efecto React Bits.
 * El glow sigue el cursor; el tinte respeta el color de cada tarjeta.
 */

const SELECTOR = ".plan-modulo-btn";
const CLASS_NAME = "st2-card-spotlight";
const DEFAULT_SPOTLIGHT = "rgba(255, 255, 255, 0.55)";

function parseRgb(bg) {
  const m = String(bg || "").match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Fondo → spotlight bien claro (casi blanco + matiz) para que se note en cards sólidas. */
function spotlightFromBackground(bg, alpha = 0.9) {
  const rgb = parseRgb(bg);
  if (!rgb) return DEFAULT_SPOTLIGHT;
  const lift = 0.78;
  const r = Math.min(255, Math.round(rgb[0] + (255 - rgb[0]) * lift));
  const g = Math.min(255, Math.round(rgb[1] + (255 - rgb[1]) * lift));
  const b = Math.min(255, Math.round(rgb[2] + (255 - rgb[2]) * lift));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function ensureSpotlightColor(card) {
  if (card.dataset.spotlightReady === "1") return;
  const fromCss = getComputedStyle(card).getPropertyValue("--spotlight-color").trim();
  if (!fromCss || fromCss === DEFAULT_SPOTLIGHT) {
    const bg = getComputedStyle(card).backgroundColor;
    card.style.setProperty("--spotlight-color", spotlightFromBackground(bg));
  }
  card.dataset.spotlightReady = "1";
}

function setMouse(card, clientX, clientY) {
  const rect = card.getBoundingClientRect();
  card.style.setProperty("--mouse-x", `${clientX - rect.left}px`);
  card.style.setProperty("--mouse-y", `${clientY - rect.top}px`);
}

function enhanceCard(card) {
  if (!(card instanceof HTMLElement) || card.disabled) return;
  if (card.dataset.spotlightBound === "1") return;

  card.classList.add(CLASS_NAME);
  card.dataset.spotlightBound = "1";
  ensureSpotlightColor(card);

  card.addEventListener(
    "pointerenter",
    (e) => {
      card.classList.add("is-spotlight-on");
      setMouse(card, e.clientX, e.clientY);
    },
    { passive: true }
  );

  card.addEventListener(
    "pointermove",
    (e) => {
      setMouse(card, e.clientX, e.clientY);
    },
    { passive: true }
  );

  card.addEventListener(
    "pointerleave",
    () => {
      card.classList.remove("is-spotlight-on");
    },
    { passive: true }
  );
}

function scan(root = document) {
  root.querySelectorAll?.(SELECTOR)?.forEach(enhanceCard);
}

export function initSpotlightCards(root = document) {
  if (initSpotlightCards._ready) {
    scan(root);
    return;
  }
  initSpotlightCards._ready = true;

  scan(root);

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches?.(SELECTOR)) enhanceCard(node);
        else scan(node);
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}
