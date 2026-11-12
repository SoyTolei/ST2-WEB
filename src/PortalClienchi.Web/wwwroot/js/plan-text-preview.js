import { injectModuleHeaders } from "./planillas-icons.js";
import { bindPlanActionFx } from "./plan-action-fx.js?v=20261113c";

/** Por elemento: los formularios Legal se re-renderizan y el panel nuevo tiene que volver a enlazarse. */
const bound = new WeakSet();

export function planFormActionsHtml({
  copyId,
  previewId,
  clearId,
  clearLabel = "Limpiar",
}) {
  return `
    <div class="plan-ref-actions">
      <button type="button" id="${copyId}" class="plan-action-btn green" data-plan-fx="tap" aria-label="Copiar">
        <span class="plan-action-btn-main">Copiar</span>
      </button>
      <button type="button" id="${previewId}" class="plan-action-btn blue" data-plan-fx="tap" aria-label="Ver planilla">
        <span class="plan-action-btn-main">Ver planilla</span>
      </button>
      <button type="button" id="${clearId}" class="plan-action-btn ghost" data-plan-fx="fuse" aria-label="${clearLabel.replace(/^🗑\s*/, "")}">
        <span class="plan-action-btn-main">${clearLabel.replace(/^🗑\s*/, "")}</span>
      </button>
    </div>
  `;
}

export function planTextPreviewHtml(panelId, statusTargetId = "") {
  const statusAttr = statusTargetId ? ` data-status-target="${statusTargetId}"` : "";
  return `
    <div id="${panelId}" class="plan-text-preview hidden"${statusAttr}>
      <div class="plan-text-preview-head">
        <p class="plan-text-preview-title">
          <span class="plan-text-preview-icon" data-plan-icon="previewDoc" aria-hidden="true"></span>
          Vista previa de la planilla
        </p>
        <button type="button" class="plan-text-preview-copy" data-plan-preview-copy data-plan-fx="tap" aria-label="Copiar">
          Copiar
        </button>
      </div>
      <pre class="plan-text-preview-body" data-plan-preview-text></pre>
    </div>
  `;
}

function getPanel(panelId) {
  return typeof panelId === "string" ? document.getElementById(panelId) : panelId;
}

export function mountPlanTextPreview(panelId) {
  const root = getPanel(panelId);
  if (!root || bound.has(root)) return root;
  bound.add(root);

  const copyBtn = root.querySelector("[data-plan-preview-copy]");
  if (copyBtn) {
    bindPlanActionFx(copyBtn, "tap", () => copyPlanTextPreview(root.id), {
      compact: true,
      label: "Copiar",
      successLabel: "¡Copiado!",
    });
  }

  injectModuleHeaders();
  return root;
}

export async function copyPlanTextPreview(panelId, statusMessage = "Copiado al portapapeles.") {
  const root = getPanel(panelId);
  if (!root) return false;
  const text = root.querySelector("[data-plan-preview-text]")?.textContent || "";
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    const statusId = root.dataset.statusTarget;
    const statusEl = statusId ? document.getElementById(statusId) : null;
    if (statusEl) statusEl.textContent = statusMessage;
    return true;
  } catch {
    const statusId = root.dataset.statusTarget;
    const statusEl = statusId ? document.getElementById(statusId) : null;
    if (statusEl) {
      statusEl.textContent = "No se pudo copiar.";
      statusEl.classList.add("error");
    }
    return false;
  }
}

export function showPlanTextPreview(panelId, text, { scroll = true } = {}) {
  const root = mountPlanTextPreview(panelId);
  if (!root) return;
  const pre = root.querySelector("[data-plan-preview-text]");
  if (pre) pre.textContent = text || "";
  root.classList.remove("hidden");
  if (scroll) {
    requestAnimationFrame(() => root.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }
}

export function hidePlanTextPreview(panelId) {
  getPanel(panelId)?.classList.add("hidden");
}

export function clearPlanTextPreview(panelId) {
  const root = getPanel(panelId);
  if (!root) return;
  const pre = root.querySelector("[data-plan-preview-text]");
  if (pre) pre.textContent = "";
  root.classList.add("hidden");
}
