import { getPlanUserEmail, planUserFetch } from "./plan-user.js";
import {
  canSeeBlanqueoModule as canSeeFromAccess,
  canConfirmBlanqueoModule as canConfirmFromAccess,
  refreshModuleFlags,
} from "./module-access.js";
import { refreshBlanqueoAlerts } from "./blanqueo-alerts.js";

/**
 * Override: localStorage.setItem("st2-blanqueo-force", "1")
 * o localStorage.setItem("st2-modules-force-all", "1")
 */
const FORCE_KEY = "st2-blanqueo-force";
const TIPOS_POR_PORTAL = {
  OnBalance: ["Blanqueo", "Blanqueo + MFA"],
  Onvio: ["Blanqueo MFA"],
  PortalCliente: ["Activación", "Cambio de contraseña"],
};
const PORTALES = ["OnBalance", "Onvio", "PortalCliente"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

let blanqueoInited = false;
let items = [];
let selectedId = null;
let canConfirm = false;
let editingId = null;
/** @type {"desc" | "asc"} */
let fechaSortDir = "desc";
let monthFilterTouched = false;
let listLoadGen = 0;

export function canSeeBlanqueoModule(email = getPlanUserEmail()) {
  try {
    if (localStorage.getItem(FORCE_KEY) === "1") return true;
  } catch { /* ignore */ }

  if (!String(email || "").trim()) return false;
  return canSeeFromAccess();
}

function canConfirmBlanqueo(email = getPlanUserEmail()) {
  try {
    if (localStorage.getItem(FORCE_KEY) === "1") return true;
  } catch { /* ignore */ }

  if (!String(email || "").trim()) return false;
  return canConfirmFromAccess();
}

export function syncBlanqueoModuleVisibility() {
  const btn = document.getElementById("plan-modulo-blanqueo");
  if (!btn) return;
  const allowed = canSeeBlanqueoModule();
  btn.classList.toggle("hidden", !allowed);
  btn.setAttribute("aria-hidden", allowed ? "false" : "true");
}

export function initBlanqueoModule() {
  syncBlanqueoModuleVisibility();
  canConfirm = canConfirmBlanqueo();
  if (blanqueoInited) return;
  blanqueoInited = true;

  document.getElementById("blanqueo-add")?.addEventListener("click", () => {
    void createSolicitud();
  });

  ["blanqueo-caso", "blanqueo-cliente", "blanqueo-correo"].forEach((id) => {
    document.getElementById(id)?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void createSolicitud();
      }
    });
  });

  document.getElementById("blanqueo-filter-month")?.addEventListener("change", () => {
    monthFilterTouched = true;
    applyFilters();
  });
  document.getElementById("blanqueo-filter-portal")?.addEventListener("change", () => applyFilters());
  document.getElementById("blanqueo-search")?.addEventListener("input", () => applyFilters());
  document.getElementById("blanqueo-filter-mine")?.addEventListener("change", () => applyFilters());
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
  });
  document.getElementById("blanqueo-edit-portal")?.addEventListener("change", () => {
    syncTipoOptions("blanqueo-edit-tipo", getEditPortal());
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
}

export async function openBlanqueoModule() {
  if (!canSeeBlanqueoModule()) return;
  initBlanqueoModule();
  // Usa cache de permisos (evita otro /modules al abrir).
  await refreshModuleFlags();
  canConfirm = canConfirmBlanqueo();
  syncSolicitanteBadge();
  syncMineFilterVisibility();
  clearForm();
  monthFilterTouched = false;
  syncTipoOptions("blanqueo-tipo", getFormPortal());
  syncClaveVisibility();
  setStatus("Cargando solicitudes…");
  await reloadList();
}

function syncSolicitanteBadge() {
  const badge = document.getElementById("blanqueo-user-badge");
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
  const wrap = document.getElementById("blanqueo-filter-mine-wrap");
  const check = document.getElementById("blanqueo-filter-mine");
  if (!wrap) return;
  // Quien confirma (admin de blanqueo) siempre ve el listado completo.
  const show = !canConfirm;
  wrap.classList.toggle("hidden", !show);
  if (!show && check) check.checked = false;
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
  return String(getPlanUserEmail() || "").trim().toLowerCase();
}

function isOwner(item) {
  return String(item?.solicitadoPorEmail || "").trim().toLowerCase() === currentEmail();
}

function setStatus(msg, isError = false) {
  const el = document.getElementById("blanqueo-status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
  el.classList.toggle("is-error", !!isError && !!msg);
}

function clearForm() {
  const portal = document.getElementById("blanqueo-portal");
  const caso = document.getElementById("blanqueo-caso");
  const cliente = document.getElementById("blanqueo-cliente");
  const correo = document.getElementById("blanqueo-correo");
  if (portal) portal.value = "OnBalance";
  if (caso) caso.value = "";
  if (cliente) cliente.value = "";
  if (correo) correo.value = "";
  syncTipoOptions("blanqueo-tipo", "OnBalance");
  syncClaveVisibility();
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
  const current = preferred || sel.value;
  sel.innerHTML = tipos
    .map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`)
    .join("");
  sel.value = tipos.includes(current) ? current : tipos[0];
}

function syncClaveVisibility() {
  const hint = document.getElementById("blanqueo-clave-hint");
  if (!hint) return;
  const show = getFormPortal() === "OnBalance";
  hint.classList.toggle("hidden", !show);
  hint.setAttribute("aria-hidden", show ? "false" : "true");
}

async function createSolicitud() {
  const portal = getFormPortal();
  const nroCaso = document.getElementById("blanqueo-caso")?.value.trim() || "";
  const nroCliente = document.getElementById("blanqueo-cliente")?.value.trim() || "";
  const correo = document.getElementById("blanqueo-correo")?.value.trim() || "";
  const tipoSolicitud = document.getElementById("blanqueo-tipo")?.value.trim() || "";

  if (!nroCaso || !nroCliente || !correo) {
    setStatus("Completá caso, cliente y correo.", true);
    return;
  }
  if (!tiposForPortal(portal).includes(tipoSolicitud)) {
    setStatus("Elegí un tipo de solicitud válido para esa plataforma.", true);
    return;
  }

  setStatus("Guardando…");
  try {
    const res = await planUserFetch("/api/planillas/blanqueo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portal,
        nroCaso,
        nroCliente,
        correo,
        tipoSolicitud,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.detail || `Error ${res.status}`);
    clearForm();
    setStatus("Solicitud agregada.");
    await reloadList();
    document.getElementById("blanqueo-caso")?.focus();
  } catch (err) {
    setStatus(err?.message || "No se pudo guardar.", true);
  }
}

async function reloadList() {
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
    items = (Array.isArray(data.items) ? data.items : []).map(normalizeBlanqueoItem);
    canConfirm = !!data.canConfirm || canConfirmBlanqueo();
    syncMineFilterVisibility();
    syncClaveUi(data.claveBlanqueo);
    rebuildMonthOptions();
    applyFilters();
  } catch (err) {
    if (gen !== listLoadGen) return;
    // No vaciar el listado si falló un refresh en background; solo avisar.
    if (!items.length) applyFilters();
    const msg = String(err?.message || "");
    setStatus(
      msg.includes("429")
        ? "Cloudflare limitó las peticiones. Esperá 20–40 s y volvé a entrar."
        : (msg || "No se pudo cargar el listado."),
      true,
    );
  }
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
  try {
    await navigator.clipboard.writeText(value);
    setStatus(`Clave copiada: ${value}`);
  } catch {
    setStatus(`Clave: ${value}`);
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
    solicitadoPorEmail: src.solicitadoPorEmail ?? src.SolicitadoPorEmail ?? "",
    solicitadoPorNombre: src.solicitadoPorNombre ?? src.SolicitadoPorNombre ?? "",
    tipoSolicitud: src.tipoSolicitud ?? src.TipoSolicitud ?? "",
    listo: !!(src.listo ?? src.Listo),
    aclaracion: src.aclaracion ?? src.Aclaracion ?? null,
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
    return (a.id || 0) - (b.id || 0);
  });
  return filtered;
}

function syncFechaSortHeader() {
  const th = document.getElementById("blanqueo-th-fecha");
  if (!th) return;
  const mark = th.querySelector(".blanqueo-sort-mark");
  const desc = fechaSortDir === "desc";
  th.setAttribute("aria-sort", desc ? "descending" : "ascending");
  th.title = desc ? "Más recientes primero — clic para invertir" : "Más antiguas primero — clic para invertir";
  if (mark) mark.textContent = desc ? "↓" : "↑";
}

function applyFilters() {
  const filtered = getFilteredItems();
  renderTable(filtered);
  const count = document.getElementById("blanqueo-count");
  if (count) count.textContent = filtered.length ? `(${filtered.length})` : "";
  const statusEl = document.getElementById("blanqueo-status");
  if (statusEl && !statusEl.classList.contains("is-error")) {
    setStatus(filtered.length ? `${filtered.length} solicitud(es).` : "Sin solicitudes con ese filtro.");
  }
}

function renderTable(filtered) {
  const tbody = document.getElementById("blanqueo-table-body");
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
}

function buildRow(item) {
  const row = document.createElement("tr");
  if (selectedId === item.id) row.classList.add("selected");
  if (item.listo) row.classList.add("blanqueo-row-listo");
  if (item.aclaracion) row.classList.add("blanqueo-row-aclaracion");
  if (isNoRegistrado(item.aclaracion) && !item.listo) row.classList.add("blanqueo-row-noreg");

  row.innerHTML = `
    <td>${escapeHtml(portalLabel(item.portal))}</td>
    <td>${escapeHtml(item.nroCaso)}</td>
    <td>${escapeHtml(item.nroCliente)}</td>
    <td class="blanqueo-col-correo" title="${escapeHtml(item.correo)}">${escapeHtml(item.correo)}</td>
    <td>${escapeHtml(formatFecha(item.fechaSolicitud))}</td>
    <td>${escapeHtml(item.solicitadoPorNombre || item.solicitadoPorEmail || "")}</td>
    <td>${escapeHtml(item.tipoSolicitud)}</td>
    <td class="blanqueo-col-listo">${item.listo ? '<span class="blanqueo-pill ok">Listo</span>' : "—"}</td>
    <td class="blanqueo-col-aclaracion">${item.aclaracion ? `<span class="blanqueo-pill ${isNoRegistrado(item.aclaracion) ? "bad" : "note"}">${escapeHtml(item.aclaracion)}</span>` : "—"}</td>
  `;

  row.addEventListener("click", (e) => {
    if (e.button !== 0) return;
    selectedId = item.id;
    applyFilters();
  });

  row.addEventListener("dblclick", (e) => {
    e.preventDefault();
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
    void refreshBlanqueoAlerts();
  } catch (err) {
    setStatus(err?.message || "No se pudo actualizar.", true);
  }
}

function portalLabel(portal) {
  if (portal === "OnBalance") return "On Balance";
  if (portal === "Onvio") return "ONVIO";
  return "Portal Cliente";
}

function showCtx(x, y, item) {
  const menu = document.getElementById("blanqueo-ctx");
  if (!menu) return;

  const owner = isOwner(item);
  const confirm = canConfirm;

  menu.querySelectorAll("[data-blanqueo-ctx]").forEach((btn) => {
    const action = btn.getAttribute("data-blanqueo-ctx");
    let show = false;
    if (action === "editar" || action === "eliminar") show = owner || confirm;
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
      openDeleteModal(item);
      return;
    }
    setStatus("Actualizado.");
    await reloadList();
    if (action === "listo" || action === "unlisto") {
      void refreshBlanqueoAlerts();
    }
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

  if (!tiposForPortal(portal).includes(tipoSolicitud)) {
    setStatus("Elegí un tipo de solicitud válido para esa plataforma.", true);
    return;
  }

  try {
    const res = await planUserFetch(`/api/planillas/blanqueo/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portal, nroCaso, nroCliente, correo, tipoSolicitud }),
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
    void refreshBlanqueoAlerts();
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

function formatFecha(iso) {
  const raw = String(iso || "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return raw;
  const day = Number(m[3]);
  const month = MONTHS[Number(m[2]) - 1] || m[2];
  return `${day}-${month}`;
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
