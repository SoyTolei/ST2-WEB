export function updatePlanBuildBadge(webBuild) {
  const build = webBuild || "";
  const short = build.length > 7 ? build.slice(0, 7) : build;
  const label = short ? `web ${short}` : "";
  document.querySelectorAll("[data-plan-build]").forEach((el) => {
    el.textContent = label;
    el.classList.toggle("hidden", !label);
    el.title = build ? `Versión desplegada: ${build}` : "";
  });
}
