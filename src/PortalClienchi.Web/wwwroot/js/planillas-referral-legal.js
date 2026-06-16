import { planTextPreviewHtml, showPlanTextPreview, clearPlanTextPreview, mountPlanTextPreview } from "./plan-text-preview.js";

const LEGAL_ICONS = {  briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
  graph: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M4 20V4M4 20h16"/><path d="m7 16 3-4 3 2 4-6"/></svg>',
  diagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M12 8v4M8.5 14.5 10 12M15.5 14.5 14 12"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3z"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M8 4h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="7" y="3" width="10" height="18" rx="2"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M7 18h11a3 3 0 0 0 .4-6 4.5 4.5 0 0 0-8.7-1.5A3.5 3.5 0 0 0 7 18z"/></svg>',
  gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/><path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9"/></svg>',
  bug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M8 8a4 4 0 0 1 8 0M5 12h3M16 12h3M6 16h12"/></svg>',
  chevronDown: '<svg viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/></svg>',
  chevronUp: '<svg viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"/></svg>',
};

let hubCtx = null;
let templatesCatalog = null;
let expandedProductId = null;
let navStack = { product: null, item: null, category: null, template: null };

/** Fallback si el servidor aún no expone catalogProductId / catalogCategoryId */
const LEGAL_CATALOG_PRODUCT_MAP = {
  firm: "legal-one",
  analytics: "legal-one-analytics",
  highq: "highq",
};
const LEGAL_CATALOG_CATEGORY_MAP = {
  rto: "rto-proview",
};
const LEGAL_DIRECT_CARD_PRODUCTS = new Set(["analytics", "highq"]);

function icon(name) {
  return `<span class="plan-legal-pick-icon">${LEGAL_ICONS[name] || LEGAL_ICONS.gear}</span>`;
}

function chevron(expanded) {
  return `<span class="plan-legal-chevron">${expanded ? LEGAL_ICONS.chevronUp : LEGAL_ICONS.chevronDown}</span>`;
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

function resolveCatalogCategoryId(hubProduct, hubItem, itemId) {
  if (hubItem?.catalogCategoryId) return hubItem.catalogCategoryId;
  if (LEGAL_DIRECT_CARD_PRODUCTS.has(hubProduct?.id)) return "general";
  return LEGAL_CATALOG_CATEGORY_MAP[itemId] || itemId;
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

function renderAccordionItems(product) {
  return `<div class="plan-legal-list">${product.items.map((item) => `
    <button type="button" class="plan-adj-card plan-legal-pick" data-legal-product="${product.id}" data-legal-item="${item.id}">
      <span class="plan-legal-pick-label">${icon(item.icon)}<span>${item.label}</span></span>
      <span class="card-mark">›</span>
    </button>
  `).join("")}</div>`;
}

function renderCardItems(product) {
  return `<div class="plan-legal-cards">${product.items.map((item) => `
    <button type="button" class="plan-op-card plan-legal-pick-card" data-legal-product="${product.id}" data-legal-item="${item.id}">
      <span class="op-accent orange"></span>
      ${icon(item.icon)}
      <strong>${item.label}</strong>
    </button>
  `).join("")}</div>`;
}

function renderProduct(product) {
  const expanded = expandedProductId === product.id;
  const body = product.layout === "cards" ? renderCardItems(product) : renderAccordionItems(product);
  return `
    <section class="plan-legal-product${expanded ? " is-expanded" : ""}">
      <button type="button" class="plan-legal-product-head" data-legal-product-toggle="${product.id}" aria-expanded="${expanded}">
        <span class="plan-legal-product-title">
          <span class="plan-module-icon-badge referral plan-legal-product-badge">${icon(product.icon)}</span>
          <strong>${product.label}</strong>
        </span>
        ${chevron(expanded)}
      </button>
      <div class="plan-legal-product-body${expanded ? "" : " hidden"}">${body}</div>
    </section>
  `;
}

function renderHub() {
  const root = document.getElementById("ref-legal-hub-root");
  const catalog = hubCtx?.getConfig()?.legal?.referralHub;
  if (!root || !catalog?.length) return;
  root.innerHTML = catalog.map(renderProduct).join("");
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
  if (crumb) crumb.textContent = `${product.label} › ${item.label} › ${template.label}`;
  const root = document.getElementById("ref-legal-form-root");
  if (!root) return;

  const blocks = (template.blocks || []).map((b) => `<p class="plan-ref-hint">${b}</p>`).join("");
  const fields = (template.fields || []).map(renderField).join("");

  root.innerHTML = `
    <div class="plan-well-box plan-legal-form-panel">
      <p class="plan-ref-title">${template.title || template.label}</p>
      ${blocks}
      <form id="ref-legal-template-form" class="plan-form-grid" autocomplete="off">${fields}</form>
      <div class="plan-ref-actions plan-ref-actions-dual plan-legal-form-actions">
        <button type="button" id="ref-legal-btn-generar" class="plan-action-btn green">
          <span class="plan-action-btn-main">Ver Planilla</span>
          <span class="plan-action-btn-sub">Genera y muestra la planilla en pantalla</span>
        </button>
        <button type="button" id="ref-legal-btn-limpar" class="plan-action-btn ghost">Limpiar</button>
      </div>
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
  document.getElementById("ref-legal-btn-generar")?.addEventListener("click", () => generatePreview(template));
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

function buildTemplateText(template) {
  const lines = [template.title || template.label, "=".repeat(40)];
  for (const { label, value } of collectValues(template)) {
    if (!label) {
      lines.push(value);
      continue;
    }
    lines.push(`${label}: ${value}`);
  }
  return lines.join("\n");
}

function generatePreview(template) {
  const text = buildTemplateText(template);
  showPlanTextPreview("ref-legal-text-preview", text);
  setStatus("Planilla lista. Podés copiar desde el panel de vista previa.");
}

function setStatus(msg, isError = false) {
  const el = document.getElementById("ref-legal-form-status");
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle("error", isError);
}

async function onHubItemPick(productId, itemId) {
  try {
    showHubStatus("Cargando plantillas…");
    await ensureCatalog();
    const hubProduct = findHubProduct(productId);
    const hubItem = hubProduct?.items?.find((i) => i.id === itemId);
    if (!hubProduct || !hubItem) {
      showHubStatus("No se encontró la categoría seleccionada.", true);
      return;
    }

    const catalogProductId = resolveCatalogProductId(hubProduct);
    const categoryId = resolveCatalogCategoryId(hubProduct, hubItem, itemId);
    const category = findCatalogCategory(catalogProductId, categoryId);
    if (!category?.templates?.length) {
      showHubStatus(`Sin plantillas para ${hubItem.label} (${catalogProductId}/${categoryId}).`, true);
      return;
    }

    const product = { id: productId, label: hubProduct.label };
    const item = { id: itemId, label: hubItem.label, icon: hubItem.icon };

    if (hubProduct.layout === "accordion") {
      showTemplateCards(product, item, category, category.templates);
      return;
    }

    const tpl = category.templates.find((t) => t.id === itemId)
      || category.templates.find((t) => t.label?.toLowerCase() === hubItem.label?.toLowerCase())
      || category.templates[0];
    if (!tpl) {
      showHubStatus("No se encontró la plantilla.", true);
      return;
    }
    showTemplateForm(product, item, tpl);
  } catch (err) {
    console.error(err);
    showHubStatus(err?.message || "Error al cargar plantillas LEGAL.", true);
  }
}

function bindHubEvents() {
  const root = document.getElementById("ref-legal-hub-root");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  root.addEventListener("click", (e) => {
    const toggle = e.target.closest("[data-legal-product-toggle]");
    if (toggle) {
      const id = toggle.dataset.legalProductToggle;
      expandedProductId = expandedProductId === id ? null : id;
      renderHub();
      return;
    }
    const pick = e.target.closest("[data-legal-item]");
    if (pick) void onHubItemPick(pick.dataset.legalProduct, pick.dataset.legalItem);
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
      resolveCatalogCategoryId(hubProduct, hubItem, navStack.item?.id),
    );
    const tpl = category?.templates?.find((t) => t.id === card.dataset.legalTemplateId);
    if (tpl) showTemplateForm(navStack.product, navStack.item, tpl);
  });

  document.getElementById("ref-legal-form-back")?.addEventListener("click", () => {
    const hubProduct = findHubProduct(navStack.product?.id);
    if (hubProduct?.layout === "accordion" && navStack.item && navStack.product) {
      void (async () => {
        await ensureCatalog();
        const hubItem = hubProduct.items.find((i) => i.id === navStack.item.id);
        const category = findCatalogCategory(
          resolveCatalogProductId(hubProduct),
          resolveCatalogCategoryId(hubProduct, hubItem, navStack.item.id),
        );
        showTemplateCards(navStack.product, navStack.item, category, category?.templates || []);
      })();
    } else {
      showHub();
    }
  });
}

export function initLegalReferralHub(context) {
  hubCtx = context;
  bindHubEvents();
}

export function openLegalReferralHub() {
  expandedProductId = "firm";
  navStack = { product: null, item: null, category: null, template: null };
  templatesCatalog = null;
  showHub();
  void ensureCatalog().catch((err) => showHubStatus(err?.message || "Error al cargar catálogo.", true));
}

export function resetLegalReferralHub() {
  expandedProductId = null;
  navStack = { product: null, item: null, category: null, template: null };
  hideAllLegalViews();
}

export function getLegalReferralSelection() {
  return navStack.template ? { ...navStack } : null;
}
