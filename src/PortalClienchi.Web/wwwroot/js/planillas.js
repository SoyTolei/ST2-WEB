import { injectModuleHeaders } from "./planillas-icons.js";
import { snapshotFields, restoreFields, bindIaUndoButtons, syncIaUndoBar } from "./plan-ia-undo.js";
import { updatePlanBuildBadge } from "./plan-build.js";
import { showPlanTextPreview, clearPlanTextPreview, mountPlanTextPreview } from "./plan-text-preview.js";
import { initPdfPortalGenerator, syncPdfPortalModuleVisibility, canSeePdfPortalModule } from "./pdf-portal.js";
import { initBlanqueoModule, syncBlanqueoModuleVisibility, canSeeBlanqueoModule, openBlanqueoModule } from "./planillas-blanqueo.js";
import { initBorradoBasesModule, syncBorradoBasesModuleVisibility, canSeeBorradoBasesModule, openBorradoBasesModule } from "./planillas-borrado-bases.js";
import { refreshModuleFlags, canSeeOportunidadModule, startModuleAccessPolling, getViewAsProfile } from "./module-access.js";
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

const PLANILLAS_EASTER_EGGS = [
  {
    email: "yohana.colacci@thomsonreuters.com",
    src: "/img/yohana-corner.png?v=6",
    motion: "bob",
  },
  {
    email: "belen.foschiatti@thomsonreuters.com",
    src: "/img/belen-corner.gif?v=2",
    motion: "still",
    size: "lg",
  },
  {
    email: "gisela.crosenzi@thomsonreuters.com",
    src: "/img/gisela-corner.gif?v=4",
    motion: "still",
    heroBanner: true,
    balloons: true,
    birthdayMonth: 8,
    birthdayFromDay: 24,
    birthdayDay: 25,
  },
];

const DESCRIPCION_PLACEHOLDER = "Detalle y/o proceso realizado por el usuario";

const MESA_LABELS = {
  TECNICO: "TECNICOS",
  FLEX: "FLEX",
  SAAS: "SaaS",
  SUELDOS: "Sueldos y Jornales",
};

const SISTEMA_LABELS = {
  BejermanSql: "Bejerman SQL",
  OnvioWeb: "ONVIO/Bejerman WEB",
  Legal: "LEGAL",
  Chile: "Chile",
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

function syncSistemaDataset() {
  document.body.dataset.planSistema = sistemaActual || "";
}

function updateSistemaBetaUi() {
  document.getElementById("plan-legal-beta-pill")?.classList.toggle("hidden", !isSistemaBeta("Legal"));
  document.getElementById("plan-chile-beta-pill")?.classList.toggle("hidden", !isSistemaBeta("Chile"));
}

let planillasConfig = null;
let sistemaActual = null;
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
  pdfPortal: document.getElementById("planillas-pdf-portal"),
  blanqueo: document.getElementById("planillas-blanqueo"),
  borradoBases: document.getElementById("planillas-borrado-bases"),
};

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
  mesaBtns: () => document.querySelectorAll("[data-mesa]"),
  mesaHint: () => document.getElementById("plan-mesa-hint"),
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
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  return "BejermanSql";
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
    default: return { view: "menu", unknown: true };
  }
}

function canOpenRoute(route) {
  if (!route?.requires) return true;
  if (route.requires === "oportunidad") return canSeeOportunidadModule() && !hidesCommercialModules();
  if (route.requires === "pdf") return canSeePdfPortalModule() && !hidesCommercialModules();
  if (route.requires === "blanqueo") return canSeeBlanqueoModule() && !hidesCommercialModules();
  if (route.requires === "borrado-bases") return canSeeBorradoBasesModule() && !hidesCommercialModules();
  const sys = route.sistema || sistemaActual;
  if (route.requires === "transferencia") {
    return !!sys && !isSistemaPlaceholder(sys);
  }
  if (route.requires === "referral") {
    return !!sys && !isSistemaPlaceholder(sys);
  }
  return true;
}

function titleForView(name) {
  switch (name) {
    case "transferencia": return "ST2 · Transferencia";
    case "referral": return "ST2 · Referral I+D";
    case "oportunidadMenu":
    case "oportunidadCargar":
    case "oportunidadGestor": return "ST2 · Oportunidad";
    case "pdfPortal": return "ST2 · Generador PDF";
    case "blanqueo": return "ST2 · Blanqueo";
    case "borradoBases": return "ST2 · Borrado de Bases Web";
    default: return "ST2";
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
  Object.entries(views).forEach(([key, el]) => {
    if (!el) return;
    el.classList.toggle("hidden", key !== name);
  });
  document.body.classList.toggle("st2-balloons-sides", name !== "menu");
  injectModuleHeaders();
  document.title = titleForView(name);
  syncHistory(name, history);
  if (name === "menu") renderBlanqueoAlertUi();
}

function setSistemaIndicator(index) {
  const grid = document.querySelector(".plan-sistema-grid");
  const indicator = els.sistemaIndicator();
  const btn = [...els.sistemaBtns()][index];
  if (!grid || !indicator || !btn) return;

  const gridRect = grid.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  const width = Math.max(0, Math.min(btnRect.width, gridRect.width));
  const left = Math.max(0, Math.min(btnRect.left - gridRect.left, gridRect.width - width));
  indicator.style.width = `${width}px`;
  indicator.style.transform = `translate3d(${left}px, 0, 0)`;
}

function refreshSistemaIndicator() {
  const index = SISTEMA_INDEX[sistemaActual] ?? 0;
  setSistemaIndicator(index);
}

function updateSistemaUi() {
  const index = SISTEMA_INDEX[sistemaActual] ?? 0;
  els.sistemaBtns().forEach((btn) => {
    const active = btn.dataset.planSistema === sistemaActual;
    btn.classList.toggle("active", active);
  });
  setSistemaIndicator(index);
  syncSistemaDataset();

  const transferBtn = document.getElementById("plan-modulo-transferencia");
  const transferNa = document.getElementById("plan-modulo-transferencia-na");
  const referralBtn = document.querySelector('[data-plan-modulo="referral"]');
  const oportunidadBtn = document.querySelector('[data-plan-modulo="oportunidad"]');
  const oportunidadNa = document.getElementById("plan-modulo-oportunidad-na");
  const placeholderBlocked = !sistemaActual || isSistemaPlaceholder(sistemaActual);
  const hideCommercial = hidesCommercialModules();

  if (transferBtn) {
    transferBtn.classList.remove("hidden");
    transferBtn.disabled = placeholderBlocked;
  }
  if (transferNa) {
    transferNa.classList.add("hidden");
    transferNa.setAttribute("aria-hidden", "true");
  }
  if (referralBtn) referralBtn.disabled = placeholderBlocked;

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
  renderBlanqueoAlertUi();
  updateSistemaBetaUi();
}

function selectSistema(id) {
  const normalized = normalizeSistemaId(id);
  if (!normalized) return;
  sistemaActual = normalized;
  rememberSistema(normalized);
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

function buildLegalMesas() {
  const row = document.getElementById("plan-legal-mesas");
  const cfg = planillasConfig?.legal;
  if (!row || !cfg?.mesas) return;

  row.innerHTML = cfg.mesas.map((m) =>
    `<button type="button" class="plan-mesa-btn${mesaActual === m.id ? " active" : ""}" data-legal-mesa="${m.id}">${m.label}</button>`
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
    refreshMesaUi();
  }
}

function refreshLegalMesaUi() {
  document.querySelectorAll("#plan-legal-mesas .plan-mesa-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.legalMesa === mesaActual);
  });
  const hint = document.getElementById("plan-legal-mesa-hint");
  if (hint) {
    const label = planillasConfig?.legal?.mesas?.find((m) => m.id === mesaActual)?.label
      || LEGAL_MESA_LABELS[mesaActual]
      || mesaActual;
    hint.textContent = mesaActual
      ? `Mesa seleccionada: ${label}`
      : "Elegí la mesa de destino para continuar.";
  }
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

  if (mesaActual === "TECNICO" || mesaActual === "FLEX") show = false;

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
  const hint = els.mesaHint();
  if (hint) {
    hint.textContent = mesaActual
      ? `Mesa seleccionada: ${MESA_LABELS[mesaActual] || mesaActual}`
      : "Elegí la mesa de destino para continuar.";
  }
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

function isPlanCapturaFile(file) {
  if (isPlanVideoFile(file)) return true;
  if (isPlanPdfFile(file)) return true;
  if (isPlanTxtFile(file)) return true;
  if (/\.(png|jpe?g|gif|bmp|webp)$/i.test(file.name || "")) return true;
  return (file.type || "").startsWith("image/");
}

const MAX_PLAN_VIDEOS = 1;
const MAX_PLAN_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_PLAN_PDF_BYTES = 12 * 1024 * 1024;
const MAX_PLAN_TXT_BYTES = 12 * 1024 * 1024;

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
    const isChip = isVideo || isPdf || isTxt;
    const card = document.createElement("div");
    card.className = isChip
      ? `plan-traza-chip ${isVideo ? "plan-video-chip" : isTxt ? "plan-txt-chip" : "plan-pdf-chip"}`
      : "plan-captura-thumb";

    let preview;
    if (isChip) {
      preview = document.createElement("span");
      preview.className = "plan-traza-chip-ext";
      const match = /\.([^.]+)$/.exec(f.name || "");
      preview.textContent = (match?.[1] || (isPdf ? "pdf" : isTxt ? "txt" : "mp4")).toUpperCase();
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
      const imgs = capturaFiles.length - videos - pdfs - txts;
      const parts = [];
      if (imgs > 0) parts.push(`${imgs} imagen(es)`);
      if (videos > 0) parts.push(`${videos} video(s)`);
      if (pdfs > 0) parts.push(`${pdfs} PDF`);
      if (txts > 0) parts.push(`${txts} TXT`);
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
  } else if (rejectedVideo) {
    alert("Solo se permite 1 video MP4/WEBM de hasta 100 MB.");
  } else if (rejectedFormat && added === 0 && fileList?.length > 0) {
    alert("Solo se admiten imágenes (PNG, JPG, GIF, BMP, WEBP), PDF, TXT o video MP4/WEBM.");
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
  setPlanStatus("Mejorando redacción con IA…");

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
    setPlanStatus("Redacción mejorada. Usá ↩ al lado si no te convence.");
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
      alert("Elegí la mesa de destino (Técnico, Flex, SaaS o Sueldos).");
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
    showPlanTextPreview("plan-text-preview", data.texto);
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

function openReferralShell(historyMode = "push") {
  const badge = document.getElementById("ref-sistema-badge");
  if (badge) badge.textContent = sistemaBadgeLabel(sistemaActual);
  setModuleLoading("plan-referral-loading", true);
  showView("referral", { history: historyMode });
}

function goBackToPlanillasMenu() {
  document.dispatchEvent(new CustomEvent("st2:planillas-home"));
  const st = window.history.state?.st2;
  if (st && st !== "menu") {
    window.history.back();
    return;
  }
  showView("menu", { history: "replace" });
  void refreshModuleFlags().then(() => updateSistemaUi());
}

function goBackToOportunidadMenu() {
  const st = window.history.state?.st2;
  if (st === "oportunidadCargar" || st === "oportunidadGestor") {
    window.history.back();
    return;
  }
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
    if (!sistemaActual || isSistemaPlaceholder(sistemaActual)) {
      showView("menu", { history: "replace" });
      return;
    }
    initTransferenciaForm();
    showView("transferencia", { history: historyMode });
    return;
  }

  if (name === "referral") {
    if (!sistemaActual || isSistemaPlaceholder(sistemaActual)) {
      showView("menu", { history: "replace" });
      return;
    }
    openReferralShell(historyMode);
    try {
      const mod = await loadReferralModule();
      mod.openReferral();
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
    return;
  }

  if (name === "pdfPortal") {
    if (!canSeePdfPortalModule() || hidesCommercialModules()) {
      showView("menu", { history: "replace" });
      return;
    }
    initPdfPortalGenerator();
    showView("pdfPortal", { history: historyMode });
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
          showView("menu", { history: "replace" });
          return;
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

  els.mesaBtns().forEach((btn) => {
    btn.addEventListener("click", () => toggleMesa(btn.dataset.mesa));
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

function argentinaMonthDay() {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      month: "numeric",
      day: "numeric",
    }).formatToParts(new Date());
    return {
      month: Number(parts.find((p) => p.type === "month")?.value),
      day: Number(parts.find((p) => p.type === "day")?.value),
    };
  } catch {
    const now = new Date();
    return { month: now.getMonth() + 1, day: now.getDate() };
  }
}

function isEggBirthdayWindow(egg) {
  if (!egg?.birthdayMonth || !egg?.birthdayDay) return true;
  const { month, day } = argentinaMonthDay();
  if (month !== egg.birthdayMonth) return false;
  const from = egg.birthdayFromDay || egg.birthdayDay;
  const to = egg.birthdayDay;
  return day >= from && day <= to;
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

function syncPlanillasHeroEaster() {
  const email = effectivePlanillasEmail();
  const egg = PLANILLAS_EASTER_EGGS.find((item) => item.email === email);
  const show = !!egg && isEggBirthdayWindow(egg);
  const heroBanner = !!(show && egg?.heroBanner);
  document.querySelector(".planillas-hero")?.classList.toggle("is-easter-banner", heroBanner);
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
    if (egg) el.src = egg.src;
    else el.removeAttribute("src");
    el.classList.toggle("is-wag", egg?.motion === "wag");
    el.classList.toggle("is-still", egg?.motion === "still");
    el.classList.toggle("is-lg", !isHero && egg?.size === "lg");
    el.classList.toggle("is-hero-banner", isHero && heroBanner);
    el.classList.toggle("is-smooth", !!(show && egg?.heroBanner));
    el.classList.toggle("is-hidden", !show);
    el.setAttribute("aria-hidden", show ? "false" : "true");
  });
  syncEasterBalloons(show ? egg : null);
}

export function initPlanillas() {
  if (!views.menu) return Promise.resolve();

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
  syncPlanillasHeroEaster();
  document.addEventListener("st2:session-changed", syncPlanillasHeroEaster);
  document.addEventListener("st2:view-as-changed", syncPlanillasHeroEaster);
  showView("menu", { history: "none" });

  return Promise.all([refreshModuleFlags({ baseline: true }), loadConfig()]).then(async () => {
    updatePlanBuildBadge(planillasConfig?.webBuild);
    updateSistemaUi();
    syncPlanillasHeroEaster();
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
