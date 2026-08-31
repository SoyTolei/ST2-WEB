import { getPlanUserEmail, planUserFetch } from "./plan-user.js";
import {
  canSeeBorradoBasesModule as canSeeFromAccess,
  canConfirmBorradoBasesModule as canConfirmFromAccess,
  canLoadBorradoBasesModule as canLoadFromAccess,
  refreshModuleFlags,
  isSt2SuperAdmin,
  getViewAsProfile,
  isViewingAsProfile,
} from "./module-access.js";
import { notifyBorradoChanged } from "./borrado-alerts.js";
import { createPlanillasLiveList } from "./planillas-live-list.js";

/**
 * Override: localStorage.setItem("st2-borrado-bases-force", "1")
 * o localStorage.setItem("st2-modules-force-all", "1")
 */
const FORCE_KEY = "st2-borrado-bases-force";
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const PREVIEW_LIST_KEY = "st2-borrado-preview-list-only";
const DETALLE_SALESFORCE_NOMBRE = "Detalle en Salesforce";

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

const liveList = createPlanillasLiveList({
  viewId: "planillas-borrado-bases",
  reload: (opts) => reloadList(opts),
  isBusy: isBorradoUiBusy,
});

export function stopBorradoLiveRefresh() {
  liveList.stop();
}
/** @type {number | null} */
let pendingListoId = null;

export function canSeeBorradoBasesModule(email = getPlanUserEmail()) {
  if (isViewingAsProfile()) return canSeeFromAccess();
  try {
    if (localStorage.getItem(FORCE_KEY) === "1") return true;
  } catch { /* ignore */ }

  if (!String(email || "").trim()) return false;
  return canSeeFromAccess();
}

function canConfirmBorrado(email = getPlanUserEmail()) {
  if (isViewingAsProfile()) return canConfirmFromAccess();
  try {
    if (localStorage.getItem(FORCE_KEY) === "1") return true;
  } catch { /* ignore */ }

  if (!String(email || "").trim()) return false;
  return canConfirmFromAccess();
}

function canLoadBorrado(email = getPlanUserEmail()) {
  if (isViewingAsProfile()) return canLoadFromAccess();
  try {
    if (localStorage.getItem(FORCE_KEY) === "1") return true;
  } catch { /* ignore */ }

  if (isSt2SuperAdmin(email)) return true;
  if (!String(email || "").trim()) return false;
  return canLoadFromAccess();
}

/** En vista previa de perfil, ignorar canConfirm/canLoad del API (son los del admin real). */
function applyEffectiveAccess(data = {}) {
  if (isViewingAsProfile()) {
    canConfirm = canConfirmBorrado();
    canLoad = canLoadBorrado();
    return;
  }
  canConfirm = !!data.canConfirm || canConfirmBorrado();
  canLoad = data.canLoad == null ? canLoadBorrado() : !!data.canLoad || isSt2SuperAdmin();
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
  document.getElementById("borrado-add-detalle")?.addEventListener("click", () => {
    void createSolicitud();
  });

  document.getElementById("borrado-salesforce")?.addEventListener("change", () => syncSalesforceMode());
  document.getElementById("borrado-edit-salesforce")?.addEventListener("change", () => syncEditSalesforceMode());

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
  document.getElementById("borrado-filter-mine")?.addEventListener("change", (e) => {
    const check = e.target;
    if (check) check.dataset.userTouched = "1";
    applyFilters();
  });
  document.getElementById("borrado-export")?.addEventListener("click", () => {
    void exportExcel();
  });
  document.getElementById("borrado-preview-confirm")?.addEventListener("change", (e) => {
    const on = !!e.target?.checked;
    try {
      sessionStorage.setItem(PREVIEW_LIST_KEY, on ? "1" : "0");
    } catch { /* ignore */ }
    syncLoadFormVisibility();
    setStatus(on
      ? "Vista confirmador: solo listado (ocultá el formulario)."
      : "Formulario de carga visible. Marcá “Vista confirmador” para volver al listado.");
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
  syncSalesforceMode();
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
  liveList.start();
}

function ensureConfirmViewDefault() {
  if (!canConfirm) return;
  try {
    if (sessionStorage.getItem(PREVIEW_LIST_KEY) === null) {
      sessionStorage.setItem(PREVIEW_LIST_KEY, "1");
    }
  } catch { /* ignore */ }
}

function isPreviewConfirmListOnly() {
  if (!canConfirm) return false;
  try {
    const v = sessionStorage.getItem(PREVIEW_LIST_KEY);
    if (v === null || v === "") return true;
    return v === "1";
  } catch {
    return true;
  }
}

function effectiveCanLoad() {
  if (isPreviewConfirmListOnly()) return false;
  return canLoad || canConfirm;
}

function syncLoadFormVisibility() {
  ensureConfirmViewDefault();
  const showForm = effectiveCanLoad();
  const formPanel = document.querySelector(".borrado-form-panel");
  if (formPanel) formPanel.classList.toggle("hidden", !showForm);

  const app = document.querySelector(".borrado-app");
  if (app) app.classList.toggle("borrado-list-only", !showForm);

  const previewWrap = document.getElementById("borrado-preview-confirm-wrap");
  const previewCheck = document.getElementById("borrado-preview-confirm");
  const showPreview = !!canConfirm;
  if (previewWrap) {
    previewWrap.classList.toggle("hidden", !showPreview);
    previewWrap.setAttribute("aria-hidden", showPreview ? "false" : "true");
  }
  if (previewCheck && showPreview) {
    previewCheck.checked = isPreviewConfirmListOnly();
  }
}

function syncSolicitanteBadge() {
  const badge = document.getElementById("borrado-user-badge");
  const viewAs = getViewAsProfile();
  const email = viewAs?.email || getPlanUserEmail();
  if (!badge) return;
  if (!email) {
    badge.classList.add("hidden");
    badge.textContent = "";
    return;
  }
  badge.textContent = viewAs?.displayName || displayNameFromEmail(email);
  badge.classList.remove("hidden");
}

function syncMineFilterVisibility() {
  const wrap = document.getElementById("borrado-filter-mine-wrap");
  const check = document.getElementById("borrado-filter-mine");
  if (!wrap) return;
  const show = !canConfirm;
  wrap.classList.toggle("hidden", !show);
  if (!show && check) {
    check.checked = false;
  } else if (show && check && check.dataset.userTouched !== "1") {
    check.checked = true;
  }
  syncConfirmToolsVisibility();
}

function syncConfirmToolsVisibility() {
  const exportBtn = document.getElementById("borrado-export");
  if (exportBtn) exportBtn.classList.toggle("hidden", !canConfirm);
  syncLoadFormVisibility();
}

function syncDetalleFieldsVisibility() {
  if (isSalesforceFormMode()) return;
  toggleDetailField("borrado-ejercicios-field", "borrado-ejercicios", !!document.getElementById("borrado-base-contabilidad")?.checked);
}

function isSalesforceFormMode() {
  return !!document.getElementById("borrado-salesforce")?.checked;
}

function isDetalleSalesforce(item) {
  return String(item?.nombreEmpresa || "").trim() === DETALLE_SALESFORCE_NOMBRE;
}

function syncSalesforceMode() {
  const sf = isSalesforceFormMode();
  const grid = document.getElementById("borrado-form-grid");
  grid?.classList.toggle("is-salesforce", sf);
  document.getElementById("borrado-salesforce-hint")?.classList.toggle("hidden", !sf);
  if (sf) {
    document.getElementById("borrado-ejercicios-field")?.classList.add("hidden");
    document.getElementById("borrado-ejercicios")?.setAttribute("aria-hidden", "true");
  } else {
    syncDetalleFieldsVisibility();
  }
}

function syncEditSalesforceMode() {
  const sf = !!document.getElementById("borrado-edit-salesforce")?.checked;
  const grid = document.querySelector("#borrado-edit-overlay .borrado-edit-grid");
  grid?.classList.toggle("is-salesforce", sf);
  document.getElementById("borrado-edit-salesforce-hint")?.classList.toggle("hidden", !sf);
  if (sf) {
    document.getElementById("borrado-edit-ejercicios-field")?.classList.add("hidden");
  } else {
    syncEditDetalleFieldsVisibility();
  }
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
  const salesforce = document.getElementById("borrado-salesforce");
  if (caso) caso.value = "";
  if (cliente) cliente.value = "";
  if (empresa) empresa.value = "";
  if (nombre) nombre.value = "";
  if (cuit) cuit.value = "";
  if (ejercicios) ejercicios.value = "";
  if (salesforce) salesforce.checked = false;
  document.querySelectorAll('input[name="borrado-base"]').forEach((el) => {
    el.checked = false;
  });
  syncSalesforceMode();
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
  const viewAs = getViewAsProfile();
  if (viewAs?.email) return String(viewAs.email).trim().toLowerCase();
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

/** Pendiente = sin listo y sin aclaración. Ahí el solicitante puede editar/eliminar. */
function isPendingSolicitud(item) {
  return !item?.listo && !String(item?.aclaracion || "").trim();
}

function canOwnerMutate(item) {
  return isOwner(item) && isPendingSolicitud(item);
}

async function createSolicitud() {
  if (!effectiveCanLoad()) {
    setStatus("Tu perfil es solo listado: no podés cargar solicitudes.", true);
    return;
  }
  const detalleEnSalesforce = isSalesforceFormMode();
  const nroCaso = document.getElementById("borrado-caso")?.value.trim() || "";
  const nroCliente = document.getElementById("borrado-cliente")?.value.trim() || "";

  if (!nroCaso || !nroCliente) {
    setStatus("Completá caso y cliente.", true);
    return;
  }

  let payload;
  if (detalleEnSalesforce) {
    payload = { nroCaso, nroCliente, detalleEnSalesforce: true };
  } else {
    const nroEmpresa = document.getElementById("borrado-empresa")?.value.trim() || "";
    const nombreEmpresa = document.getElementById("borrado-nombre-empresa")?.value.trim() || "";
    const cuit = document.getElementById("borrado-cuit")?.value.trim() || "";
    const bases = readBasesFromForm("borrado-base");
    const ejerciciosDetalle = document.getElementById("borrado-ejercicios")?.value.trim() || "";

    if (!nroEmpresa || !nombreEmpresa) {
      setStatus("Completá código y nombre de empresa.", true);
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

    payload = {
      nroCaso,
      nroCliente,
      nroEmpresa,
      nombreEmpresa,
      cuit,
      ...bases,
      ejerciciosDetalle: bases.contabilidad ? ejerciciosDetalle : null,
      detalleEnSalesforce: false,
    };
  }

  setStatus("Guardando…");
  try {
    const res = await planUserFetch("/api/planillas/borrado-bases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

async function reloadList({ silent = false } = {}) {
  const gen = ++listLoadGen;
  try {
    const res = await planUserFetch("/api/planillas/borrado-bases");
    if (gen !== listLoadGen) return;
    const data = await res.json().catch(() => ({}));
    if (gen !== listLoadGen) return;
    if (!res.ok) throw new Error(data.error || data.detail || `Error ${res.status}`);
    const nextItems = (Array.isArray(data.items) ? data.items : []).map(normalizeItem);
    const changed = listFingerprint(nextItems) !== listFingerprint(items);
    items = nextItems;
    applyEffectiveAccess(data);
    syncMineFilterVisibility();
    syncLoadFormVisibility();
    rebuildMonthOptions();
    if (!silent || changed) applyFilters();
  } catch (err) {
    if (gen !== listLoadGen) return;
    if (!items.length) applyFilters();
    if (silent) return;
    setStatus(err?.message || "No se pudo cargar el listado.", true);
  }
}

function listFingerprint(list) {
  return list.map((i) => `${i.id}:${i.listo ? 1 : 0}:${i.aclaracion || ""}:${i.confirmadoPorNombre || ""}`).join("|");
}

function isBorradoUiBusy() {
  if (editingId) return true;
  for (const id of ["borrado-edit-overlay", "borrado-note-overlay", "borrado-delete-overlay"]) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains("hidden")) return true;
  }
  return false;
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
    confirmadoPorNombre: src.confirmadoPorNombre ?? src.ConfirmadoPorNombre ?? null,
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

async function exportExcel() {
  if (!canConfirm) return;
  setStatus("Generando Excel…");
  try {
    const res = await planUserFetch("/api/planillas/borrado-bases/export");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.detail || `Error ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `borrado-bases-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus("Excel exportado (solicitudes + resumen mensual).");
  } catch (err) {
    setStatus(err?.message || "No se pudo exportar.", true);
  }
}

function basesLabel(item) {
  if (isDetalleSalesforce(item)) return "Salesforce";
  const parts = [];
  if (item.iva) parts.push("IVA");
  if (item.sueldos) parts.push("SJ");
  if (item.contabilidad) parts.push("CG");
  return parts.join(", ") || "—";
}

function formatBasesPills(item) {
  if (isDetalleSalesforce(item)) {
    return '<span class="borrado-base-pill salesforce" title="Detalle en Salesforce">Salesforce</span>';
  }
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
    const count = splitEjercicios(detail).length || 1;
    pills.push(basePillHtml("CG", display, true, count));
  }
  return pills.length ? pills.join(" ") : "—";
}

/** Separa varios ejercicios (saltos de línea, “y”, comas, etc.). */
function splitEjercicios(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];

  const lines = text.split(/\r?\n+/).map((s) => s.trim()).filter(Boolean);
  const parts = [];

  for (const line of lines) {
    // "Ejercicio 2023, y Ejercicio 2024" | "Ejercicio 2025, ejercicio 2023" | "… ; …"
    const chunks = line
      .split(
        /\s*(?:,\s*y\s+|\s+y\s+|,\s*|;|\||\s+[-–—]\s+)\s*(?=(?:ejercicio|ej\.?)\b)/i
      )
      .map((s) => s.trim().replace(/^[-–—]\s*/, "").replace(/^,\s*/, "").replace(/^y\s+/i, ""))
      .filter(Boolean);

    if (chunks.length > 1) {
      parts.push(...chunks);
      continue;
    }

    // Solo años: "2025, 2023 y 2024"
    const years = line.match(/\b20\d{2}\b/g);
    if (years && years.length > 1 && /^(?:ejercicio|ej\.?)?\s*20\d{2}(?:\s*[,;y&]\s*(?:ejercicio|ej\.?)?\s*20\d{2})+$/i.test(line.replace(/\s+/g, " ").trim())) {
      parts.push(...years.map((y) => `Ejercicio ${y}`));
      continue;
    }

    parts.push(line.replace(/^[-–—]\s*/, ""));
  }

  return parts;
}

function formatEjercicioLabel(part) {
  const cleaned = String(part || "").trim().replace(/^[-–—]\s*/, "");
  if (!cleaned) return "";
  const m = cleaned.match(/^(?:ejercicio|ej\.?)\s*(20\d{2})\b/i);
  if (m) return `Ejercicio ${m[1]}`;
  const yearOnly = cleaned.match(/^20\d{2}$/);
  if (yearOnly) return `Ejercicio ${yearOnly[0]}`;
  return cleaned;
}

function formatEjerciciosSeparated(raw) {
  const parts = splitEjercicios(raw).map(formatEjercicioLabel).filter(Boolean);
  if (parts.length === 0) return "Sin ejercicios";
  // Una línea por ejercicio: "- Ejercicio 2025"
  return parts.map((p) => `- ${p}`).join("\n");
}

function basePillHtml(label, detail, contab, count = 0) {
  const tip = escapeAttr(`Clic para ver ejercicios\n${detail}`);
  const cls = contab
    ? "borrado-base-pill contab has-detail"
    : "borrado-base-pill has-detail";
  const n = Number(count) > 0 ? Number(count) : 0;
  const countHtml = n > 0
    ? `<span class="borrado-base-cg-count" aria-hidden="true">${n}</span>`
    : "";
  return `<span class="borrado-base-cg"><button type="button" class="${cls}" title="${tip}" aria-label="Ver ejercicios de ${escapeAttr(label)}" aria-haspopup="dialog" data-borrado-base-label="${escapeAttr(label)}" data-borrado-base-detail="${escapeAttr(detail)}"><span class="borrado-base-pill-label">${escapeHtml(label)}</span><span class="borrado-base-pill-action" aria-hidden="true">ver</span></button>${countHtml}</span>`;
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
  if (title) {
    const raw = String(label || "").trim();
    title.textContent = raw === "CG" ? "Contabilidad General" : (raw || "Base");
  }
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
    row.innerHTML = `<td colspan="10">No hay solicitudes con ese filtro.</td>`;
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
  const { nota } = parseAclaracion(item.aclaracion);
  const hasNota = !!String(nota || "").trim();
  const hasAclaracion = !!String(item.aclaracion || "").trim();
  const partial = !!(item.listo && item.aclaracion && /✗/.test(String(item.aclaracion)));
  if (partial) row.classList.add("borrado-row-partial");
  else if (item.listo && hasNota) row.classList.add("borrado-row-listo-nota");
  else if (item.listo) row.classList.add("borrado-row-listo");
  else if (hasAclaracion) row.classList.add("borrado-row-aclaracion");

  const nro = String(item.nroEmpresa || "").trim();
  const nombre = String(item.nombreEmpresa || "").trim();
  const cuit = String(item.cuit || "").trim();
  const cuitFmt = formatCuit(cuit);
  const cliente = String(item.nroCliente || "").trim();
  const caso = String(item.nroCaso || "").trim();
  const aclaracion = String(item.aclaracion || "").trim();
  const empresaLabel = nro && nombre ? `[${nro}] ${nombre}` : (nro ? `[${nro}]` : (nombre || "—"));
  const copyBtn = (value, kind) => {
    if (!value || !canConfirm) return escapeHtml(value || "—");
    const label = kind === "caso" ? "caso" : "cliente";
    return `<button type="button" class="borrado-cliente-copy" data-borrado-copy-value="${escapeHtml(value)}" data-borrado-copy-kind="${label}" title="Clic para copiar N° de ${label}">
            <span class="borrado-cliente-copy-icon" aria-hidden="true">📋</span>
            <span class="borrado-cliente-copy-text">${escapeHtml(value)}</span>
            <span class="borrado-cliente-copy-hint" aria-hidden="true">copiar</span>
          </button>`;
  };
  const allowCopy = isDetalleSalesforce(item) || canConfirm;
  const casoCell = !caso ? "—" : allowCopy ? copyBtn(caso, "caso") : escapeHtml(caso);
  const clienteCell = !cliente ? "—" : allowCopy ? copyBtn(cliente, "cliente") : escapeHtml(cliente);
  row.innerHTML = `
    <td class="borrado-col-fecha" title="${escapeHtml(item.fechaSolicitud || "")}">${escapeHtml(formatFecha(item.fechaSolicitud))}</td>
    <td class="borrado-col-caso" title="${escapeHtml(caso)}">${casoCell}</td>
    <td class="borrado-col-cliente" title="${escapeHtml(cliente)}">${clienteCell}</td>
    <td class="borrado-col-empresa" title="${escapeHtml(empresaLabel)}">
      <span class="borrado-empresa-inline">${escapeHtml(empresaLabel)}</span>
    </td>
    <td class="borrado-col-cuit" title="${escapeHtml(cuit || "")}">${escapeHtml(cuitFmt)}</td>
    <td class="borrado-col-bases">${formatBasesPills(item)}</td>
    <td class="borrado-col-solicitante">${escapeHtml(item.solicitadoPorNombre || item.solicitadoPorEmail || "")}</td>
    <td class="borrado-col-listo">${formatEstadoCell(item)}</td>
    <td class="borrado-col-aclaracion">${formatAclaracionCell(aclaracion)}</td>
    <td class="borrado-col-confirmado" title="${escapeAttr(item.confirmadoPorNombre || "")}">${formatGestionadoPorCell(item)}</td>
  `;

  row.querySelectorAll("[data-borrado-copy-value]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const value = btn.getAttribute("data-borrado-copy-value") || "";
      void copyClienteText(value, btn);
    });
  });

  row.addEventListener("click", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("[data-borrado-copy-value]")) return;
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
    if (e.target.closest("button.borrado-base-pill, [data-borrado-copy-value]")) return;
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

function aclaracionWithoutResultado(item) {
  const { nota } = parseAclaracion(item?.aclaracion);
  return String(nota || "").trim() || null;
}

async function unsetListo(item) {
  const aclaracion = aclaracionWithoutResultado(item);
  const patch = { listo: false };
  if (aclaracion) patch.aclaracion = aclaracion;
  else patch.clearAclaracion = true;
  await patchItem(item.id, patch);
}

async function toggleListoByDoubleClick(item) {
  try {
    if (item.listo) {
      await unsetListo(item);
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
  const sf = isDetalleSalesforce(item);

  wrapIva?.classList.toggle("hidden", !sf && !item.iva);
  wrapSj?.classList.toggle("hidden", !sf && !item.sueldos);
  wrapCg?.classList.toggle("hidden", !sf && !item.contabilidad);
  if (chkIva) chkIva.checked = sf ? false : !!item.iva;
  if (chkSj) chkSj.checked = sf ? false : !!item.sueldos;
  if (chkCg) chkCg.checked = sf ? false : !!item.contabilidad;

  document.getElementById("borrado-listo-hint")?.classList.toggle("hidden", sf);
  document.getElementById("borrado-listo-salesforce-hint")?.classList.toggle("hidden", !sf);
  overlay?.classList.toggle("is-salesforce", sf);
  overlay?.classList.remove("hidden");
  overlay?.setAttribute("aria-hidden", "false");
  document.getElementById("borrado-listo-confirm")?.focus();
}

function hideListoModal() {
  pendingListoId = null;
  const overlay = document.getElementById("borrado-listo-overlay");
  overlay?.classList.add("hidden");
  overlay?.classList.remove("is-salesforce");
  overlay?.setAttribute("aria-hidden", "true");
  document.getElementById("borrado-listo-hint")?.classList.remove("hidden");
  document.getElementById("borrado-listo-salesforce-hint")?.classList.add("hidden");
}

async function confirmListoModal() {
  if (!pendingListoId) return;
  const item = items.find((x) => x.id === pendingListoId);
  if (!item) {
    hideListoModal();
    return;
  }

  const sf = isDetalleSalesforce(item);
  const done = sf
    ? {
      iva: !!document.getElementById("borrado-listo-iva")?.checked,
      sueldos: !!document.getElementById("borrado-listo-sueldos")?.checked,
      contabilidad: !!document.getElementById("borrado-listo-contabilidad")?.checked,
    }
    : {
      iva: !!item.iva && !!document.getElementById("borrado-listo-iva")?.checked,
      sueldos: !!item.sueldos && !!document.getElementById("borrado-listo-sueldos")?.checked,
      contabilidad: !!item.contabilidad && !!document.getElementById("borrado-listo-contabilidad")?.checked,
    };
  const summary = sf ? buildListoSummarySalesforce(done) : buildListoSummary(item, done);
  const { nota } = parseAclaracion(item.aclaracion);
  const notaFinal = sf ? DETALLE_SALESFORCE_NOMBRE : nota;
  const aclaracion = composeAclaracion(summary, notaFinal);

  try {
    await patchItem(pendingListoId, { listo: true, aclaracion });
    hideListoModal();
    setStatus(`Confirmado: ${summary}`);
    await reloadList();
    notifyBorradoChanged();
  } catch (err) {
    setStatus(err?.message || "No se pudo actualizar.", true);
  }
}

/** Resumen al confirmar solicitudes Salesforce: siempre IVA, SJ y CG. */
function buildListoSummarySalesforce(done) {
  const parts = [
    { label: "IVA", ok: !!done.iva },
    { label: "SJ", ok: !!done.sueldos },
    { label: "CG", ok: !!done.contabilidad },
  ];
  const allOk = parts.every((p) => p.ok);
  if (allOk) return `Listo ${parts.map((p) => p.label).join(", ")}`;
  return parts.map((p) => `${p.ok ? "✓" : "✗"} ${p.label}`).join(" · ");
}

/** Resumen al confirmar: "Listo IVA, SJ, CG" o "✓ IVA · ✗ SJ · ✓ CG". */
function buildListoSummary(item, done) {
  const parts = [];
  if (item.iva) parts.push({ label: "IVA", ok: !!done.iva });
  if (item.sueldos) parts.push({ label: "SJ", ok: !!done.sueldos });
  if (item.contabilidad) parts.push({ label: "CG", ok: !!done.contabilidad });
  if (!parts.length) return "Listo";

  const allOk = parts.every((p) => p.ok);
  if (allOk) return `Listo ${parts.map((p) => p.label).join(", ")}`;
  return parts.map((p) => `${p.ok ? "✓" : "✗"} ${p.label}`).join(" · ");
}

const ACLARACION_SEP = "\n---\n";

function isResultadoAclaracion(text) {
  const t = String(text || "").trim();
  return /^Listo\b/i.test(t) || /[✓✗]/.test(t);
}

/** Separa resultado de bases (checks) y observación libre. */
function parseAclaracion(raw) {
  const text = String(raw || "").trim();
  if (!text) return { resultado: "", nota: "" };

  if (text.includes(ACLARACION_SEP.trim()) || text.includes("\n---\n")) {
    const idx = text.indexOf("---");
    if (idx >= 0) {
      const before = text.slice(0, idx).replace(/\n+$/, "").trim();
      const after = text.slice(idx + 3).replace(/^\n+/, "").trim();
      return { resultado: before, nota: after };
    }
  }

  if (isResultadoAclaracion(text)) {
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1 && isResultadoAclaracion(lines[0]) && !isResultadoAclaracion(lines.slice(1).join(" "))) {
      return { resultado: lines[0], nota: lines.slice(1).join("\n") };
    }
    return { resultado: text, nota: "" };
  }

  return { resultado: "", nota: text };
}

function composeAclaracion(resultado, nota) {
  const r = String(resultado || "").trim();
  const n = String(nota || "").trim();
  if (r && n) return `${r}${ACLARACION_SEP}${n}`;
  return r || n || null;
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

function formatCuit(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "—";
  if (digits.length === 11) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  }
  return String(raw || "").trim() || "—";
}

function isPartialListo(item) {
  if (!item?.listo) return false;
  const { resultado } = parseAclaracion(item.aclaracion);
  return /✗/.test(String(resultado || ""));
}

function formatGestionadoPorCell(item) {
  const nombre = String(item.confirmadoPorNombre || "").trim();
  const gestionado = !!item?.listo || !!String(item?.aclaracion || "").trim();
  if (!gestionado) return "—";
  return escapeHtml(nombre || "—");
}

function formatEstadoCell(item) {
  const { resultado, nota } = parseAclaracion(item.aclaracion);
  if (item.listo) {
    if (isPartialListo(item)) {
      return '<span class="borrado-pill partial" title="Algunas bases quedaron pendientes">Parcial</span>';
    }
    if (String(nota || "").trim()) {
      return '<span class="borrado-pill ok-note" title="Eliminada con observación">Eliminada · nota</span>';
    }
    return '<span class="borrado-pill ok" title="Bases eliminadas / verificado">Eliminada</span>';
  }
  if (!resultado && !nota) {
    return '<span class="borrado-estado-pending" title="Pendiente de confirmación">Pendiente</span>';
  }
  return '<span class="borrado-pill note" title="Con observación">Nota</span>';
}

function formatResultadoHtml(resultado) {
  const raw = String(resultado || "").trim();
  if (!raw) return "";
  if (/[✓✗]/.test(raw)) {
    const html = escapeHtml(raw)
      .replace(/✓/g, '<span class="borrado-mark-ok" aria-hidden="true">✓</span>')
      .replace(/✗/g, '<span class="borrado-mark-no" aria-hidden="true">✗</span>');
    return `<span class="borrado-aclaracion-full borrado-aclaracion-marks">${html}</span>`;
  }
  if (/^Listo\b/i.test(raw)) {
    return `<span class="borrado-aclaracion-full borrado-aclaracion-listo">${escapeHtml(raw)}</span>`;
  }
  return `<span class="borrado-aclaracion-full">${escapeHtml(raw)}</span>`;
}

function shouldAclaracionUsePill(text) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  if (/[✓✗]/.test(raw)) return false;
  if (/^Listo\b/i.test(raw) && raw.length < 60) return false;
  return raw.length > 36 || raw.includes("\n");
}

function formatAclaracionNotaPill(label, detail) {
  const text = String(detail || "").trim();
  if (!text) return "";
  const tip = text.length > 80 ? `${text.slice(0, 80)}…` : text;
  return `<span class="borrado-base-cg"><button type="button" class="borrado-base-pill has-detail borrado-aclaracion-pill" title="${escapeAttr(tip)}" aria-label="Ver ${escapeAttr(label)}" aria-haspopup="dialog" data-borrado-base-label="${escapeAttr(label)}" data-borrado-base-detail="${escapeAttr(text)}"><span class="borrado-base-pill-label">${escapeHtml(label)}</span><span class="borrado-base-pill-action" aria-hidden="true">ver</span></button></span>`;
}

function formatAclaracionCell(text) {
  const { resultado, nota } = parseAclaracion(text);
  if (!resultado && !nota) return "—";
  const parts = [];
  if (resultado) {
    if (shouldAclaracionUsePill(resultado)) {
      parts.push(formatAclaracionNotaPill("Aclaración", resultado));
    } else {
      parts.push(formatResultadoHtml(resultado));
    }
  }
  if (nota) parts.push(formatAclaracionNotaPill("Observación", nota));
  return `<div class="borrado-aclaracion-stack">${parts.join("")}</div>`;
}

function showCtx(x, y, item) {
  const menu = document.getElementById("borrado-ctx");
  if (!menu) return;

  const confirm = canConfirm;

  menu.querySelectorAll("[data-borrado-ctx]").forEach((btn) => {
    const action = btn.getAttribute("data-borrado-ctx");
    let show = false;
    if (action === "editar" || action === "eliminar") show = confirm || canOwnerMutate(item);
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
      if (!canConfirm && !canOwnerMutate(item)) {
        setStatus("Solo se puede editar en estado pendiente.", true);
        return;
      }
      openEditModal(item);
      return;
    }
    if (action === "listo") {
      openListoModal(item);
      return;
    } else if (action === "unlisto") {
      await unsetListo(item);
    } else if (action === "aclaracion-manual") {
      openNoteModal(item);
      return;
    } else if (action === "clear-aclaracion") {
      const { resultado } = parseAclaracion(item.aclaracion);
      if (resultado) await patchItem(selectedId, { aclaracion: resultado });
      else await patchItem(selectedId, { clearAclaracion: true });
    } else if (action === "eliminar") {
      if (!canConfirm && !canOwnerMutate(item)) {
        setStatus("Solo se puede eliminar en estado pendiente.", true);
        return;
      }
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
  const salesforce = document.getElementById("borrado-edit-salesforce");
  const sf = isDetalleSalesforce(item);
  if (caso) caso.value = item.nroCaso || "";
  if (cliente) cliente.value = item.nroCliente || "";
  if (empresa) empresa.value = sf ? "" : (item.nroEmpresa || "");
  if (nombre) nombre.value = sf ? "" : (item.nombreEmpresa || "");
  if (cuitInput) cuitInput.value = sf ? "" : (item.cuit || "");
  if (iva) iva.checked = sf ? false : !!item.iva;
  if (sueldos) sueldos.checked = sf ? false : !!item.sueldos;
  if (contabilidad) contabilidad.checked = sf ? false : !!item.contabilidad;
  if (salesforce) salesforce.checked = sf;
  syncEditSalesforceMode();
  if (ejercicios) ejercicios.value = !sf && item.contabilidad ? (item.ejerciciosDetalle || "") : "";
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
  const detalleEnSalesforce = !!document.getElementById("borrado-edit-salesforce")?.checked;
  const nroCaso = document.getElementById("borrado-edit-caso")?.value.trim() || "";
  const nroCliente = document.getElementById("borrado-edit-cliente")?.value.trim() || "";

  if (!nroCaso || !nroCliente) {
    setStatus("Completá caso y cliente.", true);
    return;
  }

  let payload;
  if (detalleEnSalesforce) {
    payload = { nroCaso, nroCliente, detalleEnSalesforce: true };
  } else {
    const nroEmpresa = document.getElementById("borrado-edit-empresa")?.value.trim() || "";
    const nombreEmpresa = document.getElementById("borrado-edit-nombre-empresa")?.value.trim() || "";
    const cuit = document.getElementById("borrado-edit-cuit")?.value.trim() || "";
    const bases = readBasesFromForm("borrado-edit-base");
    const ejerciciosDetalle = document.getElementById("borrado-edit-ejercicios")?.value.trim() || "";

    if (!nroEmpresa || !nombreEmpresa) {
      setStatus("Completá código y nombre de empresa.", true);
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

    payload = {
      nroCaso,
      nroCliente,
      nroEmpresa,
      nombreEmpresa,
      cuit,
      ...bases,
      ejerciciosDetalle: bases.contabilidad ? ejerciciosDetalle : null,
      detalleEnSalesforce: false,
    };
  }

  try {
    const res = await planUserFetch(`/api/planillas/borrado-bases/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
  const { nota } = parseAclaracion(item.aclaracion);
  if (text) text.value = nota || "";
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
  const item = items.find((x) => x.id === selectedId);
  const { resultado } = parseAclaracion(item?.aclaracion);
  const nota = String(document.getElementById("borrado-note-text")?.value || "").trim();
  const aclaracion = composeAclaracion(resultado, nota);
  try {
    if (!aclaracion) {
      await patchItem(selectedId, { clearAclaracion: true });
    } else {
      await patchItem(selectedId, { aclaracion });
    }
    hideNoteModal();
    setStatus("Observación guardada.");
    await reloadList();
    notifyBorradoChanged();
  } catch (err) {
    setStatus(err?.message || "No se pudo guardar la observación.", true);
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
