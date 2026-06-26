import {
  ensurePlanUser,
  getPlanUserEmail,
  planUserFetch,
  refreshPlanUserSession,
  syncPlanUserSession,
} from "./plan-user.js";
import { snapshotFields, restoreFields, bindIaUndoButtons, syncIaUndoBar } from "./plan-ia-undo.js";

let ctx = null;
let metodoContacto = null;

const GESTOR_POR_PAGINA = 5;
const LINK_PLACEHOLDER = "Pegar link de la oportunidad";
const GESTOR_MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

let gestorAllItems = [];
let gestorFiltered = [];
let gestorPagina = 1;
let gestorSelectedId = null;
let gestorUpdatingMonthCombo = false;
let linkPlaceholderActive = true;
let oportunidadIaUndo = null;

export function initOportunidadModule(context) {
  ctx = context;
  bindOportunidadEvents();
  initGestorUi();
  refreshPlanUserSession();
  window.__st2ReloadGestor = (email) => cargarGestor(email);
}

export function openOportunidadMenu() {
  if (!ctx) return;
  document.getElementById("op-menu-sistema").textContent = sistemaLabel();
  ctx.showView("oportunidadMenu");
}

function sistemaLabel() {
  const id = ctx.getSistema();
  return {
    BejermanSql: "Bejerman SQL",
    OnvioWeb: "ONVIO/Bejerman WEB",
    Legal: "LEGAL",
    Chile: "Chile",
  }[id] || "Bejerman SQL";
}

function bindOportunidadEvents() {
  document.querySelector("[data-plan-back-op-menu]")?.addEventListener("click", () => ctx.showView("menu"));
  document.querySelector("[data-plan-back-op-cargar]")?.addEventListener("click", () => ctx.showView("oportunidadMenu"));
  document.querySelector("[data-plan-back-op-gestor]")?.addEventListener("click", () => ctx.showView("oportunidadMenu"));

  document.querySelectorAll("[data-op-view]").forEach((card) => {
    const go = () => {
      if (card.dataset.opView === "cargar") openCargar();
      else openGestor();
    };
    card.addEventListener("click", go);
    card.querySelector(".plan-op-open-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      go();
    });
  });

  document.getElementById("op-metodo-radios")?.addEventListener("change", (e) => {
    if (e.target.name === "op-metodo") metodoContacto = e.target.value;
  });

  document.getElementById("op-numero")?.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "");
  });

  document.getElementById("op-btn-pdf")?.addEventListener("click", generarPdf);
  document.getElementById("op-btn-limpiar")?.addEventListener("click", limpiarCargar);
  document.getElementById("op-btn-ia")?.addEventListener("click", mejorarOportunidadIa);
  oportunidadIaUndo = bindIaUndoButtons({
    undoBtnId: "op-btn-ia-undo",
    getSnapshot: () => snapshotFields(oportunidadIaFieldDefs()),
    onUndo: (snap) => restoreFields(oportunidadIaFieldDefs(), snap),
  });
  document.getElementById("op-btn-ia-undo")?.addEventListener("click", () => oportunidadIaUndo.undo());
  document.getElementById("op-gestor-agregar")?.addEventListener("mousedown", () => {
    clearLinkPlaceholder();
  });
  document.getElementById("op-gestor-agregar")?.addEventListener("click", agregarGestor);
  bindGestorEvents();
}

function openCargar() {
  document.getElementById("op-cargar-sistema").textContent = sistemaLabel();
  syncIaUndoBar("op-btn-ia", "op-btn-ia-undo", ctx.getConfig()?.oportunidad?.iaConfigured);
  ctx.showView("oportunidadCargar");
}

function oportunidadIaFieldDefs() {
  return [
    {
      id: "op-metodo",
      kind: "radio-group",
      name: "op-metodo",
      onRestore: (value) => setMetodoContacto(value),
    },
    { id: "op-numero" },
    { id: "op-razon" },
    { id: "op-contacto" },
    { id: "op-telefono" },
    { id: "op-correo" },
    { id: "op-horarios" },
    { id: "op-descripcion" },
  ];
}

async function openGestor() {
  await syncPlanUserSession();
  const user = await ensurePlanUser();
  if (!user) {
    ctx.showView("oportunidadMenu");
    return;
  }

  ctx.showView("oportunidadGestor");

  resetGestorFilters();
  document.getElementById("op-gestor-sistema").textContent = sistemaLabel();
  const fechaInput = document.getElementById("op-gestor-fecha");
  if (fechaInput) fechaInput.valueAsDate = new Date();
  setLinkPlaceholder();
  updateLinkStatusUi();

  try {
    await cargarGestor(user);
  } catch (err) {
    console.error(err);
    const status = document.getElementById("op-gestor-status");
    if (status) {
      status.textContent = "No se pudo cargar el listado. Recargá con Ctrl+F5.";
      status.classList.remove("hidden");
    }
  }
}

function buildCargarPayload() {
  return {
    sistema: ctx.getSistema(),
    metodoContacto: metodoContacto || "NINGUNO",
    numeroCliente: document.getElementById("op-numero")?.value.trim() || "",
    razonSocial: document.getElementById("op-razon")?.value.trim() || "",
    nombreContacto: document.getElementById("op-contacto")?.value.trim() || "",
    telefono: document.getElementById("op-telefono")?.value.trim() || "",
    correo: document.getElementById("op-correo")?.value.trim() || "",
    horarios: document.getElementById("op-horarios")?.value.trim() || "",
    descripcion: document.getElementById("op-descripcion")?.value.trim() || "",
  };
}

async function generarPdf() {
  const status = document.getElementById("op-cargar-status");
  status.textContent = "Generando PDF…";
  const response = await fetch("/api/planillas/oportunidad/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildCargarPayload()),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const msg = data.errors?.join("\n") || data.detail || "Error al generar PDF";
    status.textContent = msg;
    alert(msg);
    return;
  }

  const blob = await response.blob();
  const disp = response.headers.get("Content-Disposition") || "";
  const match = disp.match(/filename="?([^";]+)"?/i);
  const fileName = match ? match[1] : "oportunidad.pdf";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  status.textContent = "PDF descargado.";
}

async function mejorarOportunidadIa() {
  const status = document.getElementById("op-cargar-status");
  const btn = document.getElementById("op-btn-ia");
  oportunidadIaUndo?.saveSnapshot();
  if (btn) btn.disabled = true;
  status.textContent = "Mejorando con IA…";

  try {
    const response = await fetch("/api/planillas/oportunidad/mejorar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildCargarPayload()),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      oportunidadIaUndo?.clearSnapshot();
      status.textContent = data.detail || "Error IA";
      return;
    }
    applyCargarPayload(data);
    status.textContent = "Formulario actualizado con IA. Usá ↩ al lado si no te convence.";
  } finally {
    if (btn) btn.disabled = false;
  }
}

function setMetodoContacto(value) {
  metodoContacto = value || null;
  document.querySelectorAll('#op-metodo-radios input[name="op-metodo"]').forEach((input) => {
    input.checked = input.value === metodoContacto;
  });
}

function applyCargarPayload(data) {
  if (data.metodoContacto) setMetodoContacto(data.metodoContacto);
  if (data.numeroCliente) document.getElementById("op-numero").value = data.numeroCliente;
  if (data.razonSocial) document.getElementById("op-razon").value = data.razonSocial;
  if (data.nombreContacto) document.getElementById("op-contacto").value = data.nombreContacto;
  if (data.telefono) document.getElementById("op-telefono").value = data.telefono;
  if (data.correo) document.getElementById("op-correo").value = data.correo;
  if (data.horarios) document.getElementById("op-horarios").value = data.horarios;
  if (data.descripcion) document.getElementById("op-descripcion").value = data.descripcion;
}

function limpiarCargar() {
  oportunidadIaUndo?.clearSnapshot();
  setMetodoContacto(null);
  ["op-numero", "op-razon", "op-contacto", "op-telefono", "op-correo", "op-horarios", "op-descripcion"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("op-cargar-status").textContent = "";
}

function initGestorUi() {
  const combo = document.getElementById("op-filter-month-combo");
  if (combo && combo.options.length === 0) {
    const mesActual = currentGestorMonthLabel();
    gestorUpdatingMonthCombo = true;
    combo.innerHTML =
      `<option value="Todas">Todas</option><option value="${escapeHtml(mesActual)}">${escapeHtml(mesActual)}</option>`;
    combo.value = mesActual;
    gestorUpdatingMonthCombo = false;
  }
  updateLinkStatusUi();
  setLinkPlaceholder();
}

function bindGestorEvents() {
  document.getElementById("op-filter-month-combo")?.addEventListener("change", () => {
    if (gestorUpdatingMonthCombo) return;
    gestorPagina = 1;
    safeApplyGestorFilterAndPage();
  });
  document.getElementById("op-gestor-prev")?.addEventListener("click", () => {
    if (gestorPagina > 1) {
      gestorPagina--;
      renderGestorPage();
    }
  });
  document.getElementById("op-gestor-next")?.addEventListener("click", () => {
    const total = Math.max(1, Math.ceil(gestorFiltered.length / GESTOR_POR_PAGINA));
    if (gestorPagina < total) {
      gestorPagina++;
      renderGestorPage();
    }
  });
  document.getElementById("op-gestor-editar")?.addEventListener("click", () => editarGestorSeleccionado());
  document.getElementById("op-gestor-eliminar")?.addEventListener("click", () => eliminarGestorSeleccionado());
  document.getElementById("op-gestor-confirmar")?.addEventListener("click", () => confirmarGestorSeleccionado());

  const linkInput = document.getElementById("op-gestor-link");
  linkInput?.addEventListener("focus", onGestorLinkFocus);
  linkInput?.addEventListener("blur", onGestorLinkBlur);
  linkInput?.addEventListener("input", () => {
    if (!linkPlaceholderActive) updateLinkStatusUi();
  });

  bindGestorDatePicker();
  bindEditModal();
  bindDeleteModal();

  const ctxMenu = document.getElementById("op-gestor-ctx");
  ctxMenu?.querySelectorAll("[data-ctx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.ctx;
      hideGestorContextMenu();
      if (action === "confirmar") confirmarGestorSeleccionado(gestorSelectedId);
      else if (action === "abrir") abrirLinkGestor(gestorSelectedId);
      else if (action === "editar") editarGestorSeleccionado(gestorSelectedId);
      else if (action === "eliminar") eliminarGestorSeleccionado(gestorSelectedId);
    });
  });
  document.addEventListener("click", hideGestorContextMenu);
  document.addEventListener("scroll", hideGestorContextMenu, true);
}

function getGestorLinkValue() {
  const input = document.getElementById("op-gestor-link");
  if (!input || linkPlaceholderActive) return "";
  return input.value.trim();
}

function setLinkPlaceholder() {
  const input = document.getElementById("op-gestor-link");
  if (!input) return;
  input.value = LINK_PLACEHOLDER;
  input.classList.add("placeholder");
  linkPlaceholderActive = true;
  updateLinkStatusUi();
}

function clearLinkPlaceholder() {
  const input = document.getElementById("op-gestor-link");
  if (!input || !linkPlaceholderActive) return;
  input.value = "";
  input.classList.remove("placeholder");
  linkPlaceholderActive = false;
}

function restoreLinkPlaceholder() {
  const input = document.getElementById("op-gestor-link");
  if (!input || input.value.trim()) return;
  setLinkPlaceholder();
}

async function onGestorLinkFocus() {
  clearLinkPlaceholder();
  const input = document.getElementById("op-gestor-link");
  if (!input || input.value.trim()) return;
  try {
    const text = await navigator.clipboard.readText();
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!/https?|www\./i.test(trimmed)) return;
    input.value = trimmed;
    input.classList.remove("placeholder");
    linkPlaceholderActive = false;
    updateLinkStatusUi();
  } catch {
    // Portapapeles no disponible
  }
}

function onGestorLinkBlur() {
  restoreLinkPlaceholder();
}

function updateLinkStatusUi() {
  const icon = document.getElementById("op-gestor-link-status");
  if (!icon) return;
  const hasLink = !!getGestorLinkValue();
  icon.classList.toggle("ok", hasLink);
  icon.innerHTML = hasLink
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M8.5 12 11 14.5 15.5 9.5"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5h10v2l-5 5 5 5v2H7v-2l5-5-5-5V5z"/></svg>`;
  icon.title = hasLink ? "Link cargado correctamente" : "Pegá el link del correo o mensaje de la oportunidad";
}

function currentGestorMonthLabel(date = new Date()) {
  return `${GESTOR_MESES[date.getMonth()]} ${date.getFullYear()}`;
}

function resetGestorFilters() {
  const combo = document.getElementById("op-filter-month-combo");
  if (combo) combo.value = currentGestorMonthLabel();
}

function parseGestorItems(data) {
  const raw = data?.items ?? data?.Items ?? [];
  if (!Array.isArray(raw)) return { items: [], dropped: 0, rawCount: 0 };

  const items = [];
  let dropped = 0;
  for (const row of raw) {
    const norm = normalizeGestorItem(row);
    if (norm) items.push(norm);
    else dropped += 1;
  }
  return { items, dropped, rawCount: raw.length };
}

function parseGestorId(item) {
  const raw = item.id ?? item.Id;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseGestorConfirmada(item) {
  const raw = item.confirmada ?? item.Confirmada;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const t = raw.trim().toLowerCase();
    if (t === "sí" || t === "si" || t === "s" || t === "true" || t === "1") return true;
    if (t === "no" || t === "false" || t === "0" || t === "") return false;
  }
  return !!raw;
}

function normalizeGestorItem(item) {
  if (!item) return null;
  const id = parseGestorId(item);
  if (id == null) {
    console.warn("[Gestor] fila sin id válido:", item);
    return null;
  }
  return {
    id,
    fecha: item.fecha ?? item.Fecha ?? "",
    descripcion: item.descripcion ?? item.Descripcion ?? "",
    link: item.link ?? item.Link ?? "",
    confirmada: parseGestorConfirmada(item),
    porcentaje: item.porcentaje ?? item.Porcentaje ?? "N/D",
  };
}

async function gestorApiFetch(url, options = {}) {
  await syncPlanUserSession();
  let response = await planUserFetch(url, options);
  if (response.status !== 401) return response;

  await syncPlanUserSession();
  return planUserFetch(url, options);
}

async function cargarGestor(knownUser = null) {
  await syncPlanUserSession();
  const user = knownUser || getPlanUserEmail() || (await ensurePlanUser({ forcePrompt: !knownUser }));
  const status = document.getElementById("op-gestor-status");
  if (!user) {
    if (status) {
      status.textContent = "Ingresá tu correo corporativo para ver tus oportunidades.";
      status.classList.remove("hidden");
    }
    gestorAllItems = [];
    safeApplyGestorFilterAndPage();
    return;
  }

  resetGestorFilters();
  let data = { items: [], total: 0, usuario: user };

  try {
    const response = await gestorApiFetch("/api/planillas/oportunidad/gestor");

    if (response.status === 401) {
      if (status) {
        status.textContent = `Sesión no válida para ${user}. Volvé a ingresar tu correo (arriba a la derecha).`;
        status.classList.remove("hidden");
      }
      gestorAllItems = [];
      safeApplyGestorFilterAndPage();
      return;
    }

    if (!response.ok) {
      if (status) {
        status.textContent = "No se pudo cargar el listado. Recargá con Ctrl+F5.";
        status.classList.remove("hidden");
      }
      gestorAllItems = [];
      safeApplyGestorFilterAndPage();
      return;
    }

    data = await response.json().catch(() => ({ items: [], total: 0, usuario: user }));
    const { items: fetched, dropped, rawCount } = parseGestorItems(data);
    gestorAllItems = fetched;

    console.info("[Gestor] API", {
      usuario: data.usuario || user,
      total: data.total ?? rawCount,
      parsed: fetched.length,
      dropped,
      db: data.storage?.path,
    });

    if (dropped > 0) {
      console.warn(`[Gestor] ${dropped} de ${rawCount} fila(s) descartadas por formato inválido`);
    }
  } catch {
    if (status) {
      status.textContent = "Error de red al cargar oportunidades.";
      status.classList.remove("hidden");
    }
    gestorAllItems = [];
  }

  gestorPagina = 1;
  safeApplyGestorFilterAndPage();
  requestAnimationFrame(() => renderGestorPage());

  const label = document.getElementById("op-gestor-pagina-label");
  const serverTotal = typeof data.total === "number" ? data.total : gestorAllItems.length;
  const sessionUser = data.usuario || user;

  if (status) {
    if (data.storage && data.storage.ready === false) {
      status.textContent = "Sin permiso de escritura en la base. En Railway: Volume en /data/st2 y variable RAILWAY_RUN_UID=0.";
      status.classList.remove("hidden");
    } else if (serverTotal > 0 && gestorAllItems.length === 0) {
      status.textContent = `El servidor devolvió ${serverTotal} registro(s) para ${sessionUser}, pero no se pudieron mostrar. Recargá con Ctrl+F5.`;
      status.classList.remove("hidden");
    } else if (gestorFiltered.length === 0 && gestorAllItems.length > 0) {
      status.textContent = "Hay oportunidades guardadas pero el filtro de mes las oculta. Elegí «Todas».";
      status.classList.remove("hidden");
    } else if (gestorAllItems.length === 0) {
      const dbHint = data.storage?.path ? ` Base del servidor: ${data.storage.path}.` : "";
      status.textContent = `Sin oportunidades para ${sessionUser}.${dbHint} Agregá una arriba o verificá el correo (clic en el badge arriba).`;
      status.classList.remove("hidden");
    } else {
      status.textContent = `${gestorAllItems.length} oportunidad(es) para ${sessionUser}.`;
      status.classList.remove("hidden");
      setTimeout(() => status.classList.add("hidden"), 4000);
    }
  }
  if (label && gestorAllItems.length > 0 && gestorFiltered.length === 0) {
    label.textContent = `Filtro activo: 0 de ${gestorAllItems.length} visibles — elegí «Todas»`;
  }
}

function safeApplyGestorFilterAndPage() {
  try {
    applyGestorFilterAndPage();
    return true;
  } catch (err) {
    console.error("Gestor UI error:", err);
    const status = document.getElementById("op-gestor-status");
    if (status) {
      status.textContent = "Error al mostrar el listado. Recargá con Ctrl+F5.";
      status.classList.remove("hidden");
    }
    return false;
  }
}

function applyGestorFilterAndPage() {
  const combo = document.getElementById("op-filter-month-combo");
  const keep = combo?.value || currentGestorMonthLabel();
  rebuildGestorMonthOptions(gestorAllItems, keep);

  const filtro = combo?.value || currentGestorMonthLabel();

  let query = [...gestorAllItems];
  if (filtro !== "Todas") {
    const parsed = parseGestorFiltro(filtro);
    if (parsed) {
      query = query.filter((o) => matchGestorMonth(o.fecha, parsed.year, parsed.month));
    }
  }

  gestorFiltered = query;

  const totalPaginas = Math.max(1, Math.ceil(gestorFiltered.length / GESTOR_POR_PAGINA));
  if (gestorPagina > totalPaginas) gestorPagina = totalPaginas;
  if (gestorPagina < 1) gestorPagina = 1;

  if (gestorSelectedId && !gestorFiltered.some((o) => o.id === gestorSelectedId)) {
    gestorSelectedId = null;
  }

  renderGestorPage();
  console.info("[Gestor] filter", {
    all: gestorAllItems.length,
    filtered: gestorFiltered.length,
    filtro: combo?.value || "Todas",
  });
}

function rebuildGestorMonthOptions(all, keep) {
  const combo = document.getElementById("op-filter-month-combo");
  if (!combo) return;

  const mesActual = currentGestorMonthLabel();
  const opciones = ["Todas"];
  const anios = [...new Set(all.map((o) => parseGestorYear(o.fecha)).filter((y) => y > 0))].sort((a, b) => b - a);
  const currentYear = new Date().getFullYear();
  if (!anios.includes(currentYear)) anios.unshift(currentYear);

  for (const anio of anios) {
    for (let m = 0; m < 12; m++) {
      const label = `${GESTOR_MESES[m]} ${anio}`;
      if (label === mesActual || all.some((o) => matchGestorMonth(o.fecha, anio, m + 1))) {
        opciones.push(label);
      }
    }
  }

  if (!opciones.includes(mesActual)) {
    opciones.splice(1, 0, mesActual);
  }

  gestorUpdatingMonthCombo = true;
  combo.innerHTML = opciones.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
  combo.value = opciones.includes(keep) ? keep : mesActual;
  gestorUpdatingMonthCombo = false;
}

function parseGestorFiltro(filtro) {
  const parts = filtro.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const mesIdx = GESTOR_MESES.findIndex((m) => m.toLowerCase() === parts[0].toLowerCase());
  const year = parseInt(parts[parts.length - 1], 10);
  if (mesIdx < 0 || Number.isNaN(year)) return null;
  return { year, month: mesIdx + 1 };
}

function parseGestorFechaParts(fecha) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha || "");
  if (iso) return { year: parseInt(iso[1], 10), month: parseInt(iso[2], 10), day: parseInt(iso[3], 10) };
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(fecha || "");
  if (dmy) return { year: parseInt(dmy[3], 10), month: parseInt(dmy[2], 10), day: parseInt(dmy[1], 10) };
  return null;
}

function parseGestorYear(fecha) {
  return parseGestorFechaParts(fecha)?.year ?? 0;
}

function matchGestorMonth(fecha, anio, mesNum) {
  const parts = parseGestorFechaParts(fecha);
  if (!parts) return false;
  return parts.year === anio && parts.month === mesNum;
}

function formatGestorFecha(fechaIso) {
  const parts = parseGestorFechaParts(fechaIso);
  if (!parts) return fechaIso || "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaIso || "");
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(fechaIso || "");
  if (dmy) return `${dmy[1].padStart(2, "0")}/${dmy[2].padStart(2, "0")}/${dmy[3]}`;
  return fechaIso || "";
}

function isConfirmada(item) {
  return parseGestorConfirmada(item);
}

function formatGestorDescripcion(item) {
  let desc = item.descripcion || item.Descripcion || "";
  if (isConfirmada(item) && !desc.startsWith("✔️")) desc = `✔️ ${desc}`;
  return desc.length > 80 ? `${desc.slice(0, 77)}...` : desc;
}

function renderGestorPage() {
  const tbody = document.getElementById("op-gestor-table-body");
  const label = document.getElementById("op-gestor-pagina-label");
  if (!tbody) {
    console.warn("[Gestor] tbody #op-gestor-table-body no encontrado");
    return;
  }

  const totalPaginas = Math.max(1, Math.ceil(gestorFiltered.length / GESTOR_POR_PAGINA));
  const pageItems = gestorFiltered.slice((gestorPagina - 1) * GESTOR_POR_PAGINA, gestorPagina * GESTOR_POR_PAGINA);

  tbody.replaceChildren();

  if (pageItems.length === 0) {
    const row = document.createElement("tr");
    row.className = "plan-gestor-empty-row";
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = "No hay oportunidades cargadas.";
    row.appendChild(cell);
    tbody.appendChild(row);
  } else {
    for (const r of pageItems) {
      tbody.appendChild(buildGestorRow(r, tbody));
    }
  }

  console.info("[Gestor] render", {
    filtered: gestorFiltered.length,
    page: gestorPagina,
    rows: tbody.querySelectorAll("tr[data-id]").length,
  });

  if (label) {
    label.textContent = `Página ${gestorPagina} de ${totalPaginas} (${gestorFiltered.length} registros)`;
  }

  const countEl = document.getElementById("op-gestor-count");
  if (countEl) {
    countEl.textContent = gestorFiltered.length > 0 ? `(${gestorFiltered.length})` : "";
  }

  const prevBtn = document.getElementById("op-gestor-prev");
  const nextBtn = document.getElementById("op-gestor-next");
  if (prevBtn) prevBtn.disabled = gestorPagina <= 1;
  if (nextBtn) nextBtn.disabled = gestorPagina >= totalPaginas;

  updateConfirmActionLabels();
}

function buildGestorRow(r, tbody) {
  const hasLink = !!(r.link && r.link.trim());
  const confirmada = isConfirmada(r);
  const icon = confirmada ? "✅" : "⏳";
  const tip = confirmada ? "Confirmada" : "Pendiente de confirmación";

  const row = document.createElement("tr");
  row.dataset.id = String(r.id);
  if (gestorSelectedId === r.id) row.classList.add("selected");

  const tdFecha = document.createElement("td");
  tdFecha.className = "col-fecha";
  tdFecha.textContent = formatGestorFecha(r.fecha);

  const tdDesc = document.createElement("td");
  tdDesc.textContent = formatGestorDescripcion(r);

  const tdLink = document.createElement("td");
  tdLink.className = "col-link";
  const linkBtn = document.createElement("button");
  linkBtn.type = "button";
  linkBtn.className = "plan-gestor-link-open";
  linkBtn.dataset.openLink = String(r.id);
  linkBtn.textContent = "↗ Abrir";
  linkBtn.disabled = !hasLink;
  linkBtn.title = hasLink ? "Abrir oportunidad en el navegador" : "Sin link cargado";
  linkBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    abrirLinkGestor(r.id);
  });
  tdLink.appendChild(linkBtn);

  const tdConfirm = document.createElement("td");
  tdConfirm.className = "col-confirm";
  tdConfirm.title = tip;
  tdConfirm.textContent = icon;

  row.append(tdFecha, tdDesc, tdLink, tdConfirm);

  row.addEventListener("click", (e) => {
    if (e.target.closest(".plan-gestor-link-open")) return;
    gestorSelectedId = r.id;
    tbody.querySelectorAll("tr.selected").forEach((tr) => tr.classList.remove("selected"));
    row.classList.add("selected");
    updateConfirmActionLabels();
  });
  row.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    gestorSelectedId = r.id;
    tbody.querySelectorAll("tr.selected").forEach((tr) => tr.classList.remove("selected"));
    row.classList.add("selected");
    updateConfirmActionLabels();
    showGestorContextMenu(e.clientX, e.clientY);
  });

  return row;
}

function getGestorItem(id = gestorSelectedId) {
  if (!id) return null;
  return gestorAllItems.find((x) => x.id === id) || gestorFiltered.find((x) => x.id === id) || null;
}

function showGestorContextMenu(x, y) {
  const menu = document.getElementById("op-gestor-ctx");
  if (!menu) return;
  menu.classList.remove("hidden");
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
}

function bindGestorDatePicker() {
  const wrap = document.querySelector(".plan-gestor-date-wrap");
  const input = document.getElementById("op-gestor-fecha");
  if (!wrap || !input) return;

  const open = () => {
    try {
      if (typeof input.showPicker === "function") input.showPicker();
      else input.focus();
    } catch {
      input.focus();
    }
  };

  wrap.addEventListener("click", open);
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  });
}

function setGestorAddLoading(active) {
  const overlay = document.getElementById("op-gestor-add-loading");
  const btn = document.getElementById("op-gestor-agregar");
  if (overlay) {
    overlay.classList.toggle("hidden", !active);
    overlay.setAttribute("aria-busy", active ? "true" : "false");
  }
  if (btn) btn.disabled = active;
}

function hideGestorContextMenu() {
  document.getElementById("op-gestor-ctx")?.classList.add("hidden");
}

function abrirLinkGestor(id = gestorSelectedId) {
  const item = getGestorItem(id);
  if (!item?.link) {
    alert("Seleccioná una oportunidad con link.");
    return;
  }
  window.open(item.link, "_blank", "noopener,noreferrer");
}

async function agregarGestor() {
  await syncPlanUserSession();
  if (!getPlanUserEmail()) {
    const user = await ensurePlanUser({ forcePrompt: true });
    if (!user) return;
  }

  const desc = document.getElementById("op-gestor-desc")?.value.trim() || "";
  const link = getGestorLinkValue();
  if (!desc || !link) {
    alert("Completá la descripción y el link para continuar.");
    return;
  }

  const body = {
    fecha: document.getElementById("op-gestor-fecha")?.value || "",
    descripcion: desc,
    link,
    confirmada: false,
  };

  const status = document.getElementById("op-gestor-status");
  setGestorAddLoading(true);
  if (status) status.classList.add("hidden");

  try {
    const response = await gestorApiFetch("/api/planillas/oportunidad/gestor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg = data.detail || data.error || data.title || "No se pudo agregar la oportunidad.";
      alert(msg);
      if (status) {
        status.textContent = msg;
        status.classList.remove("hidden");
      }
      return;
    }

    const created = normalizeGestorItem(data);

    document.getElementById("op-gestor-desc").value = "";
    setLinkPlaceholder();
    document.getElementById("op-gestor-fecha").valueAsDate = new Date();
    resetGestorFilters();
    gestorPagina = 1;

    if (!created?.id) {
      if (status) {
        status.textContent = "El servidor guardó la oportunidad pero no devolvió el ID. Recargá el gestor.";
        status.classList.remove("hidden");
      }
      await cargarGestor();
      return;
    }

    gestorAllItems = [created, ...gestorAllItems.filter((x) => x.id !== created.id)];
    resetGestorFilters();
    gestorPagina = 1;
    safeApplyGestorFilterAndPage();
    if (status) {
      status.textContent = `Oportunidad agregada (${getPlanUserEmail() || "tu usuario"}).`;
      status.classList.remove("hidden");
    }

    await cargarGestor(getPlanUserEmail());

    if (status && created?.id) {
      setTimeout(() => status.classList.add("hidden"), 3500);
    }

    document.getElementById("op-gestor-desc")?.focus();
  } finally {
    setGestorAddLoading(false);
  }
}

async function confirmarGestorSeleccionado(id = gestorSelectedId) {
  const item = getGestorItem(id);
  if (!item) {
    alert("Seleccioná una oportunidad para confirmar.");
    return;
  }

  const nuevoEstado = !isConfirmada(item);
  await gestorApiFetch(`/api/planillas/oportunidad/gestor/${item.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fecha: item.fecha,
      descripcion: item.descripcion,
      link: item.link,
      confirmada: nuevoEstado,
      porcentaje: item.porcentaje,
    }),
  });
  await cargarGestor();
}

function updateConfirmActionLabels() {
  const item = getGestorItem();
  const confirmada = item ? isConfirmada(item) : false;
  const btn = document.getElementById("op-gestor-confirmar");
  const ctx = document.getElementById("op-ctx-confirmar");
  if (btn) btn.textContent = confirmada ? "Desconfirmar" : "Confirmar";
  if (ctx) ctx.textContent = confirmada ? "↩️ Marcar como no confirmada" : "✅ Confirmar oportunidad";
}

let editGestorId = null;

function gestorFechaToIso(fecha) {
  const parts = parseGestorFechaParts(fecha);
  if (!parts) return "";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day ?? 1).padStart(2, "0")}`;
}

function openEditModal(item) {
  editGestorId = item.id;
  const overlay = document.getElementById("op-edit-overlay");
  const fecha = document.getElementById("op-edit-fecha");
  const desc = document.getElementById("op-edit-desc");
  const link = document.getElementById("op-edit-link");
  const conf = document.getElementById("op-edit-confirmada");
  if (fecha) fecha.value = gestorFechaToIso(item.fecha) || "";
  if (desc) desc.value = item.descripcion || "";
  if (link) link.value = item.link || "";
  if (conf) conf.checked = isConfirmada(item);
  overlay?.classList.remove("hidden");
  desc?.focus();
}

function closeEditModal() {
  editGestorId = null;
  document.getElementById("op-edit-overlay")?.classList.add("hidden");
}

async function saveEditModal() {
  if (editGestorId == null) return;
  const fecha = document.getElementById("op-edit-fecha")?.value || "";
  const descripcion = document.getElementById("op-edit-desc")?.value ?? "";
  const link = document.getElementById("op-edit-link")?.value?.trim() ?? "";
  const confirmada = !!document.getElementById("op-edit-confirmada")?.checked;
  const saveBtn = document.getElementById("op-edit-save");
  if (saveBtn) saveBtn.disabled = true;
  try {
    await gestorApiFetch(`/api/planillas/oportunidad/gestor/${editGestorId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha, descripcion, link, confirmada }),
    });
    closeEditModal();
    await cargarGestor();
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

function bindEditModal() {
  const overlay = document.getElementById("op-edit-overlay");
  if (!overlay || overlay.dataset.bound) return;
  overlay.dataset.bound = "1";
  document.getElementById("op-edit-cancel")?.addEventListener("click", closeEditModal);
  document.getElementById("op-edit-save")?.addEventListener("click", () => void saveEditModal());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeEditModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) closeEditModal();
  });

  const wrap = overlay.querySelector(".op-edit-date");
  const input = document.getElementById("op-edit-fecha");
  if (wrap && input) {
    const open = () => {
      try {
        if (typeof input.showPicker === "function") input.showPicker();
        else input.focus();
      } catch {
        input.focus();
      }
    };
    wrap.addEventListener("click", open);
    wrap.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  }
}

async function editarGestorSeleccionado(id = gestorSelectedId) {
  const item = getGestorItem(id);
  if (!item) {
    alert("Seleccioná una oportunidad para editar.");
    return;
  }
  openEditModal(item);
}

let deleteGestorId = null;

function openDeleteModal(item) {
  deleteGestorId = item.id;
  const overlay = document.getElementById("op-delete-overlay");
  const desc = document.getElementById("op-delete-desc");
  if (desc) {
    const texto = (item.descripcion || "").trim();
    const fecha = formatGestorFecha(item.fecha);
    desc.textContent = texto ? `${fecha ? fecha + " · " : ""}${texto}` : (fecha || "");
  }
  overlay?.classList.remove("hidden");
  document.getElementById("op-delete-cancel")?.focus();
}

function closeDeleteModal() {
  deleteGestorId = null;
  document.getElementById("op-delete-overlay")?.classList.add("hidden");
}

async function confirmDeleteModal() {
  if (deleteGestorId == null) return;
  const id = deleteGestorId;
  const btn = document.getElementById("op-delete-confirm");
  if (btn) btn.disabled = true;
  try {
    await gestorApiFetch(`/api/planillas/oportunidad/gestor/${id}`, { method: "DELETE" });
    if (gestorSelectedId === id) gestorSelectedId = null;
    closeDeleteModal();
    await cargarGestor();
  } finally {
    if (btn) btn.disabled = false;
  }
}

function bindDeleteModal() {
  const overlay = document.getElementById("op-delete-overlay");
  if (!overlay || overlay.dataset.bound) return;
  overlay.dataset.bound = "1";
  document.getElementById("op-delete-cancel")?.addEventListener("click", closeDeleteModal);
  document.getElementById("op-delete-confirm")?.addEventListener("click", () => void confirmDeleteModal());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeDeleteModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) closeDeleteModal();
  });
}

async function eliminarGestorSeleccionado(id = gestorSelectedId) {
  const item = getGestorItem(id);
  if (!item) {
    alert("Seleccioná una oportunidad para eliminar.");
    return;
  }
  openDeleteModal(item);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
