import { getPlanUserEmail, planUserFetch } from "./plan-user.js";
import {
  canSeeBlanqueoModule as canSeeFromAccess,
  canConfirmBlanqueoModule as canConfirmFromAccess,
  canLoadBlanqueoModule as canLoadFromAccess,
  refreshModuleFlags,
  isSt2SuperAdmin,
  getViewAsProfile,
  isViewingAsProfile,
} from "./module-access.js";
import { notifyBlanqueoChanged } from "./blanqueo-alerts.js";
import { createPlanillasLiveList } from "./planillas-live-list.js";

/**
 * Override: localStorage.setItem("st2-blanqueo-force", "1")
 * o localStorage.setItem("st2-modules-force-all", "1")
 */
const FORCE_KEY = "st2-blanqueo-force";
const TIPOS_POR_PORTAL = {
  OnBalance: ["Blanqueo", "MFA", "Blanqueo + MFA"],
  Onvio: ["Blanqueo", "MFA", "Blanqueo + MFA"],
  PortalCliente: ["Activación", "Cambio de contraseña", "Habilitación de Módulos"],
};
const TIPO_HABILITACION = "Habilitación de Módulos";
const PORTALES = ["OnBalance", "Onvio", "PortalCliente"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

let blanqueoInited = false;
let items = [];
let selectedId = null;
const PREVIEW_LIST_KEY = "st2-blanqueo-preview-list-only";

let canConfirm = false;
let canLoad = true;
let editingId = null;
/** @type {"desc" | "asc"} — por defecto desc: lo más nuevo arriba */
let fechaSortDir = "desc";
let monthFilterTouched = false;
let listLoadGen = 0;
let scrollListToEndOnce = false;

const liveList = createPlanillasLiveList({
  viewId: "planillas-blanqueo",
  reload: (opts) => reloadList(opts),
  isBusy: isBlanqueoUiBusy,
});

export function stopBlanqueoLiveRefresh() {
  liveList.stop();
}

export function canSeeBlanqueoModule(email = getPlanUserEmail()) {
  if (isViewingAsProfile()) return canSeeFromAccess();
  try {
    if (localStorage.getItem(FORCE_KEY) === "1") return true;
  } catch { /* ignore */ }

  if (!String(email || "").trim()) return false;
  return canSeeFromAccess();
}

function canConfirmBlanqueo(email = getPlanUserEmail()) {
  if (isViewingAsProfile()) return canConfirmFromAccess();
  try {
    if (localStorage.getItem(FORCE_KEY) === "1") return true;
  } catch { /* ignore */ }

  if (!String(email || "").trim()) return false;
  return canConfirmFromAccess();
}

function canLoadBlanqueo(email = getPlanUserEmail()) {
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
    canConfirm = canConfirmBlanqueo();
    canLoad = canLoadBlanqueo();
    return;
  }
  canConfirm = !!data.canConfirm || canConfirmBlanqueo();
  canLoad = data.canLoad == null ? canLoadBlanqueo() : !!data.canLoad || isSt2SuperAdmin();
}

function sistemaHidesCommercialModules() {
  const sistema = document.body.dataset.planSistema;
  return sistema === "Legal" || sistema === "Chile";
}

export function syncBlanqueoModuleVisibility() {
  const btn = document.getElementById("plan-modulo-blanqueo");
  if (!btn) return;
  const allowed = canSeeBlanqueoModule() && !sistemaHidesCommercialModules();
  btn.classList.toggle("hidden", !allowed);
  btn.setAttribute("aria-hidden", allowed ? "false" : "true");
}

export function initBlanqueoModule() {
  syncBlanqueoModuleVisibility();
  canConfirm = canConfirmBlanqueo();
  canLoad = canLoadBlanqueo();
  if (blanqueoInited) return;
  blanqueoInited = true;

  document.getElementById("blanqueo-add")?.addEventListener("click", () => {
    void createSolicitud();
  });

  ["blanqueo-caso", "blanqueo-cliente"].forEach((id) => {
    document.getElementById(id)?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void createSolicitud();
      }
    });
  });
  document.getElementById("blanqueo-correos")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target?.classList?.contains("blanqueo-correo-input")) {
      e.preventDefault();
      void createSolicitud();
    }
  });
  document.getElementById("blanqueo-correos")?.addEventListener("click", (e) => {
    if (e.target?.closest?.(".blanqueo-correo-add")) {
      e.preventDefault();
      addCorreoRow();
      return;
    }
    const btn = e.target?.closest?.(".blanqueo-correo-remove");
    if (!btn) return;
    const row = btn.closest(".blanqueo-correo-row");
    row?.remove();
    syncCorreoRows();
  });

  document.getElementById("blanqueo-filter-month")?.addEventListener("change", () => {
    monthFilterTouched = true;
    applyFilters();
  });
  document.getElementById("blanqueo-filter-portal")?.addEventListener("change", () => applyFilters());
  document.getElementById("blanqueo-search")?.addEventListener("input", () => applyFilters());
  document.getElementById("blanqueo-filter-mine")?.addEventListener("change", (e) => {
    const check = e.target;
    if (check) check.dataset.userTouched = "1";
    applyFilters();
  });
  document.getElementById("blanqueo-preview-confirm")?.addEventListener("change", (e) => {
    const on = !!e.target?.checked;
    try {
      sessionStorage.setItem(PREVIEW_LIST_KEY, on ? "1" : "0");
    } catch { /* ignore */ }
    syncLoadFormVisibility();
    setStatus(on
      ? "Vista confirmador: solo listado (ocultá el formulario)."
      : "Formulario de carga visible. Marcá “Vista confirmador” para volver al listado.");
  });
  document.getElementById("blanqueo-th-fecha")?.addEventListener("click", () => {
    fechaSortDir = fechaSortDir === "desc" ? "asc" : "desc";
    syncFechaSortHeader();
    applyFilters();
  });
  syncFechaSortHeader();

  document.getElementById("blanqueo-edit-save")?.addEventListener("click", () => {
    void saveEdit();
  });
  document.getElementById("blanqueo-edit-cancel")?.addEventListener("click", () => hideEditModal());
  document.getElementById("blanqueo-edit-overlay")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) hideEditModal();
  });

  document.getElementById("blanqueo-delete-cancel")?.addEventListener("click", () => hideDeleteModal());
  document.getElementById("blanqueo-delete-confirm")?.addEventListener("click", () => {
    void confirmDeleteModal();
  });
  document.getElementById("blanqueo-delete-overlay")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) hideDeleteModal();
  });

  document.getElementById("blanqueo-note-cancel")?.addEventListener("click", () => hideNoteModal());
  document.getElementById("blanqueo-note-save")?.addEventListener("click", () => {
    void saveNoteModal();
  });
  document.getElementById("blanqueo-note-overlay")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) hideNoteModal();
  });

  document.getElementById("blanqueo-mod-pop-close")?.addEventListener("click", (e) => {
    e.preventDefault();
    hideModPop();
  });
  document.getElementById("blanqueo-aclaracion-pop-close")?.addEventListener("click", (e) => {
    e.preventDefault();
    hideAclaracionPop();
  });
  document.getElementById("blanqueo-aclaracion-pop-copy")?.addEventListener("click", (e) => {
    e.preventDefault();
    void copyAclaracionPopText();
  });
  document.addEventListener("click", (e) => {
    if (e.target?.closest?.("#blanqueo-mod-pop") || e.target?.closest?.(".blanqueo-hab-pill")) return;
    if (e.target?.closest?.("#blanqueo-aclaracion-pop") || e.target?.closest?.(".blanqueo-clave-previa-pill")) return;
    hideModPop();
    hideAclaracionPop();
  });
  document.addEventListener("scroll", () => {
    hideModPop();
    hideAclaracionPop();
  }, true);

  const ctx = document.getElementById("blanqueo-ctx");
  ctx?.addEventListener("click", (e) => {
    e.stopPropagation();
    const btn = e.target.closest("[data-blanqueo-ctx]");
    if (!btn || btn.classList.contains("hidden")) return;
    const action = btn.getAttribute("data-blanqueo-ctx");
    hideCtx();
    void handleCtxAction(action);
  });

  document.addEventListener("click", () => hideCtx());
  document.addEventListener("scroll", () => hideCtx(), true);

  document.getElementById("blanqueo-clave-copy")?.addEventListener("click", () => {
    void copyClaveBlanqueo();
  });

  document.getElementById("blanqueo-portal")?.addEventListener("change", () => {
    syncTipoOptions("blanqueo-tipo", getFormPortal());
    syncClaveVisibility();
    syncModulosField();
  });
  document.getElementById("blanqueo-tipo")?.addEventListener("change", () => syncModulosField());
  document.getElementById("blanqueo-edit-portal")?.addEventListener("change", () => {
    syncTipoOptions("blanqueo-edit-tipo", getEditPortal());
    syncEditModulosField();
  });
  document.getElementById("blanqueo-edit-tipo")?.addEventListener("change", () => syncEditModulosField());

  document.getElementById("blanqueo-export")?.addEventListener("click", () => {
    void exportExcel();
  });
  document.getElementById("blanqueo-import-file")?.addEventListener("change", (e) => {
    const input = e.target;
    const file = input?.files?.[0];
    if (file) void importExcel(file);
    if (input) input.value = "";
  });

  document.addEventListener("st2:planillas-home", () => {
    listLoadGen += 1;
    hideCtx();
    hideEditModal();
    hideDeleteModal();
    hideNoteModal();
    const status = document.getElementById("blanqueo-status");
    if (status) {
      status.classList.add("hidden");
      status.textContent = "";
    }
  });

  syncSolicitanteBadge();
  syncTipoOptions("blanqueo-tipo", getFormPortal());
  syncClaveVisibility();
  syncModulosField();
  syncCorreoRows();
}

export async function openBlanqueoModule() {
  if (!canSeeBlanqueoModule()) return;
  initBlanqueoModule();
  // Usa cache de permisos (evita otro /modules al abrir).
  await refreshModuleFlags();
  canConfirm = canConfirmBlanqueo();
  canLoad = canLoadBlanqueo();
  syncSolicitanteBadge();
  syncMineFilterVisibility();
  syncLoadFormVisibility();
  clearForm();
  monthFilterTouched = false;
  syncTipoOptions("blanqueo-tipo", getFormPortal());
  syncClaveVisibility();
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
    if (v === null || v === "") return true; // por defecto ON
    return v === "1";
  } catch {
    return true;
  }
}

function effectiveCanLoad() {
  if (isPreviewConfirmListOnly()) return false;
  // Confirmadores pueden abrir el form al desmarcar “Vista confirmador”.
  return canLoad || canConfirm;
}

function syncLoadFormVisibility() {
  ensureConfirmViewDefault();
  const showForm = effectiveCanLoad();
  const formPanel = document.querySelector(".blanqueo-form-panel");
  if (formPanel) formPanel.classList.toggle("hidden", !showForm);

  const app = document.querySelector(".blanqueo-app");
  if (app) app.classList.toggle("blanqueo-list-only", !showForm);

  const previewWrap = document.getElementById("blanqueo-preview-confirm-wrap");
  const previewCheck = document.getElementById("blanqueo-preview-confirm");
  // Visible para todo confirmador (también en “ver como”).
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
  const badge = document.getElementById("blanqueo-user-badge");
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
  const wrap = document.getElementById("blanqueo-filter-mine-wrap");
  const check = document.getElementById("blanqueo-filter-mine");
  if (!wrap) return;
  // Quien confirma (admin de blanqueo) siempre ve el listado completo.
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
  const exportBtn = document.getElementById("blanqueo-export");
  if (exportBtn) exportBtn.classList.toggle("hidden", !canConfirm);

  const importWrap = document.getElementById("blanqueo-import-wrap");
  if (importWrap) importWrap.classList.toggle("hidden", !isSt2SuperAdmin() || isViewingAsProfile());

  syncLoadFormVisibility();
}

function displayNameFromEmail(email) {
  const local = String(email || "").split("@")[0] || "";
  const parts = local.split(".").filter(Boolean);
  if (!parts.length) return email;
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

function currentEmail() {
  const viewAs = getViewAsProfile();
  if (viewAs?.email) return String(viewAs.email).trim().toLowerCase();
  return String(getPlanUserEmail() || "").trim().toLowerCase();
}

function isOwner(item) {
  return String(item?.solicitadoPorEmail || "").trim().toLowerCase() === currentEmail();
}

/** Pendiente = sin listo y sin aclaración. Ahí el solicitante puede editar/eliminar. */
function isPendingSolicitud(item) {
  return !item?.listo && !String(item?.aclaracion || "").trim();
}

function canOwnerMutate(item) {
  return isOwner(item) && isPendingSolicitud(item);
}

function setStatus(msg, isError = false) {
  const el = document.getElementById("blanqueo-status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
  el.classList.toggle("is-error", !!isError && !!msg);
}

function clearForm({ keepCaso = false } = {}) {
  const portal = document.getElementById("blanqueo-portal");
  const caso = document.getElementById("blanqueo-caso");
  const cliente = document.getElementById("blanqueo-cliente");
  if (!keepCaso) {
    if (portal) portal.value = "OnBalance";
    if (caso) caso.value = "";
    if (cliente) cliente.value = "";
    syncTipoOptions("blanqueo-tipo", "OnBalance");
  }
  resetCorreoRows();
  clearModulosChecks("blanqueo-modulo");
  syncClaveVisibility();
  syncModulosField();
}

function resetCorreoRows() {
  const wrap = document.getElementById("blanqueo-correos");
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="blanqueo-correo-row">
      <input id="blanqueo-correo" class="blanqueo-correo-input" type="email" autocomplete="off" spellcheck="false"/>
    </div>`;
  syncCorreoRows();
}

function addCorreoRow() {
  const wrap = document.getElementById("blanqueo-correos");
  if (!wrap) return;
  const row = document.createElement("div");
  row.className = "blanqueo-correo-row";
  row.innerHTML = `
    <input class="blanqueo-correo-input" type="email" autocomplete="off" spellcheck="false" placeholder="otro correo…"/>`;
  wrap.appendChild(row);
  syncCorreoRows();
  row.querySelector(".blanqueo-correo-input")?.focus();
}

function syncCorreoRows() {
  const wrap = document.getElementById("blanqueo-correos");
  if (!wrap) return;
  const rows = [...wrap.querySelectorAll(".blanqueo-correo-row")];
  rows.forEach((row, idx) => {
    const input = row.querySelector(".blanqueo-correo-input");
    if (input && idx === 0) input.id = "blanqueo-correo";
    else if (input) input.removeAttribute("id");

    row.querySelectorAll(".blanqueo-correo-add, .blanqueo-correo-remove").forEach((btn) => btn.remove());

    const isLast = idx === rows.length - 1;
    const canRemove = rows.length > 1;

    if (canRemove) {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "blanqueo-correo-remove";
      removeBtn.title = "Quitar";
      removeBtn.setAttribute("aria-label", "Quitar correo");
      removeBtn.textContent = "−";
      row.appendChild(removeBtn);
    }

    if (isLast) {
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "blanqueo-correo-add";
      addBtn.title = "Agregar otro correo del mismo caso";
      addBtn.setAttribute("aria-label", "Agregar otro correo");
      addBtn.textContent = "+";
      row.appendChild(addBtn);
    }
  });
}

function collectCorreos() {
  const wrap = document.getElementById("blanqueo-correos");
  const inputs = wrap
    ? [...wrap.querySelectorAll(".blanqueo-correo-input")]
    : [document.getElementById("blanqueo-correo")].filter(Boolean);
  const seen = new Set();
  const list = [];
  for (const input of inputs) {
    const v = String(input?.value || "").trim().toLowerCase();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    list.push(String(input.value || "").trim());
  }
  return list;
}

function getFormPortal() {
  const value = document.getElementById("blanqueo-portal")?.value.trim() || "OnBalance";
  return PORTALES.includes(value) ? value : "OnBalance";
}

function getEditPortal() {
  const value = document.getElementById("blanqueo-edit-portal")?.value.trim() || "OnBalance";
  return PORTALES.includes(value) ? value : "OnBalance";
}

function tiposForPortal(portal) {
  return TIPOS_POR_PORTAL[portal] || TIPOS_POR_PORTAL.OnBalance;
}

function syncTipoOptions(selectId, portal, preferred = "") {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const tipos = tiposForPortal(portal);
  const current = preferred === "Blanqueo MFA" ? "Blanqueo + MFA" : (preferred || sel.value);
  sel.innerHTML = tipos
    .map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`)
    .join("");
  sel.value = tipos.includes(current) ? current : tipos[0];
}

function isHabilitacionTipo(tipo) {
  return String(tipo || "").trim() === TIPO_HABILITACION;
}

function syncModulosField() {
  const show = getFormPortal() === "PortalCliente" && isHabilitacionTipo(document.getElementById("blanqueo-tipo")?.value);
  const field = document.getElementById("blanqueo-modulos-field");
  field?.classList.toggle("hidden", !show);
  field?.setAttribute("aria-hidden", show ? "false" : "true");
  if (!show) clearModulosChecks("blanqueo-modulo");
}

function syncEditModulosField(selected = null) {
  const show = getEditPortal() === "PortalCliente" && isHabilitacionTipo(document.getElementById("blanqueo-edit-tipo")?.value);
  const field = document.getElementById("blanqueo-edit-modulos-field");
  field?.classList.toggle("hidden", !show);
  field?.setAttribute("aria-hidden", show ? "false" : "true");
  if (!show) {
    clearModulosChecks("blanqueo-edit-modulo");
    return;
  }
  if (selected != null) setModulosChecks("blanqueo-edit-modulo", selected);
}

function clearModulosChecks(name) {
  document.querySelectorAll(`input[name="${name}"]`).forEach((el) => {
    el.checked = false;
  });
}

function setModulosChecks(name, raw) {
  const picked = parseModulos(raw);
  document.querySelectorAll(`input[name="${name}"]`).forEach((el) => {
    el.checked = picked.includes(el.value);
  });
}

function collectModulos(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((el) => el.value);
}

function parseModulos(raw) {
  return String(raw || "")
    .split(/[|,\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatTipoCell(item) {
  const tipo = item.tipoSolicitud || "—";
  if (!isHabilitacionTipo(tipo)) return escapeHtml(tipo);
  const mods = parseModulos(item.modulosDetalle);
  if (!mods.length) return escapeHtml(tipo);
  const n = mods.length;
  const modsJson = escapeAttr(JSON.stringify(mods));
  return `<span class="blanqueo-hab-wrap"><button type="button" class="blanqueo-hab-pill" title="Clic para ver módulos" aria-label="Ver módulos a habilitar" aria-haspopup="dialog" data-blanqueo-mod-list="${modsJson}"><span class="blanqueo-hab-pill-label">Hab. módulos</span><span class="blanqueo-hab-pill-action" aria-hidden="true">ver</span></button><span class="blanqueo-hab-count" aria-hidden="true">${n}</span></span>`;
}

function hideModPop() {
  const pop = document.getElementById("blanqueo-mod-pop");
  if (!pop) return;
  pop.classList.add("hidden");
  pop.setAttribute("aria-hidden", "true");
}

function showModPop(anchor, mods = []) {
  const pop = document.getElementById("blanqueo-mod-pop");
  const list = document.getElementById("blanqueo-mod-pop-list");
  if (!pop || !anchor) return;
  hideCtx();
  hideAclaracionPop();
  const items = Array.isArray(mods) ? mods : parseModulos(mods);
  if (list) {
    list.innerHTML = items.length
      ? items.map((m) => `<li>${escapeHtml(m)}</li>`).join("")
      : "<li>—</li>";
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

function hideAclaracionPop() {
  const pop = document.getElementById("blanqueo-aclaracion-pop");
  if (!pop) return;
  pop.classList.add("hidden");
  pop.setAttribute("aria-hidden", "true");
}

function showAclaracionPop(anchor, detail) {
  const pop = document.getElementById("blanqueo-aclaracion-pop");
  const text = document.getElementById("blanqueo-aclaracion-pop-text");
  const copyBtn = document.getElementById("blanqueo-aclaracion-pop-copy");
  if (!pop || !anchor) return;
  hideCtx();
  hideModPop();
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

async function copyAclaracionPopText() {
  const text = document.getElementById("blanqueo-aclaracion-pop-text")?.textContent || "";
  const btn = document.getElementById("blanqueo-aclaracion-pop-copy");
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

function syncClaveVisibility() {
  const hint = document.getElementById("blanqueo-clave-hint");
  if (!hint) return;
  // Aviso fijo del listado (todos), oculto solo en Legal/Chile.
  const sistema = document.body.dataset.planSistema;
  const hide = sistema === "Legal" || sistema === "Chile";
  hint.classList.toggle("hidden", hide);
  hint.setAttribute("aria-hidden", hide ? "true" : "false");
}

async function createSolicitud() {
  if (!effectiveCanLoad()) {
    setStatus("Tu perfil es solo listado: no podés cargar solicitudes.", true);
    return;
  }
  const portal = getFormPortal();
  const nroCaso = document.getElementById("blanqueo-caso")?.value.trim() || "";
  const nroCliente = document.getElementById("blanqueo-cliente")?.value.trim() || "";
  const correos = collectCorreos();
  const tipoSolicitud = document.getElementById("blanqueo-tipo")?.value.trim() || "";
  const modulos = collectModulos("blanqueo-modulo");

  if (!nroCaso || !nroCliente || !correos.length) {
    setStatus("Completá caso, cliente y al menos un correo.", true);
    return;
  }
  if (!tiposForPortal(portal).includes(tipoSolicitud)) {
    setStatus("Elegí un tipo de solicitud válido para esa plataforma.", true);
    return;
  }
  if (isHabilitacionTipo(tipoSolicitud) && !modulos.length) {
    setStatus("Elegí al menos un módulo a habilitar.", true);
    return;
  }

  setStatus(correos.length > 1 ? `Guardando ${correos.length} correos…` : "Guardando…");
  try {
    let ok = 0;
    for (const correo of correos) {
      const res = await planUserFetch("/api/planillas/blanqueo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portal,
          nroCaso,
          nroCliente,
          correo,
          tipoSolicitud,
          modulosDetalle: isHabilitacionTipo(tipoSolicitud) ? modulos.join("|") : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.detail || `Error ${res.status}`);
      ok += 1;
    }
    // Mismo caso: limpio solo correos; dejo caso/cliente/plataforma/tipo.
    clearForm({ keepCaso: true });
    setStatus(ok === 1 ? "Solicitud agregada." : `${ok} solicitudes agregadas.`);
    scrollListToEndOnce = true;
    await reloadList();
    notifyBlanqueoChanged();
    document.getElementById("blanqueo-correo")?.focus();
  } catch (err) {
    setStatus(err?.message || "No se pudo guardar.", true);
  }
}

async function reloadList({ silent = false } = {}) {
  const gen = ++listLoadGen;
  try {
    const res = await planUserFetch("/api/planillas/blanqueo");
    if (gen !== listLoadGen) return;
    const data = await res.json().catch(() => ({}));
    if (gen !== listLoadGen) return;
    if (res.status === 429) {
      throw new Error("Demasiadas solicitudes (429). Esperá unos segundos y reabrí Blanqueo.");
    }
    if (!res.ok) throw new Error(data.error || data.detail || `Error ${res.status}`);
    const nextItems = (Array.isArray(data.items) ? data.items : []).map(normalizeBlanqueoItem);
    const changed = listFingerprint(nextItems) !== listFingerprint(items);
    items = nextItems;
    applyEffectiveAccess(data);
    syncMineFilterVisibility();
    syncLoadFormVisibility();
    syncClaveUi(data.claveBlanqueo);
    rebuildMonthOptions();
    if (!silent || changed) applyFilters();
  } catch (err) {
    if (gen !== listLoadGen) return;
    // No vaciar el listado si falló un refresh en background; solo avisar.
    if (!items.length) applyFilters();
    if (silent) return;
    const msg = String(err?.message || "");
    setStatus(
      msg.includes("429")
        ? "Cloudflare limitó las peticiones. Esperá 20–40 s y volvé a entrar."
        : (msg || "No se pudo cargar el listado."),
      true,
    );
  }
}

function listFingerprint(list) {
  return list.map((i) => `${i.id}:${i.listo ? 1 : 0}:${i.aclaracion || ""}:${i.confirmadoPorNombre || ""}`).join("|");
}

function isBlanqueoUiBusy() {
  if (editingId) return true;
  for (const id of ["blanqueo-edit-overlay", "blanqueo-note-overlay", "blanqueo-delete-overlay"]) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains("hidden")) return true;
  }
  return false;
}

function syncClaveUi(clave) {
  const btn = document.getElementById("blanqueo-clave-copy");
  if (!btn) return;
  const value = String(clave || btn.textContent || "Sueldo.2026").trim() || "Sueldo.2026";
  btn.textContent = value;
  btn.dataset.clave = value;
  syncClaveVisibility();
}

async function copyClaveBlanqueo() {
  const btn = document.getElementById("blanqueo-clave-copy");
  const value = btn?.dataset.clave || btn?.textContent?.trim() || "Sueldo.2026";
  await copyText(value, {
    el: btn,
    attr: "data-copy-hint",
    copiedText: "Copiado",
    restoreText: "Clic para copiar",
  });
}

function flashCopied(el, { hintSelector, copiedText = "Copiado", restoreText = "Copiar", attr } = {}) {
  if (!el) return;
  el.classList.add("is-copied");
  if (attr) el.setAttribute(attr, copiedText);
  const hint = hintSelector ? el.querySelector(hintSelector) : null;
  if (hint) hint.textContent = copiedText;
  const prev = Number(el.dataset.copyFlashTimer || 0);
  if (prev) window.clearTimeout(prev);
  const timer = window.setTimeout(() => {
    el.classList.remove("is-copied");
    if (attr) el.setAttribute(attr, restoreText);
    if (hint) hint.textContent = restoreText;
    delete el.dataset.copyFlashTimer;
  }, 1600);
  el.dataset.copyFlashTimer = String(timer);
}

async function copyText(value, flash) {
  try {
    await navigator.clipboard.writeText(value);
    if (flash?.el) flashCopied(flash.el, flash);
    else setStatus("Copiado.");
  } catch {
    setStatus(String(value || ""), false);
  }
}

async function exportExcel() {
  if (!canConfirm) return;
  setStatus("Generando Excel…");
  try {
    const res = await planUserFetch("/api/planillas/blanqueo/export");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.detail || `Error ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `blanqueo-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus("Excel exportado (solicitudes + resumen mensual).");
  } catch (err) {
    setStatus(err?.message || "No se pudo exportar.", true);
  }
}

async function importExcel(file) {
  if (!isSt2SuperAdmin() || !file) return;
  setStatus(`Importando ${file.name}…`);
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await planUserFetch("/api/planillas/blanqueo/import", {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const details = Array.isArray(data.details) && data.details.length
        ? ` ${data.details.slice(0, 3).join(" · ")}`
        : "";
      throw new Error((data.error || data.detail || `Error ${res.status}`) + details);
    }
    await reloadList();
    const parts = [`Importadas ${data.inserted || 0}`];
    if (data.skippedDuplicates) parts.push(`${data.skippedDuplicates} ya existían`);
    if (Array.isArray(data.pendingAgents) && data.pendingAgents.length) {
      const names = data.pendingAgents.slice(0, 3).join(", ");
      const more = data.pendingAgents.length > 3 ? ` +${data.pendingAgents.length - 3}` : "";
      parts.push(`${data.pendingAgents.length} sin registro aún (${names}${more})`);
    }
    if (data.skippedErrors) parts.push(`${data.skippedErrors} con error`);
    setStatus(`${parts.join(" · ")}.`);
  } catch (err) {
    setStatus(err?.message || "No se pudo importar.", true);
  }
}

function rebuildMonthOptions() {
  const sel = document.getElementById("blanqueo-filter-month");
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
  // Acepta yyyy-MM, yyyy-MM-dd y variantes con hora.
  const isoMatch = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?(?:[T\s].*)?/.exec(raw);
  if (isoMatch) {
    return `${isoMatch[1]}-${String(Number(isoMatch[2])).padStart(2, "0")}`;
  }
  const dmy = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(raw);
  if (dmy) {
    return `${dmy[3]}-${String(Number(dmy[2])).padStart(2, "0")}`;
  }
  return "";
}

function normalizeBlanqueoItem(raw) {
  const src = raw || {};
  return {
    id: src.id ?? src.Id ?? 0,
    portal: src.portal ?? src.Portal ?? "PortalCliente",
    nroCaso: src.nroCaso ?? src.NroCaso ?? "",
    nroCliente: src.nroCliente ?? src.NroCliente ?? "",
    correo: src.correo ?? src.Correo ?? "",
    fechaSolicitud: src.fechaSolicitud ?? src.FechaSolicitud ?? "",
    fechaCreacion: src.fechaCreacion ?? src.FechaCreacion ?? "",
    solicitadoPorEmail: src.solicitadoPorEmail ?? src.SolicitadoPorEmail ?? "",
    solicitadoPorNombre: src.solicitadoPorNombre ?? src.SolicitadoPorNombre ?? "",
    tipoSolicitud: src.tipoSolicitud ?? src.TipoSolicitud ?? "",
    modulosDetalle: src.modulosDetalle ?? src.ModulosDetalle ?? null,
    listo: !!(src.listo ?? src.Listo),
    aclaracion: src.aclaracion ?? src.Aclaracion ?? null,
    confirmadoPorNombre: src.confirmadoPorNombre ?? src.ConfirmadoPorNombre ?? null,
  };
}

function getFilteredItems() {
  const month = document.getElementById("blanqueo-filter-month")?.value || "all";
  const portal = document.getElementById("blanqueo-filter-portal")?.value || "all";
  const q = String(document.getElementById("blanqueo-search")?.value || "").trim().toLowerCase();
  const onlyMine = !canConfirm && !!document.getElementById("blanqueo-filter-mine")?.checked;
  const me = currentEmail();

  const filtered = items.filter((item) => {
    if (onlyMine && String(item.solicitadoPorEmail || "").trim().toLowerCase() !== me) return false;
    if (portal !== "all" && (item.portal || "PortalCliente") !== portal) return false;
    if (month !== "all" && monthKeyFromIso(item.fechaSolicitud) !== month) return false;
    if (q) {
      const hay = [
        item.correo,
        item.nroCaso,
        item.nroCliente,
        item.solicitadoPorNombre,
        item.aclaracion,
        item.tipoSolicitud,
        item.modulosDetalle,
        portalLabel(item.portal),
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
    // Dentro del mismo día: por hora de carga / id → lo más nuevo al final en asc.
    const ca = String(a.fechaCreacion || "");
    const cb = String(b.fechaCreacion || "");
    if (ca && cb && ca !== cb) return ca < cb ? -dir : dir;
    return ((a.id || 0) - (b.id || 0)) * dir;
  });
  return filtered;
}

function syncFechaSortHeader() {
  const th = document.getElementById("blanqueo-th-fecha");
  if (!th) return;
  const mark = th.querySelector(".blanqueo-sort-mark");
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
  const count = document.getElementById("blanqueo-count");
  if (count) count.textContent = filtered.length ? `(${filtered.length})` : "";
  syncMonthStat(filtered);
  const statusEl = document.getElementById("blanqueo-status");
  if (statusEl && !statusEl.classList.contains("is-error")) {
    setStatus(filtered.length ? `${filtered.length} solicitud(es).` : "Sin solicitudes con ese filtro.");
  }
}

function syncMonthStat(filtered) {
  const el = document.getElementById("blanqueo-month-stat");
  if (!el) return;
  const list = Array.isArray(filtered) ? filtered : getFilteredItems();
  const monthSel = document.getElementById("blanqueo-filter-month")?.value || "all";
  const prefix = monthSel === "all" ? "Todos los meses" : monthLabelFromKey(monthSel);
  const n = list.length;
  const listos = list.filter((item) => item.listo).length;
  const noReg = list.filter((item) => isNoRegistrado(item.aclaracion)).length;
  const total = n === 1 ? `${prefix}: 1 blanqueo` : `${prefix}: ${n} blanqueos`;
  const listosTxt = listos === 1 ? "1 listo" : `${listos} listos`;
  const noRegTxt = noReg === 1 ? "1 no registrado" : `${noReg} no registrados`;
  el.textContent = `${total} · ${listosTxt} · ${noRegTxt}`;
  el.title = monthSel === "all"
    ? "Totales con el filtro actual (todos los meses)"
    : `Cantidad en ${prefix} con el filtro actual`;
}

function monthLabelFromKey(key) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(key || ""));
  if (!m) return key;
  const idx = Number(m[2]) - 1;
  return `${MONTHS[idx] || m[2]} ${m[1]}`;
}

function renderTable(filtered) {
  const tbody = document.getElementById("blanqueo-table-body");
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
    const wrap = document.querySelector(".blanqueo-table-wrap");
    if (wrap) requestAnimationFrame(() => { wrap.scrollTop = 0; });
  } else if (scrollListToEndOnce) {
    scrollListToEndOnce = false;
    const wrap = document.querySelector(".blanqueo-table-wrap");
    if (wrap) requestAnimationFrame(() => { wrap.scrollTop = wrap.scrollHeight; });
  }
}

function buildRow(item) {
  const row = document.createElement("tr");
  if (selectedId === item.id) row.classList.add("selected");
  const hasAclaracion = !!String(item.aclaracion || "").trim();
  const noReg = isNoRegistrado(item.aclaracion) && !item.listo;
  if (noReg) row.classList.add("blanqueo-row-noreg");
  else if (item.listo && hasAclaracion) row.classList.add("blanqueo-row-listo-nota");
  else if (item.listo) row.classList.add("blanqueo-row-listo");
  else if (hasAclaracion) row.classList.add("blanqueo-row-aclaracion");

  const mailCell = canConfirm
    ? `<td class="blanqueo-col-correo">
        <button type="button" class="blanqueo-mail-copy" data-blanqueo-copy-mail="${escapeHtml(item.correo)}" title="Clic para copiar el correo">
          <span class="blanqueo-mail-copy-icon" aria-hidden="true">📋</span>
          <span class="blanqueo-mail-copy-text">${escapeHtml(item.correo)}</span>
          <span class="blanqueo-mail-copy-hint" aria-hidden="true">copiar</span>
        </button>
      </td>`
    : `<td class="blanqueo-col-correo" title="${escapeHtml(item.correo)}">${escapeHtml(item.correo)}</td>`;

  const estadoAclaracionCells = `<td class="blanqueo-col-listo">${formatEstadoCell(item)}</td>
    <td class="blanqueo-col-aclaracion">${formatAclaracionCell(item)}</td>`;

  row.innerHTML = `
    <td class="blanqueo-col-fecha" title="${escapeHtml(item.fechaSolicitud || "")}">${escapeHtml(formatFecha(item.fechaSolicitud))}</td>
    <td class="blanqueo-col-portal" title="${escapeHtml(portalLabel(item.portal))}">${escapeHtml(portalShort(item.portal))}</td>
    <td class="blanqueo-col-caso">${escapeHtml(item.nroCaso || "—")}</td>
    <td class="blanqueo-col-cliente">${escapeHtml(item.nroCliente || "—")}</td>
    ${mailCell}
    <td class="blanqueo-col-solicitante">${escapeHtml(item.solicitadoPorNombre || item.solicitadoPorEmail || "")}</td>
    <td class="blanqueo-col-tipo">${formatTipoCell(item)}</td>
    ${estadoAclaracionCells}
    <td class="blanqueo-col-confirmado" title="${escapeAttr(item.confirmadoPorNombre || "")}">${formatGestionadoPorCell(item)}</td>
  `;

  row.querySelector(".blanqueo-hab-pill")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const btn = e.currentTarget;
    let mods = [];
    try {
      mods = JSON.parse(btn.getAttribute("data-blanqueo-mod-list") || "[]");
    } catch {
      mods = [];
    }
    showModPop(btn, mods);
  });

  row.querySelector(".blanqueo-clave-previa-pill")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const btn = e.currentTarget;
    showAclaracionPop(btn, btn.getAttribute("data-blanqueo-aclaracion-detail") || "");
  });

  row.querySelector("[data-blanqueo-copy-mail]")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const btn = e.currentTarget;
    const mail = btn.getAttribute("data-blanqueo-copy-mail") || item.correo;
    void copyText(mail, {
      el: btn,
      hintSelector: ".blanqueo-mail-copy-hint",
      copiedText: "copiado",
      restoreText: "copiar",
    });
  });

  row.querySelector("[data-blanqueo-copy-clave]")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const btn = e.currentTarget;
    const clave = btn.getAttribute("data-blanqueo-copy-clave") || claveDefault();
    const action = btn.querySelector(".blanqueo-clave-pill-action");
    void copyText(clave, {
      el: btn,
      hintSelector: ".blanqueo-clave-pill-action",
      copiedText: "Copiado",
      restoreText: "Copiar",
    });
    if (action) action.textContent = "Copiado";
  });

  row.addEventListener("click", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("[data-blanqueo-copy-mail], [data-blanqueo-copy-clave], .blanqueo-hab-pill, .blanqueo-clave-previa-pill")) return;
    selectedId = item.id;
    applyFilters();
  });

  row.addEventListener("dblclick", (e) => {
    e.preventDefault();
    if (e.target.closest("[data-blanqueo-copy-mail], [data-blanqueo-copy-clave], .blanqueo-hab-pill, .blanqueo-clave-previa-pill")) return;
    selectedId = item.id;
    applyFilters();
    if (!canConfirm) return;
    void toggleListoByDoubleClick(item);
  });

  row.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    selectedId = item.id;
    applyFilters();
    showCtx(e.clientX, e.clientY, item);
  });

  return row;
}

async function toggleListoByDoubleClick(item) {
  try {
    const nextListo = !item.listo;
    const body = nextListo
      ? { listo: true, ...(isNoRegistrado(item.aclaracion) ? { clearAclaracion: true } : {}) }
      : { listo: false };
    await patchItem(item.id, body);
    setStatus(nextListo ? "Marcado como listo." : "Se quitó el listo.");
    await reloadList();
    notifyBlanqueoChanged();
  } catch (err) {
    setStatus(err?.message || "No se pudo actualizar.", true);
  }
}

function portalLabel(portal) {
  if (portal === "OnBalance") return "On Balance";
  if (portal === "Onvio") return "ONVIO";
  return "Portal Cliente";
}

function portalShort(portal) {
  if (portal === "OnBalance") return "OB";
  if (portal === "Onvio") return "ONVIO";
  return "Portal";
}

function formatFecha(iso) {
  const raw = String(iso || "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return raw || "—";
  const day = Number(m[3]);
  const month = MONTHS[Number(m[2]) - 1] || m[2];
  const year = Number(m[1]);
  const nowY = new Date().getFullYear();
  // Compacto: 13-ago · si es otro año, 13-ago-25
  if (year === nowY) return `${day}-${month}`;
  return `${day}-${month}-${String(year).slice(-2)}`;
}

function claveDefault() {
  const btn = document.getElementById("blanqueo-clave-copy");
  return String(btn?.dataset.clave || btn?.textContent || "Sueldo.2026").trim() || "Sueldo.2026";
}

function isBlanqueoConClave(item) {
  return /blanqueo/i.test(String(item?.tipoSolicitud || ""));
}

const BLANQUEO_CLAVE_PREVIA = "Sueldo.20261";

/** Pastilla con la clave: punteada, “Copiar” al hover, clic copia. */
function formatClaveCopyPill(clave, title = "Clic para copiar la clave", { custom = false } = {}) {
  const value = String(clave || "").trim();
  if (!value) return "";
  const isCustom = custom || value.toLowerCase() !== claveDefault().toLowerCase();
  const cls = isCustom ? "blanqueo-clave-pill blanqueo-clave-pill--custom" : "blanqueo-clave-pill";
  return `<button type="button" class="${cls}" data-blanqueo-copy-clave="${escapeHtml(value)}" title="${escapeHtml(title)}" aria-label="Copiar clave ${escapeHtml(value)}">
    <code class="blanqueo-clave-pill-label">${escapeHtml(value)}</code>
    <span class="blanqueo-clave-pill-action" aria-hidden="true">Copiar</span>
  </button>`;
}

function aclaracionTieneClavePrevia(aclaracion) {
  return String(aclaracion || "").toLowerCase().includes(BLANQUEO_CLAVE_PREVIA.toLowerCase());
}

function aclaracionPreviaDetalle(aclaracion) {
  const real = String(aclaracion || "").trim();
  if (!real || real.toLowerCase() === BLANQUEO_CLAVE_PREVIA.toLowerCase()) {
    return "Ya fue blanqueada anteriormente con esta clave.";
  }
  return real;
}

function formatClavePreviaPill(aclaracion) {
  const detail = aclaracionPreviaDetalle(aclaracion);
  const tip = "Clic para ver la aclaración";
  return `<button type="button" class="blanqueo-clave-previa-pill" title="${escapeAttr(tip)}" aria-label="Ver aclaración de ${escapeAttr(BLANQUEO_CLAVE_PREVIA)}" aria-haspopup="dialog" data-blanqueo-aclaracion-detail="${escapeAttr(detail)}"><span class="blanqueo-clave-previa-pill-label">${escapeHtml(BLANQUEO_CLAVE_PREVIA)}</span><span class="blanqueo-clave-previa-pill-action" aria-hidden="true">ver</span></button>`;
}

function formatAclaracionCell(item) {
  const aclaracion = String(item.aclaracion || "").trim();
  if (aclaracion) {
    if (aclaracionTieneClavePrevia(aclaracion)) {
      return formatClavePreviaPill(aclaracion);
    }
    const cls = isNoRegistrado(aclaracion) ? "bad" : "note";
    // "No registrado" va en Estado; acá queda vacío.
    if (cls === "bad") return "—";
    return `<span class="blanqueo-pill ${cls}" title="${escapeHtml(aclaracion)}">${escapeHtml(aclaracion)}</span>`;
  }
  if (item?.listo && isBlanqueoConClave(item)) {
    return formatClaveCopyPill(claveDefault(), "Clic para copiar la clave genérica") || "—";
  }
  return "—";
}

function formatGestionadoPorCell(item) {
  const nombre = String(item.confirmadoPorNombre || "").trim();
  const gestionado = !!item?.listo || !!String(item?.aclaracion || "").trim();
  if (!gestionado) return "—";
  return escapeHtml(nombre || "—");
}

function formatEstadoCell(item) {
  const aclaracion = String(item.aclaracion || "").trim();
  if (item.listo) {
    if (aclaracion) {
      return '<span class="blanqueo-pill ok-note" title="Listo con aclaración">Listo · nota</span>';
    }
    return '<span class="blanqueo-pill ok">Listo</span>';
  }
  if (isNoRegistrado(aclaracion)) {
    return '<span class="blanqueo-pill bad" title="No registrado">No registrado</span>';
  }
  if (!aclaracion) {
    return '<span class="blanqueo-estado-pending" title="Pendiente de confirmación" aria-label="Pendiente">⏳</span>';
  }
  return '<span class="blanqueo-pill note" title="Con aclaración">Nota</span>';
}

function showCtx(x, y, item) {
  const menu = document.getElementById("blanqueo-ctx");
  if (!menu) return;

  const confirm = canConfirm;

  menu.querySelectorAll("[data-blanqueo-ctx]").forEach((btn) => {
    const action = btn.getAttribute("data-blanqueo-ctx");
    let show = false;
    if (action === "editar" || action === "eliminar") show = confirm || canOwnerMutate(item);
    else if (["listo", "unlisto", "aclaracion-no-registrado", "aclaracion-manual", "clear-aclaracion"].includes(action || "")) {
      show = confirm;
    }
    btn.classList.toggle("hidden", !show);
  });

  const hrs = menu.querySelectorAll("hr");
  hrs.forEach((hr) => hr.classList.toggle("hidden", !confirm));

  const anyVisible = [...menu.querySelectorAll("[data-blanqueo-ctx]")].some((b) => !b.classList.contains("hidden"));
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
  document.getElementById("blanqueo-ctx")?.classList.add("hidden");
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
      const body = { listo: true };
      if (isNoRegistrado(item.aclaracion)) body.clearAclaracion = true;
      await patchItem(selectedId, body);
    } else if (action === "unlisto") {
      await patchItem(selectedId, { listo: false });
    } else if (action === "aclaracion-no-registrado") {
      await patchItem(selectedId, { listo: false, aclaracion: "No registrado" });
    } else if (action === "aclaracion-manual") {
      openNoteModal(item);
      return;
    } else if (action === "clear-aclaracion") {
      await patchItem(selectedId, { clearAclaracion: true });
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
    notifyBlanqueoChanged();
  } catch (err) {
    setStatus(err?.message || "No se pudo actualizar.", true);
  }
}

function openEditModal(item) {
  editingId = item.id;
  const overlay = document.getElementById("blanqueo-edit-overlay");
  const portal = document.getElementById("blanqueo-edit-portal");
  const caso = document.getElementById("blanqueo-edit-caso");
  const cliente = document.getElementById("blanqueo-edit-cliente");
  const correo = document.getElementById("blanqueo-edit-correo");
  const portalValue = PORTALES.includes(item.portal) ? item.portal : "OnBalance";
  if (portal) portal.value = portalValue;
  if (caso) caso.value = item.nroCaso || "";
  if (cliente) cliente.value = item.nroCliente || "";
  if (correo) correo.value = item.correo || "";
  syncTipoOptions("blanqueo-edit-tipo", portalValue, item.tipoSolicitud || "");
  syncEditModulosField(item.modulosDetalle || "");
  overlay?.classList.remove("hidden");
  overlay?.setAttribute("aria-hidden", "false");
  caso?.focus();
}

function hideEditModal() {
  editingId = null;
  const overlay = document.getElementById("blanqueo-edit-overlay");
  overlay?.classList.add("hidden");
  overlay?.setAttribute("aria-hidden", "true");
}

async function saveEdit() {
  if (!editingId) return;
  const portal = getEditPortal();
  const nroCaso = document.getElementById("blanqueo-edit-caso")?.value.trim() || "";
  const nroCliente = document.getElementById("blanqueo-edit-cliente")?.value.trim() || "";
  const correo = document.getElementById("blanqueo-edit-correo")?.value.trim() || "";
  const tipoSolicitud = document.getElementById("blanqueo-edit-tipo")?.value.trim() || "";
  const modulos = collectModulos("blanqueo-edit-modulo");

  if (!tiposForPortal(portal).includes(tipoSolicitud)) {
    setStatus("Elegí un tipo de solicitud válido para esa plataforma.", true);
    return;
  }
  if (isHabilitacionTipo(tipoSolicitud) && !modulos.length) {
    setStatus("Elegí al menos un módulo a habilitar.", true);
    return;
  }

  try {
    const res = await planUserFetch(`/api/planillas/blanqueo/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portal,
        nroCaso,
        nroCliente,
        correo,
        tipoSolicitud,
        modulosDetalle: isHabilitacionTipo(tipoSolicitud) ? modulos.join("|") : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.detail || `Error ${res.status}`);
    hideEditModal();
    setStatus("Solicitud editada.");
    await reloadList();
  } catch (err) {
    setStatus(err?.message || "No se pudo editar.", true);
  }
}

function openDeleteModal(item) {
  selectedId = item.id;
  const overlay = document.getElementById("blanqueo-delete-overlay");
  const desc = document.getElementById("blanqueo-delete-desc");
  if (desc) {
    desc.textContent = `${portalLabel(item.portal)} · ${item.nroCaso || "—"} · ${item.correo || "—"}`;
  }
  overlay?.classList.remove("hidden");
  overlay?.setAttribute("aria-hidden", "false");
  document.getElementById("blanqueo-delete-cancel")?.focus();
}

function hideDeleteModal() {
  const overlay = document.getElementById("blanqueo-delete-overlay");
  overlay?.classList.add("hidden");
  overlay?.setAttribute("aria-hidden", "true");
}

async function confirmDeleteModal() {
  if (!selectedId) return;
  try {
    const res = await planUserFetch(`/api/planillas/blanqueo/${selectedId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    selectedId = null;
    hideDeleteModal();
    setStatus("Solicitud eliminada.");
    await reloadList();
    notifyBlanqueoChanged();
  } catch (err) {
    setStatus(err?.message || "No se pudo eliminar.", true);
  }
}

function openNoteModal(item) {
  selectedId = item.id;
  const overlay = document.getElementById("blanqueo-note-overlay");
  const text = document.getElementById("blanqueo-note-text");
  if (text) text.value = item.aclaracion || "";
  overlay?.classList.remove("hidden");
  overlay?.setAttribute("aria-hidden", "false");
  text?.focus();
}

function hideNoteModal() {
  const overlay = document.getElementById("blanqueo-note-overlay");
  overlay?.classList.add("hidden");
  overlay?.setAttribute("aria-hidden", "true");
}

async function saveNoteModal() {
  if (!selectedId) return;
  const text = String(document.getElementById("blanqueo-note-text")?.value || "").trim();
  try {
    if (!text) {
      await patchItem(selectedId, { clearAclaracion: true });
    } else if (isNoRegistrado(text)) {
      await patchItem(selectedId, { listo: false, aclaracion: "No registrado" });
    } else {
      await patchItem(selectedId, { aclaracion: text });
    }
    hideNoteModal();
    setStatus("Aclaración guardada.");
    await reloadList();
    notifyBlanqueoChanged();
  } catch (err) {
    setStatus(err?.message || "No se pudo guardar la aclaración.", true);
  }
}

async function patchItem(id, body) {
  const res = await planUserFetch(`/api/planillas/blanqueo/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.detail || `Error ${res.status}`);
  return data;
}

function isNoRegistrado(value) {
  return String(value || "").trim().toLowerCase() === "no registrado";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
