import { _parts } from "./vendor/blobatar-internal.js";
import { gaze } from "./vendor/blobatar-gaze.js";

let gazeHandle = null;
let lastSeed = "";

/** Semilla estable: parte local del mail (nombre.apellido…). */
export function blobatarSeedFromEmail(email) {
  const local = String(email || "").split("@")[0].trim().toLowerCase();
  return local || "st2";
}

/**
 * Monta el blobatar animado (idle + ojos siguiendo el mouse) en el header.
 * Sin fondo blanco: solo la figura sobre la pastilla oscura.
 */
export function mountSessionBlobatar(email) {
  const host = document.getElementById("st2-session-avatar-host");
  if (!host) return;

  if (!email) {
    teardown();
    host.replaceChildren();
    host.setAttribute("hidden", "");
    lastSeed = "";
    return;
  }

  const seed = blobatarSeedFromEmail(email);
  if (seed === lastSeed && host.querySelector("svg.st2-session-blobatar")) return;
  lastSeed = seed;
  teardown();

  let parts;
  try {
    parts = _parts(seed, {
      animate: "always",
      background: false,
      size: 80,
    });
  } catch {
    host.replaceChildren();
    host.setAttribute("hidden", "");
    return;
  }

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("width", "40");
  svg.setAttribute("height", "40");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("st2-session-blobatar");
  if (parts.vars) {
    for (const [key, value] of Object.entries(parts.vars)) {
      svg.style.setProperty(key, value);
    }
  }
  // Excursión de mirada (viewBox units). Sin esto el gaze no mueve los ojos.
  // Un poco más alto que el default del demo (~3px) porque el avatar es chico (40px).
  svg.style.setProperty("--mo-track-travel", "4.2px");

  // mo-root debe ser hijo directo del svg (gaze.css: svg:has(>.mo-root)).
  const root = document.createElementNS("http://www.w3.org/2000/svg", "g");
  if (parts.cls) root.setAttribute("class", parts.cls);
  // innerHTML en SVGElement funciona en Chromium/Edge/Firefox modernos.
  root.innerHTML = parts.inner || "";
  svg.appendChild(root);

  host.replaceChildren(svg);
  host.removeAttribute("hidden");

  requestAnimationFrame(() => {
    if (!svg.isConnected) return;
    try {
      gazeHandle = gaze(svg, { target: "pointer" });
    } catch {
      gazeHandle = null;
    }
  });
}

function teardown() {
  try {
    gazeHandle?.stop?.();
  } catch {
    /* ignore */
  }
  gazeHandle = null;
}
