import { injectModuleHeaders } from "./planillas-icons.js";

const bound = new Set();

export function planTextPreviewHtml(panelId, statusTargetId = "") {
  const statusAttr = statusTargetId ? ` data-status-target="${statusTargetId}"` : "";
  return `
    <div id="${panelId}" class="plan-text-preview hidden"${statusAttr}>
      <div class="plan-text-preview-head">
        <p class="plan-text-preview-title">
          <span class="plan-text-preview-icon" data-plan-icon="previewDoc" aria-hidden="true"></span>
          Vista previa de la planilla
        </p>
        <button type="button" class="plan-text-preview-copy" data-plan-preview-copy>
          <span class="plan-text-preview-copy-icon" data-plan-icon="clipboard" aria-hidden="true"></span>
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
  if (!root || bound.has(root.id)) return root;
  bound.add(root.id);

  const copyBtn = root.querySelector("[data-plan-preview-copy]");
  copyBtn?.addEventListener("click", () => {
    void copyPlanTextPreview(root.id);
  });

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

    const copyBtn = root.querySelector("[data-plan-preview-copy]");
    if (copyBtn) {
      const prev = copyBtn.innerHTML;
      copyBtn.innerHTML = "Copiado ✓";
      copyBtn.disabled = true;
      setTimeout(() => {
        copyBtn.innerHTML = prev;
        copyBtn.disabled = false;
        injectModuleHeaders();
      }, 1600);
    }
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
