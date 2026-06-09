import {
  ensurePlanUser,
  planUserFetch,
  refreshPlanUserSession,
} from "./plan-user.js";

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
let linkPlaceholderActive = true;

export function initOportunidadModule(context) {
  ctx = context;
  bindOportunidadEvents();
  initGestorUi();
  refreshPlanUserSession();
}

export function openOportunidadMenu() {
  if (!ctx) return;
  const label = ctx.getSistema() === "OnvioWeb" ? "ONVIO/Bejerman WEB" : "Bejerman SQL";
  document.getElementById("op-menu-sistema").textContent = label;
  ctx.showView("oportunidadMenu");
}

function sistemaLabel() {
  return ctx.getSistema() === "OnvioWeb" ? "ONVIO/Bejerman WEB" : "Bejerman SQL";
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
  document.getElementById("op-gestor-agregar")?.addEventListener("click", agregarGestor);
  bindGestorEvents();
}

function openCargar() {
  document.getElementById("op-cargar-sistema").textContent = sistemaLabel();
  document.getElementById("op-btn-ia")?.classList.toggle("hidden", !ctx.getConfig()?.oportunidad?.iaConfigured);
  ctx.showView("oportunidadCargar");
}

async function openGestor() {
  const user = await ensurePlanUser();
  if (!user) {
    ctx.showView("oportunidadMenu");
    return;
  }

  ctx.showView("oportunidadGestor");

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
  status.textContent = "Mejorando con IA…";
  const response = await fetch("/api/planillas/oportunidad/mejorar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildCargarPayload()),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    status.textContent = data.detail || "Error IA";
    return;
  }
  applyCargarPayload(data);
  status.textContent = "Formulario actualizado con IA.";
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
  setMetodoContacto(null);
  ["op-numero", "op-razon", "op-contacto", "op-telefono", "op-correo", "op-horarios", "op-descripcion"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("op-cargar-status").textContent = "";
}

function initGestorUi() {
  updateLinkStatusUi();
  setLinkPlaceholder();
}

function bindGestorEvents() {
  document.getElementById("op-filter-solo-pend")?.addEventListener("change", () => {
    gestorPagina = 1;
    applyGestorFilterAndPage();
  });
  document.getElementById("op-filter-month-combo")?.addEventListener("change", () => {
    gestorPagina = 1;
    applyGestorFilterAndPage();
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

function resetGestorFilters() {
  const solo = document.getElementById("op-filter-solo-pend");
  const combo = document.getElementById("op-filter-month-combo");
  if (solo) solo.checked = false;
  if (combo) combo.value = "Todas";
}

function normalizeGestorItem(item) {
  if (!item) return null;
  return {
    id: item.id ?? item.Id,
    fecha: item.fecha ?? item.Fecha ?? "",
    descripcion: item.descripcion ?? item.Descripcion ?? "",
    link: item.link ?? item.Link ?? "",
    confirmada: !!(item.confirmada ?? item.Confirmada),
    porcentaje: item.porcentaje ?? item.Porcentaje ?? "N/D",
  };
}

async function gestorApiFetch(url, options = {}) {
  let response = await planUserFetch(url, options);
  if (response.status !== 401) return response;

  const user = await ensurePlanUser();
  if (!user) return response;

  await fetch("/api/planillas/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user }),
    credentials: "include",
  });
  return planUserFetch(url, options);
}

async function cargarGestor(knownUser = null) {
  const user = knownUser || (await ensurePlanUser());
  if (!user) return;

  const response = await gestorApiFetch("/api/planillas/oportunidad/gestor");

  if (response.status === 401) {
    const status = document.getElementById("op-gestor-status");
    if (status) {
      status.textContent = "No se pudo validar tu sesión. Recargá la página e ingresá tu correo de nuevo.";
      status.classList.remove("hidden");
    }
    return;
  }

  const data = await response.json().catch(() => ({ items: [] }));
  gestorAllItems = (data.items || []).map(normalizeGestorItem).filter((x) => x?.id);
  gestorPagina = 1;
  applyGestorFilterAndPage();
  const status = document.getElementById("op-gestor-status");
  if (status) status.classList.add("hidden");
}

function applyGestorFilterAndPage() {
  const combo = document.getElementById("op-filter-month-combo");
  const keep = combo?.value || "Todas";
  rebuildGestorMonthOptions(gestorAllItems, keep);

  const solo = document.getElementById("op-filter-solo-pend")?.checked;
  const filtro = combo?.value || "Todas";

  let query = [...gestorAllItems];
  if (solo) query = query.filter((o) => !isConfirmada(o));
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
}

function rebuildGestorMonthOptions(all, keep) {
  const combo = document.getElementById("op-filter-month-combo");
  if (!combo) return;

  const opciones = ["Todas"];
  const anios = [...new Set(all.map((o) => parseGestorYear(o.fecha)).filter((y) => y > 0))].sort((a, b) => b - a);
  const currentYear = new Date().getFullYear();
  if (!anios.includes(currentYear)) anios.unshift(currentYear);

  for (const anio of anios) {
    for (let m = 0; m < 12; m++) {
      if (all.some((o) => matchGestorMonth(o.fecha, anio, m + 1))) {
        opciones.push(`${GESTOR_MESES[m]} ${anio}`);
      }
    }
  }

  combo.innerHTML = opciones.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
  combo.value = opciones.includes(keep) ? keep : "Todas";
}

function parseGestorFiltro(filtro) {
  const parts = filtro.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const mesIdx = GESTOR_MESES.findIndex((m) => m.toLowerCase() === parts[0].toLowerCase());
  const year = parseInt(parts[parts.length - 1], 10);
  if (mesIdx < 0 || Number.isNaN(year)) return null;
  return { year, month: mesIdx + 1 };
}

function parseGestorYear(fecha) {
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(fecha || "");
  return m ? parseInt(m[1], 10) : 0;
}

function matchGestorMonth(fecha, anio, mesNum) {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(fecha || "");
  if (!m) return false;
  return parseInt(m[1], 10) === anio && parseInt(m[2], 10) === mesNum;
}

function formatGestorFecha(fechaIso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaIso || "");
  if (!m) return fechaIso || "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function isConfirmada(item) {
  return !!(item.confirmada ?? item.Confirmada);
}

function formatGestorDescripcion(item) {
  let desc = item.descripcion || item.Descripcion || "";
  if (isConfirmada(item) && !desc.startsWith("✔️")) desc = `✔️ ${desc}`;
  return desc.length > 80 ? `${desc.slice(0, 77)}...` : desc;
}

function renderGestorPage() {
  const tbody = document.getElementById("op-gestor-table-body");
  const label = document.getElementById("op-gestor-pagina-label");
  if (!tbody) return;

  const totalPaginas = Math.max(1, Math.ceil(gestorFiltered.length / GESTOR_POR_PAGINA));
  const pageItems = gestorFiltered.slice((gestorPagina - 1) * GESTOR_PAGINA, gestorPagina * GESTOR_POR_PAGINA);

  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr class="plan-gestor-empty-row"><td colspan="4">No hay oportunidades con ese filtro.</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map((r) => {
      const hasLink = !!(r.link && r.link.trim());
      const confirmada = isConfirmada(r);
      const icon = confirmada ? "✅" : "⏳";
      const tip = confirmada ? "Confirmada" : "Pendiente de confirmación";
      return `
        <tr data-id="${r.id}" class="${gestorSelectedId === r.id ? "selected" : ""}">
          <td class="col-fecha">${escapeHtml(formatGestorFecha(r.fecha))}</td>
          <td>${escapeHtml(formatGestorDescripcion(r))}</td>
          <td class="col-link">
            <button type="button" class="plan-gestor-link-open" data-open-link="${r.id}" ${hasLink ? "" : "disabled"} title="${hasLink ? "Abrir oportunidad en el navegador" : "Sin link cargado"}">↗ Abrir</button>
          </td>
          <td class="col-confirm" title="${escapeHtml(tip)}">${icon}</td>
        </tr>`;
    }).join("");

    tbody.querySelectorAll("tr[data-id]").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest("[data-open-link]")) return;
        gestorSelectedId = +row.dataset.id;
        tbody.querySelectorAll("tr.selected").forEach((tr) => tr.classList.remove("selected"));
        row.classList.add("selected");
      });
      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        gestorSelectedId = +row.dataset.id;
        tbody.querySelectorAll("tr.selected").forEach((tr) => tr.classList.remove("selected"));
        row.classList.add("selected");
        showGestorContextMenu(e.clientX, e.clientY);
      });
    });

    tbody.querySelectorAll("[data-open-link]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        abrirLinkGestor(+btn.dataset.openLink);
      });
    });
  }

  if (label) {
    label.textContent = `Página ${gestorPagina} de ${totalPaginas} (${gestorFiltered.length} registros)`;
  }

  const prevBtn = document.getElementById("op-gestor-prev");
  const nextBtn = document.getElementById("op-gestor-next");
  if (prevBtn) prevBtn.disabled = gestorPagina <= 1;
  if (nextBtn) nextBtn.disabled = gestorPagina >= totalPaginas;
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
  const response = await gestorApiFetch("/api/planillas/oportunidad/gestor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    alert(data.error || "No se pudo agregar la oportunidad.");
    return;
  }

  const created = normalizeGestorItem(data);
  if (created?.id) {
    gestorAllItems = [created, ...gestorAllItems.filter((x) => x.id !== created.id)];
  }

  document.getElementById("op-gestor-desc").value = "";
  setLinkPlaceholder();
  document.getElementById("op-gestor-fecha").valueAsDate = new Date();
  resetGestorFilters();
  gestorPagina = 1;
  applyGestorFilterAndPage();

  if (status) {
    status.textContent = "Oportunidad agregada.";
    status.classList.remove("hidden");
    setTimeout(() => status.classList.add("hidden"), 2500);
  }

  await cargarGestor();
  document.getElementById("op-gestor-desc")?.focus();
}

async function confirmarGestorSeleccionado(id = gestorSelectedId) {
  const item = getGestorItem(id);
  if (!item) {
    alert("Seleccioná una oportunidad para confirmar.");
    return;
  }
  if (item.confirmada) return;

  await gestorApiFetch(`/api/planillas/oportunidad/gestor/${item.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fecha: item.fecha,
      descripcion: item.descripcion,
      link: item.link,
      confirmada: true,
      porcentaje: item.porcentaje,
    }),
  });
  await cargarGestor();
}

async function editarGestorSeleccionado(id = gestorSelectedId) {
  const item = getGestorItem(id);
  if (!item) {
    alert("Seleccioná una oportunidad para editar.");
    return;
  }
  const desc = prompt("Descripción", item.descripcion);
  if (desc === null) return;
  const link = prompt("Link", item.link);
  if (link === null) return;
  const conf = confirm("¿Oportunidad confirmada?");
  await gestorApiFetch(`/api/planillas/oportunidad/gestor/${item.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fecha: item.fecha, descripcion: desc, link, confirmada: conf }),
  });
  await cargarGestor();
}

async function eliminarGestorSeleccionado(id = gestorSelectedId) {
  const item = getGestorItem(id);
  if (!item) {
    alert("Seleccioná una oportunidad para eliminar.");
    return;
  }
  if (!confirm("¿Eliminar esta oportunidad?")) return;
  await gestorApiFetch(`/api/planillas/oportunidad/gestor/${item.id}`, { method: "DELETE" });
  if (gestorSelectedId === item.id) gestorSelectedId = null;
  await cargarGestor();
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
