/**
 * Bandeja de avisos: historial con hora exacta, visto/no visto y click para ir.
 */
const STORAGE_KEY = "st2-notif-inbox-v1";
const MAX_ITEMS = 40;
const ALLOWED_IDS = new Set([
  "st2-toast-update",
  "st2-toast-tools",
  "st2-toast-blanqueo",
  "st2-toast-blanqueo-mine",
  "st2-toast-borrado",
  "st2-toast-borrado-mine",
]);
const TITLE_BY_ID = {
  "st2-toast-update": "Actualización",
  "st2-toast-tools": "Descargas",
  "st2-toast-blanqueo": "Blanqueo",
  "st2-toast-blanqueo-mine": "Tu blanqueo",
  "st2-toast-borrado": "Borrado",
  "st2-toast-borrado-mine": "Tu borrado",
};

/** @type {Array<{ id: string, title: string, body: string, tone: string, at: number, seen: boolean }>} */
let items = loadItems();
try {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
} catch {
  /* ignore */
}
let panelEl = null;
let listEl = null;
let emptyEl = null;
let unreadEl = null;
let open = false;

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.id === "string" && typeof x.body === "string" && ALLOWED_IDS.has(String(x.id)))
      .slice(0, MAX_ITEMS)
      .map((x) => ({
        id: String(x.id),
        title: String(x.title || TITLE_BY_ID[x.id] || "Aviso"),
        body: String(x.body || "").trim(),
        tone: String(x.tone || "ok"),
        at: Number(x.at) || Date.now(),
        seen: !!x.seen,
      }));
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* ignore */
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function exactWhen(at) {
  try {
    return new Date(Number(at) || Date.now()).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

export function getNotifInboxUnreadCount() {
  return items.filter((x) => !x.seen).length;
}

export function listNotifInbox() {
  return items.slice();
}

export function upsertNotifInboxEntry({ id, body, tone = "ok", title } = {}) {
  const key = String(id || "").trim();
  const text = String(body || "").trim();
  if (!key || !text || !ALLOWED_IDS.has(key)) return;
  const now = Date.now();
  const prev = items.find((x) => x.id === key);
  const nextTitle = String(title || TITLE_BY_ID[key] || prev?.title || "Aviso");
  if (prev && prev.body === text) {
    prev.tone = String(tone || prev.tone || "ok");
    prev.title = nextTitle;
    persist();
    if (open) paintList();
    emitChange();
    return;
  }
  items = [
    {
      id: key,
      title: nextTitle,
      body: text,
      tone: String(tone || "ok"),
      at: now,
      seen: false,
    },
    ...items.filter((x) => x.id !== key),
  ].slice(0, MAX_ITEMS);
  persist();
  if (open) paintList();
  emitChange();
}

export function removeNotifInboxEntry(id) {
  const key = String(id || "").trim();
  if (!key) return;
  const before = items.length;
  items = items.filter((x) => x.id !== key);
  if (items.length === before) return;
  persist();
  if (open) paintList();
  emitChange();
}

export function markNotifInboxSeen(ids) {
  const set = ids ? new Set(ids.map(String)) : null;
  let changed = false;
  for (const item of items) {
    if (set && !set.has(item.id)) continue;
    if (!item.seen) {
      item.seen = true;
      changed = true;
    }
  }
  if (!changed) return;
  persist();
  if (open) paintList();
  emitChange();
}

function emitChange() {
  try {
    document.dispatchEvent(
      new CustomEvent("st2:notif-inbox-changed", {
        detail: { unread: getNotifInboxUnreadCount(), total: items.length },
      }),
    );
  } catch {
    /* ignore */
  }
}

function navigateFromNotif(id) {
  const key = String(id || "");
  if (key === "st2-toast-update") {
    try {
      document.dispatchEvent(new CustomEvent("st2:reload-for-update"));
    } catch {
      window.location.reload();
    }
    return;
  }
  if (key === "st2-toast-tools") {
    document.dispatchEvent(new CustomEvent("st2:open-about-downloads"));
    return;
  }
  if (key === "st2-toast-blanqueo" || key === "st2-toast-blanqueo-mine") {
    document.querySelector('.tab-btn[data-tab="planillas"]')?.click();
    document.dispatchEvent(new CustomEvent("st2:open-blanqueo-from-alert"));
    return;
  }
  if (key === "st2-toast-borrado" || key === "st2-toast-borrado-mine") {
    document.querySelector('.tab-btn[data-tab="planillas"]')?.click();
    document.dispatchEvent(new CustomEvent("st2:open-borrado-from-alert"));
  }
}

function ensurePanel() {
  if (panelEl) return panelEl;
  const el = document.createElement("div");
  el.id = "st2-notif-inbox";
  el.className = "st2-notif-inbox hidden";
  el.setAttribute("hidden", "");
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Bandeja de avisos");
  el.innerHTML = `
    <div class="st2-notif-inbox__head">
      <div class="st2-notif-inbox__titles">
        <strong>Avisos</strong>
        <span class="st2-notif-inbox__unread" data-unread hidden></span>
      </div>
      <button type="button" class="st2-notif-inbox__close" aria-label="Cerrar">×</button>
    </div>
    <div class="st2-notif-inbox__empty" data-empty hidden>No hay avisos todavía.</div>
    <ul class="st2-notif-inbox__list" data-list></ul>
  `;
  document.body.appendChild(el);
  panelEl = el;
  listEl = el.querySelector("[data-list]");
  emptyEl = el.querySelector("[data-empty]");
  unreadEl = el.querySelector("[data-unread]");
  el.querySelector(".st2-notif-inbox__close")?.addEventListener("click", () => closeNotifInbox());
  listEl?.addEventListener("click", (e) => {
    const row = e.target.closest?.(".st2-notif-inbox__item");
    if (!row) return;
    const id = row.getAttribute("data-id");
    if (!id) return;
    markNotifInboxSeen([id]);
    closeNotifInbox();
    navigateFromNotif(id);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) closeNotifInbox();
  });
  document.addEventListener("click", (e) => {
    if (!open) return;
    if (el.contains(e.target)) return;
    if (e.target.closest?.("#st2-session-email")) return;
    if (e.target.closest?.("#st2-greet-bell")) return;
    closeNotifInbox();
  });
  return el;
}

function paintList() {
  ensurePanel();
  const unread = getNotifInboxUnreadCount();
  if (unreadEl) {
    unreadEl.hidden = unread <= 0;
    unreadEl.textContent = unread > 0 ? `${unread} sin ver` : "";
  }
  if (!items.length) {
    if (emptyEl) emptyEl.hidden = false;
    if (listEl) listEl.innerHTML = "";
    return;
  }
  if (emptyEl) emptyEl.hidden = true;
  if (!listEl) return;
  listEl.innerHTML = items
    .map((item) => {
      const tone = String(item.tone || "ok");
      const when = exactWhen(item.at);
      return `
        <li class="st2-notif-inbox__item${item.seen ? " is-seen" : " is-unread"}" data-id="${escapeHtml(item.id)}" data-tone="${escapeHtml(tone)}" role="button" tabindex="0" title="Abrir">
          <span class="st2-notif-inbox__dot" aria-hidden="true"></span>
          <span class="st2-notif-inbox__copy">
            <span class="st2-notif-inbox__meta">
              <span class="st2-notif-inbox__kind">${escapeHtml(item.title)}</span>
              <time class="st2-notif-inbox__time" datetime="${new Date(item.at).toISOString()}">${escapeHtml(when)}</time>
            </span>
            <span class="st2-notif-inbox__body">${escapeHtml(item.body)}</span>
            <span class="st2-notif-inbox__ago">${item.seen ? "Visto · clic para abrir" : "Sin ver · clic para abrir"}</span>
          </span>
        </li>`;
    })
    .join("");
}

function placePanel() {
  const el = ensurePanel();
  // Debajo del blobatar / tarjeta de sesión (no encima del menú).
  const session = document.getElementById("st2-session-email");
  const avatar = document.getElementById("st2-session-avatar-host");
  const bell = document.getElementById("st2-greet-bell");
  const anchor =
    (session && !session.classList.contains("hidden") && session) ||
    (avatar?.getClientRects?.().length ? avatar : null) ||
    (bell?.getClientRects?.().length ? bell : null);
  const rect = anchor?.getBoundingClientRect?.();
  if (rect && rect.width) {
    el.style.top = `${Math.round(rect.bottom + 10)}px`;
    el.style.left = `${Math.max(10, Math.round(rect.left))}px`;
  } else {
    el.style.top = "64px";
    el.style.left = "16px";
  }
}

function closeSessionMenuIfOpen() {
  try {
    document.body.classList.remove("st2-session-menu-open");
    const menu = document.getElementById("st2-session-menu");
    const menuBtn = document.getElementById("st2-session-menu-btn");
    if (menu) {
      menu.classList.add("hidden");
      menu.setAttribute("hidden", "");
    }
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  } catch {
    /* ignore */
  }
}

export function openNotifInbox() {
  closeSessionMenuIfOpen();
  ensurePanel();
  paintList();
  placePanel();
  panelEl.classList.remove("hidden");
  panelEl.removeAttribute("hidden");
  open = true;
  try {
    document.dispatchEvent(new CustomEvent("st2:notif-inbox-opened"));
  } catch {
    /* ignore */
  }
}

export function closeNotifInbox() {
  if (!panelEl) return;
  panelEl.classList.add("hidden");
  panelEl.setAttribute("hidden", "");
  open = false;
}

export function toggleNotifInbox() {
  if (open) closeNotifInbox();
  else openNotifInbox();
}

export function isNotifInboxOpen() {
  return open;
}
