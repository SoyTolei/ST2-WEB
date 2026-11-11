/** Micro-interacciones estilo React Bits para acciones de planilla (vanilla). */

const bound = new WeakSet();

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

/**
 * @param {HTMLElement | null | undefined} btn
 * @param {"sling" | "slide" | "hold"} type
 * @param {() => void | Promise<void>} onCommit
 */
export function bindPlanActionFx(btn, type, onCommit) {
  if (!(btn instanceof HTMLElement) || bound.has(btn)) return btn;
  bound.add(btn);
  btn.dataset.planFx = type;
  btn.classList.add("plan-fx", `plan-fx--${type}`);

  if (type === "sling") bindSling(btn, onCommit);
  else if (type === "slide") bindSlide(btn, onCommit);
  else if (type === "hold") bindHold(btn, onCommit);

  return btn;
}

export function wirePlanActionTrio({
  copyBtn,
  previewBtn,
  clearBtn,
  onCopy,
  onPreview,
  onClear,
}) {
  bindPlanActionFx(copyBtn, "sling", onCopy);
  bindPlanActionFx(previewBtn, "slide", onPreview);
  bindPlanActionFx(clearBtn, "hold", onClear);
}

async function runCommit(btn, onCommit) {
  if (btn.disabled || btn.dataset.fxBusy === "1") return;
  btn.dataset.fxBusy = "1";
  btn.classList.add("is-busy");
  try {
    await onCommit?.();
    btn.classList.add("is-done");
    window.setTimeout(() => btn.classList.remove("is-done"), 900);
  } finally {
    btn.dataset.fxBusy = "0";
    btn.classList.remove("is-busy");
  }
}

function bindSling(btn, onCommit) {
  ensureFace(btn);
  let active = false;
  let startY = 0;
  let pull = 0;
  const maxPull = 42;

  const setPull = (value) => {
    pull = clamp(value, 0, maxPull);
    const t = pull / maxPull;
    btn.style.setProperty("--fx-pull", `${pull}px`);
    btn.style.setProperty("--fx-stretch", String(1 + t * 0.06));
    btn.classList.toggle("is-armed", pull > 10);
  };

  const reset = () => {
    active = false;
    btn.classList.remove("is-pulling", "is-armed", "is-firing");
    btn.style.setProperty("--fx-pull", "0px");
    btn.style.setProperty("--fx-stretch", "1");
    pull = 0;
  };

  const fire = async () => {
    btn.classList.add("is-firing");
    btn.classList.remove("is-pulling", "is-armed");
    btn.style.setProperty("--fx-pull", "0px");
    await runCommit(btn, onCommit);
    window.setTimeout(reset, 280);
  };

  btn.addEventListener("pointerdown", (e) => {
    if (btn.disabled || e.button !== 0) return;
    if (prefersReducedMotion()) {
      void fire();
      return;
    }
    active = true;
    startY = e.clientY;
    btn.classList.add("is-pulling");
    btn.setPointerCapture?.(e.pointerId);
    setPull(0);
  });

  btn.addEventListener("pointermove", (e) => {
    if (!active) return;
    setPull(e.clientY - startY);
  });

  const end = async (e) => {
    if (!active) return;
    active = false;
    try { btn.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
    const shouldFire = pull > 14 || pull < 4; // drag suficiente o click corto
    if (shouldFire) await fire();
    else reset();
  };

  btn.addEventListener("pointerup", (e) => { void end(e); });
  btn.addEventListener("pointercancel", reset);

  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      void fire();
    }
  });
}

function bindSlide(btn, onCommit) {
  ensureSlideStructure(btn);
  const thumb = btn.querySelector(".plan-fx-thumb");
  const track = btn.querySelector(".plan-fx-slide-track");
  if (!(thumb instanceof HTMLElement) || !(track instanceof HTMLElement)) return;

  let dragging = false;
  let startX = 0;
  let origin = 0;
  let progress = 0;

  const maxTravel = () => Math.max(24, track.clientWidth - thumb.offsetWidth - 10);

  const paint = (p) => {
    progress = clamp(p, 0, 1);
    const x = progress * maxTravel();
    thumb.style.transform = `translateX(${x}px)`;
    btn.style.setProperty("--fx-slide", String(progress));
    thumb.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
    btn.classList.toggle("is-armed", progress > 0.82);
  };

  const reset = () => {
    dragging = false;
    btn.classList.remove("is-dragging", "is-armed", "is-committing");
    paint(0);
  };

  const commit = async () => {
    btn.classList.add("is-committing");
    btn.classList.remove("is-dragging", "is-armed");
    paint(1);
    thumb.setAttribute("aria-valuenow", "100");
    try {
      await runCommit(btn, onCommit);
    } finally {
      window.setTimeout(reset, 700);
    }
  };

  thumb.addEventListener("pointerdown", (e) => {
    if (btn.disabled || e.button !== 0) return;
    if (prefersReducedMotion()) {
      void commit();
      return;
    }
    dragging = true;
    startX = e.clientX;
    origin = progress;
    btn.classList.add("is-dragging");
    thumb.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  });

  thumb.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const delta = e.clientX - startX;
    paint(origin + delta / maxTravel());
  });

  const end = async (e) => {
    if (!dragging) return;
    dragging = false;
    try { thumb.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
    if (progress >= 0.86) await commit();
    else {
      btn.classList.remove("is-dragging", "is-armed");
      paint(0);
    }
  };

  thumb.addEventListener("pointerup", (e) => { void end(e); });
  thumb.addEventListener("pointercancel", reset);

  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      void commit();
    }
  });
}

function bindHold(btn, onCommit) {
  ensureHoldStructure(btn);
  const holdMs = 720;
  let timer = 0;
  let started = 0;
  let raf = 0;

  const setProgress = (p) => {
    btn.style.setProperty("--fx-hold", String(clamp(p, 0, 1)));
    btn.classList.toggle("is-holding", p > 0.02);
    btn.classList.toggle("is-armed", p > 0.92);
  };

  const cancel = () => {
    window.clearTimeout(timer);
    window.cancelAnimationFrame(raf);
    timer = 0;
    started = 0;
    btn.classList.remove("is-holding", "is-armed");
    setProgress(0);
  };

  const tick = () => {
    if (!started) return;
    const p = (performance.now() - started) / holdMs;
    setProgress(p);
    if (p < 1) raf = window.requestAnimationFrame(tick);
  };

  const begin = (e) => {
    if (btn.disabled || (e && e.button !== 0)) return;
    if (prefersReducedMotion()) {
      void runCommit(btn, onCommit);
      return;
    }
    cancel();
    started = performance.now();
    btn.classList.add("is-holding");
    raf = window.requestAnimationFrame(tick);
    timer = window.setTimeout(async () => {
      setProgress(1);
      btn.classList.add("is-armed");
      await runCommit(btn, onCommit);
      cancel();
    }, holdMs);
    if (e?.pointerId != null) btn.setPointerCapture?.(e.pointerId);
  };

  btn.addEventListener("pointerdown", begin);
  btn.addEventListener("pointerup", cancel);
  btn.addEventListener("pointercancel", cancel);
  btn.addEventListener("pointerleave", (e) => {
    if (started) cancel();
  });

  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!started) begin();
    }
  });
  btn.addEventListener("keyup", (e) => {
    if (e.key === "Enter" || e.key === " ") cancel();
  });
}

function ensureFace(btn) {
  if (btn.querySelector(".plan-fx-face")) return;
  const face = document.createElement("span");
  face.className = "plan-fx-face";
  while (btn.firstChild) face.appendChild(btn.firstChild);
  btn.appendChild(face);
}

function ensureHoldStructure(btn) {
  if (btn.querySelector(".plan-fx-hold-fill")) return;
  ensureFace(btn);
  const fill = document.createElement("span");
  fill.className = "plan-fx-hold-fill";
  fill.setAttribute("aria-hidden", "true");
  btn.insertBefore(fill, btn.firstChild);
  if (!btn.querySelector(".plan-fx-hold-hint")) {
    const hint = document.createElement("span");
    hint.className = "plan-fx-hold-hint";
    hint.textContent = "Mantener";
    btn.appendChild(hint);
  }
}

function ensureSlideStructure(btn) {
  if (btn.querySelector(".plan-fx-slide-track")) return;

  const main = btn.querySelector(".plan-action-btn-main");
  const sub = btn.querySelector(".plan-action-btn-sub");
  const labelText = (main?.textContent || "Vista previa").replace(/\s+/g, " ").trim();
  const subText = (sub?.textContent || "").trim();

  btn.textContent = "";
  const track = document.createElement("span");
  track.className = "plan-fx-slide-track";

  const fill = document.createElement("span");
  fill.className = "plan-fx-slide-fill";
  fill.setAttribute("aria-hidden", "true");

  const thumb = document.createElement("span");
  thumb.className = "plan-fx-thumb";
  thumb.setAttribute("role", "slider");
  thumb.setAttribute("aria-valuemin", "0");
  thumb.setAttribute("aria-valuemax", "100");
  thumb.setAttribute("aria-valuenow", "0");
  thumb.setAttribute("aria-label", labelText);
  thumb.innerHTML = `<span class="plan-fx-thumb-icon" aria-hidden="true">›</span>`;

  const labels = document.createElement("span");
  labels.className = "plan-fx-slide-labels";
  labels.innerHTML = `
    <span class="plan-fx-slide-title">${escapeHtml(labelText)}</span>
    ${subText ? `<span class="plan-fx-slide-sub">${escapeHtml(subText)}</span>` : ""}
    <span class="plan-fx-slide-done">Listo</span>
  `;

  track.append(fill, thumb, labels);
  btn.appendChild(track);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
