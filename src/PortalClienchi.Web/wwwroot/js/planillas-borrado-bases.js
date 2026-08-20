import { getPlanUserEmail, planUserFetch } from "./plan-user.js";
import {
  canSeeBorradoBasesModule as canSeeFromAccess,
  canConfirmBorradoBasesModule as canConfirmFromAccess,
  canLoadBorradoBasesModule as canLoadFromAccess,
  refreshModuleFlags,
  isSt2SuperAdmin,
} from "./module-access.js";
import { notifyBorradoChanged } from "./borrado-alerts.js";

/**
 * Override: localStorage.setItem("st2-borrado-bases-force", "1")
 * o localStorage.setItem("st2-modules-force-all", "1")
 */
const FORCE_KEY = "st2-borrado-bases-force";
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const PREVIEW_LIST_KEY = "st2-borrado-preview-list-only";

let moduleInited = false;
let items = [];
let selectedId = null;
let canConfirm = false;
let canLoad = true;
let editingId = null;
/** @type {"desc" | "asc"} */
let fechaSortDir = "desc";
let monthFilterTouched = false;
let listLoadGen = 0;
let scrollListToEndOnce = false;
/** @type {number | null} */
let pendingListoId = null;

export function canSeeBorradoBasesModule(email = getPlanUserEmail()) {
  try {
    if (localStorage.getItem(FORCE_KEY) === "1") return true;
  } catch { /* ignore */ }

  if (!String(email || "").trim()) return false;
  return canSeeFromAccess();
}

function canConfirmBorrado(email = getPlanUserEmail()) {
  try {
    if (localStorage.getItem(FORCE_KEY) === "1") return true;
  } catch { /* ignore */ }

  if (!String(email || "").trim()) return false;
  return canConfirmFromAccess();
}

function canLoadBorrado(email = getPlanUserEmail()) {
  try {
    if (localStorage.getItem(FORCE_KEY) === "1") return true;
  } catch { /* ignore */ }

  if (isSt2SuperAdmin(email)) return true;
  if (!String(email || "").trim()) return false;
  return canLoadFromAccess();
}

function sistemaHidesCommercialModules() {
  const sistema = document.body.dataset.planSistema;
  return sistema === "Legal" || sistema === "Chile";
}

export function syncBorradoBasesModuleVisibility() {
  const btn = document.getElementById("plan-modulo-borrado-bases");
  if (!btn) return;
  const allowed = canSeeBorradoBasesModule() && !sistemaHidesCommercialModules();
  btn.classList.toggle("hidden", !allowed);
  btn.setAttribute("aria-hidden", allowed ? "false" : "true");
}

export function initBorradoBasesModule() {
  syncBorradoBasesModuleVisibility();
  canConfirm = canConfirmBorrado();
  canLoad = canLoadBorrado();
  if (moduleInited) return;
  moduleInited = true;

  document.getElementById("borrado-add")?.addEventListener("click", () => {
    void createSolicitud();
  });

  ["borrado-caso", "borrado-cliente", "borrado-empresa", "borrado-nombre-empresa", "borrado-cuit"].forEach((id) => {
    document.getElementById(id)?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void createSolicitud();
      }
    });
  });

  document.querySelectorAll('input[name="borrado-base"]').forEach((el) => {
    el.addEventListener("change", () => syncDetalleFieldsVisibility());
  });
  document.querySelectorAll('input[name="borrado-edit-base"]').forEach((el) => {
    el.addEventListener("change", () => syncEditDetalleFieldsVisibility());
  });

  document.getElementById("borrado-filter-month")?.addEventListener("change", () => {
    monthFilterTouched = true;
    applyFilters();
  });
  document.getElementById("borrado-search")?.addEventListener("input", () => applyFilters());
  document.getElementById("borrado-filter-mine")?.addEventListener("change", () => applyFilters());
  document.getElementById("borrado-preview-confirm")?.addEventListener("change", (e) => {
    const on = !!e.target?.checked;
    try {
      if (on) sessionStorage.setItem(PREVIEW_LIST_KEY, "1");
      else sessionStorage.removeItem(PREVIEW_LIST_KEY);
    } catch { /* ignore */ }
    syncLoadFormVisibility();
    setStatus(on
      ? "Vista confirmador: solo listado ampliado (como lo ven ellos)."
      : "Volviste a tu vista normal (con formulario).");
  });
  document.getElementById("borrado-th-fecha")?.addEventListener("click", () => {
    fechaSortDir = fechaSortDir === "desc" ? "asc" : "desc";
    syncFechaSortHeader();
    applyFilters();
  });
  syncFechaSortHeader();

  document.getElementById("borrado-edit-save")?.addEventListener("click", () => {
    void saveEdit();
  });
  document.getElementById("borrado-edit-cancel")?.addEventListener("click", () => hideEditModal());
  document.getElementById("borrado-edit-overlay")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) hideEditModal();
  });

  document.getElementById("borrado-delete-cancel")?.addEventListener("click", () => hideDeleteModal());
  document.getElementById("borrado-delete-confirm")?.addEventListener("click", () => {
    void confirmDeleteModal();
  });
  document.getElementById("borrado-delete-overlay")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) hideDeleteModal();
  });

  document.getElementById("borrado-note-cancel")?.addEventListener("click", () => hideNoteModal());
  document.getElementById("borrado-note-save")?.addEventListener("click", () => {
    void saveNoteModal();
  });
  document.getElementById("borrado-note-overlay")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) hideNoteModal();
  });

  document.getElementById("borrado-listo-cancel")?.addEventListener("click", () => hideListoModal());
  document.getElementById("borrado-listo-confirm")?.addEventListener("click", () => {
    void confirmListoModal();
  });
  document.getElementById("borrado-listo-overlay")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) hideListoModal();
  });

  const ctx = document.getElementById("borrado-ctx");
  ctx?.addEventListener("click", (e) => {
    e.stopPropagation();
    const btn = e.target.closest("[data-borrado-ctx]");
    if (!btn || btn.classList.contains("hidden")) return;
    const action = btn.getAttribute("data-borrado-ctx");
    hideCtx();
    void handleCtxAction(action);
  });

  document.addEventListener("click", (e) => {
    if (e.target?.closest?.("#borrado-base-pop") || e.target?.closest?.("button.borrado-base-pill")) return;
    hideCtx();
    hideBasePop();
  });
  document.addEventListener("scroll", () => {
    hideCtx();
    hideBasePop();
  }, true);

  document.getElementById("borrado-base-pop-close")?.addEventListener("click", (e) => {
    e.stopPropagation();
    hideBasePop();
  });
  document.getElementById("borrado-base-pop-copy")?.addEventListener("click", (e) => {
    e.stopPropagation();
    void copyBasePopText();
  });

  document.addEventListener("st2:planillas-home", () => {
    listLoadGen += 1;
    hideCtx();
    hideBasePop();
    hideEditModal();
    hideDeleteModal();
    hideNoteModal();
    hideListoModal();
    const status = document.getElementById("borrado-status");
    if (status) {
      status.classList.add("hidden");
      status.textContent = "";
    }
  });

  syncSolicitanteBadge();
  syncDetalleFieldsVisibility();
}

export async function openBorradoBasesModule() {
  if (!canSeeBorradoBasesModule()) return;
  initBorradoBasesModule();
  await refreshModuleFlags();
  canConfirm = canConfirmBorrado();
  canLoad = canLoadBorrado();
  syncSolicitanteBadge();
  syncMineFilterVisibility();
  syncLoadFormVisibility();
  clearForm();
  monthFilterTouched = false;
  setStatus("Cargando solicitudes…");
  await reloadList();
}

function isPreviewConfirmListOnly() {
  if (!isSt2SuperAdmin()) return false;
  try {
    return sessionStorage.getItem(PREVIEW_LIST_KEY) === "1";
  } catch {
    return false;
  }
}

function effectiveCanLoad() {
  if (isPreviewConfirmListOnly()) return false;
  return canLoad;
}

function syncLoadFormVisibility() {
  const showForm = effectiveCanLoad();
  const formPanel = document.querySelector(".borrado-form-panel");
  if (formPanel) formPanel.classList.toggle("hidden", !showForm);

  const app = document.querySelector(".borrado-app");
  if (app) app.classList.toggle("borrado-list-only", (!!canConfirm && !showForm) || isPreviewConfirmListOnly());

  const previewWrap = document.getElementById("borrado-preview-confirm-wrap");
  const previewCheck = document.getElementById("borrado-preview-confirm");
  const showPreview = isSt2SuperAdmin() && canLoad;
  if (previewWrap) previewWrap.classList.toggle("hidden", !showPreview);
  if (previewCheck && showPreview) previewCheck.checked = isPreviewConfirmListOnly();
}

function syncSolicitanteBadge() {
  const badge = document.getElementById("borrado-user-badge");
  const email = getPlanUserEmail();
  if (!badge) return;
  if (!email) {
    badge.classList.add("hidden");
    badge.textContent = "";
    return;
  }
  badge.textContent = displayNameFromEmail(email);
  badge.classList.remove("hidden");
}

function syncMineFilterVisibility() {
  const wrap = document.getElementById("borrado-filter-mine-wrap");
  const check = document.getElementById("borrado-filter-mine");
  if (!wrap) return;
  const show = !canConfirm;
  wrap.classList.toggle("hidden", !show);
  if (!show && check) check.checked = false;
}

function syncDetalleFieldsVisibility() {
  toggleDetailField("borrado-ejercicios-field", "borrado-ejercicios", !!document.getElementById("borrado-base-contabilidad")?.checked);
}

function syncEditDetalleFieldsVisibility() {
  toggleDetailField("borrado-edit-ejercicios-field", "borrado-edit-ejercicios", !!document.getElementById("borrado-edit-base-contabilidad")?.checked);
}

function toggleDetailField(fieldId, inputId, show) {
  const field = document.getElementById(fieldId);
  if (field) {
    field.classList.toggle("hidden", !show);
    field.setAttribute("aria-hidden", show ? "false" : "true");
  }
  if (!show) {
    const input = document.getElementById(inputId);
    if (input) input.value = "";
  }
}

function setStatus(msg, isError = false) {
  const el = document.getElementById("borrado-status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
  el.classList.toggle("is-error", !!isError && !!msg);
}

function clearForm() {
  const caso = document.getElementById("borrado-caso");
  const cliente = document.getElementById("borrado-cliente");
  const empresa = document.getElementById("borrado-empresa");
  const nombre = document.getElementById("borrado-nombre-empresa");
  const cuit = document.getElementById("borrado-cuit");
  const ejercicios = document.getElementById("borrado-ejercicios");
  if (caso) caso.value = "";
  if (cliente) cliente.value = "";
  if (empresa) empresa.value = "";
  if (nombre) nombre.value = "";
  if (cuit) cuit.value = "";
  if (ejercicios) ejercicios.value = "";
  document.querySelectorAll('input[name="borrado-base"]').forEach((el) => {
    el.checked = false;
  });
  syncDetalleFieldsVisibility();
}

function readBasesFromForm(prefix) {
  return {
    iva: !!document.getElementById(`${prefix}-iva`)?.checked,
    sueldos: !!document.getElementById(`${prefix}-sueldos`)?.checked,
    contabilidad: !!document.getElementById(`${prefix}-contabilidad`)?.checked,
  };
}

function currentEmail() {
  return String(getPlanUserEmail() || "").trim().toLowerCase();
}

function displayNameFromEmail(email) {
  const local = String(email || "").split("@")[0] || "";
  return local
    .split(/[._\-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

function isOwner(item) {
  return String(item.solicitadoPorEmail || "").trim().toLowerCase() === currentEmail();
}

async function createSolicitud() {
  if (!canLoad) {
    setStatus("Tu perfil es solo listado: no podés cargar solicitudes.", true);
    return;
  }
  const nroCaso = document.getElementById("borrado-caso")?.value.trim() || "";
  const nroCliente = document.getElementById("borrado-cliente")?.value.trim() || "";
  const nroEmpresa = document.getElementById("borrado-empresa")?.value.trim() || "";
  const nombreEmpresa = document.getElementById("borrado-nombre-empresa")?.value.trim() || "";
  const cuit = document.getElementById("borrado-cuit")?.value.trim() || "";
  const bases = readBasesFromForm("borrado-base");
  const ejerciciosDetalle = document.getElementById("borrado-ejercicios")?.value.trim() || "";

  if (!nroCaso || !nroCliente || !nroEmpresa || !nombreEmpresa) {
    setStatus("Completá caso, cliente, código y nombre de empresa.", true);
    return;
  }
  if (!bases.iva && !bases.sueldos && !bases.contabilidad) {
    setStatus("Marcá al menos una base a borrar.", true);
    return;
  }
  if (bases.contabilidad && !ejerciciosDetalle) {
    setStatus("Si marcás CG, pegá los ejercicios a borrar.", true);
    return;
  }

  setStatus("Guardando…");
  try {
    const res = await planUserFetch("/api/planillas/borrado-bases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nroCaso,
        nroCliente,
        nroEmpresa,
        nombreEmpresa,
        cuit,
        ...bases,
        ejerciciosDetalle: bases.contabilidad ? ejerciciosDetalle : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.detail || `Error ${res.status}`);
    clearForm();
    setStatus("Solicitud agregada.");
    scrollListToEndOnce = true;
    await reloadList();
    notifyBorradoChanged();
    document.getElementById("borrado-caso")?.focus();
  } catch (err) {
    setStatus(err?.message || "No se pudo guardar.", true);
  }
}

async function reloadList() {
  const gen = ++listLoadGen;
  try {
    const res = await planUserFetch("/api/planillas/borrado-bases");
    if (gen !== listLoadGen) return;
    const data = await res.json().catch(() => ({}));
    if (gen !== listLoadGen) return;
    if (!res.ok) throw new Error(data.error || data.detail || `Error ${res.status}`);
    items = (Array.isArray(data.items) ? data.items : []).map(normalizeItem);
    canConfirm = !!data.canConfirm || canConfirmBorrado();
    canLoad = data.canLoad == null ? canLoadBorrado() : !!data.canLoad || isSt2SuperAdmin();
    syncMineFilterVisibility();
    syncLoadFormVisibility();
    rebuildMonthOptions();
    applyFilters();
  } catch (err) {
    if (gen !== listLoadGen) return;
    if (!items.length) applyFilters();
    setStatus(err?.message || "No se pudo cargar el listado.", true);
  }
}

function rebuildMonthOptions() {
  const sel = document.getElementById("borrado-filter-month");
  if (!sel) return;

  const previous = String(sel.value || "").trim();
  const current = currentMonthKey();
  const keys = new Set();
  for (const item of items) {
    const key = monthKeyFromIso(item.fechaSolicitud);
    if (key) keys.add(key);
  }
  keys.add(current);

  const sorted = [...keys].sort((a, b) => b.localeCompare(a));
  sel.innerHTML = `<option value="all">Todos los meses</option>` +
    sorted.map((key) => {
      const [y, m] = key.split("-");
      const monthIdx = Number(m) - 1;
      const label = `${MONTHS[monthIdx] || m} ${y}`;
      return `<option value="${key}">${escapeHtml(label)}</option>`;
    }).join("");

  let next = current;
  if (monthFilterTouched) {
    next = previous || current;
    if (next !== "all" && !sorted.includes(next)) next = current;
  }

  sel.value = next;
  if (![...sel.options].some((o) => o.value === sel.value)) {
    sel.value = current;
  }
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthKeyFromIso(iso) {
  const raw = String(iso || "").trim();
  const isoMatch = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?(?:[T\s].*)?/.exec(raw);
  if (isoMatch) {
    return `${isoMatch[1]}-${String(Number(isoMatch[2])).padStart(2, "0")}`;
  }
  return "";
}

function normalizeItem(raw) {
  const src = raw || {};
  return {
    id: src.id ?? src.Id ?? 0,
    nroCaso: src.nroCaso ?? src.NroCaso ?? "",
    nroCliente: src.nroCliente ?? src.NroCliente ?? "",
    nroEmpresa: src.nroEmpresa ?? src.NroEmpresa ?? "",
    nombreEmpresa: src.nombreEmpresa ?? src.NombreEmpresa ?? "",
    cuit: src.cuit ?? src.Cuit ?? "",
    iva: !!(src.iva ?? src.Iva),
    sueldos: !!(src.sueldos ?? src.Sueldos),
    contabilidad: !!(src.contabilidad ?? src.Contabilidad),
    ivaDetalle: src.ivaDetalle ?? src.IvaDetalle ?? null,
    sueldosDetalle: src.sueldosDetalle ?? src.SueldosDetalle ?? null,
    ejerciciosDetalle: src.ejerciciosDetalle ?? src.EjerciciosDetalle ?? null,
    fechaSolicitud: src.fechaSolicitud ?? src.FechaSolicitud ?? "",
    fechaCreacion: src.fechaCreacion ?? src.FechaCreacion ?? "",
    solicitadoPorEmail: src.solicitadoPorEmail ?? src.SolicitadoPorEmail ?? "",
    solicitadoPorNombre: src.solicitadoPorNombre ?? src.SolicitadoPorNombre ?? "",
    listo: !!(src.listo ?? src.Listo),
    aclaracion: src.aclaracion ?? src.Aclaracion ?? null,
  };
}

function getFilteredItems() {
  const month = document.getElementById("borrado-filter-month")?.value || "all";
  const q = String(document.getElementById("borrado-search")?.value || "").trim().toLowerCase();
  const onlyMine = !canConfirm && !!document.getElementById("borrado-filter-mine")?.checked;
  const me = currentEmail();

  const filtered = items.filter((item) => {
    if (onlyMine && String(item.solicitadoPorEmail || "").trim().toLowerCase() !== me) return false;
    if (month !== "all" && monthKeyFromIso(item.fechaSolicitud) !== month) return false;
    if (q) {
      const hay = [
        item.nroCaso,
        item.nroCliente,
        item.nroEmpresa,
        item.nombreEmpresa,
        item.cuit,
        item.solicitadoPorNombre,
        item.ivaDetalle,
        item.sueldosDetalle,
        item.ejerciciosDetalle,
        item.aclaracion,
        basesLabel(item),
      ].map((x) => String(x || "").toLowerCase()).join(" ");
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const dir = fechaSortDir === "asc" ? 1 : -1;
  filtered.sort((a, b) => {
    const fa = String(a.fechaSolicitud || "");
    const fb = String(b.fechaSolicitud || "");
    if (fa !== fb) return fa < fb ? -dir : dir;
    const ca = String(a.fechaCreacion || "");
    const cb = String(b.fechaCreacion || "");
    if (ca && cb && ca !== cb) return ca < cb ? -dir : dir;
    return ((a.id || 0) - (b.id || 0)) * dir;
  });
  return filtered;
}

function syncFechaSortHeader() {
  const th = document.getElementById("borrado-th-fecha");
  if (!th) return;
  const mark = th.querySelector(".borrado-sort-mark");
  const desc = fechaSortDir === "desc";
  th.setAttribute("aria-sort", desc ? "descending" : "ascending");
  th.title = desc
    ? "Lo más nuevo arriba — clic para invertir"
    : "Lo más antiguo arriba — clic para invertir";
  if (mark) mark.textContent = desc ? "↓" : "↑";
}

function applyFilters() {
  const filtered = getFilteredItems();
  renderTable(filtered);
  const count = document.getElementById("borrado-count");
  if (count) count.textContent = filtered.length ? `(${filtered.length})` : "";
  const statusEl = document.getElementById("borrado-status");
  if (statusEl && !statusEl.classList.contains("is-error")) {
    setStatus(filtered.length ? `${filtered.length} solicitud(es).` : "Sin solicitudes con ese filtro.");
  }
}

function basesLabel(item) {
  const parts = [];
  if (item.iva) parts.push("IVA");
  if (item.sueldos) parts.push("SJ");
  if (item.contabilidad) parts.push("CG");
  return parts.join(", ") || "—";
}

function formatBasesPills(item) {
  const pills = [];
  if (item.iva) {
    pills.push('<span class="borrado-base-pill" title="IVA">IVA</span>');
  }
  if (item.sueldos) {
    pills.push('<span class="borrado-base-pill" title="Sueldos y Jornales">SJ</span>');
  }
  if (item.contabilidad) {
    const detail = String(item.ejerciciosDetalle || "").trim() || "Sin ejercicios";
    const display = formatEjerciciosSeparated(detail);
    pills.push(basePillHtml("CG", display, true));
  }
  return pills.length ? pills.join(" ") : "—";
}

/** Separa varios ejercicios con guiones cuando hay más de uno. */
function splitEjercicios(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];
  let parts = text.split(/\r?\n+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) {
    const alt = text.split(/\s*[;|]\s*|\s+[-–—]\s+/).map((s) => s.trim()).filter(Boolean);
    if (alt.length > 1) parts = alt;
  }
  return parts;
}

function formatEjerciciosSeparated(raw) {
  const parts = splitEjercicios(raw);
  if (parts.length === 0) return "Sin ejercicios";
  if (parts.length === 1) return parts[0];
  return `-\n${parts.join("\n-\n")}\n-`;
}

function basePillHtml(label, detail, contab) {
  const tip = escapeAttr(detail);
  const cls = contab ? "borrado-base-pill contab" : "borrado-base-pill";
  return `<button type="button" class="${cls}" title="${tip}" data-borrado-base-label="${escapeAttr(label)}" data-borrado-base-detail="${escapeAttr(detail)}">${escapeHtml(label)}</button>`;
}

function hideBasePop() {
  const pop = document.getElementById("borrado-base-pop");
  if (!pop) return;
  pop.classList.add("hidden");
  pop.setAttribute("aria-hidden", "true");
}

function showBasePop(anchor, label, detail) {
  const pop = document.getElementById("borrado-base-pop");
  const title = document.getElementById("borrado-base-pop-title");
  const text = document.getElementById("borrado-base-pop-text");
  const copyBtn = document.getElementById("borrado-base-pop-copy");
  if (!pop || !anchor) return;

  hideCtx();
  if (title) title.textContent = label || "Base";
  if (text) text.textContent = detail || "—";
  if (copyBtn) {
    copyBtn.classList.remove("is-copied");
    copyBtn.setAttribute("data-copy-hint", "Copiar");
    copyBtn.textContent = "Copiar";
  }

  pop.classList.remove("hidden");
  pop.setAttribute("aria-hidden", "false");

  const rect = anchor.getBoundingClientRect();
  const pad = 8;
  const w = pop.offsetWidth || 280;
  const h = pop.offsetHeight || 140;
  let left = rect.left;
  let top = rect.bottom + 6;
  if (left + w > window.innerWidth - pad) left = window.innerWidth - w - pad;
  if (top + h > window.innerHeight - pad) top = Math.max(pad, rect.top - h - 6);
  pop.style.left = `${Math.max(pad, left)}px`;
  pop.style.top = `${Math.max(pad, top)}px`;
}

async function copyBasePopText() {
  const text = document.getElementById("borrado-base-pop-text")?.textContent || "";
  const btn = document.getElementById("borrado-base-pop-copy");
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      btn.classList.add("is-copied");
      btn.textContent = "Copiado";
      btn.setAttribute("data-copy-hint", "Copiado");
      const prev = Number(btn.dataset.copyFlashTimer || 0);
      if (prev) window.clearTimeout(prev);
      btn.dataset.copyFlashTimer = String(window.setTimeout(() => {
        btn.classList.remove("is-copied");
        btn.textContent = "Copiar";
        btn.setAttribute("data-copy-hint", "Copiar");
        delete btn.dataset.copyFlashTimer;
      }, 1400));
    }
  } catch {
    setStatus(text, false);
  }
}

async function copyClienteText(value, btn) {
  try {
    await navigator.clipboard.writeText(value);
    if (btn) {
      btn.classList.add("is-copied");
      const hint = btn.querySelector(".borrado-cliente-copy-hint");
      if (hint) hint.textContent = "copiado";
      const prev = Number(btn.dataset.copyFlashTimer || 0);
      if (prev) window.clearTimeout(prev);
      btn.dataset.copyFlashTimer = String(window.setTimeout(() => {
        btn.classList.remove("is-copied");
        if (hint) hint.textContent = "copiar";
        delete btn.dataset.copyFlashTimer;
      }, 1400));
    }
  } catch {
    setStatus(String(value || ""), false);
  }
}

function renderTable(filtered) {
  const tbody = document.getElementById("borrado-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!filtered.length) {
    const row = document.createElement("tr");
    row.className = "plan-gestor-empty-row";
    row.innerHTML = `<td colspan="9">No hay solicitudes con ese filtro.</td>`;
    tbody.appendChild(row);
    return;
  }

  for (const item of filtered) {
    tbody.appendChild(buildRow(item));
  }

  if (scrollListToEndOnce && fechaSortDir === "desc") {
    scrollListToEndOnce = false;
    const wrap = document.querySelector(".borrado-table-wrap");
    if (wrap) requestAnimationFrame(() => { wrap.scrollTop = 0; });
  } else if (scrollListToEndOnce) {
    scrollListToEndOnce = false;
    const wrap = document.querySelector(".borrado-table-wrap");
    if (wrap) requestAnimationFrame(() => { wrap.scrollTop = wrap.scrollHeight; });
  }
}

function buildRow(item) {
  const row = document.createElement("tr");
  if (selectedId === item.id) row.classList.add("selected");
  if (item.listo) row.classList.add("borrado-row-listo");
  if (item.aclaracion) row.classList.add("borrado-row-aclaracion");

  const nro = String(item.nroEmpresa || "").trim();
  const nombre = String(item.nombreEmpresa || "").trim();
  const cuit = String(item.cuit || "").trim();
  const cliente = String(item.nroCliente || "").trim();
  const aclaracion = String(item.aclaracion || "").trim();
  const empresaTitle = escapeHtml(nro && nombre ? `[${nro}] ${nombre}` : (nro || nombre || ""));
  row.innerHTML = `
    <td class="borrado-col-fecha" title="${escapeHtml(item.fechaSolicitud || "")}">${escapeHtml(formatFecha(item.fechaSolicitud))}</td>
    <td class="borrado-col-caso">${escapeHtml(item.nroCaso || "—")}</td>
    <td class="borrado-col-cliente" title="${escapeHtml(cliente)}">
      ${cliente
        ? `<button type="button" class="borrado-cliente-copy" data-borrado-copy-cliente="${escapeHtml(cliente)}" title="Clic para copiar N° de cliente">
            <span class="borrado-cliente-copy-text">${escapeHtml(cliente)}</span>
            <span class="borrado-cliente-copy-hint" aria-hidden="true">copiar</span>
          </button>`
        : "—"}
    </td>
    <td class="borrado-col-empresa" title="${empresaTitle}">
      <span class="borrado-empresa-nro">${escapeHtml(nro ? `[${nro}]` : "—")}</span>
      <span class="borrado-empresa-nombre">${escapeHtml(nombre || "")}</span>
    </td>
    <td class="borrado-col-cuit">${escapeHtml(cuit || "—")}</td>
    <td class="borrado-col-bases">${formatBasesPills(item)}</td>
    <td class="borrado-col-solicitante">${escapeHtml(item.solicitadoPorNombre || item.solicitadoPorEmail || "")}</td>
    <td class="borrado-col-listo">${formatEstadoCell(item)}</td>
    <td class="borrado-col-aclaracion">${aclaracion ? `<span class="borrado-aclaracion-full">${escapeHtml(aclaracion)}</span>` : "—"}</td>
  `;

  row.querySelector("[data-borrado-copy-cliente]")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const btn = e.currentTarget;
    const value = btn.getAttribute("data-borrado-copy-cliente") || cliente;
    void copyClienteText(value, btn);
  });

  row.addEventListener("click", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("[data-borrado-copy-cliente]")) return;
    const pill = e.target.closest("button.borrado-base-pill");
    if (pill) {
      e.preventDefault();
      e.stopPropagation();
      selectedId = item.id;
      showBasePop(
        pill,
        pill.getAttribute("data-borrado-base-label") || "",
        pill.getAttribute("data-borrado-base-detail") || "",
      );
      return;
    }
    hideBasePop();
    selectedId = item.id;
    applyFilters();
  });

  row.addEventListener("dblclick", (e) => {
    if (e.target.closest("button.borrado-base-pill, button.borrado-cliente-copy")) return;
    e.preventDefault();
    selectedId = item.id;
    applyFilters();
    if (!canConfirm) {
      setStatus("Solo quien confirma puede marcar listo con doble clic.", true);
      return;
    }
    void toggleListoByDoubleClick(item);
  });

  row.title = canConfirm
    ? "Doble clic: marcar / quitar listo · Clic derecho: menú"
    : "Clic derecho: menú (si sos el solicitante)";

  row.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    hideBasePop();
    selectedId = item.id;
    applyFilters();
    showCtx(e.clientX, e.clientY, item);
  });

  return row;
}

async function toggleListoByDoubleClick(item) {
  try {
    if (item.listo) {
      await patchItem(item.id, { listo: false });
      setStatus("Se quitó el listo.");
      await reloadList();
      notifyBorradoChanged();
      return;
    }
    openListoModal(item);
  } catch (err) {
    setStatus(err?.message || "No se pudo actualizar.", true);
  }
}

function openListoModal(item) {
  pendingListoId = item.id;
  selectedId = item.id;
  const overlay = document.getElementById("borrado-listo-overlay");
  const wrapIva = document.getElementById("borrado-listo-iva-wrap");
  const wrapSj = document.getElementById("borrado-listo-sueldos-wrap");
  const wrapCg = document.getElementById("borrado-listo-contabilidad-wrap");
  const chkIva = document.getElementById("borrado-listo-iva");
  const chkSj = document.getElementById("borrado-listo-sueldos");
  const chkCg = document.getElementById("borrado-listo-contabilidad");

  wrapIva?.classList.toggle("hidden", !item.iva);
  wrapSj?.classList.toggle("hidden", !item.sueldos);
  wrapCg?.classList.toggle("hidden", !item.contabilidad);
  if (chkIva) chkIva.checked = !!item.iva;
  if (chkSj) chkSj.checked = !!item.sueldos;
  if (chkCg) chkCg.checked = !!item.contabilidad;

  overlay?.classList.remove("hidden");
  overlay?.setAttribute("aria-hidden", "false");
  document.getElementById("borrado-listo-confirm")?.focus();
}

function hideListoModal() {
  pendingListoId = null;
  const overlay = document.getElementById("borrado-listo-overlay");
  overlay?.classList.add("hidden");
  overlay?.setAttribute("aria-hidden", "true");
}

async function confirmListoModal() {
  if (!pendingListoId) return;
  const item = items.find((x) => x.id === pendingListoId);
  if (!item) {
    hideListoModal();
    return;
  }

  const missing = [];
  if (item.iva && !document.getElementById("borrado-listo-iva")?.checked) missing.push("IVA no");
  if (item.sueldos && !document.getElementById("borrado-listo-sueldos")?.checked) missing.push("SJ no");
  if (item.contabilidad && !document.getElementById("borrado-listo-contabilidad")?.checked) missing.push("CG no");

  const body = { listo: true };
  if (missing.length) body.aclaracion = missing.join(" · ");

  try {
    await patchItem(pendingListoId, body);
    hideListoModal();
    setStatus(missing.length ? `Listo. Aclaración: ${missing.join(" · ")}` : "Marcado como listo.");
    await reloadList();
    notifyBorradoChanged();
  } catch (err) {
    setStatus(err?.message || "No se pudo actualizar.", true);
  }
}

function formatFecha(iso) {
  const raw = String(iso || "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return raw || "—";
  const day = Number(m[3]);
  const month = MONTHS[Number(m[2]) - 1] || m[2];
  const year = Number(m[1]);
  const nowY = new Date().getFullYear();
  if (year === nowY) return `${day}-${month}`;
  return `${day}-${month}-${String(year).slice(-2)}`;
}

function formatEstadoCell(item) {
  if (item.listo) {
    return '<span class="borrado-pill ok">Listo</span>';
  }
  if (!String(item.aclaracion || "").trim()) {
    return '<span class="borrado-estado-pending" title="Pendiente de confirmación" aria-label="Pendiente">⏳</span>';
  }
  return "—";
}

function showCtx(x, y, item) {
  const menu = document.getElementById("borrado-ctx");
  if (!menu) return;

  const owner = isOwner(item);
  const confirm = canConfirm;

  menu.querySelectorAll("[data-borrado-ctx]").forEach((btn) => {
    const action = btn.getAttribute("data-borrado-ctx");
    let show = false;
    if (action === "editar" || action === "eliminar") show = owner || confirm;
    else if (["listo", "unlisto", "aclaracion-manual", "clear-aclaracion"].includes(action || "")) {
      show = confirm;
    }
    btn.classList.toggle("hidden", !show);
  });

  const hrs = menu.querySelectorAll("hr");
  hrs.forEach((hr) => hr.classList.toggle("hidden", !confirm));

  const anyVisible = [...menu.querySelectorAll("[data-borrado-ctx]")].some((b) => !b.classList.contains("hidden"));
  if (!anyVisible) {
    menu.classList.add("hidden");
    return;
  }

  menu.classList.remove("hidden");
  const pad = 8;
  const w = menu.offsetWidth || 260;
  const h = menu.offsetHeight || 240;
  const left = Math.min(x, window.innerWidth - w - pad);
  const top = Math.min(y, window.innerHeight - h - pad);
  menu.style.left = `${Math.max(pad, left)}px`;
  menu.style.top = `${Math.max(pad, top)}px`;
}

function hideCtx() {
  document.getElementById("borrado-ctx")?.classList.add("hidden");
}

async function handleCtxAction(action) {
  if (!selectedId) return;
  const item = items.find((x) => x.id === selectedId);
  if (!item) return;

  try {
    if (action === "editar") {
      openEditModal(item);
      return;
    }
    if (action === "listo") {
      openListoModal(item);
      return;
    } else if (action === "unlisto") {
      await patchItem(selectedId, { listo: false });
    } else if (action === "aclaracion-manual") {
      openNoteModal(item);
      return;
    } else if (action === "clear-aclaracion") {
      await patchItem(selectedId, { clearAclaracion: true });
    } else if (action === "eliminar") {
      openDeleteModal(item);
      return;
    }
    setStatus("Actualizado.");
    await reloadList();
    notifyBorradoChanged();
  } catch (err) {
    setStatus(err?.message || "No se pudo actualizar.", true);
  }
}

function openEditModal(item) {
  editingId = item.id;
  const overlay = document.getElementById("borrado-edit-overlay");
  const caso = document.getElementById("borrado-edit-caso");
  const cliente = document.getElementById("borrado-edit-cliente");
  const empresa = document.getElementById("borrado-edit-empresa");
  const nombre = document.getElementById("borrado-edit-nombre-empresa");
  const cuitInput = document.getElementById("borrado-edit-cuit");
  const iva = document.getElementById("borrado-edit-base-iva");
  const sueldos = document.getElementById("borrado-edit-base-sueldos");
  const contabilidad = document.getElementById("borrado-edit-base-contabilidad");
  const ejercicios = document.getElementById("borrado-edit-ejercicios");
  if (caso) caso.value = item.nroCaso || "";
  if (cliente) cliente.value = item.nroCliente || "";
  if (empresa) empresa.value = item.nroEmpresa || "";
  if (nombre) nombre.value = item.nombreEmpresa || "";
  if (cuitInput) cuitInput.value = item.cuit || "";
  if (iva) iva.checked = !!item.iva;
  if (sueldos) sueldos.checked = !!item.sueldos;
  if (contabilidad) contabilidad.checked = !!item.contabilidad;
  syncEditDetalleFieldsVisibility();
  if (ejercicios) ejercicios.value = item.contabilidad ? (item.ejerciciosDetalle || "") : "";
  overlay?.classList.remove("hidden");
  overlay?.setAttribute("aria-hidden", "false");
  caso?.focus();
}

function hideEditModal() {
  editingId = null;
  const overlay = document.getElementById("borrado-edit-overlay");
  overlay?.classList.add("hidden");
  overlay?.setAttribute("aria-hidden", "true");
}

async function saveEdit() {
  if (!editingId) return;
  const nroCaso = document.getElementById("borrado-edit-caso")?.value.trim() || "";
  const nroCliente = document.getElementById("borrado-edit-cliente")?.value.trim() || "";
  const nroEmpresa = document.getElementById("borrado-edit-empresa")?.value.trim() || "";
  const nombreEmpresa = document.getElementById("borrado-edit-nombre-empresa")?.value.trim() || "";
  const cuit = document.getElementById("borrado-edit-cuit")?.value.trim() || "";
  const bases = readBasesFromForm("borrado-edit-base");
  const ejerciciosDetalle = document.getElementById("borrado-edit-ejercicios")?.value.trim() || "";

  if (!nroCaso || !nroCliente || !nroEmpresa || !nombreEmpresa) {
    setStatus("Completá caso, cliente, código y nombre de empresa.", true);
    return;
  }
  if (!bases.iva && !bases.sueldos && !bases.contabilidad) {
    setStatus("Marcá al menos una base a borrar.", true);
    return;
  }
  if (bases.contabilidad && !ejerciciosDetalle) {
    setStatus("Si marcás CG, pegá los ejercicios a borrar.", true);
    return;
  }

  try {
    const res = await planUserFetch(`/api/planillas/borrado-bases/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nroCaso,
        nroCliente,
        nroEmpresa,
        nombreEmpresa,
        cuit,
        ...bases,
        ejerciciosDetalle: bases.contabilidad ? ejerciciosDetalle : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.detail || `Error ${res.status}`);
    hideEditModal();
    setStatus("Solicitud editada.");
    await reloadList();
    notifyBorradoChanged();
  } catch (err) {
    setStatus(err?.message || "No se pudo editar.", true);
  }
}

function openDeleteModal(item) {
  selectedId = item.id;
  const overlay = document.getElementById("borrado-delete-overlay");
  const desc = document.getElementById("borrado-delete-desc");
  if (desc) {
    desc.textContent = `${item.nroCaso || "—"} · ${item.cuit || "—"} · ${item.nombreEmpresa || "—"}`;
  }
  overlay?.classList.remove("hidden");
  overlay?.setAttribute("aria-hidden", "false");
  document.getElementById("borrado-delete-cancel")?.focus();
}

function hideDeleteModal() {
  const overlay = document.getElementById("borrado-delete-overlay");
  overlay?.classList.add("hidden");
  overlay?.setAttribute("aria-hidden", "true");
}

async function confirmDeleteModal() {
  if (!selectedId) return;
  try {
    const res = await planUserFetch(`/api/planillas/borrado-bases/${selectedId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    selectedId = null;
    hideDeleteModal();
    setStatus("Solicitud eliminada.");
    await reloadList();
    notifyBorradoChanged();
  } catch (err) {
    setStatus(err?.message || "No se pudo eliminar.", true);
  }
}

function openNoteModal(item) {
  selectedId = item.id;
  const overlay = document.getElementById("borrado-note-overlay");
  const text = document.getElementById("borrado-note-text");
  if (text) text.value = item.aclaracion || "";
  overlay?.classList.remove("hidden");
  overlay?.setAttribute("aria-hidden", "false");
  text?.focus();
}

function hideNoteModal() {
  const overlay = document.getElementById("borrado-note-overlay");
  overlay?.classList.add("hidden");
  overlay?.setAttribute("aria-hidden", "true");
}

async function saveNoteModal() {
  if (!selectedId) return;
  const text = String(document.getElementById("borrado-note-text")?.value || "").trim();
  try {
    if (!text) {
      await patchItem(selectedId, { clearAclaracion: true });
    } else {
      await patchItem(selectedId, { aclaracion: text });
    }
    hideNoteModal();
    setStatus("Aclaración guardada.");
    await reloadList();
    notifyBorradoChanged();
  } catch (err) {
    setStatus(err?.message || "No se pudo guardar la aclaración.", true);
  }
}

async function patchItem(id, body) {
  const res = await planUserFetch(`/api/planillas/borrado-bases/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.detail || `Error ${res.status}`);
  return data;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/\r?\n/g, "&#10;");
}
