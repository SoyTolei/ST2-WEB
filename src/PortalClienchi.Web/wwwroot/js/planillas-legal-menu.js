/**
 * Botones de productos LEGAL (menú Planillas y hub). Módulo liviano: se carga con planillas.js
 * para que el menú LEGAL aparezca al instante, sin esperar el import de Referral.
 */
import { canSeeLegalProduct } from "./module-access.js";
import { syncPlanModulosGridLayout } from "./plan-grid-layout.js";

const LEGAL_ICONS = {
  briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
  diagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M12 8v4M8.5 14.5 10 12M15.5 14.5 14 12"/></svg>',
  scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M12 3v18M5 7h14M7 7l-2 6h4L7 7zM17 7l-2 6h4L17 7z"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M12 3l1.2 4.2L17 8.5l-3.8 1.3L12 14l-1.2-4.2L7 8.5l3.8-1.3L12 3z"/><path d="M5 16l.8 2.8L8.5 20l-2.7.9L5 23.5l-.8-2.6L1.5 20l2.7-.9L5 16z"/><path d="M19 14l.8 2.8L22.5 18l-2.7.9L19 21.5l-.8-2.6L15.5 18l2.7-.9L19 14z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2"/></svg>',
  bug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m6 11 6-6 6 6"/><path d="M5 21h14"/></svg>',
  ado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h5M8 17h3"/><path d="M15.5 15.5 17 17l2.5-3"/></svg>',
};

const LEGAL_ESCALAMIENTO_LABEL = "Escalamiento a N2/N3";

const LEGAL_PRODUCT_BTN_CLASS = {
  firm: "legal-one",
  highq: "highq",
  westlaw: "westlaw",
  cocounsel: "cocounsel",
};

export function legalIcon(name) {
  return LEGAL_ICONS[name] || LEGAL_ICONS.gear;
}

export function legalProductBtnClass(productId) {
  return LEGAL_PRODUCT_BTN_CLASS[productId] || "referral";
}

export function visibleLegalProducts(catalog) {
  return (catalog || []).filter((product) => canSeeLegalProduct(product.id));
}

/** Botón con el mismo estilo que las opciones del menú Planillas. */
export function legalModuloButtonHtml({ attrName, attrValue, btnClass, iconName, label, sub }) {
  return `
    <button type="button" class="plan-modulo-btn plan-legal-product-btn ${btnClass}" ${attrName}="${attrValue}">
      <span class="plan-modulo-icon" aria-hidden="true">${legalIcon(iconName)}</span>
      <span class="plan-modulo-copy">
        <span class="plan-modulo-label">${label}</span>
        <span class="plan-modulo-sub">${sub}</span>
      </span>
    </button>
  `;
}

export function renderLegalProductButtons(catalog, attrName) {
  return visibleLegalProducts(catalog).map((product) => legalModuloButtonHtml({
    attrName,
    attrValue: product.id,
    btnClass: legalProductBtnClass(product.id),
    iconName: product.icon,
    label: product.label,
    sub: product.subLabel || LEGAL_ESCALAMIENTO_LABEL,
  })).join("");
}

/** Pinta los productos LEGAL del menú Planillas a partir de /api/planillas/config. */
export function syncLegalMenuProducts(config) {
  const root = document.getElementById("plan-legal-menu-products");
  const wrap = document.getElementById("plan-legal-products-wrap");
  const catalog = config?.legal?.referralHub;
  if (!root || !catalog?.length) return;
  const visible = visibleLegalProducts(catalog);
  root.innerHTML = renderLegalProductButtons(catalog, "data-legal-menu-product");
  const show = visible.length > 0;
  wrap?.classList.toggle("hidden", !show);
  wrap?.toggleAttribute("hidden", !show);
  wrap?.setAttribute("aria-hidden", show ? "false" : "true");
  syncPlanModulosGridLayout(root);
}
