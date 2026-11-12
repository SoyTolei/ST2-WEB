/** Ports vanilla de React Bits: Tap+ClickSpark (default) / Sling / SlideCommit / Fuse. */

const bound = new WeakSet();

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const ICON_CLIPBOARD = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1V5a2 2 0 0 1 2-2zm0 3h6V5H9v1zm-1 2v1h8V8H8zm0 3v7h8v-7H8z" fill="currentColor"/></svg>`;
const ICON_ARROW_UP = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l-6 6h4v8h4v-8h4l-6-6z" fill="currentColor"/></svg>`;
const ICON_ARROW_RIGHT = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6l6 6-6 6-1.4-1.4L13.2 12 8.6 7.4 10 6z" fill="currentColor"/></svg>`;
const ICON_EYE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c5.2 0 9.5 3.2 11 7-1.5 3.8-5.8 7-11 7S2.5 15.8 1 12c1.5-3.8 5.8-7 11-7zm0 2.2c-3.8 0-7 2.2-8.6 4.8 1.6 2.6 4.8 4.8 8.6 4.8s7-2.2 8.6-4.8C19 9.4 15.8 7.2 12 7.2zm0 2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z" fill="currentColor"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 16.2 5.8 12.5l1.4-1.4 2.3 2.3 6.3-6.3 1.4 1.4-7.7 7.7z" fill="currentColor"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z" fill="currentColor"/></svg>`;
const ICON_UNDO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V2L7 7l5 5V9c3.3 0 6 2.7 6 6a6 6 0 0 1-6 6 6 6 0 0 1-5.7-4.2l-2.1.7A8 8 0 0 0 12 23a8 8 0 0 0 8-8c0-4.4-3.6-8-8-8z" fill="currentColor"/></svg>`;
const ICON_SPINNER = `<svg class="slide-commit__spinner" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="40 20" stroke-linecap="round"/></svg>`;

function prefersReducedMotion() {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  } catch {
    return false;
  }
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readLabel(el, fallback) {
  const main = el.querySelector?.(".plan-action-btn-main, .plan-fx-sling-title");
  if (main) {
    const clone = main.cloneNode(true);
    clone.querySelectorAll("[data-plan-icon], .plan-action-btn-icon, svg, .plan-text-preview-copy-icon").forEach((n) => n.remove());
    const text = clone.textContent?.replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  const text = el.getAttribute?.("aria-label") || el.textContent?.replace(/\s+/g, " ").trim();
  return text || fallback;
}

function readSub(el, fallback = "") {
  const sub = el.querySelector?.(".plan-action-btn-sub, .plan-fx-sling-sub");
  return sub?.textContent?.replace(/\s+/g, " ").trim() || fallback;
}

function proxyDisabled(host, apply) {
  Object.defineProperty(host, "disabled", {
    configurable: true,
    enumerable: true,
    get() {
      return host.dataset.fxDisabled === "1";
    },
    set(value) {
      const on = !!value;
      host.dataset.fxDisabled = on ? "1" : "0";
      apply(on);
    },
  });
  if ("disabled" in (host instanceof HTMLButtonElement ? host : {})) {
    /* keep native if button */
  }
  apply(!!host.dataset.fxDisabled && host.dataset.fxDisabled === "1");
}

/**
 * @param {HTMLElement | null | undefined} btn
 * @param {"tap" | "sling" | "slide" | "fuse"} type
 * @param {() => void | Promise<void>} onCommit
 * @param {{ onUndo?: () => void | Promise<void>, compact?: boolean, label?: string, sub?: string, successLabel?: string, icon?: string }=} opts
 */
export function bindPlanActionFx(btn, type, onCommit, opts = {}) {
  if (!(btn instanceof HTMLElement) || bound.has(btn)) return btn;
  bound.add(btn);

  if (type === "tap" || type === "spark" || type === "specular") return mountSpecular(btn, onCommit, opts);
  if (type === "sling") return mountSling(btn, onCommit, opts);
  if (type === "slide") return mountSlide(btn, onCommit, opts);
  if (type === "fuse") return mountFuse(btn, onCommit, opts);
  return btn;
}

export function wirePlanActionTrio({
  copyBtn,
  previewBtn,
  clearBtn,
  onCopy,
  onPreview,
  onClear,
  onClearUndo,
  clearUndoWindow = 900,
}) {
  // Specular Button (React Bits): clic normal, el brillo sigue el cursor. Sin estado "Listo".
  bindPlanActionFx(copyBtn, "specular", onCopy, { label: "Copiar" });
  bindPlanActionFx(previewBtn, "specular", onPreview, { label: "Ver planilla" });
  bindPlanActionFx(clearBtn, "fuse", onClear, {
    onUndo: onClearUndo,
    undoWindow: clearUndoWindow,
  });
}

/* ===================== SPECULAR BUTTON (React Bits, CSS) ===================== */

function mountSpecular(el, onCommit, opts = {}) {
  const compact = !!opts.compact;
  const label = opts.label || readLabel(el, "Acción");
  const tone = el.classList.contains("blue")
    ? "blue"
    : el.classList.contains("ghost")
      ? "ghost"
      : "green";

  const host = document.createElement("button");
  host.type = "button";
  host.id = el.id;
  host.className = [
    "specular-button",
    compact ? "specular-button--sm" : "specular-button--md",
    `specular-button--${tone}`,
    el.classList.contains("plan-text-preview-copy") ? "plan-text-preview-copy" : "",
  ].filter(Boolean).join(" ");
  host.dataset.planFx = "specular";
  if (el.dataset.planPreviewCopy != null) host.dataset.planPreviewCopy = "";
  host.setAttribute("aria-label", label);
  host.innerHTML = `
    <span class="specular-button__sheen" aria-hidden="true"></span>
    <span class="specular-button__label">${escapeHtml(label)}</span>
  `;
  if (el instanceof HTMLButtonElement && el.disabled) host.disabled = true;
  el.replaceWith(host);

  const track = (event) => {
    const rect = host.getBoundingClientRect();
    host.style.setProperty("--sb-x", `${event.clientX - rect.left}px`);
    host.style.setProperty("--sb-y", `${event.clientY - rect.top}px`);
  };
  host.addEventListener("pointermove", track);
  host.addEventListener("pointerdown", track);
  host.addEventListener("click", () => {
    if (host.disabled) return;
    void onCommit?.();
  });

  return host;
}

/* ===================== SLING ===================== */

function mountSling(el, onSend, opts = {}) {
  const compact = !!opts.compact;
  const size = compact ? 40 : 48;
  const strokeWidth = compact ? 2.5 : 2.75;
  const maxPull = compact ? 110 : 140;
  const armAt = compact ? 36 : 42;
  const particles = compact ? 10 : 12;
  const label = opts.label || readLabel(el, "Copiar");
  const sub = opts.sub ?? readSub(el, compact ? "" : "Tirar y soltar para copiar");
  // Compact también puede llevar label (p. ej. Copiar en la vista previa).
  const withMeta = !compact || opts.showLabel !== false;

  const GAP = 4;
  const R = maxPull;
  const ARM = Math.min(armAt, 0.8 * R);
  const wellR = size / 2 + GAP + strokeWidth;
  const padR = size / 2 - strokeWidth / 2;
  const arcR = wellR;
  const H = wellR + strokeWidth + 2;
  const DOT = Math.max(6, Math.round(size / 7));
  const FINGER_MAX = 3000;
  const HAND_MAX = 6000;
  const CANCEL = 0.5;
  const POWER_CAP = 1.5;
  const DOT_MS = 300;
  const launchSpeed = 2600;
  const flight = 120;
  const spread = 60;

  const host = document.createElement(withMeta ? "div" : "span");
  host.id = el.id;
  host.className = withMeta
    ? "plan-fx-sling-wrap"
    : `sling-button sling-button--compact${el.classList.contains("plan-text-preview-copy") ? " plan-text-preview-copy" : ""}`;
  if (el.dataset.planPreviewCopy != null) host.dataset.planPreviewCopy = el.dataset.planPreviewCopy;
  host.dataset.planFx = "sling";

  const sling = withMeta ? document.createElement("span") : host;
  if (withMeta) {
    sling.className = compact ? "sling-button sling-button--compact" : "sling-button";
    host.appendChild(sling);
  }

  sling.style.setProperty("--sl-size", `${size}px`);
  sling.style.setProperty("--sl-svg", `${2 * H}px`);
  sling.style.setProperty("--sl-stroke", `${strokeWidth}px`);
  sling.style.setProperty("--sl-dot", `${DOT}px`);

  sling.innerHTML = `
    <svg class="sling-button__fx" viewBox="${-H} ${-H} ${2 * H} ${2 * H}" aria-hidden="true">
      <circle class="sling-button__well" r="${wellR.toFixed(2)}" />
      <path class="sling-button__band" d="" />
      <path class="sling-button__band sling-button__band--hot" d="" style="opacity:0" />
      <circle class="sling-button__arc" r="${arcR.toFixed(2)}" pathLength="1" stroke-dasharray="0 1" style="opacity:0" />
    </svg>
    ${Array.from({ length: particles }, () => `<span class="sling-button__dot" aria-hidden="true"></span>`).join("")}
    <span class="sling-button__move">
      <button type="button" class="sling-button__pad" aria-label="${escapeHtml(label)}">
        <span class="sling-button__face">
          <span class="sling-button__icon">${compact ? ICON_CLIPBOARD : ICON_ARROW_UP}</span>
        </span>
      </button>
    </span>
    <span class="sling-button__sr">Arrastrá hacia afuera y soltá para enviar, o Enter.</span>
  `;

  if (withMeta) {
    const meta = document.createElement("div");
    meta.className = "plan-fx-sling-meta";
    meta.innerHTML = `
      <span class="plan-fx-sling-title">${escapeHtml(label)}</span>
      ${sub ? `<span class="plan-fx-sling-sub">${escapeHtml(sub)}</span>` : ""}
    `;
    host.appendChild(meta);
  }

  el.replaceWith(host);

  const pad = sling.querySelector(".sling-button__pad");
  const moveEl = sling.querySelector(".sling-button__move");
  const fx = sling.querySelector(".sling-button__fx");
  const band = sling.querySelector(".sling-button__band:not(.sling-button__band--hot)");
  const hot = sling.querySelector(".sling-button__band--hot");
  const arc = sling.querySelector(".sling-button__arc");
  const icon = sling.querySelector(".sling-button__icon");
  const dots = [...sling.querySelectorAll(".sling-button__dot")];

  let px = 0;
  let py = 0;
  let held = false;
  let armed = false;
  let disabled = false;
  let grip = null;
  let dir = { ux: 0, uy: -1 };
  let anim = null;
  let paintQueued = false;
  let skipClick = false;
  let power = 0;
  let dotPending = false;
  let dotTimer = 0;

  const setDisabled = (on) => {
    disabled = on;
    pad?.setAttribute("aria-disabled", on ? "true" : "false");
    if (on) pad?.setAttribute("disabled", "");
    else pad?.removeAttribute("disabled");
  };
  proxyDisabled(host, setDisabled);
  if (el instanceof HTMLButtonElement && el.disabled) host.disabled = true;

  const aimIcon = (ux, uy, dist) => {
    if (!icon) return;
    const angle = (Math.atan2(-uy, -ux) * 180) / Math.PI + 90;
    icon.style.transition = "none";
    icon.style.transform = `rotate(${angle * clamp(dist / 12, 0, 1)}deg)`;
  };
  const relaxIcon = () => {
    if (!icon) return;
    icon.style.transition = prefersReducedMotion() ? "none" : `transform 360ms ${EASE_OUT}`;
    icon.style.transform = "rotate(0deg)";
  };

  const launchDot = () => {
    dotPending = false;
    window.clearTimeout(dotTimer);
    const { ux, uy } = dir;
    relaxIcon();
    const base = Math.atan2(-uy, -ux);
    const cone = (spread * Math.PI) / 180;
    const push = 0.85 + 0.35 * power;
    dots.forEach((dot, i) => {
      const lead = i === 0;
      const angle = base + (lead ? 0 : (Math.random() + Math.random() - 1) * (cone / 2));
      const cx = Math.cos(angle);
      const cy = Math.sin(angle);
      const reach = (lead ? flight : flight * (0.3 + Math.random())) * push;
      const drift = lead ? 0 : (Math.random() - 0.5) * flight * 0.4;
      const scale = lead ? 1 : 0.3 + Math.random() * 0.6;
      const shrink = lead ? 0.6 : scale * (0.2 + Math.random() * 0.4);
      const duration = lead ? DOT_MS : DOT_MS * (0.7 + Math.random());
      const delay = lead ? 0 : Math.random() * 70;
      const to = wellR + reach;
      dot.animate(
        [
          { transform: `translate(${cx * wellR}px, ${cy * wellR}px) scale(${scale})` },
          { transform: `translate(${cx * to - cy * drift}px, ${cy * to + cx * drift}px) scale(${shrink})` },
        ],
        { duration, delay, easing: EASE_OUT, fill: "none" }
      );
      dot.animate(
        [
          { opacity: 1, offset: 0 },
          { opacity: 1, offset: 0.55 },
          { opacity: 0, offset: 1 },
        ],
        { duration, delay, easing: "linear", fill: "none" }
      );
    });
  };

  const paint = () => {
    paintQueued = false;
    if (!band || !hot || !arc || !fx || !moveEl) return;
    const x = px;
    const y = py;
    const { ux, uy } = dir;
    const proj = x * ux + y * uy;
    const p = clamp(proj / ARM, 0, 1);
    const dist = Math.hypot(x, y);
    let d = "";
    if (dist > 0.5) {
      const a = Math.atan2(y, x);
      const b = Math.acos(clamp((wellR - padR) / dist, -1, 1));
      d = [a + b, a - b]
        .map((t) => {
          const cx = Math.cos(t);
          const cy = Math.sin(t);
          return `M${(wellR * cx).toFixed(2)},${(wellR * cy).toFixed(2)}L${(x + padR * cx).toFixed(2)},${(y + padR * cy).toFixed(2)}`;
        })
        .join("");
    }
    band.setAttribute("d", d);
    hot.setAttribute("d", d);
    hot.style.opacity = String(p);
    fx.style.opacity = String(clamp(proj / 6, 0, 1));
    arc.setAttribute("stroke-dasharray", `${p} ${1 - p}`);
    arc.setAttribute("stroke-dashoffset", String(p / 2));
    arc.style.opacity = p > 0.01 ? "1" : "0";
    if (grip) aimIcon(ux, uy, dist);
    arc.setAttribute("transform", `rotate(${(Math.atan2(-uy, -ux) * 180) / Math.PI})`);
    moveEl.style.transform = `translate(${x}px, ${y}px)`;
    if (dotPending && proj <= size / 4) launchDot();
  };

  const schedulePaint = () => {
    if (paintQueued) return;
    paintQueued = true;
    requestAnimationFrame(paint);
  };

  const setPos = (x, y) => {
    px = x;
    py = y;
    schedulePaint();
  };

  const settle = (v0) => {
    anim?.cancel();
    if (prefersReducedMotion()) {
      if (fx) {
        fx.style.transition = "opacity 200ms ease";
        fx.style.opacity = "0";
      }
      window.setTimeout(() => {
        setPos(0, 0);
        if (fx) fx.style.transition = "";
      }, 200);
      return;
    }
    const x0 = px;
    const y0 = py;
    const kickX = clamp(v0.x * 0.02, -28, 28);
    const kickY = clamp(v0.y * 0.02, -28, 28);
    const wa = moveEl?.animate(
      [
        { transform: `translate(${x0}px, ${y0}px)` },
        { transform: `translate(${kickX}px, ${kickY}px)`, offset: 0.45 },
        { transform: "translate(0px, 0px)" },
      ],
      { duration: 420, easing: EASE_OUT }
    );
    anim = wa || null;
    px = 0;
    py = 0;
    schedulePaint();
    wa?.finished?.then?.(() => {
      setPos(0, 0);
      anim = null;
    }).catch?.(() => {});
  };

  const fireSend = () => {
    void onSend?.();
  };

  const release = (pointerId, cancelled) => {
    const g = grip;
    if (!g || g.id !== pointerId) return;
    grip = null;
    skipClick = true;
    try { pad?.releasePointerCapture(pointerId); } catch { /* ignore */ }
    const d = Math.hypot(px, py);
    const p = d / ARM;
    const { ux, uy } = dir;
    let vx = 0;
    let vy = 0;
    if (!cancelled && g.hist.length > 1) {
      const a = g.hist[0];
      const b = g.hist[g.hist.length - 1];
      const dt = b.t - a.t;
      if (dt > 0 && performance.now() - b.t < 50) {
        vx = ((b.x - a.x) / dt) * 1000;
        vy = ((b.y - a.y) / dt) * 1000;
      }
    }
    const fm = Math.hypot(vx, vy);
    if (fm > FINGER_MAX) {
      vx *= FINGER_MAX / fm;
      vy *= FINGER_MAX / fm;
    }
    if (!g.moved) {
      relaxIcon();
      if (!cancelled) fireSend();
    } else {
      const fire = armed && !cancelled;
      const launch = fire ? launchSpeed * Math.min(p, POWER_CAP) : CANCEL * launchSpeed * Math.min(p, 1);
      let v0x = vx - ux * launch;
      let v0y = vy - uy * launch;
      const m = Math.hypot(v0x, v0y);
      if (m > HAND_MAX) {
        v0x *= HAND_MAX / m;
        v0y *= HAND_MAX / m;
      }
      if (!fire) relaxIcon();
      if (fire) {
        fireSend();
        if (prefersReducedMotion()) {
          sling.dataset.sent = "";
          window.setTimeout(() => delete sling.dataset.sent, 200);
        } else {
          power = clamp((Math.min(p, POWER_CAP) - 1) / (POWER_CAP - 1), 0, 1);
          dotPending = true;
          dotTimer = window.setTimeout(launchDot, 150);
        }
      }
      settle({ x: v0x, y: v0y });
    }
    armed = false;
    held = false;
    delete sling.dataset.armed;
    delete pad?.dataset.held;
    delete pad?.dataset.armed;
  };

  pad?.addEventListener("pointerdown", (e) => {
    if (disabled || grip || e.button !== 0) return;
    const rect = sling.getBoundingClientRect();
    const scale = rect.width / (sling.offsetWidth || rect.width) || 1;
    anim?.cancel();
    const dNow = Math.hypot(px, py);
    const dClamped = Math.min(dNow, 0.95 * R);
    const rawNow = dNow > 0.5 ? (R * dClamped) / (R - dClamped) : 0;
    grip = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      scale,
      moved: false,
      hist: [],
      rawOrigin: dNow > 0.5 ? { x: (rawNow * px) / dNow, y: (rawNow * py) / dNow } : { x: 0, y: 0 },
      slop: e.pointerType === "touch" ? 8 : 4,
    };
    try { pad.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    held = true;
    pad.dataset.held = "";
  });

  pad?.addEventListener("pointermove", (e) => {
    const g = grip;
    if (!g || g.id !== e.pointerId) return;
    const dx = (e.clientX - g.startX) / g.scale;
    const dy = (e.clientY - g.startY) / g.scale;
    let rx = g.rawOrigin.x + dx;
    let ry = g.rawOrigin.y + dy;
    if (!g.moved && Math.hypot(dx, dy) > g.slop) g.moved = true;
    const raw = Math.hypot(rx, ry);
    if (raw < 0.01) return;
    const d = (R * raw) / (R + raw);
    const ux = rx / raw;
    const uy = ry / raw;
    dir = { ux, uy };
    setPos(d * ux, d * uy);
    const t = performance.now();
    g.hist.push({ x: d * ux, y: d * uy, t });
    while (g.hist.length > 4 || t - g.hist[0].t > 80) g.hist.shift();
    const isArmed = d >= ARM;
    if (isArmed !== armed) {
      armed = isArmed;
      if (armed) {
        sling.dataset.armed = "";
        pad.dataset.armed = "";
      } else {
        delete sling.dataset.armed;
        delete pad.dataset.armed;
      }
    }
  });

  pad?.addEventListener("pointerup", (e) => release(e.pointerId, false));
  pad?.addEventListener("pointercancel", (e) => release(e.pointerId, true));
  pad?.addEventListener("lostpointercapture", (e) => release(e.pointerId, true));
  pad?.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && grip) release(grip.id, true);
  });
  pad?.addEventListener("click", () => {
    if (skipClick) {
      skipClick = false;
      return;
    }
    if (!disabled) fireSend();
  });

  bound.add(host);
  paint();
  return host;
}

/* ===================== SLIDE COMMIT ===================== */

function mountSlide(el, onConfirm, opts = {}) {
  const label = opts.label || readLabel(el, "Vista previa");
  const sub = opts.sub ?? readSub(el, "Deslizá para generar");
  const doneLabel = opts.doneLabel || "Listo";
  const errorLabel = opts.errorLabel || "Error";
  const PAD = 3;
  const height = sub ? 56 : 48;
  const radius = 22;
  const holdMs = 1500;
  const MIN_PENDING = 300;
  const returnBounce = 0.38;

  const host = document.createElement("div");
  host.id = el.id;
  host.className = "slide-commit";
  host.dataset.planFx = "slide";
  host.dataset.phase = "idle";
  host.style.setProperty("--sc-h", `${height}px`);
  host.style.setProperty("--sc-radius", `${radius}px`);
  host.style.setProperty("--sc-grip-r", `${Math.max(0, radius - PAD)}px`);
  host.style.setProperty("--sc-pad", `${PAD}px`);

  host.innerHTML = `
    <div class="slide-commit__track">
      <span class="slide-commit__label" aria-hidden="true">
        <span class="slide-commit__text slide-commit__text--plain">
          <span class="slide-commit__title">${escapeHtml(label)}</span>
          ${sub ? `<span class="slide-commit__sub">${escapeHtml(sub)}</span>` : ""}
        </span>
        <span class="slide-commit__text slide-commit__text--error">${escapeHtml(errorLabel)}</span>
      </span>
      <div class="slide-commit__capsule" role="slider" tabindex="0" aria-label="${escapeHtml(label)}. ${escapeHtml(sub)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div class="slide-commit__content">
          <span class="slide-commit__arrow" aria-hidden="true">${ICON_ARROW_RIGHT}</span>
          <span class="slide-commit__spin" aria-hidden="true">${ICON_SPINNER}</span>
          <span class="slide-commit__done" aria-hidden="true">${ICON_CHECK}<span>${escapeHtml(doneLabel)}</span></span>
        </div>
      </div>
      <span class="slide-commit__sr" aria-live="polite"></span>
    </div>
  `;

  el.replaceWith(host);

  const track = host.querySelector(".slide-commit__track");
  const capsule = host.querySelector(".slide-commit__capsule");
  const content = host.querySelector(".slide-commit__content");
  const labelEl = host.querySelector(".slide-commit__label");
  const sr = host.querySelector(".slide-commit__sr");

  let phase = "idle";
  let held = false;
  let x = 0;
  let grip = null;
  let run = 0;
  let timer = 0;
  let homeTimer = 0;
  let disabled = false;
  let animFrame = 0;

  const metrics = () => {
    const width = host.clientWidth || 280;
    const GRIP = height - PAD * 2;
    const INNER = width - PAD * 2;
    const TRAVEL = Math.max(1, INNER - GRIP);
    return { width, GRIP, INNER, TRAVEL, gripR: Math.max(0, radius - PAD) };
  };

  const setDisabled = (on) => {
    disabled = on;
    if (on) host.dataset.disabled = "";
    else delete host.dataset.disabled;
    if (capsule) capsule.tabIndex = on ? -1 : 0;
    capsule?.setAttribute("aria-disabled", on ? "true" : "false");
  };
  proxyDisabled(host, setDisabled);
  if (el instanceof HTMLButtonElement && el.disabled) host.disabled = true;

  const paint = () => {
    const { GRIP, INNER, TRAVEL, gripR } = metrics();
    const seen = clamp(x, 0, TRAVEL);
    const edge = seen + GRIP;
    const percent = Math.round((seen / TRAVEL) * 100);
    capsule?.setAttribute("aria-valuenow", String(percent));
    capsule?.setAttribute("aria-valuetext", `${label}, ${percent}%`);
    if (capsule) {
      capsule.style.width = `${INNER}px`;
      capsule.style.borderRadius = `${gripR}px`;
      capsule.style.clipPath = `inset(0 ${INNER - edge}px 0 0 round ${gripR}px)`;
      capsule.style.transform = phase === "idle" && !held && seen < 1 ? "scale(1)" : "scale(1)";
    }
    if (content) {
      content.style.transform = `translateX(${(seen + edge) / 2 - INNER / 2}px)`;
    }
    if (labelEl) {
      const opacity = clamp(1 - seen / (TRAVEL * 0.55), 0, 1);
      labelEl.style.opacity = String(opacity);
    }
    const arrow = host.querySelector(".slide-commit__arrow");
    if (arrow instanceof HTMLElement) {
      const a = clamp(1 - (seen - TRAVEL * 0.55) / (TRAVEL * 0.4), 0, 1);
      arrow.style.opacity = String(a);
    }
  };

  const setX = (v, animateHome = false) => {
    const { TRAVEL } = metrics();
    const next = clamp(v, 0, TRAVEL);
    if (animateHome && !prefersReducedMotion()) {
      const from = x;
      const start = performance.now();
      const dur = 320;
      cancelAnimationFrame(animFrame);
      const step = (now) => {
        const t = clamp((now - start) / dur, 0, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        const overshoot = Math.sin(t * Math.PI) * returnBounce * 8 * (1 - t);
        x = from + (next - from) * ease + (next === 0 ? overshoot : 0);
        paint();
        if (t < 1) animFrame = requestAnimationFrame(step);
        else {
          x = next;
          paint();
        }
      };
      animFrame = requestAnimationFrame(step);
    } else {
      x = next;
      paint();
    }
  };

  const setPhase = (next) => {
    phase = next;
    host.dataset.phase = next;
    if (sr) {
      sr.textContent =
        next === "pending" ? "Generando…" : next === "done" ? doneLabel : next === "error" ? errorLabel : "";
    }
    capsule?.setAttribute("aria-busy", next === "pending" ? "true" : "false");
  };

  const settle = () => {
    setPhase("idle");
    setX(0, true);
  };

  const resolve = () => {
    setPhase("done");
    setX(0, !prefersReducedMotion());
    if (holdMs > 0) timer = window.setTimeout(settle, holdMs);
  };

  const reject = () => {
    setPhase("error");
    if (!prefersReducedMotion() && track) {
      track.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-5px)" },
          { transform: "translateX(5px)" },
          { transform: "translateX(-3px)" },
          { transform: "translateX(3px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 450, easing: EASE_OUT }
      );
    }
    homeTimer = window.setTimeout(() => {
      if (!grip) setX(0, true);
    }, 300);
    timer = window.setTimeout(() => setPhase("idle"), Math.max(holdMs, 1500));
  };

  const commit = async () => {
    window.clearTimeout(timer);
    const id = ++run;
    const { TRAVEL } = metrics();
    x = TRAVEL;
    paint();
    let out;
    try {
      out = onConfirm?.();
    } catch {
      reject();
      return;
    }
    const pending = out && typeof out.then === "function" ? out : null;
    if (!pending) {
      resolve();
      return;
    }
    setPhase("pending");
    const t0 = performance.now();
    const later = (fn) => {
      window.setTimeout(() => {
        if (id === run) fn();
      }, Math.max(0, MIN_PENDING - (performance.now() - t0)));
    };
    try {
      await pending;
      later(resolve);
    } catch {
      later(reject);
    }
  };

  const localX = (clientX) => {
    const rect = track?.getBoundingClientRect();
    if (!rect) return 0;
    const { width } = metrics();
    return ((clientX - rect.left) / (rect.width / width || 1));
  };

  track?.addEventListener("pointerdown", (e) => {
    if (disabled || grip || phase === "pending" || phase === "done" || e.button !== 0) return;
    cancelAnimationFrame(animFrame);
    grip = { id: e.pointerId, grab: null, moved: false, hist: [] };
    held = true;
    host.dataset.held = "";
    try { track.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });

  track?.addEventListener("pointermove", (e) => {
    const g = grip;
    if (!g || g.id !== e.pointerId) return;
    const at = localX(e.clientX);
    if (g.grab === null) {
      g.grab = at - x;
      return;
    }
    const { TRAVEL } = metrics();
    const next = clamp(at - g.grab, 0, TRAVEL);
    if (Math.abs(next - x) > 0.5) g.moved = true;
    g.hist.push([e.timeStamp, next]);
    if (g.hist.length > 4) g.hist.shift();
    x = next;
    paint();
  });

  const up = (e) => {
    const g = grip;
    if (!g || g.id !== e.pointerId) return;
    grip = null;
    held = false;
    delete host.dataset.held;
    try { track?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const { TRAVEL } = metrics();
    if (x >= TRAVEL * 0.98) void commit();
    else if (g.moved) setX(0, true);
  };

  track?.addEventListener("pointerup", up);
  track?.addEventListener("pointercancel", up);

  capsule?.addEventListener("keydown", (e) => {
    if (disabled || phase === "pending" || phase === "done") return;
    const { TRAVEL } = metrics();
    const step = TRAVEL / 10;
    if (e.key === "End" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      void commit();
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(TRAVEL, x + step);
      x = next;
      paint();
      if (next >= TRAVEL) void commit();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      x = Math.max(0, x - step);
      paint();
    } else if (e.key === "Home" || e.key === "Escape") {
      e.preventDefault();
      setX(0, true);
    }
  });

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => paint()) : null;
  ro?.observe(host);
  paint();
  bound.add(host);
  return host;
}

/* ===================== FUSE ===================== */

function mountFuse(el, onCommit, opts = {}) {
  const label = (opts.label || readLabel(el, "Limpiar")).replace(/^🗑\s*/, "");
  const undoLabel = opts.undoLabel || "Deshacer";
  const doneLabel = opts.doneLabel || "Listo";
  const undoWindow = opts.undoWindow || 4000;
  /** Si true, borra al toque; la mecha solo da un Deshacer corto (si hay onUndo). */
  const commitOnArm = opts.commitOnArm !== false;
  const fuseMode = "bottom";
  const LINE = [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }];

  const host = document.createElement("span");
  host.id = el.id;
  host.className = "fuse-button";
  host.dataset.planFx = "fuse";
  host.dataset.phase = "idle";
  host.dataset.fuse = fuseMode;
  host.tabIndex = -1;

  host.innerHTML = `
    <button type="button" class="fuse-button__face fuse-button__idle">
      <span class="fuse-button__icon" aria-hidden="true">${ICON_TRASH}</span>
      <span>${escapeHtml(label)}</span>
    </button>
    <button type="button" class="fuse-button__face fuse-button__undo" aria-keyshortcuts="Escape">
      <span class="fuse-button__icon fuse-button__icon--undo" aria-hidden="true">${ICON_UNDO}</span>
      <span>${escapeHtml(undoLabel)}</span>
    </button>
    <span class="fuse-button__face fuse-button__settled" aria-hidden="true">
      <span class="fuse-button__icon">${ICON_CHECK}</span>
      <span>${escapeHtml(doneLabel)}</span>
    </span>
    <span class="fuse-button__fuse" aria-hidden="true"></span>
    <span class="fuse-button__status" aria-live="polite"></span>
  `;

  el.replaceWith(host);

  const idleBtn = host.querySelector(".fuse-button__idle");
  const undoBtn = host.querySelector(".fuse-button__undo");
  const fuseEl = host.querySelector(".fuse-button__fuse");
  const status = host.querySelector(".fuse-button__status");

  let phase = "idle";
  let anim = null;
  let disabled = false;
  const pause = { hover: false, hidden: false, canHoverPause: false };

  const setDisabled = (on) => {
    disabled = on;
    if (idleBtn instanceof HTMLButtonElement) idleBtn.disabled = on;
  };
  proxyDisabled(host, setDisabled);
  if (el instanceof HTMLButtonElement && el.disabled) host.disabled = true;

  const go = (next) => {
    phase = next;
    host.dataset.phase = next;
    if (status) status.textContent = next === "idle" ? "" : doneLabel;
    if (next === "armed") undoBtn?.focus?.({ preventScroll: true });
    else if (host.contains(document.activeElement)) idleBtn?.focus?.({ preventScroll: true });
  };

  const syncPlayState = () => {
    if (!anim) return;
    if (pause.hover || pause.hidden) {
      if (anim.playState === "running") anim.pause();
    } else if (anim.playState === "paused") {
      anim.play();
    }
  };

  const light = (from = 0) => {
    if (!fuseEl) return;
    anim?.cancel();
    const a = fuseEl.animate(LINE, {
      duration: undoWindow,
      easing: "linear",
      fill: "forwards",
    });
    if (from) a.currentTime = from;
    a.onfinish = () => {
      if (!commitOnArm) void onCommit?.("fuseEnd");
      go("idle");
    };
    anim = a;
    syncPlayState();
  };

  const arm = () => {
    if (disabled || phase !== "idle") return;
    if (commitOnArm || prefersReducedMotion()) {
      void onCommit?.("press");
      if (prefersReducedMotion() || !opts.onUndo) return;
    }
    light();
    pause.canHoverPause = false;
    pause.hover = false;
    go("armed");
  };

  const undo = async () => {
    if (phase !== "armed") return;
    if (anim) {
      anim.onfinish = null;
      anim.pause();
      anim.cancel();
      anim = null;
    }
    try {
      await opts.onUndo?.();
    } finally {
      go("idle");
      if (fuseEl) fuseEl.style.transform = "scaleX(1)";
    }
  };

  idleBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    arm();
  });
  undoBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    void undo();
  });

  host.addEventListener("pointerdown", (e) => {
    const pressable = phase === "armed" || (phase === "idle" && !disabled);
    if (e.button === 0 && pressable) host.dataset.pressed = "";
  });
  const release = () => {
    delete host.dataset.pressed;
  };
  host.addEventListener("pointerup", release);
  host.addEventListener("pointercancel", release);
  host.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "mouse" && pause.canHoverPause) {
      pause.hover = true;
      syncPlayState();
    }
  });
  host.addEventListener("pointerleave", (e) => {
    release();
    if (e.pointerType !== "mouse") return;
    pause.canHoverPause = true;
    pause.hover = false;
    syncPlayState();
  });
  host.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && phase === "armed") {
      e.preventDefault();
      void undo();
    }
  });

  const onVisibility = () => {
    pause.hidden = document.hidden;
    syncPlayState();
  };
  document.addEventListener("visibilitychange", onVisibility);

  bound.add(host);
  return host;
}
