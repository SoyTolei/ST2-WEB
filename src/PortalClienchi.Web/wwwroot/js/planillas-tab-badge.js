/** Badge unificado de la pestaña Sistema de Planillas (blanqueo + borrado). */

const state = {
  blanqueo: { count: 0, title: "", hidden: true },
  borrado: { count: 0, title: "", hidden: true },
};

export function setPlanillasTabAlertPart(source, { count = 0, title = "", hidden = false } = {}) {
  if (source !== "blanqueo" && source !== "borrado") return;
  state[source] = {
    count: Math.max(0, Number(count) || 0),
    title: String(title || ""),
    hidden: !!hidden,
  };
  syncPlanillasTabBadge();
}

function syncPlanillasTabBadge() {
  const badge = document.querySelector('.tab-reminder-badge[data-reminder="planillas"]');
  if (!badge) return;

  const parts = [];
  let total = 0;
  for (const key of ["blanqueo", "borrado"]) {
    const part = state[key];
    if (part.hidden || part.count <= 0) continue;
    total += part.count;
    if (part.title) parts.push(part.title);
  }

  const label = total > 99 ? "99+" : String(total);
  const show = total > 0;
  badge.textContent = label;
  badge.classList.toggle("hidden", !show);
  badge.title = parts.join(" · ");
  badge.setAttribute("aria-hidden", show ? "false" : "true");
}
