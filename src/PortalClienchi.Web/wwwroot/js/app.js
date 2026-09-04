import { initPlanillas, goPlanillasHome } from "./planillas.js";
import { scheduleWelcomeTour, setTourContext, syncHeaderTourButton } from "./st2-tour-init.js";
import { ensureAppAccess, getPlanUserEmail, buildPlanClientHint, getOrCreateDeviceId } from "./plan-user.js";
import { isSt2SuperAdmin, isPrimarySuperAdmin, startViewAsProfile, clearViewAsProfile, getViewAsProfile, canSeePlanillasSqlOnvio, canSeePlanillasLegal, canSeePlanillasChile, canSeePlanillasTransferencia, canSeePlanillasReferral, canSeeOportunidadModule, canSeePdfPortalModule, canSeeBlanqueoModule, canSeeBorradoBasesModule, canSeeLegalFirm, canSeeLegalHighq, canSeeLegalWestlaw, canSeeLegalCocounsel, canSeeChileTransferencia, canSeeChileReferral, canSeeChileSaad, canSeeChileHr, canSeeChileWiki, canSeeChileLp, canSeeChilePowerapps, canSeeProfilePortal, listVisibleProfilePortals, hasAnyProfilePortalAccess, refreshModuleFlags, getPortalClientTabLabel } from "./module-access.js";
import { notifyAccessChanged } from "./access-alerts.js";
import { notifyWebUpdateDesktop } from "./st2-desktop-notif.js";
import { syncStackedToastGreetings } from "./st2-toast-greet.js";
import {
  ACCESS_NAME_PARTICLES,
  ACCESS_NAME_ALIASES,
  foldAccessName,
  isAccessGivenName,
  isAccessSurname,
  isAccessKnownNamePart,
} from "./access-name-dict.js";
import {
  initDailyTabReminders,
  refreshBadges,
  startEngagementTimer,
  stopEngagementTimer,
  bindEmbedEngagement,
} from "./daily-tab-reminder.js";

const PRIMARY_ADMIN_EMAIL = "leonel.gallo@thomsonreuters.com";

const statusText = document.getElementById("statusText");
const statusBar = document.getElementById("statusBar");
const aboutBtn = document.getElementById("aboutBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const THEME_STORAGE_KEY = "st2-theme";
const portalFrame = document.getElementById("portalFrame");
const thomFrame = document.getElementById("thomFrame");
const thomEmbedLoading = document.getElementById("thomEmbedLoading");
const thomDirectGate = document.getElementById("thomDirectGate");
const aiFrame = document.getElementById("aiFrame");
const portalSistemaBar = document.getElementById("portalSistemaBar");
const thomPortalBar = document.getElementById("thomPortalBar");
const thomTabWrap = document.querySelector('.tab-btn[data-tab="thom"]')?.closest(".tab-portal-wrap");
const portalTabWrap = document.querySelector('.tab-btn[data-tab="portal"]')?.closest(".tab-portal-wrap");
const portalSistemaPills = document.getElementById("portalSistemaPills");

let appConfig = null;
let activePortalId = "bejerman";

function isDarkTheme() {
  return document.documentElement.classList.contains("st2-theme-dark");
}

function syncThemeToggle() {
  const dark = isDarkTheme();
  if (!themeToggleBtn) return;
  themeToggleBtn.setAttribute("aria-checked", dark ? "true" : "false");
  const label = dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  themeToggleBtn.title = label;
  themeToggleBtn.setAttribute("aria-label", label);
}

function applyTheme(dark) {
  document.documentElement.classList.toggle("st2-theme-dark", !!dark);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    /* ignore */
  }
  syncThemeToggle();
}

/** Oscuro por defecto; solo "light" explícito deja el tema claro. */
function initThemeFromStorage() {
  let dark = true;
  try {
    dark = localStorage.getItem(THEME_STORAGE_KEY) !== "light";
  } catch {
    dark = true;
  }
  applyTheme(dark);
}

themeToggleBtn?.addEventListener("click", () => applyTheme(!isDarkTheme()));
initThemeFromStorage();
const homeBtn = document.getElementById("homeBtn");
const aboutOverlay = document.getElementById("st2-about-overlay");
const aboutCloseBtn = document.getElementById("st2-about-close");
const aboutUpdatedEl = document.getElementById("st2-about-updated");
let pathBeforeAbout = "/";
let aboutRouteOpen = false;
const ADMIN_TAB_ID = "admin";
const ADMIN_PATH = "/admin";

const tabAdminBtn = document.getElementById("tabAdminBtn");
const adminTabBadge = document.getElementById("st2-admin-tab-badge");
const accessAdminLogin = document.getElementById("st2-access-admin-login");
const accessAdminPanel = document.getElementById("st2-access-admin-panel");
const accessAdminUser = document.getElementById("st2-access-admin-user");
const accessAdminPass = document.getElementById("st2-access-admin-pass");
const accessAdminError = document.getElementById("st2-access-admin-error");
const accessAdminSubmit = document.getElementById("st2-access-admin-submit");
const accessAdminCancel = document.getElementById("st2-access-admin-cancel");
const accessAdminStatus = document.getElementById("st2-access-admin-status");
const accessAdminBody = document.getElementById("st2-access-admin-body");
const accessAdminRefresh = document.getElementById("st2-access-admin-refresh");
const accessAdminUpdated = document.getElementById("st2-access-admin-updated");
const accessAdminTableWrap = document.getElementById("st2-access-admin-table-wrap");
const accessAdminToolbar = document.getElementById("st2-access-admin-toolbar");
const accessNameEditOverlay = document.getElementById("st2-access-name-edit-overlay");
const accessNameEditEmail = document.getElementById("st2-access-name-edit-email");
const accessNameEditInput = document.getElementById("st2-access-name-edit-input");
const accessNameEditSuggest = document.getElementById("st2-access-name-edit-suggest");
const accessNameEditError = document.getElementById("st2-access-name-edit-error");
const accessNameEditClose = document.getElementById("st2-access-name-edit-close");
const accessNameEditCancel = document.getElementById("st2-access-name-edit-cancel");
const accessNameEditReset = document.getElementById("st2-access-name-edit-reset");
const accessNameEditSave = document.getElementById("st2-access-name-edit-save");
let accessNameEditEmailValue = "";
let accessNameEditAutoValue = "";
let accessNameEditSaving = false;
const accessModulesOverlay = document.getElementById("st2-access-modules-overlay");
const accessModulesTitle = document.getElementById("st2-access-modules-title");
const accessModulesEmail = document.getElementById("st2-access-modules-email");
const accessModulesEmailInput = document.getElementById("st2-access-modules-email-input");
const accessModulesName = document.getElementById("st2-access-modules-name");
const accessModulesBirthday = document.getElementById("st2-access-modules-birthday");
const accessModulesBirthdayOpen = document.getElementById("st2-access-modules-birthday-open");
const accessModulesBirthdayPicker = document.getElementById("st2-access-modules-birthday-picker");
const accessModulesError = document.getElementById("st2-access-modules-error");
const accessModulesClose = document.getElementById("st2-access-modules-close");
const accessModulesCancel = document.getElementById("st2-access-modules-cancel");
const accessModulesSave = document.getElementById("st2-access-modules-save");
const accessModOportunidad = document.getElementById("st2-mod-oportunidad");
const accessModPdf = document.getElementById("st2-mod-pdf");
const accessModBlanqueo = document.getElementById("st2-mod-blanqueo");
const accessModBlanqueoConfirm = document.getElementById("st2-mod-blanqueo-confirm");
const accessModBlanqueoLoad = document.getElementById("st2-mod-blanqueo-load");
const accessModBorradoBases = document.getElementById("st2-mod-borrado-bases");
const accessModBorradoBasesConfirm = document.getElementById("st2-mod-borrado-bases-confirm");
const accessModBorradoBasesLoad = document.getElementById("st2-mod-borrado-bases-load");
const accessModPlanillasSqlOnvio = document.getElementById("st2-mod-planillas-sql-onvio");
const accessModPlanillasLegal = document.getElementById("st2-mod-planillas-legal");
const accessModPlanillasChile = document.getElementById("st2-mod-planillas-chile");
const accessModPlanillasTransferencia = document.getElementById("st2-mod-planillas-transferencia");
const accessModPlanillasReferral = document.getElementById("st2-mod-planillas-referral");
const accessModLegalFirm = document.getElementById("st2-mod-legal-firm");
const accessModLegalHighq = document.getElementById("st2-mod-legal-highq");
const accessModLegalWestlaw = document.getElementById("st2-mod-legal-westlaw");
const accessModLegalCocounsel = document.getElementById("st2-mod-legal-cocounsel");
const accessModChileTransferencia = document.getElementById("st2-mod-chile-transferencia");
const accessModChileReferral = document.getElementById("st2-mod-chile-referral");
const accessModChileSaad = document.getElementById("st2-mod-chile-saad");
const accessModChileHr = document.getElementById("st2-mod-chile-hr");
const accessModChileWiki = document.getElementById("st2-mod-chile-wiki");
const accessModChileLp = document.getElementById("st2-mod-chile-lp");
const accessModChilePowerapps = document.getElementById("st2-mod-chile-powerapps");
const accessModSt2Admin = document.getElementById("st2-mod-st2-admin");
const accessModSt2AdminWrap = document.getElementById("st2-mod-st2-admin-wrap");
const accessModulesSqlGroup = document.getElementById("st2-access-modules-sql-group");
const accessModulesLegalGroup = document.getElementById("st2-access-modules-legal-group");
const accessModulesChileGroup = document.getElementById("st2-access-modules-chile-group");
const accessModulesSqlCard = document.getElementById("st2-access-modules-sql-card");
const accessModulesLegalCard = document.getElementById("st2-access-modules-legal-card");
const accessModulesChileCard = document.getElementById("st2-access-modules-chile-card");
const accessModulesSysExpandButtons = Array.from(document.querySelectorAll(".st2-access-modules-sys-expand"));
const viewAsBanner = document.getElementById("st2-view-as-banner");
const viewAsBannerText = document.getElementById("st2-view-as-banner-text");
const viewAsExitBtn = document.getElementById("st2-view-as-exit");
let accessModulesEmailValue = "";
let accessModulesSaving = false;
let accessModulesAfterApprove = false;
let accessModulesPresetMode = false;
const accessAdminSearch = document.getElementById("st2-access-admin-search");
const accessAdminModFilterButtons = Array.from(document.querySelectorAll(".st2-access-admin-perms-filter-opt"));
const accessAdminPermsFilterBtn = document.getElementById("st2-access-admin-perms-filter-btn");
const accessAdminPermsFilterPop = document.getElementById("st2-access-admin-perms-filter-pop");
const accessAdminPermsFilterMark = document.getElementById("st2-access-admin-perms-filter-mark");
const aboutToolsSection = document.getElementById("st2-about-tools");
const accessAdminKpiTotal = document.getElementById("st2-access-admin-kpi-total");
const accessAdminKpiActive = document.getElementById("st2-access-admin-kpi-active");
const accessAdminKpiPending = document.getElementById("st2-access-admin-kpi-pending");
const accessAdminKpiToday = document.getElementById("st2-access-admin-kpi-today");
const accessAdminKpiConcurrent = document.getElementById("st2-access-admin-kpi-concurrent");
const accessAdminKpiAttention = document.getElementById("st2-access-admin-kpi-attention");
const accessAdminDaySummary = document.getElementById("st2-access-admin-day-summary");
const accessAdminAudit = document.getElementById("st2-access-admin-audit");
const accessAdminAuditCount = document.getElementById("st2-access-admin-audit-count");
const accessAdminAuditList = document.getElementById("st2-access-admin-audit-list");
const accessAdminAuditActors = document.getElementById("st2-access-admin-audit-actors");
const accessAdminAuditDetail = document.getElementById("st2-access-admin-audit-detail");
const accessAdminAuditDetailTitle = document.getElementById("st2-access-admin-audit-detail-title");
const accessAdminAuditDetailList = document.getElementById("st2-access-admin-audit-detail-list");
const accessAdminAuditDetailClose = document.getElementById("st2-access-admin-audit-detail-close");
const accessAdminAuditMore = document.getElementById("st2-access-admin-audit-more");
const accessAdminExportBtn = document.getElementById("st2-access-admin-export");
const accessAdminQuickFilterButtons = Array.from(document.querySelectorAll(".st2-access-admin-quick-filter"));
const accessAdminInbox = document.getElementById("st2-access-admin-inbox");
const accessAdminTable = document.querySelector("#st2-access-admin-table-wrap .st2-access-admin-table");
const accessAdminThHost = document.getElementById("st2-access-admin-th-host");
const accessAdminThLast = document.getElementById("st2-access-admin-th-last");
const accessAdminThLogins = document.getElementById("st2-access-admin-th-logins");
const accessAdminPresetBtn = document.getElementById("st2-access-admin-preset");
async function apiGet(url, signal) {
  const response = await fetch(url, { signal, credentials: "include", cache: "no-store" });
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new Error(problem.detail || problem.error || problem.title || `Error ${response.status}`);
  }
  return response.json();
}

async function apiPost(url, body, signal) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new Error(problem.detail || problem.error || problem.title || `Error ${response.status}`);
  }
  return response.json();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(message) {
  if (statusText) statusText.textContent = message;
}

function getProfileFilteredPortals() {
  const all = appConfig?.portals ?? [];
  const allowed = new Set(listVisibleProfilePortals());
  return all.filter((p) => allowed.has(p.id));
}

function resolveActivePortalId(portals, preferredId = null) {
  if (!portals.length) return "";
  const fromPath = portalIdFromPath(window.location.pathname);
  const candidates = [preferredId, fromPath, activePortalId, appConfig?.defaultPortalId, portals[0]?.id];
  for (const id of candidates) {
    if (id && portals.some((p) => p.id === id)) return id;
  }
  return portals[0].id;
}

function getActivePortalConfig() {
  const portals = getProfileFilteredPortals();
  return portals.find((p) => p.id === activePortalId) || portals[0] || null;
}

function getPortalLoginUrl() {
  const cfg = getActivePortalConfig();
  const fromConfig = String(cfg?.loginUrl || "").trim();
  if (fromConfig) return fromConfig;
  const base = String(cfg?.portalBaseUrl || appConfig?.portalBaseUrl || "").trim().replace(/\/+$/, "");
  if (base) return `${base}/auth/login`;
  if (activePortalId === "legal") {
    return "https://portaldelcliente.thomsonreuters.com.ar/auth/login";
  }
  if (activePortalId === "chile") {
    return "https://centrodesoluciones.thomsonreuters.cl/auth/login";
  }
  return "https://clientes.thomsonreuters.com.ar/auth/login";
}

function getPortalExternalUrl() {
  return getPortalLoginUrl();
}

function portalPickerLabel(id, label) {
  const key = String(id || "").toLowerCase();
  if (key === "bejerman") return "SQL/ONVIO/WEB";
  if (key === "legal") return "LEGAL";
  if (key === "chile") return "CHILE";
  return String(label || id || "").trim() || key;
}

function initPortalPicker() {
  const portals = getProfileFilteredPortals();
  if (!portalSistemaPills) return;
  if (!portals.length) {
    portalSistemaPills.innerHTML = "";
    activePortalId = "";
    return;
  }

  activePortalId = resolveActivePortalId(portals);
  portalSistemaPills.innerHTML = portals
    .map(
      (p) =>
        `<button type="button" class="st2-context-btn${p.id === activePortalId ? " active" : ""}" data-portal-id="${escapeHtml(p.id)}" role="tab" aria-selected="${p.id === activePortalId ? "true" : "false"}">${escapeHtml(portalPickerLabel(p.id, p.label))}</button>`,
    )
    .join("");

  for (const btn of portalSistemaPills.querySelectorAll(".st2-context-btn")) {
    btn.addEventListener("click", () => switchPortal(btn.dataset.portalId));
  }
  syncPortalFrameTitle();
  syncPortalTabLabel();
}

function syncPortalTabLabel() {
  const label = getPortalClientTabLabel();
  const labelEl = document.getElementById("tabPortalBtnLabel");
  if (labelEl) labelEl.textContent = label;
  document.getElementById("tabPortalBtn")?.setAttribute("aria-label", label);
  portalSistemaPills?.setAttribute("aria-label", label);
}

function syncPortalFrameTitle() {
  const cfg = getActivePortalConfig();
  const portalLabel = getPortalClientTabLabel();
  const label = portalPickerLabel(activePortalId, cfg?.label) || activePortalId || portalLabel;
  if (portalFrame) portalFrame.title = `${portalLabel} · ${label}`;
}

function switchPortal(portalId, { history = "push" } = {}) {
  if (!portalId || !canSeeProfilePortal(portalId)) return;
  const same = portalId === activePortalId;
  activePortalId = portalId;

  for (const btn of portalSistemaPills?.querySelectorAll(".st2-context-btn") ?? []) {
    const active = btn.dataset.portalId === portalId;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  }
  syncPortalFrameTitle();

  if (history !== "none" && document.querySelector('.tab-btn.active[data-tab="portal"]')) {
    syncTabHistory("portal", history);
  }

  if (document.querySelector('.tab-btn.active[data-tab="portal"]')) {
    loadEmbedFrame("portal", { force: !same });
  }
}

function profileContextBarVisible(kind, tabId) {
  if (tabId !== kind) return false;
  return listVisibleProfilePortals().length > 1;
}

function syncProfilePortalAccess() {
  const visible = listVisibleProfilePortals();
  const visibleSet = new Set(visible);
  const showTabs = visible.length > 0;

  document.querySelectorAll("[data-thom-portal]").forEach((btn) => {
    const id = btn.dataset.thomPortal;
    const show = visibleSet.has(id);
    btn.classList.toggle("hidden", !show);
    btn.toggleAttribute("hidden", !show);
    btn.setAttribute("aria-hidden", show ? "false" : "true");
  });

  thomTabWrap?.classList.toggle("hidden", !showTabs);
  thomTabWrap?.toggleAttribute("hidden", !showTabs);
  portalTabWrap?.classList.toggle("hidden", !showTabs);
  portalTabWrap?.toggleAttribute("hidden", !showTabs);

  if (visible.length && !visibleSet.has(thomPortalId)) {
    setThomPortalId(visible[0]);
  } else {
    syncThomPortalUi();
  }

  if (appConfig) initPortalPicker();
  syncPortalTabLabel();

  const activeTab = document.querySelector(".tab-btn.active")?.dataset?.tab;
  if (!showTabs && (activeTab === "thom" || activeTab === "portal")) {
    navigateTab("planillas", { history: "replace" });
    return;
  }

  if (activeTab === "thom" || activeTab === "portal") {
    const tabId = activeTab;
    portalSistemaBar?.classList.toggle("hidden", !profileContextBarVisible("portal", tabId));
    thomPortalBar?.classList.toggle("hidden", !profileContextBarVisible("thom", tabId));
  }

  syncAboutNoticeCopy();
}

async function loadAppConfig() {
  appConfig = await apiGet("/api/app-config");
  initPortalPicker();
  syncProfilePortalAccess();
  applyEmbedZoom("thom");
  applyEmbedZoom("ai");
  applyEmbedZoom("portal");
  updateThomDirectUi();
  applyAboutUpdated();
  const activeThom = document.querySelector('.tab-btn.active[data-tab="thom"]');
  if (activeThom) activateThomTab();
  if (document.querySelector('.tab-btn.active[data-tab="portal"]')) {
    loadEmbedFrame("portal", { force: true });
  }
}

function getAboutVersionLabel() {
  if (appConfig?.webVersionLabel) return appConfig.webVersionLabel;
  const meta = document.querySelector('meta[name="st2-version-label"]');
  if (meta?.content?.trim()) return meta.content.trim();
  return "Esta web";
}

function getAboutUpdatedLabel() {
  const fromConfig = appConfig?.webUpdatedLabel?.trim();
  if (fromConfig) return fromConfig;
  const meta = document.querySelector('meta[name="st2-updated-label"]');
  if (meta?.content?.trim()) return meta.content.trim();
  return "Último update de la web: —";
}

function applyAboutUpdated() {
  if (!aboutUpdatedEl) return;
  aboutUpdatedEl.textContent = getAboutUpdatedLabel();
  aboutUpdatedEl.classList.remove("hidden");
}

/**
 * Parte tokens pegados sin separador: vanesageorgina → vanesa + georgina,
 * velasquezmunoz → velasquez + munoz.
 * Acepta corte si ambos son conocidos, o si uno es conocido y el otro parece nombre.
 */
function splitGluedAccessNamePart(raw, depth = 0) {
  const token = String(raw || "").trim();
  if (!token || depth > 2) return token ? [token] : [];
  const folded = foldAccessName(token).replace(/^\d+|\d+$/g, "");
  if (folded.length < 8) return [token];
  if (isAccessKnownNamePart(folded)) return [token];

  let best = null;
  let bestScore = -1;

  for (let i = 3; i <= folded.length - 3; i++) {
    const left = folded.slice(0, i);
    const right = folded.slice(i);
    const leftGiven = isAccessGivenName(left);
    const rightGiven = isAccessGivenName(right);
    const leftSur = isAccessSurname(left);
    const rightSur = isAccessSurname(right);
    const leftOk = leftGiven || leftSur;
    const rightOk = rightGiven || rightSur;
    const leftLooks = leftOk || (left.length >= 4 && /^[a-z]+$/.test(left));
    const rightLooks = rightOk || (right.length >= 4 && /^[a-z]+$/.test(right));

    if (!leftOk && !rightOk) continue;
    if (!leftLooks || !rightLooks) continue;

    let score = 0;
    if (leftGiven) score += 4;
    if (rightGiven) score += 4;
    if (leftSur) score += 3;
    if (rightSur) score += 3;
    if (leftOk && rightOk) score += 5;
    if (leftGiven && rightGiven) score += 3;
    if (leftSur && rightSur) score += 3;
    if (leftGiven && rightSur) score += 2;
    score += 1 - Math.abs(left.length - right.length) / folded.length;

    if (score > bestScore) {
      bestScore = score;
      best = [token.slice(0, i), token.slice(i)];
    }
  }

  if (!best) return [token];

  return best.flatMap((piece) => {
    const f = foldAccessName(piece);
    if (piece.length >= 8 && !isAccessKnownNamePart(f)) {
      return splitGluedAccessNamePart(piece, depth + 1);
    }
    return [piece];
  });
}

function titleAccessNameToken(raw) {
  const token = String(raw || "").replace(/^\d+|\d+$/g, "").trim();
  if (!token) return "";

  const lower = foldAccessName(token);
  if (ACCESS_NAME_ALIASES[lower]) return ACCESS_NAME_ALIASES[lower];

  if (token.includes("-")) {
    return token
      .split("-")
      .filter(Boolean)
      .map((piece) => titleAccessNameToken(piece))
      .filter(Boolean)
      .join("-");
  }

  if (ACCESS_NAME_PARTICLES.has(lower)) return lower;
  if (lower.length === 1) return lower.toUpperCase();

  if (/^mc[a-z]/i.test(lower)) {
    return `Mc${lower.slice(2, 3).toUpperCase()}${lower.slice(3)}`;
  }
  if (/^mac[a-z]{2,}/i.test(lower)) {
    return `Mac${lower.slice(3, 4).toUpperCase()}${lower.slice(4)}`;
  }
  if (/^o'[a-z]/i.test(lower)) {
    return `O'${lower.slice(2, 3).toUpperCase()}${lower.slice(3)}`;
  }

  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function tokenizeAccessEmailLocal(local) {
  return String(local || "")
    .split(/[._+]+/)
    .map((part) => part.replace(/^\d+|\d+$/g, "").trim())
    .filter(Boolean)
    .filter((part) => !/^(ext|tr|temp|test|usr|user)$/i.test(part))
    .flatMap((part) => splitGluedAccessNamePart(part));
}

function parseAccessNameFromEmail(email) {
  const local = String(email || "").split("@")[0].trim();
  const rawParts = tokenizeAccessEmailLocal(local);
  const parts = rawParts.map(titleAccessNameToken).filter(Boolean);
  if (!parts.length) {
    return { firstName: "", secondName: "", lastName: "", secondLastName: "", display: email || "—" };
  }

  let firstName = "";
  let secondName = "";
  let lastName = "";
  let secondLastName = "";

  if (parts.length === 1) {
    firstName = parts[0];
  } else if (parts.length === 2) {
    firstName = parts[0];
    lastName = parts[1];
  } else if (parts.length === 3) {
    const middleRaw = foldAccessName(rawParts[1] || "");
    const middleIsGiven = ACCESS_NAME_PARTICLES.has(middleRaw) || isAccessGivenName(middleRaw);
    if (middleIsGiven) {
      firstName = parts[0];
      secondName = parts[1];
      lastName = parts[2];
    } else {
      firstName = parts[0];
      lastName = parts[1];
      secondLastName = parts[2];
    }
  } else {
    firstName = parts[0];
    secondName = parts.slice(1, -2).join(" ");
    lastName = parts[parts.length - 2];
    secondLastName = parts[parts.length - 1];
  }

  const ordered = [firstName, secondName, lastName, secondLastName].filter(Boolean);
  const merged = [];
  for (let i = 0; i < ordered.length; i++) {
    const cur = ordered[i];
    const bits = cur.split(/\s+/);
    let j = 0;
    while (j < bits.length) {
      if (ACCESS_NAME_PARTICLES.has(foldAccessName(bits[j]))) {
        const particleRun = [];
        while (j < bits.length && ACCESS_NAME_PARTICLES.has(foldAccessName(bits[j]))) {
          particleRun.push(foldAccessName(bits[j]));
          j++;
        }
        if (j < bits.length) {
          merged.push(`${particleRun.join(" ")} ${bits[j]}`);
          j++;
        } else if (i + 1 < ordered.length) {
          ordered[i + 1] = `${particleRun.join(" ")} ${ordered[i + 1]}`;
        } else {
          merged.push(particleRun.join(" "));
        }
      } else {
        merged.push(bits[j]);
        j++;
      }
    }
  }

  return {
    firstName,
    secondName,
    lastName,
    secondLastName,
    display: merged.join(" ").replace(/\s+/g, " ").trim() || email || "—",
  };
}

function formatAccessDisplayName(email, override) {
  const custom = String(override || "").trim();
  if (custom) return custom;
  return parseAccessNameFromEmail(email).display;
}

function formatAccessDate(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAccessRelative(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  if (date.toDateString() === new Date().toDateString()) {
    return `hoy ${date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return formatAccessDateCompact(iso);
}

function formatAccessDateCompact(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const now = new Date();
  const opts = {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  };
  if (date.getFullYear() !== now.getFullYear()) {
    opts.year = "2-digit";
  }
  return date.toLocaleString("es-AR", opts);
}

/** @type {"lastSeen" | "loginCount"} */
let accessAdminSortKey = "lastSeen";
/** @type {"desc" | "asc"} */
let accessAdminSortDir = "desc";

function sortAccessAdminItems(items) {
  const dir = accessAdminSortDir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (a.isPending !== b.isPending) return a.isPending ? -1 : 1;
    if (a.isRejected !== b.isRejected) return a.isRejected ? 1 : -1;
    if (accessAdminSortKey === "loginCount") {
      const cmp = (Number(a.loginCount) || 0) - (Number(b.loginCount) || 0);
      if (cmp !== 0) return cmp * dir;
      const aTime = new Date(a.lastSeenAt).getTime();
      const bTime = new Date(b.lastSeenAt).getTime();
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
    }

    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    if (a.isUnseenNew !== b.isUnseenNew) return a.isUnseenNew ? -1 : 1;
    const aTime = new Date(a.lastSeenAt).getTime();
    const bTime = new Date(b.lastSeenAt).getTime();
    const cmp = (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime);
    return cmp * dir;
  });
}

function syncAccessAdminSortHeaders() {
  const headers = document.querySelectorAll(".st2-access-admin-th-sort");
  headers.forEach((th) => {
    if (!(th instanceof HTMLElement)) return;
    const key = th.dataset.sort || "";
    const mark = th.querySelector(".st2-access-admin-sort-mark");
    const active = key === accessAdminSortKey;
    th.classList.toggle("is-sorted", active);
    if (active) {
      const desc = accessAdminSortDir === "desc";
      th.setAttribute("aria-sort", desc ? "descending" : "ascending");
      if (mark) mark.textContent = desc ? "↓" : "↑";
    } else {
      th.setAttribute("aria-sort", "none");
      if (mark) mark.textContent = "";
    }
  });
}

function setAccessAdminSort(key) {
  if (key !== "lastSeen" && key !== "loginCount") return;
  if (accessAdminSortKey === key) {
    accessAdminSortDir = accessAdminSortDir === "desc" ? "asc" : "desc";
  } else {
    accessAdminSortKey = key;
    accessAdminSortDir = "desc";
  }
  accessAdminItemsCache = sortAccessAdminItems(accessAdminItemsCache);
  syncAccessAdminSortHeaders();
  renderAccessAdminTable();
}

const ACCESS_ADMIN_SEEN_KEY = "st2-access-admin-seen-v1";

let accessAdminLoading = false;
let accessAdminPollTimer = null;
let accessAdminLastSnapshot = "";
let accessAdminLastActiveEmails = [];
let accessAdminLastKnownEmails = [];
let accessAdminItemsCache = [];
let accessAdminMeta = { activeCount: 0, activeWindowMinutes: 5 };
let accessAdminQuery = "";
let accessAdminListFilter = "";
let accessAdminModFilters = new Set();
let accessAdminPermsFilterOpen = false;
let accessAdminLastClientByEmail = new Map();
let accessAdminClientWatchReady = false;
let accessAdminClientWatchTimer = null;
let accessAdminClientChangedEmails = new Set();
let accessAdminClientWatchBusy = false;
let accessAdminAuditToday = [];
let accessAdminConcurrentCount = 0;
let accessAdminAuditShowAll = false;
let accessAdminAuditDetailEmail = "";

function resolveAccessDeviceShort(item) {
  const raw = String(item?.lastClientDevice || "").trim().toLowerCase();
  if (/^[a-z0-9-]{6,32}$/.test(raw)) return raw.slice(0, 8);
  const hint = String(item?.lastClientHint || "");
  const m = hint.match(/\bid:([a-z0-9-]{6,32})\b/i);
  return m ? m[1].slice(0, 8).toLowerCase() : "";
}

function resolveAccessBrowserLabel(item) {
  const fromApi = String(item?.lastClientBrowser || "").trim();
  if (fromApi) return fromApi.replace(/\s+\d+(\.\d+)*$/, "").trim() || fromApi;
  const hint = String(item?.lastClientHint || "");
  if (/\bEdge\b/i.test(hint)) return "Edge";
  if (/\bChrome\b/i.test(hint)) return "Chrome";
  if (/\bFirefox\b/i.test(hint)) return "Firefox";
  if (/\bSafari\b/i.test(hint)) return "Safari";
  if (/\bOpera\b/i.test(hint)) return "Opera";
  return "";
}

function formatAccessClientLabel(item) {
  const browser = resolveAccessBrowserLabel(item);
  const device = resolveAccessDeviceShort(item);
  if (browser && device) return `${browser} · ${device}`;
  if (device) return `id ${device}`;
  if (browser) return browser;
  return item?.lastClientLabel
    || item?.lastClientHost
    || item?.lastClientHint
    || item?.lastClientIp
    || "";
}

function buildAccessClientKey(item) {
  // Prioridad: device id (estable por navegador). La IP de Zscaler no entra en la clave.
  const device = resolveAccessDeviceShort(item);
  if (device) return `d:${device}`;

  const hint = String(item?.lastClientHint || "").trim().toLowerCase();
  if (hint) return `h:${hint}`;

  const browser = resolveAccessBrowserLabel(item).toLowerCase();
  if (browser) return `b:${browser}`;

  return "";
}

function normalizeAccessBrowserFamily(label) {
  const b = String(label || "").trim().toLowerCase();
  if (b.startsWith("edge")) return "edge";
  if (b.startsWith("chrome") || b.startsWith("chromium")) return "chrome";
  if (b.startsWith("firefox")) return "firefox";
  if (b.startsWith("safari")) return "safari";
  if (b.startsWith("opera")) return "opera";
  return b;
}

/** Edge ↔ Chrome en el mismo usuario es habitual; no alertar. */
function isBenignCrossBrowserSwap(prevBrowser, nextBrowser) {
  const a = normalizeAccessBrowserFamily(prevBrowser);
  const b = normalizeAccessBrowserFamily(nextBrowser);
  if (!a || !b || a === b) return false;
  const pair = new Set([a, b]);
  return pair.has("edge") && pair.has("chrome");
}

function isBenignClientKeyMigration(prevKey, nextKey) {
  if (!prevKey || !nextKey || prevKey === nextKey) return false;
  // Primera vez que aparece device id tras el deploy: no alertar.
  if (nextKey.startsWith("d:") && !prevKey.startsWith("d:")) return true;
  // Formato viejo host|ip|hint → nuevo sin IP.
  if (prevKey.includes("|") && !nextKey.includes("|")) return true;
  return false;
}

function isBenignAccessClientChange(prev, next) {
  if (!prev || !next || prev.key === next.key) return true;
  if (isBenignClientKeyMigration(prev.key, next.key)) return true;
  // Mismo device id con otro label: no es cambio de equipo.
  if (prev.device && next.device && prev.device === next.device) return true;
  // Cambiar entre Edge y Chrome (perfiles distintos) no implica otra persona.
  if (isBenignCrossBrowserSwap(prev.browser, next.browser)) return true;
  return false;
}

function buildAccessAdminExtraModules(item) {
  const mods = item.modules || {};
  const extras = [];
  if (mods.oportunidad) extras.push("Oportunidad");
  if (mods.pdfPortal) extras.push("PDF Portal");
  if (mods.blanqueoConfirm && mods.blanqueoLoad) extras.push("Blanqueo (confirma y carga)");
  else if (mods.blanqueoConfirm) extras.push("Blanqueo (solo confirma)");
  else if (mods.blanqueoLoad || mods.blanqueo) extras.push("Blanqueo");
  if (mods.borradoBasesConfirm && mods.borradoBasesLoad) extras.push("Borrado de bases (confirma y carga)");
  else if (mods.borradoBasesConfirm) extras.push("Borrado de bases (solo confirma)");
  else if (mods.borradoBasesLoad || mods.borradoBases) extras.push("Borrado de bases");
  return extras;
}

function buildAccessAdminPermsCell(item) {
  const mods = item.modules || {};
  const systems = [];
  if (mods.planillasSqlOnvio) systems.push({ key: "sql", label: "SQL", title: "Bejerman SQL / ONVIO / WEB" });
  if (mods.planillasLegal) systems.push({ key: "leg", label: "LEG", title: "LEGAL" });
  if (mods.planillasChile) systems.push({ key: "cl", label: "CL", title: "Chile" });
  if (item.isSt2Admin) systems.push({ key: "adm", label: "ADM", title: "Administrador web (ADMIN)" });
  const extras = buildAccessAdminExtraModules(item);
  if (!systems.length && !extras.length) {
    return '<span class="st2-access-admin-perm-empty">—</span>';
  }
  const sysHtml = systems.map((sys) => (
    `<span class="st2-access-admin-perm-sys st2-access-admin-perm-sys--${sys.key} is-on" title="${escapeHtml(sys.title)}">${escapeHtml(sys.label)}</span>`
  )).join("");
  const extrasHtml = extras.length
    ? `<details class="st2-access-admin-perm-detail">
        <summary class="st2-access-admin-perm-more-btn" aria-label="Ver ${extras.length} módulo${extras.length === 1 ? "" : "s"} extra">+</summary>
        <div class="st2-access-admin-perm-pop" role="list">
          ${extras.map((label) => `<span class="st2-access-admin-perm-pop-item" role="listitem">${escapeHtml(label)}</span>`).join("")}
        </div>
      </details>`
    : "";
  return `<div class="st2-access-admin-perms-col">${sysHtml}${extrasHtml}</div>`;
}

function resetAccessAdminPermPop(pop) {
  if (!pop) return;
  pop.classList.remove("is-floating");
  pop.style.removeProperty("position");
  pop.style.removeProperty("top");
  pop.style.removeProperty("left");
  pop.style.removeProperty("z-index");
}

function positionAccessAdminPermPop(detail) {
  const summary = detail.querySelector(".st2-access-admin-perm-more-btn");
  const pop = detail.querySelector(".st2-access-admin-perm-pop");
  if (!summary || !pop) return;
  resetAccessAdminPermPop(pop);
  const rect = summary.getBoundingClientRect();
  pop.classList.add("is-floating");
  pop.style.position = "fixed";
  pop.style.zIndex = "1200";
  const margin = 8;
  requestAnimationFrame(() => {
    const popRect = pop.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + popRect.width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - popRect.width - margin);
    }
    if (top + popRect.height > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - popRect.height - 6);
    }
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  });
}

function closeAllAccessAdminPermPops() {
  accessAdminBody?.querySelectorAll(".st2-access-admin-perm-detail[open]").forEach((detail) => {
    detail.open = false;
    resetAccessAdminPermPop(detail.querySelector(".st2-access-admin-perm-pop"));
  });
}

function applyAccessAdminClientWatch(items, { notify = true, showHint = true } = {}) {
  if (!isPrimarySuperAdmin() || accessAdminClientWatchBusy) return [];

  accessAdminClientWatchBusy = true;
  try {
  const changes = [];
  const nextMap = new Map();

  for (const item of items) {
    if (!item.email || item.isPending) continue;
    const key = buildAccessClientKey(item);
    if (!key) continue;
    nextMap.set(item.email, {
      key,
      label: formatAccessClientLabel(item) || key,
      displayName: formatAccessDisplayName(item.email, item.displayNameOverride),
      browser: resolveAccessBrowserLabel(item),
      device: resolveAccessDeviceShort(item),
    });
  }

  if (!accessAdminClientWatchReady) {
    accessAdminLastClientByEmail = nextMap;
    accessAdminClientWatchReady = true;
    return [];
  }

  for (const [email, next] of nextMap.entries()) {
    const prev = accessAdminLastClientByEmail.get(email);
    if (!prev) continue;
    if (isBenignAccessClientChange(prev, next)) continue;
    // Solo alertar fuerte si es el mismo navegador (p. ej. dos Edge / dos Chrome) u otro cambio no benigno.
    const sameBrowser = normalizeAccessBrowserFamily(prev.browser)
      && normalizeAccessBrowserFamily(prev.browser) === normalizeAccessBrowserFamily(next.browser);
    changes.push({
      email,
      displayName: next.displayName,
      previousLabel: prev.label,
      nextLabel: next.label,
      sameBrowser,
    });
  }

  accessAdminLastClientByEmail = nextMap;

  if (!notify || !changes.length) return changes;

  // Acumular atención en panel (⚠ en Equipo / pestaña ADMIN). Sin push de escritorio.
  for (const c of changes) accessAdminClientChangedEmails.add(c.email);
  syncAdminClientAttentionUi();

  if (showHint) {
    const nowLabel = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    setAccessAdminUpdatedHint(`${formatAccessClientChangeHint(changes)} · ${nowLabel}`);
  }

  return changes;
  } finally {
    accessAdminClientWatchBusy = false;
  }
}

function formatAccessClientChangeHint(changes) {
  if (!changes?.length) return "";
  if (changes.length > 1) return `⚠ ${changes.length} posibles equipos distintos`;
  const first = changes[0];
  const prefix = first.sameBrowser
    ? `⚠ Mismo navegador, otro equipo: ${first.displayName}`
    : `⚠ Equipo distinto: ${first.displayName}`;
  const trail = first.previousLabel && first.nextLabel
    ? ` · ${first.previousLabel} → ${first.nextLabel}`
    : first.nextLabel
      ? ` · ${first.nextLabel}`
      : "";
  return `${prefix}${trail}`;
}

async function pollAccessAdminClientWatch() {
  if (!isPrimarySuperAdmin()) return;
  try {
    const response = await fetch("/api/access/registrations", { credentials: "include" });
    if (!response.ok) return;
    const data = await response.json().catch(() => ({}));
    const rawItems = Array.isArray(data.items) ? data.items : [];
    const items = normalizeAccessAdminItems(rawItems);
    const changes = applyAccessAdminClientWatch(items, { notify: true, showHint: false });

    const onAdminTab = !!document.querySelector(`.tab-btn.active[data-tab="${ADMIN_TAB_ID}"]`);
    if (changes.length && onAdminTab) {
      const known = new Map(accessAdminItemsCache.map((item) => [item.email, item]));
      let touched = false;
      for (const item of items) {
        if (!known.has(item.email)) continue;
        known.set(item.email, { ...known.get(item.email), ...item });
        touched = true;
      }
      if (touched) {
        accessAdminItemsCache = sortAccessAdminItems([...known.values()]);
        renderAccessAdminTable();
      }
      const nowLabel = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
      setAccessAdminUpdatedHint(`${formatAccessClientChangeHint(changes)} · ${nowLabel}`);
    }
  } catch {
    /* ignore */
  }
}

function startAccessAdminClientWatch() {
  if (!isPrimarySuperAdmin() || accessAdminClientWatchTimer) return;
  void pollAccessAdminClientWatch();
  accessAdminClientWatchTimer = setInterval(() => {
    void pollAccessAdminClientWatch();
  }, 30000);
}

function stopAccessAdminClientWatch() {
  if (!accessAdminClientWatchTimer) return;
  clearInterval(accessAdminClientWatchTimer);
  accessAdminClientWatchTimer = null;
}

/** Cartelito ⚠ en pestaña ADMIN / columna Equipo cuando alguien cambió de terminal. */
function syncAdminClientAttentionUi() {
  const n = accessAdminClientChangedEmails.size;
  tabAdminBtn?.classList.toggle("has-client-attention", n > 0 && isPrimarySuperAdmin());
  if (n > 0) {
    tabAdminBtn?.setAttribute("title", n === 1
      ? "Un usuario cambió de equipo"
      : `${n} usuarios cambiaron de equipo`);
  } else if (tabAdminBtn && !tabAdminBtn.title?.includes("administración")) {
    tabAdminBtn.title = "Panel de administración de accesos";
  }
  const thAttn = document.getElementById("st2-access-admin-host-attention");
  if (thAttn) {
    thAttn.classList.toggle("hidden", n === 0);
    thAttn.setAttribute("aria-hidden", n === 0 ? "true" : "false");
    thAttn.textContent = n > 0 ? "⚠" : "";
  }
  if (accessAdminKpiAttention) accessAdminKpiAttention.textContent = String(n);
}

function clearAdminClientAttention() {
  if (!accessAdminClientChangedEmails.size) return;
  accessAdminClientChangedEmails.clear();
  syncAdminClientAttentionUi();
}

function syncAdminTabVisibility() {
  const show = isSt2SuperAdmin();
  tabAdminBtn?.classList.toggle("hidden", !show);
  tabAdminBtn?.setAttribute("aria-hidden", show ? "false" : "true");
  if (!show && document.querySelector(`.tab-btn.active[data-tab="${ADMIN_TAB_ID}"]`)) {
    navigateTab("planillas", { history: "replace" });
  }
  syncAboutNoticeCopy();
}

function updateAdminTabBadge() {
  if (!adminTabBadge || !isSt2SuperAdmin()) return;
  const pending = accessAdminItemsCache.filter((item) => item.isPending).length;
  const label = pending > 99 ? "99+" : String(pending);
  adminTabBadge.textContent = label;
  adminTabBadge.classList.toggle("hidden", pending === 0);
  adminTabBadge.setAttribute("aria-hidden", pending ? "false" : "true");
}

function loadAccessAdminSeenMap() {
  try {
    const raw = localStorage.getItem(ACCESS_ADMIN_SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveAccessAdminSeenMap(map) {
  try {
    localStorage.setItem(ACCESS_ADMIN_SEEN_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / private mode */
  }
}

function hasAdminSeenAccessEmail(email) {
  if (!email) return false;
  return !!loadAccessAdminSeenMap()[email.trim().toLowerCase()];
}

function markAccessAdminEmailsAsSeen(items) {
  const map = loadAccessAdminSeenMap();
  const today = new Date().toISOString().slice(0, 10);
  let changed = false;
  for (const item of items) {
    if (!item.isNewToday || !item.email) continue;
    const key = item.email.trim().toLowerCase();
    if (!map[key]) {
      map[key] = today;
      changed = true;
    }
  }
  for (const key of Object.keys(map)) {
    const day = String(map[key] || "");
    if (day.length !== 10) {
      delete map[key];
      changed = true;
      continue;
    }
    const ageMs = Date.now() - new Date(`${day}T12:00:00`).getTime();
    if (Number.isFinite(ageMs) && ageMs > 3 * 86400000) {
      delete map[key];
      changed = true;
    }
  }
  if (changed) saveAccessAdminSeenMap(map);
}

function normalizeAccessModules(modules) {
  const m = modules || {};
  return {
    oportunidad: !!(m.oportunidad ?? m.Oportunidad),
    pdfPortal: !!(m.pdfPortal ?? m.PdfPortal),
    blanqueo: !!(m.blanqueo ?? m.Blanqueo),
    blanqueoConfirm: !!(m.blanqueoConfirm ?? m.BlanqueoConfirm),
    blanqueoLoad: m.blanqueoLoad == null && m.BlanqueoLoad == null
      ? !!(m.blanqueo ?? m.Blanqueo) && !(m.blanqueoConfirm ?? m.BlanqueoConfirm)
      : !!(m.blanqueoLoad ?? m.BlanqueoLoad),
    borradoBases: !!(m.borradoBases ?? m.BorradoBases),
    borradoBasesConfirm: !!(m.borradoBasesConfirm ?? m.BorradoBasesConfirm),
    borradoBasesLoad: m.borradoBasesLoad == null && m.BorradoBasesLoad == null
      ? !!(m.borradoBases ?? m.BorradoBases) && !(m.borradoBasesConfirm ?? m.BorradoBasesConfirm)
      : !!(m.borradoBasesLoad ?? m.BorradoBasesLoad),
    planillasSqlOnvio: m.planillasSqlOnvio == null && m.PlanillasSqlOnvio == null
      ? true
      : !!(m.planillasSqlOnvio ?? m.PlanillasSqlOnvio),
    planillasTransferencia: m.planillasTransferencia == null && m.PlanillasTransferencia == null
      ? true
      : !!(m.planillasTransferencia ?? m.PlanillasTransferencia),
    planillasReferral: m.planillasReferral == null && m.PlanillasReferral == null
      ? true
      : !!(m.planillasReferral ?? m.PlanillasReferral),
    planillasLegal: m.planillasLegal == null && m.PlanillasLegal == null
      ? true
      : !!(m.planillasLegal ?? m.PlanillasLegal),
    legalFirm: m.legalFirm == null && m.LegalFirm == null
      ? true
      : !!(m.legalFirm ?? m.LegalFirm),
    legalHighq: m.legalHighq == null && m.LegalHighq == null
      ? true
      : !!(m.legalHighq ?? m.LegalHighq),
    legalWestlaw: m.legalWestlaw == null && m.LegalWestlaw == null
      ? true
      : !!(m.legalWestlaw ?? m.LegalWestlaw),
    legalCocounsel: m.legalCocounsel == null && m.LegalCocounsel == null
      ? true
      : !!(m.legalCocounsel ?? m.LegalCocounsel),
    planillasChile: m.planillasChile == null && m.PlanillasChile == null
      ? true
      : !!(m.planillasChile ?? m.PlanillasChile),
    chileTransferencia: m.chileTransferencia == null && m.ChileTransferencia == null
      ? true
      : !!(m.chileTransferencia ?? m.ChileTransferencia),
    chileReferral: m.chileReferral == null && m.ChileReferral == null
      ? true
      : !!(m.chileReferral ?? m.ChileReferral),
    chileSaad: m.chileSaad == null && m.ChileSaad == null
      ? true
      : !!(m.chileSaad ?? m.ChileSaad),
    chileHr: m.chileHr == null && m.ChileHr == null
      ? true
      : !!(m.chileHr ?? m.ChileHr),
    chileWiki: m.chileWiki == null && m.ChileWiki == null
      ? true
      : !!(m.chileWiki ?? m.ChileWiki),
    chileLp: m.chileLp == null && m.ChileLp == null
      ? true
      : !!(m.chileLp ?? m.ChileLp),
    chilePowerapps: m.chilePowerapps == null && m.ChilePowerapps == null
      ? true
      : !!(m.chilePowerapps ?? m.ChilePowerapps),
  };
}

function normalizeAccessAdminItems(items) {
  return items.map((item) => {
    const email = item.email || item.Email || "";
    const status = String(item.status || item.Status || "approved").toLowerCase();
    const isPending = !!(item.isPending ?? item.IsPending) || status === "pending";
    const isRejected = !!(item.isRejected ?? item.IsRejected) || status === "rejected";
    const isNewToday = !!(item.isNewToday ?? item.IsNewToday);
    const displayNameOverride = (item.displayName ?? item.DisplayName ?? "").trim() || null;
    const birthdayDisplay = (item.birthdayDisplay ?? item.BirthdayDisplay ?? "").trim() || null;
    const birthdayMmDd = (item.birthdayMmDd ?? item.BirthdayMmDd ?? "").trim() || null;
    const modules = item.modules || item.Modules || {};
    return {
      email,
      displayNameOverride,
      birthdayDisplay,
      birthdayMmDd,
      firstSeenAt: item.firstSeenAt || item.FirstSeenAt || "",
      lastSeenAt: item.lastSeenAt || item.LastSeenAt || "",
      lastLoginAt: item.lastLoginAt || item.LastLoginAt || "",
      loginCount: item.loginCount ?? item.LoginCount ?? 0,
      status,
      isPending,
      isRejected,
      loggedInToday: !!(item.loggedInToday ?? item.LoggedInToday),
      isSt2Admin: !!(item.isSt2Admin ?? item.IsSt2Admin),
      isActive: !!(item.isActive ?? item.IsActive),
      isNewToday,
      isUnseenNew: isNewToday && !hasAdminSeenAccessEmail(email),
      isReturning: !!(item.isReturning ?? item.IsReturning),
      lastClientLabel: (item.lastClientLabel ?? item.LastClientLabel ?? "").trim() || null,
      lastClientIp: (item.lastClientIp ?? item.LastClientIp ?? "").trim() || null,
      lastClientHost: (item.lastClientHost ?? item.LastClientHost ?? "").trim() || null,
      lastClientHint: (item.lastClientHint ?? item.LastClientHint ?? "").trim() || null,
      lastClientDevice: (item.lastClientDevice ?? item.LastClientDevice ?? "").trim() || null,
      lastClientBrowser: (item.lastClientBrowser ?? item.LastClientBrowser ?? "").trim() || null,
      hasConcurrentSessions: !!(item.hasConcurrentSessions ?? item.HasConcurrentSessions),
      activeDeviceCount: Number(item.activeDeviceCount ?? item.ActiveDeviceCount ?? 0) || 0,
      clientHistory: Array.isArray(item.clientHistory ?? item.ClientHistory)
        ? (item.clientHistory ?? item.ClientHistory).map((h) => ({
          label: String(h.label ?? h.Label ?? "").trim(),
          browser: String(h.browser ?? h.Browser ?? "").trim(),
          deviceId: String(h.deviceId ?? h.DeviceId ?? "").trim(),
          lastSeenAt: String(h.lastSeenAt ?? h.LastSeenAt ?? ""),
          firstSeenAt: String(h.firstSeenAt ?? h.FirstSeenAt ?? ""),
        }))
        : [],
      modules: normalizeAccessModules(modules),
    };
  });
}

function buildAccessAdminSnapshot(items, activeCount) {
  return JSON.stringify({
    total: items.length,
    activeCount,
    activeEmails: items.filter((item) => item.isActive).map((item) => item.email).sort(),
    emails: items.map((item) => item.email).sort(),
    rows: items.map((item) => ({
      email: item.email,
      firstSeenAt: item.firstSeenAt,
      lastSeenAt: item.lastSeenAt,
      loginCount: item.loginCount,
      isActive: item.isActive,
      isNewToday: item.isNewToday,
      isPending: item.isPending,
      status: item.status,
      loggedInToday: item.loggedInToday,
      displayNameOverride: item.displayNameOverride || "",
    })),
  });
}

function getNewActiveEmails(previousActive, currentActive) {
  const prev = new Set(previousActive);
  return currentActive.filter((email) => !prev.has(email));
}

function getNewRegistrationEmails(previousEmails, currentEmails) {
  if (!previousEmails.length) return [];
  const prev = new Set(previousEmails);
  return currentEmails.filter((email) => !prev.has(email));
}

function resetAccessAdminSnapshot() {
  accessAdminLastSnapshot = "";
  accessAdminLastActiveEmails = [];
  accessAdminLastKnownEmails = [];
  accessAdminItemsCache = [];
  accessAdminMeta = { activeCount: 0, activeWindowMinutes: 5 };
  accessAdminQuery = "";
  accessAdminListFilter = "";
  accessAdminModFilters = new Set();
  accessAdminAuditToday = [];
  accessAdminConcurrentCount = 0;
  accessAdminAuditShowAll = false;
  accessAdminAuditDetailEmail = "";
  if (accessAdminSearch) accessAdminSearch.value = "";
  closeAccessAdminPermsFilterPop();
  syncAccessAdminModFilterUi();
  syncAccessAdminQuickFilters();
}

function itemMatchesModFilters(item) {
  if (!accessAdminModFilters.size) return true;
  const mods = item.modules || {};
  for (const key of accessAdminModFilters) {
    if (key === "sql" && mods.planillasSqlOnvio) return true;
    if (key === "leg" && mods.planillasLegal) return true;
    if (key === "cl" && mods.planillasChile) return true;
    if (key === "adm" && item.isSt2Admin) return true;
  }
  return false;
}

function syncAccessAdminModFilterUi() {
  accessAdminModFilterButtons.forEach((btn) => {
    const key = String(btn.dataset.modFilter || "").trim();
    btn.classList.toggle("active", accessAdminModFilters.has(key));
  });
  const has = accessAdminModFilters.size > 0;
  accessAdminPermsFilterBtn?.classList.toggle("is-filtering", has);
  accessAdminPermsFilterBtn?.setAttribute("aria-expanded", accessAdminPermsFilterOpen ? "true" : "false");
  if (accessAdminPermsFilterMark) {
    if (!has) {
      accessAdminPermsFilterMark.textContent = "";
      accessAdminPermsFilterMark.classList.add("hidden");
    } else {
      const labels = { sql: "SQL", leg: "LEG", cl: "CL", adm: "ADM" };
      accessAdminPermsFilterMark.textContent = [...accessAdminModFilters].map((key) => labels[key] || key).join(" · ");
      accessAdminPermsFilterMark.classList.remove("hidden");
    }
  }
}

function positionAccessAdminPermsFilterPop() {
  if (!accessAdminPermsFilterBtn || !accessAdminPermsFilterPop) return;
  const rect = accessAdminPermsFilterBtn.getBoundingClientRect();
  const margin = 8;
  accessAdminPermsFilterPop.style.position = "fixed";
  accessAdminPermsFilterPop.style.zIndex = "1200";
  requestAnimationFrame(() => {
    const popRect = accessAdminPermsFilterPop.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + popRect.width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - popRect.width - margin);
    }
    if (top + popRect.height > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - popRect.height - 6);
    }
    accessAdminPermsFilterPop.style.left = `${left}px`;
    accessAdminPermsFilterPop.style.top = `${top}px`;
  });
}

function openAccessAdminPermsFilterPop() {
  if (!accessAdminPermsFilterPop || !accessAdminPermsFilterBtn) return;
  closeAllAccessAdminPermPops();
  accessAdminPermsFilterOpen = true;
  accessAdminPermsFilterPop.hidden = false;
  accessAdminPermsFilterPop.classList.remove("hidden");
  syncAccessAdminModFilterUi();
  positionAccessAdminPermsFilterPop();
}

function closeAccessAdminPermsFilterPop() {
  if (!accessAdminPermsFilterPop) return;
  accessAdminPermsFilterOpen = false;
  accessAdminPermsFilterPop.hidden = true;
  accessAdminPermsFilterPop.classList.add("hidden");
  accessAdminPermsFilterPop.style.removeProperty("position");
  accessAdminPermsFilterPop.style.removeProperty("top");
  accessAdminPermsFilterPop.style.removeProperty("left");
  accessAdminPermsFilterPop.style.removeProperty("z-index");
  syncAccessAdminModFilterUi();
}

function toggleAccessAdminPermsFilterPop() {
  if (accessAdminPermsFilterOpen) closeAccessAdminPermsFilterPop();
  else openAccessAdminPermsFilterPop();
}

function updateAccessAdminSummaryLine() {
  syncAccessAdminOwnerOnlyUi();
  const ownerOnly = isPrimarySuperAdmin();
  const total = accessAdminItemsCache.filter((item) => !item.isRejected).length;
  const pending = accessAdminItemsCache.filter((item) => item.isPending).length;
  const today = accessAdminItemsCache.filter((item) => item.loggedInToday).length;
  const concurrent = ownerOnly
    ? accessAdminItemsCache.filter((item) => item.hasConcurrentSessions).length
    : 0;
  const attention = ownerOnly ? accessAdminClientChangedEmails.size : 0;
  const { activeCount } = accessAdminMeta;
  if (accessAdminKpiTotal) accessAdminKpiTotal.textContent = String(total);
  if (accessAdminKpiActive) accessAdminKpiActive.textContent = String(activeCount);
  if (accessAdminKpiPending) accessAdminKpiPending.textContent = String(pending);
  if (accessAdminKpiToday) accessAdminKpiToday.textContent = String(today);
  if (ownerOnly && accessAdminKpiConcurrent) {
    accessAdminKpiConcurrent.textContent = String(concurrent || accessAdminConcurrentCount || 0);
  }
  if (ownerOnly && accessAdminKpiAttention) accessAdminKpiAttention.textContent = String(attention);
  renderAccessAdminDaySummary({ total, pending, today, concurrent: concurrent || accessAdminConcurrentCount || 0, attention, activeCount });
  renderAccessAdminAudit();
  updateAdminTabBadge();
  renderAccessAdminInbox();
}

function syncAccessAdminOwnerOnlyUi() {
  const show = isPrimarySuperAdmin();
  document.querySelectorAll(".st2-access-admin-owner-only").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.hidden = !show;
    if (!show) el.classList.add("hidden");
  });
  document.getElementById("st2-access-admin-kpis")?.classList.toggle("is-owner-extra", show);
  if (!show && (accessAdminListFilter === "attention" || accessAdminListFilter === "concurrent")) {
    accessAdminListFilter = "";
    syncAccessAdminQuickFilters();
  }
}

function formatAccessAuditAction(action) {
  switch (String(action || "").toLowerCase()) {
    case "approve": return "aprobó";
    case "reject": return "rechazó";
    case "modules": return "cambió módulos de";
    case "view_as": return "vio como";
    case "preset": return "creó perfil";
    default: return action || "actuó sobre";
  }
}

function shortAccessActor(email) {
  const raw = String(email || "").trim();
  if (!raw) return "admin";
  const at = raw.indexOf("@");
  return at > 0 ? raw.slice(0, at) : raw;
}

function renderAccessAdminDaySummary({ total, pending, today, concurrent, attention, activeCount }) {
  if (!accessAdminDaySummary) return;
  if (!isPrimarySuperAdmin()) {
    accessAdminDaySummary.classList.add("hidden");
    accessAdminDaySummary.hidden = true;
    accessAdminDaySummary.textContent = "";
    return;
  }
  const parts = [
    `${activeCount} activos ahora`,
    `${today} ingresaron hoy`,
  ];
  if (pending) parts.push(`${pending} pendientes`);
  if (concurrent) parts.push(`${concurrent} con sesiones concurrentes`);
  if (attention) parts.push(`${attention} con aviso de equipo`);
  accessAdminDaySummary.textContent = `Hoy · ${parts.join(" · ")} · ${total} en lista`;
  accessAdminDaySummary.classList.remove("hidden");
  accessAdminDaySummary.hidden = false;
}

function formatAccessAuditLine(row) {
  const when = formatAccessRelative(row.createdAt);
  const actor = shortAccessActor(row.actorEmail);
  const target = shortAccessActor(row.targetEmail);
  const verb = formatAccessAuditAction(row.action);
  return {
    when,
    actor,
    target,
    verb,
    html: `${escapeHtml(when)} · <strong>${escapeHtml(actor)}</strong> ${escapeHtml(verb)} <strong>${escapeHtml(target)}</strong>`,
    title: `${row.actorEmail || ""} → ${row.targetEmail || ""}`,
  };
}

function isAccessAuditAdminWebActor(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e || e === PRIMARY_ADMIN_EMAIL) return false;
  const item = accessAdminItemsCache.find((row) => String(row.email || "").toLowerCase() === e);
  if (item) return !!item.isSt2Admin;
  // Actuó en el panel y no sos vos: lo mostramos igual (p. ej. cookie admin / ex-admin).
  return true;
}

function buildAccessAuditActorSummaries(rows) {
  const byActor = new Map();
  for (const row of rows) {
    const email = String(row.actorEmail || "").trim().toLowerCase();
    if (!isAccessAuditAdminWebActor(email)) continue;
    if (!byActor.has(email)) byActor.set(email, []);
    byActor.get(email).push(row);
  }
  return [...byActor.entries()]
    .map(([email, actions]) => {
      const sorted = [...actions].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      const latest = sorted[0];
      const line = formatAccessAuditLine(latest);
      return {
        email,
        count: sorted.length,
        latest,
        latestLabel: `${line.verb} ${line.target}`,
        when: line.when,
        actions: sorted,
      };
    })
    .sort((a, b) => String(b.latest?.createdAt || "").localeCompare(String(a.latest?.createdAt || "")));
}

function closeAccessAdminAuditDetail() {
  accessAdminAuditDetailEmail = "";
  if (accessAdminAuditDetail) {
    accessAdminAuditDetail.classList.add("hidden");
    accessAdminAuditDetail.hidden = true;
  }
  if (accessAdminAuditDetailList) accessAdminAuditDetailList.innerHTML = "";
  if (accessAdminAuditDetailTitle) accessAdminAuditDetailTitle.textContent = "Detalle";
  accessAdminAuditActors?.querySelectorAll("[data-audit-actor]").forEach((btn) => {
    btn.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
  });
}

function openAccessAdminAuditDetail(email, { toggle = true } = {}) {
  if (!isPrimarySuperAdmin()) return;
  const target = String(email || "").trim().toLowerCase();
  if (!target) return;
  if (toggle && accessAdminAuditDetailEmail === target) {
    closeAccessAdminAuditDetail();
    return;
  }
  const rows = (accessAdminAuditToday || [])
    .filter((row) => String(row.actorEmail || "").toLowerCase() === target)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 10);
  accessAdminAuditDetailEmail = target;
  if (accessAdminAuditDetailTitle) {
    accessAdminAuditDetailTitle.textContent = `${shortAccessActor(target)} · ${rows.length} acción${rows.length === 1 ? "" : "es"}`;
  }
  if (accessAdminAuditDetailList) {
    accessAdminAuditDetailList.innerHTML = rows.map((row) => {
      const line = formatAccessAuditLine(row);
      return `<li title="${escapeHtml(line.title)}">${line.html}</li>`;
    }).join("");
  }
  if (accessAdminAuditDetail) {
    accessAdminAuditDetail.classList.remove("hidden");
    accessAdminAuditDetail.hidden = false;
  }
  accessAdminAuditActors?.querySelectorAll("[data-audit-actor]").forEach((btn) => {
    const open = String(btn.dataset.auditActor || "").toLowerCase() === target;
    btn.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });
}

function renderAccessAdminAudit() {
  if (!accessAdminAudit || !accessAdminAuditList) return;
  if (!isPrimarySuperAdmin()) {
    accessAdminAudit.classList.add("hidden");
    accessAdminAudit.hidden = true;
    accessAdminAuditList.innerHTML = "";
    if (accessAdminAuditActors) {
      accessAdminAuditActors.innerHTML = "";
      accessAdminAuditActors.hidden = true;
    }
    closeAccessAdminAuditDetail();
    if (accessAdminAuditMore) {
      accessAdminAuditMore.classList.add("hidden");
      accessAdminAuditMore.hidden = true;
    }
    if (accessAdminAuditCount) accessAdminAuditCount.textContent = "";
    return;
  }
  const rows = Array.isArray(accessAdminAuditToday) ? accessAdminAuditToday : [];
  if (!rows.length) {
    accessAdminAudit.classList.add("hidden");
    accessAdminAuditList.innerHTML = "";
    if (accessAdminAuditActors) {
      accessAdminAuditActors.innerHTML = "";
      accessAdminAuditActors.hidden = true;
    }
    closeAccessAdminAuditDetail();
    if (accessAdminAuditMore) {
      accessAdminAuditMore.classList.add("hidden");
      accessAdminAuditMore.hidden = true;
    }
    if (accessAdminAuditCount) accessAdminAuditCount.textContent = "";
    return;
  }
  accessAdminAudit.classList.remove("hidden");
  accessAdminAudit.hidden = false;
  if (accessAdminAuditCount) {
    accessAdminAuditCount.textContent = rows.length === 1 ? "1 acción" : `${rows.length} acciones`;
  }

  const summaries = buildAccessAuditActorSummaries(rows);
  if (accessAdminAuditActors) {
    if (!summaries.length) {
      accessAdminAuditActors.innerHTML = "";
      accessAdminAuditActors.hidden = true;
      closeAccessAdminAuditDetail();
    } else {
      accessAdminAuditActors.hidden = false;
      accessAdminAuditActors.innerHTML = summaries.map((sum) => {
        const open = accessAdminAuditDetailEmail === sum.email;
        const countLabel = sum.count === 1 ? "1 acción" : `${sum.count} acciones`;
        return `<li>
          <button type="button" class="st2-access-admin-audit-actor${open ? " is-open" : ""}" data-audit-actor="${escapeHtml(sum.email)}" aria-expanded="${open ? "true" : "false"}" title="Ver detalle de ${escapeHtml(sum.email)}">
            <span class="st2-access-admin-audit-actor-main"><strong>${escapeHtml(shortAccessActor(sum.email))}</strong> · ${escapeHtml(countLabel)}</span>
            <span class="st2-access-admin-audit-actor-last">última: ${escapeHtml(sum.latestLabel)} · ${escapeHtml(sum.when)}</span>
          </button>
        </li>`;
      }).join("");
      if (accessAdminAuditDetailEmail && !summaries.some((s) => s.email === accessAdminAuditDetailEmail)) {
        closeAccessAdminAuditDetail();
      } else if (accessAdminAuditDetailEmail) {
        openAccessAdminAuditDetail(accessAdminAuditDetailEmail, { toggle: false });
      }
    }
  }

  const limit = accessAdminAuditShowAll ? 40 : 5;
  const recent = [...rows]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
  accessAdminAuditList.innerHTML = recent.map((row) => {
    const line = formatAccessAuditLine(row);
    return `<li title="${escapeHtml(line.title)}">${line.html}</li>`;
  }).join("");

  if (accessAdminAuditMore) {
    const canMore = rows.length > 5;
    accessAdminAuditMore.hidden = !canMore;
    accessAdminAuditMore.classList.toggle("hidden", !canMore);
    accessAdminAuditMore.textContent = accessAdminAuditShowAll ? "Ver menos" : `Ver más (${rows.length - 5})`;
  }
}

function syncAccessAdminQuickFilters() {
  accessAdminQuickFilterButtons.forEach((btn) => {
    const key = btn.dataset.listFilter || "";
    btn.classList.toggle("is-on", key === accessAdminListFilter);
  });
}

function setAccessAdminListFilter(key) {
  accessAdminListFilter = key || "";
  syncAccessAdminQuickFilters();
  renderAccessAdminTable();
}

function exportAccessAdminCsv() {
  const items = getFilteredAccessAdminItems();
  const headers = ["Nombre", "Email", "Permisos", "Equipo", "Último acceso", "Ingresos", "Activo", "Concurrente"];
  const lines = [headers.join(",")];
  for (const item of items) {
    const name = formatAccessDisplayName(item.email, item.displayNameOverride);
    const mods = item.modules || {};
    const perms = [
      mods.planillasSqlOnvio ? "SQL" : "",
      mods.planillasLegal ? "LEG" : "",
      mods.planillasChile ? "CL" : "",
      item.isSt2Admin ? "ADM" : "",
    ].filter(Boolean).join("|");
    const row = [
      name,
      item.email,
      perms,
      formatAccessClientLabel(item) || "",
      formatAccessDate(item.lastSeenAt),
      String(item.loginCount ?? 0),
      item.isActive ? "sí" : "no",
      item.hasConcurrentSessions ? "sí" : "no",
    ].map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`);
    lines.push(row.join(","));
  }
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `st2-accesos-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function renderAccessAdminInbox() {
  if (!accessAdminInbox) return;
  const pending = accessAdminItemsCache.filter((item) => item.isPending);
  if (!pending.length) {
    accessAdminInbox.classList.add("hidden");
    accessAdminInbox.innerHTML = "";
    return;
  }
  accessAdminInbox.classList.remove("hidden");
  accessAdminInbox.innerHTML = `
    <div class="st2-access-admin-inbox-head">
      <strong>Solicitudes nuevas</strong>
      <span>${pending.length}</span>
    </div>
    ${pending.map((item) => {
      const name = formatAccessDisplayName(item.email, item.displayNameOverride);
      return `<div class="st2-access-admin-inbox-row" data-email="${escapeHtml(item.email)}">
        <div>
          <p class="st2-access-admin-inbox-name">${escapeHtml(name)}</p>
          <p class="st2-access-admin-inbox-mail">${escapeHtml(item.email)}</p>
        </div>
        <div class="st2-access-admin-inbox-actions">
          <button type="button" class="st2-access-admin-approve" data-approve-email="${escapeHtml(item.email)}">Aprobar</button>
          <button type="button" class="st2-access-admin-reject" data-reject-email="${escapeHtml(item.email)}">Rechazar</button>
        </div>
      </div>`;
    }).join("")}`;
}

function setAccessAdminUpdatedHint(text) {
  if (!accessAdminUpdated) return;
  if (!text) {
    accessAdminUpdated.textContent = "";
    accessAdminUpdated.classList.add("hidden");
    return;
  }
  accessAdminUpdated.textContent = text;
  accessAdminUpdated.classList.remove("hidden");
}

/** Admin web y owner: Nombre, Permisos, Equipo, Último acceso, Ingresos. */
function canSeeAccessAdminOwnerColumns() {
  return isSt2SuperAdmin();
}

function syncAccessAdminHostColumn() {
  accessAdminPresetBtn?.classList.toggle("hidden", !isSt2SuperAdmin());
  const showOwnerCols = canSeeAccessAdminOwnerColumns();
  accessAdminThHost?.classList.toggle("hidden", !showOwnerCols);
  accessAdminThLast?.classList.toggle("hidden", !showOwnerCols);
  accessAdminThLogins?.classList.toggle("hidden", !showOwnerCols);
  accessAdminTable?.classList.toggle("is-admin-web-compact", !showOwnerCols);
}

function getFilteredAccessAdminItems() {
  const q = accessAdminQuery.trim().toLowerCase();
  return accessAdminItemsCache.filter((item) => {
    // Pendientes van solo al inbox; rechazados no se listan.
    if (item.isRejected || item.isPending) return false;
    if (accessAdminListFilter === "active" && !item.isActive) return false;
    if (accessAdminListFilter === "attention" && !accessAdminClientChangedEmails.has(item.email)) return false;
    if (accessAdminListFilter === "concurrent" && !item.hasConcurrentSessions) return false;
    if (!itemMatchesModFilters(item)) return false;
    if (q) {
      const email = item.email.toLowerCase();
      const name = formatAccessDisplayName(item.email, item.displayNameOverride).toLowerCase();
      const host = String(formatAccessClientLabel(item) || item.lastClientIp || "").toLowerCase();
      if (!email.includes(q) && !name.includes(q) && !host.includes(q)) return false;
    }
    return true;
  });
}

function renderAccessAdminTable() {
  syncAccessAdminHostColumn();
  const items = getFilteredAccessAdminItems();
  if (!accessAdminBody) return;

  if (!accessAdminItemsCache.length) {
    accessAdminStatus.textContent = "Todavía no hay accesos registrados.";
    accessAdminToolbar?.classList.add("hidden");
    accessAdminTableWrap?.classList.add("hidden");
    accessAdminBody.innerHTML = "";
    return;
  }

  accessAdminToolbar?.classList.remove("hidden");

  if (!items.length) {
    accessAdminStatus.textContent = accessAdminQuery.trim()
      ? "Sin resultados para esa búsqueda."
      : accessAdminListFilter === "active"
        ? "Nadie activo ahora."
        : accessAdminListFilter === "attention"
          ? "Nadie con aviso de equipo."
          : accessAdminListFilter === "concurrent"
            ? "Nadie con sesiones concurrentes."
            : accessAdminModFilters.size
              ? "Nadie coincide con ese filtro de permisos."
              : "Sin usuarios en la lista.";
    accessAdminBody.innerHTML = "";
    accessAdminTableWrap?.classList.remove("hidden");
    return;
  }

  accessAdminStatus.textContent = "";
  accessAdminBody.innerHTML = items.map((item) => {
    const badges = [];
    if (item.isPending) {
      badges.push('<span class="st2-access-admin-pending-tag" title="Esperando aprobación">Pendiente</span>');
    }
    if (item.isUnseenNew) {
      badges.push('<span class="st2-access-admin-new-user" title="Primer ingreso hoy">Nuevo</span>');
    }
    const showOwnerCols = canSeeAccessAdminOwnerColumns();
    const liveHtml = showOwnerCols && item.isActive
      ? '<span class="st2-access-admin-live" title="Activo ahora"><span class="st2-access-admin-live-dot" aria-hidden="true"></span></span>'
      : "";
    const badgeHtml = badges.length
      ? `<span class="st2-access-admin-email-badges">${badges.join("")}</span>`
      : "";
    const rowClass = [
      item.isPending ? "is-pending" : "",
      item.isActive ? "is-active" : "",
      item.isUnseenNew ? "is-new" : "",
      accessAdminClientChangedEmails.has(item.email) ? "is-client-changed" : "",
    ].filter(Boolean).join(" ");
    const displayName = formatAccessDisplayName(item.email, item.displayNameOverride);
    const permsHtml = buildAccessAdminPermsCell(item);
    const hostLabel = formatAccessClientLabel(item) || "—";
    const deviceShort = resolveAccessDeviceShort(item);
    const browserLabel = resolveAccessBrowserLabel(item);
    const entornoHint = String(item.lastClientHint || "")
      .replace(/\s*·\s*id:[a-z0-9-]{6,32}\b/gi, "")
      .replace(/\bid:[a-z0-9-]{6,32}\b/gi, "")
      .replace(/\s*·\s*(Edge|Chrome|Firefox|Safari|Opera)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^[·\s]+|[·\s]+$/g, "")
      .trim();
    const historyLines = (item.clientHistory || [])
      .slice(0, 5)
      .map((h) => `${h.label || "—"}${h.lastSeenAt ? ` (${formatAccessRelative(h.lastSeenAt)})` : ""}`);
    const showOwnerSignals = isPrimarySuperAdmin();
    const hostTitle = [
      showOwnerSignals && item.hasConcurrentSessions ? `⚠ Sesiones concurrentes (${item.activeDeviceCount || 2}+ equipos)` : "",
      browserLabel ? `Navegador: ${browserLabel}` : "",
      deviceShort ? `Dispositivo: ${deviceShort}` : "",
      entornoHint ? `Entorno: ${entornoHint}` : "",
      item.lastClientHost ? `Host: ${item.lastClientHost}` : "",
      item.lastClientIp ? `IP: ${item.lastClientIp}` : "",
      showOwnerSignals && historyLines.length ? `Historial:\n- ${historyLines.join("\n- ")}` : "",
    ].filter(Boolean).join("\n") || hostLabel;
    const historyHint = showOwnerSignals && historyLines.length > 1
      ? `<span class="st2-access-admin-host-meta">${escapeHtml(historyLines.length)} equipos recientes</span>`
      : "";
    const concurrentHint = showOwnerSignals && item.hasConcurrentSessions
      ? `<span class="st2-access-admin-host-meta st2-access-admin-host-concurrent">concurrente ×${escapeHtml(String(item.activeDeviceCount || 2))}</span>`
      : "";
    const hostCell = showOwnerCols
      ? `<td class="st2-access-admin-host${accessAdminClientChangedEmails.has(item.email) ? " is-client-attn" : ""}" title="${escapeHtml(hostTitle)}">${
          accessAdminClientChangedEmails.has(item.email)
            ? `<span class="st2-access-admin-host-attn" title="Cambió de equipo">⚠</span> `
            : ""
        }${escapeHtml(hostLabel)}${concurrentHint}${historyHint}</td>`
      : "";
    const lastSeenCell = showOwnerCols
      ? `<td class="st2-access-admin-date" title="${escapeHtml(formatAccessDate(item.lastSeenAt))}">${escapeHtml(formatAccessRelative(item.lastSeenAt))}</td>`
      : "";
    const loginsCell = showOwnerCols
      ? `<td class="st2-access-admin-num" title="Días distintos que abrió ST2: ${escapeHtml(String(item.loginCount))}">${escapeHtml(String(item.loginCount))}</td>`
      : "";
    const ownerActions = isPrimarySuperAdmin();
    const canPreview = isSt2SuperAdmin();
    const extraActions = item.isPending
      ? `<button type="button" class="st2-access-admin-approve" data-approve-email="${escapeHtml(item.email)}" title="Aprobar acceso">Aprobar</button>
             <button type="button" class="st2-access-admin-reject" data-reject-email="${escapeHtml(item.email)}" title="Rechazar solicitud">Rechazar</button>`
      : `${canPreview ? `<button type="button" class="st2-access-admin-preview" data-preview-email="${escapeHtml(item.email)}" title="Ver como ve este perfil" aria-label="Vista previa del perfil de ${escapeHtml(displayName)}"><svg class="st2-access-admin-preview-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" fill="currentColor"/></svg></button>` : ""}
        <button type="button" class="st2-access-admin-edit${item.displayNameOverride ? " is-custom" : ""}" data-modules-email="${escapeHtml(item.email)}" title="Editar perfil y módulos" aria-label="Editar perfil y módulos de ${escapeHtml(displayName)}"><svg class="st2-access-admin-edit-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="M13.2 6.3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg></button>
        ${ownerActions ? `<button type="button" class="st2-access-admin-delete" data-delete-email="${escapeHtml(item.email)}" title="Eliminar acceso" aria-label="Eliminar ${escapeHtml(displayName)}">×</button>` : ""}`;
    return `<tr class="${rowClass}" data-email="${escapeHtml(item.email)}">
      <td class="st2-access-admin-email-cell">
        <div class="st2-access-admin-email-row">
          ${liveHtml}
          <span class="st2-access-admin-email" title="${escapeHtml(item.email)}">${escapeHtml(displayName)}</span>
          ${badgeHtml}
        </div>
      </td>
      <td class="st2-access-admin-mods-cell">${permsHtml}</td>
      ${hostCell}
      ${lastSeenCell}
      ${loginsCell}
      <td class="st2-access-admin-actions-cell">
        ${extraActions}
      </td>
    </tr>`;
  }).join("");
  syncAdminClientAttentionUi();
  accessAdminTableWrap?.classList.remove("hidden");
}

function closeAccessNameEditModal() {
  accessNameEditOverlay?.classList.add("hidden");
  accessNameEditEmailValue = "";
  accessNameEditAutoValue = "";
  if (accessNameEditError) accessNameEditError.textContent = "";
  if (accessNameEditInput) accessNameEditInput.value = "";
  if (accessNameEditSave) accessNameEditSave.disabled = false;
}

function openAccessNameEditModal(email) {
  if (!accessNameEditOverlay || !email) return;
  const current = accessAdminItemsCache.find((item) => item.email === email);
  accessNameEditEmailValue = email;
  accessNameEditAutoValue = parseAccessNameFromEmail(email).display;
  if (accessNameEditEmail) accessNameEditEmail.textContent = email;
  if (accessNameEditSuggest) accessNameEditSuggest.textContent = accessNameEditAutoValue;
  if (accessNameEditInput) {
    accessNameEditInput.value = formatAccessDisplayName(email, current?.displayNameOverride);
  }
  if (accessNameEditError) accessNameEditError.textContent = "";
  accessNameEditOverlay.classList.remove("hidden");
  accessNameEditInput?.focus();
  accessNameEditInput?.select();
}

async function saveAccessNameEdit(displayName) {
  if (!accessNameEditEmailValue || accessNameEditSaving) return;
  accessNameEditSaving = true;
  if (accessNameEditSave) accessNameEditSave.disabled = true;
  if (accessNameEditError) accessNameEditError.textContent = "";

  const email = accessNameEditEmailValue;
  const value = String(displayName || "").trim();

  try {
    const response = await fetch("/api/access/registrations", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, displayName: value || null }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      closeAccessNameEditModal();
      setAccessAdminUpdatedHint("No tenés permiso para editar el nombre.");
      return;
    }
    if (!response.ok) {
      if (accessNameEditError) accessNameEditError.textContent = data.error || "No se pudo guardar el nombre.";
      return;
    }
    accessAdminItemsCache = accessAdminItemsCache.map((item) => (
      item.email === email
        ? { ...item, displayNameOverride: value || null }
        : item
    ));
    accessAdminLastSnapshot = buildAccessAdminSnapshot(accessAdminItemsCache, accessAdminMeta.activeCount);
    renderAccessAdminTable();
    closeAccessNameEditModal();
    setAccessAdminUpdatedHint(value ? `Nombre guardado: ${value}` : "Nombre automático restaurado.");
  } catch {
    if (accessNameEditError) accessNameEditError.textContent = "No se pudo contactar al servidor.";
  } finally {
    accessNameEditSaving = false;
    if (accessNameEditSave) accessNameEditSave.disabled = false;
  }
}

function editAccessAdminDisplayName(email) {
  openAccessNameEditModal(email);
}

async function decideAccessAdminEmail(email, action) {
  if (!email) return;
  const current = accessAdminItemsCache.find((item) => item.email === email);
  const name = formatAccessDisplayName(email, current?.displayNameOverride);
  if (action === "reject") {
    const ok = await confirmSt2({
      title: "Rechazar acceso",
      body: `¿Rechazar el acceso de ${name}?`,
      detail: email,
      confirmLabel: "Rechazar",
    });
    if (!ok) return;
  }
  try {
    const response = await fetch("/api/access/registrations/decision", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, action }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      setAccessAdminUpdatedHint("No tenés permiso para esa acción.");
      return;
    }
    if (!response.ok) {
      setAccessAdminUpdatedHint(data.error || "No se pudo actualizar la solicitud.");
      return;
    }
    await loadAccessAdminRegistrations({ silent: true, force: true });
    setAccessAdminUpdatedHint(action === "approve" ? `Aprobado: ${name}` : `Rechazado: ${name}`);
    notifyAccessChanged();
    if (action === "approve") {
      openAccessModulesModal(email, { afterApprove: true });
    }
  } catch {
    setAccessAdminUpdatedHint("No se pudo contactar al servidor.");
  }
}

async function deleteAccessAdminEmail(email) {
  if (!email) return;
  const current = accessAdminItemsCache.find((item) => item.email === email);
  const name = formatAccessDisplayName(email, current?.displayNameOverride);
  const ok = await confirmSt2({
    title: "Eliminar acceso",
    body: `¿Eliminar el acceso de ${name}? Esta acción no se puede deshacer.`,
    detail: email,
    confirmLabel: "Eliminar",
  });
  if (!ok) return;

  try {
    const response = await fetch(`/api/access/registrations?email=${encodeURIComponent(email)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      setAccessAdminUpdatedHint("Solo el dueño de ST2 puede quitar un acceso.");
      return;
    }
    if (!response.ok) {
      setAccessAdminUpdatedHint(data.error || "No se pudo eliminar.");
      return;
    }
    accessAdminItemsCache = accessAdminItemsCache.filter((item) => item.email !== email);
    accessAdminMeta.activeCount = accessAdminItemsCache.filter((item) => item.isActive).length;
    accessAdminLastKnownEmails = accessAdminItemsCache.map((item) => item.email);
    accessAdminLastActiveEmails = accessAdminItemsCache.filter((item) => item.isActive).map((item) => item.email);
    accessAdminLastSnapshot = buildAccessAdminSnapshot(accessAdminItemsCache, accessAdminMeta.activeCount);
    updateAccessAdminSummaryLine();
    renderAccessAdminTable();
    setAccessAdminUpdatedHint(`Eliminado: ${email}`);
    notifyAccessChanged();
  } catch {
    setAccessAdminUpdatedHint("No se pudo contactar al servidor.");
  }
}

function stopAccessAdminPolling() {
  if (accessAdminPollTimer) {
    clearInterval(accessAdminPollTimer);
    accessAdminPollTimer = null;
  }
}

function startAccessAdminPolling() {
  stopAccessAdminPolling();
  accessAdminPollTimer = setInterval(() => {
    if (!document.querySelector(`.tab-btn.active[data-tab="${ADMIN_TAB_ID}"]`)) {
      stopAccessAdminPolling();
      return;
    }
    void loadAccessAdminRegistrations({ silent: true, auto: true });
  }, 20000);
}

function showAccessAdminLogin() {
  accessAdminLogin?.classList.remove("hidden");
  accessAdminPanel?.classList.add("hidden");
  if (accessAdminError) accessAdminError.textContent = "";
  if (accessAdminPass) accessAdminPass.value = "";
}

function showAccessAdminPanel() {
  accessAdminLogin?.classList.add("hidden");
  accessAdminPanel?.classList.remove("hidden");
  syncAccessAdminOwnerOnlyUi();
}

async function activateAdminTab() {
  if (!isSt2SuperAdmin()) {
    navigateTab("planillas", { history: "replace" });
    return;
  }

  showAccessAdminPanel();
  syncAccessAdminHostColumn();
  syncAccessAdminOwnerOnlyUi();
  void loadAccessAdminRegistrations();
  startAccessAdminPolling();
}

function leaveAdminTab() {
  markAccessAdminEmailsAsSeen(accessAdminItemsCache);
  stopAccessAdminPolling();
  resetAccessAdminSnapshot();
}

async function submitAccessAdminLogin() {
  const username = accessAdminUser?.value.trim() || "";
  const password = accessAdminPass?.value || "";
  if (accessAdminError) accessAdminError.textContent = "";
  if (!username || !password) {
    if (accessAdminError) accessAdminError.textContent = "Completá usuario y contraseña.";
    return;
  }

  accessAdminSubmit.disabled = true;
  try {
    const response = await fetch("/api/access/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      credentials: "include",
    });
    const raw = await response.text();
    let data = {};
    if (raw.trim()) {
      try {
        data = JSON.parse(raw);
      } catch {
        if (accessAdminError) {
          accessAdminError.textContent = response.status === 404
            ? "Panel no configurado en el servidor (faltan variables de admin)."
            : `Respuesta inválida del servidor (${response.status}).`;
        }
        return;
      }
    }
    if (response.status === 404) {
      if (accessAdminError) {
        accessAdminError.textContent = data.error
          || "Panel no configurado en el servidor (faltan variables de admin).";
      }
      return;
    }
    if (!response.ok) {
      if (accessAdminError) {
        accessAdminError.textContent = data.error || "Usuario o contraseña incorrectos.";
      }
      return;
    }
    showAccessAdminPanel();
    await loadAccessAdminRegistrations();
    startAccessAdminPolling();
  } catch {
    if (accessAdminError) accessAdminError.textContent = "No se pudo contactar al servidor.";
  } finally {
    accessAdminSubmit.disabled = false;
  }
}

async function loadAccessAdminRegistrations({ silent = false, force = false, auto = false } = {}) {
  if (!accessAdminStatus || accessAdminLoading) return;
  accessAdminLoading = true;
  accessAdminRefresh?.classList.toggle("is-loading", force || !silent);

  if (!silent) {
    accessAdminStatus.textContent = "Cargando…";
    accessAdminTableWrap?.classList.add("hidden");
    accessAdminToolbar?.classList.add("hidden");
  }

  try {
    const response = await fetch("/api/access/registrations", { credentials: "include" });
    if (response.status === 404) {
      accessAdminStatus.textContent = "Panel no disponible.";
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      accessAdminStatus.textContent = "No tenés permiso para ver este panel.";
      return;
    }
    if (!response.ok) {
      accessAdminStatus.textContent = data.error || "No se pudo cargar la lista.";
      return;
    }

    const rawItems = Array.isArray(data.items) ? data.items : [];
    const items = sortAccessAdminItems(normalizeAccessAdminItems(rawItems));
    const activeCount = data.activeCount ?? items.filter((item) => item.isActive).length;
    const snapshot = buildAccessAdminSnapshot(items, activeCount);
    const activeEmails = items.filter((item) => item.isActive).map((item) => item.email);
    const allEmails = items.map((item) => item.email);
    const newActiveEmails = getNewActiveEmails(accessAdminLastActiveEmails, activeEmails);
    const newRegistrationEmails = getNewRegistrationEmails(accessAdminLastKnownEmails, allEmails);
    const clientChanges = applyAccessAdminClientWatch(items, { notify: true, showHint: false });

    if (auto && !force && snapshot === accessAdminLastSnapshot && !clientChanges.length) {
      return;
    }

    accessAdminLastSnapshot = snapshot;
    accessAdminLastActiveEmails = activeEmails;
    accessAdminLastKnownEmails = allEmails;
    accessAdminItemsCache = items;
    accessAdminMeta = {
      activeCount,
      activeWindowMinutes: data.activeWindowMinutes ?? 5,
    };
    accessAdminConcurrentCount = Number(data.concurrentCount ?? 0) || 0;
    accessAdminAuditToday = Array.isArray(data.auditToday)
      ? data.auditToday.map((row) => ({
        id: row.id,
        createdAt: row.createdAt || "",
        actorEmail: row.actorEmail || "",
        action: row.action || "",
        targetEmail: row.targetEmail || "",
        detail: row.detail || null,
      }))
      : [];

    updateAccessAdminSummaryLine();

    const nowLabel = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    const newPending = items.filter((item) => item.isPending && newRegistrationEmails.includes(item.email));
    if (clientChanges.length > 0) {
      setAccessAdminUpdatedHint(`${formatAccessClientChangeHint(clientChanges)} · ${nowLabel}`);
    } else if (newPending.length > 0) {
      const label = newPending.length === 1
        ? `Nueva solicitud: ${newPending[0].email}`
        : `${newPending.length} solicitudes nuevas`;
      setAccessAdminUpdatedHint(`${label} · ${nowLabel}`);
    } else if (newRegistrationEmails.length > 0) {
      const label = newRegistrationEmails.length === 1
        ? `Nuevo registro: ${newRegistrationEmails[0]}`
        : `${newRegistrationEmails.length} registros nuevos`;
      setAccessAdminUpdatedHint(`${label} · ${nowLabel}`);
    } else if (newActiveEmails.length > 0) {
      setAccessAdminUpdatedHint(`Nuevo activo · ${nowLabel}`);
    } else if (!silent || force) {
      setAccessAdminUpdatedHint(`Actualizado ${nowLabel}`);
    }

    renderAccessAdminTable();
  } catch {
    if (!silent) accessAdminStatus.textContent = "No se pudo contactar al servidor.";
  } finally {
    accessAdminLoading = false;
    accessAdminRefresh?.classList.remove("is-loading");
  }
}

const TOOLS_SEEN_KEY = "st2-tools-notice-v3";
const aboutToolsBadge = document.getElementById("about-tools-badge");
const aboutToolsStatus = document.getElementById("st2-about-tools-status");
const toolsBanner = document.getElementById("st2-tools-banner");
const toolsBannerText = document.getElementById("st2-tools-banner-text");
let cachedTools = [];
let toolsBound = false;
let aboutClaveCopyBound = false;
let toolsBannerBound = false;

function readSeenToolVersions() {
  try {
    return JSON.parse(localStorage.getItem(TOOLS_SEEN_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writeSeenToolVersions(map) {
  try {
    localStorage.setItem(TOOLS_SEEN_KEY, JSON.stringify(map || {}));
  } catch { /* ignore */ }
}

function formatToolSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function setAboutToolsStatus(msg, isError = false) {
  if (!aboutToolsStatus) return;
  aboutToolsStatus.textContent = msg || "";
  aboutToolsStatus.classList.toggle("hidden", !msg);
  aboutToolsStatus.classList.toggle("is-error", !!isError && !!msg);
}

function normalizeTool(t) {
  if (!t || typeof t !== "object") return t;
  return {
    id: t.id || t.Id,
    name: t.name || t.Name,
    available: t.available ?? t.Available,
    version: t.version || t.Version || "",
    fileName: t.fileName || t.FileName || "",
    sizeBytes: t.sizeBytes ?? t.SizeBytes ?? 0,
    updatedAtUtc: t.updatedAtUtc || t.UpdatedAtUtc || "",
    uploadedLabel: t.uploadedLabel || t.UploadedLabel || "",
  };
}

function metaToolLabel(id) {
  return String(document.querySelector(`meta[name="st2-tool-${id}-uploaded"]`)?.content || "").trim();
}

function metaToolStamp(id) {
  return String(document.querySelector(`meta[name="st2-tool-${id}-stamp"]`)?.content || "").trim();
}

function toolsFromMeta() {
  return ["sql", "bat"]
    .map((id) => {
      const stamp = metaToolStamp(id);
      const uploadedLabel = metaToolLabel(id);
      if (!stamp && !uploadedLabel) return null;
      return {
        id,
        available: true,
        version: stamp,
        updatedAtUtc: stamp,
        uploadedLabel,
      };
    })
    .filter(Boolean);
}

function toolsForNotice() {
  const api = (cachedTools || []).filter((t) => t?.available && toolIdentity(t));
  return api.length ? api : toolsFromMeta();
}

function paintToolDatesFromMeta() {
  for (const id of ["sql", "bat"]) {
    const label = uploadedLabelFor(id, null);
    const el = document.querySelector(`[data-tool-date="${id}"]`);
    if (!el || !label) continue;
    el.hidden = false;
    el.removeAttribute("hidden");
    el.textContent = label;
  }
}

function uploadedLabelFor(id, tool) {
  const raw = String(tool?.uploadedLabel || "").trim();
  if (raw) return raw.startsWith("Subido") ? raw : `Subido ${raw}`;
  const when = formatToolUpdatedAt(tool);
  if (when) return `Subido ${when}`;
  const meta = metaToolLabel(id);
  if (meta) return meta.startsWith("Subido") ? meta : `Subido ${meta}`;
  return "";
}

function listNewTools() {
  const seen = readSeenToolVersions();
  // Avisos home: solo SQL. BAT queda en Acerca de (mesa técnica).
  return toolsForNotice().filter((t) => {
    if (!t?.available || t.id === "bat") return false;
    const stamp = toolIdentity(t);
    return !!stamp && seen[t.id] !== stamp;
  });
}

function toolIdentity(t) {
  return String(t?.version || t?.updatedAtUtc || t?.UpdatedAtUtc || t?.sizeBytes || "").trim();
}

function isToolVersionNew(id) {
  // Badge "Nueva" en Acerca de (incluye BAT). El toast home usa listNewTools() sin BAT.
  const seen = readSeenToolVersions();
  const t = toolsForNotice().find((x) => x.id === id);
  if (!t?.available) return false;
  const stamp = toolIdentity(t);
  return !!stamp && seen[id] !== stamp;
}

function formatDateTimeAr(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseToolUpdatedAt(tool) {
  const raw = String(tool?.updatedAtUtc || tool?.UpdatedAtUtc || "").trim();
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const ver = String(tool?.version || tool?.Version || "");
  const m = ver.match(/^(\d{4})\.(\d{2})\.(\d{2})\.(\d{2})(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
  ));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatToolUpdatedAt(tool) {
  return formatDateTimeAr(parseToolUpdatedAt(tool));
}

function toolDisplayName(id) {
  if (id === "sql") return "ST2.SQL";
  if (id === "bat") return "ST2.BAT";
  return id;
}

function toolPackageLabel(id) {
  if (id === "sql") return "ST2 - Herramientas SQL";
  if (id === "bat") return "ST2.BAT";
  return toolDisplayName(id);
}

function toolsUpdateMessage(newer) {
  const list = newer || [];
  if (!list.length) return "";
  const hasSql = list.some((t) => t.id === "sql");
  const hasBat = list.some((t) => t.id === "bat");
  if (hasSql && !hasBat) {
    return 'hay una nueva versión para descargar del aplicativo para realizar backups "Herramientas SQL"';
  }
  if (hasBat && !hasSql) {
    return "hay una nueva versión de ST2.BAT disponible para descargar.";
  }
  const names = list.map((t) => toolPackageLabel(t.id));
  if (names.length === 1) {
    return `hay una nueva versión de ${names[0]} disponible para descargar.`;
  }
  const last = names.pop();
  return `hay nuevas versiones de ${names.join(", ")} y de ${last} disponibles para descargar.`;
}

function hideToolsTopBanner() {
  if (!toolsBanner) return;
  toolsBanner.classList.add("hidden");
  toolsBanner.setAttribute("hidden", "");
  document.body.classList.remove("st2-has-tools-update");
}

function renderToolsToast(newer, message) {
  const toast = document.getElementById("tools-ready-toast");
  const toastCount = document.getElementById("tools-ready-toast-count");
  if (!toast) return;
  const n = (newer || []).length;
  const show = n > 0 && !aboutRouteOpen && userCanSeeDesktopToolDownloads();
  if (!show) {
    toast.classList.add("hidden");
    toast.setAttribute("aria-hidden", "true");
    delete toast.dataset.toastBody;
    syncStackedToastGreetings();
    return;
  }
  if (toastCount) {
    toastCount.textContent = String(n);
    toastCount.setAttribute("aria-hidden", n > 1 ? "false" : "true");
    toastCount.classList.toggle("hidden", n < 2);
  }
  toast.dataset.toastBody = String(message || "").trim();
  toast.classList.remove("hidden");
  toast.setAttribute("aria-hidden", "false");
  syncStackedToastGreetings();
}

function userCanSeeDesktopToolDownloads() {
  // Descargas SQL/BAT: solo perfiles con Bejerman SQL / ONVIO (no Legal/Chile solos).
  try {
    return canSeePlanillasSqlOnvio();
  } catch {
    return false;
  }
}

function syncAboutNoticeCopy() {
  const lead = document.getElementById("st2-about-notice-lead");
  if (lead) lead.textContent = "Suite interna para mesa de ayuda";
  syncAboutTabsList();
}

function joinAboutItems(items) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} y ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} y ${list[list.length - 1]}`;
}

function aboutPortalLabels() {
  return listVisibleProfilePortals().map((id) => portalPickerLabel(id));
}

function buildAboutPlanillasDetail() {
  const blocks = [];

  if (canSeePlanillasSqlOnvio()) {
    const mods = [];
    if (canSeePlanillasTransferencia()) mods.push("Transferencia de Casos");
    if (canSeePlanillasReferral()) mods.push("Referral I+D");
    if (canSeeOportunidadModule()) mods.push("Oportunidad de Venta");
    if (canSeePdfPortalModule()) mods.push("Generador de PDFs");
    if (canSeeBlanqueoModule()) mods.push("Blanqueo de accesos");
    if (canSeeBorradoBasesModule()) mods.push("Borrado de Bases Web");
    blocks.push(
      mods.length
        ? `BEJERMAN SQL / ONVIO/WEB: ${joinAboutItems(mods)}`
        : "BEJERMAN SQL / ONVIO/WEB",
    );
  }

  if (canSeePlanillasLegal()) {
    const mods = [];
    if (canSeeLegalFirm()) mods.push("Legal One");
    if (canSeeLegalHighq()) mods.push("HighQ");
    if (canSeeLegalWestlaw()) mods.push("Westlaw");
    if (canSeeLegalCocounsel()) mods.push("CoCounsel");
    blocks.push(mods.length ? `LEGAL: ${joinAboutItems(mods)}` : "LEGAL");
  }

  if (canSeePlanillasChile()) {
    const mods = [];
    if (canSeeChileTransferencia()) mods.push("Transferencia de Casos");
    if (canSeeChileReferral()) mods.push("Referral I+D");
    if (canSeeChileSaad()) mods.push("SAAD - Facturación");
    if (canSeeChileHr()) mods.push("HR Consola Intranet");
    if (canSeeChileWiki()) mods.push("Wiki errores comunes");
    if (canSeeChileLp()) mods.push("Servicios LP Contabilidad");
    if (canSeeChilePowerapps()) mods.push("PowerApps");
    blocks.push(mods.length ? `CHILE: ${joinAboutItems(mods)}` : "CHILE");
  }

  return blocks.length ? blocks.join(" · ") : "Sin módulos de planillas en tu perfil.";
}

function syncAboutTabsList() {
  const list = document.getElementById("st2-about-tabs-list");
  if (!list) return;

  const items = [];
  const hasPlanillas =
    canSeePlanillasSqlOnvio() || canSeePlanillasLegal() || canSeePlanillasChile();

  if (hasPlanillas) {
    items.push({
      title: "Sistema de Planillas",
      body: buildAboutPlanillasDetail(),
    });
  }

  const portals = aboutPortalLabels();
  if (portals.length) {
    items.push({
      title: "THOM",
      body: `Acceso a THOM: ${joinAboutItems(portals)}.`,
    });
  }

  items.push({
    title: "AI Platform",
    body: "Plataforma de inteligencia artificial integrada en el navegador.",
  });

  if (portals.length) {
    const portalTab = getPortalClientTabLabel();
    const onlyChile = portals.length === 1 && portals[0] === "CHILE";
    items.push({
      title: portalTab,
      body: onlyChile && portalTab === "Centro de Soluciones"
        ? "Acceso al Centro de Soluciones de Thomson Reuters Chile."
        : `Búsqueda y acceso: ${joinAboutItems(portals)}.`,
    });
  }

  if (isSt2SuperAdmin()) {
    items.push({
      title: "ADMIN",
      body: "Panel de administración de accesos.",
    });
  }

  list.innerHTML = items
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(item.body)}</li>`,
    )
    .join("");
}

function syncAboutToolsVisibility() {
  const show = userCanSeeDesktopToolDownloads();
  aboutToolsSection?.classList.toggle("hidden", !show);
  aboutToolsSection?.toggleAttribute("hidden", !show);
  syncAboutNoticeCopy();
  if (!show) {
    aboutToolsBadge?.classList.add("hidden");
    aboutToolsBadge?.setAttribute("aria-hidden", "true");
    hideToolsTopBanner();
    const toast = document.getElementById("tools-ready-toast");
    if (toast) {
      toast.classList.add("hidden");
      toast.setAttribute("aria-hidden", "true");
    }
  }
}

function syncAboutToolsBadge() {
  syncAboutToolsVisibility();
  if (!userCanSeeDesktopToolDownloads()) return;

  const newer = listNewTools();
  const hasNew = newer.length > 0;
  if (aboutToolsBadge) {
    aboutToolsBadge.classList.toggle("hidden", !hasNew);
    aboutToolsBadge.setAttribute("aria-hidden", hasNew ? "false" : "true");
    aboutToolsBadge.title = hasNew ? "Nueva versión de Herramientas SQL para descargar" : "";
  }

  const msg = toolsUpdateMessage(newer);
  hideToolsTopBanner();
  renderToolsToast(newer, msg);
}

function markToolsSeen() {
  const next = { ...readSeenToolVersions() };
  for (const t of toolsForNotice()) {
    const stamp = toolIdentity(t);
    if (t?.available && stamp) next[t.id] = stamp;
  }
  writeSeenToolVersions(next);
  syncAboutToolsBadge();
  renderAboutTools();
}

/** Una descarga (SQL o BAT) marca el aviso del home como visto. */
function markToolSeen(toolId) {
  const id = String(toolId || "").trim();
  if (!id) return;
  // Con descargar cualquiera de las dos, se da por actuado el cartel.
  markToolsSeen();
}

function setToolDownloadLabel(btn, text) {
  if (!btn) return;
  const label = btn.querySelector("[data-tool-dl-label]");
  if (label) label.textContent = text;
  else btn.textContent = text;
}

function renderAboutTools() {
  const copy = {
    sql: {
      file: "ST2 - Herramientas SQL.zip",
    },
    bat: {
      file: "ST2-PS.7z",
    },
  };

  for (const id of ["sql", "bat"]) {
    const tool = (cachedTools || []).find((t) => t.id === id);
    const card = document.querySelector(`.st2-about-tool[data-tool="${id}"]`);
    const sizeEl = card?.querySelector(`[data-tool-size="${id}"]`);
    const newEl = card?.querySelector(`[data-tool-new="${id}"]`);
    const dateEl = card?.querySelector(`[data-tool-date="${id}"]`);
    const btn = card?.querySelector(`[data-tool-download="${id}"]`);
    const meta = copy[id];

    if (!tool?.available) {
      if (newEl) newEl.hidden = true;
      const fallbackDate = uploadedLabelFor(id, tool);
      if (dateEl) {
        dateEl.hidden = !fallbackDate;
        if (fallbackDate) dateEl.removeAttribute("hidden");
        dateEl.textContent = fallbackDate;
      }
      if (sizeEl) {
        sizeEl.hidden = true;
        sizeEl.textContent = "";
      }
      if (btn) {
        btn.disabled = true;
        setToolDownloadLabel(btn, "Pronto");
        btn.title = "Todavía no hay un paquete publicado";
      }
      continue;
    }

    const label = tool.fileName || meta.file;
    if (newEl) newEl.hidden = !isToolVersionNew(id);
    const when = uploadedLabelFor(id, tool);
    if (dateEl) {
      dateEl.hidden = !when;
      if (when) dateEl.removeAttribute("hidden");
      dateEl.textContent = when;
    }
    if (sizeEl) {
      const size = tool.sizeBytes ? formatToolSize(tool.sizeBytes) : "";
      if (size) {
        sizeEl.hidden = false;
        sizeEl.textContent = size;
        sizeEl.title = when ? `Subido ${when}` : "";
      } else {
        sizeEl.hidden = true;
        sizeEl.textContent = "";
      }
    }
    if (btn) {
      btn.disabled = false;
      setToolDownloadLabel(btn, "Descargar");
      btn.removeAttribute("title");
    }
  }
  syncAboutToolsBadge();
}

async function refreshAboutTools({ silent = false } = {}) {
  try {
    const data = await apiGet("/api/tools");
    const raw = Array.isArray(data?.tools) ? data.tools : Array.isArray(data?.Tools) ? data.Tools : [];
    cachedTools = raw.map(normalizeTool);
    renderAboutTools();
    if (!silent) setAboutToolsStatus("");
  } catch (err) {
    cachedTools = toolsFromMeta();
    renderAboutTools();
    if (!silent) setAboutToolsStatus("");
  }
}

async function downloadTool(toolId) {
  const btn = document.querySelector(`[data-tool-download="${toolId}"]`);
  if (!btn || btn.disabled) return;
  const a = document.createElement("a");
  a.href = `/api/tools/${encodeURIComponent(toolId)}/download?t=${Date.now()}`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (toolId === "sql" || toolId === "bat") {
    showToolDownloadNotice(toolId);
  }
  markToolSeen(toolId);
}

async function uploadTool(toolId, file) {
  if (!file || !isPrimarySuperAdmin() || getViewAsProfile()) return;

  // Archivos grandes: pedir URL en el modal de ST2 (no el prompt de Chrome).
  if (file.size > 8 * 1024 * 1024) {
    openToolUrlDialog(toolId, {
      lead: `“${file.name}” pesa ${formatToolSize(file.size)}. Pegá un link de descarga directa.`,
      fileName: file.name,
    });
    return;
  }

  const busy = document.getElementById("st2-about-busy");
  const busyText = document.getElementById("st2-about-busy-text");
  const busyFill = document.getElementById("st2-about-busy-bar-fill");
  const showBusy = (msg, pct = null) => {
    if (busyText) busyText.textContent = msg;
    if (busyFill) {
      const w = pct == null ? 12 : Math.max(4, Math.min(100, pct));
      busyFill.style.width = `${w}%`;
    }
    busy?.classList.remove("hidden");
    busy?.setAttribute("aria-hidden", "false");
  };
  const hideBusy = () => {
    busy?.classList.add("hidden");
    busy?.setAttribute("aria-hidden", "true");
    if (busyFill) busyFill.style.width = "8%";
  };

  const version = new Date().toISOString().slice(0, 10).replace(/-/g, ".");
  const originalName = file.name || `st2-${toolId}.bin`;
  let stage = "inicio";
  showBusy(`Preparando ${originalName}…`, 4);
  setAboutToolsStatus(`Subiendo ${originalName} (${formatToolSize(file.size)})…`);

  try {
    stage = "ping";
    showBusy("Verificando volume…", 8);
    const ping = await xhrJson("POST", `/api/planillas/kit/${encodeURIComponent(toolId)}/ping`, null);
    if (!ping?.ok) {
      throw Object.assign(new Error(ping?.error || "Canario de tools falló."), {
        reached: !!ping?.reached,
        stage,
      });
    }

    stage = "encode";
    showBusy(`Codificando ${originalName}…`, 12);
    const plain = new Uint8Array(await file.arrayBuffer());
    const wired = new Uint8Array(plain.length);
    for (let i = 0; i < plain.length; i++) wired[i] = plain[i] ^ 0xa5;

    const chunkSize = 32 * 1024;
    const total = Math.max(1, Math.ceil(wired.length / chunkSize));
    const uploadId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    stage = "begin";
    showBusy(`Iniciando subida (${total} partes)…`, 16);
    await xhrJson("POST", `/api/planillas/kit/${encodeURIComponent(toolId)}/begin`, {
      u: uploadId,
      t: total,
    });

    for (let i = 0; i < total; i++) {
      stage = `part-${i + 1}/${total}`;
      const slice = wired.subarray(i * chunkSize, Math.min(wired.length, (i + 1) * chunkSize));
      const hex = bytesToHex(slice);
      const pct = 16 + Math.round(((i + 1) / total) * 70);
      showBusy(`Enviando parte ${i + 1}/${total}…`, pct);
      setAboutToolsStatus(`Enviando ${originalName}: parte ${i + 1}/${total}`);
      await xhrJson("POST", `/api/planillas/kit/${encodeURIComponent(toolId)}/push`, {
        u: uploadId,
        i,
        t: total,
        h: hex,
      });
    }

    stage = "commit";
    showBusy("Publicando paquete…", 92);
    const data = await xhrJson("POST", `/api/planillas/kit/${encodeURIComponent(toolId)}/commit`, {
      u: uploadId,
      t: total,
      n: toBase64Url(originalName),
      v: version,
      z: true,
    });

    showBusy("Listo", 100);
    setAboutToolsStatus(`Publicado ${data.name || toolId} v${data.version || ""}`.trim());
    await refreshAboutTools({ silent: true });
    markToolsSeen();
  } catch (err) {
    const status = err?.status ? `HTTP ${err.status}` : "sin HTTP";
    let msg = `Falló en ${err?.stage || stage} (${status}): ${err?.message || "No se pudo subir."}`;
    if (err?.cfRay) msg += `\ncf-ray: ${err.cfRay}`;
    try {
      const dig = await fetch("/api/tools", { credentials: "include", cache: "no-store" }).then(async (r) => {
        const body = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, body };
      });
      if (dig?.body?.lastError) {
        msg += `\n\nDetalle servidor:\n${String(dig.body.lastError).slice(0, 600)}`;
      } else {
        msg += `\n(dataDir: ${dig?.body?.dataDir || "?"}; lastError vacío)`;
      }
    } catch (e2) {
      msg += `\n(no pude leer /api/tools: ${e2?.message || e2})`;
    }
    setAboutToolsStatus(msg, true);
    showSt2Message("No se pudo subir", msg);
  } finally {
    hideBusy();
  }
}

async function publishToolFromUrl(toolId, url, fileNameHint = "") {
  if (!toolId || !url || !isPrimarySuperAdmin() || getViewAsProfile()) return;
  const busy = document.getElementById("st2-about-busy");
  const busyText = document.getElementById("st2-about-busy-text");
  const busyFill = document.getElementById("st2-about-busy-bar-fill");
  const showBusy = (msg, pct = null) => {
    if (busyText) busyText.textContent = msg;
    if (busyFill) {
      const w = pct == null ? 12 : Math.max(4, Math.min(100, pct));
      busyFill.style.width = `${w}%`;
    }
    busy?.classList.remove("hidden");
    busy?.setAttribute("aria-hidden", "false");
  };
  const hideBusy = () => {
    busy?.classList.add("hidden");
    busy?.setAttribute("aria-hidden", "true");
    if (busyFill) busyFill.style.width = "8%";
  };

  const version = new Date().toISOString().slice(0, 10).replace(/-/g, ".");
  let fileName = String(fileNameHint || "").trim();
  if (!fileName) {
    try { fileName = decodeURIComponent(url.split("?")[0].split("/").pop() || ""); } catch { fileName = ""; }
  }
  // Hosts que dejan el path en "zip" / "bat" sin punto.
  if (/^(zip|7z|rar|exe|msi|bat|cmd|ps1|bin)$/i.test(fileName)) {
    fileName = `st2-${toolId}.${fileName.toLowerCase()}`;
  }
  if (!fileName || !fileName.includes(".")) {
    fileName = toolId === "bat" ? `st2-${toolId}.bat` : `st2-${toolId}.zip`;
  }

  showBusy(`Descargando desde URL…`, 20);
  setAboutToolsStatus(`Publicando ${fileName} desde URL…`);
  try {
    const data = await xhrJson("POST", `/api/planillas/kit/${encodeURIComponent(toolId)}/from-url`, {
      url,
      fileName,
      version,
    });
    showBusy("Listo", 100);
    setAboutToolsStatus(`Publicado ${data.name || toolId} v${data.version || ""}`.trim());
    await refreshAboutTools({ silent: true });
    markToolsSeen();
  } catch (err) {
    const msg = err?.message || "No se pudo publicar desde URL.";
    setAboutToolsStatus(msg, true);
    showSt2Message("No se pudo publicar", msg);
  } finally {
    hideBusy();
  }
}

let toolUrlDialogToolId = "";
let toolUrlDialogBound = false;

function showSt2Message(title, body, { okLabel = "Entendido", downloadNotice = false } = {}) {
  bindToolUrlDialog();
  const overlay = document.getElementById("st2-msg-overlay");
  const dialog = overlay?.querySelector(".st2-msg-dialog");
  const titleEl = document.getElementById("st2-msg-title");
  const bodyEl = document.getElementById("st2-msg-body");
  const okBtn = document.getElementById("st2-msg-ok");
  if (!overlay) return;
  dialog?.classList.toggle("st2-msg-dialog-centered", !!downloadNotice);
  if (titleEl) {
    if (downloadNotice) {
      titleEl.innerHTML = 'Descargando<span class="st2-dl-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>';
    } else {
      titleEl.textContent = title || "Aviso";
    }
  }
  if (bodyEl) bodyEl.textContent = body || "";
  if (okBtn) okBtn.textContent = okLabel;
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  okBtn?.focus();
}

function hideSt2Message() {
  const overlay = document.getElementById("st2-msg-overlay");
  const dialog = overlay?.querySelector(".st2-msg-dialog");
  const titleEl = document.getElementById("st2-msg-title");
  const okBtn = document.getElementById("st2-msg-ok");
  overlay?.classList.add("hidden");
  overlay?.setAttribute("aria-hidden", "true");
  dialog?.classList.remove("st2-msg-dialog-centered");
  if (titleEl) titleEl.textContent = "Aviso";
  if (okBtn) okBtn.textContent = "Entendido";
}

const ST2_DESKTOP_TOOL_PASSWORD = "bejerman**";

function showToolDownloadNotice(toolId) {
  const label = toolId === "bat" ? "ST2.BAT" : "Herramientas SQL";
  const fileKind = toolId === "bat" ? "el .bat" : "el .exe";
  showSt2Message(
    "",
    `Antes de descomprimir, borrá las versiones anteriores de ${label} para no mezclar archivos viejos con los nuevos. La clave para abrir ${fileKind} es ${ST2_DESKTOP_TOOL_PASSWORD}.`,
    { okLabel: "Cerrar", downloadNotice: true },
  );
}

let st2ConfirmBound = false;
let st2ConfirmResolver = null;

function hideSt2Confirm(result = false) {
  const overlay = document.getElementById("st2-confirm-overlay");
  overlay?.classList.add("hidden");
  overlay?.setAttribute("aria-hidden", "true");
  const resolve = st2ConfirmResolver;
  st2ConfirmResolver = null;
  resolve?.(!!result);
}

function bindSt2Confirm() {
  if (st2ConfirmBound) return;
  st2ConfirmBound = true;
  document.getElementById("st2-confirm-cancel")?.addEventListener("click", () => hideSt2Confirm(false));
  document.getElementById("st2-confirm-ok")?.addEventListener("click", () => hideSt2Confirm(true));
  document.getElementById("st2-confirm-overlay")?.addEventListener("click", (e) => {
    if (e.target?.id === "st2-confirm-overlay") hideSt2Confirm(false);
  });
  document.addEventListener("keydown", (e) => {
    const overlay = document.getElementById("st2-confirm-overlay");
    if (e.key !== "Escape" || overlay?.classList.contains("hidden")) return;
    hideSt2Confirm(false);
  });
}

function confirmSt2({ title, body, detail = "", confirmLabel = "Confirmar" } = {}) {
  bindSt2Confirm();
  const overlay = document.getElementById("st2-confirm-overlay");
  const titleEl = document.getElementById("st2-confirm-title");
  const bodyEl = document.getElementById("st2-confirm-body");
  const detailEl = document.getElementById("st2-confirm-detail");
  const okBtn = document.getElementById("st2-confirm-ok");
  if (!overlay) return Promise.resolve(false);
  if (st2ConfirmResolver) hideSt2Confirm(false);
  if (titleEl) titleEl.textContent = title || "Confirmar";
  if (bodyEl) bodyEl.textContent = body || "";
  if (detailEl) {
    const text = String(detail || "").trim();
    detailEl.textContent = text;
    detailEl.classList.toggle("hidden", !text);
  }
  if (okBtn) okBtn.textContent = confirmLabel;
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  okBtn?.focus();
  return new Promise((resolve) => {
    st2ConfirmResolver = resolve;
  });
}

function openToolUrlDialog(toolId, { lead = "", fileName = "", url = "" } = {}) {
  if (!toolId || !isPrimarySuperAdmin() || getViewAsProfile()) return;
  bindToolUrlDialog();
  toolUrlDialogToolId = toolId;
  const overlay = document.getElementById("st2-tool-url-overlay");
  const leadEl = document.getElementById("st2-tool-url-lead");
  const urlInput = document.getElementById("st2-tool-url-input");
  const nameInput = document.getElementById("st2-tool-url-name");
  const errEl = document.getElementById("st2-tool-url-error");
  const titleEl = document.getElementById("st2-tool-url-title");
  const label = toolId === "bat" ? "ST2.BAT" : "ST2.SQL";
  if (titleEl) titleEl.textContent = `Publicar ${label}`;
  if (leadEl) {
    leadEl.textContent = lead
      || "Pegá el link de descarga y el nombre del archivo con su extensión.";
  }
  if (urlInput) urlInput.value = url || "";
  if (nameInput) {
    nameInput.value = fileName
      || (toolId === "bat" ? "st2ps.bat" : "st2-sql.zip");
  }
  if (errEl) {
    errEl.textContent = "";
    errEl.classList.add("hidden");
  }
  overlay?.classList.remove("hidden");
  overlay?.setAttribute("aria-hidden", "false");
  (url ? nameInput : urlInput)?.focus();
}

function hideToolUrlDialog() {
  const overlay = document.getElementById("st2-tool-url-overlay");
  overlay?.classList.add("hidden");
  overlay?.setAttribute("aria-hidden", "true");
  toolUrlDialogToolId = "";
}

function bindToolUrlDialog() {
  if (toolUrlDialogBound) return;
  toolUrlDialogBound = true;
  document.getElementById("st2-tool-url-cancel")?.addEventListener("click", hideToolUrlDialog);
  document.getElementById("st2-msg-ok")?.addEventListener("click", hideSt2Message);
  document.getElementById("st2-msg-close")?.addEventListener("click", hideSt2Message);
  document.getElementById("st2-tool-url-overlay")?.addEventListener("click", (e) => {
    if (e.target?.id === "st2-tool-url-overlay") hideToolUrlDialog();
  });
  document.getElementById("st2-msg-overlay")?.addEventListener("click", (e) => {
    if (e.target?.id === "st2-msg-overlay") hideSt2Message();
  });
  document.getElementById("st2-tool-url-submit")?.addEventListener("click", () => {
    const url = String(document.getElementById("st2-tool-url-input")?.value || "").trim();
    const fileName = String(document.getElementById("st2-tool-url-name")?.value || "").trim();
    const errEl = document.getElementById("st2-tool-url-error");
    const showErr = (msg) => {
      if (!errEl) return;
      errEl.textContent = msg;
      errEl.classList.remove("hidden");
    };
    if (!toolUrlDialogToolId) return;
    if (!/^https?:\/\//i.test(url)) {
      showErr("Pegá un link http/https válido.");
      document.getElementById("st2-tool-url-input")?.focus();
      return;
    }
    if (!fileName || !fileName.includes(".")) {
      showErr("Indicá el nombre con extensión (ej. st2ps.bat o paquete.zip).");
      document.getElementById("st2-tool-url-name")?.focus();
      return;
    }
    const id = toolUrlDialogToolId;
    hideToolUrlDialog();
    void publishToolFromUrl(id, url, fileName);
  });
  document.getElementById("st2-tool-url-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("st2-tool-url-submit")?.click();
  });
  document.getElementById("st2-tool-url-name")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("st2-tool-url-submit")?.click();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const urlOverlay = document.getElementById("st2-tool-url-overlay");
    const msgOverlay = document.getElementById("st2-msg-overlay");
    if (urlOverlay && !urlOverlay.classList.contains("hidden")) hideToolUrlDialog();
    else if (msgOverlay && !msgOverlay.classList.contains("hidden")) hideSt2Message();
  });
}

function promptToolFromUrl(toolId) {
  openToolUrlDialog(toolId);
}

function bytesToHex(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function toBase64Url(text) {
  const b64 = btoa(unescape(encodeURIComponent(String(text || ""))));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function parseXhrJson(xhr) {
  const raw = String(xhr.responseText || "");
  try { return JSON.parse(raw || "{}"); } catch { return { raw: raw.slice(0, 200) }; }
}

function makeUploadError(xhr, parsed, stage) {
  const raw = String(xhr.responseText || "");
  const msg = parsed?.error || parsed?.detail || parsed?.title
    || (raw ? raw.slice(0, 400) : `Error HTTP ${xhr.status} (sin detalle)`);
  const err = new Error(msg);
  err.status = xhr.status;
  err.raw = raw;
  err.payload = parsed;
  err.stage = stage;
  err.reached = !!parsed?.reached || !!parsed?.dataDir || !!parsed?.exceptionType;
  err.cfRay = xhr.getResponseHeader("cf-ray") || xhr.getResponseHeader("CF-RAY");
  if (err.cfRay && !err.reached) {
    err.message = `${msg} [cf-ray ${err.cfRay}]`;
  }
  return err;
}

function xhrJson(method, url, bodyObj) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.withCredentials = true;
    if (bodyObj != null) xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onload = () => {
      const parsed = parseXhrJson(xhr);
      if (xhr.status >= 200 && xhr.status < 300) resolve(parsed);
      else reject(makeUploadError(xhr, parsed));
    };
    xhr.onerror = () => reject(new Error("No se pudo contactar al servidor (red / proxy)."));
    xhr.send(bodyObj == null ? null : JSON.stringify(bodyObj));
  });
}

async function copySt2DesktopToolPassword(btn) {
  const value = ST2_DESKTOP_TOOL_PASSWORD;
  try {
    await navigator.clipboard.writeText(value);
    btn?.classList.add("is-copied");
    const prevTitle = btn?.title || "";
    if (btn) btn.title = "Copiado";
    window.setTimeout(() => {
      btn?.classList.remove("is-copied");
      if (btn) btn.title = prevTitle || "Clic para copiar la clave";
    }, 1600);
  } catch {
    window.prompt("Copiá la clave:", value);
  }
}

function bindAboutToolsUi() {
  bindToolUrlDialog();
  if (!aboutClaveCopyBound) {
    aboutClaveCopyBound = true;
    document.getElementById("st2-about-tools-clave-copy")?.addEventListener("click", (e) => {
      void copySt2DesktopToolPassword(e.currentTarget);
    });
  }
  if (toolsBound) return;
  toolsBound = true;
  document.querySelectorAll("[data-tool-download]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-tool-download");
      if (id) void downloadTool(id);
    });
  });
  if (!toolsBannerBound) {
    toolsBannerBound = true;
    document.getElementById("st2-tools-banner-open")?.addEventListener("click", () => {
      showAbout();
    });
    document.getElementById("tools-ready-toast-open")?.addEventListener("click", () => {
      showAbout();
    });
  }
}

function showAbout({ history = "push" } = {}) {
  aboutRouteOpen = true;
  const webMeta = document.getElementById("st2-about-web-meta");
  if (webMeta) {
    webMeta.textContent = getAboutVersionLabel();
    webMeta.title = "Estás usando esta aplicación web";
  }
  applyAboutUpdated();
  syncAboutToolsVisibility();
  bindAboutToolsUi();
  if (userCanSeeDesktopToolDownloads()) {
    void refreshAboutTools().then(() => {
      if (isSt2SuperAdmin()) void refreshToolsDiagHint();
    });
  }
  aboutOverlay?.classList.remove("hidden");
  aboutOverlay?.setAttribute("aria-hidden", "false");
  document.title = "ST² · Acerca de";
  if (history !== "none") {
    const current = normalizeShellPath(window.location.pathname);
    if (!isHerramientasPath(current)) pathBeforeAbout = current || "/";
    syncAboutHistory(history);
  }
  syncAboutToolsBadge();
  aboutCloseBtn?.focus();
}

function hideAbout({ history = "restore" } = {}) {
  aboutOverlay?.classList.add("hidden");
  aboutOverlay?.setAttribute("aria-hidden", "true");
  aboutRouteOpen = false;
  syncAboutToolsBadge();
  const onAboutPath = isHerramientasPath(normalizeShellPath(window.location.pathname));
  if (history !== "none" && onAboutPath) {
    const fallback = pathBeforeAbout && !isHerramientasPath(pathBeforeAbout) ? pathBeforeAbout : "/";
    const tab = tabFromPath(fallback);
    document.title = titleForTab(tab);
    if (!shellRouteSyncing) {
      window.history.replaceState(
        { tab, thomPortal: thomPortalId, portalId: activePortalId },
        "",
        fallback
      );
    }
  } else {
    const tab = document.querySelector(".tab-btn.active")?.dataset?.tab || "planillas";
    document.title = titleForTab(tab);
  }
  aboutBtn?.focus();
}

function isHerramientasPath(pathname) {
  const p = normalizeShellPath(pathname);
  return p === "/about" || p === "/herramientas";
}

function syncAboutHistory(mode = "push") {
  if (shellRouteSyncing || mode === "none") return;
  const current = normalizeShellPath(window.location.pathname);
  const state = {
    tab: document.querySelector(".tab-btn.active")?.dataset?.tab || "planillas",
    thomPortal: thomPortalId,
    portalId: activePortalId,
    about: true,
  };
  const dest = current === "/about" ? "/about" : "/herramientas";
  if (mode === "replace" || isHerramientasPath(current)) {
    window.history.replaceState(state, "", dest);
  } else {
    window.history.pushState(state, "", dest);
  }
}

function applyAboutFromPath() {
  if (isHerramientasPath(window.location.pathname)) {
    showAbout({ history: "none" });
    return true;
  }
  if (aboutRouteOpen) hideAbout({ history: "none" });
  return false;
}

async function refreshToolsDiagHint() {
  try {
    const data = await apiGet("/api/tools/diag");
    if (!data?.ok) {
      console.warn("tools diag:", data?.error || data);
      return;
    }
    // No tapar la UI con lastError viejos; solo consola.
    if (data?.lastError) console.warn("tools lastError:", String(data.lastError).slice(0, 300));
  } catch (err) {
    console.warn("tools diag failed", err);
  }
}

aboutBtn?.addEventListener("click", showAbout);
document.addEventListener("st2:session-changed", () => {
  syncAdminTabVisibility();
  syncViewAsBanner();
});
viewAsExitBtn?.addEventListener("click", () => {
  void exitViewAsProfile();
});
accessAdminCancel?.addEventListener("click", () => navigateTab("planillas"));
accessAdminRefresh?.addEventListener("click", () => {
  void loadAccessAdminRegistrations({ silent: true, force: true });
});
accessAdminPresetBtn?.addEventListener("click", () => {
  openAccessPresetModal();
});
accessAdminSubmit?.addEventListener("click", () => { void submitAccessAdminLogin(); });
accessAdminPass?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void submitAccessAdminLogin();
});
document.addEventListener("st2:open-admin-from-alert", () => {
  document.querySelector('.tab-btn[data-tab="admin"]')?.click();
  void loadAccessAdminRegistrations({ silent: true, force: true });
});
accessAdminSearch?.addEventListener("input", () => {
  accessAdminQuery = accessAdminSearch.value || "";
  renderAccessAdminTable();
});
accessAdminQuickFilterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    setAccessAdminListFilter(btn.dataset.listFilter || "");
  });
});
accessAdminExportBtn?.addEventListener("click", () => {
  exportAccessAdminCsv();
});
accessAdminAuditActors?.addEventListener("click", (e) => {
  if (!isPrimarySuperAdmin()) return;
  const target = e.target;
  if (!(target instanceof Element)) return;
  const btn = target.closest("[data-audit-actor]");
  if (!(btn instanceof HTMLElement)) return;
  openAccessAdminAuditDetail(btn.dataset.auditActor || "");
});
accessAdminAuditDetailClose?.addEventListener("click", () => {
  closeAccessAdminAuditDetail();
});
accessAdminAuditMore?.addEventListener("click", () => {
  if (!isPrimarySuperAdmin()) return;
  accessAdminAuditShowAll = !accessAdminAuditShowAll;
  renderAccessAdminAudit();
});
syncAccessAdminQuickFilters();
accessAdminPermsFilterBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleAccessAdminPermsFilterPop();
});
accessAdminModFilterButtons.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const key = String(btn.dataset.modFilter || "").trim();
    if (!key) return;
    if (accessAdminModFilters.has(key)) accessAdminModFilters.delete(key);
    else accessAdminModFilters.add(key);
    syncAccessAdminModFilterUi();
    renderAccessAdminTable();
  });
});
accessAdminBody?.addEventListener("toggle", (e) => {
  const detail = e.target?.closest?.(".st2-access-admin-perm-detail");
  if (!detail || !accessAdminBody) return;
  if (!detail.open) {
    resetAccessAdminPermPop(detail.querySelector(".st2-access-admin-perm-pop"));
    return;
  }
  closeAccessAdminPermsFilterPop();
  accessAdminBody.querySelectorAll(".st2-access-admin-perm-detail[open]").forEach((openDetail) => {
    if (openDetail !== detail) {
      openDetail.open = false;
      resetAccessAdminPermPop(openDetail.querySelector(".st2-access-admin-perm-pop"));
    }
  });
  positionAccessAdminPermPop(detail);
}, true);
document.addEventListener("click", (e) => {
  if (!(e.target instanceof Element)) return;
  if (e.target.closest(".st2-access-admin-perm-detail")) return;
  if (e.target.closest("#st2-access-admin-perms-filter-pop") || e.target.closest("#st2-access-admin-perms-filter-btn")) return;
  closeAllAccessAdminPermPops();
  closeAccessAdminPermsFilterPop();
});
window.addEventListener("resize", () => {
  closeAllAccessAdminPermPops();
  if (accessAdminPermsFilterOpen) positionAccessAdminPermsFilterPop();
});
accessAdminTableWrap?.addEventListener("scroll", () => {
  closeAllAccessAdminPermPops();
  closeAccessAdminPermsFilterPop();
}, { passive: true });
document.querySelectorAll(".st2-access-admin-th-sort").forEach((th) => {
  th.addEventListener("click", () => {
    setAccessAdminSort(th.dataset.sort || "");
  });
  th.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setAccessAdminSort(th.dataset.sort || "");
    }
  });
});
syncAccessAdminSortHeaders();
function handleAccessAdminActionClick(e) {
  const target = e.target;
  if (!(target instanceof Element)) return false;
  const approveBtn = target.closest("[data-approve-email]");
  if (approveBtn instanceof HTMLElement) {
    void decideAccessAdminEmail(approveBtn.dataset.approveEmail || "", "approve");
    return true;
  }
  const rejectBtn = target.closest("[data-reject-email]");
  if (rejectBtn instanceof HTMLElement) {
    void decideAccessAdminEmail(rejectBtn.dataset.rejectEmail || "", "reject");
    return true;
  }
  return false;
}

accessAdminInbox?.addEventListener("click", (e) => {
  handleAccessAdminActionClick(e);
});
accessAdminBody?.addEventListener("click", (e) => {
  if (handleAccessAdminActionClick(e)) return;
  const target = e.target;
  if (!(target instanceof Element)) return;
  const previewBtn = target.closest("[data-preview-email]");
  if (previewBtn instanceof HTMLElement) {
    if (!isSt2SuperAdmin()) return;
    startAccessProfilePreview(previewBtn.dataset.previewEmail || "");
    return;
  }
  const modulesBtn = target.closest("[data-modules-email]");
  if (modulesBtn instanceof HTMLElement) {
    openAccessModulesModal(modulesBtn.dataset.modulesEmail || "");
    return;
  }
  const deleteBtn = target.closest("[data-delete-email]");
  if (deleteBtn instanceof HTMLElement) {
    if (!isPrimarySuperAdmin()) return;
    void deleteAccessAdminEmail(deleteBtn.dataset.deleteEmail || "");
  }
});

const ACCESS_BDAY_MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

let accessBirthdayPickerMonth = 0;
let accessBirthdayPickerOpen = false;

function accessBirthdayDaysInMonth(monthIndex) {
  return new Date(2000, monthIndex + 1, 0).getDate();
}

function parseAccessBirthdayDisplay(val) {
  const m = String(val || "").trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (month < 1 || month > 12 || day < 1 || day > accessBirthdayDaysInMonth(month - 1)) return null;
  return { day, month };
}

function formatAccessBirthdayDisplay(day, month) {
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

function closeAccessBirthdayPicker() {
  accessBirthdayPickerOpen = false;
  accessModulesBirthdayPicker?.classList.add("hidden");
  accessModulesBirthdayOpen?.setAttribute("aria-expanded", "false");
}

function renderAccessBirthdayPicker() {
  const grid = accessModulesBirthdayPicker?.querySelector("[data-bday-days]");
  const label = accessModulesBirthdayPicker?.querySelector("[data-bday-month-label]");
  if (!grid || !label) return;
  label.textContent = ACCESS_BDAY_MONTHS[accessBirthdayPickerMonth];
  const total = accessBirthdayDaysInMonth(accessBirthdayPickerMonth);
  const selected = parseAccessBirthdayDisplay(accessModulesBirthday?.value);
  grid.innerHTML = "";
  for (let d = 1; d <= total; d++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "st2-birthday-picker-day";
    btn.textContent = String(d);
    const month = accessBirthdayPickerMonth + 1;
    if (selected && selected.day === d && selected.month === month) {
      btn.classList.add("is-selected");
    }
    btn.addEventListener("click", () => {
      if (accessModulesBirthday) {
        accessModulesBirthday.value = formatAccessBirthdayDisplay(d, month);
      }
      closeAccessBirthdayPicker();
    });
    grid.appendChild(btn);
  }
}

function openAccessBirthdayPicker() {
  if (!accessModulesBirthdayPicker) return;
  const parsed = parseAccessBirthdayDisplay(accessModulesBirthday?.value);
  accessBirthdayPickerMonth = parsed ? parsed.month - 1 : new Date().getMonth();
  renderAccessBirthdayPicker();
  accessBirthdayPickerOpen = true;
  accessModulesBirthdayPicker.classList.remove("hidden");
  accessModulesBirthdayOpen?.setAttribute("aria-expanded", "true");
}

function initAccessBirthdayPicker() {
  if (!accessModulesBirthdayPicker || accessModulesBirthdayPicker.dataset.bound) return;
  accessModulesBirthdayPicker.dataset.bound = "1";

  accessModulesBirthdayOpen?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (accessBirthdayPickerOpen) closeAccessBirthdayPicker();
    else openAccessBirthdayPicker();
  });

  accessModulesBirthday?.addEventListener("click", () => {
    if (accessBirthdayPickerOpen) closeAccessBirthdayPicker();
    else openAccessBirthdayPicker();
  });

  accessModulesBirthdayPicker.querySelector('[data-bday-nav="prev"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    accessBirthdayPickerMonth = (accessBirthdayPickerMonth + 11) % 12;
    renderAccessBirthdayPicker();
  });

  accessModulesBirthdayPicker.querySelector('[data-bday-nav="next"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    accessBirthdayPickerMonth = (accessBirthdayPickerMonth + 1) % 12;
    renderAccessBirthdayPicker();
  });

  accessModulesBirthdayPicker.querySelector(".st2-birthday-picker-clear")?.addEventListener("click", () => {
    if (accessModulesBirthday) accessModulesBirthday.value = "";
    closeAccessBirthdayPicker();
  });

  document.addEventListener("click", (e) => {
    if (!accessBirthdayPickerOpen) return;
    if (e.target.closest(".st2-birthday-field")) return;
    closeAccessBirthdayPicker();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && accessBirthdayPickerOpen) closeAccessBirthdayPicker();
  });
}

function closeAccessModulesModal() {
  accessModulesOverlay?.classList.add("hidden");
  accessModulesEmailValue = "";
  accessModulesAfterApprove = false;
  accessModulesPresetMode = false;
  accessModulesSaving = false;
  closeAccessBirthdayPicker();
  accessModulesEmail?.classList.remove("hidden");
  accessModulesEmailInput?.classList.add("hidden");
  if (accessModulesEmailInput) accessModulesEmailInput.value = "";
  if (accessModulesError) accessModulesError.textContent = "";
  if (accessModulesTitle) accessModulesTitle.textContent = "Módulos habilitados";
  if (accessModulesSave) {
    accessModulesSave.disabled = false;
    accessModulesSave.textContent = "Guardar";
  }
  if (accessModulesCancel) {
    accessModulesCancel.disabled = false;
    accessModulesCancel.textContent = "Cancelar";
  }
}

function isValidAccessProfileEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at >= normalized.length - 1) return false;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!local || local.includes(" ") || local.includes("@")) return false;
  if (domain !== "thomsonreuters.com") return false;
  return /^[a-z]{2,}(\.[a-z]{2,})+$/.test(local);
}

function showAccessModulesError(message) {
  if (accessModulesError) {
    accessModulesError.textContent = message;
    accessModulesError.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function accessModulesSaveLabel() {
  if (accessModulesPresetMode) return "Crear un perfil nuevo";
  if (accessModulesAfterApprove) return "Listo";
  return "Guardar";
}

function accessModDefault(mods, key) {
  return mods[key] == null ? true : !!mods[key];
}

function readAccessModuleChecksFromForm() {
  return {
    oportunidad: !!accessModOportunidad?.checked,
    pdfPortal: !!accessModPdf?.checked,
    blanqueo: !!accessModBlanqueo?.checked,
    blanqueoConfirm: !!accessModBlanqueoConfirm?.checked,
    blanqueoLoad: !!accessModBlanqueoLoad?.checked,
    borradoBases: !!accessModBorradoBases?.checked,
    borradoBasesConfirm: !!accessModBorradoBasesConfirm?.checked,
    borradoBasesLoad: !!accessModBorradoBasesLoad?.checked,
    planillasSqlOnvio: !!accessModPlanillasSqlOnvio?.checked,
    planillasTransferencia: !!accessModPlanillasTransferencia?.checked,
    planillasReferral: !!accessModPlanillasReferral?.checked,
    planillasLegal: !!accessModPlanillasLegal?.checked,
    legalFirm: !!accessModLegalFirm?.checked,
    legalHighq: !!accessModLegalHighq?.checked,
    legalWestlaw: !!accessModLegalWestlaw?.checked,
    legalCocounsel: !!accessModLegalCocounsel?.checked,
    planillasChile: !!accessModPlanillasChile?.checked,
    chileTransferencia: !!accessModChileTransferencia?.checked,
    chileReferral: !!accessModChileReferral?.checked,
    chileSaad: !!accessModChileSaad?.checked,
    chileHr: !!accessModChileHr?.checked,
    chileWiki: !!accessModChileWiki?.checked,
    chileLp: !!accessModChileLp?.checked,
    chilePowerapps: !!accessModChilePowerapps?.checked,
  };
}

function setAccessModuleChecks(mods, { presetDefaults = false } = {}) {
  const def = (key) => (presetDefaults ? true : accessModDefault(mods, key));
  if (accessModOportunidad) accessModOportunidad.checked = presetDefaults ? false : !!mods.oportunidad;
  if (accessModPdf) accessModPdf.checked = presetDefaults ? false : !!mods.pdfPortal;
  if (accessModPlanillasSqlOnvio) accessModPlanillasSqlOnvio.checked = def("planillasSqlOnvio");
  if (accessModPlanillasTransferencia) accessModPlanillasTransferencia.checked = def("planillasTransferencia");
  if (accessModPlanillasReferral) accessModPlanillasReferral.checked = def("planillasReferral");
  if (accessModPlanillasLegal) accessModPlanillasLegal.checked = def("planillasLegal");
  if (accessModLegalFirm) accessModLegalFirm.checked = def("legalFirm");
  if (accessModLegalHighq) accessModLegalHighq.checked = def("legalHighq");
  if (accessModLegalWestlaw) accessModLegalWestlaw.checked = def("legalWestlaw");
  if (accessModLegalCocounsel) accessModLegalCocounsel.checked = def("legalCocounsel");
  if (accessModPlanillasChile) accessModPlanillasChile.checked = def("planillasChile");
  if (accessModChileTransferencia) accessModChileTransferencia.checked = def("chileTransferencia");
  if (accessModChileReferral) accessModChileReferral.checked = def("chileReferral");
  if (accessModChileSaad) accessModChileSaad.checked = def("chileSaad");
  if (accessModChileHr) accessModChileHr.checked = def("chileHr");
  if (accessModChileWiki) accessModChileWiki.checked = def("chileWiki");
  if (accessModChileLp) accessModChileLp.checked = def("chileLp");
  if (accessModChilePowerapps) accessModChilePowerapps.checked = def("chilePowerapps");
  if (accessModBlanqueo) accessModBlanqueo.checked = presetDefaults ? false : !!mods.blanqueo;
  if (accessModBlanqueoConfirm) accessModBlanqueoConfirm.checked = presetDefaults ? false : !!mods.blanqueoConfirm;
  if (accessModBlanqueoLoad) {
    accessModBlanqueoLoad.checked = presetDefaults
      ? false
      : mods.blanqueoLoad == null
        ? !!mods.blanqueo && !mods.blanqueoConfirm
        : !!mods.blanqueoLoad;
  }
  if (accessModBorradoBases) accessModBorradoBases.checked = presetDefaults ? false : !!mods.borradoBases;
  if (accessModBorradoBasesConfirm) accessModBorradoBasesConfirm.checked = presetDefaults ? false : !!mods.borradoBasesConfirm;
  if (accessModBorradoBasesLoad) {
    accessModBorradoBasesLoad.checked = presetDefaults
      ? false
      : mods.borradoBasesLoad == null
        ? !!mods.borradoBases && !mods.borradoBasesConfirm
        : !!mods.borradoBasesLoad;
  }
}

function resetSqlSystemModules(enabled) {
  const on = !!enabled;
  const inputs = [
    accessModPlanillasTransferencia,
    accessModPlanillasReferral,
    accessModOportunidad,
    accessModPdf,
    accessModBlanqueo,
    accessModBlanqueoConfirm,
    accessModBlanqueoLoad,
    accessModBorradoBases,
    accessModBorradoBasesConfirm,
    accessModBorradoBasesLoad,
  ];
  inputs.forEach((el) => { if (el) el.checked = false; });
  if (!on) return;
  [
    accessModPlanillasTransferencia,
    accessModPlanillasReferral,
    accessModOportunidad,
    accessModPdf,
    accessModBlanqueo,
    accessModBorradoBases,
  ].forEach((el) => { if (el) el.checked = true; });
  if (accessModBlanqueoLoad) accessModBlanqueoLoad.checked = true;
  if (accessModBorradoBasesLoad) accessModBorradoBasesLoad.checked = true;
  if (accessModBlanqueoLoad) delete accessModBlanqueoLoad.dataset.userTouched;
  if (accessModBorradoBasesLoad) delete accessModBorradoBasesLoad.dataset.userTouched;
}

function resetLegalSystemModules(enabled) {
  const on = !!enabled;
  [
    accessModLegalFirm,
    accessModLegalHighq,
    accessModLegalWestlaw,
    accessModLegalCocounsel,
  ].forEach((el) => { if (el) el.checked = on; });
}

function resetChileSystemModules(enabled) {
  const on = !!enabled;
  [
    accessModChileTransferencia,
    accessModChileReferral,
    accessModChileSaad,
    accessModChileHr,
    accessModChileWiki,
    accessModChileLp,
    accessModChilePowerapps,
  ].forEach((el) => { if (el) el.checked = on; });
}

function getAccessSysExpandButton(sys) {
  return accessModulesSysExpandButtons.find((btn) => btn.dataset.sysExpand === sys) || null;
}

function setAccessSysBodyOpen(sys, open) {
  const body = sys === "sql" ? accessModulesSqlGroup
    : sys === "legal" ? accessModulesLegalGroup
      : accessModulesChileGroup;
  const btn = getAccessSysExpandButton(sys);
  if (!body) return;
  body.classList.toggle("hidden", !open);
  body.classList.toggle("is-open", open);
  if (btn) {
    btn.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    const icon = btn.querySelector(".st2-access-modules-sys-expand-icon");
    if (icon) icon.textContent = open ? "−" : "+";
  }
}

function collapseAllAccessSysBodies() {
  ["sql", "legal", "chile"].forEach((sys) => setAccessSysBodyOpen(sys, false));
}

function toggleAccessSysBody(sys) {
  const body = sys === "sql" ? accessModulesSqlGroup
    : sys === "legal" ? accessModulesLegalGroup
      : accessModulesChileGroup;
  if (!body || body.classList.contains("is-disabled")) return;
  const open = body.classList.contains("hidden");
  setAccessSysBodyOpen(sys, open);
}

function syncAccessSystemCard(sys, { group, card, enabled }) {
  const on = !!enabled;
  group?.classList.toggle("is-disabled", !on);
  card?.classList.toggle("is-disabled", !on);
  const btn = getAccessSysExpandButton(sys);
  if (btn) btn.disabled = !on;
  if (!on) setAccessSysBodyOpen(sys, false);
}

function syncAccessSqlModulesGroup() {
  syncAccessSystemCard("sql", {
    group: accessModulesSqlGroup,
    card: accessModulesSqlCard,
    enabled: accessModPlanillasSqlOnvio?.checked,
  });
}

function syncAccessLegalModulesGroup() {
  syncAccessSystemCard("legal", {
    group: accessModulesLegalGroup,
    card: accessModulesLegalCard,
    enabled: accessModPlanillasLegal?.checked,
  });
}

function syncAccessChileModulesGroup() {
  syncAccessSystemCard("chile", {
    group: accessModulesChileGroup,
    card: accessModulesChileCard,
    enabled: accessModPlanillasChile?.checked,
  });
}

function syncAccessSystemModuleGroups() {
  syncAccessSqlModulesGroup();
  syncAccessLegalModulesGroup();
  syncAccessChileModulesGroup();
}

function startAccessProfilePreview(email, modulesOverride = null) {
  if (!isSt2SuperAdmin()) return;
  if (!email) return;
  const current = accessAdminItemsCache.find((item) => item.email === email);
  if (!current || current.isPending) return;
  const displayName = formatAccessDisplayName(current.email, current.displayNameOverride);
  const run = () => {
    startViewAsProfile({
      email: current.email,
      displayName,
      modules: modulesOverride || current.modules || {},
      st2Admin: !!current.isSt2Admin,
    });
    window.location.hash = "#/planillas";
    window.location.reload();
  };
  // Auditoría best-effort; la vista previa no depende del POST.
  fetch("/api/access/view-as", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: current.email }),
  }).catch(() => {}).finally(run);
}

function modulesFromAccessForm() {
  return readAccessModuleChecksFromForm();
}

function previewAccessModulesProfile() {
  if (!accessModulesEmailValue) return;
  startAccessProfilePreview(accessModulesEmailValue, modulesFromAccessForm());
}

async function exitViewAsProfile() {
  clearViewAsProfile();
  syncViewAsBanner();
  syncAdminTabVisibility();
  document.dispatchEvent(new CustomEvent("st2:session-changed"));
  await refreshModuleFlags({ force: true });
  navigateTab(ADMIN_TAB_ID, { history: "replace" });
}

function syncViewAsBanner() {
  const viewAs = getViewAsProfile();
  const show = !!viewAs;
  if (viewAsBanner) {
    viewAsBanner.classList.toggle("hidden", !show);
    viewAsBanner.toggleAttribute("hidden", !show);
  }
  if (viewAsBannerText && viewAs) {
    viewAsBannerText.textContent = `Vista previa: cómo ve ST2 ${viewAs.displayName || viewAs.email} (módulos, permisos y pantallas)`;
  }
  document.body.classList.toggle("st2-viewing-as-profile", show);
}

function openAccessModulesModal(email, { afterApprove = false } = {}) {
  if (!accessModulesOverlay || !email) return;
  accessModulesSaving = false;
  accessModulesPresetMode = false;
  accessModulesEmail?.classList.remove("hidden");
  accessModulesEmailInput?.classList.add("hidden");
  const current = accessAdminItemsCache.find((item) => item.email === email);
  const mods = current?.modules || {};
  const isPrimary = String(email).trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
  accessModulesEmailValue = email;
  accessModulesAfterApprove = !!afterApprove;
  const displayName = formatAccessDisplayName(email, current?.displayNameOverride);
  if (accessModulesTitle) {
    accessModulesTitle.textContent = afterApprove ? "¿Qué módulos ve?" : "Módulos habilitados";
  }
  if (accessModulesSave) accessModulesSave.textContent = afterApprove ? "Listo" : "Guardar";
  if (accessModulesCancel) accessModulesCancel.textContent = afterApprove ? "Después" : "Cancelar";
  if (accessModulesName) accessModulesName.value = displayName;
  if (accessModulesBirthday) {
    accessModulesBirthday.value = current?.birthdayDisplay || "";
  }
  if (accessModulesEmail) accessModulesEmail.textContent = email;
  if (accessModBlanqueoLoad) delete accessModBlanqueoLoad.dataset.userTouched;
  if (accessModBorradoBasesLoad) delete accessModBorradoBasesLoad.dataset.userTouched;
  setAccessModuleChecks(mods);
  if (accessModSt2Admin) {
    accessModSt2Admin.checked = isPrimary || !!current?.isSt2Admin;
    accessModSt2Admin.disabled = isPrimary || !isPrimarySuperAdmin();
  }
  if (accessModSt2AdminWrap) {
    accessModSt2AdminWrap.classList.toggle("is-primary-locked", isPrimary);
    accessModSt2AdminWrap.classList.toggle("hidden", !isPrimarySuperAdmin());
  }
  syncAccessSystemModuleGroups();
  collapseAllAccessSysBodies();
  if (accessModulesError) accessModulesError.textContent = "";
  if (accessModulesSave) {
    accessModulesSave.disabled = false;
    accessModulesSave.textContent = accessModulesSaveLabel();
  }
  if (accessModulesCancel) accessModulesCancel.disabled = false;
  accessModulesOverlay.classList.remove("hidden");
}

function openAccessPresetModal() {
  if (!accessModulesOverlay || !isSt2SuperAdmin()) return;
  accessModulesSaving = false;
  accessModulesPresetMode = true;
  accessModulesAfterApprove = false;
  accessModulesEmailValue = "";
  if (accessModulesTitle) accessModulesTitle.textContent = "Crear un perfil nuevo";
  if (accessModulesSave) accessModulesSave.textContent = "Crear un perfil nuevo";
  if (accessModulesCancel) accessModulesCancel.textContent = "Cancelar";
  if (accessModulesName) accessModulesName.value = "";
  if (accessModulesBirthday) accessModulesBirthday.value = "";
  if (accessModulesEmail) {
    accessModulesEmail.textContent = "";
    accessModulesEmail.classList.add("hidden");
  }
  if (accessModulesEmailInput) {
    accessModulesEmailInput.value = "";
    accessModulesEmailInput.classList.remove("hidden");
  }
  if (accessModBlanqueoLoad) delete accessModBlanqueoLoad.dataset.userTouched;
  if (accessModBorradoBasesLoad) delete accessModBorradoBasesLoad.dataset.userTouched;
  setAccessModuleChecks({}, { presetDefaults: true });
  if (accessModSt2Admin) accessModSt2Admin.checked = false;
  if (accessModSt2Admin) accessModSt2Admin.disabled = !isPrimarySuperAdmin();
  if (accessModSt2AdminWrap) {
    accessModSt2AdminWrap.classList.toggle("hidden", !isPrimarySuperAdmin());
    accessModSt2AdminWrap.classList.remove("is-primary-locked");
  }
  syncAccessSystemModuleGroups();
  collapseAllAccessSysBodies();
  if (accessModulesError) accessModulesError.textContent = "";
  if (accessModulesSave) {
    accessModulesSave.disabled = false;
    accessModulesSave.textContent = "Crear un perfil nuevo";
  }
  if (accessModulesCancel) accessModulesCancel.disabled = false;
  accessModulesOverlay.classList.remove("hidden");
  accessModulesEmailInput?.focus();
}

accessModPlanillasSqlOnvio?.addEventListener("change", () => {
  resetSqlSystemModules(accessModPlanillasSqlOnvio.checked);
  syncAccessSqlModulesGroup();
});
accessModPlanillasLegal?.addEventListener("change", () => {
  resetLegalSystemModules(accessModPlanillasLegal.checked);
  syncAccessLegalModulesGroup();
});
accessModPlanillasChile?.addEventListener("change", () => {
  resetChileSystemModules(accessModPlanillasChile.checked);
  syncAccessChileModulesGroup();
});
accessModulesSysExpandButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const sys = btn.dataset.sysExpand;
    if (!sys || btn.disabled) return;
    toggleAccessSysBody(sys);
  });
});
accessModBlanqueoConfirm?.addEventListener("change", () => {
  if (accessModBlanqueoConfirm.checked && accessModBlanqueo) {
    accessModBlanqueo.checked = true;
  }
  // Al marcar confirmador, por defecto solo listado (podés reactivar “cargar”).
  if (accessModBlanqueoConfirm.checked && accessModBlanqueoLoad && !accessModBlanqueoLoad.dataset.userTouched) {
    accessModBlanqueoLoad.checked = false;
  }
});
accessModBlanqueoLoad?.addEventListener("change", () => {
  if (accessModBlanqueoLoad) accessModBlanqueoLoad.dataset.userTouched = "1";
  if (accessModBlanqueoLoad?.checked && accessModBlanqueo) {
    accessModBlanqueo.checked = true;
  }
});
accessModBlanqueo?.addEventListener("change", () => {
  if (!accessModBlanqueo.checked) {
    if (accessModBlanqueoConfirm) accessModBlanqueoConfirm.checked = false;
    if (accessModBlanqueoLoad) accessModBlanqueoLoad.checked = false;
  } else if (accessModBlanqueoLoad && !accessModBlanqueoConfirm?.checked) {
    accessModBlanqueoLoad.checked = true;
  }
});

accessModBorradoBasesConfirm?.addEventListener("change", () => {
  if (accessModBorradoBasesConfirm.checked && accessModBorradoBases) {
    accessModBorradoBases.checked = true;
  }
  if (accessModBorradoBasesConfirm.checked && accessModBorradoBasesLoad && !accessModBorradoBasesLoad.dataset.userTouched) {
    accessModBorradoBasesLoad.checked = false;
  }
});
accessModBorradoBasesLoad?.addEventListener("change", () => {
  if (accessModBorradoBasesLoad) accessModBorradoBasesLoad.dataset.userTouched = "1";
  if (accessModBorradoBasesLoad?.checked && accessModBorradoBases) {
    accessModBorradoBases.checked = true;
  }
});
accessModBorradoBases?.addEventListener("change", () => {
  if (!accessModBorradoBases.checked) {
    if (accessModBorradoBasesConfirm) accessModBorradoBasesConfirm.checked = false;
    if (accessModBorradoBasesLoad) accessModBorradoBasesLoad.checked = false;
  } else if (accessModBorradoBasesLoad && !accessModBorradoBasesConfirm?.checked) {
    accessModBorradoBasesLoad.checked = true;
  }
});

async function saveAccessModules() {
  if (accessModulesSaving) return;
  if (!accessModulesPresetMode && !accessModulesEmailValue) return;

  accessModulesSaving = true;
  if (accessModulesSave) {
    accessModulesSave.disabled = true;
    accessModulesSave.textContent = accessModulesPresetMode ? "Creando…" : "Guardando…";
  }
  if (accessModulesCancel) accessModulesCancel.disabled = true;
  if (accessModulesError) accessModulesError.textContent = "";

  const modulesBody = {
    ...readAccessModuleChecksFromForm(),
    st2Admin: isPrimarySuperAdmin() ? !!accessModSt2Admin?.checked : undefined,
  };

  try {
    const nameValue = String(accessModulesName?.value || "").trim();
    const birthdayRaw = String(accessModulesBirthday?.value || "").trim();

    if (accessModulesPresetMode) {
      const email = String(accessModulesEmailInput?.value || "").trim().toLowerCase();
      if (!email) throw new Error("Ingresá el correo del perfil.");
      if (!isValidAccessProfileEmail(email)) {
        throw new Error("Usá un correo @thomsonreuters.com con formato nombre.apellido (puede incluir más segmentos).");
      }
      const autoName = parseAccessNameFromEmail(email).display;
      const nameOverride = !nameValue || nameValue === autoName ? null : nameValue;

      const response = await fetch("/api/access/registrations/preset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          displayName: nameOverride,
          birthdayMmDd: birthdayRaw || null,
          clearBirthday: !birthdayRaw,
          ...modulesBody,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Error ${response.status}`);

      closeAccessModulesModal();
      await loadAccessAdminRegistrations({ silent: true, force: true });
      setAccessAdminUpdatedHint(`Perfil precargado: ${email}`);
      notifyAccessChanged();
      return;
    }

    const autoName = parseAccessNameFromEmail(accessModulesEmailValue).display;
    const nameOverride = !nameValue || nameValue === autoName ? null : nameValue;
    const nameRes = await fetch("/api/access/registrations", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: accessModulesEmailValue,
        displayName: nameOverride,
        birthdayMmDd: birthdayRaw || null,
        clearBirthday: !birthdayRaw,
      }),
    });
    const nameData = await nameRes.json().catch(() => ({}));
    if (!nameRes.ok) throw new Error(nameData.error || "No se pudo guardar el nombre.");

    const response = await fetch("/api/access/registrations/modules", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: accessModulesEmailValue,
        ...modulesBody,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
    const mods = data.modules || {};
    accessAdminItemsCache = accessAdminItemsCache.map((item) =>
      item.email === accessModulesEmailValue
        ? {
            ...item,
            displayNameOverride: nameOverride,
            birthdayDisplay: nameData.birthdayDisplay || null,
            birthdayMmDd: nameData.birthdayMmDd || null,
            isSt2Admin: !!(data.isSt2Admin ?? accessModSt2Admin?.checked),
            modules: normalizeAccessModules(mods),
          }
        : item
    );
    const fromApprove = accessModulesAfterApprove;
    closeAccessModulesModal();
    renderAccessAdminTable();
    if (fromApprove) setAccessAdminUpdatedHint("Aprobado. Módulos guardados.");
  } catch (err) {
    showAccessModulesError(err?.message || "No se pudo guardar.");
  } finally {
    accessModulesSaving = false;
    if (accessModulesSave) {
      accessModulesSave.disabled = false;
      accessModulesSave.textContent = accessModulesSaveLabel();
    }
    if (accessModulesCancel) accessModulesCancel.disabled = false;
  }
}

accessModulesClose?.addEventListener("click", closeAccessModulesModal);
accessModulesCancel?.addEventListener("click", closeAccessModulesModal);
accessModulesSave?.addEventListener("click", () => { void saveAccessModules(); });
accessModulesOverlay?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.isComposing) return;
  const tag = e.target?.tagName?.toLowerCase();
  if (tag !== "input" && tag !== "button") return;
  e.preventDefault();
  void saveAccessModules();
});
accessModulesOverlay?.addEventListener("click", (e) => {
  if (e.target === accessModulesOverlay) closeAccessModulesModal();
});

accessNameEditClose?.addEventListener("click", closeAccessNameEditModal);
accessNameEditCancel?.addEventListener("click", closeAccessNameEditModal);
accessNameEditSuggest?.addEventListener("click", () => {
  if (accessNameEditInput) {
    accessNameEditInput.value = accessNameEditAutoValue;
    accessNameEditInput.focus();
    accessNameEditInput.select();
  }
});
accessNameEditReset?.addEventListener("click", () => {
  void saveAccessNameEdit("");
});
accessNameEditSave?.addEventListener("click", () => {
  void saveAccessNameEdit(accessNameEditInput?.value || "");
});
accessNameEditInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    void saveAccessNameEdit(accessNameEditInput.value || "");
  }
  if (e.key === "Escape") {
    e.preventDefault();
    closeAccessNameEditModal();
  }
});
accessNameEditOverlay?.addEventListener("click", (e) => {
  if (e.target === accessNameEditOverlay) closeAccessNameEditModal();
});
homeBtn?.addEventListener("click", goHome);
aboutCloseBtn?.addEventListener("click", hideAbout);
aboutOverlay?.addEventListener("click", (e) => {
  if (e.target === aboutOverlay) hideAbout();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && aboutOverlay && !aboutOverlay.classList.contains("hidden")) {
    hideAbout();
  }
});

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => navigateTab(btn.dataset.tab));
});

function getEmbedFrameUrl(kind) {
  if (kind === "thom") {
    const tap = getThomExternalUrl();
    // Solo el portal Bejerman usa el proxy embebido cuando está disponible.
    if (thomPortalId === "bejerman" && appConfig?.thomFrameUrl && isThomEmbeddedProxy()) {
      return appConfig.thomFrameUrl;
    }
    if (isThomWindowMode() || thomPortalId !== "bejerman") return tap;
    if (appConfig?.thomEmbedMode === "direct") return tap;
    try {
      const u = new URL(tap);
      return `${u.pathname}${u.search}`;
    } catch {
      return "/css-tap";
    }
  }
  if (kind === "ai") return appConfig?.aiPlatformUrl;
  if (kind === "portal") return getPortalLoginUrl();
  return null;
}

function isThomWindowMode() {
  const mode = appConfig?.thomEmbedMode;
  return mode === "window" || mode === "direct";
}

function isThomEmbeddedProxy() {
  return appConfig?.thomEmbedMode === "proxy" && thomPortalId === "bejerman";
}

/** @deprecated use isThomWindowMode */
function isThomDirectEmbed() {
  return isThomWindowMode();
}

const THOM_PORTAL_KEY = "st2-thom-portal";
const THOM_PORTALS = {
  bejerman: {
    label: "SQL/ONVIO/WEB",
    fallback: "https://css-latam.int.thomsonreuters.com/css-tap",
    configKey: "thomTapUrl",
  },
  legal: {
    label: "LEGAL",
    fallback: "https://css-latam.int.thomsonreuters.com/legal_ar",
    configKey: "thomLegalUrl",
  },
  chile: {
    label: "CHILE",
    fallback: "https://css-latam.int.thomsonreuters.com/tap_chile",
    configKey: "thomChileUrl",
  },
};

let thomPortalId = loadThomPortalId();

function loadThomPortalId() {
  try {
    const saved = localStorage.getItem(THOM_PORTAL_KEY);
    if (saved && THOM_PORTALS[saved] && canSeeProfilePortal(saved)) return saved;
  } catch {
    // ignore
  }
  const visible = listVisibleProfilePortals();
  return visible[0] || "bejerman";
}

function setThomPortalId(id) {
  if (!THOM_PORTALS[id] || !canSeeProfilePortal(id)) return;
  thomPortalId = id;
  try {
    localStorage.setItem(THOM_PORTAL_KEY, id);
  } catch {
    // ignore
  }
  syncThomPortalUi();
}

function getThomPortalMeta() {
  return THOM_PORTALS[thomPortalId] || THOM_PORTALS.bejerman;
}

function getThomExternalUrl() {
  const meta = getThomPortalMeta();
  const fromConfig = appConfig?.[meta.configKey];
  return (typeof fromConfig === "string" && fromConfig.trim())
    ? fromConfig.trim()
    : meta.fallback;
}

function getThomTapUrl() {
  const external = getThomExternalUrl();
  // Proxy local solo para Bejerman (css-tap). LEGAL/Chile van directo.
  if (thomPortalId === "bejerman" && appConfig?.thomProxyReachable) {
    try {
      const u = new URL(external);
      return `${window.location.origin}${u.pathname}${u.search}`;
    } catch {
      return `${window.location.origin}/css-tap`;
    }
  }
  return external;
}

function syncThomPortalUi() {
  const meta = getThomPortalMeta();
  document.querySelectorAll("[data-thom-portal]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.thomPortal === thomPortalId);
  });
  const title = document.getElementById("thomGateTitle");
  if (title) title.textContent = `THOM · ${meta.label}`;
  const loading = document.getElementById("thomEmbedLoadingText");
  if (loading) loading.textContent = `Cargando THOM · ${meta.label}…`;
  if (thomFrame) thomFrame.title = `THOM · ${meta.label}`;
  updateThomDirectUi();
}

function onThomPortalChange(id) {
  if (!THOM_PORTALS[id]) return;
  const same = id === thomPortalId;
  if (!same) setThomPortalId(id);

  // Las pastillas siempre abren/reabren THOM (no dejar al usuario en el gate).
  if (!document.querySelector('.tab-btn.active[data-tab="thom"]')) return;

  if (!shellRouteSyncing) syncTabHistory("thom", same ? "replace" : "push");

  if (isThomWindowMode()) {
    showThomPanelPlaceholder();
    openThomWindow({ reload: !same });
    return;
  }

  if (!same) {
    resetThomDirectFrame();
    activateThomTab();
  }
}

function initThomPortalSelector() {
  syncThomPortalUi();
  document.querySelectorAll("[data-thom-portal]").forEach((btn) => {
    btn.addEventListener("click", () => onThomPortalChange(btn.dataset.thomPortal));
  });
}

const THOM_POPUP_NAME = "st2ThomPanel";
const THOM_TAB_NAME = "st2ThomBrowserTab";

let thomPopup = null;
let thomBrowserTab = null;
/** Invalida aperturas programadas con rAF si el usuario ya salió de THOM. */
let thomOpenGeneration = 0;
let thomPopupResizeTimer = null;

/** Fallback si no se puede medir el chrome del popup hijo. */
const THOM_POPUP_CHROME_HEIGHT = 40;
/** Edge suele agregar barra de URL al navegar a css-latam (antes de poder medir). */
const THOM_POPUP_CHROME_WITH_URL = 76;

function measureThomPopupChrome(popup = thomPopup) {
  if (!popup || popup.closed) return THOM_POPUP_CHROME_WITH_URL;
  try {
    const measured = popup.outerHeight - popup.innerHeight;
    if (Number.isFinite(measured) && measured > 20 && measured < 160) return measured;
  } catch {
    // Tras navegar a THOM puede quedar cross-origin.
  }
  return THOM_POPUP_CHROME_WITH_URL;
}

/** Holgura mínima debajo de las pestañas ST2 (el ancla real es el panel). */
const THOM_POPUP_TAB_GAP = 4;

function getThomPanelRect(popupChrome = THOM_POPUP_CHROME_WITH_URL) {
  const tabBar = document.querySelector(".tab-bar");
  const frameWrap = document.querySelector("#panel-thom .embed-frame-wrap");
  const tabRect = tabBar?.getBoundingClientRect();
  const wrapRect = frameWrap?.getBoundingClientRect();

  let viewportTop;
  if (wrapRect && wrapRect.height > 60) {
    // Encaja en el hueco del panel: deja header + pestañas + hint visibles.
    viewportTop = Math.round(wrapRect.top);
  } else if (tabRect) {
    viewportTop = Math.round(tabRect.bottom + THOM_POPUP_TAB_GAP);
  } else {
    return { top: 160, left: 0, width: 1100, height: 720 };
  }

  // Nunca tapar la barra de pestañas ni el selector de portal, que flota debajo.
  if (tabRect) {
    viewportTop = Math.max(viewportTop, Math.round(tabRect.bottom + THOM_POPUP_TAB_GAP));
  }
  if (thomPortalBar && !thomPortalBar.classList.contains("hidden")) {
    const barRect = thomPortalBar.getBoundingClientRect();
    if (barRect.height > 0) {
      viewportTop = Math.max(viewportTop, Math.round(barRect.bottom + THOM_POPUP_TAB_GAP));
    }
  }

  const viewportHeight = Math.max(360, Math.round(window.innerHeight - viewportTop - 4));
  const chromeTop = Math.max(0, window.outerHeight - window.innerHeight);
  const chromeLeft = Math.max(0, (window.outerWidth - window.innerWidth) / 2);
  const screenTop = Number.isFinite(window.screenTop) ? window.screenTop : window.screenY;
  const screenLeft = Number.isFinite(window.screenLeft) ? window.screenLeft : window.screenX;

  let top = Math.round(screenTop + chromeTop + viewportTop);
  const left = Math.round(screenLeft + chromeLeft);
  const width = Math.max(480, Math.round(window.innerWidth));
  let height = viewportHeight + popupChrome;

  const availTop = window.screen?.availTop ?? 0;
  const availBottom = availTop + (window.screen?.availHeight ?? window.screen?.height ?? top + height);
  if (top + height > availBottom) {
    height = Math.max(360 + popupChrome, availBottom - top);
  }

  return { top, left, width, height };
}

function buildThomPopupFeatures(rect) {
  return [
    `left=${rect.left}`,
    `top=${rect.top}`,
    `width=${rect.width}`,
    `height=${rect.height}`,
    "popup=yes",
    "resizable=yes",
    "scrollbars=1",
    "toolbar=0",
    "menubar=0",
    "location=0",
    "status=0",
  ].join(",");
}

function repositionThomPopup() {
  if (!thomPopup || thomPopup.closed || !isThomWindowMode()) return;
  const rect = getThomPanelRect(measureThomPopupChrome());
  try {
    thomPopup.moveTo(rect.left, rect.top);
    thomPopup.resizeTo(rect.width, rect.height);

    // Edge a veces coloca el popup más arriba de lo pedido y tapa las pestañas ST2.
    const actualTop = Number.isFinite(thomPopup.screenTop) ? thomPopup.screenTop : thomPopup.screenY;
    const driftY = rect.top - actualTop;
    if (Number.isFinite(driftY) && Math.abs(driftY) > 2 && Math.abs(driftY) < 220) {
      thomPopup.moveBy(0, driftY);
    }

    const actualH = thomPopup.outerHeight;
    if (Number.isFinite(actualH) && actualH > rect.height + 4) {
      thomPopup.resizeTo(rect.width, rect.height);
    }
  } catch {
    // El navegador puede bloquear moveTo/resizeTo en ventanas no propias.
  }
}

function scheduleThomPopupReposition() {
  clearTimeout(thomPopupResizeTimer);
  thomPopupResizeTimer = setTimeout(repositionThomPopup, 120);
}

/**
 * El popup debe comportarse como parte del panel: sigue a la ventana ST2 cuando
 * se mueve o cambia de tamaño, y el gate vuelve a su estado inicial si el
 * usuario lo cierra desde la barra del navegador.
 */
let thomPopupWatchTimer = null;
let thomPopupAnchor = null;

function readThomAnchor() {
  return [
    Number.isFinite(window.screenX) ? window.screenX : window.screenLeft,
    Number.isFinite(window.screenY) ? window.screenY : window.screenTop,
    window.innerWidth,
    window.innerHeight,
  ].join(":");
}

function stopThomPopupWatch() {
  clearInterval(thomPopupWatchTimer);
  thomPopupWatchTimer = null;
  thomPopupAnchor = null;
}

function startThomPopupWatch() {
  stopThomPopupWatch();
  thomPopupAnchor = readThomAnchor();
  thomPopupWatchTimer = setInterval(() => {
    if (!thomPopup || thomPopup.closed) {
      thomPopup = null;
      stopThomPopupWatch();
      updateThomDirectUi();
      return;
    }
    const anchor = readThomAnchor();
    if (anchor === thomPopupAnchor) return;
    thomPopupAnchor = anchor;
    repositionThomPopup();
  }, 400);
}

function focusThomPopup() {
  if (!thomPopup || thomPopup.closed) {
    openThomWindow();
    return;
  }
  repositionThomPopup();
  try {
    thomPopup.focus();
  } catch {
    // El navegador puede bloquear focus() en ventanas no propias.
  }
}

function alignThomPopupAfterOpen({ afterNavigate = false } = {}) {
  repositionThomPopup();
  scheduleThomPopupReposition();
  const delays = afterNavigate
    ? [80, 200, 450, 900, 1500, 2200, 3200]
    : [60, 150, 350, 700, 1200];
  delays.forEach((ms) => setTimeout(repositionThomPopup, ms));
}

function watchThomPopupLoad(popup) {
  if (!popup || popup.closed) return;
  const onLoad = () => {
    repositionThomPopup();
    alignThomPopupAfterOpen({ afterNavigate: true });
  };
  try {
    popup.addEventListener("load", onLoad);
  } catch {
    // ignore
  }
}

function shouldAutoCloseThomHelp() {
  return appConfig?.thomAutoCloseHelpPanel !== false;
}

function requestThomHelpCollapse(targetWindow) {
  if (!shouldAutoCloseThomHelp() || !targetWindow) return false;
  try {
    const btn = targetWindow.document?.querySelector?.('button[class*="panelOpened"]');
    if (btn) {
      btn.click();
      return true;
    }
  } catch {
    // Ventana cross-origin (THOM directo en web pública).
  }
  try {
    targetWindow.postMessage({ type: "st2-collapse-help" }, "*");
  } catch {
    // ignore
  }
  return false;
}

function scheduleThomHelpCollapse(targetWindow = thomPopup) {
  if (!shouldAutoCloseThomHelp() || !targetWindow) return;
  let tries = 0;
  const tick = () => {
    if (!targetWindow || targetWindow.closed) return;
    if (requestThomHelpCollapse(targetWindow) || ++tries > 80) return;
    setTimeout(tick, 300);
  };
  tick();
}

function safeCloseWindow(win) {
  if (!win || win.closed || win === window) return;
  try {
    win.close();
  } catch {
    // El navegador puede bloquear close() en ventanas no propias.
  }
}

/** Solo para pagehide: recuperar ventana huérfana. En home/navegación NO usar:
 *  window.open("", name) enfoca otra pestaña del navegador o abre una en blanco. */
function reclaimNamedWindow(name) {
  try {
    const win = window.open("", name);
    if (win && win !== window && !win.closed) return win;
  } catch {
    // ignore
  }
  return null;
}

function closeThomPopup({ reclaim = false } = {}) {
  // Cancela cualquier openThomWindow pendiente (doble rAF).
  thomOpenGeneration += 1;
  stopThomPopupWatch();

  safeCloseWindow(thomPopup);
  thomPopup = null;

  if (reclaim) {
    // Por si perdimos la referencia tras navegar a css-latam (cross-origin).
    safeCloseWindow(reclaimNamedWindow(THOM_POPUP_NAME));
  }

  safeCloseWindow(thomBrowserTab);
  thomBrowserTab = null;
  if (reclaim) {
    safeCloseWindow(reclaimNamedWindow(THOM_TAB_NAME));
  }

  updateThomDirectUi();
}

function updateThomDirectUi() {
  const windowMode = isThomWindowMode();
  const embedded = isThomEmbeddedProxy();
  const active = windowMode && !!(thomPopup && !thomPopup.closed);
  const openLabel = windowMode ? "Abrir en otra pestaña del navegador" : "Abrir en navegador";
  const openBtn = document.getElementById("thomOpenBtn");
  const proxyOpenBtn = document.getElementById("thomProxyOpenBtn");
  if (openBtn) openBtn.textContent = openLabel;
  if (proxyOpenBtn) proxyOpenBtn.textContent = openLabel;
  document.getElementById("thomProxyOpenWrap")?.classList.toggle("hidden", !embedded);
  thomFrame?.classList.toggle("hidden", windowMode);
  thomDirectGate?.classList.toggle("hidden", embedded || !windowMode);
  thomDirectGate?.classList.toggle("embed-panel-active", active);

  const gateOpenBtn = document.getElementById("thomGateOpenBtn");
  if (gateOpenBtn) gateOpenBtn.textContent = active ? "Enfocar THOM" : "Abrir THOM aquí";
  document.getElementById("thomGateCloseBtn")?.classList.toggle("hidden", !active);
  document.getElementById("thomGateStatus")?.classList.toggle("hidden", !active);
  document.getElementById("thomGateZscaler")?.classList.toggle("hidden", active);
  document.getElementById("thomGateNote")?.classList.toggle("hidden", active);
}

function showThomPanelPlaceholder() {
  thomDirectGate?.classList.remove("hidden");
  hideThomLoading();
  setEmbedHint("thom", "Necesitas tener ZScaler activado.");
}

function hideThomDirectGate() {
  thomDirectGate?.classList.add("hidden");
}

function openThomWindow({ reload = false } = {}) {
  const url = getThomTapUrl();
  const generation = ++thomOpenGeneration;

  if (!reload && thomPopup && !thomPopup.closed) {
    try {
      thomPopup.focus();
    } catch {
      // ignore
    }
    alignThomPopupAfterOpen();
    startThomPopupWatch();
    updateThomDirectUi();
    return thomPopup;
  }

  // Si ya hay popup abierto y solo cambiamos portal, reutilizarlo (sin close+open).
  if (reload && thomPopup && !thomPopup.closed) {
    try {
      thomPopup.location.replace(url);
    } catch {
      try {
        thomPopup.location.href = url;
      } catch {
        // Cross-origin: forzar reopen más abajo.
        safeCloseWindow(thomPopup);
        thomPopup = null;
      }
    }

    if (thomPopup && !thomPopup.closed) {
      try {
        thomPopup.focus();
      } catch {
        // ignore
      }
      showThomPanelPlaceholder();
      startThomPopupWatch();
      updateThomDirectUi();
      alignThomPopupAfterOpen({ afterNavigate: true });
      scheduleThomHelpCollapse(thomPopup);
      return thomPopup;
    }
  }

  if (thomPopup?.closed) thomPopup = null;

  // Forzar layout con embed-active ya aplicado, sin perder el gesto de clic.
  // Si diferimos window.open a un rAF, Edge/Chrome suelen abrir minimizado o bloquear.
  void document.body.offsetHeight;
  const rect = getThomPanelRect();
  const features = buildThomPopupFeatures(rect);

  thomPopup = window.open("about:blank", THOM_POPUP_NAME, features);
  if (!thomPopup) {
    thomBrowserTab = window.open(url, THOM_TAB_NAME);
    setEmbedHint("thom", "Permití ventanas emergentes para abrir THOM en este espacio.");
    updateThomDirectUi();
    return null;
  }

  if (generation !== thomOpenGeneration) {
    safeCloseWindow(thomPopup);
    thomPopup = null;
    return null;
  }

  watchThomPopupLoad(thomPopup);

  try {
    thomPopup.location.replace(url);
  } catch {
    thomPopup.location.href = url;
  }

  try {
    thomPopup.focus();
  } catch {
    // ignore
  }

  showThomPanelPlaceholder();
  startThomPopupWatch();
  updateThomDirectUi();
  scheduleThomHelpCollapse(thomPopup);

  // Reacomodar cuando el layout del panel termine de estabilizarse.
  requestAnimationFrame(() => {
    if (generation !== thomOpenGeneration || !thomPopup || thomPopup.closed) return;
    alignThomPopupAfterOpen({ afterNavigate: true });
    try {
      thomPopup.focus();
    } catch {
      // ignore
    }
  });

  return thomPopup;
}

function openThomBrowserTab() {
  const url = getThomTapUrl();
  // Misma pestaña nombrada: no acumula una nueva cada vez, y ST2 la cierra al salir de THOM.
  if (thomBrowserTab && !thomBrowserTab.closed) {
    try {
      thomBrowserTab.location.href = url;
      thomBrowserTab.focus();
      return thomBrowserTab;
    } catch {
      safeCloseWindow(thomBrowserTab);
      thomBrowserTab = null;
    }
  }

  thomBrowserTab = window.open(url, THOM_TAB_NAME);
  return thomBrowserTab;
}

function resetThomDirectFrame() {
  if (!thomFrame) return;
  thomFrame.removeAttribute("src");
  thomFrame.src = "about:blank";
}

function activateThomTab() {
  updateThomDirectUi();
  if (isThomEmbeddedProxy()) {
    hideThomDirectGate();
    thomFrame?.classList.remove("hidden");
    loadEmbedFrame("thom");
    return;
  }
  if (isThomWindowMode()) {
    resetThomDirectFrame();
    hideThomLoading();
    showThomPanelPlaceholder();
    openThomWindow();
  }
}

function isEmbedFrameEmpty(frame) {
  const src = frame?.getAttribute("src") ?? "";
  return !src || src === "about:blank";
}

function needsEmbedReload(frame, url) {
  const current = frame?.getAttribute("src") ?? "";
  if (!current || current === "about:blank") return true;
  return current !== url;
}

function getEmbedZoom(kind) {
  if (kind === "portal") return 1;
  const zoom = kind === "thom" ? appConfig?.thomZoomFactor : appConfig?.aiPlatformZoomFactor;
  if (typeof zoom === "number" && zoom > 0.25 && zoom < 2) return zoom;
  return 0.9;
}

function applyEmbedZoom(kind) {
  const frame = kind === "thom" ? thomFrame : kind === "portal" ? portalFrame : aiFrame;
  if (!frame) return;
  frame.style.zoom = String(getEmbedZoom(kind));
}

let thomLoadTimer = null;
let thomBlankTimer = null;
let thomRendered = false;
let thomBridgeAlive = false;
let thomBlankAttempts = 0;

function isThomAuthPath(path = "") {
  return path.includes("/embed/cg/")
    || path.includes("/embed/sso/")
    || path.includes("/auth")
    || path.includes("/login")
    || path.includes("sso.thomsonreuters.com")
    || path.includes("login.microsoftonline.com");
}

function showThomLoading(message = "Cargando THOM…") {
  thomEmbedLoading?.classList.remove("hidden");
  const msg = thomEmbedLoading?.querySelector("p");
  if (msg) msg.textContent = message;
  clearTimeout(thomLoadTimer);
  thomLoadTimer = setTimeout(() => {
    if (!thomRendered) {
      setEmbedHint("thom", "THOM tarda más de lo normal. Verificá ZScaler.");
    }
  }, 20000);
}

function hideThomLoading() {
  thomEmbedLoading?.classList.add("hidden");
  clearTimeout(thomLoadTimer);
  thomLoadTimer = null;
}

function resetThomEmbedState() {
  thomRendered = false;
  thomBridgeAlive = false;
  thomBlankAttempts = 0;
  clearTimeout(thomBlankTimer);
  thomBlankTimer = null;
}

function scheduleThomBlankCheck(delayMs = 12000) {
  clearTimeout(thomBlankTimer);
  thomBlankTimer = setTimeout(() => {
    if (thomRendered) return;
    if (isThomWindowMode()) {
      hideThomLoading();
      showThomPanelPlaceholder();
      return;
    }
    thomBlankAttempts += 1;
    try {
      const loc = thomFrame?.contentWindow?.location?.href ?? "";
      if (isThomAuthPath(loc)) {
        showThomLoading("Iniciando sesión corporativa…");
        setEmbedHint("thom", "Iniciando sesión corporativa… Completá el login si aparece el formulario.");
        scheduleThomBlankCheck(15000);
        return;
      }
      const root = thomFrame?.contentDocument?.getElementById("root");
      const hasContent = !!(root && root.children.length > 0);
      if (hasContent) {
        thomRendered = true;
        hideThomLoading();
        clearEmbedHint("thom");
        return;
      }
      if (thomBridgeAlive || thomBlankAttempts < 4) {
        showThomLoading(thomBridgeAlive ? "Autenticando en THOM…" : "Cargando THOM…");
        setEmbedHint("thom", "THOM está iniciando. Si pedís login corporativo, completalo en el panel.");
        scheduleThomBlankCheck(15000);
        return;
      }
      showThomLoading("THOM no cargó en el panel");
      setEmbedHint("thom", "No se pudo mostrar THOM acá. Verificá ZScaler o usá «Abrir en otra pestaña del navegador».");
    } catch {
      showThomLoading("Iniciando sesión corporativa…");
      setEmbedHint("thom", "Autenticando con SSO corporativo…");
      scheduleThomBlankCheck(15000);
    }
  }, delayMs);
}

function onThomEmbedMessage(event) {
  if (event.source !== thomFrame?.contentWindow) return;
  const data = event.data;
  if (!data || data.type !== "st2-thom-state") return;
  if (isThomWindowMode()) return;

  thomBridgeAlive = true;

  if (data.hasContent) {
    thomRendered = true;
    hideThomLoading();
    clearEmbedHint("thom");
    clearTimeout(thomBlankTimer);
    scheduleThomHelpCollapse(thomFrame?.contentWindow);
    return;
  }

  if (isThomAuthPath(data.path ?? "")) {
    showThomLoading("Iniciando sesión corporativa…");
    setEmbedHint("thom", "Iniciando sesión corporativa… Completá el login si aparece el formulario.");
    scheduleThomBlankCheck(15000);
    return;
  }

  if (!thomRendered) {
    showThomLoading("Autenticando en THOM…");
    scheduleThomBlankCheck(15000);
  }
}

function loadEmbedFrame(kind, { force = false } = {}) {
  const frame = kind === "thom" ? thomFrame : kind === "portal" ? portalFrame : aiFrame;
  if (kind === "thom" && isThomWindowMode()) return;
  const url = getEmbedFrameUrl(kind);
  if (!frame || !url) return;
  if (!force && !needsEmbedReload(frame, url)) return;
  applyEmbedZoom(kind);
  clearEmbedHint(kind);
  if (kind === "thom") {
    resetThomEmbedState();
    hideThomDirectGate();
    showThomLoading();
    if (!isThomWindowMode()) scheduleThomBlankCheck();
  }
  frame.src = url;
}

function clearEmbedHint(kind) {
  const id = kind === "thom" ? "thomEmbedHint" : kind === "portal" ? "portalEmbedHint" : "aiEmbedHint";
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("hidden");
  el.setAttribute("aria-hidden", "true");
  el.textContent = "";
}

function setEmbedHint(kind, message) {
  const id = kind === "thom" ? "thomEmbedHint" : kind === "portal" ? "portalEmbedHint" : "aiEmbedHint";
  const el = document.getElementById(id);
  if (!el) return;
  // Hints de embed ocultos: el toolbar ya tiene «Abrir en navegador».
  el.classList.add("hidden");
  el.setAttribute("aria-hidden", "true");
  el.textContent = "";
}

function goHome() {
  hideAbout({ history: "none" });
  // Sin reclaim: window.open("", "st2Thom…") enfocaba otra pestaña del navegador.
  closeThomPopup({ reclaim: false });
  switchTab("planillas");
  // Siempre replace al menú: no depender del historial entre pestañas ST2 / módulos.
  goPlanillasHome({ history: "replace" });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function normalizeShellPath(pathname) {
  const raw = String(pathname || "/").split("?")[0].split("#")[0];
  if (!raw || raw === "/") return "/";
  return raw.replace(/\/+$/, "") || "/";
}

function tabFromPath(pathname) {
  const p = normalizeShellPath(pathname);
  if (p === ADMIN_PATH || p === "/tolei") return ADMIN_TAB_ID;
  if (p === "/ai") return "ai";
  if (p === "/portal" || p.startsWith("/portal/")) return "portal";
  if (p === "/thom" || p.startsWith("/thom/")) return "thom";
  return "planillas";
}

function thomPortalFromPath(pathname) {
  const p = normalizeShellPath(pathname);
  if (p.startsWith("/thom/")) {
    const slug = p.slice("/thom/".length).split("/")[0];
    if (THOM_PORTALS[slug]) return slug;
  }
  return thomPortalId;
}

function portalIdFromPath(pathname) {
  const p = normalizeShellPath(pathname);
  if (p.startsWith("/portal/")) {
    return p.slice("/portal/".length).split("/")[0] || null;
  }
  return null;
}

function pathForTab(tabId) {
  if (tabId === ADMIN_TAB_ID) return ADMIN_PATH;
  if (tabId === "thom") return `/thom/${thomPortalId || "bejerman"}`;
  if (tabId === "ai") return "/ai";
  if (tabId === "portal") {
    return activePortalId ? `/portal/${activePortalId}` : "/portal";
  }
  return "/";
}

function titleForTab(tabId) {
  if (tabId === ADMIN_TAB_ID) return "ST² · ADMIN";
  if (tabId === "thom") return "ST² · THOM";
  if (tabId === "ai") return "ST² · AI Platform";
  if (tabId === "portal") return `ST² · ${getPortalClientTabLabel()}`;
  if (tabId === "planillas") return "ST² · Suite Web";
  return "ST² · Suite Web";
}

let shellRouteSyncing = false;

function syncTabHistory(tabId, mode = "push") {
  if (shellRouteSyncing || mode === "none") return;
  const path = pathForTab(tabId);
  const current = normalizeShellPath(window.location.pathname);
  const state = { tab: tabId, thomPortal: thomPortalId, portalId: activePortalId };
  if (mode === "replace" || current === path) {
    window.history.replaceState(state, "", path);
  } else {
    window.history.pushState(state, "", path);
  }
}

function navigateTab(tabId, { history = "push" } = {}) {
  if (!tabId) return;
  if (aboutRouteOpen || isHerramientasPath(window.location.pathname)) {
    hideAbout({ history: "restore" });
  }
  if (tabId === ADMIN_TAB_ID && !isSt2SuperAdmin()) {
    navigateTab("planillas", { history: "replace" });
    return;
  }
  if ((tabId === "thom" || tabId === "portal") && !hasAnyProfilePortalAccess()) {
    navigateTab("planillas", { history: "replace" });
    return;
  }
  const currentTab = document.querySelector(".tab-btn.active")?.dataset?.tab;
  if (tabId === "planillas") {
    switchTab("planillas");
    if (currentTab && currentTab !== "planillas") {
      // Al volver desde THOM/AI/Portal, reemplazar la URL actual por el menú
      // (si hacemos push, “Volver al menú” + historial podía reabrir esa pestaña).
      goPlanillasHome({ history: "replace" });
    }
    return;
  }

  switchTab(tabId);
  document.title = titleForTab(tabId);
  if (tabId === "thom") {
    const fromPath = thomPortalFromPath(window.location.pathname);
    if (fromPath && fromPath !== thomPortalId) setThomPortalId(fromPath);
  }
  if (tabId === "portal") {
    const fromPath = portalIdFromPath(window.location.pathname);
    if (fromPath && canSeeProfilePortal(fromPath) && fromPath !== activePortalId) {
      void switchPortal(fromPath, { history: "none" });
    }
  }
  syncTabHistory(tabId, history);
}

function applyTopTabEntry() {
  if (applyAboutFromPath()) return;

  const tab = tabFromPath(window.location.pathname);
  if (tab === "planillas") return;
  if ((tab === "thom" || tab === "portal") && !hasAnyProfilePortalAccess()) {
    navigateTab("planillas", { history: "replace" });
    return;
  }

  const thom = thomPortalFromPath(window.location.pathname);
  if (tab === "thom" && thom && canSeeProfilePortal(thom)) setThomPortalId(thom);
  const portal = portalIdFromPath(window.location.pathname);
  if (tab === "portal" && portal && canSeeProfilePortal(portal)) activePortalId = portal;

  navigateTab(tab, { history: "replace" });
}

function switchTab(tabId) {
  const prevTab = document.querySelector(".tab-btn.active")?.dataset?.tab;
  if (prevTab === ADMIN_TAB_ID && tabId !== ADMIN_TAB_ID) {
    leaveAdminTab();
  }

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const active = btn.dataset.tab === tabId;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `panel-${tabId}`);
    panel.classList.toggle("hidden", panel.id !== `panel-${tabId}`);
  });

  statusBar?.classList.add("hidden");
  portalSistemaBar?.classList.toggle("hidden", !profileContextBarVisible("portal", tabId));
  thomPortalBar?.classList.toggle("hidden", !profileContextBarVisible("thom", tabId));
  document.body.classList.toggle("portal-tab-active", tabId === "portal");
  document.body.classList.toggle("thom-tab-active", tabId === "thom");
  document.body.classList.toggle("admin-tab-active", tabId === ADMIN_TAB_ID);
  document.body.classList.toggle("embed-active", tabId === "thom" || tabId === "ai" || tabId === "portal");

  if (tabId !== "thom") {
    closeThomPopup({ reclaim: false });
  }

  stopEngagementTimer();
  if (tabId === "thom") {
    activateThomTab();
    startEngagementTimer("thom");
  } else if (tabId === "ai") {
    loadEmbedFrame("ai");
    startEngagementTimer("ai");
  } else if (tabId === "portal") {
    loadEmbedFrame("portal");
    startEngagementTimer("portal");
  } else if (tabId === ADMIN_TAB_ID) {
    void activateAdminTab();
    // Tras ver el panel, limpia el ⚠ (ya quedó el hint en pantalla).
    window.setTimeout(() => clearAdminClientAttention(), 14000);
  }

  refreshBadges();
  setTourContext({
    getActiveTab: () => tabId,
    getPortalTabLabel: () => getPortalClientTabLabel(),
  });
  syncHeaderTourButton();
}

function initEmbedReminders() {
  bindEmbedEngagement(thomFrame, "thom");
  bindEmbedEngagement(aiFrame, "ai");
  bindEmbedEngagement(portalFrame, "portal");
  window.addEventListener("message", onThomEmbedMessage);
  thomFrame?.addEventListener("load", () => {
    if (isEmbedFrameEmpty(thomFrame)) return;
    if (isThomWindowMode()) return;
    if (thomRendered) {
      hideThomLoading();
      return;
    }
    scheduleThomBlankCheck();
  });
  window.addEventListener("resize", scheduleThomPopupReposition);
  window.addEventListener("scroll", scheduleThomPopupReposition, { passive: true });
  // Sin esto quedan ventanas THOM huérfanas al cerrar o recargar ST2.
  window.addEventListener("pagehide", () => closeThomPopup({ reclaim: true }));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleThomPopupReposition();
  });
  initThomPortalSelector();
  initDailyTabReminders();
}

document.getElementById("thomGateOpenBtn")?.addEventListener("click", () => focusThomPopup());
document.getElementById("thomGateCloseBtn")?.addEventListener("click", () => closeThomPopup({ reclaim: true }));
document.getElementById("thomOpenBtn")?.addEventListener("click", openThomBrowserTab);
document.getElementById("thomProxyOpenBtn")?.addEventListener("click", openThomBrowserTab);

let aiEmbedMenuOpen = false;

function closeAiEmbedMenu() {
  aiEmbedMenuOpen = false;
  document.getElementById("aiEmbedMenu")?.classList.add("hidden");
  document.getElementById("aiEmbedMenuBtn")?.setAttribute("aria-expanded", "false");
}

function toggleAiEmbedMenu() {
  const menu = document.getElementById("aiEmbedMenu");
  const btn = document.getElementById("aiEmbedMenuBtn");
  if (!menu || !btn) return;
  aiEmbedMenuOpen = !aiEmbedMenuOpen;
  menu.classList.toggle("hidden", !aiEmbedMenuOpen);
  btn.setAttribute("aria-expanded", aiEmbedMenuOpen ? "true" : "false");
}

function reloadAiEmbed() {
  if (isEmbedFrameEmpty(aiFrame)) loadEmbedFrame("ai", { force: true });
  else aiFrame.contentWindow?.location.reload();
}

function openAiEmbedInBrowser() {
  if (appConfig?.aiPlatformUrl) window.open(appConfig.aiPlatformUrl, "_blank", "noopener");
}

document.getElementById("aiEmbedMenuBtn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleAiEmbedMenu();
});

document.querySelectorAll("[data-ai-embed-action]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const action = btn.getAttribute("data-ai-embed-action");
    closeAiEmbedMenu();
    if (action === "reload") reloadAiEmbed();
    else if (action === "open") openAiEmbedInBrowser();
  });
});

document.addEventListener("click", (e) => {
  if (!aiEmbedMenuOpen) return;
  if (e.target.closest("#panel-ai .plan-chile-embed-nav")) return;
  closeAiEmbedMenu();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && aiEmbedMenuOpen) closeAiEmbedMenu();
});

document.getElementById("portalReloadBtn")?.addEventListener("click", () => {
  if (isEmbedFrameEmpty(portalFrame)) loadEmbedFrame("portal", { force: true });
  else {
    try {
      portalFrame.contentWindow?.location.reload();
    } catch {
      loadEmbedFrame("portal", { force: true });
    }
  }
});
document.getElementById("portalOpenBtn")?.addEventListener("click", () => {
  const url = getPortalExternalUrl();
  if (url) window.open(url, "_blank", "noopener");
});

async function bootstrapApp() {
  applyAboutUpdated();
  paintToolDatesFromMeta();
  syncAboutToolsBadge();
  initAccessBirthdayPicker();
  await ensureAppAccess();
  if (isPrimarySuperAdmin()) startAccessAdminClientWatch();
  syncAdminTabVisibility();
  syncViewAsBanner();
  bindAboutToolsUi();
  await initPlanillas();
  setTourContext({
    getActiveTab: () => document.querySelector(".tab-btn.active")?.dataset?.tab || "planillas",
    getPortalTabLabel: () => getPortalClientTabLabel(),
  });
  syncHeaderTourButton();
  scheduleWelcomeTour();
  syncProfilePortalAccess();
  syncAdminTabVisibility();
  syncAboutToolsBadge();
  if (userCanSeeDesktopToolDownloads()) void refreshAboutTools({ silent: true });
  applyAboutUpdated();
  applyTopTabEntry();
  window.addEventListener("popstate", () => {
    if (applyAboutFromPath()) return;
    const tab = tabFromPath(window.location.pathname);
    shellRouteSyncing = true;
    try {
      if (tab === "planillas") {
        switchTab("planillas");
        return;
      }
      if ((tab === "thom" || tab === "portal") && !hasAnyProfilePortalAccess()) {
        switchTab("planillas");
        document.title = titleForTab("planillas");
        return;
      }
      const thom = thomPortalFromPath(window.location.pathname);
      if (tab === "thom" && thom && canSeeProfilePortal(thom)) setThomPortalId(thom);
      const portal = portalIdFromPath(window.location.pathname);
      if (tab === "portal" && portal && canSeeProfilePortal(portal)) void switchPortal(portal, { history: "none" });
      switchTab(tab);
      document.title = titleForTab(tab);
    } finally {
      shellRouteSyncing = false;
    }
  });
  // Escalonar el resto para no saturar Cloudflare en el primer segundo.
  setTimeout(() => {
    void bootstrapPortal();
  }, 900);
  setTimeout(() => {
    startSessionHeartbeat();
  }, 60000);
  initEmbedReminders();
  document.addEventListener("st2:view-as-changed", () => syncProfilePortalAccess());
  document.addEventListener("st2:modules-flags-refreshed", () => syncProfilePortalAccess());
}

void bootstrapApp();

const UPDATE_CHECK_MS = 45000;
let lastLiveBuild = "";
let updateCheckerStarted = false;
/** Banner forzado por permisos nuevos (no lo apaga el check de build). */
let reloadBannerForced = false;

function loadedAppBuild() {
  const meta = document.querySelector('meta[name="st2-build"]')?.content?.trim();
  if (meta) return meta;
  return String(appConfig?.webBuild || "").trim();
}

function normalizeBuild(value) {
  return String(value || "").trim().toLowerCase();
}

function buildsDiffer(loaded, live) {
  const a = normalizeBuild(loaded);
  const b = normalizeBuild(live);
  if (!a || !b) return false;
  if (a === b) return false;
  return a.slice(0, 7) !== b.slice(0, 7);
}

function setUpdateBannerVisible(show) {
  const banner = document.getElementById("st2-update-banner");
  if (!banner) return;
  banner.classList.toggle("hidden", !show);
  banner.toggleAttribute("hidden", !show);
  document.body.classList.toggle("st2-has-update", !!show);
}

/** Cartel único de “recargá” (versión web o permisos nuevos). */
function requestUnifiedReloadBanner() {
  reloadBannerForced = true;
  setUpdateBannerVisible(true);
}

document.addEventListener("st2:request-reload-banner", () => {
  requestUnifiedReloadBanner();
});

function applyLiveBuild(liveBuild) {
  const live = String(liveBuild || "").trim();
  if (!live) return;
  lastLiveBuild = live;
  if (!buildsDiffer(loadedAppBuild(), live)) {
    if (!reloadBannerForced) setUpdateBannerVisible(false);
    return;
  }
  setUpdateBannerVisible(true);
  notifyWebUpdateDesktop(live);
}

async function checkAppVersion() {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    applyLiveBuild(data.build || data.shortBuild || "");
  } catch {
    // ignore
  }
}

function startUpdateChecker() {
  if (updateCheckerStarted) return;
  updateCheckerStarted = true;
  document.getElementById("st2-update-reload")?.addEventListener("click", () => {
    window.location.reload();
  });
  const tick = () => {
    void checkAppVersion();
  };
  tick();
  setInterval(tick, UPDATE_CHECK_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tick();
  });
}

startUpdateChecker();

function startSessionHeartbeat() {
  const ping = () => {
    fetch("/api/planillas/session/heartbeat", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientHint: buildPlanClientHint(),
        deviceId: getOrCreateDeviceId(),
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.webBuild) applyLiveBuild(data.webBuild);
      })
      .catch(() => {});
  };
  ping();
  setInterval(ping, 180000);
}

async function bootstrapPortal() {
  await loadAppConfig();
}
