const MOBILE_MQ = "(max-width: 720px)";

function getGridCap(grid) {
  if (grid.classList.contains("plan-chile-soporte-grid")) return 2;
  if (grid.classList.contains("is-compact")) return 2;
  return 3;
}

function visibleGridChildren(grid) {
  return [...grid.children].filter((el) => !el.classList.contains("hidden") && !el.hidden);
}

/** Mantiene filas de N columnas y centra 1–2 tarjetas sueltas en la última fila. */
export function syncPlanModulosGridLayout(grid, { maxCols } = {}) {
  if (!grid) return;
  const items = visibleGridChildren(grid);
  items.forEach((el) => el.style.removeProperty("grid-column"));

  if (window.matchMedia(MOBILE_MQ).matches) {
    grid.style.removeProperty("grid-template-columns");
    grid.style.removeProperty("justify-content");
    return;
  }

  const cap = maxCols ?? getGridCap(grid);
  const n = items.length;
  if (!n) {
    grid.style.removeProperty("grid-template-columns");
    grid.style.removeProperty("justify-content");
    return;
  }

  const subCols = cap * 2;
  grid.style.gridTemplateColumns = `repeat(${subCols}, minmax(0, 1fr))`;
  grid.style.justifyContent = "";

  items.forEach((el) => {
    el.style.gridColumn = "span 2";
  });

  const rem = n % cap;
  if (rem === 1) {
    const start = cap === 3 ? 3 : 2;
    items[n - 1].style.gridColumn = `${start} / span 2`;
  } else if (rem === 2 && cap === 3) {
    items[n - 2].style.gridColumn = "2 / span 2";
    items[n - 1].style.gridColumn = "4 / span 2";
  }
}

export function syncAllPlanModulosGrids() {
  document.querySelectorAll(".plan-modulos-grid").forEach((grid) => {
    syncPlanModulosGridLayout(grid);
  });
}

if (typeof window !== "undefined" && !window.__st2PlanGridLayoutBound) {
  window.__st2PlanGridLayoutBound = true;
  window.addEventListener("resize", () => syncAllPlanModulosGrids());
}
