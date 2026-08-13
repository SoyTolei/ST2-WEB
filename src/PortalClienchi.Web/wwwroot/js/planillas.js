import { injectModuleHeaders } from "./planillas-icons.js";
import { snapshotFields, restoreFields, bindIaUndoButtons, syncIaUndoBar } from "./plan-ia-undo.js";
import { updatePlanBuildBadge } from "./plan-build.js";
import { showPlanTextPreview, clearPlanTextPreview, mountPlanTextPreview } from "./plan-text-preview.js";
import { initPdfPortalGenerator, syncPdfPortalModuleVisibility, canSeePdfPortalModule } from "./pdf-portal.js";
import { initBlanqueoModule, syncBlanqueoModuleVisibility, canSeeBlanqueoModule, openBlanqueoModule } from "./planillas-blanqueo.js";
import { refreshModuleFlags, canSeeOportunidadModule } from "./module-access.js";
import {
  startBlanqueoAlertsPolling,
  markBlanqueoAlertsSeen,
  renderBlanqueoAlertUi,
} from "./blanqueo-alerts.js";

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

function isLegalSistema(id) {
  return id === "Legal";
}

function isSistemaPlaceholder(id) {
  if (id === "Chile") return true;
  if (isLegalSistema(id)) {
    const cfg = planillasConfig?.sistemas?.find((s) => s.id === "Legal");
    return cfg?.placeholder !== false;
  }
  return false;
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

function updateSistemaBetaUi() {
  document.getElementById("plan-legal-beta-pill")?.classList.toggle("hidden", !isSistemaBeta("Legal"));
  document.getElementById("plan-chile-beta-pill")?.classList.toggle("hidden", !isSistemaBeta("Chile"));
  document.getElementById("plan-legal-beta-note")?.classList.toggle("hidden", !(isSistemaBeta("Legal") && isLegal()));
  document.getElementById("plan-chile-beta-note")?.classList.toggle("hidden", !(isSistemaBeta("Chile") && isChile()));
}

let planillasConfig = null;
let sistemaActual = null;
let mesaActual = null;
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
};

const els = {
  sistemaBtns: () => document.querySelectorAll("[data-plan-sistema]"),
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

function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    if (!el) return;
    el.classList.toggle("hidden", key !== name);
  });
  injectModuleHeaders();
}

function setSistemaIndicator(index) {
  const grid = document.querySelector(".plan-sistema-grid");
  const indicator = els.sistemaIndicator();
  const btn = [...els.sistemaBtns()][index];
  if (!grid || !indicator || !btn) return;

  indicator.style.width = `${btn.offsetWidth}px`;
  indicator.style.transform = `translate3d(${btn.offsetLeft}px, 0, 0)`;
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

  const transferBtn = document.getElementById("plan-modulo-transferencia");
  const transferNa = document.getElementById("plan-modulo-transferencia-na");
  const referralBtn = document.querySelector('[data-plan-modulo="referral"]');
  const oportunidadBtn = document.querySelector('[data-plan-modulo="oportunidad"]');
  const oportunidadNa = document.getElementById("plan-modulo-oportunidad-na");
  const placeholderBlocked = !sistemaActual || isSistemaPlaceholder(sistemaActual);
  const legalSelected = sistemaActual === "Legal" && !isSistemaPlaceholder("Legal");

  if (transferBtn) {
    transferBtn.classList.toggle("hidden", legalSelected);
    transferBtn.disabled = placeholderBlocked || legalSelected;
  }
  if (transferNa) {
    transferNa.classList.toggle("hidden", !legalSelected);
    transferNa.setAttribute("aria-hidden", legalSelected ? "false" : "true");
  }
  if (referralBtn) referralBtn.disabled = placeholderBlocked;

  if (oportunidadBtn) {
    const allowedOp = canSeeOportunidadModule();
    oportunidadBtn.classList.toggle("hidden", legalSelected || !allowedOp);
    oportunidadBtn.disabled = placeholderBlocked || !allowedOp;
  }
  if (oportunidadNa) {
    // Solo mostrar "no corresponde" en LEGAL cuando la persona sí tiene permiso de oportunidad.
    const showNa = legalSelected && canSeeOportunidadModule();
    oportunidadNa.classList.toggle("hidden", !showNa);
    oportunidadNa.setAttribute("aria-hidden", showNa ? "false" : "true");
  }
  syncPdfPortalModuleVisibility();
  syncBlanqueoModuleVisibility();
  updateSistemaBetaUi();
}

function selectSistema(id) {
  sistemaActual = id;
  updateSistemaUi();
  updateTransferenciaPanels();
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
  els.sistemaBadge().textContent = sistemaDisplayLabel(sistemaActual);
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

function openReferralShell() {
  const badge = document.getElementById("ref-sistema-badge");
  if (badge) badge.textContent = sistemaDisplayLabel(sistemaActual);
  setModuleLoading("plan-referral-loading", true);
  showView("referral");
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
    if (!sistemaActual || isSistemaPlaceholder(sistemaActual) || isLegal()) return;
    initTransferenciaForm();
    showView("transferencia");
  });

  document.querySelector('[data-plan-modulo="referral"]')?.addEventListener("click", async () => {
    if (!sistemaActual || isSistemaPlaceholder(sistemaActual)) return;
    openReferralShell();
    try {
      const mod = await loadReferralModule();
      mod.openReferral();
    } finally {
      setModuleLoading("plan-referral-loading", false);
    }
  });

  document.querySelector('[data-plan-modulo="referral"]')?.addEventListener("pointerenter", () => {
    void loadReferralModule();
  }, { passive: true });

  document.querySelector('[data-plan-modulo="oportunidad"]')?.addEventListener("click", async () => {
    if (!sistemaActual || isSistemaPlaceholder(sistemaActual)) return;
    if (!canSeeOportunidadModule()) return;
    const mod = await loadOportunidadModule();
    mod.openOportunidadMenu();
  });

  document.querySelector('[data-plan-modulo="pdf-portal"]')?.addEventListener("click", () => {
    if (!canSeePdfPortalModule()) return;
    initPdfPortalGenerator();
    showView("pdfPortal");
  });

  document.querySelector('[data-plan-modulo="blanqueo"]')?.addEventListener("click", async () => {
    if (!canSeeBlanqueoModule()) return;
    showView("blanqueo");
    await openBlanqueoModule();
    await markBlanqueoAlertsSeen();
  });

  document.addEventListener("st2:open-blanqueo-from-alert", () => {
    void (async () => {
      if (!canSeeBlanqueoModule()) return;
      showView("blanqueo");
      await openBlanqueoModule();
      await markBlanqueoAlertsSeen();
    })();
  });

  document.querySelectorAll("[data-plan-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("st2:planillas-home"));
      showView("menu");
      void refreshModuleFlags().then(() => updateSistemaUi());
    });
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

function initSecretRunnerTrigger() {
  const trigger = document.getElementById("planillas-secret-trigger");
  const emojiEl = document.getElementById("planillas-secret-emoji");
  if (!trigger) return;

  const secretUrl = "https://referralrunner.tolei.dev/";
  const clicksNeeded = 8;
  const resetMs = 4000;
  const plantEmojis = ["🌱", "🌿", "🍀", "🪴", "🌳", "🌾", "☘️", "🌲"];
  let count = 0;
  let resetTimer = null;
  let emojiIndex = 0;
  let emojiTimer = null;
  let isAnimating = false;

  function rotateEmoji() {
    if (!emojiEl || isAnimating) return;
    isAnimating = true;
    emojiEl.classList.add("is-changing");
    setTimeout(() => {
      emojiIndex = (emojiIndex + 1) % plantEmojis.length;
      emojiEl.textContent = plantEmojis[emojiIndex];
      emojiEl.classList.remove("is-changing");
      isAnimating = false;
    }, 220);
  }

  emojiTimer = setInterval(rotateEmoji, 2600);

  trigger.addEventListener("click", () => {
    count += 1;
    clearTimeout(resetTimer);
    rotateEmoji();
    if (count >= clicksNeeded) {
      count = 0;
      clearInterval(emojiTimer);
      window.location.href = secretUrl;
      return;
    }
    resetTimer = setTimeout(() => {
      count = 0;
    }, resetMs);
  });
}

export function goPlanillasHome() {
  if (!views.menu) return;
  // Invalidar cargas en vuelo del módulo abierto (evita errores fantasma al volver).
  document.dispatchEvent(new CustomEvent("st2:planillas-home"));
  showView("menu");
  selectSistema("BejermanSql");
  void refreshModuleFlags().then(() => {
    updateSistemaUi();
  });
}

export function initPlanillas() {
  if (!views.menu) return;

  injectModuleHeaders();
  initTransferenciaIaUi();
  bindEvents();
  bindSistemaIndicatorLayout();
  selectSistema("BejermanSql");
  initSecretRunnerTrigger();
  initPdfPortalGenerator();
  syncPdfPortalModuleVisibility();
  initBlanqueoModule();
  syncBlanqueoModuleVisibility();
  showView("menu");

  void refreshModuleFlags().then(() => {
    updateSistemaUi();
    // Retrasar polling para no sumar al pico de arranque (Cloudflare 1015/429).
    setTimeout(() => {
      startBlanqueoAlertsPolling();
      renderBlanqueoAlertUi();
    }, 12000);
  });

  void loadConfig().then(() => {
    updatePlanBuildBadge(planillasConfig?.webBuild);
    updateSistemaUi();
    if (planillasConfig?.webBuild) {
      console.info(`[ST2 Planillas] build: ${planillasConfig.webBuild}`);
    }
    // Prefetch diferido: no competir con session/modules/config.
    setTimeout(() => {
      void loadReferralModule();
      void loadOportunidadModule();
    }, 2500);
  });
}
