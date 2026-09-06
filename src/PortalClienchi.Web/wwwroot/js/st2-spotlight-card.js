/**
 * SpotlightCard — port vanilla del efecto React Bits.
 * Sigue el cursor sobre .plan-modulo-btn y tintea el glow con el color de la tarjeta.
 */

const SELECTOR = ".plan-modulo-btn";
const CLASS_NAME = "st2-card-spotlight";
const DEFAULT_SPOTLIGHT = "rgba(0, 229, 255, 0.2)";

function parseRgb(bg) {
  const m = String(bg || "").match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Mezcla el fondo con blanco y aplica alpha para el radial. */
function spotlightFromBackground(bg, alpha = 0.32) {
  const rgb = parseRgb(bg);
  if (!rgb) return DEFAULT_SPOTLIGHT;
  const lift = 0.55;
  const r = Math.min(255, Math.round(rgb[0] + (255 - rgb[0]) * lift));
  const g = Math.min(255, Math.round(rgb[1] + (255 - rgb[1]) * lift));
  const b = Math.min(255, Math.round(rgb[2] + (255 - rgb[2]) * lift));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function ensureSpotlightColor(card) {
  if (card.dataset.spotlightReady === "1") return;
  const inline = getComputedStyle(card).getPropertyValue("--spotlight-color").trim();
  if (!inline || inline === DEFAULT_SPOTLIGHT) {
    const bg = getComputedStyle(card).backgroundColor;
    card.style.setProperty("--spotlight-color", spotlightFromBackground(bg));
  }
  card.dataset.spotlightReady = "1";
}

function enhanceCard(card) {
  if (!(card instanceof HTMLElement)) return;
  if (card.classList.contains(CLASS_NAME)) return;
  card.classList.add(CLASS_NAME);
}

function onPointerMove(e) {
  const card = e.target.closest?.(SELECTOR);
  if (!card || card.disabled) return;
  enhanceCard(card);
  ensureSpotlightColor(card);
  const rect = card.getBoundingClientRect();
  card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
  card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
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

  document.addEventListener("pointermove", onPointerMove, { passive: true });

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
