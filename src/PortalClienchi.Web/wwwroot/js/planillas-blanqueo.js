import { getPlanUserEmail, planUserFetch } from "./plan-user.js";

/**
 * Quién ve el módulo.
 * Override: localStorage.setItem("st2-blanqueo-force", "1")
 */
const BLANQUEO_ALLOWED_EMAILS = [
  "leonel.gallo@thomsonreuters.com",
  "sabrinacecilia.rodriguezcuaglia@thomsonreuters.com",
];

const BLANQUEO_CONFIRMER_EMAILS = [
  "leonel.gallo@thomsonreuters.com",
];

const FORCE_KEY = "st2-blanqueo-force";
const TIPOS = ["Blanqueo", "Blanqueo + MFA"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

let blanqueoInited = false;
let items = [];
let selectedId = null;
let activePortal = "PortalCliente";
let canConfirm = false;
let editingId = null;

export function canSeeBlanqueoModule(email = getPlanUserEmail()) {
  try {
    if (localStorage.getItem(FORCE_KEY) === "1") return true;
  } catch { /* ignore */ }

  const list = BLANQUEO_ALLOWED_EMAILS
    .map((e) => String(e || "").trim().toLowerCase())
    .filter(Boolean);

  if (list.length === 0) return false;
  const current = String(email || "").trim().toLowerCase();
  return !!current && list.includes(current);
}

function canConfirmBlanqueo(email = getPlanUserEmail()) {
  const current = String(email || "").trim().toLowerCase();
  return !!current && BLANQUEO_CONFIRMER_EMAILS.includes(current);
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
  if (blanqueoInited) return;
  blanqueoInited = true;

  document.querySelectorAll("[data-blanqueo-portal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const portal = btn.getAttribute("data-blanqueo-portal");
      if (!portal || portal === activePortal) return;
      activePortal = portal;
      syncPortalTabs();
      clearForm();
      applyFilters();
    });
  });

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

  document.getElementById("blanqueo-filter-month")?.addEventListener("change", () => applyFilters());
  document.getElementById("blanqueo-search")?.addEventListener("input", () => applyFilters());

  document.getElementById("blanqueo-edit-save")?.addEventListener("click", () => {
    void saveEdit();
  });
  document.getElementById("blanqueo-edit-cancel")?.addEventListener("click", () => hideEditModal());
  document.getElementById("blanqueo-edit-overlay")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) hideEditModal();
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

  syncSolicitanteBadge();
  syncPortalTabs();
}

export async function openBlanqueoModule() {
  if (!canSeeBlanqueoModule()) return;
  initBlanqueoModule();
  canConfirm = canConfirmBlanqueo();
  syncSolicitanteBadge();
  syncPortalTabs();
  clearForm();
  await reloadList();
}

function syncPortalTabs() {
  document.querySelectorAll("[data-blanqueo-portal]").forEach((btn) => {
    const on = btn.getAttribute("data-blanqueo-portal") === activePortal;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  const label = document.getElementById("blanqueo-portal-label");
  if (label) {
    label.textContent = activePortal === "OnBalance" ? "OnBalance (portal empleado)" : "Portal Cliente";
  }
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
  const caso = document.getElementById("blanqueo-caso");
  const cliente = document.getElementById("blanqueo-cliente");
  const correo = document.getElementById("blanqueo-correo");
  const tipo = document.getElementById("blanqueo-tipo");
  if (caso) caso.value = "";
  if (cliente) cliente.value = "";
  if (correo) correo.value = "";
  if (tipo) tipo.value = "Blanqueo";
}

async function createSolicitud() {
  const nroCaso = document.getElementById("blanqueo-caso")?.value.trim() || "";
  const nroCliente = document.getElementById("blanqueo-cliente")?.value.trim() || "";
  const correo = document.getElementById("blanqueo-correo")?.value.trim() || "";
  const tipoSolicitud = document.getElementById("blanqueo-tipo")?.value.trim() || "";

  if (!nroCaso || !nroCliente || !correo) {
    setStatus("Completá caso, cliente y correo.", true);
    return;
  }
  if (!TIPOS.includes(tipoSolicitud)) {
    setStatus("Elegí un tipo de solicitud válido.", true);
    return;
  }

  setStatus("Guardando…");
  try {
    const res = await planUserFetch("/api/planillas/blanqueo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portal: activePortal,
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
  try {
    const res = await planUserFetch("/api/planillas/blanqueo");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.detail || `Error ${res.status}`);
    items = Array.isArray(data.items) ? data.items : [];
    canConfirm = !!data.canConfirm || canConfirmBlanqueo();
    rebuildMonthOptions();
    applyFilters();
  } catch (err) {
    items = [];
    applyFilters();
    setStatus(err?.message || "No se pudo cargar el listado.", true);
  }
}

function rebuildMonthOptions() {
  const sel = document.getElementById("blanqueo-filter-month");
  if (!sel) return;
  const keep = sel.value || currentMonthKey();
  const keys = new Set();
  for (const item of items) {
    const key = monthKeyFromIso(item.fechaSolicitud);
    if (key) keys.add(key);
  }
  keys.add(currentMonthKey());

  const sorted = [...keys].sort((a, b) => b.localeCompare(a));
  sel.innerHTML = `<option value="all">Todos los meses</option>` +
    sorted.map((key) => {
      const [y, m] = key.split("-");
      const label = `${MONTHS[Number(m) - 1] || m} ${y}`;
      return `<option value="${key}">${label}</option>`;
    }).join("");

  sel.value = sorted.includes(keep) || keep === "all" ? keep : currentMonthKey();
  if (![...sel.options].some((o) => o.value === sel.value)) {
    sel.value = currentMonthKey();
  }
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthKeyFromIso(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso || "").trim());
  return m ? `${m[1]}-${m[2]}` : "";
}

function getFilteredItems() {
  const month = document.getElementById("blanqueo-filter-month")?.value || "all";
  const q = String(document.getElementById("blanqueo-search")?.value || "").trim().toLowerCase();

  return items.filter((item) => {
    if ((item.portal || "PortalCliente") !== activePortal) return false;
    if (month !== "all" && monthKeyFromIso(item.fechaSolicitud) !== month) return false;
    if (q) {
      const hay = [
        item.correo,
        item.nroCaso,
        item.nroCliente,
        item.solicitadoPorNombre,
        item.aclaracion,
      ].map((x) => String(x || "").toLowerCase()).join(" ");
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function applyFilters() {
  const filtered = getFilteredItems();
  renderTable(filtered);
  const count = document.getElementById("blanqueo-count");
  if (count) count.textContent = filtered.length ? `(${filtered.length})` : "";
  const statusEl = document.getElementById("blanqueo-status");
  if (statusEl && !statusEl.classList.contains("is-error")) {
    const portalLabel = activePortal === "OnBalance" ? "OnBalance" : "Portal Cliente";
    setStatus(
      filtered.length
        ? `${filtered.length} en ${portalLabel}.`
        : `Sin solicitudes en ${portalLabel} con ese filtro.`
    );
  }
}

function renderTable(filtered) {
  const tbody = document.getElementById("blanqueo-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!filtered.length) {
    const row = document.createElement("tr");
    row.className = "plan-gestor-empty-row";
    row.innerHTML = `<td colspan="8">No hay solicitudes con ese filtro.</td>`;
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

  row.innerHTML = `
    <td>${escapeHtml(item.nroCaso)}</td>
    <td>${escapeHtml(item.nroCliente)}</td>
    <td class="blanqueo-col-correo" title="${escapeHtml(item.correo)}">${escapeHtml(item.correo)}</td>
    <td>${escapeHtml(formatFecha(item.fechaSolicitud))}</td>
    <td>${escapeHtml(item.solicitadoPorNombre || item.solicitadoPorEmail || "")}</td>
    <td>${escapeHtml(item.tipoSolicitud)}</td>
    <td class="blanqueo-col-listo">${item.listo ? '<span class="blanqueo-pill ok">Listo</span>' : "—"}</td>
    <td class="blanqueo-col-aclaracion">${item.aclaracion ? `<span class="blanqueo-pill note">${escapeHtml(item.aclaracion)}</span>` : "—"}</td>
  `;

  row.addEventListener("click", (e) => {
    if (e.button !== 0) return;
    selectedId = item.id;
    applyFilters();
  });

  row.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    selectedId = item.id;
    applyFilters();
    showCtx(e.clientX, e.clientY, item);
  });

  return row;
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
    else if (["listo", "unlisto", "aclaracion-no-registrado", "aclaracion-duplicado", "aclaracion-manual", "clear-aclaracion"].includes(action || "")) {
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
      await patchItem(selectedId, { listo: true });
    } else if (action === "unlisto") {
      await patchItem(selectedId, { listo: false });
    } else if (action === "aclaracion-no-registrado") {
      await patchItem(selectedId, { aclaracion: "No registrado" });
    } else if (action === "aclaracion-duplicado") {
      await patchItem(selectedId, { aclaracion: "Duplicado" });
    } else if (action === "aclaracion-manual") {
      const text = window.prompt("Aclaración (texto libre):", item.aclaracion || "");
      if (text === null) return;
      const trimmed = text.trim();
      if (!trimmed) {
        await patchItem(selectedId, { clearAclaracion: true });
      } else {
        await patchItem(selectedId, { aclaracion: trimmed });
      }
    } else if (action === "clear-aclaracion") {
      await patchItem(selectedId, { clearAclaracion: true });
    } else if (action === "eliminar") {
      if (!window.confirm("¿Eliminar esta solicitud?")) return;
      const res = await planUserFetch(`/api/planillas/blanqueo/${selectedId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      selectedId = null;
      setStatus("Solicitud eliminada.");
      await reloadList();
      return;
    }
    setStatus("Actualizado.");
    await reloadList();
  } catch (err) {
    setStatus(err?.message || "No se pudo actualizar.", true);
  }
}

function openEditModal(item) {
  editingId = item.id;
  const overlay = document.getElementById("blanqueo-edit-overlay");
  const caso = document.getElementById("blanqueo-edit-caso");
  const cliente = document.getElementById("blanqueo-edit-cliente");
  const correo = document.getElementById("blanqueo-edit-correo");
  const tipo = document.getElementById("blanqueo-edit-tipo");
  if (caso) caso.value = item.nroCaso || "";
  if (cliente) cliente.value = item.nroCliente || "";
  if (correo) correo.value = item.correo || "";
  if (tipo) tipo.value = TIPOS.includes(item.tipoSolicitud) ? item.tipoSolicitud : "Blanqueo";
  overlay?.classList.remove("hidden");
}

function hideEditModal() {
  editingId = null;
  document.getElementById("blanqueo-edit-overlay")?.classList.add("hidden");
}

async function saveEdit() {
  if (!editingId) return;
  const nroCaso = document.getElementById("blanqueo-edit-caso")?.value.trim() || "";
  const nroCliente = document.getElementById("blanqueo-edit-cliente")?.value.trim() || "";
  const correo = document.getElementById("blanqueo-edit-correo")?.value.trim() || "";
  const tipoSolicitud = document.getElementById("blanqueo-edit-tipo")?.value.trim() || "";

  try {
    const res = await planUserFetch(`/api/planillas/blanqueo/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nroCaso, nroCliente, correo, tipoSolicitud }),
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
