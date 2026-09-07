/**
 * GooeyNav (vanilla): pastilla móvil + partículas.
 * La selección visual es el efecto; el botón activo no lleva fill naranja.
 */

const DEFAULTS = {
  particleCount: 10,
  particleDistances: [48, 8],
  particleR: 90,
  animationTime: 520,
  timeVariance: 160,
  colors: [1, 2, 3, 1, 2, 3, 1, 4],
};

/** @type {WeakMap<HTMLElement, { filter: HTMLElement, text: HTMLElement, ro?: ResizeObserver }>} */
const hosts = new WeakMap();

const noise = (n = 1) => n / 2 - Math.random() * n;

function getXY(distance, pointIndex, totalPoints) {
  const angle = ((360 + noise(3)) / totalPoints) * pointIndex * (Math.PI / 180);
  return [distance * Math.cos(angle), distance * Math.sin(angle)];
}

function createParticle(i, t, d, r, colors, particleCount) {
  const rotate = noise(r / 16);
  return {
    start: getXY(d[0], particleCount - i, particleCount),
    end: getXY(d[1] + noise(3), particleCount - i, particleCount),
    time: t,
    scale: 1 + noise(0.1),
    color: colors[Math.floor(Math.random() * colors.length)],
    rotate: rotate > 0 ? (rotate + r / 28) * 6 : (rotate - r / 28) * 6,
  };
}

function ensureHost(container) {
  if (!container) return null;
  container.classList.add("st2-gooey-host");

  let entry = hosts.get(container);
  if (entry) return entry;

  let filter = container.querySelector(":scope > .st2-gooey-filter");
  if (!filter) {
    filter = document.createElement("span");
    filter.className = "st2-gooey-effect st2-gooey-filter";
    filter.setAttribute("aria-hidden", "true");
    container.appendChild(filter);
  }

  let text = container.querySelector(":scope > .st2-gooey-text");
  if (!text) {
    text = document.createElement("span");
    text.className = "st2-gooey-effect st2-gooey-text";
    text.setAttribute("aria-hidden", "true");
    container.appendChild(text);
  }

  entry = { filter, text };
  hosts.set(container, entry);

  if (typeof ResizeObserver !== "undefined") {
    entry.ro = new ResizeObserver(() => {
      const active = findActiveIn(container);
      if (active) updateEffectPosition(container, active, { burst: false });
    });
    entry.ro.observe(container);
  }

  return entry;
}

function findActiveIn(container) {
  return (
    container.querySelector(".tab-btn.active")
    || container.querySelector(".st2-context-btn.active")
    || null
  );
}

function updateEffectPosition(host, target, { burst = false } = {}) {
  const entry = ensureHost(host);
  if (!entry || !target) return;

  const hostRect = host.getBoundingClientRect();
  const pos = target.getBoundingClientRect();
  const styles = {
    left: `${pos.left - hostRect.left}px`,
    top: `${pos.top - hostRect.top}px`,
    width: `${pos.width}px`,
    height: `${pos.height}px`,
  };
  Object.assign(entry.filter.style, styles);
  Object.assign(entry.text.style, styles);

  // Solo texto (sin SVG) para el overlay fluido.
  const label = target.innerText?.replace(/\s+/g, " ").trim() || "";
  entry.text.textContent = label;

  entry.filter.classList.add("is-active");
  entry.text.classList.add("is-active");

  if (burst) {
    entry.filter.classList.remove("is-bursting");
    void entry.filter.offsetWidth;
    entry.filter.classList.add("is-bursting");
    window.setTimeout(() => {
      entry.filter.classList.remove("is-bursting");
    }, 420);
  }
}

function clearParticles(filter) {
  filter.querySelectorAll(".st2-gooey-particle").forEach((p) => p.remove());
}

function makeParticles(filter, opts) {
  const d = opts.particleDistances;
  const r = opts.particleR;
  const bubbleTime = opts.animationTime * 2 + opts.timeVariance;
  filter.style.setProperty("--time", `${bubbleTime}ms`);

  for (let i = 0; i < opts.particleCount; i += 1) {
    const t = opts.animationTime * 2 + noise(opts.timeVariance * 2);
    const p = createParticle(i, t, d, r, opts.colors, opts.particleCount);

    setTimeout(() => {
      if (!filter.isConnected) return;
      const particle = document.createElement("span");
      const point = document.createElement("span");
      particle.className = "st2-gooey-particle";
      particle.style.setProperty("--start-x", `${p.start[0]}px`);
      particle.style.setProperty("--start-y", `${p.start[1]}px`);
      particle.style.setProperty("--end-x", `${p.end[0]}px`);
      particle.style.setProperty("--end-y", `${p.end[1]}px`);
      particle.style.setProperty("--time", `${p.time}ms`);
      particle.style.setProperty("--scale", `${p.scale}`);
      particle.style.setProperty("--color", `var(--st2-gooey-color-${p.color})`);
      particle.style.setProperty("--rotate", `${p.rotate}deg`);
      point.className = "st2-gooey-point";
      particle.appendChild(point);
      filter.appendChild(particle);

      setTimeout(() => {
        particle.remove();
      }, t);
    }, 30);
  }
}

function findHostFor(target) {
  return (
    target.closest(".st2-context-seg")
    || target.closest(".st2-context-bar")
    || target.closest(".tab-bar")
    || target.closest(".st2-gooey-host")
  );
}

/**
 * Dispara el efecto gooey sobre el botón activo recién seleccionado.
 * @param {HTMLElement | null} target
 * @param {Partial<typeof DEFAULTS>} [options]
 */
export function playGooeyNav(target, options = {}) {
  if (!target || !(target instanceof HTMLElement)) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    const host = findHostFor(target);
    if (host) updateEffectPosition(host, target, { burst: false });
    return;
  }

  const host = findHostFor(target);
  if (!host) return;

  const entry = ensureHost(host);
  if (!entry) return;

  const opts = { ...DEFAULTS, ...options };
  clearParticles(entry.filter);
  updateEffectPosition(host, target, { burst: true });
  makeParticles(entry.filter, opts);
}

/** Alinea la pastilla al activo actual (sin burst). */
export function syncGooeyNav(container) {
  const host = container || document.querySelector(".tab-bar");
  if (!host) return;
  ensureHost(host);
  const active = findActiveIn(host);
  if (active) updateEffectPosition(host, active, { burst: false });
}

/** Prepara hosts principales (tab bar + selectores de sistema). */
export function initGooeyNav() {
  const tabBar = document.querySelector(".tab-bar");
  if (tabBar) {
    ensureHost(tabBar);
    syncGooeyNav(tabBar);
  }

  document.querySelectorAll(".st2-context-seg").forEach((seg) => {
    ensureHost(seg);
    syncGooeyNav(seg);
  });

  const portalPills = document.getElementById("portalSistemaPills");
  if (portalPills) {
    ensureHost(portalPills);
    const mo = new MutationObserver(() => {
      ensureHost(portalPills);
      syncGooeyNav(portalPills);
    });
    mo.observe(portalPills, { childList: true });
  }
}
