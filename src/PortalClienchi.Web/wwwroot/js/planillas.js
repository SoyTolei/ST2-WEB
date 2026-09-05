import { injectModuleHeaders } from "./planillas-icons.js";
import { snapshotFields, restoreFields, bindIaUndoButtons, syncIaUndoBar, notifyIaUndoHint } from "./plan-ia-undo.js";
import { updatePlanBuildBadge } from "./plan-build.js";
import { showPlanTextPreview, clearPlanTextPreview, mountPlanTextPreview } from "./plan-text-preview.js";
import { initPdfPortalGenerator, syncPdfPortalModuleVisibility, canSeePdfPortalModule, openPdfPortalModal } from "./pdf-portal.js?v=20260905i";
import { initBlanqueoModule, syncBlanqueoModuleVisibility, canSeeBlanqueoModule, openBlanqueoModule, stopBlanqueoLiveRefresh } from "./planillas-blanqueo.js";
import { initBorradoBasesModule, syncBorradoBasesModuleVisibility, canSeeBorradoBasesModule, openBorradoBasesModule, stopBorradoLiveRefresh } from "./planillas-borrado-bases.js";
import { refreshModuleFlags, canSeeOportunidadModule, canSeePlanillasSqlOnvio, canSeePlanillasLegal, canSeePlanillasChile, canSeePlanillasTransferencia, canSeePlanillasReferral, canSeeAnyLegalProduct, canSeeChileTransferencia, canSeeChileReferral, canSeeChileSaad, canSeeChileHr, canSeeChileWiki, canSeeChileLp, canSeeChilePowerapps, startModuleAccessPolling, getViewAsProfile } from "./module-access.js";
import { syncAllPlanModulosGrids, syncPlanModulosGridLayout } from "./plan-grid-layout.js";
import { getPlanUserEmail } from "./plan-user.js";
import {
  startBlanqueoAlertsPolling,
  renderBlanqueoAlertUi,
} from "./blanqueo-alerts.js";
import {
  startBorradoAlertsPolling,
  renderBorradoAlertUi,
} from "./borrado-alerts.js";
import {
  startAccessAlertsPolling,
  renderAccessAlertUi,
} from "./access-alerts.js";
import { isEggBirthdayWindow, resolvePlanillasEgg } from "./planillas-easter-eggs.js";
import { syncAguaEgg } from "./planillas-agua-egg.js";
import {
  initSt2Tours,
  setTourContext,
  autoTour,
  syncHeaderTourButton,
} from "./st2-tour-init.js";

const DESCRIPCION_PLACEHOLDER = "Detalle y/o proceso realizado por el usuario";

const MESA_LABELS = {
  TECNICO: "TÉCNICO",
  FLEX: "FLEX",
  FUNCIONAL: "FUNCIONAL",
  SAAS: "SaaS",
  SUELDOS: "SUELDOS",
};

const DEFAULT_STANDARD_MESAS = [
  { id: "TECNICO", label: "TÉCNICO" },
  { id: "FLEX", label: "FLEX" },
  { id: "SAAS", label: "SaaS" },
  { id: "SUELDOS", label: "SUELDOS" },
];

const FALLBACK_CHILE_MESAS = [
  { id: "TECNICO", label: "TÉCNICO" },
  { id: "FUNCIONAL", label: "FUNCIONAL" },
];

const SISTEMA_LABELS = {
  BejermanSql: "BEJERMAN SQL",
  OnvioWeb: "ONVIO/WEB",
  Legal: "LEGAL",
  Chile: "CHILE",
};

const SISTEMA_INDEX = {
  BejermanSql: 0,
  OnvioWeb: 1,
  Legal: 2,
  Chile: 3,
};

const LEGAL_MESA_LABELS = {
  N1: "Atención N1",
  N2: "Técnico N2",
  API: "API / Integraciones",
  FINANCEIRO: "Financiero / NF-e",
  ONEPASS: "Infra / OnePass",
};

function sistemaDisplayLabel(id) {
  return SISTEMA_LABELS[id] || "";
}

function sistemaBadgeLabel(id = sistemaActual) {
  const label = sistemaDisplayLabel(id);
  return isSistemaBeta(id) ? `${label} · beta` : label;
}

function isLegalSistema(id) {
  return id === "Legal";
}

function isSistemaPlaceholder(id) {
  const cfg = planillasConfig?.sistemas?.find((s) => s.id === id);
  return !!cfg?.placeholder;
}

function isLegal() {
  return sistemaActual === "Legal";
}

function isSistemaBeta(id) {
  return !!planillasConfig?.sistemas?.find((s) => s.id === id)?.beta;
}

function isChile() {
  return sistemaActual === "Chile";
}

/** Oportunidad, PDF y Blanqueo no aplican a LEGAL ni Chile. */
function hidesCommercialModules(id = sistemaActual) {
  return id === "Legal" || id === "Chile";
}

const SISTEMA_ORDER = ["BejermanSql", "OnvioWeb", "Legal", "Chile"];

function canSeeSistema(id) {
  if (!id) return false;
  if (id === "BejermanSql" || id === "OnvioWeb") return canSeePlanillasSqlOnvio();
  if (id === "Legal") return canSeePlanillasLegal() && !isSistemaPlaceholder("Legal");
  if (id === "Chile") return canSeePlanillasChile();
  return false;
}

function getVisibleSistemas() {
  return SISTEMA_ORDER.filter(canSeeSistema);
}

function shouldHideSistemaPicker() {
  const visible = getVisibleSistemas();
  return visible.length === 1 && (visible[0] === "Legal" || visible[0] === "Chile");
}

function syncSistemaPickerVisibility() {
  const hide = shouldHideSistemaPicker();
  const section = document.getElementById("plan-sistema-section");
  section?.classList.toggle("hidden", hide);
  section?.toggleAttribute("hidden", hide);
  document.body.classList.toggle("st2-single-legal-chile-sistema", hide);
}

function ensureAllowedSistema() {
  if (canSeeSistema(sistemaActual)) return;
  const visible = getVisibleSistemas();
  if (visible.length > 0) {
    sistemaActual = visible[0];
    rememberSistema(sistemaActual);
    normalizeMesaForSistema();
  }
}

function syncSistemaDataset() {
  document.body.dataset.planSistema = sistemaActual || "";
}

function updateSistemaBetaUi() {
  document.getElementById("plan-chile-beta-pill")?.classList.toggle("hidden", !isSistemaBeta("Chile"));
}

let planillasConfig = null;
let sistemaActual = null;
let currentPlanillasView = "menu";
let mesaActual = null;
const SISTEMA_STORAGE_KEY = "st2-plan-sistema";
const SISTEMA_BY_SLUG = {
  sql: "BejermanSql",
  bejerman: "BejermanSql",
  onvio: "OnvioWeb",
  legal: "Legal",
  chile: "Chile",
};
const SLUG_BY_SISTEMA = {
  BejermanSql: "sql",
  OnvioWeb: "onvio",
  Legal: "legal",
  Chile: "chile",
};
let legalProdutoSel = null;
let legalModuloSel = null;
let legalAmbienteSel = null;
let capturaFiles = [];
let descripcionEsPlaceholder = true;
let transferIaUndo = null;

const views = {
  menu: document.getElementById("planillas-menu"),
  transferencia: document.getElementById("planillas-transferencia"),
  placeholder: document.getElementById("planillas-placeholder"),
  referral: document.getElementById("planillas-referral"),
  oportunidadMenu: document.getElementById("planillas-oportunidad-menu"),
  oportunidadCargar: document.getElementById("planillas-oportunidad-cargar"),
  oportunidadGestor: document.getElementById("planillas-oportunidad-gestor"),
  blanqueo: document.getElementById("planillas-blanqueo"),
  borradoBases: document.getElementById("planillas-borrado-bases"),
  chileEmbed: document.getElementById("planillas-chile-embed"),
};

let chileEmbedUrl = "";
let chileEmbedTitle = "";
let chileEmbedLoadTimer = null;
let chileEmbedMenuOpen = false;
const CHILE_EMBED_STORAGE_KEY = "st2-chile-embed";

const els = {
  sistemaBtns: () => document.querySelectorAll(".plan-sistema-grid > [data-plan-sistema]"),
  sistemaIndicator: () => document.getElementById("plan-sistema-indicator"),
  moduloBtns: () => document.querySelectorAll("[data-plan-modulo]"),
  placeholderTitle: () => document.getElementById("plan-placeholder-title"),
  placeholderText: () => document.getElementById("plan-placeholder-text"),
  sistemaBadge: () => document.getElementById("plan-trans-sistema"),
  numeroCliente: () => document.getElementById("plan-numero-cliente"),
  asunto: () => document.getElementById("plan-asunto"),
  descripcion: () => document.getElementById("plan-descripcion"),
  mesaBtns: () => document.querySelectorAll("#plan-standard-mesas [data-mesa]"),
  capturasCard: () => document.getElementById("plan-capturas-card"),
  capturasCheck: () => document.getElementById("plan-capturas-check"),
  capturasPanel: () => document.getElementById("plan-capturas-panel"),
  capturasInput: () => document.getElementById("plan-capturas-input"),
  capturasChips: () => document.getElementById("plan-capturas-chips"),
  capturasEstado: () => document.getElementById("plan-capturas-estado"),
  ticketWrap: () => document.getElementById("plan-ticket-wrap"),
  ticketCheck: () => document.getElementById("plan-ticket-check"),
  ticketPanel: () => document.getElementById("plan-ticket-panel"),
  ticketNumero: () => document.getElementById("plan-ticket-numero"),
  planStatus: () => document.getElementById("plan-status"),
  btnCopiar: () => document.getElementById("plan-btn-copiar"),
  btnVerPlanilla: () => document.getElementById("plan-btn-ver-planilla"),
};

function slugForSistema(id) {
  return SLUG_BY_SISTEMA[id] || "sql";
}

function sistemaFromSlug(slug) {
  if (!slug) return null;
  return SISTEMA_BY_SLUG[String(slug).toLowerCase()] || null;
}

function rememberSistema(id) {
  if (!id || SISTEMA_INDEX[id] == null) return;
  try {
    localStorage.setItem(SISTEMA_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

function normalizeSistemaId(id) {
  const raw = String(id || "").trim();
  if (SISTEMA_INDEX[raw] != null) return raw;
  const aliases = {
    BejermanSql: "BejermanSql",
    bejermanSql: "BejermanSql",
    Bejerman: "BejermanSql",
    Onvio: "OnvioWeb",
    onvio: "OnvioWeb",
    OnvioWeb: "OnvioWeb",
  };
  return aliases[raw] || null;
}

function readRememberedSistema() {
  try {
    const saved = normalizeSistemaId(localStorage.getItem(SISTEMA_STORAGE_KEY));
    if (saved && canSeeSistema(saved)) return saved;
  } catch {
    /* ignore */
  }
  const visible = getVisibleSistemas();
  return visible[0] || "BejermanSql";
}

function normalizePath(pathname) {
  const raw = String(pathname || "/").split("?")[0].split("#")[0];
  if (!raw || raw === "/") return "/";
  const trimmed = raw.replace(/\/+$/, "");
  return trimmed || "/";
}

function pathForView(name) {
  if (name === "transferencia") return `/transferencia/${slugForSistema(sistemaActual)}`;
  if (name === "referral") return `/referral/${slugForSistema(sistemaActual)}`;
  switch (name) {
    case "oportunidadMenu": return "/oportunidad";
    case "oportunidadCargar": return "/oportunidad/cargar";
    case "oportunidadGestor": return "/oportunidad/gestor";
    case "pdfPortal": return "/pdfportal";
    case "blanqueo": return "/blanqueo";
    case "borradoBases": return "/borrado-bases";
    case "chileEmbed": return "/chile/soporte";
    default: return "/";
  }
}

function parseSistemaRoute(pathname, prefix) {
  const p = normalizePath(pathname);
  if (p === prefix) return { view: prefix.slice(1), sistema: null };
  if (p.startsWith(`${prefix}/`)) {
    const slug = p.slice(prefix.length + 1).split("/")[0];
    const sistema = sistemaFromSlug(slug);
    if (!sistema) return { view: "menu", unknown: true };
    return { view: prefix.slice(1), sistema };
  }
  return null;
}

function isForeignAppPath(pathname) {
  const p = normalizePath(pathname);
  return p === "/thom" || p.startsWith("/thom/")
    || p === "/ai"
    || p === "/portal" || p.startsWith("/portal/");
}

export function isPlanillasPath(pathname = window.location.pathname) {
  return !isForeignAppPath(pathname);
}

function routeFromPath(pathname) {
  const p = normalizePath(pathname);
  if (isForeignAppPath(p)) return { view: "menu", foreign: true };
  if (p === "/pdfportal" || p === "/pdf-portal" || p === "/pdf") return { view: "pdfPortal", requires: "pdf" };
  if (p === "/planillas" || p === "/index.html") return { view: "menu" };

  const transferencia = parseSistemaRoute(pathname, "/transferencia");
  if (transferencia) {
    return { ...transferencia, requires: "transferencia" };
  }
  const referral = parseSistemaRoute(pathname, "/referral");
  if (referral) {
    return { ...referral, requires: "referral" };
  }

  switch (p) {
    case "/": return { view: "menu" };
    case "/oportunidad": return { view: "oportunidadMenu", requires: "oportunidad" };
    case "/oportunidad/cargar": return { view: "oportunidadCargar", requires: "oportunidad" };
    case "/oportunidad/gestor": return { view: "oportunidadGestor", requires: "oportunidad" };
    case "/blanqueo": return { view: "blanqueo", requires: "blanqueo" };
    case "/borrado-bases": return { view: "borradoBases", requires: "borrado-bases" };
    case "/chile/soporte": return { view: "chileEmbed", requires: "chile-soporte" };
    default: return { view: "menu", unknown: true };
  }
}

function canSeeTransferenciaModule(sistema = sistemaActual) {
  if (sistema === "Legal") return false;
  if (sistema === "Chile") return canSeeChileTransferencia();
  if (sistema === "BejermanSql" || sistema === "OnvioWeb") return canSeePlanillasTransferencia();
  return false;
}

function canSeeReferralModule(sistema = sistemaActual) {
  if (sistema === "Legal") return false;
  if (sistema === "Chile") return canSeeChileReferral();
  if (sistema === "BejermanSql" || sistema === "OnvioWeb") return canSeePlanillasReferral();
  return false;
}

function canSeeChileEmbedButton(btn) {
  if (!btn) return false;
  if (btn.classList.contains("chile-saad")) return canSeeChileSaad();
  if (btn.classList.contains("chile-hr")) return canSeeChileHr();
  if (btn.classList.contains("chile-wiki")) return canSeeChileWiki();
  if (btn.classList.contains("chile-lp")) return canSeeChileLp();
  if (btn.classList.contains("chile-powerapps")) return canSeeChilePowerapps();
  return true;
}

function syncChileSoporteVisibility() {
  const showChile = isChile();
  let anyVisible = false;
  document.querySelectorAll("[data-plan-embed-url][data-plan-embed-return='chile']").forEach((btn) => {
    const show = showChile && canSeeChileEmbedButton(btn);
    btn.classList.toggle("hidden", !show);
    btn.toggleAttribute("hidden", !show);
    btn.setAttribute("aria-hidden", show ? "false" : "true");
    if (show) anyVisible = true;
  });
  const chileWrap = document.getElementById("plan-chile-soporte-wrap");
  chileWrap?.classList.toggle("hidden", !anyVisible);
  chileWrap?.setAttribute("aria-hidden", anyVisible ? "false" : "true");
  syncPlanModulosGridLayout(document.querySelector(".plan-chile-soporte-grid"));
}

function canOpenRoute(route) {
  if (!route?.requires) return true;
  if (route.requires === "oportunidad") return canSeeOportunidadModule() && !hidesCommercialModules();
  if (route.requires === "pdf") return canSeePdfPortalModule() && !hidesCommercialModules();
  if (route.requires === "blanqueo") return canSeeBlanqueoModule() && !hidesCommercialModules();
  if (route.requires === "borrado-bases") return canSeeBorradoBasesModule() && !hidesCommercialModules();
  const sys = route.sistema || sistemaActual;
  if (route.requires === "transferencia") {
    return !!sys && canSeeSistema(sys) && !isSistemaPlaceholder(sys) && canSeeTransferenciaModule(sys);
  }
  if (route.requires === "referral") {
    if (!sys || !canSeeSistema(sys) || isSistemaPlaceholder(sys)) return false;
    if (sys === "Legal") return canSeeAnyLegalProduct();
    return canSeeReferralModule(sys);
  }
  if (route.requires === "chile-soporte") {
    return canSeeSistema("Chile") && !!chileEmbedUrl;
  }
  return true;
}

let pendingLegalProductId = null;

function referralModuleLabel(sistema = sistemaActual) {
  return sistema === "Legal" ? "Escalamiento a N2/N3" : "Referral I+D";
}

function referralModuleSubtitle(sistema = sistemaActual) {
  return sistema === "Legal" ? "Reporte de bugs LEGAL" : "Escalamiento a desarrollo";
}

function syncReferralModuleLabels(sistema = sistemaActual) {
  const label = referralModuleLabel(sistema);
  const sub = referralModuleSubtitle(sistema);
  const menuLabel = document.getElementById("plan-modulo-referral-label");
  const menuSub = document.getElementById("plan-modulo-referral-sub");
  const moduleTitle = document.getElementById("plan-referral-module-title");
  const loadingText = document.getElementById("plan-referral-loading-text");
  if (menuLabel) menuLabel.textContent = label;
  if (menuSub) menuSub.textContent = sub;
  if (moduleTitle) moduleTitle.textContent = label;
  if (loadingText) loadingText.textContent = `Cargando ${label}…`;
}

function titleForView(name) {
  switch (name) {
    case "transferencia": return "ST² · Transferencia";
    case "referral": return isLegal() ? "ST² · Escalamiento N2/N3" : "ST² · Referral I+D";
    case "oportunidadMenu":
    case "oportunidadCargar":
    case "oportunidadGestor": return "ST² · Oportunidad";
    case "pdfPortal": return "ST² · Generador PDF";
    case "blanqueo": return "ST² · Blanqueo";
    case "borradoBases": return "ST² · Borrado de Bases Web";
    case "chileEmbed": return chileEmbedTitle ? `ST² · ${chileEmbedTitle}` : "ST² · Sitio embebido";
    default: return "ST² · Suite Web";
  }
}

let routeSyncing = false;

function syncHistory(name, mode = "push") {
  if (routeSyncing || mode === "none" || name === "placeholder") return;
  const path = pathForView(name);
  const current = normalizePath(window.location.pathname);
  const state = { st2: name, sistema: sistemaActual };
  if (mode === "replace" || current === path) {
    window.history.replaceState(state, "", path);
  } else {
    window.history.pushState(state, "", path);
  }
}

function showView(name, { history = "push" } = {}) {
  const viewKey = name;
  if (viewKey !== "blanqueo") stopBlanqueoLiveRefresh();
  if (viewKey !== "borradoBases") stopBorradoLiveRefresh();
  Object.entries(views).forEach(([key, el]) => {
    if (!el) return;
    el.classList.toggle("hidden", key !== viewKey);
  });
  document.body.classList.toggle("st2-balloons-sides", name !== "menu");
  document.body.classList.toggle("st2-chile-embed-active", viewKey === "chileEmbed");
  injectModuleHeaders();
  document.title = titleForView(name);
  syncHistory(name, history);
  if (name === "menu") {
    renderBlanqueoAlertUi();
  }
  syncAguaEgg();
  currentPlanillasView = name;
  document.dispatchEvent(new CustomEvent("st2:planillas-view-changed", { detail: { view: name } }));
  syncHeaderTourButton();
}

function setSistemaIndicator(index) {
  const grid = document.querySelector(".plan-sistema-grid");
  const indicator = els.sistemaIndicator();
  const btn = [...els.sistemaBtns()].filter((el) => !el.classList.contains("hidden"))[index];
  if (!grid || !indicator || !btn) return;

  const gridRect = grid.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  const width = Math.max(0, Math.min(btnRect.width, gridRect.width));
  const left = Math.max(0, Math.min(btnRect.left - gridRect.left, gridRect.width - width));
  indicator.style.width = `${width}px`;
  indicator.style.transform = `translate3d(${left}px, 0, 0)`;
}

function refreshSistemaIndicator() {
  const buttons = [...els.sistemaBtns()].filter((btn) => !btn.classList.contains("hidden"));
  const idx = buttons.findIndex((btn) => btn.dataset.planSistema === sistemaActual);
  setSistemaIndicator(idx >= 0 ? idx : 0);
}

function syncSistemaGridColumns() {
  const grid = document.querySelector(".plan-sistema-grid");
  if (!grid) return;
  const visibleCount = [...els.sistemaBtns()].filter((btn) => !btn.classList.contains("hidden")).length;
  const cols = Math.max(visibleCount, 1);
  grid.style.setProperty("--plan-sistema-cols", String(cols));
  grid.dataset.visibleCount = String(cols);
}

function updateSistemaUi() {
  ensureAllowedSistema();
  els.sistemaBtns().forEach((btn) => {
    const id = btn.dataset.planSistema;
    const allowed = canSeeSistema(id);
    btn.classList.toggle("hidden", !allowed);
    btn.toggleAttribute("hidden", !allowed);
    btn.disabled = !allowed;
    const active = id === sistemaActual;
    btn.classList.toggle("active", active);
  });
  syncSistemaGridColumns();
  syncSistemaPickerVisibility();
  refreshSistemaIndicator();
  syncSistemaDataset();

  const transferBtn = document.getElementById("plan-modulo-transferencia");
  const transferNa = document.getElementById("plan-modulo-transferencia-na");
  const referralBtn = document.querySelector('[data-plan-modulo="referral"]');
  const oportunidadBtn = document.querySelector('[data-plan-modulo="oportunidad"]');
  const oportunidadNa = document.getElementById("plan-modulo-oportunidad-na");
  const opcionesTitle = document.getElementById("plan-opciones-section-title");
  const opcionesWell = document.getElementById("plan-opciones-modulos-well");
  const legalProductsWrap = document.getElementById("plan-legal-products-wrap");
  const placeholderBlocked = !sistemaActual || isSistemaPlaceholder(sistemaActual);
  const hideCommercial = hidesCommercialModules();
  const showTransfer = canSeeTransferenciaModule();
  const showReferral = canSeeReferralModule() && !isLegal();
  const showLegalProducts = isLegal() && canSeeAnyLegalProduct();

  if (transferBtn) {
    transferBtn.classList.toggle("hidden", !showTransfer);
    transferBtn.toggleAttribute("hidden", !showTransfer);
    transferBtn.disabled = placeholderBlocked || !showTransfer;
  }
  if (transferNa) {
    transferNa.classList.add("hidden");
    transferNa.toggleAttribute("hidden", true);
    transferNa.setAttribute("aria-hidden", "true");
  }
  if (referralBtn) {
    referralBtn.classList.toggle("hidden", !showReferral || showLegalProducts);
    referralBtn.toggleAttribute("hidden", !showReferral || showLegalProducts);
    referralBtn.disabled = placeholderBlocked || !showReferral;
  }
  opcionesTitle?.classList.toggle("hidden", showLegalProducts);
  opcionesTitle?.toggleAttribute("hidden", showLegalProducts);
  opcionesWell?.classList.toggle("hidden", showLegalProducts);
  opcionesWell?.toggleAttribute("hidden", showLegalProducts);
  if (legalProductsWrap) {
    legalProductsWrap.classList.toggle("hidden", !showLegalProducts);
    legalProductsWrap.toggleAttribute("hidden", !showLegalProducts);
    legalProductsWrap.setAttribute("aria-hidden", showLegalProducts ? "false" : "true");
  }
  if (showLegalProducts) {
    void loadReferralModule().then((mod) => {
      mod.syncLegalMenuProducts?.();
      mod.prefetchLegalCatalog?.();
    });
  }

  if (oportunidadBtn) {
    const allowedOp = canSeeOportunidadModule();
    oportunidadBtn.classList.toggle("hidden", hideCommercial || !allowedOp);
    oportunidadBtn.disabled = placeholderBlocked || hideCommercial || !allowedOp;
  }
  if (oportunidadNa) {
    oportunidadNa.classList.add("hidden");
    oportunidadNa.setAttribute("aria-hidden", "true");
  }
  syncPdfPortalModuleVisibility();
  syncBlanqueoModuleVisibility();
  syncBorradoBasesModuleVisibility();
  document.querySelector(".plan-modulos-grid")?.classList.toggle("is-compact", hideCommercial);
  syncChileSoporteVisibility();
  syncAllPlanModulosGrids();
  renderBlanqueoAlertUi();
  updateSistemaBetaUi();
  syncReferralModuleLabels();
  syncHeaderTourButton();
}

function selectSistema(id) {
  const normalized = normalizeSistemaId(id);
  if (!normalized || !canSeeSistema(normalized)) return;
  if (!views.chileEmbed?.classList.contains("hidden")) {
    closeChileEmbed();
    showView("menu", { history: "replace" });
  }
  sistemaActual = normalized;
  rememberSistema(normalized);
  normalizeMesaForSistema();
  updateSistemaUi();
  updateTransferenciaPanels();
  if (!routeSyncing && normalizePath(window.location.pathname) === "/") {
    window.history.replaceState({ st2: "menu", sistema: id }, "", "/");
  }
}

function buildLegalTransPills() {
  const cfg = planillasConfig?.legal;
  if (!cfg) return;

  const prodRow = document.getElementById("plan-legal-produto-pills");
  const modRow = document.getElementById("plan-legal-modulo-pills");
  const ambRow = document.getElementById("plan-legal-ambiente-pills");
  if (!prodRow || !modRow || !ambRow) return;

  prodRow.innerHTML = (cfg.produtos || []).map((p) =>
    `<button type="button" class="plan-segment-btn${legalProdutoSel === p ? " active" : ""}" data-legal-produto="${p}">${p}</button>`
  ).join("");
  modRow.innerHTML = (cfg.modulos || []).map((m) =>
    `<button type="button" class="plan-segment-btn${legalModuloSel === m ? " active" : ""}" data-legal-modulo="${m}">${m}</button>`
  ).join("");
  ambRow.innerHTML = (cfg.ambientes || []).map((a) =>
    `<button type="button" class="plan-segment-btn${legalAmbienteSel === a ? " active" : ""}" data-legal-ambiente="${a}">${a}</button>`
  ).join("");
}

function getStandardMesas() {
  if (isChile()) {
    return planillasConfig?.chile?.mesas?.length
      ? planillasConfig.chile.mesas
      : FALLBACK_CHILE_MESAS;
  }
  const ids = planillasConfig?.mesas || DEFAULT_STANDARD_MESAS.map((m) => m.id);
  return ids.map((id) => ({
    id,
    label: MESA_LABELS[id] || id,
  }));
}

function normalizeMesaForSistema() {
  const allowed = new Set(getStandardMesas().map((m) => m.id));
  if (mesaActual && !allowed.has(mesaActual)) mesaActual = null;
}

function buildStandardMesas() {
  const row = document.getElementById("plan-standard-mesas");
  if (!row) return;
  row.innerHTML = getStandardMesas().map((m) =>
    `<button type="button" class="plan-segment-btn${mesaActual === m.id ? " active" : ""}" data-mesa="${m.id}">${m.label}</button>`
  ).join("");
}

function buildLegalMesas() {
  const row = document.getElementById("plan-legal-mesas");
  const cfg = planillasConfig?.legal;
  if (!row || !cfg?.mesas) return;

  row.innerHTML = cfg.mesas.map((m) =>
    `<button type="button" class="plan-segment-btn${mesaActual === m.id ? " active" : ""}" data-legal-mesa="${m.id}">${m.label}</button>`
  ).join("");
}

function updateTransferenciaPanels() {
  const legal = isLegal();
  document.getElementById("plan-trans-standard-fields")?.classList.toggle("hidden", legal);
  document.getElementById("plan-trans-legal-panel")?.classList.toggle("hidden", !legal);

  if (legal) {
    buildLegalTransPills();
    buildLegalMesas();
    refreshLegalMesaUi();
    els.ticketWrap()?.classList.remove("hidden");
  } else {
    normalizeMesaForSistema();
    buildStandardMesas();
    refreshMesaUi();
  }
}

function refreshLegalMesaUi() {
  document.querySelectorAll("#plan-legal-mesas .plan-segment-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.legalMesa === mesaActual);
  });
}

function toggleLegalMesa(mesa) {
  mesaActual = mesaActual === mesa ? null : mesa;
  refreshLegalMesaUi();
}

function styleTicketCard(selected) {
  const card = document.getElementById("plan-ticket-card");
  const mark = document.getElementById("plan-ticket-mark");
  card?.classList.toggle("selected", selected);
  if (mark) {
    mark.textContent = selected ? "✓" : "○";
    mark.style.color = selected ? "#16a34a" : "#94a3b8";
  }
}

function onTicketToggle() {
  const on = els.ticketCheck()?.checked === true;
  els.ticketPanel()?.classList.toggle("hidden", !on);
  styleTicketCard(on);
  if (!on) els.ticketNumero().value = "";
}

function showTicketSection() {
  const wrap = els.ticketWrap();
  const check = els.ticketCheck();
  const panel = els.ticketPanel();
  if (!wrap || !check || !panel) return;

  let show =
    sistemaActual === "Legal" ||
    sistemaActual === "OnvioWeb" ||
    (sistemaActual === "BejermanSql" && (mesaActual === "SAAS" || mesaActual === "SUELDOS"));

  if (mesaActual === "TECNICO" || mesaActual === "FLEX" || mesaActual === "FUNCIONAL") show = false;

  wrap.classList.toggle("hidden", !show);
  if (!show) {
    check.checked = false;
    panel.classList.add("hidden");
    els.ticketNumero().value = "";
    styleTicketCard(false);
  } else {
    onTicketToggle();
  }
}

function refreshMesaUi() {
  els.mesaBtns().forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mesa === mesaActual);
  });
  showTicketSection();
}

function toggleMesa(mesa) {
  mesaActual = mesaActual === mesa ? null : mesa;
  refreshMesaUi();
}

function styleCapturasCard(selected) {
  const card = els.capturasCard();
  const mark = card?.querySelector(".plan-capturas-mark");
  if (!card || !mark) return;
  card.classList.toggle("selected", selected);
  mark.textContent = selected ? "✓" : "○";
}

function revokeCapturaThumbUrls(container) {
  if (!container) return;
  container.querySelectorAll("img[data-object-url], video[data-object-url]").forEach((el) => {
    const url = el.getAttribute("data-object-url");
    if (url) URL.revokeObjectURL(url);
  });
}

function isPlanVideoFile(file) {
  if (/\.(mp4|webm)$/i.test(file.name || "")) return true;
  const t = file.type || "";
  return t === "video/mp4" || t === "video/webm";
}

function isPlanPdfFile(file) {
  if (/\.pdf$/i.test(file.name || "")) return true;
  return (file.type || "") === "application/pdf";
}

function isPlanTxtFile(file) {
  return /\.txt$/i.test(file.name || "");
}

function isPlanExcelFile(file) {
  if (/\.(xlsx|xls)$/i.test(file.name || "")) return true;
  const t = file.type || "";
  return t === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    || t === "application/vnd.ms-excel";
}

function isPlanXmlFile(file) {
  if (/\.xml$/i.test(file.name || "")) return true;
  const t = file.type || "";
  return t === "application/xml" || t === "text/xml";
}

function isPlanCapturaFile(file) {
  if (isPlanVideoFile(file)) return true;
  if (isPlanPdfFile(file)) return true;
  if (isPlanTxtFile(file)) return true;
  if (isPlanExcelFile(file)) return true;
  if (isPlanXmlFile(file)) return true;
  if (/\.(png|jpe?g|gif|bmp|webp)$/i.test(file.name || "")) return true;
  return (file.type || "").startsWith("image/");
}

const MAX_PLAN_VIDEOS = 1;
const MAX_PLAN_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_PLAN_PDF_BYTES = 12 * 1024 * 1024;
const MAX_PLAN_TXT_BYTES = 12 * 1024 * 1024;
const MAX_PLAN_EXCEL_BYTES = 12 * 1024 * 1024;
const MAX_PLAN_XML_BYTES = 12 * 1024 * 1024;

function refreshCapturasUi() {
  const chips = els.capturasChips();
  const estado = els.capturasEstado();
  if (!chips) return;

  revokeCapturaThumbUrls(chips);
  chips.innerHTML = "";
  capturaFiles.forEach((f, index) => {
    const isVideo = isPlanVideoFile(f);
    const isPdf = isPlanPdfFile(f);
    const isTxt = isPlanTxtFile(f);
    const isExcel = isPlanExcelFile(f);
    const isXml = isPlanXmlFile(f);
    const isChip = isVideo || isPdf || isTxt || isExcel || isXml;
    const card = document.createElement("div");
    card.className = isChip
      ? `plan-traza-chip ${isVideo ? "plan-video-chip" : isTxt ? "plan-txt-chip" : isExcel ? "plan-excel-chip" : isXml ? "plan-xml-chip" : "plan-pdf-chip"}`
      : "plan-captura-thumb";

    let preview;
    if (isChip) {
      preview = document.createElement("span");
      preview.className = "plan-traza-chip-ext";
      const match = /\.([^.]+)$/.exec(f.name || "");
      preview.textContent = (match?.[1] || (isPdf ? "pdf" : isTxt ? "txt" : isExcel ? "xlsx" : isXml ? "xml" : "mp4")).toUpperCase();
    } else {
      preview = document.createElement("img");
      const url = URL.createObjectURL(f);
      preview.src = url;
      preview.alt = f.name;
      preview.setAttribute("data-object-url", url);
    }

    const name = document.createElement("span");
    name.className = isChip ? "plan-traza-chip-name" : "plan-captura-thumb-name";
    name.textContent = f.name;
    name.title = f.name;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "plan-captura-thumb-remove";
    btn.setAttribute("aria-label", `Quitar ${f.name}`);
    btn.textContent = "×";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      capturaFiles.splice(index, 1);
      refreshCapturasUi();
    });

    card.append(preview, name, btn);
    chips.appendChild(card);
  });

  if (estado) {
    if (capturaFiles.length === 0) {
      estado.textContent = "";
    } else {
      const videos = capturaFiles.filter(isPlanVideoFile).length;
      const pdfs = capturaFiles.filter(isPlanPdfFile).length;
      const txts = capturaFiles.filter(isPlanTxtFile).length;
      const excels = capturaFiles.filter(isPlanExcelFile).length;
      const xmls = capturaFiles.filter(isPlanXmlFile).length;
      const imgs = capturaFiles.length - videos - pdfs - txts - excels - xmls;
      const parts = [];
      if (imgs > 0) parts.push(`${imgs} imagen(es)`);
      if (videos > 0) parts.push(`${videos} video(s)`);
      if (pdfs > 0) parts.push(`${pdfs} PDF`);
      if (txts > 0) parts.push(`${txts} TXT`);
      if (excels > 0) parts.push(`${excels} Excel`);
      if (xmls > 0) parts.push(`${xmls} XML`);
      estado.textContent = `${parts.join(" · ")} listo(s) para subir al generar el texto.`;
    }
  }

  styleCapturasCard(els.capturasCheck()?.checked === true);
}

function onCapturasToggle() {
  const on = els.capturasCheck()?.checked === true;
  els.capturasPanel()?.classList.toggle("hidden", !on);
  if (!on) {
    capturaFiles = [];
    refreshCapturasUi();
  }
  styleCapturasCard(on);
}

function addCapturaFiles(fileList) {
  let added = 0;
  let rejectedHeavy = false;
  let rejectedPdfHeavy = false;
  let rejectedTxtHeavy = false;
  let rejectedExcelHeavy = false;
  let rejectedXmlHeavy = false;
  let rejectedVideo = false;
  let rejectedFormat = false;
  for (const file of fileList) {
    if (!isPlanCapturaFile(file)) {
      rejectedFormat = true;
      continue;
    }
    if (isPlanVideoFile(file)) {
      if (file.size > MAX_PLAN_VIDEO_BYTES) {
        rejectedHeavy = true;
        continue;
      }
      if (capturaFiles.filter(isPlanVideoFile).length >= MAX_PLAN_VIDEOS) {
        rejectedVideo = true;
        continue;
      }
    } else if (isPlanPdfFile(file)) {
      if (file.size > MAX_PLAN_PDF_BYTES) {
        rejectedPdfHeavy = true;
        continue;
      }
    } else if (isPlanTxtFile(file)) {
      if (file.size > MAX_PLAN_TXT_BYTES) {
        rejectedTxtHeavy = true;
        continue;
      }
    } else if (isPlanExcelFile(file)) {
      if (file.size > MAX_PLAN_EXCEL_BYTES) {
        rejectedExcelHeavy = true;
        continue;
      }
    } else if (isPlanXmlFile(file)) {
      if (file.size > MAX_PLAN_XML_BYTES) {
        rejectedXmlHeavy = true;
        continue;
      }
    }
    if (!capturaFiles.some((f) => f.name === file.name && f.size === file.size)) {
      capturaFiles.push(file);
      added++;
    }
  }
  if (rejectedHeavy) {
    alert("Ese video pesa más de 100 MB. Recomendamos subirlo en los comentarios del caso.");
  } else if (rejectedPdfHeavy) {
    alert("Ese PDF pesa más de 12 MB. Recomendamos subirlo en los comentarios del caso.");
  } else if (rejectedTxtHeavy) {
    alert("Ese TXT pesa más de 12 MB. Recomendamos subirlo en los comentarios del caso.");
  } else if (rejectedExcelHeavy) {
    alert("Ese Excel pesa más de 12 MB. Recomendamos subirlo en los comentarios del caso.");
  } else if (rejectedXmlHeavy) {
    alert("Ese XML pesa más de 12 MB. Recomendamos subirlo en los comentarios del caso.");
  } else if (rejectedVideo) {
    alert("Solo se permite 1 video MP4/WEBM de hasta 100 MB.");
  } else if (rejectedFormat && added === 0 && fileList?.length > 0) {
    alert("Solo se admiten imágenes (PNG, JPG, GIF, BMP, WEBP), PDF, TXT, Excel (.xlsx/.xls), XML (.xml) o video MP4/WEBM.");
  }
  if (added > 0) {
    const check = els.capturasCheck();
    if (check && !check.checked) {
      check.checked = true;
      onCapturasToggle();
    }
    refreshCapturasUi();
  }
}

function transferIaFieldDefs() {
  return [
    { id: "plan-asunto" },
    {
      id: "plan-descripcion",
      kind: "placeholder-textarea",
      placeholderActive: descripcionEsPlaceholder,
      onRestore: (ph) => { descripcionEsPlaceholder = ph; },
    },
  ];
}

function initTransferenciaIaUi() {
  syncIaUndoBar("plan-btn-ia", "plan-btn-ia-undo", planillasConfig?.iaConfigured);
  if (!transferIaUndo) {
    transferIaUndo = bindIaUndoButtons({
      undoBtnId: "plan-btn-ia-undo",
      getSnapshot: () => snapshotFields(transferIaFieldDefs()),
      onUndo: (snap) => restoreFields(transferIaFieldDefs(), snap),
    });
    document.getElementById("plan-btn-ia")?.addEventListener("click", mejorarTransferenciaIa);
    document.getElementById("plan-btn-ia-undo")?.addEventListener("click", () => transferIaUndo.undo());
  }
}

async function mejorarTransferenciaIa() {
  if (!validarCampos()) return;

  transferIaUndo?.saveSnapshot();
  const btn = document.getElementById("plan-btn-ia");
  if (btn) btn.disabled = true;
  setPlanStatus("");

  try {
    const response = await fetch("/api/planillas/transferencia/mejorar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      transferIaUndo?.clearSnapshot();
      throw new Error(data.detail || data.error || data.title || `Error ${response.status}`);
    }

    if (data.asunto) els.asunto().value = data.asunto;
    if (data.descripcion) {
      const desc = els.descripcion();
      desc.value = data.descripcion;
      desc.classList.remove("placeholder-active");
      descripcionEsPlaceholder = false;
    }
    setPlanStatus("");
    notifyIaUndoHint("plan-btn-ia-undo");
  } catch (ex) {
    setPlanStatus(ex.message, true);
    alert(ex.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function limpiarTransferencia() {
  mesaActual = null;
  legalProdutoSel = null;
  legalModuloSel = null;
  legalAmbienteSel = null;
  capturaFiles = [];
  descripcionEsPlaceholder = true;
  transferIaUndo?.clearSnapshot();

  els.numeroCliente().value = "";
  document.getElementById("plan-legal-chave") && (document.getElementById("plan-legal-chave").value = "");
  document.getElementById("plan-legal-usuario") && (document.getElementById("plan-legal-usuario").value = "");
  document.getElementById("plan-legal-escritorio") && (document.getElementById("plan-legal-escritorio").value = "");
  els.asunto().value = "";
  const desc = els.descripcion();
  desc.value = DESCRIPCION_PLACEHOLDER;
  desc.classList.add("placeholder-active");

  els.capturasCheck().checked = false;
  els.capturasPanel()?.classList.add("hidden");
  els.ticketCheck().checked = false;
  els.ticketPanel()?.classList.add("hidden");
  els.ticketNumero().value = "";
  styleTicketCard(false);

  refreshMesaUi();
  refreshLegalMesaUi();
  buildLegalTransPills();
  refreshCapturasUi();
  clearPlanTextPreview("plan-text-preview");
  setPlanStatus("");
}

function initTransferenciaForm() {
  els.sistemaBadge().textContent = sistemaBadgeLabel(sistemaActual);
  initTransferenciaIaUi();
  limpiarTransferencia();
  updateTransferenciaPanels();
}

function getDescripcionPlain() {
  if (descripcionEsPlaceholder) return "";
  return els.descripcion().value.trim();
}

function validarCampos() {
  if (isLegal()) {
    if (!document.getElementById("plan-legal-chave")?.value.trim()) {
      alert("Completá la clave de registro.");
      document.getElementById("plan-legal-chave")?.focus();
      return false;
    }
    if (!legalProdutoSel) {
      alert("Seleccioná el producto Legal One.");
      return false;
    }
    if (!legalModuloSel) {
      alert("Seleccioná el módulo.");
      return false;
    }
    if (!legalAmbienteSel) {
      alert("Seleccioná el ambiente.");
      return false;
    }
    if (!mesaActual) {
      alert("Elegí la mesa de destino.");
      return false;
    }
    if (!document.getElementById("plan-legal-usuario")?.value.trim()) {
      alert("Completá el usuario OnePass.");
      document.getElementById("plan-legal-usuario")?.focus();
      return false;
    }
    if (!document.getElementById("plan-legal-escritorio")?.value.trim()) {
      alert("Completá el estudio / empresa.");
      document.getElementById("plan-legal-escritorio")?.focus();
      return false;
    }
  } else {
    if (!els.numeroCliente().value.trim()) {
      alert("Completá el N° de Cliente.");
      els.numeroCliente().focus();
      return false;
    }
    if (!mesaActual) {
      alert(isChile()
        ? "Elegí la mesa de destino (Técnico o Funcional)."
        : "Elegí la mesa de destino (Técnico, Flex, SaaS o Sueldos).");
      return false;
    }
  }
  if (!els.asunto().value.trim()) {
    alert("Completá el campo Asunto y/o Error.");
    els.asunto().focus();
    return false;
  }
  return true;
}

function preguntarTicketLegal() {
  if (!isLegal() || els.ticketCheck().checked) return true;
  if (confirm("¿Se solicitó ticket de servicio?")) {
    els.ticketCheck().checked = true;
    onTicketToggle();
    els.ticketNumero().focus();
    return false;
  }
  return true;
}

function preguntarTicketSiSaasSueldos() {
  if (sistemaActual !== "BejermanSql" || (mesaActual !== "SAAS" && mesaActual !== "SUELDOS"))
    return true;
  if (els.ticketCheck().checked) return true;

  if (confirm("¿Se solicitó ticket de servicio?")) {
    els.ticketCheck().checked = true;
    onTicketToggle();
    els.ticketNumero().focus();
    return false;
  }
  return true;
}

function buildPayload() {
  const payload = {
    sistema: sistemaActual,
    numeroCliente: isLegal()
      ? document.getElementById("plan-legal-chave")?.value.trim() || ""
      : els.numeroCliente().value.trim(),
    mesa: mesaActual,
    asunto: els.asunto().value.trim(),
    descripcion: getDescripcionPlain() || null,
    capturas: els.capturasCheck().checked === true,
    ticketSolicitado: els.ticketCheck().checked === true,
    numeroTicket: els.ticketNumero().value.trim() || null,
  };

  if (isLegal()) {
    payload.legal = {
      produto: legalProdutoSel || "",
      modulo: legalModuloSel || "",
      ambiente: legalAmbienteSel || "",
      usuarioOnePass: document.getElementById("plan-legal-usuario")?.value.trim() || "",
      escritorio: document.getElementById("plan-legal-escritorio")?.value.trim() || "",
    };
  }

  return payload;
}

function setPlanStatus(text, isError = false) {
  const el = els.planStatus();
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? "#b91c1c" : "";
}

async function generarTexto() {
  if (!validarCampos()) return null;
  if (!preguntarTicketLegal() || !preguntarTicketSiSaasSueldos()) return null;

  const payload = buildPayload();

  const form = new FormData();
  form.append("payload", JSON.stringify(payload));

  if (payload.capturas && capturaFiles.length > 0) {
    capturaFiles.forEach((f) => form.append("capturas", f, f.name));
  }

  setPlanStatus("Generando planilla…");

  const response = await fetch("/api/planillas/transferencia/generar", {
    method: "POST",
    body: form,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.error || data.title || `Error ${response.status}`);
  }

  setPlanStatus("Planilla generada.");
  return data;
}

async function onCopiarAlPortapapeles() {
  const btn = els.btnCopiar();
  if (!btn) return;
  btn.disabled = true;
  try {
    const data = await generarTexto();
    if (!data?.texto) return;
    await navigator.clipboard.writeText(data.texto);
    limpiarTransferencia();
    setPlanStatus("Texto copiado al portapapeles.");
  } catch (ex) {
    setPlanStatus(ex.message, true);
    alert(ex.message);
  } finally {
    btn.disabled = false;
  }
}

async function onVerPlanilla() {
  const btn = els.btnVerPlanilla();
  if (!btn) return;
  btn.disabled = true;
  try {
    const data = await generarTexto();
    if (!data?.texto) return;
    const texto = data.texto;
    limpiarTransferencia();
    showPlanTextPreview("plan-text-preview", texto);
    setPlanStatus("Planilla lista. Podés copiar desde el panel de vista previa.");
  } catch (ex) {
    setPlanStatus(ex.message, true);
    alert(ex.message);
  } finally {
    btn.disabled = false;
  }
}

function openPlaceholder(moduleTitle) {
  els.placeholderTitle().textContent = moduleTitle;
  els.placeholderText().textContent =
    sistemaActual === "Chile"
      ? "Chile está en versión beta y estará disponible en una próxima versión."
      : sistemaActual === "Legal"
        ? "El módulo LEGAL estará disponible en una próxima versión."
        : `${moduleTitle} se migrará en una próxima fase. Por ahora usá Transferencia de Casos.`;
  showView("placeholder");
}

function setModuleLoading(overlayId, active) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  overlay.classList.toggle("hidden", !active);
  overlay.setAttribute("aria-busy", active ? "true" : "false");
}

function readChileEmbedSession() {
  return readEmbedSession(CHILE_EMBED_STORAGE_KEY, "Soporte técnico Chile");
}

function readEmbedSession(key, defaultTitle) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.url) return null;
    return { url: String(data.url), title: String(data.title || defaultTitle) };
  } catch {
    return null;
  }
}

function writeChileEmbedSession(url, title) {
  writeEmbedSession(CHILE_EMBED_STORAGE_KEY, url, title);
}

function writeEmbedSession(key, url, title) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ url, title }));
  } catch { /* ignore */ }
}

function clearChileEmbedSession() {
  clearEmbedSession(CHILE_EMBED_STORAGE_KEY);
}

function clearEmbedSession(key) {
  try {
    sessionStorage.removeItem(key);
  } catch { /* ignore */ }
}

function closeChileEmbedMenu() {
  chileEmbedMenuOpen = false;
  document.getElementById("plan-chile-embed-menu")?.classList.add("hidden");
  document.getElementById("plan-chile-embed-menu-btn")?.setAttribute("aria-expanded", "false");
}

function toggleChileEmbedMenu() {
  const menu = document.getElementById("plan-chile-embed-menu");
  const btn = document.getElementById("plan-chile-embed-menu-btn");
  if (!menu || !btn) return;
  chileEmbedMenuOpen = !chileEmbedMenuOpen;
  menu.classList.toggle("hidden", !chileEmbedMenuOpen);
  btn.setAttribute("aria-expanded", chileEmbedMenuOpen ? "true" : "false");
}

function closeChileEmbed({ clearFrame = true } = {}) {
  clearChileEmbedLoadTimer();
  hideChileEmbedFallback();
  closeChileEmbedMenu();
  if (clearFrame) {
    const frame = document.getElementById("planChileEmbedFrame");
    if (frame) frame.removeAttribute("src");
    chileEmbedUrl = "";
    chileEmbedTitle = "";
    clearChileEmbedSession();
  }
}

function goBackToChileHome() {
  closeChileEmbed();
  selectSistema("Chile");
  document.dispatchEvent(new CustomEvent("st2:planillas-home"));
  showView("menu", { history: "replace" });
  void refreshModuleFlags().then(() => updateSistemaUi());
}

function clearChileEmbedLoadTimer() {
  if (chileEmbedLoadTimer) {
    window.clearTimeout(chileEmbedLoadTimer);
    chileEmbedLoadTimer = null;
  }
}

function hideChileEmbedFallback() {
  document.getElementById("plan-chile-embed-fallback")?.classList.add("hidden");
}

function showChileEmbedFallback() {
  document.getElementById("plan-chile-embed-fallback")?.classList.remove("hidden");
}

function openChileEmbedInBrowser() {
  if (!chileEmbedUrl) return;
  window.open(chileEmbedUrl, "_blank", "noopener,noreferrer");
}

function reloadChileEmbed() {
  const frame = document.getElementById("planChileEmbedFrame");
  if (!frame || !chileEmbedUrl) return;
  hideChileEmbedFallback();
  document.getElementById("plan-chile-embed-loading")?.classList.remove("hidden");
  clearChileEmbedLoadTimer();
  chileEmbedLoadTimer = window.setTimeout(() => {
    showChileEmbedFallback();
    document.getElementById("plan-chile-embed-loading")?.classList.add("hidden");
  }, 12000);
  try {
    frame.src = chileEmbedUrl;
  } catch {
    frame.setAttribute("src", chileEmbedUrl);
  }
}

function openChileEmbed(url, title) {
  chileEmbedUrl = String(url || "").trim();
  if (!chileEmbedUrl) return;
  chileEmbedTitle = title || "Soporte técnico Chile";
  writeChileEmbedSession(chileEmbedUrl, chileEmbedTitle);
  selectSistema("Chile");
  const titleEl = document.getElementById("plan-chile-embed-title");
  const frame = document.getElementById("planChileEmbedFrame");
  if (titleEl) titleEl.textContent = chileEmbedTitle;
  if (frame) frame.title = chileEmbedTitle;
  const onMenu = !document.getElementById("planillas-menu")?.classList.contains("hidden");
  showView("chileEmbed", { history: onMenu ? "push" : "replace" });
  reloadChileEmbed();
}

function bindChileEmbedUi() {
  document.querySelectorAll("[data-plan-embed-url]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!canSeeChileEmbedButton(btn)) return;
      const url = btn.getAttribute("data-plan-embed-url");
      const title = btn.querySelector(".plan-modulo-label")?.textContent?.trim() || "Soporte técnico Chile";
      openChileEmbed(url, title);
    });
  });

  const backBtn = document.getElementById("plan-chile-embed-back");
  backBtn?.addEventListener("click", () => goBackToChileHome());

  document.getElementById("plan-chile-embed-menu-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleChileEmbedMenu();
  });

  document.querySelectorAll("[data-chile-embed-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-chile-embed-action");
      closeChileEmbedMenu();
      if (action === "reload") reloadChileEmbed();
      else if (action === "open") openChileEmbedInBrowser();
    });
  });

  document.getElementById("plan-chile-embed-fallback-open")?.addEventListener("click", () => openChileEmbedInBrowser());

  document.addEventListener("click", (e) => {
    if (!chileEmbedMenuOpen) return;
    if (e.target.closest(".plan-chile-embed-nav")) return;
    closeChileEmbedMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && chileEmbedMenuOpen) closeChileEmbedMenu();
  });

  const frame = document.getElementById("planChileEmbedFrame");
  frame?.addEventListener("load", () => {
    clearChileEmbedLoadTimer();
    document.getElementById("plan-chile-embed-loading")?.classList.add("hidden");
  });
}

function openReferralShell(historyMode = "push") {
  const badge = document.getElementById("ref-sistema-badge");
  if (badge) badge.textContent = sistemaBadgeLabel(sistemaActual);
  setModuleLoading("plan-referral-loading", true);
  showView("referral", { history: historyMode });
}

function goBackToPlanillasMenu() {
  closeChileEmbed();
  document.dispatchEvent(new CustomEvent("st2:planillas-home"));
  // Nunca history.back(): con varias vistas/pestañas ST2 en el stack (THOM, AI, otro módulo)
  // el atrás del navegador te puede tirar a otra pestaña o a un refresh raro.
  showView("menu", { history: "replace" });
  void refreshModuleFlags().then(() => updateSistemaUi());
}

function goBackToOportunidadMenu() {
  void revealView("oportunidadMenu", "replace");
}

async function revealView(name, historyMode = "push") {
  if (name === "menu" || name === "placeholder") {
    if (name === "menu") {
      document.dispatchEvent(new CustomEvent("st2:planillas-home"));
    }
    showView(name, { history: historyMode });
    if (name === "menu") {
      void refreshModuleFlags().then(() => updateSistemaUi());
    }
    return;
  }

  if (name === "transferencia") {
    if (!sistemaActual || !canSeeSistema(sistemaActual) || isSistemaPlaceholder(sistemaActual)) {
      showView("menu", { history: "replace" });
      return;
    }
    initTransferenciaForm();
    showView("transferencia", { history: historyMode });
    autoTour(`transferencia:${sistemaActual}`, { delay: 550 });
    return;
  }

  if (name === "referral") {
    if (!sistemaActual || !canSeeSistema(sistemaActual) || isSistemaPlaceholder(sistemaActual)) {
      showView("menu", { history: "replace" });
      return;
    }
    const legalProductId = pendingLegalProductId;
    const legalDirectOpen = isLegal() && !!legalProductId;
    if (legalDirectOpen) {
      showView("referral", { history: historyMode });
    } else {
      openReferralShell(historyMode);
    }
    try {
      const mod = await loadReferralModule();
      pendingLegalProductId = null;
      await mod.openReferral({ legalProductId });
      showView("referral", { history: historyMode });
    } finally {
      setModuleLoading("plan-referral-loading", false);
    }
    return;
  }

  if (name === "oportunidadMenu" || name === "oportunidadCargar" || name === "oportunidadGestor") {
    if (!canSeeOportunidadModule() || !sistemaActual || isSistemaPlaceholder(sistemaActual) || hidesCommercialModules()) {
      showView("menu", { history: "replace" });
      return;
    }
    const mod = await loadOportunidadModule();
    if (name === "oportunidadCargar") {
      mod.openOportunidadCargar();
      showView("oportunidadCargar", { history: historyMode });
      return;
    }
    if (name === "oportunidadGestor") {
      await mod.openOportunidadGestor();
      if (!views.oportunidadGestor?.classList.contains("hidden")) {
        showView("oportunidadGestor", { history: historyMode });
      }
      return;
    }
    mod.openOportunidadMenu();
    showView("oportunidadMenu", { history: historyMode });
    autoTour("oportunidad-menu", { delay: 550 });
    return;
  }

  if (name === "pdfPortal") {
    if (!canSeePdfPortalModule() || hidesCommercialModules()) {
      showView("menu", { history: "replace" });
      return;
    }
    showView("menu", { history: historyMode });
    openPdfPortalModal();
    return;
  }

  if (name === "blanqueo") {
    if (!canSeeBlanqueoModule() || hidesCommercialModules()) {
      showView("menu", { history: "replace" });
      return;
    }
    showView("blanqueo", { history: historyMode });
    await openBlanqueoModule();
    return;
  }

  if (name === "borradoBases") {
    if (!canSeeBorradoBasesModule() || hidesCommercialModules()) {
      showView("menu", { history: "replace" });
      return;
    }
    showView("borradoBases", { history: historyMode });
    await openBorradoBasesModule();
    return;
  }

  if (name === "chileEmbed") {
    if (!chileEmbedUrl) {
      const saved = readChileEmbedSession();
      if (saved) {
        chileEmbedUrl = saved.url;
        chileEmbedTitle = saved.title;
      }
    }
    if (!canSeeSistema("Chile") || !chileEmbedUrl) {
      goBackToChileHome();
      return;
    }
    selectSistema("Chile");
    const titleEl = document.getElementById("plan-chile-embed-title");
    const frame = document.getElementById("planChileEmbedFrame");
    if (titleEl) titleEl.textContent = chileEmbedTitle || "Soporte técnico Chile";
    if (frame) frame.title = chileEmbedTitle || "Soporte técnico Chile";
    showView("chileEmbed", { history: historyMode });
    if (!frame?.getAttribute("src")) reloadChileEmbed();
  }
}

async function applyEntryRoute() {
  const route = routeFromPath(window.location.pathname);
  if (route.foreign) return;
  if (route.sistema) {
    selectSistema(route.sistema);
  } else if (route.view === "transferencia" || route.view === "referral") {
    selectSistema(readRememberedSistema());
  }

  if (route.unknown || route.view === "menu" || !canOpenRoute(route)) {
    showView("menu", { history: "replace" });
    return;
  }

  // Deja el menú debajo en el historial: atrás del navegador no sale de ST2.
  window.history.replaceState({ st2: "menu", sistema: sistemaActual }, "", "/");
  if (route.view === "oportunidadCargar" || route.view === "oportunidadGestor") {
    await revealView("oportunidadMenu", "push");
  }
  await revealView(route.view, "push");
}

function bindPlanillasRouting() {
  window.addEventListener("popstate", () => {
    if (!isPlanillasPath(window.location.pathname)) return;
    const fromState = window.history.state?.st2;
    const route = fromState
      ? { view: fromState, requires: routeFromPath(pathForView(fromState)).requires, sistema: window.history.state?.sistema }
      : routeFromPath(window.location.pathname);
    if (route.sistema) selectSistema(route.sistema);
    void (async () => {
      routeSyncing = true;
      try {
        if (!canOpenRoute(route) || route.unknown) {
          if (route.view === "chileEmbed") {
            goBackToChileHome();
            return;
          }
          showView("menu", { history: "replace" });
          return;
        }
        if (route.view === "menu") {
          closeChileEmbed();
        }
        await revealView(route.view, "none");
      } finally {
        routeSyncing = false;
      }
    })();
  });
}

function bindSistemaIndicatorLayout() {
  const grid = document.querySelector(".plan-sistema-grid");
  if (!grid) return;

  const sync = () => requestAnimationFrame(refreshSistemaIndicator);
  window.addEventListener("resize", sync);
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(sync);
    observer.observe(grid);
  }
  sync();
}

function bindEvents() {
  els.sistemaBtns().forEach((btn) => {
    btn.addEventListener("click", () => selectSistema(btn.dataset.planSistema));
  });

  document.querySelector('[data-plan-modulo="transferencia"]')?.addEventListener("click", () => {
    void revealView("transferencia");
  });

  document.querySelector('[data-plan-modulo="referral"]')?.addEventListener("click", () => {
    void revealView("referral");
  });

  document.querySelector('[data-plan-modulo="referral"]')?.addEventListener("pointerenter", () => {
    void loadReferralModule();
  }, { passive: true });

  document.querySelector('[data-plan-modulo="oportunidad"]')?.addEventListener("click", () => {
    void revealView("oportunidadMenu");
  });

  document.querySelector('[data-plan-modulo="pdf-portal"]')?.addEventListener("click", () => {
    void revealView("pdfPortal");
  });

  document.querySelector('[data-plan-modulo="blanqueo"]')?.addEventListener("click", () => {
    void revealView("blanqueo");
  });

  document.querySelector('[data-plan-modulo="borrado-bases"]')?.addEventListener("click", () => {
    void revealView("borradoBases");
  });

  document.addEventListener("st2:open-blanqueo-from-alert", () => {
    void revealView("blanqueo");
  });

  document.addEventListener("st2:open-borrado-from-alert", () => {
    void revealView("borradoBases");
  });

  document.querySelectorAll("[data-plan-back]").forEach((btn) => {
    btn.addEventListener("click", () => goBackToPlanillasMenu());
  });

  document.getElementById("plan-standard-mesas")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mesa]");
    if (btn) toggleMesa(btn.dataset.mesa);
  });

  document.getElementById("plan-trans-legal-panel")?.addEventListener("click", (e) => {
    const prod = e.target.closest("[data-legal-produto]");
    const mod = e.target.closest("[data-legal-modulo]");
    const amb = e.target.closest("[data-legal-ambiente]");
    const mesa = e.target.closest("[data-legal-mesa]");
    if (prod) {
      const val = prod.dataset.legalProduto;
      legalProdutoSel = legalProdutoSel === val ? null : val;
      buildLegalTransPills();
    }
    if (mod) {
      const val = mod.dataset.legalModulo;
      legalModuloSel = legalModuloSel === val ? null : val;
      buildLegalTransPills();
    }
    if (amb) {
      const val = amb.dataset.legalAmbiente;
      legalAmbienteSel = legalAmbienteSel === val ? null : val;
      buildLegalTransPills();
    }
    if (mesa) toggleLegalMesa(mesa.dataset.legalMesa);
  });

  els.capturasCard()?.addEventListener("click", (e) => {
    if (e.target.closest("button, input, label")) return;
    const check = els.capturasCheck();
    check.checked = !check.checked;
    onCapturasToggle();
  });

  els.capturasCheck()?.addEventListener("change", onCapturasToggle);

  els.capturasInput()?.addEventListener("change", (e) => {
    addCapturaFiles(e.target.files);
    e.target.value = "";
  });

  document.getElementById("plan-capturas-agregar")?.addEventListener("click", () => {
    els.capturasInput()?.click();
  });

  document.getElementById("plan-ticket-card")?.addEventListener("click", () => {
    const c = els.ticketCheck();
    if (!c) return;
    c.checked = !c.checked;
    onTicketToggle();
  });

  els.ticketCheck()?.addEventListener("change", onTicketToggle);

  const desc = els.descripcion();
  desc?.addEventListener("focus", () => {
    if (!descripcionEsPlaceholder) return;
    desc.value = "";
    desc.classList.remove("placeholder-active");
    descripcionEsPlaceholder = false;
  });
  desc?.addEventListener("blur", () => {
    if (desc.value.trim()) return;
    desc.value = DESCRIPCION_PLACEHOLDER;
    desc.classList.add("placeholder-active");
    descripcionEsPlaceholder = true;
  });

  els.numeroCliente()?.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "");
  });

  els.btnCopiar()?.addEventListener("click", onCopiarAlPortapapeles);
  els.btnVerPlanilla()?.addEventListener("click", onVerPlanilla);
  mountPlanTextPreview("plan-text-preview");
  document.getElementById("plan-btn-limpiar")?.addEventListener("click", limpiarTransferencia);
}

async function loadConfig() {
  try {
    const response = await fetch("/api/planillas/config", { cache: "no-store" });
    if (response.ok) planillasConfig = await response.json();
  } catch {
    planillasConfig = null;
  }
}

const planillasContext = {
  showView,
  getSistema: () => sistemaActual,
  getConfig: () => planillasConfig,
  goPlanillasMenu: goBackToPlanillasMenu,
  goOportunidadMenu: goBackToOportunidadMenu,
  syncReferralModuleLabels,
  openLegalProduct: (productId) => {
    pendingLegalProductId = productId;
    void revealView("referral");
  },
  getPendingLegalProductId: () => pendingLegalProductId,
};

let referralModulePromise = null;
let oportunidadModulePromise = null;

function loadReferralModule() {
  if (!referralModulePromise) {
    referralModulePromise = import("./planillas-referral.js").then((mod) => {
      mod.initReferralModule(planillasContext);
      return mod;
    });
  }
  return referralModulePromise;
}

function loadOportunidadModule() {
  if (!oportunidadModulePromise) {
    oportunidadModulePromise = import("./planillas-oportunidad.js").then((mod) => {
      mod.initOportunidadModule(planillasContext);
      return mod;
    });
  }
  return oportunidadModulePromise;
}

export function goPlanillasHome({ history = "replace" } = {}) {
  if (!views.menu) return;
  document.dispatchEvent(new CustomEvent("st2:planillas-home"));
  showView("menu", { history });
  selectSistema(sistemaActual || readRememberedSistema());
  void refreshModuleFlags().then(() => {
    updateSistemaUi();
  });
}

function effectivePlanillasEmail() {
  const viewAs = getViewAsProfile();
  if (viewAs?.email) return String(viewAs.email).trim().toLowerCase();
  return String(getPlanUserEmail() || "").trim().toLowerCase();
}

let balloonTimer = null;
let balloonLayer = null;

function stopEasterBalloons() {
  if (balloonTimer) {
    window.clearTimeout(balloonTimer);
    balloonTimer = null;
  }
  balloonLayer?.replaceChildren();
}

function spawnEasterBalloon() {
  if (!balloonLayer) return;
  const colors = ["#f43f5e", "#3b82f6", "#f59e0b", "#ec4899", "#22c55e", "#a855f7", "#06b6d4", "#fb7185"];
  const el = document.createElement("span");
  const scale = 0.85 + Math.random() * 0.7;
  el.className = "st2-x-balloon";
  const sides = document.body.classList.contains("st2-balloons-sides");
  const left = sides
    ? (Math.random() < 0.5 ? 1 + Math.random() * 8 : 90 + Math.random() * 8)
    : 4 + Math.random() * 92;
  el.style.left = `${left}%`;
  el.style.setProperty("--st2-balloon-color", colors[Math.floor(Math.random() * colors.length)]);
  el.style.setProperty("--st2-balloon-drift", `${Math.round((Math.random() * 2 - 1) * (sides ? 18 : 72))}px`);
  el.style.setProperty("--st2-balloon-dur", `${5.5 + Math.random() * 3.5}s`);
  el.style.setProperty("--st2-balloon-scale", scale.toFixed(2));
  el.innerHTML = `<span class="st2-x-balloon-body"></span><span class="st2-x-balloon-string"></span>`;
  balloonLayer.appendChild(el);
  window.setTimeout(() => el.remove(), 11000);
}

function spawnEasterBalloonBurst(count) {
  for (let i = 0; i < count; i += 1) {
    window.setTimeout(() => spawnEasterBalloon(), i * 90);
  }
}

function scheduleEasterBalloon() {
  spawnEasterBalloonBurst(3 + Math.floor(Math.random() * 3));
  balloonTimer = window.setTimeout(scheduleEasterBalloon, 1800 + Math.random() * 1600);
}

function syncEasterBalloons(egg) {
  const on = !!(egg?.balloons && isEggBirthdayWindow(egg));
  if (!on) {
    stopEasterBalloons();
    balloonLayer?.classList.add("hidden");
    return;
  }
  if (!balloonLayer) {
    balloonLayer = document.createElement("div");
    balloonLayer.id = "st2-x-balloons";
    balloonLayer.className = "st2-x-balloons";
    balloonLayer.setAttribute("aria-hidden", "true");
    document.body.appendChild(balloonLayer);
  }
  balloonLayer.classList.remove("hidden");
  if (!balloonTimer) {
    spawnEasterBalloonBurst(10);
    scheduleEasterBalloon();
  }
}

function isTitanPeekImage(peekSrc) {
  return /\.(gif|png|jpe?g|webp|avif)(\?|$)/i.test(String(peekSrc || ""));
}

function syncPlanillasHeroEaster() {
  const email = effectivePlanillasEmail();
  const egg = resolvePlanillasEgg(email);
  const showEgg = !!egg && isEggBirthdayWindow(egg);
  const showVisual = showEgg && !!egg?.src;
  const heroBanner = !!(showEgg && egg?.heroBanner);
  const behindTitle = !!(showEgg && egg?.behindTitle && !heroBanner);
  const sideLeft = !!(showEgg && egg?.side === "left");
  document.querySelector(".planillas-hero")?.classList.toggle("is-easter-banner", heroBanner);
  document.querySelector(".planillas-hero")?.classList.toggle("is-easter-behind", behindTitle);
  document.querySelector(".planillas-hero")?.classList.toggle("is-easter-side-left", sideLeft);
  document.querySelectorAll(".planillas-view .plan-module-sticky-head").forEach((head) => {
    if (head.querySelector(".planillas-corner-easter")) return;
    const img = document.createElement("img");
    img.className = "planillas-corner-easter is-hidden";
    img.alt = "";
    img.width = 44;
    img.height = 44;
    img.decoding = "async";
    img.setAttribute("aria-hidden", "true");
    head.appendChild(img);
  });
  document.querySelectorAll(".planillas-hero-easter, .planillas-corner-easter").forEach((el) => {
    const isHero = el.classList.contains("planillas-hero-easter");
    if (showVisual && egg?.src) el.src = egg.src;
    else el.removeAttribute("src");
    el.classList.toggle("is-wag", egg?.motion === "wag");
    el.classList.toggle("is-still", egg?.motion === "still");
    el.classList.toggle("is-side-left", isHero && sideLeft);
    el.classList.toggle("is-md", !isHero && egg?.size === "md" && !heroBanner);
    el.classList.toggle("is-lg", (!isHero && (egg?.size === "lg" || egg?.size === "xl") && !heroBanner)
      || (isHero && behindTitle && egg?.size === "lg"));
    el.classList.toggle("is-xl", (!isHero && egg?.size === "xl" && !heroBanner)
      || (isHero && behindTitle && egg?.size === "xl"));
    el.classList.toggle("is-hero-banner", isHero && heroBanner);
    el.classList.toggle("is-behind-title", isHero && behindTitle);
    el.classList.toggle("is-smooth", !!(showEgg && egg?.heroBanner));
    el.classList.toggle("is-hidden", !showVisual);
    el.setAttribute("aria-hidden", showVisual ? "false" : "true");
  });
  syncEasterBalloons(showEgg ? egg : null);
  const hero = document.querySelector("#planillas-menu .planillas-hero");
  const titan = document.getElementById("planillas-hero-titan");
  const titanImg = document.getElementById("planillas-hero-titan-img");
  const peek = !!(showEgg && egg?.peekSrc);
  const peekImage = peek && isTitanPeekImage(egg.peekSrc);
  hero?.classList.toggle("has-titan-peek", peek);
  hero?.classList.toggle("has-titan-peek-img", peekImage);
  hero?.classList.toggle("is-palermo-hero", !!(peekImage && egg?.peekHeroTall));
  if (titan) {
    const srcEl = document.getElementById("planillas-hero-titan-src");
    titan.muted = true;
    titan.defaultMuted = true;
    titan.playsInline = true;
    titan.loop = true;
    if (peek && !peekImage) {
      if (titan.dataset.peekSrc !== egg.peekSrc) {
        if (srcEl) srcEl.src = egg.peekSrc;
        else titan.src = egg.peekSrc;
        titan.dataset.peekSrc = egg.peekSrc;
        titan.load();
      }
    } else {
      titan.pause();
      if (srcEl) srcEl.removeAttribute("src");
      titan.removeAttribute("src");
      delete titan.dataset.peekSrc;
      titan.load();
    }
    titan.classList.toggle("is-hidden", !peek || peekImage);
    titan.setAttribute("aria-hidden", peek && !peekImage ? "false" : "true");
  }
  if (titanImg) {
    if (peek && peekImage) {
      if (titanImg.dataset.peekSrc !== egg.peekSrc) {
        titanImg.src = egg.peekSrc;
        titanImg.dataset.peekSrc = egg.peekSrc;
      }
    } else {
      titanImg.removeAttribute("src");
      delete titanImg.dataset.peekSrc;
    }
    titanImg.classList.toggle("is-hidden", !peek || !peekImage);
    titanImg.setAttribute("aria-hidden", peek && peekImage ? "false" : "true");
  }
  const hotspot = document.getElementById("planillas-hero-titan-hotspot");
  hotspot?.classList.toggle("is-hidden", !peekImage);
  hotspot?.setAttribute("aria-hidden", peekImage ? "false" : "true");
  hero?.classList.remove("is-titan-img-active");
  bindTitanPeekHover();
}

function bindTitanPeekHover() {
  const hero = document.querySelector("#planillas-menu .planillas-hero");
  const hotspot = document.getElementById("planillas-hero-titan-hotspot");
  if (!hero) return;

  if (hero.dataset.titanPeekBound !== "1") {
    hero.dataset.titanPeekBound = "1";
    hero.addEventListener("mouseenter", () => {
      if (hero.classList.contains("has-titan-peek-img")) return;
      const titan = document.getElementById("planillas-hero-titan");
      if (titan && !titan.classList.contains("is-hidden") && titan.dataset.peekSrc) {
        titan.play().catch(() => {});
      }
    });
    hero.addEventListener("mouseleave", () => {
      if (hero.classList.contains("has-titan-peek-img")) return;
      const titan = document.getElementById("planillas-hero-titan");
      if (titan && !titan.classList.contains("is-hidden")) {
        titan.pause();
        try {
          titan.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
    });
  }

  if (!hotspot || hotspot.dataset.titanHotspotBound === "1") return;
  hotspot.dataset.titanHotspotBound = "1";
  hotspot.addEventListener("mouseenter", () => {
    if (!hero.classList.contains("has-titan-peek-img")) return;
    hero.classList.add("is-titan-img-active");
  });
  hotspot.addEventListener("mouseleave", () => {
    hero.classList.remove("is-titan-img-active");
  });
}

export function initPlanillas() {
  if (!views.menu) return Promise.resolve();

  setTourContext({
    getSistema: () => sistemaActual,
    getPlanillasView: () => currentPlanillasView,
  });
  initSt2Tours();

  injectModuleHeaders();
  initTransferenciaIaUi();
  bindEvents();
  bindSistemaIndicatorLayout();
  bindPlanillasRouting();
  selectSistema(readRememberedSistema());
  initPdfPortalGenerator();
  syncPdfPortalModuleVisibility();
  initBlanqueoModule();
  syncBlanqueoModuleVisibility();
  initBorradoBasesModule();
  syncBorradoBasesModuleVisibility();
  bindChileEmbedUi();
  syncPlanillasHeroEaster();
  syncAguaEgg();
  document.addEventListener("st2:session-changed", syncPlanillasHeroEaster);
  document.addEventListener("st2:view-as-changed", syncPlanillasHeroEaster);
  document.addEventListener("st2:session-changed", syncAguaEgg);
  document.addEventListener("st2:view-as-changed", syncAguaEgg);
  showView("menu", { history: "none" });

  return Promise.all([refreshModuleFlags({ baseline: true }), loadConfig()]).then(async () => {
    updatePlanBuildBadge(planillasConfig?.webBuild);
    updateSistemaUi();
    syncPlanillasHeroEaster();
    syncAguaEgg();
    if (planillasConfig?.webBuild) {
      console.info(`[ST2 Planillas] build: ${planillasConfig.webBuild}`);
    }
    startBlanqueoAlertsPolling();
    startBorradoAlertsPolling();
    startAccessAlertsPolling();
    startModuleAccessPolling();
    renderBlanqueoAlertUi();
    renderBorradoAlertUi();
    renderAccessAlertUi();
    document.addEventListener("st2:modules-access-changed", () => {
      updateSistemaUi();
    });
    document.addEventListener("st2:modules-flags-refreshed", () => {
      updateSistemaUi();
    });
    await applyEntryRoute();
    setTimeout(() => {
      void loadReferralModule();
      void loadOportunidadModule();
    }, 2500);
  });
}
