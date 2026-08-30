import { planTextPreviewHtml, planFormActionsHtml, showPlanTextPreview, clearPlanTextPreview, mountPlanTextPreview } from "./plan-text-preview.js";
import { injectModuleHeaders } from "./planillas-icons.js";

const LEGAL_ICONS = {
  briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
  diagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M12 8v4M8.5 14.5 10 12M15.5 14.5 14 12"/></svg>',
  scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M12 3v18M5 7h14M7 7l-2 6h4L7 7zM17 7l-2 6h4L17 7z"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M12 3l1.2 4.2L17 8.5l-3.8 1.3L12 14l-1.2-4.2L7 8.5l3.8-1.3L12 3z"/><path d="M5 16l.8 2.8L8.5 20l-2.7.9L5 23.5l-.8-2.6L1.5 20l2.7-.9L5 16z"/><path d="M19 14l.8 2.8L22.5 18l-2.7.9L19 21.5l-.8-2.6L15.5 18l2.7-.9L19 14z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2"/></svg>',
  bug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M8 8a4 4 0 0 1 8 0M5 12h3M16 12h3M6 16h12"/></svg>',
};

const LEGAL_ESCALAMIENTO_LABEL = "Escalamiento a N2/N3";

const LEGAL_PRODUCT_BTN_CLASS = {
  firm: "legal-one",
  highq: "highq",
  westlaw: "westlaw",
  cocounsel: "cocounsel",
};

let hubCtx = null;
let templatesCatalog = null;
let openedFromMenu = false;
let legalHubEventsBound = false;
let navStack = { product: null, item: null, category: null, template: null };

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

function renderProductButtons(catalog, attrName) {
  return catalog.map((product) => `
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
  root.innerHTML = `
    <div class="plan-modulos-well plan-legal-products-well">
      <div class="plan-modulos-grid plan-legal-products-grid">
        ${renderProductButtons(catalog, "data-legal-product")}
      </div>
    </div>
  `;
}

export function syncLegalMenuProducts() {
  const root = document.getElementById("plan-legal-menu-products");
  const catalog = hubCtx?.getConfig()?.legal?.referralHub;
  if (!root || !catalog?.length) return;
  root.innerHTML = renderProductButtons(catalog, "data-legal-menu-product");
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

function renderField(field, index) {
  if (field.type === "checkbox" && !field.label) return "";
  const key = fieldKey(field, index);
  const req = field.label?.includes("*") ? " required" : "";
  const label = (field.label || field.placeholder || `Campo ${index + 1}`).replace(/\*+$/, "").trim();
  if (field.type === "textarea") {
    return `<div class="plan-field"><label for="${key}">${label}</label><textarea id="${key}" data-legal-field rows="4" placeholder="${field.placeholder || ""}"></textarea></div>`;
  }
  if (field.type === "select") {
    return `<div class="plan-field"><label for="${key}">${label}</label><input id="${key}" data-legal-field type="text" placeholder="${field.placeholder || "Seleccionar / escribir…"}"${req}/></div>`;
  }
  const type = field.type === "checkbox" ? "checkbox" : "text";
  if (type === "checkbox") {
    return `<label class="plan-field plan-legal-check"><input id="${key}" data-legal-field type="checkbox"/> ${label}</label>`;
  }
  return `<div class="plan-field"><label for="${key}">${label}</label><input id="${key}" data-legal-field type="text" placeholder="${field.placeholder || ""}"${req}/></div>`;
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
  const fields = (template.fields || []).map(renderField).join("");

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
    clearPlanTextPreview("ref-legal-text-preview");
    setStatus("");
  });

  mountPlanTextPreview("ref-legal-text-preview");
  injectModuleHeaders();
  const templateText = () => buildTemplateText(template, product.label);
  document.getElementById("ref-legal-btn-ver-planilla")?.addEventListener("click", () => {
    const text = templateText();
    if (!text) return;
    showPlanTextPreview("ref-legal-text-preview", text);
    setStatus("Planilla lista. Podés copiar desde el panel de vista previa.");
  });
  document.getElementById("ref-legal-btn-copiar")?.addEventListener("click", async () => {
    const text = templateText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Texto copiado al portapapeles.");
    } catch {
      setStatus("No se pudo copiar.", true);
    }
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
      hubCtx?.openLegalProduct?.(menuBtn.dataset.legalMenuProduct);
      return;
    }
    const hubBtn = e.target.closest("[data-legal-product]");
    if (!hubBtn) return;
    const hubProduct = findHubProduct(hubBtn.dataset.legalProduct);
    const bugItem = hubProduct?.items?.[0];
    if (bugItem) void onHubItemPick(hubBtn.dataset.legalProduct, bugItem.id);
  });

  document.getElementById("ref-legal-templates-back")?.addEventListener("click", () => {
    navStack.template = null;
    showHub();
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

  document.getElementById("ref-legal-form-back")?.addEventListener("click", () => {
    if (openedFromMenu) {
      openedFromMenu = false;
      hubCtx?.goPlanillasMenu?.();
      return;
    }
    showHub();
  });
}

export function initLegalReferralHub(context) {
  hubCtx = context;
  bindHubEvents();
}

export function openLegalProduct(productId) {
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
  navStack = { product: null, item: null, category: null, template: null };
  hideAllLegalViews();
}

export function getLegalReferralSelection() {
  return navStack.template ? { ...navStack } : null;
}
