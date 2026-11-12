/**
 * Port liviano de React Bits Pill Nav para .plan-segment-track:
 * un thumb deslizante detrás de la opción activa.
 * Sin MutationObserver global (congelaba el splash/login).
 */

const TRACK_SEL = ".plan-segment-track";
const BTN_SEL = ".plan-segment-btn";
const THUMB_CLASS = "plan-pill-thumb";

function ensureThumb(track) {
  let thumb = track.querySelector(`:scope > .${THUMB_CLASS}`);
  if (!thumb) {
    thumb = document.createElement("span");
    thumb.className = THUMB_CLASS;
    thumb.setAttribute("aria-hidden", "true");
    track.prepend(thumb);
  }
  track.classList.add("plan-pill-nav");
  return thumb;
}

function placeThumb(track) {
  if (!(track instanceof HTMLElement)) return;
  const thumb = ensureThumb(track);
  const active = track.querySelector(`${BTN_SEL}.active:not(.hidden)`);
  if (!active || active.offsetParent === null) {
    thumb.style.opacity = "0";
    return;
  }

  const trackRect = track.getBoundingClientRect();
  const btnRect = active.getBoundingClientRect();
  if (trackRect.width < 1 || btnRect.width < 1) {
    thumb.style.opacity = "0";
    return;
  }

  const pad = 2;
  const left = Math.max(pad, btnRect.left - trackRect.left);
  const width = Math.max(0, Math.min(btnRect.width, trackRect.width - left - pad));
  const top = Math.max(pad, btnRect.top - trackRect.top);
  const height = Math.max(0, btnRect.height);

  thumb.style.opacity = "1";
  thumb.style.width = `${width}px`;
  thumb.style.height = `${height}px`;
  thumb.style.transform = `translate3d(${left}px, ${top}px, 0)`;
}

export function syncPillNav(root = document) {
  const scope = root instanceof Element || root instanceof Document ? root : document;
  scope.querySelectorAll?.(TRACK_SEL)?.forEach(placeThumb);
}

export function enhancePillNavTrack(track) {
  if (!(track instanceof HTMLElement)) return;
  ensureThumb(track);
  placeThumb(track);
}

let wired = false;
let syncTimer = 0;

function scheduleSync() {
  if (syncTimer) return;
  syncTimer = window.setTimeout(() => {
    syncTimer = 0;
    syncPillNav();
  }, 40);
}

export function initPlanPillNav() {
  if (wired) {
    scheduleSync();
    return;
  }
  if (!document.body) {
    document.addEventListener("DOMContentLoaded", () => initPlanPillNav(), { once: true });
    return;
  }
  wired = true;

  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target?.closest?.(BTN_SEL);
      if (!btn) return;
      const track = btn.closest(TRACK_SEL);
      if (!track) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => placeThumb(track));
      });
    },
    true
  );

  window.addEventListener("resize", scheduleSync, { passive: true });
  document.addEventListener("st2:planillas-view-changed", scheduleSync);
  document.addEventListener("st2:access-unlocked", scheduleSync);

  scheduleSync();
}
