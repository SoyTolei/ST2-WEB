import { getPlanUserEmail, planUserFetch } from "./plan-user.js";

/**
 * Quién ve "Solicitudes de blanqueo…".
 * Lista vacía = oculto para todos.
 * Override: localStorage.setItem("st2-blanqueo-force", "1")
 */
const BLANQUEO_ALLOWED_EMAILS = [
  "leonel.gallo@thomsonreuters.com",
];

const FORCE_KEY = "st2-blanqueo-force";
const TIPOS = ["Blanqueo", "Blanqueo + MFA"];

let blanqueoInited = false;
let items = [];
let selectedId = null;

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

  const ctx = document.getElementById("blanqueo-ctx");
  ctx?.addEventListener("click", (e) => {
    e.stopPropagation();
    const btn = e.target.closest("[data-blanqueo-ctx]");
    if (!btn) return;
    const action = btn.getAttribute("data-blanqueo-ctx");
    hideCtx();
    void handleCtxAction(action);
  });

  document.addEventListener("click", () => hideCtx());
  document.addEventListener("scroll", () => hideCtx(), true);

  syncSolicitanteBadge();
}

export async function openBlanqueoModule() {
  if (!canSeeBlanqueoModule()) return;
  initBlanqueoModule();
  syncSolicitanteBadge();
  clearForm();
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

function displayNameFromEmail(email) {
  const local = String(email || "").split("@")[0] || "";
  const parts = local.split(".").filter(Boolean);
  if (!parts.length) return email;
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
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
      body: JSON.stringify({ nroCaso, nroCliente, correo, tipoSolicitud }),
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
    renderTable();
    const count = document.getElementById("blanqueo-count");
    if (count) count.textContent = items.length ? `(${items.length})` : "";
    if (!document.getElementById("blanqueo-status")?.textContent) {
      setStatus(items.length ? `${items.length} solicitud(es).` : "Sin solicitudes todavía.");
    }
  } catch (err) {
    items = [];
    renderTable();
    setStatus(err?.message || "No se pudo cargar el listado.", true);
  }
}

function renderTable() {
  const tbody = document.getElementById("blanqueo-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!items.length) {
    const row = document.createElement("tr");
    row.className = "plan-gestor-empty-row";
    row.innerHTML = `<td colspan="8">No hay solicitudes cargadas.</td>`;
    tbody.appendChild(row);
    return;
  }

  for (const item of items) {
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
    <td>${escapeHtml(item.correo)}</td>
    <td>${escapeHtml(formatFecha(item.fechaSolicitud))}</td>
    <td>${escapeHtml(item.solicitadoPorNombre || item.solicitadoPorEmail || "")}</td>
    <td>${escapeHtml(item.tipoSolicitud)}</td>
    <td class="blanqueo-col-listo">${item.listo ? '<span class="blanqueo-pill ok">Listo</span>' : "—"}</td>
    <td class="blanqueo-col-aclaracion">${item.aclaracion ? `<span class="blanqueo-pill note">${escapeHtml(item.aclaracion)}</span>` : "—"}</td>
  `;

  row.addEventListener("click", (e) => {
    if (e.button !== 0) return;
    selectedId = item.id;
    highlightSelected();
  });

  row.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    selectedId = item.id;
    highlightSelected();
    showCtx(e.clientX, e.clientY);
  });

  return row;
}

function highlightSelected() {
  document.querySelectorAll("#blanqueo-table-body tr").forEach((tr) => tr.classList.remove("selected"));
  // Re-render keeps data attributes simple; selection is reapplied in buildRow.
  renderTable();
}

function showCtx(x, y) {
  const menu = document.getElementById("blanqueo-ctx");
  if (!menu) return;
  menu.classList.remove("hidden");
  const pad = 8;
  const w = menu.offsetWidth || 240;
  const h = menu.offsetHeight || 220;
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
    if (action === "listo") {
      await patchItem(selectedId, { listo: true });
    } else if (action === "unlisto") {
      await patchItem(selectedId, { listo: false });
    } else if (action === "aclaracion-no-registrado") {
      await patchItem(selectedId, { aclaracion: "No registrado" });
    } else if (action === "aclaracion-duplicado") {
      await patchItem(selectedId, { aclaracion: "Duplicado" });
    } else if (action === "aclaracion-inexistente") {
      await patchItem(selectedId, { aclaracion: "Perfil inexistente" });
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
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const day = Number(m[3]);
  const month = months[Number(m[2]) - 1] || m[2];
  return `${day}-${month}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
