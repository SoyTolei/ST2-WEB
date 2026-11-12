/**
 * Bandeja de avisos: historial con hora y estado visto.
 * Los sticky de Sonner siguen avisando en vivo; acá se listan sin solaparse.
 */
const STORAGE_KEY = "st2-notif-inbox-v1";
const MAX_ITEMS = 40;
const ALLOWED_IDS = new Set(["st2-toast-update", "st2-toast-tools"]);
const TITLE_BY_ID = {
  "st2-toast-update": "Actualización",
  "st2-toast-tools": "Descargas",
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

function formatWhen(at) {
  const ts = Number(at) || Date.now();
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  try {
    return new Date(ts).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function clockLabel(at) {
  try {
    return new Date(Number(at) || Date.now()).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
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
    <p class="st2-notif-inbox__hint">Solo actualización de la web y versiones para descargar.</p>
    <div class="st2-notif-inbox__empty" data-empty hidden>No hay avisos todavía.</div>
    <ul class="st2-notif-inbox__list" data-list></ul>
  `;
  document.body.appendChild(el);
  panelEl = el;
  listEl = el.querySelector("[data-list]");
  emptyEl = el.querySelector("[data-empty]");
  unreadEl = el.querySelector("[data-unread]");
  el.querySelector(".st2-notif-inbox__close")?.addEventListener("click", () => closeNotifInbox());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) closeNotifInbox();
  });
  document.addEventListener("click", (e) => {
    if (!open) return;
    if (el.contains(e.target)) return;
    if (e.target.closest?.("#st2-session-email")) return;
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
      return `
        <li class="st2-notif-inbox__item${item.seen ? " is-seen" : " is-unread"}" data-id="${escapeHtml(item.id)}" data-tone="${escapeHtml(tone)}">
          <span class="st2-notif-inbox__dot" aria-hidden="true"></span>
          <span class="st2-notif-inbox__copy">
            <span class="st2-notif-inbox__meta">
              <span class="st2-notif-inbox__kind">${escapeHtml(item.title)}</span>
              <time class="st2-notif-inbox__time" datetime="${new Date(item.at).toISOString()}" title="${escapeHtml(formatWhen(item.at))}">${escapeHtml(clockLabel(item.at))}</time>
            </span>
            <span class="st2-notif-inbox__body">${escapeHtml(item.body)}</span>
            <span class="st2-notif-inbox__ago">${escapeHtml(formatWhen(item.at))}${item.seen ? " · visto" : ""}</span>
          </span>
        </li>`;
    })
    .join("");
}

function placePanel() {
  const el = ensurePanel();
  const session = document.getElementById("st2-session-email");
  const rect = session?.getBoundingClientRect?.();
  if (rect && rect.width) {
    el.style.top = `${Math.round(rect.bottom + 8)}px`;
    el.style.left = `${Math.max(10, Math.round(rect.left))}px`;
  } else {
    el.style.top = "64px";
    el.style.left = "16px";
  }
}

export function openNotifInbox() {
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
  markNotifInboxSeen();
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
