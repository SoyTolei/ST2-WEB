import { initReferralModule, openReferral } from "./planillas-referral.js";
import { initOportunidadModule, openOportunidadMenu } from "./planillas-oportunidad.js";
import { injectModuleHeaders } from "./planillas-icons.js";

const DESCRIPCION_PLACEHOLDER = "Detalle y/o proceso realizado por el usuario";

const MESA_LABELS = {
  TECNICO: "TECNICOS",
  FLEX: "FLEX",
  SAAS: "SaaS",
  SUELDOS: "Sueldos y Jornales",
};

let planillasConfig = null;
let sistemaActual = null;
let mesaActual = null;
let capturaFiles = [];
let descripcionEsPlaceholder = true;

const views = {
  menu: document.getElementById("planillas-menu"),
  transferencia: document.getElementById("planillas-transferencia"),
  placeholder: document.getElementById("planillas-placeholder"),
  referral: document.getElementById("planillas-referral"),
  oportunidadMenu: document.getElementById("planillas-oportunidad-menu"),
  oportunidadCargar: document.getElementById("planillas-oportunidad-cargar"),
  oportunidadGestor: document.getElementById("planillas-oportunidad-gestor"),
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
  btnGenerarCopiar: () => document.getElementById("plan-btn-copiar"),
  btnGenerarTxt: () => document.getElementById("plan-btn-txt"),
};

function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    if (!el) return;
    el.classList.toggle("hidden", key !== name);
  });
  injectModuleHeaders();
}

function setSistemaIndicator(index) {
  const indicator = els.sistemaIndicator();
  if (!indicator) return;
  indicator.style.transform = `translateX(${index * 100}%)`;
}

function updateSistemaUi() {
  const index = sistemaActual === "OnvioWeb" ? 1 : sistemaActual === "Legal" ? 2 : 0;
  els.sistemaBtns().forEach((btn) => {
    const active = btn.dataset.planSistema === sistemaActual;
    btn.classList.toggle("active", active);
  });
  setSistemaIndicator(index);

  const transferBtn = document.querySelector('[data-plan-modulo="transferencia"]');
  const referralBtn = document.querySelector('[data-plan-modulo="referral"]');
  const oportunidadBtn = document.querySelector('[data-plan-modulo="oportunidad"]');
  const enabled = sistemaActual && sistemaActual !== "Legal";
  [transferBtn, referralBtn, oportunidadBtn].forEach((b) => {
    if (b) b.disabled = !enabled;
  });
}

function selectSistema(id) {
  sistemaActual = id;
  updateSistemaUi();
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

function refreshCapturasUi() {
  const chips = els.capturasChips();
  const estado = els.capturasEstado();
  if (!chips) return;

  chips.innerHTML = "";
  capturaFiles.forEach((f) => {
    const span = document.createElement("span");
    span.className = "plan-chip";
    span.textContent = f.name;
    chips.appendChild(span);
  });

  if (estado) {
    const hosting = planillasConfig?.capturaHosting?.configured;
    if (capturaFiles.length === 0) {
      estado.textContent = hosting
        ? "Agregá imágenes; se subirán al generar la planilla."
        : "Hosting de capturas no configurado: el texto indicará adjunto en comentarios.";
    } else {
      estado.textContent = `${capturaFiles.length} imagen(es) lista(s) para subir.`;
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
  const allowed = /\.(png|jpe?g|gif|bmp|webp)$/i;
  let added = 0;
  for (const file of fileList) {
    if (!allowed.test(file.name)) continue;
    if (!capturaFiles.some((f) => f.name === file.name && f.size === file.size)) {
      capturaFiles.push(file);
      added++;
    }
  }
  if (added > 0) refreshCapturasUi();
}

async function pegarCaptura() {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith("image/"));
      if (!imageType) continue;
      const blob = await item.getType(imageType);
      const ext = imageType.split("/")[1]?.replace("jpeg", "jpg") || "png";
      const file = new File([blob], `captura_${Date.now()}.${ext}`, { type: imageType });
      capturaFiles.push(file);
      refreshCapturasUi();
      return;
    }
    alert("No hay imagen en el portapapeles.");
  } catch {
    alert("No se pudo leer el portapapeles. Probá «Agregar imágenes».");
  }
}

function limpiarTransferencia() {
  mesaActual = null;
  capturaFiles = [];
  descripcionEsPlaceholder = true;

  els.numeroCliente().value = "";
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
  refreshCapturasUi();
  setPlanStatus("");
}

function initTransferenciaForm() {
  const labels = {
    BejermanSql: "Bejerman SQL",
    OnvioWeb: "ONVIO/Bejerman WEB",
  };
  els.sistemaBadge().textContent = labels[sistemaActual] || "";
  limpiarTransferencia();
}

function getDescripcionPlain() {
  if (descripcionEsPlaceholder) return "";
  return els.descripcion().value.trim();
}

function validarCampos() {
  if (!els.numeroCliente().value.trim()) {
    alert("Completá el N° de Cliente.");
    els.numeroCliente().focus();
    return false;
  }
  if (!mesaActual) {
    alert("Elegí la mesa de destino (Técnico, Flex, SaaS o Sueldos).");
    return false;
  }
  if (!els.asunto().value.trim()) {
    alert("Completá el campo Asunto y/o Error.");
    els.asunto().focus();
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
  return {
    sistema: sistemaActual,
    numeroCliente: els.numeroCliente().value.trim(),
    mesa: mesaActual,
    asunto: els.asunto().value.trim(),
    descripcion: getDescripcionPlain() || null,
    capturas: els.capturasCheck().checked === true,
    ticketSolicitado: els.ticketCheck().checked === true,
    numeroTicket: els.ticketNumero().value.trim() || null,
  };
}

function setPlanStatus(text, isError = false) {
  const el = els.planStatus();
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? "#b91c1c" : "";
}

async function generarTexto() {
  if (!validarCampos() || !preguntarTicketSiSaasSueldos()) return null;

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

  const ia = data.iaUsada ? " (con IA)" : "";
  setPlanStatus(`Planilla generada${ia}.`);
  return data;
}

async function onGenerarCopiar() {
  const btn = els.btnGenerarCopiar();
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

async function onGenerarTxt() {
  const btn = els.btnGenerarTxt();
  btn.disabled = true;
  try {
    const data = await generarTexto();
    if (!data?.texto) return;

    const blob = new Blob([data.texto], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = data.fileName || "transferencia.txt";
    a.click();
    URL.revokeObjectURL(url);
    setPlanStatus("Archivo .txt descargado.");
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
    sistemaActual === "Legal"
      ? "El módulo LEGAL estará disponible en una próxima versión."
      : `${moduleTitle} se migrará en una próxima fase. Por ahora usá Transferencia de Casos.`;
  showView("placeholder");
}

function bindEvents() {
  els.sistemaBtns().forEach((btn) => {
    btn.addEventListener("click", () => selectSistema(btn.dataset.planSistema));
  });

  document.querySelector('[data-plan-modulo="transferencia"]')?.addEventListener("click", () => {
    if (!sistemaActual || sistemaActual === "Legal") return;
    initTransferenciaForm();
    showView("transferencia");
  });

  document.querySelector('[data-plan-modulo="referral"]')?.addEventListener("click", () => {
    if (!sistemaActual || sistemaActual === "Legal") return;
    openReferral();
  });

  document.querySelector('[data-plan-modulo="oportunidad"]')?.addEventListener("click", () => {
    if (!sistemaActual || sistemaActual === "Legal") return;
    openOportunidadMenu();
  });

  document.querySelectorAll("[data-plan-back]").forEach((btn) => {
    btn.addEventListener("click", () => showView("menu"));
  });

  els.mesaBtns().forEach((btn) => {
    btn.addEventListener("click", () => toggleMesa(btn.dataset.mesa));
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

  document.getElementById("plan-capturas-pegar")?.addEventListener("click", pegarCaptura);

  document.getElementById("plan-capturas-quitar")?.addEventListener("click", () => {
    capturaFiles = [];
    refreshCapturasUi();
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

  els.btnGenerarCopiar()?.addEventListener("click", onGenerarCopiar);
  els.btnGenerarTxt()?.addEventListener("click", onGenerarTxt);
  document.getElementById("plan-btn-limpiar")?.addEventListener("click", limpiarTransferencia);
}

async function loadConfig() {
  try {
    const response = await fetch("/api/planillas/config");
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

export async function initPlanillas() {
  if (!views.menu) return;

  await loadConfig();
  injectModuleHeaders();
  selectSistema("BejermanSql");
  initReferralModule(planillasContext);
  initOportunidadModule(planillasContext);
  bindEvents();
  showView("menu");
}
