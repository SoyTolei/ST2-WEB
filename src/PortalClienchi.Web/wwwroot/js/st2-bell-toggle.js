/**
 * BellToggle (vanilla) — campana que activa / desactiva los avisos de escritorio de ST2.
 * Al activarse la campana se balancea y emite ondas; el badge muestra pendientes.
 */
import { desktopNotifSupported, isDesktopNotifActive, setDesktopNotifEnabled } from "./st2-desktop-notif.js?v=20261013c";

const SEG_EASE = "cubic-bezier(0.77, 0, 0.175, 1)";
const WARP = 0.6;
const BELL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.5V10a6 6 0 0 1 12 0v6.5l1.6 2.3H4.4L6 16.5z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>';

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

export function mountBellToggle(host, {
  offLabel = "Activar notificaciones",
  onLabel = "Notificaciones activas",
  getCount = () => 0,
  onDenied,
} = {}) {
  if (!host || host.dataset.bellReady === "1") return null;
  host.dataset.bellReady = "1";
  if (!desktopNotifSupported()) {
    host.hidden = true;
    return null;
  }

  host.classList.add("bell-toggle");
  host.innerHTML = `
    <button type="button" class="bell-toggle__button" aria-pressed="false" title="Notificaciones de escritorio cuando ST2 está en otra pestaña">
      <span class="bell-toggle__bell" aria-hidden="true">
        <span class="bell-toggle__glyph">${BELL_SVG}</span>
        <svg class="bell-toggle__wave bell-toggle__wave--left" viewBox="0 0 14 14"><path d="M14 8a6 6 0 0 0-6 6"/><path d="M14 4A10 10 0 0 0 4 14"/></svg>
        <svg class="bell-toggle__wave bell-toggle__wave--right" viewBox="0 0 14 14"><path d="M0 8a6 6 0 0 1 6 6"/><path d="M0 4a10 10 0 0 1 10 10"/></svg>
        <span class="bell-toggle__badge"><span class="bell-toggle__digit"></span></span>
      </span>
      <span class="bell-toggle__say">
        <span class="bell-toggle__face bell-toggle__face--off">${offLabel}</span>
        <span class="bell-toggle__face bell-toggle__face--on">${onLabel}</span>
      </span>
    </button>`;

  const button = host.querySelector(".bell-toggle__button");
  const glyph = host.querySelector(".bell-toggle__glyph");
  const waveLeft = host.querySelector(".bell-toggle__wave--left");
  const waveRight = host.querySelector(".bell-toggle__wave--right");
  const badge = host.querySelector(".bell-toggle__badge");
  const digit = host.querySelector(".bell-toggle__digit");
  let on = isDesktopNotifActive();
  let lastCount = 0;

  function swing(amplitude = 17, passes = 5, duration = 820) {
    if (reducedMotion() || !glyph?.animate) return;
    glyph.getAnimations().forEach((a) => a.cancel());
    glyph.animate(ringKeyframes(amplitude, passes, 1), { duration, easing: "linear" });
    for (let k = 0; k < passes; k += 1) {
      const side = k % 2 ? waveRight : waveLeft;
      const strength = 1 - k / passes;
      side?.animate(
        [
          { opacity: 0, transform: "scale(0.55)" },
          { opacity: 0.9 * strength, offset: 0.3 },
          { opacity: 0, transform: "scale(1.25)" },
        ],
        { duration: 380, delay: passOffset(k, passes) * duration, easing: "ease-out" },
      );
    }
  }

  function paint() {
    host.dataset.on = on ? "true" : "false";
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.setAttribute("aria-label", on ? onLabel : offLabel);
    const count = Math.max(0, Number(getCount()) || 0);
    const show = on && count > 0;
    badge.toggleAttribute("data-show", show);
    if (digit) digit.textContent = count > 9 ? "9+" : String(count);
    if (show && count > lastCount) swing(7, 3, 420);
    lastCount = count;
  }

  button.addEventListener("pointerdown", (e) => {
    if (e.button === 0) host.dataset.pressed = "";
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => {
    button.addEventListener(ev, () => delete host.dataset.pressed);
  });
  button.addEventListener("click", async () => {
    if (on) {
      setDesktopNotifEnabled(false);
      on = false;
      paint();
      return;
    }
    let granted = false;
    let permission = "default";
    try {
      if (desktopNotifSupported()) {
        permission = Notification.permission;
        const res = await Notification.requestPermission();
        permission = res || Notification.permission;
        granted = permission === "granted";
      }
    } catch {
      granted = false;
      permission = Notification.permission;
    }
    if (!granted) {
      onDenied?.(permission);
      return;
    }
    setDesktopNotifEnabled(true);
    on = true;
    paint();
    swing();
  });

  paint();
  return { refresh: paint };
}
