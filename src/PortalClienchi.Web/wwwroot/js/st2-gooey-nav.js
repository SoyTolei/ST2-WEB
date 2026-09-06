/**
 * Gooey burst para pestañas / cambio de sistema.
 * No reemplaza el nav: solo dispara partículas al cambiar de activo.
 */

const DEFAULTS = {
  particleCount: 19,
  particleDistances: [90, 10],
  particleR: 300,
  animationTime: 600,
  timeVariance: 400,
  colors: [1, 2, 3, 1, 2, 3, 1, 4],
};

const noise = (n = 1) => n / 2 - Math.random() * n;

function getXY(distance, pointIndex, totalPoints) {
  const angle = ((360 + noise(8)) / totalPoints) * pointIndex * (Math.PI / 180);
  return [distance * Math.cos(angle), distance * Math.sin(angle)];
}

function createParticle(i, t, d, r, colors, particleCount) {
  const rotate = noise(r / 10);
  return {
    start: getXY(d[0], particleCount - i, particleCount),
    end: getXY(d[1] + noise(7), particleCount - i, particleCount),
    time: t,
    scale: 1 + noise(0.2),
    color: colors[Math.floor(Math.random() * colors.length)],
    rotate: rotate > 0 ? (rotate + r / 20) * 10 : (rotate - r / 20) * 10,
  };
}

function ensureHost(container) {
  if (!container) return null;
  container.classList.add("st2-gooey-host");
  let filter = container.querySelector(":scope > .st2-gooey-filter");
  if (!filter) {
    filter = document.createElement("span");
    filter.className = "st2-gooey-effect st2-gooey-filter";
    filter.setAttribute("aria-hidden", "true");
    container.appendChild(filter);
  }
  return filter;
}

function positionFilter(filter, host, target) {
  const hostRect = host.getBoundingClientRect();
  const pos = target.getBoundingClientRect();
  Object.assign(filter.style, {
    left: `${pos.left - hostRect.left}px`,
    top: `${pos.top - hostRect.top}px`,
    width: `${pos.width}px`,
    height: `${pos.height}px`,
  });
}

function clearParticles(filter) {
  filter.querySelectorAll(".st2-gooey-particle").forEach((p) => p.remove());
}

function makeParticles(filter, opts) {
  const d = opts.particleDistances;
  const r = opts.particleR;
  const bubbleTime = opts.animationTime * 2 + opts.timeVariance;
  filter.style.setProperty("--time", `${bubbleTime}ms`);
  filter.classList.remove("is-active");

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

      requestAnimationFrame(() => {
        filter.classList.add("is-active");
      });

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
 * Dispara el burst gooey sobre el botón activo recién seleccionado.
 * @param {HTMLElement | null} target
 * @param {Partial<typeof DEFAULTS>} [options]
 */
export function playGooeyNav(target, options = {}) {
  if (!target || !(target instanceof HTMLElement)) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

  const host = findHostFor(target);
  if (!host) return;

  const filter = ensureHost(host);
  if (!filter) return;

  const opts = { ...DEFAULTS, ...options };
  clearParticles(filter);
  positionFilter(filter, host, target);
  makeParticles(filter, opts);
}

/** Prepara hosts principales (tab bar + selectores de sistema). */
export function initGooeyNav() {
  const tabBar = document.querySelector(".tab-bar");
  if (tabBar) ensureHost(tabBar);

  document.querySelectorAll(".st2-context-seg").forEach((seg) => ensureHost(seg));

  // Portal pills se regeneran: observar el contenedor.
  const portalPills = document.getElementById("portalSistemaPills");
  if (portalPills) {
    ensureHost(portalPills);
    const mo = new MutationObserver(() => ensureHost(portalPills));
    mo.observe(portalPills, { childList: true });
  }
}
