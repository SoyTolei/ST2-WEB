/**
 * Campanita junto al saludo del blobatar (React Bits BellToggle, compacta).
 * Abre la bandeja de avisos de update web / descargas.
 */
import { getNotifInboxUnreadCount, openNotifInbox, toggleNotifInbox } from "./st2-notif-inbox.js?v=20261112m";

const BELL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.5V10a6 6 0 0 1 12 0v6.5l1.6 2.3H4.4L6 16.5z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>';

const SEG_EASE = "cubic-bezier(0.77, 0, 0.175, 1)";
const WARP = 0.6;
const passOffset = (k, passes) => 1 - Math.pow(1 - (k + 2 / 3) / (passes + 1), WARP);

function ringKeyframes(amplitude, passes, decay) {
  const frames = [{ transform: "rotate(0deg)", offset: 0, easing: SEG_EASE }];
  for (let k = 0; k < passes; k += 1) {
    const angle = amplitude * Math.pow(1 - k / passes, decay) * (k % 2 ? 1 : -1);
    frames.push({ transform: `rotate(${angle.toFixed(2)}deg)`, offset: passOffset(k, passes), easing: SEG_EASE });
  }
  frames.push({ transform: "rotate(0deg)", offset: 1 });
  return frames;
}

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

export function mountGreetBell(host) {
  if (!host || host.dataset.greetBellReady === "1") return null;
  host.dataset.greetBellReady = "1";
  host.classList.add("st2-greet-bell", "bell-toggle");
  host.innerHTML = `
    <button type="button" class="st2-greet-bell__button bell-toggle__button" aria-label="Avisos" title="Avisos">
      <span class="bell-toggle__bell" aria-hidden="true">
        <span class="bell-toggle__glyph">${BELL_SVG}</span>
        <svg class="bell-toggle__wave bell-toggle__wave--left" viewBox="0 0 14 14"><path d="M14 8a6 6 0 0 0-6 6"/><path d="M14 4A10 10 0 0 0 4 14"/></svg>
        <svg class="bell-toggle__wave bell-toggle__wave--right" viewBox="0 0 14 14"><path d="M0 8a6 6 0 0 1 6 6"/><path d="M0 4a10 10 0 0 1 10 10"/></svg>
        <span class="bell-toggle__badge"><span class="bell-toggle__digit"></span></span>
      </span>
    </button>`;

  const button = host.querySelector(".st2-greet-bell__button");
  const glyph = host.querySelector(".bell-toggle__glyph");
  const badge = host.querySelector(".bell-toggle__badge");
  const digit = host.querySelector(".bell-toggle__digit");
  let lastCount = 0;

  function swing(amplitude = 14, passes = 4, duration = 720) {
    if (reducedMotion() || !glyph?.animate) return;
    glyph.getAnimations().forEach((a) => a.cancel());
    glyph.animate(ringKeyframes(amplitude, passes, 1), { duration, easing: "linear" });
  }

  function paint() {
    const session = document.getElementById("st2-session-email");
    const sessionOn = !!session && !session.classList.contains("hidden");
    host.hidden = !sessionOn;
    host.classList.toggle("hidden", !sessionOn);
    if (!sessionOn) return;

    const count = Math.max(0, Number(getNotifInboxUnreadCount()) || 0);
    const show = count > 0;
    badge?.toggleAttribute("data-show", show);
    if (digit) digit.textContent = count > 9 ? "9+" : String(count);
    host.classList.toggle("has-unread", show);
    if (show && count > lastCount) swing(8, 3, 420);
    lastCount = count;
  }

  button?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Cierra el menú de las 3 rayitas si estaba abierto (evita superposición).
    document.body.classList.remove("st2-session-menu-open");
    const menu = document.getElementById("st2-session-menu");
    const menuBtn = document.getElementById("st2-session-menu-btn");
    if (menu) {
      menu.classList.add("hidden");
      menu.setAttribute("hidden", "");
    }
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
    toggleNotifInbox();
    swing();
    paint();
  });

  document.addEventListener("st2:notif-inbox-changed", paint);
  document.addEventListener("st2:session-changed", paint);
  paint();
  return {
    refresh: paint,
    open: () => {
      openNotifInbox();
      paint();
    },
  };
}
