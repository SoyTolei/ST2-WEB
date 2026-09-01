import { snapshotFields, restoreFields, bindIaUndoButtons, syncIaUndoBar, notifyIaUndoHint } from "./plan-ia-undo.js";
import { enhancePlanSelect, syncPlanCustomSelect } from "./plan-custom-select.js";
import { initLegalReferralHub, openLegalReferralHub, openLegalProduct, resetLegalReferralHub, syncLegalMenuProducts, handleLegalReferralBack } from "./planillas-referral-legal.js";
import {
  initChileReferral,
  buildChileReferralPanel,
  resetChileReferral,
  buildChileReferralPayload,
  syncChileReferralCards,
} from "./planillas-referral-chile.js";
import { showPlanTextPreview, clearPlanTextPreview, mountPlanTextPreview } from "./plan-text-preview.js";

const REF_DESC_PH = "Detalle y/o descripción del caso";
const REF_PASO_PH = "Detalle paso a paso del proceso realizado por el usuario";

let ctx = null;
let versionSel = null;
let moduloSel = null;
let capturaFiles = [];
let trazaFiles = [];
let onvioCapturaFiles = [];
let legalCapturaFiles = [];
let chileCapturaFiles = [];
let legalProdutoSel = null;
let legalModuloSel = null;
let legalAmbienteSel = null;
let ticketAvisoOmitido = false;
let mamState = {};
let sdkState = {};
let mamPersActu = "";
let mamTriggers = "";
let sdkApp = "";
let planillaState = { relevada: false, procesoFuncionaba: false, reproduceError: false, ultimaActualizOk: false };
let referralIaUndo = null;
let referralDialogsPromise = null;
const REF_PERFIL_KEY = "st2-ref-perfil-tecnico";
let esTecnico = loadEsTecnico();

function loadEsTecnico() {
  try {
    return localStorage.getItem(REF_PERFIL_KEY) === "1";
  } catch {
    return false;
  }
}

function saveEsTecnico(value) {
  esTecnico = !!value;
  try {
    localStorage.setItem(REF_PERFIL_KEY, esTecnico ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function isPlanillaEmpty(state = planillaState) {
  return !(
    state.relevada
    || state.procesoFuncionaba
    || state.reproduceError
    || state.ultimaActualizOk
    || state.optVinculos
    || state.optBaseModelo
    || state.optSoloCliente
    || state.optReproduceSistematicamente
  );
}

/** Si no marcaron nada en planilla, completa los 3 obligatorios. */
function ensurePlanillaDefaults() {
  if (!isBejerman() || !isPlanillaEmpty()) return false;
  planillaState = {
    ...planillaState,
    procesoFuncionaba: true,
    reproduceError: true,
    ultimaActualizOk: true,
  };
  updateCheckStatuses();
  return true;
}

function syncPerfilUi() {
  const otra = document.getElementById("ref-perfil-otra");
  const tecnico = document.getElementById("ref-perfil-tecnico");
  otra?.classList.toggle("active", !esTecnico);
  tecnico?.classList.toggle("active", esTecnico);

  const planBadge = document.getElementById("ref-planilla-badge");
  if (planBadge) {
    planBadge.textContent = esTecnico ? "Opcional" : "Se completa sola";
    planBadge.className = esTecnico ? "plan-check-badge is-optional" : "plan-check-badge is-auto";
  }

  const mamBadge = document.getElementById("ref-mam-badge");
  const sdkBadge = document.getElementById("ref-sdk-badge");
  for (const badge of [mamBadge, sdkBadge]) {
    if (!badge) continue;
    badge.textContent = "Opcional";
    badge.className = "plan-check-badge is-optional";
  }

  // MAM, SDK y Traza SQL solo aplican a mesa técnica.
  document.getElementById("ref-wrap-mam")?.classList.toggle("hidden", !esTecnico);
  document.getElementById("ref-wrap-sdk")?.classList.toggle("hidden", !esTecnico);
  document.getElementById("ref-wrap-mam")?.classList.add("is-optional-card");
  document.getElementById("ref-wrap-sdk")?.classList.add("is-optional-card");

  const trazaCard = document.getElementById("ref-card-traza");
  const trazaPanel = document.getElementById("ref-traza-panel");
  const trazaCheck = document.getElementById("ref-adj-traza");
  trazaCard?.classList.toggle("hidden", !esTecnico);
  if (!esTecnico) {
    if (trazaCheck?.checked) {
      trazaCheck.checked = false;
      setReferralTrazaUi(false);
      trazaFiles.length = 0;
      refreshTrazaChips();
    } else {
      trazaPanel?.classList.add("hidden");
    }
    trazaCard?.classList.remove("is-optional-adj", "selected");
  }

  updateSqlHint();
}

function updateSqlHint() {
  // Solo para "Otra mesa": orientar dónde mirar collation/SQL en el zip de ST2.
  document.getElementById("ref-sql-hint")?.classList.toggle("hidden", esTecnico);
}

function loadReferralDialogs() {
  if (!referralDialogsPromise) {
    referralDialogsPromise = import("./planillas-referral-dialogs.js").then((mod) => {
      mod.initReferralDialogs();
      return mod;
    });
  }
  return referralDialogsPromise;
}

export function initReferralModule(context) {
  ctx = context;
  initLegalReferralHub(context);
  initChileReferral(context);
  bindReferralEvents();
  void loadReferralDialogs();
}

export async function openReferral({ legalProductId = null } = {}) {
  if (!ctx) return;
  if (ctx.getSistema() === "BejermanSql") {
    saveEsTecnico(false);
  }
  resetReferralForm();
  updateReferralPanels();
  if (isLegal()) {
    const productId = legalProductId || ctx.getPendingLegalProductId?.();
    if (productId) await openLegalProduct(productId);
    else openLegalReferralHub();
  } else {
    ctx.syncReferralModuleLabels?.();
  }
  document.getElementById("ref-sistema-badge").textContent = sistemaLabel();
  ctx.showView("referral");
}

export { syncLegalMenuProducts };

function sistemaLabel() {
  const id = ctx.getSistema();
  const label = {
    BejermanSql: "BEJERMAN SQL",
    OnvioWeb: "ONVIO/WEB",
    Legal: "LEGAL",
    Chile: "Chile",
  }[id] || "BEJERMAN SQL";
  return label;
}

function isChile() {
  return ctx.getSistema() === "Chile";
}

function isBejerman() {
  return ctx.getSistema() === "BejermanSql";
}

function isLegal() {
  return ctx.getSistema() === "Legal";
}

function updateReferralPanels() {
  const bej = isBejerman();
  const legal = isLegal();
  const chile = isChile();
  const standard = document.getElementById("ref-standard-flow");

  document.getElementById("ref-bejerman-panel")?.classList.toggle("hidden", !bej || legal || chile);
  document.getElementById("ref-chile-panel")?.classList.toggle("hidden", !chile);

  if (legal) {
    standard?.classList.add("hidden");
    document.getElementById("ref-bejerman-post")?.classList.add("hidden");
    document.getElementById("ref-chile-post")?.classList.add("hidden");
    document.getElementById("ref-onvio-panel")?.classList.add("hidden");
    document.getElementById("ref-legal-panel")?.classList.add("hidden");
    return;
  }

  document.getElementById("ref-legal-hub")?.classList.add("hidden");
  document.getElementById("ref-legal-templates")?.classList.add("hidden");
  document.getElementById("ref-legal-form")?.classList.add("hidden");
  standard?.classList.remove("hidden");
  document.getElementById("ref-bejerman-post")?.classList.toggle("hidden", !bej);
  document.getElementById("ref-chile-post")?.classList.toggle("hidden", !chile);
  document.getElementById("ref-onvio-panel")?.classList.toggle("hidden", bej || chile);
  document.getElementById("ref-legal-panel")?.classList.add("hidden");
  syncIaUndoBar("ref-btn-ia", "ref-btn-ia-undo", ctx.getConfig()?.referral?.iaConfigured);
  if (bej) {
    buildReferralPills();
    syncPerfilUi();
    updateCheckStatuses();
    updateSqlPanel();
  }
  if (chile) buildChileReferralPanel();
  syncReferralCards();
  if (chile) syncChileReferralCards();
}

function buildReferralPills() {
  const cfg = ctx.getConfig()?.referral;
  const legalCfg = ctx.getConfig()?.legal;
  if (!cfg && !legalCfg) return;

  if (isLegal()) return;

  if (!cfg) return;

  const verRow = document.getElementById("ref-version-pills");
  const modRow = document.getElementById("ref-modulo-pills");
  if (!verRow || !modRow) return;

  verRow.innerHTML = cfg.versiones.map((v) =>
    `<button type="button" class="plan-segment-btn${versionSel === v ? " active" : ""}" data-version="${v}">${v}</button>`
  ).join("");
  modRow.innerHTML = cfg.modulos.map((m) =>
    `<button type="button" class="plan-segment-btn${moduloSel === m ? " active" : ""}" data-modulo="${m}">${m}</button>`
  ).join("");

  const col = document.getElementById("ref-collation");
  const sql = document.getElementById("ref-sql-server");
  if (col && col.options.length === 0) {
    col.innerHTML = `<option value="">Seleccionar…</option>${cfg.collations.map((c) => `<option>${c}</option>`).join("")}`;
    sql.innerHTML = `<option value="">Seleccionar…</option>${cfg.sqlServers.map((s) => `<option>${s}</option>`).join("")}`;
    enhancePlanSelect(col);
    enhancePlanSelect(sql);
    syncPlanSelectFilled(col);
    syncPlanSelectFilled(sql);
    col.addEventListener("change", () => syncPlanSelectFilled(col));
    sql.addEventListener("change", () => syncPlanSelectFilled(sql));
  }
}

function syncPlanSelectFilled(select) {
  if (!select) return;
  select.classList.toggle("has-value", Boolean(select.value));
}

function updateSqlPanel() {
  document.getElementById("ref-sql-panel")?.classList.remove("hidden");
}

function updateCheckStatuses() {
  const mamOk = Object.values(mamState).some(Boolean);
  const sdkOk = Object.values(sdkState).some(Boolean);
  const planOk = planillaState.procesoFuncionaba && planillaState.reproduceError && planillaState.ultimaActualizOk;
  setStatus("ref-mam-status", mamOk);
  setStatus("ref-sdk-status", sdkOk);
  setStatus("ref-planilla-status", planOk);
}

function setStatus(id, ok) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = ok ? "✓" : "○";
    el.style.color = ok ? "#16a34a" : "#94a3b8";
  }
}

function bindAdjCard(cardId, checkId, markId, onChange) {
  const card = document.getElementById(cardId);
  const check = document.getElementById(checkId);
  const mark = markId ? document.getElementById(markId) : card?.querySelector(".card-mark");
  if (!card || !check) return;
  const sync = () => {
    check.checked = !check.checked;
    card.classList.toggle("selected", check.checked);
    if (mark) {
      mark.textContent = check.checked ? "✓" : "○";
      mark.style.color = check.checked ? "#16a34a" : "#94a3b8";
    }
    onChange?.();
  };
  card.addEventListener("click", sync);
}

function syncCardVisual(cardId, checkId, markId, markEl) {
  const card = document.getElementById(cardId);
  const check = document.getElementById(checkId);
  const mark = markEl || (markId ? document.getElementById(markId) : card?.querySelector(".card-mark"));
  if (!card || !check) return;
  card.classList.toggle("selected", check.checked);
  if (mark) applyCardMark(mark, check.checked);
}

function applyCardMark(mark, checked) {
  if (!mark) return;
  const isOnvioState = mark.classList.contains("plan-onvio-state")
    || mark.closest(".plan-onvio-card");
  if (isOnvioState) {
    mark.textContent = checked ? "Sí" : "No";
    mark.style.color = "";
    return;
  }
  mark.textContent = checked ? "✓" : "○";
  mark.style.color = checked ? "#16a34a" : "#94a3b8";
}

function clearBackupBases() {
  ["ref-backup-manager", "ref-backup-sbda", "ref-backup-cg", "ref-backup-sj"].forEach((id) => {
    const c = document.getElementById(id);
    if (c) c.checked = false;
  });
  [
    ["ref-card-backup-manager", "ref-mark-backup-manager"],
    ["ref-card-backup-sbda", "ref-mark-backup-sbda"],
    ["ref-card-backup-cg", "ref-mark-backup-cg"],
    ["ref-card-backup-sj", "ref-mark-backup-sj"],
  ].forEach(([cardId, markId]) => {
    document.getElementById(cardId)?.classList.remove("selected");
    const mark = document.getElementById(markId);
    if (mark) { mark.textContent = "○"; mark.style.color = "#94a3b8"; }
  });
  const od = document.getElementById("ref-backup-onedrive");
  if (od) od.value = "";
  updateSqlPanel();
}

/** Windows/Explorer a veces pega el nombre de la carpeta; priorizamos la URL del clipboard. */
function extractUrlFromClipboardData(data) {
  if (!data) return "";

  const uriList = data.getData("text/uri-list")?.trim();
  if (uriList) {
    const line = uriList.split(/\r?\n/).find((l) => l && !l.startsWith("#"));
    if (line && /^https?:\/\//i.test(line)) return line.trim();
  }

  const html = data.getData("text/html") || "";
  if (html) {
    const hrefMatch = html.match(/href\s*=\s*["']([^"']+)["']/i);
    if (hrefMatch?.[1]) {
      const href = hrefMatch[1].trim().replace(/&amp;/g, "&");
      if (/^https?:\/\//i.test(href)) return href;
    }
  }

  const plain = (data.getData("text/plain") || "").trim();
  if (!plain) return "";

  if (/^https?:\/\//i.test(plain)) return plain.split(/\s+/)[0];

  const embedded = plain.match(/https?:\/\/[^\s<>"']+/i);
  return embedded ? embedded[0] : "";
}

function setupBackupOnedrivePaste() {
  const input = document.getElementById("ref-backup-onedrive");
  if (!input || input.dataset.pasteBound === "1") return;
  input.dataset.pasteBound = "1";

  input.addEventListener("paste", (e) => {
    const url = extractUrlFromClipboardData(e.clipboardData);
    if (!url) return;

    e.preventDefault();
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = `${input.value.slice(0, start)}${url}${input.value.slice(end)}`;
    const caret = start + url.length;
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function syncReferralCards() {
  [
    ["ref-card-pantallas", "ref-adj-pantallas", "ref-mark-pantallas"],
    ["ref-card-traza", "ref-adj-traza", "ref-mark-traza"],
    ["ref-card-backup", "ref-adj-backup", "ref-mark-backup"],
    ["ref-card-chile-pantallas", "ref-chile-pantallas", "ref-mark-chile-pantallas"],
    ["ref-card-chile-bases", "ref-chile-bases-check", "ref-mark-chile-bases"],
  ].forEach(([cardId, checkId, markId]) => syncCardVisual(cardId, checkId, markId));
  [
    ["ref-card-backup-manager", "ref-backup-manager", "ref-mark-backup-manager"],
    ["ref-card-backup-sbda", "ref-backup-sbda", "ref-mark-backup-sbda"],
    ["ref-card-backup-cg", "ref-backup-cg", "ref-mark-backup-cg"],
    ["ref-card-backup-sj", "ref-backup-sj", "ref-mark-backup-sj"],
  ].forEach(([cardId, checkId, markId]) => syncCardVisual(cardId, checkId, markId));
  document.querySelectorAll(".plan-onvio-card[data-onvio]").forEach((card) => {
    syncCardVisual(card.id, `ref-onvio-${card.dataset.onvio}`, null, card.querySelector(".card-mark"));
  });
  [
    ["ref-card-onvio-rep-ticket", "ref-onvio-rep-ticket"],
    ["ref-card-onvio-rep-prueba", "ref-onvio-rep-prueba"],
  ].forEach(([cardId, checkId]) => syncCardVisual(cardId, checkId, null));
  document.querySelectorAll(".plan-onvio-card[data-legal]").forEach((card) => {
    syncCardVisual(card.id, `ref-legal-${card.dataset.legal}`, null, card.querySelector(".card-mark"));
  });
  [
    ["ref-card-legal-rep-ticket", "ref-legal-rep-ticket"],
    ["ref-card-legal-rep-homolog", "ref-legal-rep-homolog"],
    ["ref-card-legal-rep-usuario", "ref-legal-rep-usuario"],
  ].forEach(([cardId, checkId]) => syncCardVisual(cardId, checkId, null));
}

function clearLegalTicketFields() {
  ["ref-legal-ticket-num", "ref-legal-tecnico"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  ["ref-legal-rep-ticket", "ref-legal-rep-homolog", "ref-legal-rep-usuario"].forEach((id) => {
    const c = document.getElementById(id);
    if (c) c.checked = false;
  });
  [
    "ref-card-legal-rep-ticket",
    "ref-card-legal-rep-homolog",
    "ref-card-legal-rep-usuario",
  ].forEach((cardId) => {
    const card = document.getElementById(cardId);
    const mark = card?.querySelector(".card-mark");
    card?.classList.remove("selected");
    if (mark) { mark.textContent = "○"; mark.style.color = "#94a3b8"; }
  });
}

function clearOnvioTicketFields() {
  ["ref-onvio-ticket-num", "ref-onvio-tecnico"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  ["ref-onvio-rep-ticket", "ref-onvio-rep-prueba"].forEach((id) => {
    const c = document.getElementById(id);
    if (c) c.checked = false;
  });
  [
    ["ref-card-onvio-rep-ticket", null],
    ["ref-card-onvio-rep-prueba", null],
  ].forEach(([cardId]) => {
    const card = document.getElementById(cardId);
    const mark = card?.querySelector(".card-mark");
    card?.classList.remove("selected");
    applyCardMark(mark, false);
  });
}

function bindOnvioCard(cardId, checkId, onChange) {
  const card = document.getElementById(cardId);
  const check = document.getElementById(checkId);
  if (!card || !check) return;
  const mark = card.querySelector(".card-mark");
  const sync = () => {
    check.checked = !check.checked;
    card.classList.toggle("selected", check.checked);
    applyCardMark(mark, check.checked);
    onChange?.();
  };
  card.addEventListener("click", sync);
}

function bindReferralEvents() {
  document.querySelector("[data-plan-back-referral]")?.addEventListener("click", () => {
    if (isLegal() && handleLegalReferralBack()) return;
    if (ctx.goPlanillasMenu) ctx.goPlanillasMenu();
    else ctx.showView("menu");
  });

  document.getElementById("ref-bejerman-panel")?.addEventListener("click", (e) => {
    const v = e.target.closest("[data-version]");
    const m = e.target.closest("[data-modulo]");
    if (v) {
      const val = v.dataset.version;
      versionSel = versionSel === val ? null : val;
      buildReferralPills();
    }
    if (m) {
      const val = m.dataset.modulo;
      moduloSel = moduloSel === val ? null : val;
      if (!moduloSel) {
        const col = document.getElementById("ref-collation");
        const sql = document.getElementById("ref-sql-server");
        if (col) {
          col.selectedIndex = 0;
          syncPlanSelectFilled(col);
          syncPlanCustomSelect(col);
        }
        if (sql) {
          sql.selectedIndex = 0;
          syncPlanSelectFilled(sql);
          syncPlanCustomSelect(sql);
        }
      }
      buildReferralPills();
    }
  });

  bindAdjCard("ref-card-pantallas", "ref-adj-pantallas", "ref-mark-pantallas", () => {
    document.getElementById("ref-capturas-panel")?.classList.toggle("hidden", !document.getElementById("ref-adj-pantallas").checked);
  });
  bindAdjCard("ref-card-traza", "ref-adj-traza", "ref-mark-traza", () => {
    document.getElementById("ref-traza-panel")?.classList.toggle("hidden", !document.getElementById("ref-adj-traza").checked);
  });
  bindAdjCard("ref-card-backup", "ref-adj-backup", "ref-mark-backup", () => {
    const on = document.getElementById("ref-adj-backup")?.checked;
    document.getElementById("ref-backup-panel")?.classList.toggle("hidden", !on);
    if (!on) clearBackupBases();
    updateSqlPanel();
  });

  bindAdjCard("ref-card-backup-manager", "ref-backup-manager", "ref-mark-backup-manager", updateSqlPanel);
  bindAdjCard("ref-card-backup-sbda", "ref-backup-sbda", "ref-mark-backup-sbda", updateSqlPanel);
  bindAdjCard("ref-card-backup-cg", "ref-backup-cg", "ref-mark-backup-cg", updateSqlPanel);
  bindAdjCard("ref-card-backup-sj", "ref-backup-sj", "ref-mark-backup-sj", updateSqlPanel);
  setupBackupOnedrivePaste();

  bindOnvioCard("ref-card-onvio-proceso", "ref-onvio-proceso");
  bindOnvioCard("ref-card-onvio-reproduce", "ref-onvio-reproduce");
  bindOnvioCard("ref-card-onvio-pantallas", "ref-onvio-pantallas", () => {
    document.getElementById("ref-onvio-capturas")?.classList.toggle("hidden", !document.getElementById("ref-onvio-pantallas").checked);
  });
  bindOnvioCard("ref-card-onvio-ticket", "ref-onvio-ticket", () => {
    const on = document.getElementById("ref-onvio-ticket")?.checked;
    document.getElementById("ref-onvio-ticket-panel")?.classList.toggle("hidden", !on);
    if (!on) clearOnvioTicketFields();
  });
  bindOnvioCard("ref-card-onvio-rep-ticket", "ref-onvio-rep-ticket");
  bindOnvioCard("ref-card-onvio-rep-prueba", "ref-onvio-rep-prueba");

  bindOnvioCard("ref-card-legal-proceso", "ref-legal-proceso");
  bindOnvioCard("ref-card-legal-reproduce", "ref-legal-reproduce");
  bindOnvioCard("ref-card-legal-pantallas", "ref-legal-pantallas", () => {
    document.getElementById("ref-legal-capturas")?.classList.toggle("hidden", !document.getElementById("ref-legal-pantallas").checked);
  });
  bindOnvioCard("ref-card-legal-ticket", "ref-legal-ticket", () => {
    const on = document.getElementById("ref-legal-ticket")?.checked;
    document.getElementById("ref-legal-ticket-panel")?.classList.toggle("hidden", !on);
    if (!on) clearLegalTicketFields();
  });
  bindOnvioCard("ref-card-legal-planilha", "ref-legal-planilha");
  bindOnvioCard("ref-card-legal-log", "ref-legal-log");
  bindOnvioCard("ref-card-legal-rep-ticket", "ref-legal-rep-ticket");
  bindOnvioCard("ref-card-legal-rep-homolog", "ref-legal-rep-homolog");
  bindOnvioCard("ref-card-legal-rep-usuario", "ref-legal-rep-usuario");

  bindAdjCard("ref-card-chile-pantallas", "ref-chile-pantallas", "ref-mark-chile-pantallas", () => {
    document.getElementById("ref-chile-capturas")?.classList.toggle("hidden", !document.getElementById("ref-chile-pantallas").checked);
  });
  bindAdjCard("ref-card-chile-bases", "ref-chile-bases-check", "ref-mark-chile-bases", () => {
    syncChileReferralCards();
  });

  setupPlaceholder("ref-descripcion", REF_DESC_PH);
  setupPlaceholder("ref-paso", REF_PASO_PH);

  document.getElementById("ref-btn-mam")?.addEventListener("click", () => openMamModal());
  document.getElementById("ref-btn-sdk")?.addEventListener("click", () => openSdkModal());
  document.getElementById("ref-btn-planilla")?.addEventListener("click", () => openPlanillaModalAsync());
  document.getElementById("ref-perfil-otra")?.addEventListener("click", () => {
    saveEsTecnico(false);
    syncPerfilUi();
    updateCheckStatuses();
  });
  document.getElementById("ref-perfil-tecnico")?.addEventListener("click", () => {
    saveEsTecnico(true);
    syncPerfilUi();
    updateCheckStatuses();
  });
  syncPerfilUi();

  setupCapturas("ref-capturas", capturaFiles);
  setupCapturas("ref-onvio-capt", onvioCapturaFiles);
  setupCapturas("ref-legal-capt", legalCapturaFiles);
  setupCapturas("ref-chile-capt", chileCapturaFiles);
  setupTraza();

  document.getElementById("ref-btn-copiar")?.addEventListener("click", () => generarReferral(true));
  document.getElementById("ref-btn-ver-planilla")?.addEventListener("click", () => generarReferral(false));
  mountPlanTextPreview("ref-text-preview");
  document.getElementById("ref-btn-limpiar")?.addEventListener("click", resetReferralForm);
  document.getElementById("ref-btn-ia")?.addEventListener("click", mejorarReferralIa);

  referralIaUndo = bindIaUndoButtons({
    undoBtnId: "ref-btn-ia-undo",
    getSnapshot: () => snapshotFields(referralIaFieldDefs()),
    onUndo: (snap) => restoreFields(referralIaFieldDefs(), snap),
  });
  document.getElementById("ref-btn-ia-undo")?.addEventListener("click", () => referralIaUndo.undo());
}

function isRefPlaceholder(id, ph) {
  const el = document.getElementById(id);
  return !!el && (el.classList.contains("placeholder-active") || el.value === ph);
}

function referralIaFieldDefs() {
  return [
    { id: "ref-asunto" },
    {
      id: "ref-descripcion",
      kind: "placeholder-textarea",
      placeholderActive: isRefPlaceholder("ref-descripcion", REF_DESC_PH),
    },
    {
      id: "ref-paso",
      kind: "placeholder-textarea",
      placeholderActive: isRefPlaceholder("ref-paso", REF_PASO_PH),
    },
  ];
}

function setupPlaceholder(id, ph) {
  const el = document.getElementById(id);
  if (!el) return;
  el.dataset.placeholder = ph;
  if (!el.value) { el.value = ph; el.classList.add("placeholder-active"); }
  el.addEventListener("focus", () => {
    if (el.value === ph) { el.value = ""; el.classList.remove("placeholder-active"); }
  });
  el.addEventListener("blur", () => {
    if (!el.value.trim()) { el.value = ph; el.classList.add("placeholder-active"); }
  });
}

function plainValue(id) {
  const el = document.getElementById(id);
  if (!el) return "";
  const ph = el.dataset.placeholder;
  return el.value === ph ? "" : el.value.trim();
}

function setReferralPantallasUi(checked) {
  if (isBejerman()) {
    const check = document.getElementById("ref-adj-pantallas");
    if (!check) return;
    check.checked = checked;
    const mark = document.getElementById("ref-mark-pantallas");
    if (mark) {
      mark.textContent = checked ? "✓" : "○";
      mark.style.color = checked ? "#16a34a" : "#94a3b8";
    }
    document.getElementById("ref-capturas-panel")?.classList.toggle("hidden", !checked);
    return;
  }

  if (isLegal()) {
    const check = document.getElementById("ref-legal-pantallas");
    if (!check) return;
    check.checked = checked;
    const card = document.getElementById("ref-card-legal-pantallas");
    const mark = card?.querySelector(".card-mark");
    card?.classList.toggle("selected", checked);
    applyCardMark(mark, checked);
    document.getElementById("ref-legal-capturas")?.classList.toggle("hidden", !checked);
    return;
  }

  if (isChile()) {
    const check = document.getElementById("ref-chile-pantallas");
    if (!check) return;
    check.checked = checked;
    const card = document.getElementById("ref-card-chile-pantallas");
    const mark = document.getElementById("ref-mark-chile-pantallas");
    card?.classList.toggle("selected", checked);
    if (mark) {
      mark.textContent = checked ? "✓" : "○";
      mark.style.color = checked ? "#16a34a" : "#94a3b8";
    }
    document.getElementById("ref-chile-capturas")?.classList.toggle("hidden", !checked);
    return;
  }

  const check = document.getElementById("ref-onvio-pantallas");
  if (!check) return;
  check.checked = checked;
  const card = document.getElementById("ref-card-onvio-pantallas");
  const mark = card?.querySelector(".card-mark");
  card?.classList.toggle("selected", checked);
  applyCardMark(mark, checked);
  document.getElementById("ref-onvio-capturas")?.classList.toggle("hidden", !checked);
}

const REFERRAL_CAPTURAS_ACCEPT = "image/*,.mp4,.webm,video/mp4,video/webm,.pdf,application/pdf,.txt,text/plain,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

function isReferralVideoFile(file) {
  if (/\.(mp4|webm)$/i.test(file.name || "")) return true;
  const t = file.type || "";
  return t === "video/mp4" || t === "video/webm";
}

function isReferralPdfFile(file) {
  if (/\.pdf$/i.test(file.name || "")) return true;
  return (file.type || "") === "application/pdf";
}

function isReferralTxtFile(file) {
  return /\.txt$/i.test(file.name || "");
}

function isReferralExcelFile(file) {
  if (/\.(xlsx|xls)$/i.test(file.name || "")) return true;
  const t = file.type || "";
  return t === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    || t === "application/vnd.ms-excel";
}

function isReferralCapturaFile(file) {
  if (isReferralVideoFile(file)) return true;
  if (isReferralPdfFile(file)) return true;
  if (isReferralTxtFile(file)) return true;
  if (isReferralExcelFile(file)) return true;
  if (/\.(png|jpe?g|gif|bmp|webp)$/i.test(file.name || "")) return true;
  return (file.type || "").startsWith("image/");
}

const MAX_REFERRAL_VIDEOS = 1;
const MAX_REFERRAL_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_REFERRAL_PDF_BYTES = 12 * 1024 * 1024;
const MAX_REFERRAL_TXT_BYTES = 12 * 1024 * 1024;
const MAX_REFERRAL_EXCEL_BYTES = 12 * 1024 * 1024;

function addReferralCapturaFiles(fileList, targetList) {
  let added = 0;
  let rejectedHeavy = false;
  let rejectedPdfHeavy = false;
  let rejectedTxtHeavy = false;
  let rejectedExcelHeavy = false;
  let rejectedVideo = false;
  let rejectedFormat = false;

  for (const file of fileList) {
    if (!isReferralCapturaFile(file)) {
      rejectedFormat = true;
      continue;
    }

    if (isReferralVideoFile(file)) {
      if (file.size > MAX_REFERRAL_VIDEO_BYTES) {
        rejectedHeavy = true;
        continue;
      }
      if (targetList.filter(isReferralVideoFile).length >= MAX_REFERRAL_VIDEOS) {
        rejectedVideo = true;
        continue;
      }
    } else if (isReferralPdfFile(file)) {
      if (file.size > MAX_REFERRAL_PDF_BYTES) {
        rejectedPdfHeavy = true;
        continue;
      }
    } else if (isReferralTxtFile(file)) {
      if (file.size > MAX_REFERRAL_TXT_BYTES) {
        rejectedTxtHeavy = true;
        continue;
      }
    } else if (isReferralExcelFile(file)) {
      if (file.size > MAX_REFERRAL_EXCEL_BYTES) {
        rejectedExcelHeavy = true;
        continue;
      }
    }

    if (!targetList.some((f) => f.name === file.name && f.size === file.size)) {
      targetList.push(file);
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
  } else if (rejectedVideo) {
    alert("Solo se permite 1 video MP4/WEBM de hasta 100 MB.");
  } else if (rejectedFormat && added === 0 && fileList?.length > 0) {
    alert("Solo se admiten imágenes (PNG, JPG, GIF, BMP, WEBP), PDF, TXT, Excel (.xlsx/.xls) o video MP4/WEBM.");
  }
  if (added > 0) setReferralPantallasUi(true);
  return added;
}

function refreshCapturasEstadoReferral(prefix, fileList) {
  const estadoId = prefix === "ref-capturas"
    ? "ref-capturas-estado"
    : prefix === "ref-legal-capt"
      ? "ref-legal-capt-estado"
      : prefix === "ref-chile-capt"
        ? "ref-chile-capt-estado"
        : "ref-onvio-capt-estado";
  const estado = document.getElementById(estadoId);
  if (!estado) return;
  if (fileList.length === 0) {
    estado.textContent = "";
    return;
  }
  const videos = fileList.filter(isReferralVideoFile).length;
  const pdfs = fileList.filter(isReferralPdfFile).length;
  const txts = fileList.filter(isReferralTxtFile).length;
  const excels = fileList.filter(isReferralExcelFile).length;
  const imgs = fileList.length - videos - pdfs - txts - excels;
  const parts = [];
  if (imgs > 0) parts.push(`${imgs} imagen(es)`);
  if (videos > 0) parts.push(`${videos} video(s)`);
  if (pdfs > 0) parts.push(`${pdfs} PDF`);
  if (txts > 0) parts.push(`${txts} TXT`);
  if (excels > 0) parts.push(`${excels} Excel`);
  estado.textContent = `${parts.join(" · ")} listo(s) para subir al generar el texto.`;
}

function revokeCapturaThumbUrls(container) {
  if (!container) return;
  container.querySelectorAll("img[data-object-url], video[data-object-url]").forEach((el) => {
    const url = el.getAttribute("data-object-url");
    if (url) URL.revokeObjectURL(url);
  });
}

function setupCapturas(prefix, fileList) {
  const input = document.getElementById(`${prefix}-input`);
  if (input) input.setAttribute("accept", REFERRAL_CAPTURAS_ACCEPT);
  document.getElementById(`${prefix}-agregar`)?.addEventListener("click", () => {
    input?.click();
  });
  input?.addEventListener("change", (e) => {
    const added = addReferralCapturaFiles(e.target.files, fileList);
    if (added === 0 && e.target.files?.length > 0) {
      // alert ya se mostró en addReferralCapturaFiles si corresponde
    }
    refreshChips(`${prefix}-chips`, fileList, prefix, fileList);
    refreshCapturasEstadoReferral(prefix, fileList);
    e.target.value = "";
  });
}

function getReferralCapturaFiles() {
  if (isBejerman()) return capturaFiles;
  if (isLegal()) return legalCapturaFiles;
  if (isChile()) return chileCapturaFiles;
  return onvioCapturaFiles;
}

function isTrazaFile(file) {
  return /\.(trc|csv|txt)$/i.test(file.name || "");
}

function setReferralTrazaUi(checked) {
  const check = document.getElementById("ref-adj-traza");
  if (!check) return;
  check.checked = checked;
  const mark = document.getElementById("ref-mark-traza");
  if (mark) {
    mark.textContent = checked ? "✓" : "○";
    mark.style.color = checked ? "#16a34a" : "#94a3b8";
  }
  document.getElementById("ref-card-traza")?.classList.toggle("selected", checked);
  document.getElementById("ref-traza-panel")?.classList.toggle("hidden", !checked);
}

function addTrazaFiles(fileList) {
  let added = 0;
  for (const file of fileList) {
    if (!isTrazaFile(file)) continue;
    if (!trazaFiles.some((f) => f.name === file.name && f.size === file.size)) {
      trazaFiles.push(file);
      added++;
    }
  }
  if (added > 0) setReferralTrazaUi(true);
  return added;
}

function refreshTrazaChips() {
  const el = document.getElementById("ref-traza-chips");
  const estado = document.getElementById("ref-traza-estado");
  if (!el) return;
  el.innerHTML = "";
  trazaFiles.forEach((f, index) => {
    const card = document.createElement("div");
    card.className = "plan-traza-chip";

    const ext = document.createElement("span");
    ext.className = "plan-traza-chip-ext";
    const match = /\.([^.]+)$/.exec(f.name || "");
    ext.textContent = (match?.[1] || "file").toUpperCase();

    const name = document.createElement("span");
    name.className = "plan-traza-chip-name";
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
      trazaFiles.splice(index, 1);
      refreshTrazaChips();
    });

    card.append(ext, name, btn);
    el.appendChild(card);
  });

  if (estado) {
    estado.textContent = trazaFiles.length === 0
      ? ""
      : `${trazaFiles.length} archivo(s) listo(s) para subir al generar el texto.`;
  }
}

function setupTraza() {
  document.getElementById("ref-traza-agregar")?.addEventListener("click", () => {
    document.getElementById("ref-traza-input")?.click();
  });
  document.getElementById("ref-traza-input")?.addEventListener("change", (e) => {
    const added = addTrazaFiles(e.target.files || []);
    if (added === 0 && e.target.files?.length > 0) {
      alert("Solo se admiten archivos .trc, .csv o .txt.");
    }
    refreshTrazaChips();
    e.target.value = "";
  });
}

function refreshChips(id, files, prefix, fileList) {
  const el = document.getElementById(id);
  if (!el) return;
  revokeCapturaThumbUrls(el);
  el.innerHTML = "";
  files.forEach((f, index) => {
    const isVideo = isReferralVideoFile(f);
    const isPdf = isReferralPdfFile(f);
    const isTxt = isReferralTxtFile(f);
    const isExcel = isReferralExcelFile(f);
    const isChip = isVideo || isPdf || isTxt || isExcel;
    const card = document.createElement("div");
    card.className = isChip
      ? `plan-traza-chip ${isVideo ? "plan-video-chip" : isTxt ? "plan-txt-chip" : isExcel ? "plan-excel-chip" : "plan-pdf-chip"}`
      : "plan-captura-thumb";

    let preview;
    if (isChip) {
      preview = document.createElement("span");
      preview.className = "plan-traza-chip-ext";
      const match = /\.([^.]+)$/.exec(f.name || "");
      preview.textContent = (match?.[1] || (isPdf ? "pdf" : isTxt ? "txt" : isExcel ? "xlsx" : "mp4")).toUpperCase();
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
      fileList.splice(index, 1);
      refreshChips(id, fileList, prefix, fileList);
      refreshCapturasEstadoReferral(prefix, fileList);
    });

    card.append(preview, name, btn);
    el.appendChild(card);
  });
}

function buildPayload() {
  if (isBejerman()) ensurePlanillaDefaults();

  const payload = {
    sistema: ctx.getSistema(),
    asunto: document.getElementById("ref-asunto")?.value.trim() || "",
    descripcion: plainValue("ref-descripcion") || null,
    pasoAPaso: plainValue("ref-paso") || null,
    ticketAvisoOmitido,
  };

  if (isBejerman()) {
    payload.version = versionSel || "";
    payload.modulo = moduloSel || "";
    payload.collation = document.getElementById("ref-collation")?.value || "";
    payload.sqlServer = document.getElementById("ref-sql-server")?.value || "";
    payload.esTecnico = esTecnico;
    payload.mamSelections = esTecnico ? { ...mamState } : {};
    payload.mamPersActuNombre = esTecnico ? mamPersActu : "";
    payload.mamTriggersDesactivados = esTecnico ? mamTriggers : "";
    payload.sdkSelections = esTecnico ? { ...sdkState } : {};
    payload.sdkAplicacionIntegracion = esTecnico ? sdkApp : "";
    payload.planilla = {
      relevada: planillaState.relevada,
      procesoFuncionaba: planillaState.procesoFuncionaba,
      reproduceError: planillaState.reproduceError,
      ultimaActualizOk: planillaState.ultimaActualizOk,
      optVinculos: planillaState.optVinculos || false,
      optBaseModelo: planillaState.optBaseModelo || false,
      optSoloCliente: planillaState.optSoloCliente || false,
      optReproduceSistematicamente: planillaState.optReproduceSistematicamente || false,
    };
    payload.adjuntos = {
      pantallas: document.getElementById("ref-adj-pantallas")?.checked,
      trazaSql: esTecnico && !!document.getElementById("ref-adj-traza")?.checked,
      backupBases: document.getElementById("ref-adj-backup")?.checked,
      backupManager: document.getElementById("ref-backup-manager")?.checked,
      backupSbda: document.getElementById("ref-backup-sbda")?.checked,
      backupCg: document.getElementById("ref-backup-cg")?.checked,
      backupSj: document.getElementById("ref-backup-sj")?.checked,
      backupOnedriveUrl: document.getElementById("ref-backup-onedrive")?.value.trim() || null,
    };
  } else if (isLegal()) {
    payload.legal = {
      produto: legalProdutoSel || "",
      modulo: legalModuloSel || "",
      ambiente: legalAmbienteSel || "",
      procesoFuncionaba: document.getElementById("ref-legal-proceso")?.checked,
      reproduceSistematicamente: document.getElementById("ref-legal-reproduce")?.checked,
      adjuntaPantallas: document.getElementById("ref-legal-pantallas")?.checked,
      hayTicket: document.getElementById("ref-legal-ticket")?.checked,
      numeroTicket: document.getElementById("ref-legal-ticket-num")?.value.trim(),
      tecnico: document.getElementById("ref-legal-tecnico")?.value.trim(),
      reproduceConTicket: document.getElementById("ref-legal-rep-ticket")?.checked,
      reproduceHomologacao: document.getElementById("ref-legal-rep-homolog")?.checked,
      reproduceOutroUsuario: document.getElementById("ref-legal-rep-usuario")?.checked,
      adjuntaPlanilhaImport: document.getElementById("ref-legal-planilha")?.checked,
      adjuntaLogIntegracao: document.getElementById("ref-legal-log")?.checked,
      chaveRegistro: document.getElementById("ref-legal-chave")?.value.trim(),
      usuarioOnePass: document.getElementById("ref-legal-usuario")?.value.trim(),
      escritorio: document.getElementById("ref-legal-escritorio")?.value.trim(),
    };
  } else if (isChile()) {
    payload.chile = buildChileReferralPayload();
  } else {
    payload.onvio = {
      procesoFuncionaba: document.getElementById("ref-onvio-proceso")?.checked,
      reproduceSistematicamente: document.getElementById("ref-onvio-reproduce")?.checked,
      adjuntaPantallas: document.getElementById("ref-onvio-pantallas")?.checked,
      hayTicket: document.getElementById("ref-onvio-ticket")?.checked,
      numeroTicket: document.getElementById("ref-onvio-ticket-num")?.value.trim(),
      tecnico: document.getElementById("ref-onvio-tecnico")?.value.trim(),
      reproduceConTicket: document.getElementById("ref-onvio-rep-ticket")?.checked,
      reproduceEmpresaPrueba: document.getElementById("ref-onvio-rep-prueba")?.checked,
      usuarioContador: document.getElementById("ref-onvio-usuario")?.value.trim(),
      empresa: document.getElementById("ref-onvio-empresa")?.value.trim(),
      ejercicioNumero: document.getElementById("ref-onvio-ejercicio")?.value.trim(),
    };
  }
  return payload;
}

function pickReferralCapturaFiles(payload) {
  const files = getReferralCapturaFiles();
  if (files.length > 0) {
    if (isBejerman()) {
      if (!payload.adjuntos) payload.adjuntos = {};
      payload.adjuntos.pantallas = true;
    } else if (isLegal()) {
      if (!payload.legal) payload.legal = {};
      payload.legal.adjuntaPantallas = true;
    } else if (isChile()) {
      if (!payload.chile) payload.chile = {};
      payload.chile.adjuntaPantallas = true;
    } else {
      if (!payload.onvio) payload.onvio = {};
      payload.onvio.adjuntaPantallas = true;
    }
    return files;
  }

  const marcado = isBejerman()
    ? !!payload.adjuntos?.pantallas
    : isLegal()
      ? !!payload.legal?.adjuntaPantallas
      : isChile()
        ? !!payload.chile?.adjuntaPantallas
        : !!payload.onvio?.adjuntaPantallas;
  return marcado ? files : [];
}

async function subirCapturasReferral(files) {
  const form = new FormData();
  files.forEach((f) => form.append("capturas", f, f.name || "captura.png"));
  const response = await fetch("/api/planillas/capturas/upload", { method: "POST", body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.error || data.title || "Error al subir capturas");
  }
  return (data.enlaces || []).filter((e) => e?.url);
}

async function subirTrazasReferral(files) {
  const form = new FormData();
  files.forEach((f) => form.append("trazas", f, f.name || "traza.trc"));
  const response = await fetch("/api/planillas/trazas/upload", { method: "POST", body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.error || data.title || "Error al subir traza");
  }
  return (data.enlaces || []).filter((e) => e?.url);
}

async function generarReferral(copiar) {
  const status = document.getElementById("ref-status");
  const btnCopiar = document.getElementById("ref-btn-copiar");
  const btnVer = document.getElementById("ref-btn-ver-planilla");
  const autoPlanilla = isBejerman() && isPlanillaEmpty();
  const payload = buildPayload();
  const files = pickReferralCapturaFiles(payload);
  const trazas = isBejerman() && esTecnico ? [...trazaFiles] : [];
  if (trazas.length > 0) {
    if (!payload.adjuntos) payload.adjuntos = {};
    payload.adjuntos.trazaSql = true;
  }
  const quierePantallas = isBejerman()
    ? !!payload.adjuntos?.pantallas
    : isLegal()
      ? !!payload.legal?.adjuntaPantallas
      : isChile()
        ? !!payload.chile?.adjuntaPantallas
        : !!payload.onvio?.adjuntaPantallas;

  // LEGAL: si marcó capturas tiene que subirlas. Bejerman/Onvio permiten generar sin subir (van en comentarios).
  if (isLegal() && quierePantallas && files.length === 0) {
    alert("Marcaste capturas pero no hay archivos. Usá «Examinar imágenes, video, PDF o TXT».");
    status.textContent = "Faltan capturas para adjuntar.";
    return;
  }

  try {
    if (btnCopiar) btnCopiar.disabled = true;
    if (btnVer) btnVer.disabled = true;
    payload.capturasEnlaces = [];
    if (files.length > 0) {
      status.textContent = "Subiendo capturas…";
      payload.capturasEnlaces = await subirCapturasReferral(files);
      if (payload.capturasEnlaces.length === 0) {
        throw new Error("No se obtuvieron links de las capturas subidas.");
      }
    }

    if (trazas.length > 0) {
      status.textContent = "Subiendo traza…";
      payload.trazaEnlaces = await subirTrazasReferral(trazas);
      if (payload.trazaEnlaces.length === 0) {
        throw new Error("No se obtuvieron links de la traza subida.");
      }
    }

    status.textContent = "Generando…";
    const response = await fetch("/api/planillas/referral/generar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (data.code === "ticket_confirm") {
        const ticketId = isLegal() ? "ref-legal-ticket" : "ref-onvio-ticket";
        const panelId = isLegal() ? "ref-legal-ticket-panel" : "ref-onvio-ticket-panel";
        if (confirm("¿Se solicitó ticket de servicio?")) {
          document.getElementById(ticketId).checked = true;
          document.getElementById(panelId)?.classList.remove("hidden");
          alert("Completá los datos del ticket y volvé a generar.");
        } else {
          alert("Es probable que I+D solicite un ticket de servicio para el análisis del caso.");
          ticketAvisoOmitido = true;
        }
        status.textContent = "";
        return;
      }
      throw new Error(data.error || data.detail || data.title || "Error al generar Referral I+D");
    }

    const capturasMsg = data.capturasSubidas > 0
      ? ` (${data.capturasSubidas} captura(s) con link en el texto)`
      : "";
    const trazasMsg = (payload.trazaEnlaces?.length || 0) > 0
      ? ` (${payload.trazaEnlaces.length} traza(s) con link de descarga)`
      : "";
    const autoMsg = autoPlanilla ? " Se marcaron los ítems obligatorios de planilla técnica." : "";

    if (copiar) {
      await navigator.clipboard.writeText(data.texto);
      status.textContent = `Texto copiado al portapapeles.${capturasMsg}${trazasMsg}${autoMsg}`;
    } else {
      showPlanTextPreview("ref-text-preview", data.texto);
      status.textContent = `Planilla lista.${capturasMsg}${trazasMsg}${autoMsg} Podés copiar desde el panel de vista previa.`;
    }
  } catch (ex) {
    status.textContent = ex.message || "Error";
    alert(status.textContent);
  } finally {
    if (btnCopiar) btnCopiar.disabled = false;
    if (btnVer) btnVer.disabled = false;
  }
}

async function mejorarReferralIa() {
  const status = document.getElementById("ref-status");
  const btn = document.getElementById("ref-btn-ia");
  referralIaUndo?.saveSnapshot();
  if (btn) btn.disabled = true;
  if (status) {
    status.textContent = "";
    status.classList.remove("is-error");
  }

  try {
    const response = await fetch("/api/planillas/referral/mejorar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ form: buildPayload() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      referralIaUndo?.clearSnapshot();
      const msg = data.detail || data.title || data.error || `Error ${response.status}`;
      if (status) {
        status.textContent = msg;
        status.classList.add("is-error");
      }
      alert(msg);
      return;
    }

    let updated = 0;
    if (data.asunto) {
      document.getElementById("ref-asunto").value = data.asunto;
      updated += 1;
    }
    if (data.descripcion) {
      setField("ref-descripcion", data.descripcion, REF_DESC_PH);
      updated += 1;
    }
    if (data.pasoAPaso) {
      setField("ref-paso", data.pasoAPaso, REF_PASO_PH);
      updated += 1;
    }

    if (updated === 0) {
      referralIaUndo?.clearSnapshot();
      const msg = "La IA respondió pero no se pudieron aplicar cambios en los campos.";
      if (status) {
        status.textContent = msg;
        status.classList.add("is-error");
      }
      alert(msg);
      return;
    }

    if (status) {
      status.textContent = "";
      status.classList.remove("is-error");
    }
    notifyIaUndoHint("ref-btn-ia-undo");
  } catch (ex) {
    referralIaUndo?.clearSnapshot();
    const msg = ex?.message || "Error al mejorar con IA";
    if (status) {
      status.textContent = msg;
      status.classList.add("is-error");
    }
    alert(msg);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function setField(id, value, ph) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value;
  el.classList.remove("placeholder-active");
}

function resetReferralForm() {
  referralIaUndo?.clearSnapshot();
  if (isLegal()) resetLegalReferralHub();
  resetChileReferral();
  versionSel = null;
  moduloSel = null;
  legalProdutoSel = null;
  legalModuloSel = null;
  legalAmbienteSel = null;
  capturaFiles.length = 0;
  trazaFiles.length = 0;
  onvioCapturaFiles.length = 0;
  legalCapturaFiles.length = 0;
  chileCapturaFiles.length = 0;
  ticketAvisoOmitido = false;
  mamState = {};
  sdkState = {};
  mamPersActu = "";
  mamTriggers = "";
  sdkApp = "";
  planillaState = { relevada: false, procesoFuncionaba: false, reproduceError: false, ultimaActualizOk: false };
  document.getElementById("ref-asunto").value = "";
  ["ref-descripcion", "ref-paso"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) { el.value = el.dataset.placeholder || ""; el.classList.add("placeholder-active"); }
  });
  document.querySelectorAll("#ref-bejerman-post input[type=checkbox], #ref-onvio-panel input[type=checkbox], #ref-legal-panel input[type=checkbox]").forEach((c) => { c.checked = false; });
  document.querySelectorAll(".plan-adj-card, .plan-backup-base-card, .plan-onvio-card").forEach((el) => el.classList.remove("selected"));
  document.querySelectorAll(".plan-onvio-card .card-mark").forEach((mark) => applyCardMark(mark, false));
  clearBackupBases();
  clearOnvioTicketFields();
  clearLegalTicketFields();
  ["ref-legal-chave", "ref-legal-usuario", "ref-legal-escritorio", "ref-onvio-usuario", "ref-onvio-empresa", "ref-onvio-ejercicio"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  ["ref-capturas-panel", "ref-traza-panel", "ref-backup-panel", "ref-onvio-capturas", "ref-onvio-ticket-panel", "ref-legal-capturas", "ref-legal-ticket-panel", "ref-chile-capturas", "ref-chile-bases-panel"].forEach((id) => {
    document.getElementById(id)?.classList.add("hidden");
  });
  revokeCapturaThumbUrls(document.getElementById("ref-capturas-chips"));
  revokeCapturaThumbUrls(document.getElementById("ref-onvio-capt-chips"));
  revokeCapturaThumbUrls(document.getElementById("ref-legal-capt-chips"));
  revokeCapturaThumbUrls(document.getElementById("ref-chile-capt-chips"));
  document.getElementById("ref-capturas-chips").innerHTML = "";
  document.getElementById("ref-traza-chips").innerHTML = "";
  document.getElementById("ref-onvio-capt-chips").innerHTML = "";
  document.getElementById("ref-legal-capt-chips").innerHTML = "";
  document.getElementById("ref-chile-capt-chips").innerHTML = "";
  document.getElementById("ref-capturas-estado").textContent = "";
  document.getElementById("ref-traza-estado").textContent = "";
  document.getElementById("ref-onvio-capt-estado").textContent = "";
  document.getElementById("ref-legal-capt-estado").textContent = "";
  document.getElementById("ref-chile-capt-estado").textContent = "";
  document.getElementById("ref-status").textContent = "";
  clearPlanTextPreview("ref-text-preview");
  updateReferralPanels();
}

async function openMamModal() {
  const { runMamDialog } = await loadReferralDialogs();
  const result = await runMamDialog(ctx.getConfig()?.referral, { mamState, mamPersActu, mamTriggers });
  if (!result) return;
  mamState = result.mamState;
  mamPersActu = result.mamPersActu;
  mamTriggers = result.mamTriggers;
  updateCheckStatuses();
}

async function openSdkModal() {
  const { runSdkDialog } = await loadReferralDialogs();
  const result = await runSdkDialog(ctx.getConfig()?.referral, { sdkState, sdkApp });
  if (!result) return;
  sdkState = result.sdkState;
  sdkApp = result.sdkApp;
  updateCheckStatuses();
}

async function openPlanillaModalAsync() {
  const { runPlanillaDialog } = await loadReferralDialogs();
  const result = await runPlanillaDialog(planillaState);
  if (!result) return;
  planillaState = { ...planillaState, ...result };
  updateCheckStatuses();
}
