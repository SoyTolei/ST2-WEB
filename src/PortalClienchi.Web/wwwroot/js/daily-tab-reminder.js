const STORAGE_KEY = "st2-daily-tab-visits";
const ENGAGE_DELAY_MS = 5000;

const TAB_KEYS = {
  thom: "Thom",
  ai: "AiPlatform",
};

const TOOLTIPS = {
  thom: "Pendiente a ingresar y realizar la consulta en THOM",
  ai: "Pendiente a ingresar y utilizar la herramienta",
};

let engageTimer = null;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadVisits() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveVisits(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignorar cuota / modo privado
  }
}

export function shouldShowReminder(tab) {
  const key = TAB_KEYS[tab];
  if (!key) return false;
  return loadVisits()[key] !== todayKey();
}

export function markVisitedToday(tab) {
  const key = TAB_KEYS[tab];
  if (!key) return;
  const visits = loadVisits();
  visits[key] = todayKey();
  saveVisits(visits);
  refreshBadges();
}

export function refreshBadges() {
  for (const tab of Object.keys(TAB_KEYS)) {
    const badge = document.querySelector(`.tab-reminder-badge[data-reminder="${tab}"]`);
    if (!badge) continue;
    const show = shouldShowReminder(tab);
    badge.textContent = "!";
    badge.classList.add("tab-reminder-badge--hint");
    badge.classList.toggle("hidden", !show);
    badge.title = TOOLTIPS[tab];
    badge.setAttribute("aria-hidden", show ? "false" : "true");
  }
}

export function stopEngagementTimer() {
  if (engageTimer) {
    clearTimeout(engageTimer);
    engageTimer = null;
  }
}

export function startEngagementTimer(tab) {
  stopEngagementTimer();
  if (!TAB_KEYS[tab]) return;
  engageTimer = setTimeout(() => onEngagement(tab), ENGAGE_DELAY_MS);
}

export function onEngagement(tab) {
  if (!TAB_KEYS[tab]) return;
  stopEngagementTimer();
  markVisitedToday(tab);
}

export function initDailyTabReminders() {
  refreshBadges();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshBadges();
  });
}

export function bindEmbedEngagement(frame, tab) {
  if (!frame || !TAB_KEYS[tab]) return;
  frame.addEventListener("load", () => {
    const panel = document.getElementById(`panel-${tab}`);
    if (panel?.classList.contains("active")) onEngagement(tab);
  });
}
