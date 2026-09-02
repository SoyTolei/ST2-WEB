import { planTextPreviewHtml, planFormActionsHtml, showPlanTextPreview, clearPlanTextPreview, mountPlanTextPreview } from "./plan-text-preview.js";
import { injectModuleHeaders } from "./planillas-icons.js";
import { canSeeLegalProduct } from "./module-access.js";
import { syncPlanModulosGridLayout } from "./plan-grid-layout.js";

const LEGAL_ICONS = {
  briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
  diagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M12 8v4M8.5 14.5 10 12M15.5 14.5 14 12"/></svg>',
  scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M12 3v18M5 7h14M7 7l-2 6h4L7 7zM17 7l-2 6h4L17 7z"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M12 3l1.2 4.2L17 8.5l-3.8 1.3L12 14l-1.2-4.2L7 8.5l3.8-1.3L12 3z"/><path d="M5 16l.8 2.8L8.5 20l-2.7.9L5 23.5l-.8-2.6L1.5 20l2.7-.9L5 16z"/><path d="M19 14l.8 2.8L22.5 18l-2.7.9L19 21.5l-.8-2.6L15.5 18l2.7-.9L19 14z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2"/></svg>',
  bug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M8 8a4 4 0 0 1 8 0M5 12h3M16 12h3M6 16h12"/></svg>',
};

const LEGAL_ESCALAMIENTO_LABEL = "Escalamiento a N2/N3";

const LEGAL_SECTION_LABELS = {
  descripcion: "Descripción del caso",
  checklist: "Checklist",
  adjuntos: "Adjuntos y evidencias",
  found: "Resultado encontrado",
  expected: "Resultado esperado",
};

const LEGAL_EVID_ACCEPT = "image/*,.mp4,.webm,video/mp4,video/webm,.pdf,application/pdf,.txt,text/plain,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,.xml,application/xml,text/xml,.log,.har,application/json";

let hubCtx = null;
let templatesCatalog = null;
let openedFromMenu = false;
let legalHubEventsBound = false;
let legalHubEvidenciaFiles = [];
let navStack = { product: null, item: null, category: null, template: null };

const LEGAL_PRODUCT_BTN_CLASS = {
  firm: "legal-one",
  highq: "highq",
  westlaw: "westlaw",
  cocounsel: "cocounsel",
};

const LEGAL_CATALOG_PRODUCT_MAP = {
  firm: "legal-one",
  highq: "highq",
  westlaw: "westlaw",
  cocounsel: "cocounsel",
};

function icon(name) {
  return LEGAL_ICONS[name] || LEGAL_ICONS.gear;
}

function hideAllLegalViews() {
  ["ref-legal-hub", "ref-legal-templates", "ref-legal-form"].forEach((id) => {
    document.getElementById(id)?.classList.add("hidden");
  });
}

function showView(id) {
  hideAllLegalViews();
  document.getElementById(id)?.classList.remove("hidden");
}

async function ensureCatalog() {
  if (templatesCatalog) return templatesCatalog;
  const url = hubCtx?.getConfig()?.legal?.templatesCatalogUrl || "/data/legalone-templates-catalog.json";
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo cargar el catálogo de plantillas LEGAL.");
  templatesCatalog = await res.json();
  return templatesCatalog;
}

function resolveCatalogProductId(hubProduct) {
  return hubProduct?.catalogProductId || LEGAL_CATALOG_PRODUCT_MAP[hubProduct?.id] || hubProduct?.id;
}

function resolveCatalogCategoryId(hubProduct, hubItem) {
  if (hubItem?.catalogCategoryId) return hubItem.catalogCategoryId;
  return "general";
}

function showHubStatus(msg, isError = false) {
  const el = document.getElementById("ref-legal-hub-status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("error", isError);
}

function findHubProduct(productId) {
  return hubCtx?.getConfig()?.legal?.referralHub?.find((p) => p.id === productId);
}

function findCatalogCategory(catalogProductId, categoryId) {
  const product = templatesCatalog?.products?.find((p) => p.id === catalogProductId);
  return product?.categories?.find((c) => c.id === categoryId);
}

function visibleLegalCatalog(catalog) {
  return (catalog || []).filter((product) => canSeeLegalProduct(product.id));
}

function renderProductButtons(catalog, attrName) {
  return visibleLegalCatalog(catalog).map((product) => `
    <button type="button" class="plan-modulo-btn plan-legal-product-btn ${LEGAL_PRODUCT_BTN_CLASS[product.id] || "referral"}" ${attrName}="${product.id}">
      <span class="plan-modulo-icon" aria-hidden="true">${icon(product.icon)}</span>
      <span class="plan-modulo-copy">
        <span class="plan-modulo-label">${product.label}</span>
        <span class="plan-modulo-sub">${LEGAL_ESCALAMIENTO_LABEL}</span>
      </span>
    </button>
  `).join("");
}

function renderHub() {
  const root = document.getElementById("ref-legal-hub-root");
  const catalog = hubCtx?.getConfig()?.legal?.referralHub;
  if (!root || !catalog?.length) return;
  const visible = visibleLegalCatalog(catalog);
  if (!visible.length) {
    root.innerHTML = "";
    return;
  }
  root.innerHTML = `
    <div class="plan-modulos-well plan-legal-products-well">
      <div class="plan-modulos-grid plan-legal-products-grid">
        ${renderProductButtons(catalog, "data-legal-product")}
      </div>
    </div>
  `;
  syncPlanModulosGridLayout(root.querySelector(".plan-legal-products-grid"));
}

export function syncLegalMenuProducts() {
  const root = document.getElementById("plan-legal-menu-products");
  const wrap = document.getElementById("plan-legal-products-wrap");
  const catalog = hubCtx?.getConfig()?.legal?.referralHub;
  if (!root || !catalog?.length) return;
  const visible = visibleLegalCatalog(catalog);
  root.innerHTML = renderProductButtons(catalog, "data-legal-menu-product");
  const show = visible.length > 0;
  wrap?.classList.toggle("hidden", !show);
  wrap?.toggleAttribute("hidden", !show);
  wrap?.setAttribute("aria-hidden", show ? "false" : "true");
  syncPlanModulosGridLayout(root);
}

function showHub() {
  showView("ref-legal-hub");
  renderHub();
  showHubStatus("");
}

function showTemplateCards(product, item, category, templates) {
  showHubStatus("");
  navStack = { product, item, category, template: null };
  showView("ref-legal-templates");
  const crumb = document.getElementById("ref-legal-templates-breadcrumb");
  if (crumb) crumb.textContent = `${product.label} › ${item.label}`;
  const root = document.getElementById("ref-legal-templates-root");
  if (!root) return;
  root.innerHTML = templates.map((tpl) => `
    <button type="button" class="plan-adj-card" data-legal-template-id="${tpl.id}">
      <span class="plan-legal-pick-label">${icon(item.icon)}<span>${tpl.label}</span></span>
      <span class="card-mark">›</span>
    </button>
  `).join("");
}

function fieldKey(field, index) {
  return field.id || `field_${index}`;
}

function fieldLabel(field, index) {
  return (field.label || field.placeholder || `Campo ${index + 1}`).replace(/\*+$/, "").trim();
}

function fieldRequired(field) {
  return field.label?.includes("*") || field.required === true;
}

function renderField(field, index) {
  if (field.type === "checkbox" && !field.label) return "";
  const key = fieldKey(field, index);
  const req = fieldRequired(field) ? " required" : "";
  const label = fieldLabel(field, index);
  if (field.type === "textarea") {
    return `<div class="plan-field"><label for="${key}">${label}</label><textarea id="${key}" data-legal-field rows="4" placeholder="${field.placeholder || ""}"${req}></textarea></div>`;
  }
  if (field.type === "select") {
    const options = (field.options || []).map((opt) => `<option value="${opt}">${opt}</option>`).join("");
    return `<div class="plan-field"><label for="${key}">${label}</label><select id="${key}" data-legal-field${req}><option value="">Seleccionar…</option>${options}</select></div>`;
  }
  if (field.type === "file") {
    return `
      <div class="plan-field plan-legal-file-field" data-legal-file-field="${key}">
        <label>${label}</label>
        <div class="plan-capturas-panel">
          <p class="plan-capturas-hint">Screenshots, videos, PDF, TXT, logs o HAR. Se suben al generar la vista previa.</p>
          <div class="plan-capturas-actions">
            <button type="button" id="ref-legal-hub-evid-agregar" class="plan-capturas-browse">
              <span class="plan-capturas-browse-icon" aria-hidden="true">🖼</span>
              <span class="plan-capturas-browse-text">
                <strong>Examinar archivos</strong>
                <small>Imágenes, video, PDF, TXT, Excel, XML, log o HAR</small>
              </span>
            </button>
            <input id="ref-legal-hub-evid-input" type="file" accept="${LEGAL_EVID_ACCEPT}" multiple class="hidden"/>
          </div>
          <div id="ref-legal-hub-evid-chips" class="plan-capturas-thumbs"></div>
          <p id="ref-legal-hub-evid-estado" class="plan-capturas-estado"></p>
        </div>
      </div>`;
  }
  const type = field.type === "checkbox" ? "checkbox" : "text";
  if (type === "checkbox") {
    return `<label class="plan-field plan-legal-check"><input id="${key}" data-legal-field type="checkbox"/> ${label}</label>`;
  }
  return `<div class="plan-field"><label for="${key}">${label}</label><input id="${key}" data-legal-field type="text" placeholder="${field.placeholder || ""}"${req}/></div>`;
}

function renderTemplateFields(template) {
  let html = "";
  let lastSection = "";
  (template.fields || []).forEach((field, index) => {
    if (field.section && field.section !== lastSection) {
      const title = LEGAL_SECTION_LABELS[field.section] || field.section;
      html += `<p class="plan-ref-section-title">${title}</p>`;
      lastSection = field.section;
    }
    html += renderField(field, index);
  });
  return html;
}

function refreshLegalEvidenciaEstado() {
  const estado = document.getElementById("ref-legal-hub-evid-estado");
  if (!estado) return;
  if (!legalHubEvidenciaFiles.length) {
    estado.textContent = "";
    return;
  }
  estado.textContent = `${legalHubEvidenciaFiles.length} archivo(s) listo(s) para subir al generar la planilla.`;
}

function refreshLegalEvidenciaChips() {
  const chips = document.getElementById("ref-legal-hub-evid-chips");
  if (!chips) return;
  chips.innerHTML = legalHubEvidenciaFiles.map((file, index) => `
    <span class="plan-captura-chip">
      <span class="plan-captura-chip-name">${file.name}</span>
      <button type="button" class="plan-captura-chip-remove" data-legal-evid-remove="${index}" aria-label="Quitar ${file.name}">×</button>
    </span>
  `).join("");
  chips.querySelectorAll("[data-legal-evid-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.legalEvidRemove);
      if (!Number.isNaN(idx)) {
        legalHubEvidenciaFiles.splice(idx, 1);
        refreshLegalEvidenciaChips();
        refreshLegalEvidenciaEstado();
      }
    });
  });
}

function setupLegalEvidenciasPanel() {
  legalHubEvidenciaFiles = [];
  const input = document.getElementById("ref-legal-hub-evid-input");
  const agregar = document.getElementById("ref-legal-hub-evid-agregar");
  if (!input || !agregar) return;
  agregar.addEventListener("click", () => input.click());
  input.addEventListener("change", (e) => {
    const incoming = Array.from(e.target.files || []);
    for (const file of incoming) {
      if (!legalHubEvidenciaFiles.some((f) => f.name === file.name && f.size === file.size)) {
        legalHubEvidenciaFiles.push(file);
      }
    }
    refreshLegalEvidenciaChips();
    refreshLegalEvidenciaEstado();
    e.target.value = "";
  });
  refreshLegalEvidenciaChips();
  refreshLegalEvidenciaEstado();
}

async function uploadLegalEvidencias(files) {
  if (!files.length) return [];
  const form = new FormData();
  files.forEach((f) => form.append("capturas", f, f.name || "evidencia"));
  const response = await fetch("/api/planillas/capturas/upload", { method: "POST", body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.error || data.title || "Error al subir evidencias");
  }
  return (data.enlaces || []).filter((e) => e?.url);
}

function collectValuesById(template) {
  const values = {};
  (template.fields || []).forEach((field, index) => {
    if (field.type === "checkbox" && !field.label) return;
    if (field.type === "file") return;
    const el = document.getElementById(fieldKey(field, index));
    if (!el) return;
    const key = field.id || fieldKey(field, index);
    values[key] = field.type === "checkbox" ? (el.checked ? "Sí" : "No") : String(el.value || "").trim();
  });
  return values;
}

function validateTemplate(template) {
  const missing = [];
  (template.fields || []).forEach((field, index) => {
    if (field.type === "file" || field.type === "checkbox") return;
    if (!fieldRequired(field)) return;
    const el = document.getElementById(fieldKey(field, index));
    const val = field.type === "checkbox" ? (el?.checked ? "Sí" : "") : String(el?.value || "").trim();
    if (!val) missing.push(fieldLabel(field, index));
  });
  return missing;
}

function formatStepsBlock(pasos, url) {
  const lines = [];
  const raw = String(pasos || "").trim();
  if (!raw) {
    if (url) lines.push(`- Acceder al sitio: ${url}`);
    return lines.join("\n");
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    lines.push(trimmed.startsWith("-") ? trimmed : `- ${trimmed}`);
  }
  return lines.join("\n");
}

function buildHighqN2Text(values, evidenciaEnlaces = []) {
  const v = (id) => String(values[id] || "").trim();
  const hasEvidencias = evidenciaEnlaces.length > 0 || legalHubEvidenciaFiles.length > 0;
  const evidenciasChecklist = hasEvidencias ? "Sí" : "No";
  const lines = [];

  lines.push("DESCRIPCIÓN/ASUNTO:");
  lines.push(v("asunto") || "—");
  if (v("descripcion")) {
    lines.push("");
    lines.push(v("descripcion"));
  }
  lines.push("");
  lines.push("CHECKLIST:");
  lines.push(`1. URL del cliente: ${v("url") || "—"}`);
  lines.push(`2. Usuario creado para N2: ${v("usuarioN2") || "—"}`);
  lines.push(`3. ¿Afecta usuario específico?: ${v("afectaUsuario") || "No"}`);
  lines.push(`4. Frecuencia: ${v("frecuencia") || "—"}`);
  lines.push(`5. Archivo HAR adjunto: ${v("har") || "—"}`);
  lines.push(`6. Template del sitio adjunto: ${v("templateSitio") || "—"}`);
  lines.push(`7. Template iSheet adjunto: ${v("templateISheet") || "—"}`);
  lines.push(`8. Evidencias visuales: ${evidenciasChecklist}`);
  lines.push("");
  lines.push("STEPS:");
  lines.push(formatStepsBlock(v("pasos"), v("url")) || "—");
  lines.push("");
  lines.push("FOUND RESULT:");
  lines.push(v("found") || "—");
  lines.push(`Evidencias: ${hasEvidencias ? "Ver screenshots adjuntos" : "No"}`);
  lines.push("");
  lines.push("EXPECTED RESULT:");
  lines.push(v("expected") || "—");
  lines.push("");
  lines.push("ADJUNTOS/EVIDENCIAS:");
  if (evidenciaEnlaces.length) {
    evidenciaEnlaces.forEach((item) => {
      const name = item?.nombre || item?.name || "Archivo";
      const url = item?.url || "";
      lines.push(url ? `- ${name}: ${url}` : `- ${name}`);
    });
  } else if (legalHubEvidenciaFiles.length) {
    legalHubEvidenciaFiles.forEach((file) => lines.push(`- ${file.name}`));
  } else {
    lines.push("- Sin archivos adjuntos");
  }
  return lines.join("\n");
}

function showTemplateForm(product, item, template) {
  navStack = { ...navStack, product, item, template };
  showView("ref-legal-form");
  const crumb = document.getElementById("ref-legal-form-breadcrumb");
  if (crumb) crumb.textContent = `${product.label} › ${LEGAL_ESCALAMIENTO_LABEL}`;
  const titleEl = document.getElementById("plan-referral-module-title");
  if (titleEl) titleEl.textContent = product.label;
  document.title = `ST² · ${product.label}`;
  const root = document.getElementById("ref-legal-form-root");
  if (!root) return;

  const blocks = (template.blocks || []).map((b) => `<p class="plan-ref-hint">${b}</p>`).join("");
  const fields = renderTemplateFields(template);

  root.innerHTML = `
    <div class="plan-well-box plan-legal-form-panel">
      <p class="plan-ref-title">${template.title || template.label}</p>
      ${blocks}
      <form id="ref-legal-template-form" class="plan-form-grid" autocomplete="off">${fields}</form>
      ${planFormActionsHtml({
        copyId: "ref-legal-btn-copiar",
        previewId: "ref-legal-btn-ver-planilla",
        clearId: "ref-legal-btn-limpar",
      })}
      ${planTextPreviewHtml("ref-legal-text-preview", "ref-legal-form-status")}
      <p id="ref-legal-form-status" class="plan-status-bar"></p>
    </div>
  `;

  document.getElementById("ref-legal-btn-limpar")?.addEventListener("click", () => {
    document.getElementById("ref-legal-template-form")?.reset();
    legalHubEvidenciaFiles = [];
    refreshLegalEvidenciaChips();
    refreshLegalEvidenciaEstado();
    clearPlanTextPreview("ref-legal-text-preview");
    setStatus("");
  });

  setupLegalEvidenciasPanel();
  mountPlanTextPreview("ref-legal-text-preview");
  injectModuleHeaders();

  const runGenerate = async ({ copy = false } = {}) => {
    const missing = validateTemplate(template);
    if (missing.length) {
      setStatus(`Completá los campos obligatorios: ${missing.join(", ")}.`, true);
      return "";
    }
    const btnPreview = document.getElementById("ref-legal-btn-ver-planilla");
    const btnCopy = document.getElementById("ref-legal-btn-copiar");
    try {
      if (btnPreview) btnPreview.disabled = true;
      if (btnCopy) btnCopy.disabled = true;
      if (legalHubEvidenciaFiles.length) setStatus("Subiendo evidencias…");
      const evidenciaEnlaces = await uploadLegalEvidencias(legalHubEvidenciaFiles);
      const text = await buildTemplateTextAsync(template, product.label, evidenciaEnlaces);
      if (!text) return "";
      if (copy) {
        await navigator.clipboard.writeText(text);
        setStatus("Texto copiado al portapapeles.");
      } else {
        showPlanTextPreview("ref-legal-text-preview", text);
        setStatus("Planilla lista. Podés copiar desde el panel de vista previa.");
      }
      return text;
    } catch (err) {
      console.error(err);
      setStatus(err?.message || "No se pudo generar la planilla.", true);
      return "";
    } finally {
      if (btnPreview) btnPreview.disabled = false;
      if (btnCopy) btnCopy.disabled = false;
    }
  };

  document.getElementById("ref-legal-btn-ver-planilla")?.addEventListener("click", () => {
    void runGenerate();
  });
  document.getElementById("ref-legal-btn-copiar")?.addEventListener("click", () => {
    void runGenerate({ copy: true });
  });
}

function collectValues(template) {
  const values = [];
  (template.fields || []).forEach((field, index) => {
    if (field.type === "checkbox" && !field.label) return;
    const el = document.getElementById(fieldKey(field, index));
    if (!el) return;
    let val = field.type === "checkbox" ? (el.checked ? "Sí" : "No") : el.value.trim();
    if (!val && field.type === "checkbox") return;
    values.push({
      label: (field.label || field.placeholder || "").replace(/\*+$/, "").trim(),
      value: val,
    });
  });
  return values;
}

async function buildTemplateTextAsync(template, productLabel = "", evidenciaEnlaces = []) {
  if (template.outputFormat === "highq-n2") {
    return buildHighqN2Text(collectValuesById(template), evidenciaEnlaces);
  }
  return buildTemplateText(template, productLabel);
}

function buildTemplateText(template, productLabel = "") {
  const values = collectValues(template);
  const lines = [];
  lines.push("==========================================");
  lines.push("DATOS DEL CLIENTE 🪪");
  if (productLabel) lines.push(`PRODUCTO: ${productLabel.trim().toUpperCase()}`);
  lines.push(`TIPO DE ESCALAMIENTO: ${LEGAL_ESCALAMIENTO_LABEL.toUpperCase()}`);
  lines.push("==========================================");
  lines.push("DETALLES DEL CASO 📝");
  lines.push("");
  for (const { label, value } of values) {
    if (!value) continue;
    if (label) {
      lines.push(`${label.trim().toUpperCase()}: ${value}`);
    } else {
      lines.push(value);
    }
  }
  lines.push("");
  lines.push("==========================================");
  lines.push("INFORMACIÓN ADICIONAL");
  lines.push("");
  lines.push("==========================================");
  return lines.join("\n");
}

function setStatus(msg, isError = false) {
  const el = document.getElementById("ref-legal-form-status");
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle("error", isError);
}

function resolveTemplate(category, hubItem) {
  return category.templates.find((t) => t.id === hubItem.id)
    || category.templates.find((t) => t.label?.toLowerCase() === hubItem.label?.toLowerCase())
    || category.templates[0];
}

async function onHubItemPick(productId, itemId, { fromMenu = false } = {}) {
  try {
    openedFromMenu = !!fromMenu;
    showHubStatus("Cargando plantilla…");
    await ensureCatalog();
    const hubProduct = findHubProduct(productId);
    const hubItem = hubProduct?.items?.find((i) => i.id === itemId);
    if (!hubProduct || !hubItem) {
      showHubStatus("No se encontró el producto seleccionado.", true);
      return;
    }

    const catalogProductId = resolveCatalogProductId(hubProduct);
    const categoryId = resolveCatalogCategoryId(hubProduct, hubItem);
    const category = findCatalogCategory(catalogProductId, categoryId);
    if (!category?.templates?.length) {
      showHubStatus(`Sin plantillas para ${hubProduct.label}.`, true);
      return;
    }

    const product = { id: productId, label: hubProduct.label };
    const item = { id: itemId, label: hubItem.label, icon: hubItem.icon };
    const tpl = resolveTemplate(category, hubItem);
    if (!tpl) {
      showHubStatus("No se encontró la plantilla de escalamiento.", true);
      return;
    }
    showTemplateForm(product, item, tpl);
  } catch (err) {
    console.error(err);
    showHubStatus(err?.message || "Error al cargar plantillas LEGAL.", true);
  }
}

function bindHubEvents() {
  if (legalHubEventsBound) return;
  legalHubEventsBound = true;

  document.addEventListener("click", (e) => {
    const menuBtn = e.target.closest("[data-legal-menu-product]");
    if (menuBtn) {
      if (!canSeeLegalProduct(menuBtn.dataset.legalMenuProduct)) return;
      hubCtx?.openLegalProduct?.(menuBtn.dataset.legalMenuProduct);
      return;
    }
    const hubBtn = e.target.closest("[data-legal-product]");
    if (!hubBtn) return;
    if (!canSeeLegalProduct(hubBtn.dataset.legalProduct)) return;
    const hubProduct = findHubProduct(hubBtn.dataset.legalProduct);
    const bugItem = hubProduct?.items?.[0];
    if (bugItem) void onHubItemPick(hubBtn.dataset.legalProduct, bugItem.id);
  });

  document.getElementById("ref-legal-templates-root")?.addEventListener("click", async (e) => {
    const card = e.target.closest("[data-legal-template-id]");
    if (!card) return;
    await ensureCatalog();
    const hubProduct = findHubProduct(navStack.product?.id);
    const hubItem = hubProduct?.items?.find((i) => i.id === navStack.item?.id);
    const category = findCatalogCategory(
      resolveCatalogProductId(hubProduct),
      resolveCatalogCategoryId(hubProduct, hubItem),
    );
    const tpl = category?.templates?.find((t) => t.id === card.dataset.legalTemplateId);
    if (tpl) showTemplateForm(navStack.product, navStack.item, tpl);
  });
}

export function handleLegalReferralBack() {
  const formVisible = !document.getElementById("ref-legal-form")?.classList.contains("hidden");
  const hubVisible = !document.getElementById("ref-legal-hub")?.classList.contains("hidden");

  if (formVisible) {
    if (openedFromMenu) {
      openedFromMenu = false;
      hubCtx?.goPlanillasMenu?.();
      return true;
    }
    showHub();
    return true;
  }

  if (hubVisible) {
    hubCtx?.goPlanillasMenu?.();
    return true;
  }

  return false;
}

export function initLegalReferralHub(context) {
  hubCtx = context;
  bindHubEvents();
}

export function openLegalProduct(productId) {
  if (!canSeeLegalProduct(productId)) return Promise.resolve();
  openedFromMenu = true;
  navStack = { product: null, item: null, category: null, template: null };
  const hubProduct = findHubProduct(productId);
  const bugItem = hubProduct?.items?.[0];
  if (!hubProduct || !bugItem) return Promise.resolve();
  return onHubItemPick(productId, bugItem.id, { fromMenu: true });
}

export function openLegalReferralHub() {
  navStack = { product: null, item: null, category: null, template: null };
  templatesCatalog = null;
  showHub();
  void ensureCatalog().catch((err) => showHubStatus(err?.message || "Error al cargar catálogo.", true));
}

export function resetLegalReferralHub() {
  openedFromMenu = false;
  legalHubEvidenciaFiles = [];
  navStack = { product: null, item: null, category: null, template: null };
  hideAllLegalViews();
}

export function getLegalReferralSelection() {
  return navStack.template ? { ...navStack } : null;
}
