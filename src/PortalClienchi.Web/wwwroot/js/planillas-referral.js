import {
  initReferralDialogs,
  runMamDialog,
  runSdkDialog,
  runPlanillaDialog,
} from "./planillas-referral-dialogs.js";
import { snapshotFields, restoreFields, bindIaUndoButtons } from "./plan-ia-undo.js";

const REF_DESC_PH = "Detalle y/o descripción del caso";
const REF_PASO_PH = "Detalle paso a paso del proceso realizado por el usuario";

let ctx = null;
let versionSel = null;
let moduloSel = null;
let capturaFiles = [];
let onvioCapturaFiles = [];
let ticketAvisoOmitido = false;
let mamState = {};
let sdkState = {};
let mamPersActu = "";
let mamTriggers = "";
let sdkApp = "";
let planillaState = { relevada: false, procesoFuncionaba: false, reproduceError: false, ultimaActualizOk: false };
let referralIaUndo = null;

export function initReferralModule(context) {
  ctx = context;
  initReferralDialogs();
  bindReferralEvents();
}

export function openReferral() {
  if (!ctx) return;
  resetReferralForm();
  updateReferralPanels();
  document.getElementById("ref-sistema-badge").textContent = sistemaLabel();
  ctx.showView("referral");
}

function sistemaLabel() {
  return ctx.getSistema() === "OnvioWeb" ? "ONVIO/Bejerman WEB" : "Bejerman SQL";
}

function isBejerman() {
  return ctx.getSistema() === "BejermanSql";
}

function updateReferralPanels() {
  const bej = isBejerman();
  document.getElementById("ref-bejerman-panel")?.classList.toggle("hidden", !bej);
  document.getElementById("ref-bejerman-post")?.classList.toggle("hidden", !bej);
  document.getElementById("ref-onvio-panel")?.classList.toggle("hidden", bej);
  document.getElementById("ref-btn-ia")?.classList.toggle("hidden", !ctx.getConfig()?.referral?.iaConfigured);
  buildReferralPills();
  updateCheckStatuses();
  updateSqlPanel();
  syncReferralCards();
}

function buildReferralPills() {
  const cfg = ctx.getConfig()?.referral;
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
  }
}

function updateSqlPanel() {
  const backup = document.getElementById("ref-adj-backup")?.checked;
  const anyBase = ["ref-backup-manager", "ref-backup-sbda", "ref-backup-cg", "ref-backup-sj"]
    .some((id) => document.getElementById(id)?.checked);
  document.getElementById("ref-sql-panel")?.classList.toggle("hidden", !(backup && anyBase));
}

function updateCheckStatuses() {
  const mamOk = Object.values(mamState).some(Boolean);
  const sdkOk = Object.values(sdkState).some(Boolean);
  const planOk = planillaState.relevada && planillaState.procesoFuncionaba && planillaState.reproduceError && planillaState.ultimaActualizOk;
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
  if (mark) {
    mark.textContent = check.checked ? "✓" : "○";
    mark.style.color = check.checked ? "#16a34a" : "#94a3b8";
  }
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
  updateSqlPanel();
}

function syncReferralCards() {
  [
    ["ref-card-pantallas", "ref-adj-pantallas", "ref-mark-pantallas"],
    ["ref-card-traza", "ref-adj-traza", "ref-mark-traza"],
    ["ref-card-backup", "ref-adj-backup", "ref-mark-backup"],
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
    if (mark) { mark.textContent = "○"; mark.style.color = "#94a3b8"; }
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
    if (mark) {
      mark.textContent = check.checked ? "✓" : "○";
      mark.style.color = check.checked ? "#16a34a" : "#94a3b8";
    }
    onChange?.();
  };
  card.addEventListener("click", sync);
}

function bindReferralEvents() {
  document.querySelector("[data-plan-back-referral]")?.addEventListener("click", () => ctx.showView("menu"));

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
        if (col) col.selectedIndex = 0;
        if (sql) sql.selectedIndex = 0;
      }
      buildReferralPills();
    }
  });

  bindAdjCard("ref-card-pantallas", "ref-adj-pantallas", "ref-mark-pantallas", () => {
    document.getElementById("ref-capturas-panel")?.classList.toggle("hidden", !document.getElementById("ref-adj-pantallas").checked);
  });
  bindAdjCard("ref-card-traza", "ref-adj-traza", "ref-mark-traza");
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
  bindAdjCard("ref-card-onvio-rep-ticket", "ref-onvio-rep-ticket", null);
  bindAdjCard("ref-card-onvio-rep-prueba", "ref-onvio-rep-prueba", null);

  setupPlaceholder("ref-descripcion", REF_DESC_PH);
  setupPlaceholder("ref-paso", REF_PASO_PH);

  document.getElementById("ref-btn-mam")?.addEventListener("click", () => openMamModal());
  document.getElementById("ref-btn-sdk")?.addEventListener("click", () => openSdkModal());
  document.getElementById("ref-btn-planilla")?.addEventListener("click", () => openPlanillaModalAsync());

  setupCapturas("ref-capturas", capturaFiles);
  setupCapturas("ref-onvio-capt", onvioCapturaFiles);

  document.getElementById("ref-btn-copiar")?.addEventListener("click", () => generarReferral(true));
  document.getElementById("ref-btn-txt")?.addEventListener("click", () => generarReferral(false));
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

  const check = document.getElementById("ref-onvio-pantallas");
  if (!check) return;
  check.checked = checked;
  const card = document.getElementById("ref-card-onvio-pantallas");
  const mark = card?.querySelector(".card-mark");
  if (mark) {
    mark.textContent = checked ? "✓" : "○";
    mark.style.color = checked ? "#16a34a" : "#94a3b8";
  }
  document.getElementById("ref-onvio-capturas")?.classList.toggle("hidden", !checked);
}

function isReferralCapturaFile(file) {
  if (/\.(png|jpe?g|gif|bmp|webp)$/i.test(file.name || "")) return true;
  return (file.type || "").startsWith("image/");
}

function addReferralCapturaFiles(fileList, targetList) {
  let added = 0;
  for (const file of fileList) {
    if (!isReferralCapturaFile(file)) continue;
    if (!targetList.some((f) => f.name === file.name && f.size === file.size)) {
      targetList.push(file);
      added++;
    }
  }
  if (added > 0) setReferralPantallasUi(true);
  return added;
}

function refreshCapturasEstadoReferral(prefix, fileList) {
  const estadoId = prefix === "ref-capturas" ? "ref-capturas-estado" : "ref-onvio-capt-estado";
  const estado = document.getElementById(estadoId);
  if (!estado) return;
  if (fileList.length === 0) {
    estado.textContent = "";
    return;
  }
  estado.textContent = `${fileList.length} imagen(es) lista(s) para subir al generar el .txt.`;
}

function setupCapturas(prefix, fileList) {
  document.getElementById(`${prefix}-agregar`)?.addEventListener("click", () => {
    document.getElementById(`${prefix}-input`)?.click();
  });
  document.getElementById(`${prefix}-input`)?.addEventListener("change", (e) => {
    const added = addReferralCapturaFiles(e.target.files, fileList);
    if (added === 0 && e.target.files?.length > 0) {
      alert("Solo se admiten imágenes (PNG, JPG, GIF, BMP, WEBP).");
    }
    refreshChips(`${prefix}-chips`, fileList);
    refreshCapturasEstadoReferral(prefix, fileList);
    e.target.value = "";
  });
  document.getElementById(`${prefix}-pegar`)?.addEventListener("click", async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const t = item.types.find((x) => x.startsWith("image/"));
        if (!t) continue;
        const blob = await item.getType(t);
        const ext = t.split("/")[1]?.replace("jpeg", "jpg") || "png";
        const file = new File([blob], `captura_${Date.now()}.${ext}`, { type: t });
        addReferralCapturaFiles([file], fileList);
        refreshChips(`${prefix}-chips`, fileList);
        refreshCapturasEstadoReferral(prefix, fileList);
        return;
      }
      alert("No hay imagen en el portapapeles.");
    } catch {
      alert("No se pudo pegar imagen.");
    }
  });
}

function getReferralCapturaFiles() {
  return isBejerman() ? capturaFiles : onvioCapturaFiles;
}

function refreshChips(id, files) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = files.map((f) => `<span class="plan-chip">${f.name}</span>`).join("");
}

function buildPayload() {
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
    payload.mamSelections = { ...mamState };
    payload.mamPersActuNombre = mamPersActu;
    payload.mamTriggersDesactivados = mamTriggers;
    payload.sdkSelections = { ...sdkState };
    payload.sdkAplicacionIntegracion = sdkApp;
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
      trazaSql: document.getElementById("ref-adj-traza")?.checked,
      backupBases: document.getElementById("ref-adj-backup")?.checked,
      backupManager: document.getElementById("ref-backup-manager")?.checked,
      backupSbda: document.getElementById("ref-backup-sbda")?.checked,
      backupCg: document.getElementById("ref-backup-cg")?.checked,
      backupSj: document.getElementById("ref-backup-sj")?.checked,
    };
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
    } else {
      if (!payload.onvio) payload.onvio = {};
      payload.onvio.adjuntaPantallas = true;
    }
    return files;
  }

  const marcado = isBejerman()
    ? !!payload.adjuntos?.pantallas
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

async function generarReferral(copiar) {
  const status = document.getElementById("ref-status");
  const payload = buildPayload();
  const files = pickReferralCapturaFiles(payload);
  const quierePantallas = isBejerman()
    ? !!payload.adjuntos?.pantallas
    : !!payload.onvio?.adjuntaPantallas;

  if (quierePantallas && files.length === 0) {
    alert("Marcaste capturas pero no hay imágenes cargadas. Usá «Examinar…» o «Pegar del portapapeles» en el panel de capturas.");
    status.textContent = "Faltan imágenes para adjuntar.";
    return;
  }

  try {
    if (files.length > 0) {
      status.textContent = "Subiendo capturas…";
      payload.capturasEnlaces = await subirCapturasReferral(files);
      if (payload.capturasEnlaces.length === 0) {
        throw new Error("No se obtuvieron links de las capturas subidas.");
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
        if (confirm("¿Se solicitó ticket de servicio?")) {
          document.getElementById("ref-onvio-ticket").checked = true;
          document.getElementById("ref-onvio-ticket-panel")?.classList.remove("hidden");
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

    if (copiar) {
      await navigator.clipboard.writeText(data.texto);
      status.textContent = `Texto copiado al portapapeles.${capturasMsg}`;
    } else {
      const blob = new Blob([data.texto], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = data.fileName || "referral.txt";
      a.click();
      status.textContent = `Archivo .txt descargado.${capturasMsg}`;
    }
  } catch (ex) {
    status.textContent = ex.message || "Error";
    alert(status.textContent);
  }
}

async function mejorarReferralIa() {
  const status = document.getElementById("ref-status");
  const btn = document.getElementById("ref-btn-ia");
  referralIaUndo?.saveSnapshot();
  if (btn) btn.disabled = true;
  status.textContent = "Mejorando con IA…";

  try {
    const response = await fetch("/api/planillas/referral/mejorar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ form: buildPayload() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      referralIaUndo?.clearSnapshot();
      status.textContent = data.detail || "Error IA";
      return;
    }
    if (data.asunto) document.getElementById("ref-asunto").value = data.asunto;
    if (data.descripcion) setField("ref-descripcion", data.descripcion, REF_DESC_PH);
    if (data.pasoAPaso) setField("ref-paso", data.pasoAPaso, REF_PASO_PH);
    status.textContent = "Redacción mejorada. Usá «Deshacer» si no te convence.";
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
  versionSel = null;
  moduloSel = null;
  capturaFiles.length = 0;
  onvioCapturaFiles.length = 0;
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
  document.querySelectorAll("#ref-bejerman-post input[type=checkbox], #ref-onvio-panel input[type=checkbox]").forEach((c) => { c.checked = false; });
  document.querySelectorAll(".plan-adj-card, .plan-backup-base-card, .plan-onvio-card").forEach((el) => el.classList.remove("selected"));
  clearBackupBases();
  clearOnvioTicketFields();
  ["ref-capturas-panel", "ref-backup-panel", "ref-onvio-capturas", "ref-onvio-ticket-panel"].forEach((id) => {
    document.getElementById(id)?.classList.add("hidden");
  });
  document.getElementById("ref-capturas-chips").innerHTML = "";
  document.getElementById("ref-onvio-capt-chips").innerHTML = "";
  document.getElementById("ref-capturas-estado").textContent = "";
  document.getElementById("ref-onvio-capt-estado").textContent = "";
  document.getElementById("ref-status").textContent = "";
  updateReferralPanels();
}

async function openMamModal() {
  const result = await runMamDialog(ctx.getConfig()?.referral, { mamState, mamPersActu, mamTriggers });
  if (!result) return;
  mamState = result.mamState;
  mamPersActu = result.mamPersActu;
  mamTriggers = result.mamTriggers;
  updateCheckStatuses();
}

async function openSdkModal() {
  const result = await runSdkDialog(ctx.getConfig()?.referral, { sdkState, sdkApp });
  if (!result) return;
  sdkState = result.sdkState;
  sdkApp = result.sdkApp;
  updateCheckStatuses();
}

async function openPlanillaModalAsync() {
  const result = await runPlanillaDialog(planillaState);
  if (!result) return;
  planillaState = { ...planillaState, ...result };
  updateCheckStatuses();
}
