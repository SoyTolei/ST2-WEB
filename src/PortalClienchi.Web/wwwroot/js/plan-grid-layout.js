/** Ajusta columnas del grid según cuántos módulos visibles hay (simetría por perfil). */
export function syncPlanModulosGridLayout(grid, { maxCols = 3 } = {}) {
  if (!grid) return;
  const visible = [...grid.children].filter((el) => !el.classList.contains("hidden"));
  const n = visible.length;
  const cap = grid.classList.contains("is-compact") ? Math.min(maxCols, 2) : maxCols;

  if (!n) {
    grid.style.removeProperty("grid-template-columns");
    grid.style.removeProperty("justify-content");
    return;
  }

  const cols = Math.min(cap, n);
  if (n === 1) {
    grid.style.gridTemplateColumns = "minmax(180px, 280px)";
    grid.style.justifyContent = "center";
    return;
  }

  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  grid.style.justifyContent = n < cap ? "center" : "";
}

export function syncAllPlanModulosGrids() {
  document.querySelectorAll(".plan-modulos-grid").forEach((grid) => {
    syncPlanModulosGridLayout(grid, { maxCols: grid.classList.contains("plan-chile-soporte-grid") ? 3 : 3 });
  });
}
