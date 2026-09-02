import { planTextPreviewHtml, planFormActionsHtml, showPlanTextPreview, clearPlanTextPreview, mountPlanTextPreview } from "./plan-text-preview.js";
import { enhancePlanSelect } from "./plan-custom-select.js";
import { injectModuleHeaders } from "./planillas-icons.js";
import { canSeeLegalProduct } from "./module-access.js";
import { syncPlanModulosGridLayout } from "./plan-grid-layout.js";
import { normalizeOnedriveUrl, setupOnedrivePasteInput } from "./plan-onedrive-paste.js";

const LEGAL_ICONS = {
  briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
  diagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M12 8v4M8.5 14.5 10 12M15.5 14.5 14 12"/></svg>',
  scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M12 3v18M5 7h14M7 7l-2 6h4L7 7zM17 7l-2 6h4L17 7z"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M12 3l1.2 4.2L17 8.5l-3.8 1.3L12 14l-1.2-4.2L7 8.5l3.8-1.3L12 3z"/><path d="M5 16l.8 2.8L8.5 20l-2.7.9L5 23.5l-.8-2.6L1.5 20l2.7-.9L5 16z"/><path d="M19 14l.8 2.8L22.5 18l-2.7.9L19 21.5l-.8-2.6L15.5 18l2.7-.9L19 14z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2"/></svg>',
  bug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M8 8a4 4 0 0 1 8 0M5 12h3M16 12h3M6 16h12"/></svg>',
};

const LEGAL_ESCALAMIENTO_LABEL = "Escalamiento a N2/N3";

const LEGAL_N2_FORMATS = new Set(["highq-n2", "legal-one-n2", "westlaw-n2", "cocounsel-n2"]);

const LEGAL_SECTION_LABELS = {
  minimo: "Datos del entorno",
  descripcion: "Descripción y reproducción",
  resultados: "Resultados",
  recomendados: "Información adicional",
  opcionales: "Templates",
  acceso: "Datos de acceso",
  detalle: "Detalle del caso",
  checklist: "Checklist",
  adjuntos: "Evidencias visuales",
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

async function ensureCatalog(force = false) {
  if (templatesCatalog && !force) return templatesCatalog;
  const base = hubCtx?.getConfig()?.legal?.templatesCatalogUrl || "/data/legalone-templates-catalog.json?v=legal-westlaw-cocounsel";
  const url = base.includes("?") ? base : `${base}?v=legal-westlaw-cocounsel`;
  const res = await fetch(url, { cache: "no-store" });
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

function fieldTier(field, template) {
  if (field.tier) return field.tier;
  const id = field.id || "";
  if (template?.requiredFields?.includes(id)) return "required";
  if (template?.recommendedFields?.includes(id)) return "recommended";
  return "optional";
}

function fieldRequired(field, template) {
  return fieldTier(field, template) === "required"
    || field.label?.includes("*")
    || field.required === true;
}

function fieldShowWhenAttrs(field) {
  if (!field.showWhen?.field) return { attrs: "", hidden: false };
  const equals = field.showWhen.equals ?? "Sí";
  return {
    attrs: ` data-show-when-field="${field.showWhen.field}" data-show-when-value="${equals}"`,
    hidden: true,
  };
}

function fieldLabelHtml(field, index, template) {
  const label = fieldLabel(field, index);
  if (fieldTier(field, template) === "required") return `${label} *`;
  return label;
}

function renderField(field, index, template) {
  if (field.type === "checkbox" && !field.label) return "";
  const key = fieldKey(field, index);
  const req = LEGAL_N2_FORMATS.has(template?.outputFormat)
    ? ""
    : (fieldRequired(field, template) ? " required" : "");
  const labelHtml = fieldLabelHtml(field, index, template);
  const tier = fieldTier(field, template);
  const tierClass = tier ? ` plan-field-tier-${tier}` : "";
  const sectionAttr = field.section ? ` data-legal-section="${field.section}"` : "";
  const { attrs: showWhenAttrs, hidden: showWhenHidden } = fieldShowWhenAttrs(field);
  const hiddenClass = showWhenHidden ? " hidden" : "";
  const wrap = (inner) => `<div class="plan-field${tierClass}${hiddenClass}"${sectionAttr}${showWhenAttrs}>${inner}</div>`;
  if (field.type === "textarea") {
    return wrap(`<label for="${key}">${labelHtml}</label><textarea id="${key}" data-legal-field rows="4" placeholder="${field.placeholder || ""}"${req}></textarea>`);
  }
  if (field.type === "select") {
    const options = (field.options || []).map((opt) => `<option value="${opt}">${opt}</option>`).join("");
    return wrap(`<label for="${key}">${labelHtml}</label><select id="${key}" class="plan-select" data-legal-field${req}><option value="">Seleccionar…</option>${options}</select>`);
  }
  if (field.type === "onedrive-link") {
    const placeholder = field.placeholder || "Si subiste las evidencias a OneDrive, pegá el link compartido acá";
    const groupId = field.id || key;
    return `
      <div class="plan-field plan-legal-onedrive-field${hiddenClass}"${sectionAttr}${showWhenAttrs}>
        <div class="plan-legal-onedrive-list" data-onedrive-field="${groupId}" data-onedrive-placeholder="${placeholder}">
          <label>${labelHtml}</label>
          <div class="plan-legal-onedrive-rows">
            <div class="plan-legal-onedrive-row">
              <input data-onedrive-link data-onedrive-group="${groupId}" type="url" placeholder="${placeholder}" autocomplete="off"/>
            </div>
          </div>
          <button type="button" class="plan-legal-onedrive-add" data-onedrive-add="${groupId}" aria-label="Agregar otro link de OneDrive" title="Agregar otro link de OneDrive">+</button>
        </div>
      </div>`;
  }
  if (field.type === "file") {
    return `
      <div class="plan-field plan-legal-file-field plan-field-tier-${tier}${hiddenClass}"${sectionAttr}${showWhenAttrs}>
        <label>${labelHtml}</label>
        <div class="plan-capturas-panel plan-legal-evid-panel">
          <p class="plan-capturas-hint">Screenshots, videos o PDF. N2 ve exactamente qué le aparece al usuario.</p>
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
  if (field.type === "toggle-card") {
    return `
      <div class="plan-field plan-legal-toggle-field${hiddenClass}"${sectionAttr}${showWhenAttrs}>
        <button type="button" class="plan-adj-card plan-ticket-card plan-legal-toggle-card" data-legal-toggle="${key}" aria-pressed="false">
          <span>${labelHtml}</span>
          <span class="card-mark" data-legal-toggle-mark="${key}">○</span>
        </button>
        <input id="${key}" data-legal-field type="checkbox" class="hidden"/>
      </div>`;
  }
  const type = field.type === "checkbox" ? "checkbox" : "text";
  if (type === "checkbox") {
    return `<label class="plan-field plan-legal-check${tierClass}"${sectionAttr}><input id="${key}" data-legal-field type="checkbox"/> ${labelHtml}</label>`;
  }
  return wrap(`<label for="${key}">${labelHtml}</label><input id="${key}" data-legal-field type="text" placeholder="${field.placeholder || ""}"${req}/>`);
}

function renderTemplateFields(template) {
  const fields = template.fields || [];
  let html = "";
  let currentSection = null;

  const closeSection = () => {
    if (!currentSection) return;
    html += "</div></div>";
    currentSection = null;
  };

  const openSection = (sectionId) => {
    closeSection();
    currentSection = sectionId;
    const title = LEGAL_SECTION_LABELS[sectionId] || sectionId;
    const bodyClass = sectionId === "minimo" || sectionId === "recomendados" || sectionId === "opcionales"
      ? " plan-legal-checklist-grid"
      : "";
    html += `<div class="plan-legal-section" data-legal-section="${sectionId}">`;
    html += `<p class="plan-ref-title">${title}</p>`;
    html += `<div class="plan-legal-section-body${bodyClass}">`;
  };

  fields.forEach((field, index) => {
    if (field.section && field.section !== currentSection) openSection(field.section);
    else if (!field.section && currentSection) closeSection();
    html += renderField(field, index, template);
  });
  closeSection();
  return html;
}

function showLegalFormLoading(productLabel = "") {
  showView("ref-legal-form");
  const titleEl = document.getElementById("plan-referral-module-title");
  if (titleEl && productLabel) titleEl.textContent = productLabel;
  const root = document.getElementById("ref-legal-form-root");
  if (!root) return;
  root.classList.remove("is-ready");
  root.innerHTML = `
    <div class="plan-legal-inline-loading" aria-live="polite" aria-busy="true">
      <span class="plan-legal-inline-spinner" aria-hidden="true"></span>
      <span>Cargando plantilla…</span>
    </div>
  `;
}

function onedriveRowHtml(groupId, placeholder, removable = false) {
  return `
    <div class="plan-legal-onedrive-row">
      <input data-onedrive-link data-onedrive-group="${groupId}" type="url" placeholder="${placeholder}" autocomplete="off"/>
      ${removable ? '<button type="button" class="plan-legal-onedrive-remove" aria-label="Quitar link" title="Quitar link">×</button>' : ""}
    </div>`;
}

function collectOnedriveLinks(groupId) {
  return [...document.querySelectorAll(`[data-onedrive-group="${groupId}"]`)]
    .map((el) => normalizeOnedriveUrl(el.value))
    .filter(Boolean);
}

function resetLegalOnedriveLists() {
  document.querySelectorAll(".plan-legal-onedrive-list").forEach((list) => {
    const groupId = list.dataset.onedriveField;
    const placeholder = list.dataset.onedrivePlaceholder || "";
    const rows = list.querySelector(".plan-legal-onedrive-rows");
    if (!rows || !groupId) return;
    rows.innerHTML = onedriveRowHtml(groupId, placeholder, false);
    setupOnedrivePasteInput(rows.querySelector("input"));
  });
}

function setupLegalOnedriveLinks() {
  const form = document.getElementById("ref-legal-template-form");
  if (!form) return;

  form.addEventListener("click", (e) => {
    const addBtn = e.target.closest("[data-onedrive-add]");
    if (addBtn) {
      const groupId = addBtn.dataset.onedriveAdd;
      const list = addBtn.closest(".plan-legal-onedrive-list");
      const placeholder = list?.dataset.onedrivePlaceholder || "";
      const rows = list?.querySelector(".plan-legal-onedrive-rows");
      if (!rows || !groupId) return;
      const wrap = document.createElement("div");
      wrap.innerHTML = onedriveRowHtml(groupId, placeholder, true);
      const row = wrap.firstElementChild;
      if (!row) return;
      rows.appendChild(row);
      setupOnedrivePasteInput(row.querySelector("input"));
      row.querySelector("input")?.focus();
      return;
    }
    e.target.closest(".plan-legal-onedrive-remove")?.closest(".plan-legal-onedrive-row")?.remove();
  });

  form.querySelectorAll("[data-onedrive-link]").forEach(setupOnedrivePasteInput);
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
    if (field.type === "file" || field.type === "onedrive-link") return;
    const el = document.getElementById(fieldKey(field, index));
    if (!el) return;
    const key = field.id || fieldKey(field, index);
    values[key] = field.type === "checkbox" || field.type === "toggle-card"
      ? (el.checked ? "Sí" : "No")
      : String(el.value || "").trim();
  });
  return values;
}

function getRequiredFieldIds(template) {
  if (Array.isArray(template.requiredFields) && template.requiredFields.length) {
    return template.requiredFields.map(String);
  }
  const ids = [];
  (template.fields || []).forEach((field, index) => {
    if (field.type === "file" || field.type === "checkbox") return;
    if (!fieldRequired(field, template)) return;
    ids.push(field.id || fieldKey(field, index));
  });
  return ids;
}

function validateTemplate(template) {
  const requiredIds = new Set(getRequiredFieldIds(template));
  const missing = [];
  (template.fields || []).forEach((field, index) => {
    if (field.type === "file" || field.type === "checkbox") return;
    const key = field.id || fieldKey(field, index);
    if (!requiredIds.has(key)) return;
    const el = document.getElementById(fieldKey(field, index));
    const val = field.type === "checkbox" ? (el?.checked ? "Sí" : "") : String(el?.value || "").trim();
    if (!val) missing.push(fieldLabel(field, index));
  });
  return missing;
}

function mapHighqNa(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(n\/?a|na|n\.a\.?)$/i.test(text) || text === "N/A") return "No aplicable";
  return text;
}

function mapHighqAfectaUsuario(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^no$/i.test(text)) return "No";
  if (/^sí\b|^si\b/i.test(text)) return text.replace(/^si\b/i, "Sí");
  return `Sí - ${text}`;
}

function formatHighqSteps(pasos, url) {
  const raw = String(pasos || "").trim();
  if (!raw) return "";
  const lines = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    lines.push(trimmed.startsWith("-") ? trimmed : `- ${trimmed}`);
  }
  if (!lines.length && url) lines.push(`- Acceder al sitio: ${url}`);
  return lines.join("\n");
}

function evidenciaFileNames(evidenciaEnlaces = []) {
  if (evidenciaEnlaces.length) {
    return evidenciaEnlaces.map((item) => item?.nombre || item?.name || "archivo");
  }
  return legalHubEvidenciaFiles.map((file) => file.name);
}

function highqInforma(value) {
  const text = String(value || "").trim();
  return text || "No se informa";
}

function refreshConditionalFields() {
  const form = document.getElementById("ref-legal-template-form");
  if (!form) return;
  form.querySelectorAll("[data-show-when-field]").forEach((el) => {
    const driverId = el.dataset.showWhenField;
    const expected = el.dataset.showWhenValue || "Sí";
    const driver = document.getElementById(driverId);
    const val = String(driver?.value || "").trim();
    el.classList.toggle("hidden", val !== expected);
  });
}

function setupConditionalFields() {
  const form = document.getElementById("ref-legal-template-form");
  if (!form || form.dataset.conditionalBound) {
    refreshConditionalFields();
    return;
  }
  form.dataset.conditionalBound = "1";
  const drivers = new Set();
  form.querySelectorAll("[data-show-when-field]").forEach((el) => {
    drivers.add(el.dataset.showWhenField);
  });
  drivers.forEach((driverId) => {
    document.getElementById(driverId)?.addEventListener("change", refreshConditionalFields);
  });
  refreshConditionalFields();
}

function syncLegalToggleCards() {
  document.querySelectorAll("[data-legal-toggle]").forEach((btn) => {
    const key = btn.dataset.legalToggle;
    const input = document.getElementById(key);
    const mark = document.querySelector(`[data-legal-toggle-mark="${key}"]`);
    const on = !!input?.checked;
    btn.classList.toggle("selected", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    if (mark) mark.textContent = on ? "✓" : "○";
  });
}

function setupLegalToggleCards() {
  document.querySelectorAll("[data-legal-toggle]").forEach((btn) => {
    if (btn.dataset.toggleBound) return;
    btn.dataset.toggleBound = "1";
    const key = btn.dataset.legalToggle;
    const input = document.getElementById(key);
    btn.addEventListener("click", () => {
      if (input) input.checked = !input.checked;
      syncLegalToggleCards();
    });
  });
  syncLegalToggleCards();
}

function formatHighqUsuarioN2(values) {
  const n2 = String(values.usuarioN2 || "").trim();
  if (!n2 || /^no$/i.test(n2)) return "No se informa";
  if (/^s[ií]$/i.test(n2)) {
    const email = String(values.usuarioN2Email || "").trim();
    return email ? `Sí - ${email}` : "Sí - No se informa";
  }
  return highqInforma(n2);
}

function appendLegalReferralSection(lines, title) {
  lines.push("==========================================");
  lines.push(title);
}

function appendLegalReferralLine(lines, label, value) {
  lines.push(`${label}: ${highqInforma(value)}`);
}

function appendLegalReferralBlock(lines, label, value) {
  lines.push("");
  lines.push(`${label}:`);
  lines.push(highqInforma(value));
}

function buildLegalOnedriveAdjuntos(groupId = "evidencias") {
  const links = collectOnedriveLinks(groupId);
  if (!links.length) return ["- Evidencia OneDrive: No se informa"];
  return links.map((link, index) => (
    `- Evidencia OneDrive${links.length > 1 ? ` ${index + 1}` : ""}: ${link}`
  ));
}

function buildLegalReferralShell(productLabel, bodyLines, adjuntoLines = []) {
  const lines = [];
  appendLegalReferralSection(lines, "DATOS DEL SISTEMA 🖥️");
  lines.push("SISTEMA: LEGAL");
  lines.push(`PRODUCTO: ${String(productLabel || "LEGAL").trim().toUpperCase()}`);
  lines.push(`TIPO DE ESCALAMIENTO: ${LEGAL_ESCALAMIENTO_LABEL.toUpperCase()}`);
  lines.push("");
  appendLegalReferralSection(lines, "DETALLES DEL CASO 📝");
  lines.push("");
  lines.push(...bodyLines);
  lines.push("");
  appendLegalReferralSection(lines, "ADJUNTOS 🗃️");
  lines.push(...(adjuntoLines.length ? adjuntoLines : ["- No se informa"]));
  lines.push("==========================================");
  return lines.join("\n");
}

function buildLegalOneN2Text(values, productLabel = "Legal One") {
  const v = (id) => String(values[id] || "").trim();
  const body = [];
  appendLegalReferralLine(body, "URL", v("url"));
  appendLegalReferralLine(body, "LOGIN", v("login"));
  appendLegalReferralLine(body, "CONTRASEÑA", v("password"));
  appendLegalReferralBlock(body, "PASOS REALIZADOS", v("pasos"));
  appendLegalReferralBlock(body, "RESULTADO OBSERVADO", v("found"));
  appendLegalReferralBlock(body, "RESULTADO ESPERADO", v("expected"));
  return buildLegalReferralShell(productLabel, body, buildLegalOnedriveAdjuntos("evidencias"));
}

function buildWestlawN2Text(values, productLabel = "Westlaw") {
  const v = (id) => String(values[id] || "").trim();
  const body = [];
  appendLegalReferralLine(body, "MAIL REGISTRADO EN CIAM", v("mailCiam"));
  appendLegalReferralLine(body, "SAP ID", v("sapId"));
  appendLegalReferralLine(body, "MATERIALES SAP", v("materialesSap"));
  appendLegalReferralBlock(body, "DESCRIPCIÓN DE LA INCIDENCIA", v("descripcion"));
  appendLegalReferralBlock(body, "PASOS REALIZADOS", v("pasos"));
  appendLegalReferralBlock(body, "RESULTADO OBSERVADO", v("found"));
  appendLegalReferralBlock(body, "RESULTADO ESPERADO", v("expected"));
  return buildLegalReferralShell(productLabel, body, buildLegalOnedriveAdjuntos("evidencias"));
}

function buildCocounselN2Text(values, productLabel = "CoCounsel") {
  const v = (id) => String(values[id] || "").trim();
  const body = [];
  appendLegalReferralBlock(body, "DESCRIPCIÓN DE LA INCIDENCIA", v("descripcion"));
  appendLegalReferralBlock(body, "PASOS REALIZADOS", v("pasos"));
  appendLegalReferralBlock(body, "RESULTADO OBSERVADO", v("found"));
  appendLegalReferralBlock(body, "RESULTADO ESPERADO", v("expected"));
  return buildLegalReferralShell(productLabel, body, buildLegalOnedriveAdjuntos("evidencias"));
}

function buildHighqN2Text(values, evidenciaEnlaces = [], productLabel = "HighQ") {
  const v = (id) => String(values[id] || "").trim();
  const names = evidenciaFileNames(evidenciaEnlaces);
  const hasEvidencias = names.length > 0;

  const body = [];
  body.push(`DESCRIPCIÓN/ASUNTO: ${highqInforma(v("descripcion"))}`);
  body.push("");
  body.push("PASSO A PASSO/CHECKLIST:");
  body.push(`1. URL del cliente: ${highqInforma(v("url"))}`);
  body.push(`2. Usuario creado para N2: ${formatHighqUsuarioN2(values)}`);
  const afecta = mapHighqAfectaUsuario(v("afectaUsuario"));
  body.push(`3. ¿Problema ocurre solo con usuario específico?: ${afecta || "No se informa"}`);
  body.push(`4. Frecuencia: ${highqInforma(v("frecuencia"))}`);
  const har = v("har") ? (mapHighqNa(v("har")) || v("har")) : "No se informa";
  body.push(`5. Archivo HAR adjunto: ${har}`);
  const tplSitio = v("templateSitio") ? (mapHighqNa(v("templateSitio")) || v("templateSitio")) : "No se informa";
  const tplISheet = v("templateISheet") ? (mapHighqNa(v("templateISheet")) || v("templateISheet")) : "No se informa";
  body.push(`6. Template del sitio adjunto: ${tplSitio}`);
  body.push(`7. Template iSheet adjunto: ${tplISheet}`);
  body.push(`8. Evidencias visuales adjuntas: ${hasEvidencias ? `Sí - ${names.join(", ")}` : "No se informa"}`);
  body.push("");
  body.push("STEPS:");
  const steps = formatHighqSteps(v("pasos"), v("url"));
  body.push(steps || "No se informa");
  body.push("");
  body.push("FOUND RESULT:");
  if (v("found")) {
    body.push(v("found"));
    if (hasEvidencias) {
      body.push(`Evidencias: Ver ${names.join(", ")} adjunto${names.length === 1 ? "" : "s"}`);
    }
  } else {
    body.push("No se informa");
  }
  body.push("");
  body.push("EXPECTED RESULT:");
  body.push(highqInforma(v("expected")));

  const adjuntos = hasEvidencias
    ? names.map((name) => `- ${name}`)
    : ["- Evidencias visuales: No se informa"];
  return buildLegalReferralShell(productLabel, body, adjuntos);
}

function showTemplateForm(product, item, template) {
  navStack = { ...navStack, product, item, template };
  showView("ref-legal-form");
  const titleEl = document.getElementById("plan-referral-module-title");
  if (titleEl) titleEl.textContent = product.label;
  document.title = `ST² · ${product.label}`;
  const root = document.getElementById("ref-legal-form-root");
  if (!root) return;

  const blocks = (template.blocks || []).map((b) => `<p class="plan-ref-hint">${b}</p>`).join("");
  const fields = renderTemplateFields(template);

  root.innerHTML = `
    <div class="plan-legal-form-shell">
      ${blocks}
      <form id="ref-legal-template-form" class="plan-form-grid plan-legal-form-grid" autocomplete="off">${fields}</form>
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
    resetLegalOnedriveLists();
    refreshLegalEvidenciaChips();
    refreshLegalEvidenciaEstado();
    refreshConditionalFields();
    syncLegalToggleCards();
    clearPlanTextPreview("ref-legal-text-preview");
    setStatus("");
  });

  const hasFileEvidencias = (template.fields || []).some((field) => field.type === "file");
  if (hasFileEvidencias) setupLegalEvidenciasPanel();
  setupLegalOnedriveLinks();
  setupConditionalFields();
  setupLegalToggleCards();
  mountPlanTextPreview("ref-legal-text-preview");
  injectModuleHeaders();
  document.querySelectorAll("#ref-legal-template-form select.plan-select").forEach(enhancePlanSelect);
  requestAnimationFrame(() => root.classList.add("is-ready"));

  const runGenerate = async ({ copy = false } = {}) => {
    if (!LEGAL_N2_FORMATS.has(template.outputFormat)) {
      const missing = validateTemplate(template);
      if (missing.length) {
        setStatus(`Completá los campos obligatorios: ${missing.join(", ")}.`, true);
        return "";
      }
    }
    const btnPreview = document.getElementById("ref-legal-btn-ver-planilla");
    const btnCopy = document.getElementById("ref-legal-btn-copiar");
    try {
      if (btnPreview) btnPreview.disabled = true;
      if (btnCopy) btnCopy.disabled = true;
      const needsUpload = template.outputFormat === "highq-n2" && legalHubEvidenciaFiles.length;
      if (needsUpload) setStatus("Subiendo evidencias…");
      const evidenciaEnlaces = needsUpload ? await uploadLegalEvidencias(legalHubEvidenciaFiles) : [];
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
  const values = collectValuesById(template);
  if (template.outputFormat === "highq-n2") {
    return buildHighqN2Text(values, evidenciaEnlaces, productLabel);
  }
  if (template.outputFormat === "legal-one-n2") {
    return buildLegalOneN2Text(values, productLabel);
  }
  if (template.outputFormat === "westlaw-n2") {
    return buildWestlawN2Text(values, productLabel);
  }
  if (template.outputFormat === "cocounsel-n2") {
    return buildCocounselN2Text(values, productLabel);
  }
  return buildTemplateText(template, productLabel);
}

function buildTemplateText(template, productLabel = "") {
  const values = collectValues(template);
  const body = [];
  for (const { label, value } of values) {
    if (!value) continue;
    if (label) body.push(`${label.trim().toUpperCase()}: ${value}`);
    else body.push(value);
  }
  return buildLegalReferralShell(productLabel, body.length ? body : ["- No se informa"]);
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
    const hubProduct = findHubProduct(productId);
    const hubItem = hubProduct?.items?.find((i) => i.id === itemId);
    showLegalFormLoading(hubProduct?.label || "");
    showHubStatus("");
    await ensureCatalog();
    if (!hubProduct || !hubItem) {
      showHub();
      showHubStatus("No se encontró el producto seleccionado.", true);
      return;
    }

    const catalogProductId = resolveCatalogProductId(hubProduct);
    const categoryId = resolveCatalogCategoryId(hubProduct, hubItem);
    const category = findCatalogCategory(catalogProductId, categoryId);
    if (!category?.templates?.length) {
      showHub();
      showHubStatus(`Sin plantillas para ${hubProduct.label}.`, true);
      return;
    }

    const product = { id: productId, label: hubProduct.label };
    const item = { id: itemId, label: hubItem.label, icon: hubItem.icon };
    const tpl = resolveTemplate(category, hubItem);
    if (!tpl) {
      showHub();
      showHubStatus("No se encontró la plantilla de escalamiento.", true);
      return;
    }
    showTemplateForm(product, item, tpl);
  } catch (err) {
    console.error(err);
    showHub();
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

export function prefetchLegalCatalog() {
  if (!hubCtx) return Promise.resolve();
  return ensureCatalog().catch(() => {});
}

export function initLegalReferralHub(context) {
  hubCtx = context;
  bindHubEvents();
}

export function openLegalProduct(productId) {
  if (!canSeeLegalProduct(productId)) {
    openLegalReferralHub();
    showHubStatus("No tenés acceso a este producto LEGAL. Pedí el módulo HighQ en administración.", true);
    return Promise.resolve();
  }
  openedFromMenu = true;
  navStack = { product: null, item: null, category: null, template: null };
  const hubProduct = findHubProduct(productId);
  const bugItem = hubProduct?.items?.[0];
  if (!hubProduct || !bugItem) {
    openLegalReferralHub();
    showHubStatus("No se encontró la configuración del producto LEGAL.", true);
    return Promise.resolve();
  }
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
