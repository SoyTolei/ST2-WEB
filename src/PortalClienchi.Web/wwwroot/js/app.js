import { initPlanillas, goPlanillasHome } from "./planillas.js";
import { ensureAppAccess } from "./plan-user.js";
import { isSt2SuperAdmin, startViewAsProfile, clearViewAsProfile, getViewAsProfile } from "./module-access.js";
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

const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const resultsList = document.getElementById("resultsList");
const resultsSummary = document.getElementById("resultsSummary");
const resultsEmpty = document.getElementById("resultsEmpty");
const resultsEmptyTitle = document.getElementById("resultsEmptyTitle");
const resultsEmptyHint = document.getElementById("resultsEmptyHint");
const statusText = document.getElementById("statusText");
const statusBar = document.getElementById("statusBar");
const yearFilterPanel = document.getElementById("yearFilterPanel");
const yearFilterButtons = document.getElementById("yearFilterButtons");
const previewFrame = document.getElementById("previewFrame");
const previewLoading = document.getElementById("previewLoading");
const previewActions = document.getElementById("previewActions");
const searchLoading = document.getElementById("searchLoading");
const previewTitle = document.getElementById("previewTitle");
const previewProduct = document.getElementById("previewProduct");
const previewTypeBadge = document.getElementById("previewTypeBadge");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const openPortalBtn = document.getElementById("openPortalBtn");
const openMediaBtn = document.getElementById("openMediaBtn");
const downloadContentBtn = document.getElementById("downloadContentBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const aboutBtn = document.getElementById("aboutBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const THEME_STORAGE_KEY = "st2-theme";

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

themeToggleBtn?.addEventListener("click", () => applyTheme(!isDarkTheme()));
syncThemeToggle();
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
const accessAdminSummary = document.getElementById("st2-access-admin-summary");
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
const accessModulesEmail = document.getElementById("st2-access-modules-email");
const accessModulesName = document.getElementById("st2-access-modules-name");
const accessModulesPreview = document.getElementById("st2-access-modules-preview");
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
const accessModSt2Admin = document.getElementById("st2-mod-st2-admin");
const accessModSt2AdminWrap = document.getElementById("st2-mod-st2-admin-wrap");
const viewAsBanner = document.getElementById("st2-view-as-banner");
const viewAsBannerText = document.getElementById("st2-view-as-banner-text");
const viewAsExitBtn = document.getElementById("st2-view-as-exit");
let accessModulesEmailValue = "";
let accessModulesSaving = false;
const accessAdminSearch = document.getElementById("st2-access-admin-search");
const accessAdminFilterButtons = Array.from(document.querySelectorAll(".st2-access-admin-filter"));
const accessAdminKpiTotal = document.getElementById("st2-access-admin-kpi-total");
const accessAdminKpiActive = document.getElementById("st2-access-admin-kpi-active");
const accessAdminKpiPending = document.getElementById("st2-access-admin-kpi-pending");
const accessAdminKpiToday = document.getElementById("st2-access-admin-kpi-today");
const accessAdminInbox = document.getElementById("st2-access-admin-inbox");
const thomFrame = document.getElementById("thomFrame");
const thomEmbedLoading = document.getElementById("thomEmbedLoading");
const thomDirectGate = document.getElementById("thomDirectGate");
const aiFrame = document.getElementById("aiFrame");

let searchTimer = null;
let searchAbort = null;
let detailAbort = null;
let organizeAbort = null;

let lastResults = [];
let yearFilterMode = "all";
let yearFilterValue = new Date().getFullYear();
let selectedResult = null;
let selectedDetail = null;
let selectedMedia = null;
let previewReady = false;
let appConfig = null;
let activePortalId = "bejerman";

const portalSistemaBar = document.getElementById("portalSistemaBar");
const thomPortalBar = document.getElementById("thomPortalBar");
const portalSistemaPills = document.getElementById("portalSistemaPills");

const placeholderHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><style>
html,body{margin:0;height:100%;background:transparent}
</style></head><body></body></html>`;

const previewLoadingHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><style>
body{font-family:Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;min-height:200px;margin:0;color:#6b7280;background:#fff}
</style></head><body><p>Cargando instructivo…</p></body></html>`;

previewFrame.srcdoc = placeholderHtml;
previewFrame.addEventListener("load", () => {
  if (previewFrame.src && previewFrame.src !== "about:blank") {
    previewReady = true;
    hidePreviewLoading();
  }
});

function showPreviewLoading(message = "Cargando instructivo…") {
  previewLoading?.classList.remove("hidden");
  const msg = previewLoading?.querySelector("p");
  if (msg) msg.textContent = message;
  setStatus(message);
}

function hidePreviewLoading() {
  previewLoading?.classList.add("hidden");
}

function showSearchLoading(message = "Buscando instructivos…") {
  searchLoading?.classList.remove("hidden");
  const msg = searchLoading?.querySelector("p");
  if (msg) msg.textContent = message;
  resultsList?.classList.add("is-searching");
  resultsEmpty?.classList.add("hidden");
  setResultsSummary("");
  setStatus(message);
}

function hideSearchLoading() {
  searchLoading?.classList.add("hidden");
  resultsList?.classList.remove("is-searching");
}

function setResultsSummary(text) {
  if (!resultsSummary) return;
  if (!text) {
    resultsSummary.textContent = "";
    resultsSummary.classList.add("hidden");
    return;
  }
  resultsSummary.textContent = text;
  resultsSummary.classList.remove("hidden");
}

function setResultsEmpty(title, hint = "", mode = "message") {
  if (resultsEmptyTitle) {
    resultsEmptyTitle.textContent = title || "";
    resultsEmptyTitle.classList.toggle("hidden", !title);
  }
  if (resultsEmptyHint) {
    resultsEmptyHint.textContent = hint;
    resultsEmptyHint.classList.toggle("hidden", !hint);
  }
  resultsEmpty?.setAttribute("data-mode", mode);
  resultsEmpty?.classList.remove("hidden");
  resultsList?.classList.add("hidden");
}

function hideResultsEmpty() {
  resultsEmpty?.classList.add("hidden");
  resultsList?.classList.remove("hidden");
}

function showIdleResultsState() {
  setResultsSummary("");
  setResultsEmpty(
    "",
    "Probá una sugerencia o escribí en el buscador.",
    "idle",
  );
}

function buildResultsSummary(visible) {
  const total = lastResults.length;
  const yearHint =
    yearFilterMode === "all" ? "" : yearFilterMode === "undated" ? " · sin fecha" : ` · año ${yearFilterValue}`;
  const multiTopics = groupCount(visible);

  if (total === 0) {
    return { status: "Sin resultados. Probá con otras palabras.", summary: "0 resultados" };
  }
  if (visible.length === 0) {
    return {
      status: `Ningún resultado para este filtro${yearHint}. Probá «Todos» u otro año.`,
      summary: `0 de ${total}${yearHint}`,
    };
  }
  if (multiTopics > 0) {
    return {
      status: `${visible.length} de ${total}${yearHint} · ${multiTopics} tema(s) con varias versiones`,
      summary: `${visible.length} de ${total}${yearHint} · ${multiTopics} tema(s) con varias versiones`,
    };
  }
  return {
    status: `${visible.length} de ${total}${yearHint} encontrados.`,
    summary: `${visible.length} de ${total}${yearHint} encontrados`,
  };
}

function updateResultsPresentation(visible, displayItems) {
  const query = searchInput.value.trim();
  const { status, summary } = buildResultsSummary(visible);
  setStatus(status);
  setResultsSummary(summary);

  const hasItems = (displayItems ?? []).some((item) => item.result);

  if (query.length < 2) {
    showIdleResultsState();
    return;
  }

  if (lastResults.length === 0) {
    setResultsEmpty("Sin resultados. Probá con otras palabras.", "Revisá la ortografía o cambiá el filtro de tipo.");
    return;
  }

  if (visible.length === 0 || !hasItems) {
    const yearHint =
      yearFilterMode === "all" ? "" : yearFilterMode === "undated" ? " sin fecha" : ` del año ${yearFilterValue}`;
    setResultsEmpty(
      `Ningún resultado${yearHint} con este filtro.`,
      "Probá «Todos» u otro año en los botones de arriba.",
    );
    return;
  }

  hideResultsEmpty();
}

function setPreviewActionsVisible(visible) {
  previewActions?.classList.toggle("hidden", !visible);
}

function setPreviewIdle(idle) {
  document.getElementById("previewFrameWrap")?.setAttribute("data-idle", idle ? "true" : "false");
}

function resetPreviewToPlaceholder() {
  detailAbort?.abort();
  hidePreviewLoading();
  previewTitle.textContent = "Seleccioná un resultado";
  previewProduct.textContent = "";
  previewTypeBadge.classList.add("hidden");
  previewFrame.removeAttribute("src");
  previewFrame.srcdoc = placeholderHtml;
  setPreviewActionsVisible(false);
  setPreviewIdle(true);
}

async function apiGet(url, signal) {
  const response = await fetch(url, { signal });
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
  statusText.textContent = message;
}

function buildPortalParams(extra = {}) {
  const params = new URLSearchParams({ portal: activePortalId });
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null && value !== "")
      params.set(key, value);
  }
  return params;
}

function initPortalPicker() {
  const portals = appConfig?.portals ?? [];
  if (!portals.length || !portalSistemaPills) return;

  const fromPath = portalIdFromPath(window.location.pathname);
  activePortalId = (fromPath && portals.some((p) => p.id === fromPath))
    ? fromPath
    : (appConfig?.defaultPortalId ?? portals[0]?.id ?? "bejerman");
  portalSistemaPills.innerHTML = portals
    .map(
      (p) =>
        `<button type="button" class="portal-sistema-pill${p.id === activePortalId ? " active" : ""}" data-portal-id="${escapeHtml(p.id)}" role="tab" aria-selected="${p.id === activePortalId ? "true" : "false"}">${escapeHtml(p.label)}</button>`,
    )
    .join("");

  for (const btn of portalSistemaPills.querySelectorAll(".portal-sistema-pill")) {
    btn.addEventListener("click", () => switchPortal(btn.dataset.portalId));
  }
}

function resetPortalSearchUi() {
  lastResults = [];
  selectedResult = null;
  selectedDetail = null;
  selectedMedia = null;
  yearFilterMode = "all";
  searchAbort?.abort();
  detailAbort?.abort();
  organizeAbort?.abort();
  yearFilterPanel.classList.add("hidden");
  yearFilterButtons.innerHTML = "";
  resultsList.innerHTML = "";
  hideSearchLoading();
  resetPreviewToPlaceholder();
  showIdleResultsState();
}

async function switchPortal(portalId, { history = "push" } = {}) {
  if (!portalId || portalId === activePortalId) {
    if (history !== "none" && document.querySelector('.tab-btn.active[data-tab="portal"]')) {
      syncTabHistory("portal", history);
    }
    return;
  }
  activePortalId = portalId;

  for (const btn of portalSistemaPills?.querySelectorAll(".portal-sistema-pill") ?? []) {
    const active = btn.dataset.portalId === portalId;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  }

  searchInput.value = "";
  if (typeFilter.options.length) typeFilter.selectedIndex = 0;
  resetPortalSearchUi();
  if (history !== "none" && document.querySelector('.tab-btn.active[data-tab="portal"]')) {
    syncTabHistory("portal", history);
  }
  await checkHealth();
}

async function loadTypes() {
  const types = await apiGet("/api/types");
  typeFilter.innerHTML = types
    .map((t) => `<option value="${escapeHtml(t.key)}">${escapeHtml(t.label)}</option>`)
    .join("");
}

async function loadAppConfig() {
  appConfig = await apiGet("/api/app-config");
  initPortalPicker();
  applyEmbedZoom("thom");
  applyEmbedZoom("ai");
  updateThomDirectUi();
  applyAboutUpdated();
  const activeThom = document.querySelector('.tab-btn.active[data-tab="thom"]');
  if (activeThom) activateThomTab();
}

async function checkHealth() {
  try {
    const health = await apiGet(`/api/health?portal=${encodeURIComponent(activePortalId)}`);
    const portalLabel = health.label ?? activePortalId;
    if (!health.credentialsConfigured) {
      setStatus(`Faltan credenciales para ${portalLabel}. Configurá appsettings.local.json y reiniciá el servidor.`);
      return;
    }
    if (!health.connected) {
      setStatus(health.message || `No se pudo conectar a ${portalLabel}. Verificá usuario/contraseña.`);
      return;
    }
    setStatus(`Portal ${portalLabel}: escribí al menos 2 letras para buscar (ignora tildes).`);
  } catch (err) {
    setStatus(`Error de API: ${err.message}`);
  }
}

function scheduleSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 400);
}

async function runSearch() {
  const query = searchInput.value.trim();
  if (query.length < 2) {
    lastResults = [];
    selectedResult = null;
    selectedDetail = null;
    yearFilterPanel.classList.add("hidden");
    yearFilterButtons.innerHTML = "";
    resultsList.innerHTML = "";
    hideSearchLoading();
    resetPreviewToPlaceholder();
    showIdleResultsState();
    setStatus("Escribí al menos 2 letras para buscar.");
    return;
  }

  searchAbort?.abort();
  searchAbort = new AbortController();

  showSearchLoading("Buscando instructivos…");
  resultsList.innerHTML = "";

  try {
    const params = buildPortalParams({ q: query });
    if (typeFilter.value) params.set("type", typeFilter.value);

    const data = await apiGet(`/api/search?${params}`, searchAbort.signal);
    lastResults = data.results ?? [];
    yearFilterMode = "all";
    rebuildYearTabs(data.years ?? [], data.hasUndated);
    await applyYearFilterAndDisplay();

    if (selectedResult && !lastResults.some((r) => r.id === selectedResult.id)) {
      selectedResult = null;
      selectedDetail = null;
      resetPreviewToPlaceholder();
    }
  } catch (err) {
    if (err.name === "AbortError") return;
    setStatus(err.message || "Error al buscar.");
    setResultsSummary("");
    setResultsEmpty("No se pudo completar la búsqueda.", err.message || "Intentá de nuevo en unos segundos.");
    console.error(err);
  } finally {
    hideSearchLoading();
  }
}

function rebuildYearTabs(years, hasUndated) {
  yearFilterButtons.innerHTML = "";
  if (lastResults.length === 0) {
    yearFilterPanel.classList.add("hidden");
    return;
  }

  yearFilterPanel.classList.remove("hidden");
  addYearButton("Todos", "all", yearFilterMode === "all");
  for (const year of years) {
    const count = lastResults.filter((r) => r.sortYear === year).length;
    addYearButton(`${year} (${count})`, String(year), yearFilterMode === "specific" && yearFilterValue === year);
  }
  if (hasUndated) {
    const count = lastResults.filter((r) => r.sortYear === 0).length;
    addYearButton(`Sin fecha (${count})`, "undated", yearFilterMode === "undated");
  }
}

function addYearButton(label, tag, active) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `year-btn${active ? " active" : ""}`;
  btn.textContent = label;
  btn.dataset.tag = tag;
  btn.addEventListener("click", async () => {
    yearFilterMode = tag === "all" ? "all" : tag === "undated" ? "undated" : "specific";
    if (yearFilterMode === "specific") yearFilterValue = Number.parseInt(tag, 10);
    const years = [...new Set(lastResults.map((r) => r.sortYear).filter((y) => y > 1900 && y < 2100))].sort((a, b) => b - a);
    rebuildYearTabs(years, lastResults.some((r) => r.sortYear === 0));
    await applyYearFilterAndDisplay({ showLoading: true });
  });
  yearFilterButtons.appendChild(btn);
}

function filterByYear(results) {
  if (yearFilterMode === "all") return results;
  if (yearFilterMode === "undated") return results.filter((r) => r.sortYear === 0);
  return results.filter((r) => r.sortYear === yearFilterValue);
}

async function applyYearFilterAndDisplay({ showLoading = false } = {}) {
  const filtered = filterByYear(lastResults);

  organizeAbort?.abort();
  organizeAbort = new AbortController();

  if (showLoading) showSearchLoading("Actualizando resultados…");

  try {
    const data = await apiPost("/api/organize", filtered, organizeAbort.signal);
    const displayItems = data.displayItems ?? [];
    renderResults(displayItems);
    updateResultsPresentation(filtered, displayItems);
  } catch (err) {
    if (err.name === "AbortError") return;
    setStatus(err.message || "Error al organizar resultados.");
  } finally {
    if (showLoading) hideSearchLoading();
  }
}

function renderResults(items) {
  resultsList.innerHTML = items
    .map((item) => {
      if (item.isGroupHeader) {
        return `<li class="result-group-header">
          <strong>${escapeHtml(item.headerText)}</strong>
          <span>${escapeHtml(item.yearsHint ?? "")}</span>
          <small>Elegí la versión (la más nueva está primero):</small>
        </li>`;
      }

      const r = item.result;
      if (!r) return "";

      const selected = selectedResult?.id === r.id ? " selected" : "";
      const indented = r.isVersionOfGroup ? " indented" : "";
      const currentYear = r.isCurrentYear ? " current" : "";

      return `<li class="result-item${selected}${indented}" data-id="${r.id}" data-type="${escapeHtml(r.type)}">
        <div class="result-tags">
          <span class="tag-date${currentYear}">${escapeHtml(r.dateLabel)}</span>
          <span class="tag-type">${escapeHtml(r.typeLabel)}</span>
          ${r.productName ? `<span class="tag-product">${escapeHtml(r.productName)}</span>` : ""}
        </div>
        <div class="result-title">${escapeHtml(r.title)}</div>
        <div class="result-snippet">${escapeHtml(r.snippet)}</div>
      </li>`;
    })
    .join("");

  for (const el of resultsList.querySelectorAll(".result-item")) {
    el.addEventListener("click", () => selectResult(Number(el.dataset.id), el.dataset.type));
  }
}

function groupCount(results) {
  const groups = new Map();
  for (const r of results) {
    const key = r.groupKey || r.title;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return [...groups.values()].filter((c) => c > 1).length;
}

async function selectResult(id, type) {
  selectedResult = lastResults.find((r) => r.id === id) ?? { id, type };
  selectedDetail = null;
  selectedMedia = null;
  previewReady = false;

  for (const el of resultsList.querySelectorAll(".result-item")) {
    el.classList.toggle("selected", Number(el.dataset.id) === id);
  }

  const result = lastResults.find((r) => r.id === id);
  previewTitle.textContent = result?.title ?? "Cargando…";
  previewProduct.textContent = result?.productName ? `Producto: ${result.productName}` : "";
  previewTypeBadge.textContent = result?.typeLabel ?? "";
  previewTypeBadge.classList.toggle("hidden", !result?.typeLabel);

  setPreviewIdle(false);
  setPreviewActionsVisible(true);

  copyLinkBtn.disabled = !result?.portalUrl;
  openPortalBtn.disabled = !result?.portalUrl;
  exportPdfBtn.disabled = true;
  openMediaBtn.classList.add("hidden");
  downloadContentBtn.classList.add("hidden");
  openMediaBtn.disabled = true;
  downloadContentBtn.disabled = true;

  previewFrame.removeAttribute("src");
  previewFrame.srcdoc = previewLoadingHtml;
  showPreviewLoading("Cargando detalle…");

  detailAbort?.abort();
  detailAbort = new AbortController();

  try {
    const params = buildPortalParams({ type: type ?? result?.type ?? "faq" });
    const data = await apiGet(`/api/knowledge/${id}?${params}`, detailAbort.signal);
    selectedDetail = data.item;
    selectedMedia = data.media;
    previewReady = false;
    previewFrame.removeAttribute("srcdoc");
    showPreviewLoading("Cargando vista previa…");
    previewFrame.src = data.previewUrl ?? `/api/knowledge/${id}/preview?${params}`;
    previewTitle.textContent = data.item.title;
    previewProduct.textContent = data.item.productName ? `Producto: ${data.item.productName}` : "";
    previewTypeBadge.textContent = data.typeLabel;
    previewTypeBadge.classList.remove("hidden");

    copyLinkBtn.disabled = !data.item.portalUrl;
    openPortalBtn.disabled = !data.item.portalUrl;
    exportPdfBtn.disabled = !data.canExportPdf;

    if (data.media?.url) {
      const isVideo = data.media.kind === "Video";
      openMediaBtn.classList.remove("hidden");
      openMediaBtn.disabled = false;
      openMediaBtn.textContent = isVideo ? "Abrir video" : "Abrir PDF";
      if (isVideo) {
        downloadContentBtn.classList.add("hidden");
        downloadContentBtn.disabled = true;
      } else {
        downloadContentBtn.classList.remove("hidden");
        downloadContentBtn.disabled = false;
        downloadContentBtn.textContent = "Descargar archivo";
      }
    }
  } catch (err) {
    if (err.name === "AbortError") return;
    hidePreviewLoading();
    previewFrame.removeAttribute("src");
    previewFrame.srcdoc = `<!DOCTYPE html><html><body><p>No se pudo cargar el detalle.<br>${escapeHtml(err.message)}</p></body></html>`;
    setStatus(err.message || "Error al cargar el instructivo.");
  }
}

copyLinkBtn.addEventListener("click", async () => {
  const url = selectedDetail?.portalUrl ?? selectedResult?.portalUrl;
  if (!url) return;
  await navigator.clipboard.writeText(url);
  setStatus("Link copiado al portapapeles.");
});

openPortalBtn.addEventListener("click", () => {
  const url = selectedDetail?.portalUrl ?? selectedResult?.portalUrl;
  if (url) window.open(url, "_blank", "noopener");
});

openMediaBtn.addEventListener("click", () => {
  const url = selectedMedia?.url ?? selectedDetail?.externalUrl;
  if (url) window.open(url, "_blank", "noopener");
});

downloadContentBtn.addEventListener("click", () => {
  const url = selectedMedia?.url;
  if (!url) return;
  const a = document.createElement("a");
  a.href = url;
  a.download = selectedMedia.suggestedFileName || "";
  a.target = "_blank";
  a.rel = "noopener";
  a.click();
  setStatus("Descarga iniciada.");
});

exportPdfBtn.addEventListener("click", async () => {
  const frameWindow = previewFrame.contentWindow;
  const frameDoc = previewFrame.contentDocument;
  if (!frameWindow || !frameDoc || !previewFrame.src) {
    setStatus("Esperá a que cargue la vista previa e intentá de nuevo.");
    return;
  }

  setStatus("Preparando PDF…");
  await waitForPreviewImages(frameDoc);

  try {
    frameWindow.focus();
    frameWindow.print();
    setStatus("Usá «Guardar como PDF» en el diálogo de impresión.");
  } catch {
    setStatus("No se pudo abrir el diálogo de impresión.");
  }
});

function waitForPreviewImages(doc) {
  const images = [...doc.images];
  if (images.length === 0) return Promise.resolve();

  return Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
}

function getAboutVersionLabel() {
  if (appConfig?.webVersionLabel) return appConfig.webVersionLabel;
  const meta = document.querySelector('meta[name="st2-version-label"]');
  if (meta?.content?.trim()) return meta.content.trim();
  return "Versión WEB";
}

function getAboutUpdatedLabel() {
  const fromConfig = appConfig?.webUpdatedLabel?.trim();
  if (fromConfig) return fromConfig;
  const meta = document.querySelector('meta[name="st2-updated-label"]');
  if (meta?.content?.trim()) return meta.content.trim();
  const current = aboutUpdatedEl?.textContent?.trim();
  return current || "Última actualización";
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
let accessAdminFilter = "all";
let accessAdminQuery = "";

function syncAdminTabVisibility() {
  const show = isSt2SuperAdmin();
  tabAdminBtn?.classList.toggle("hidden", !show);
  tabAdminBtn?.setAttribute("aria-hidden", show ? "false" : "true");
  if (!show && document.querySelector(`.tab-btn.active[data-tab="${ADMIN_TAB_ID}"]`)) {
    navigateTab("planillas", { history: "replace" });
  }
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

function normalizeAccessAdminItems(items) {
  return items.map((item) => {
    const email = item.email || item.Email || "";
    const status = String(item.status || item.Status || "approved").toLowerCase();
    const isPending = !!(item.isPending ?? item.IsPending) || status === "pending";
    const isRejected = !!(item.isRejected ?? item.IsRejected) || status === "rejected";
    const isNewToday = !!(item.isNewToday ?? item.IsNewToday);
    const displayNameOverride = (item.displayName ?? item.DisplayName ?? "").trim() || null;
    const modules = item.modules || item.Modules || {};
    return {
      email,
      displayNameOverride,
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
      modules: {
        oportunidad: !!(modules.oportunidad ?? modules.Oportunidad),
        pdfPortal: !!(modules.pdfPortal ?? modules.PdfPortal),
        blanqueo: !!(modules.blanqueo ?? modules.Blanqueo),
        blanqueoConfirm: !!(modules.blanqueoConfirm ?? modules.BlanqueoConfirm),
        blanqueoLoad: modules.blanqueoLoad == null && modules.BlanqueoLoad == null
          ? !!(modules.blanqueo ?? modules.Blanqueo) && !(modules.blanqueoConfirm ?? modules.BlanqueoConfirm)
          : !!(modules.blanqueoLoad ?? modules.BlanqueoLoad),
        borradoBases: !!(modules.borradoBases ?? modules.BorradoBases),
        borradoBasesConfirm: !!(modules.borradoBasesConfirm ?? modules.BorradoBasesConfirm),
        borradoBasesLoad: modules.borradoBasesLoad == null && modules.BorradoBasesLoad == null
          ? !!(modules.borradoBases ?? modules.BorradoBases) && !(modules.borradoBasesConfirm ?? modules.BorradoBasesConfirm)
          : !!(modules.borradoBasesLoad ?? modules.BorradoBasesLoad),
      },
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
  accessAdminFilter = "all";
  accessAdminQuery = "";
  if (accessAdminSearch) accessAdminSearch.value = "";
  accessAdminFilterButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.filter === "all");
  });
}

function setAccessAdminSummary(text) {
  if (!accessAdminSummary) return;
  if (!text) {
    accessAdminSummary.textContent = "";
    accessAdminSummary.classList.add("hidden");
    return;
  }
  accessAdminSummary.textContent = text;
  accessAdminSummary.classList.remove("hidden");
}

function updateAccessAdminSummaryLine() {
  const total = accessAdminItemsCache.filter((item) => !item.isRejected).length;
  const pending = accessAdminItemsCache.filter((item) => item.isPending).length;
  const today = accessAdminItemsCache.filter((item) => item.loggedInToday).length;
  const { activeCount } = accessAdminMeta;
  if (accessAdminKpiTotal) accessAdminKpiTotal.textContent = String(total);
  if (accessAdminKpiActive) accessAdminKpiActive.textContent = String(activeCount);
  if (accessAdminKpiPending) accessAdminKpiPending.textContent = String(pending);
  if (accessAdminKpiToday) accessAdminKpiToday.textContent = String(today);
  updateAdminTabBadge();
  renderAccessAdminInbox();
  if (!total) {
    setAccessAdminSummary("");
    return;
  }
  const bits = [
    `${total} registrado${total === 1 ? "" : "s"}`,
    `${activeCount} activo${activeCount === 1 ? "" : "s"}`,
    `${today} hoy`,
  ];
  if (pending) bits.push(`${pending} pendiente${pending === 1 ? "" : "s"}`);
  setAccessAdminSummary(bits.join(" · "));
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

function getFilteredAccessAdminItems() {
  const q = accessAdminQuery.trim().toLowerCase();
  return accessAdminItemsCache.filter((item) => {
    if (accessAdminFilter === "active" && !item.isActive) return false;
    if (accessAdminFilter === "pending" && !item.isPending) return false;
    if (accessAdminFilter === "today" && !item.loggedInToday) return false;
    if (q) {
      const email = item.email.toLowerCase();
      const name = formatAccessDisplayName(item.email, item.displayNameOverride).toLowerCase();
      if (!email.includes(q) && !name.includes(q)) return false;
    }
    return true;
  });
}

function renderAccessAdminTable() {
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
    accessAdminStatus.textContent = "Sin resultados para este filtro.";
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
    if (item.isActive) {
      badges.push('<span class="st2-access-admin-live" title="Activo ahora"><span class="st2-access-admin-live-dot" aria-hidden="true"></span></span>');
    }
    const badgeHtml = badges.length
      ? `<span class="st2-access-admin-email-badges">${badges.join("")}</span>`
      : "";
    const rowClass = [
      item.isPending ? "is-pending" : "",
      item.isActive ? "is-active" : "",
      item.isUnseenNew ? "is-new" : "",
    ].filter(Boolean).join(" ");
    const displayName = formatAccessDisplayName(item.email, item.displayNameOverride);
    const mods = item.modules || {};
    const modBadges = [];
    if (mods.oportunidad) {
      modBadges.push({ label: "OPOR", title: "Oportunidad de Venta" });
    }
    if (mods.pdfPortal) {
      modBadges.push({ label: "PDF", title: "Generador PDF-Portal" });
    }
    if (mods.blanqueoConfirm && mods.blanqueoLoad) {
      modBadges.push({ label: "BLANQUEOS✓+", title: "Blanqueo Claves: confirma y carga" });
    } else if (mods.blanqueoConfirm) {
      modBadges.push({ label: "BLANQUEOS✓", title: "Blanqueo Claves: solo confirma" });
    } else if (mods.blanqueoLoad || mods.blanqueo) {
      modBadges.push({ label: "BLANQUEOS", title: "Blanqueo Claves: puede cargar" });
    }
    if (mods.borradoBasesConfirm && mods.borradoBasesLoad) {
      modBadges.push({ label: "BASES✓+", title: "Borrado de bases: confirma y carga" });
    } else if (mods.borradoBasesConfirm) {
      modBadges.push({ label: "BASES✓", title: "Borrado de bases: solo confirma" });
    } else if (mods.borradoBasesLoad || mods.borradoBases) {
      modBadges.push({ label: "BASES", title: "Borrado de bases: puede cargar" });
    }
    if (item.isSt2Admin) {
      modBadges.push({ label: "ADMIN", title: "ADMIN WEB" });
    }
    const modHtml = modBadges.length
      ? `<span class="st2-access-admin-mod-badges">${modBadges.map((b) => `<span class="st2-access-admin-mod" title="${escapeHtml(b.title)}">${escapeHtml(b.label)}</span>`).join("")}</span>`
      : `<span class="st2-access-admin-mod-empty" title="Sin módulos extra">—</span>`;
    return `<tr class="${rowClass}" data-email="${escapeHtml(item.email)}">
      <td class="st2-access-admin-email-cell">
        <div class="st2-access-admin-email-row">
          <span class="st2-access-admin-email" title="${escapeHtml(item.email)}">${escapeHtml(displayName)}</span>
          ${badgeHtml}
        </div>
      </td>
      <td class="st2-access-admin-mods-cell">${modHtml}</td>
      <td class="st2-access-admin-date" title="${escapeHtml(formatAccessDate(item.lastSeenAt))}">${escapeHtml(formatAccessRelative(item.lastSeenAt))}</td>
      <td class="st2-access-admin-num" title="Días distintos que abrió ST2: ${escapeHtml(String(item.loginCount))}">${escapeHtml(String(item.loginCount))}</td>
      <td class="st2-access-admin-actions-cell">
        ${item.isPending
          ? `<button type="button" class="st2-access-admin-approve" data-approve-email="${escapeHtml(item.email)}" title="Aprobar acceso">Aprobar</button>
             <button type="button" class="st2-access-admin-reject" data-reject-email="${escapeHtml(item.email)}" title="Rechazar solicitud">Rechazar</button>`
          : `<button type="button" class="st2-access-admin-preview" data-preview-email="${escapeHtml(item.email)}" title="Ver como ve este perfil" aria-label="Vista previa del perfil de ${escapeHtml(displayName)}"><svg class="st2-access-admin-preview-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" fill="currentColor"/></svg></button>
        <button type="button" class="st2-access-admin-modules" data-modules-email="${escapeHtml(item.email)}" title="Módulos habilitados" aria-label="Módulos de ${escapeHtml(displayName)}">☰</button>
        <button type="button" class="st2-access-admin-edit${item.displayNameOverride ? " is-custom" : ""}" data-edit-email="${escapeHtml(item.email)}" title="${item.displayNameOverride ? "Nombre editado — clic para cambiar" : "Editar nombre"}" aria-label="Editar nombre de ${escapeHtml(displayName)}"><svg class="st2-access-admin-edit-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="M13.2 6.3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg></button>
        <button type="button" class="st2-access-admin-delete" data-delete-email="${escapeHtml(item.email)}" title="Eliminar acceso" aria-label="Eliminar ${escapeHtml(displayName)}">×</button>`}
      </td>
    </tr>`;
  }).join("");
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
    if (response.status === 401) {
      closeAccessNameEditModal();
      showAccessAdminLogin();
      if (accessAdminError) accessAdminError.textContent = "Sesión expirada. Volvé a ingresar.";
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
  if (action === "reject" && !confirm(`¿Rechazar el acceso de ${name}?\n${email}`)) return;
  try {
    const response = await fetch("/api/access/registrations/decision", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, action }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      showAccessAdminLogin();
      if (accessAdminError) accessAdminError.textContent = "Sesión expirada. Volvé a ingresar.";
      return;
    }
    if (!response.ok) {
      setAccessAdminUpdatedHint(data.error || "No se pudo actualizar la solicitud.");
      return;
    }
    await loadAccessAdminRegistrations({ silent: true, force: true });
    setAccessAdminUpdatedHint(action === "approve" ? `Aprobado: ${name}` : `Rechazado: ${name}`);
  } catch {
    setAccessAdminUpdatedHint("No se pudo contactar al servidor.");
  }
}

async function deleteAccessAdminEmail(email) {
  if (!email) return;
  const current = accessAdminItemsCache.find((item) => item.email === email);
  const name = formatAccessDisplayName(email, current?.displayNameOverride);
  if (!confirm(`¿Eliminar el acceso de ${name}?\n${email}`)) return;

  try {
    const response = await fetch(`/api/access/registrations?email=${encodeURIComponent(email)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      showAccessAdminLogin();
      if (accessAdminError) accessAdminError.textContent = "Sesión expirada. Volvé a ingresar.";
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
}

async function activateAdminTab() {
  if (!isSt2SuperAdmin()) {
    navigateTab("planillas", { history: "replace" });
    return;
  }

  showAccessAdminLogin();

  try {
    const response = await fetch("/api/access/admin/session", { credentials: "include" });
    if (response.status === 404) {
      if (accessAdminError) {
        accessAdminError.textContent = "Panel no configurado en el servidor (faltan ST2_ACCESS_ADMIN_USER y ST2_ACCESS_ADMIN_PASSWORD).";
      }
      accessAdminUser?.focus();
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (data.authenticated) {
      showAccessAdminPanel();
      void loadAccessAdminRegistrations();
      startAccessAdminPolling();
      return;
    }
  } catch {
    /* login manual */
  }

  accessAdminUser?.focus();
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
    if (response.status === 401) {
      showAccessAdminLogin();
      if (accessAdminError) accessAdminError.textContent = "Sesión expirada. Volvé a ingresar.";
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

    if (auto && !force && snapshot === accessAdminLastSnapshot) {
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

    updateAccessAdminSummaryLine();

    const nowLabel = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    const newPending = items.filter((item) => item.isPending && newRegistrationEmails.includes(item.email));
    if (newPending.length > 0) {
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

const TOOLS_SEEN_KEY = "st2-tools-seen-versions";
const aboutToolsBadge = document.getElementById("about-tools-badge");
const aboutToolsStatus = document.getElementById("st2-about-tools-status");
let cachedTools = [];
let toolsBound = false;

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

function syncAboutToolsBadge() {
  if (!aboutToolsBadge) return;
  const seen = readSeenToolVersions();
  const hasNew = (cachedTools || []).some((t) => t?.available && t.version && seen[t.id] !== t.version);
  aboutToolsBadge.classList.toggle("hidden", !hasNew);
  aboutToolsBadge.setAttribute("aria-hidden", hasNew ? "false" : "true");
  aboutToolsBadge.title = hasNew ? "Hay una versión nueva de herramientas" : "";
}

function markToolsSeen() {
  const next = { ...readSeenToolVersions() };
  for (const t of cachedTools || []) {
    if (t?.available && t.version) next[t.id] = t.version;
  }
  writeSeenToolVersions(next);
  syncAboutToolsBadge();
}

function renderAboutTools() {
  const canUpload = isSt2SuperAdmin();
  for (const id of ["sql", "bat"]) {
    const tool = (cachedTools || []).find((t) => t.id === id);
    const card = document.querySelector(`.st2-about-tool[data-tool="${id}"]`);
    const desc = card?.querySelector("[data-tool-desc]");
    const btn = card?.querySelector(`[data-tool-download="${id}"]`);
    const uploadWrap = card?.querySelector(`[data-tool-upload-wrap="${id}"]`);
    uploadWrap?.classList.toggle("hidden", !canUpload);

    if (!tool?.available) {
      if (desc) {
        desc.textContent = id === "sql" ? "Herramientas SQL" : "Automatizaciones / utilidades";
      }
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Pronto";
        btn.title = "Todavía no hay un paquete publicado";
      }
      continue;
    }

    if (desc) {
      desc.textContent = `v${tool.version}${tool.sizeBytes ? ` · ${formatToolSize(tool.sizeBytes)}` : ""}`;
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Descargar";
      btn.title = `Descargar ${tool.fileName || tool.name}`;
    }
  }
  syncAboutToolsBadge();
}

async function refreshAboutTools({ silent = false } = {}) {
  try {
    const data = await apiGet("/api/tools");
    cachedTools = Array.isArray(data?.tools) ? data.tools : [];
    renderAboutTools();
    if (!silent) setAboutToolsStatus("");
  } catch (err) {
    cachedTools = [];
    renderAboutTools();
    if (!silent) setAboutToolsStatus(err?.message || "No se pudieron cargar las herramientas.", true);
  }
}

async function downloadTool(toolId) {
  const btn = document.querySelector(`[data-tool-download="${toolId}"]`);
  if (!btn || btn.disabled) return;
  setAboutToolsStatus("Preparando descarga…");
  try {
    const res = await fetch(`/api/tools/${encodeURIComponent(toolId)}/download`, { credentials: "include" });
    if (!res.ok) {
      let msg = "No se pudo descargar.";
      try {
        const data = await res.json();
        if (data?.error) msg = data.error;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const cd = res.headers.get("content-disposition") || "";
    const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(cd);
    const name = match ? decodeURIComponent(match[1].replace(/"/g, "")) : `${toolId}.bin`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setAboutToolsStatus(`Descarga lista: ${name}`);
  } catch (err) {
    setAboutToolsStatus(err?.message || "No se pudo descargar.", true);
  }
}

async function uploadTool(toolId, file) {
  if (!file || !isSt2SuperAdmin()) return;
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

  const maxB64 = 25 * 1024 * 1024;
  const useB64 = file.size > 0 && file.size <= maxB64;
  showBusy(`Subiendo ${file.name}…`, 5);
  setAboutToolsStatus(
    useB64
      ? `Subiendo ${file.name} (${formatToolSize(file.size)}) vía JSON…`
      : `Subiendo ${file.name} (${formatToolSize(file.size)})…`
  );

  const version = new Date().toISOString().slice(0, 10).replace(/-/g, ".");

  try {
    let data;
    if (useB64) {
      showBusy(`Codificando ${file.name}…`, 15);
      const contentBase64 = await fileToBase64(file);
      showBusy(`Enviando ${file.name}…`, 40);
      data = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/tools/${encodeURIComponent(toolId)}/upload-b64`);
        xhr.withCredentials = true;
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.upload.onprogress = (ev) => {
          if (!ev.lengthComputable) return;
          const pct = 40 + Math.round((ev.loaded / ev.total) * 55);
          showBusy(`Enviando ${file.name}… ${Math.min(95, pct)}%`, pct);
        };
        xhr.onload = () => {
          let parsed = {};
          const raw = String(xhr.responseText || "");
          try { parsed = JSON.parse(raw || "{}"); } catch { /* ignore */ }
          if (xhr.status >= 200 && xhr.status < 300) resolve(parsed);
          else {
            const msg = parsed?.error || parsed?.detail || parsed?.title
              || (raw ? raw.slice(0, 400) : `Error HTTP ${xhr.status} (sin detalle)`);
            const err = new Error(msg);
            err.status = xhr.status;
            err.raw = raw;
            err.payload = parsed;
            reject(err);
          }
        };
        xhr.onerror = () => reject(new Error("No se pudo contactar al servidor (red / proxy)."));
        xhr.send(JSON.stringify({
          fileName: file.name || `st2-${toolId}.bin`,
          version,
          contentBase64,
        }));
      });
    } else {
      const body = new FormData();
      // Nombre neutro en multipart: algunos proxies bloquean .bat/.exe en el filename.
      const wireName = `st2-${toolId}.bin`;
      body.append("file", file, wireName);
      body.append("originalName", file.name || wireName);
      body.append("version", version);

      data = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/tools/${encodeURIComponent(toolId)}/upload`);
        xhr.withCredentials = true;
        xhr.upload.onprogress = (ev) => {
          if (!ev.lengthComputable) {
            showBusy(`Subiendo ${file.name}…`);
            return;
          }
          const pct = Math.round((ev.loaded / ev.total) * 100);
          showBusy(`Subiendo ${file.name}… ${pct}%`, pct);
          setAboutToolsStatus(`Subiendo ${file.name}… ${pct}%`);
        };
        xhr.onload = () => {
          let parsed = {};
          const raw = String(xhr.responseText || "");
          try { parsed = JSON.parse(raw || "{}"); } catch { /* ignore */ }
          if (xhr.status >= 200 && xhr.status < 300) resolve(parsed);
          else {
            const msg = parsed?.error || parsed?.detail || parsed?.title
              || (raw ? raw.slice(0, 400) : `Error HTTP ${xhr.status} (sin detalle)`);
            const err = new Error(msg);
            err.status = xhr.status;
            err.raw = raw;
            err.payload = parsed;
            reject(err);
          }
        };
        xhr.onerror = () => reject(new Error("No se pudo contactar al servidor (red / proxy)."));
        xhr.send(body);
      });
    }

    showBusy("Listo", 100);
    setAboutToolsStatus(`Publicado ${data.name || toolId} v${data.version || ""}`.trim());
    await refreshAboutTools({ silent: true });
    markToolsSeen();
  } catch (err) {
    let msg = err?.message || "No se pudo subir.";
    try {
      const dig = await apiGet("/api/tools");
      if (dig?.lastError) {
        msg = `${msg}\n\nDetalle servidor:\n${String(dig.lastError).slice(0, 500)}`;
      } else if (dig?.dataDir) {
        msg = `${msg}\n(dataDir: ${dig.dataDir})`;
      }
    } catch { /* ignore */ }
    setAboutToolsStatus(msg, true);
  } finally {
    hideBusy();
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const idx = dataUrl.indexOf(",");
      resolve(idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl);
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo en el navegador."));
    reader.readAsDataURL(file);
  });
}

function bindAboutToolsUi() {
  if (toolsBound) return;
  toolsBound = true;
  document.querySelectorAll("[data-tool-download]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-tool-download");
      if (id) void downloadTool(id);
    });
  });
  document.querySelectorAll("[data-tool-upload]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.getAttribute("data-tool-upload");
      const file = input.files?.[0];
      input.value = "";
      if (id && file) void uploadTool(id, file);
    });
  });
}

function showAbout({ history = "push" } = {}) {
  const webMeta = document.getElementById("st2-about-web-meta");
  if (webMeta) webMeta.textContent = getAboutVersionLabel();
  applyAboutUpdated();
  bindAboutToolsUi();
  void refreshAboutTools().then(() => {
    markToolsSeen();
    if (isSt2SuperAdmin()) void refreshToolsDiagHint();
  });
  aboutOverlay?.classList.remove("hidden");
  aboutOverlay?.setAttribute("aria-hidden", "false");
  aboutRouteOpen = true;
  document.title = "ST2 · Acerca de";
  if (history !== "none") {
    const current = normalizeShellPath(window.location.pathname);
    if (current !== "/about") pathBeforeAbout = current || "/";
    syncAboutHistory(history);
  }
  aboutCloseBtn?.focus();
}

function hideAbout({ history = "restore" } = {}) {
  aboutOverlay?.classList.add("hidden");
  aboutOverlay?.setAttribute("aria-hidden", "true");
  aboutRouteOpen = false;
  const onAboutPath = normalizeShellPath(window.location.pathname) === "/about";
  if (history !== "none" && onAboutPath) {
    const fallback = pathBeforeAbout && pathBeforeAbout !== "/about" ? pathBeforeAbout : "/";
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

function syncAboutHistory(mode = "push") {
  if (shellRouteSyncing || mode === "none") return;
  const current = normalizeShellPath(window.location.pathname);
  const state = {
    tab: document.querySelector(".tab-btn.active")?.dataset?.tab || "planillas",
    thomPortal: thomPortalId,
    portalId: activePortalId,
    about: true,
  };
  if (mode === "replace" || current === "/about") {
    window.history.replaceState(state, "", "/about");
  } else {
    window.history.pushState(state, "", "/about");
  }
}

function applyAboutFromPath() {
  if (normalizeShellPath(window.location.pathname) === "/about") {
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
      setAboutToolsStatus(data?.error || "Diagnóstico: no se pudo escribir en el volume.", true);
      return;
    }
    // Volume OK: no molestar si no hay error de subida pendiente
    if (data?.lastError) {
      setAboutToolsStatus(`Último error de subida:\n${String(data.lastError).slice(0, 400)}`, true);
    }
  } catch {
    // silencioso: el diag no debe tapar la UI si falla
  }
}

aboutBtn?.addEventListener("click", showAbout);
document.addEventListener("st2:session-changed", () => {
  syncAdminTabVisibility();
  syncViewAsBanner();
});
viewAsExitBtn?.addEventListener("click", () => {
  clearViewAsProfile();
  window.location.reload();
});
accessAdminCancel?.addEventListener("click", () => navigateTab("planillas"));
accessAdminRefresh?.addEventListener("click", () => {
  void loadAccessAdminRegistrations({ silent: true, force: true });
});
accessAdminSubmit?.addEventListener("click", () => { void submitAccessAdminLogin(); });
accessAdminPass?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void submitAccessAdminLogin();
});
accessAdminFilterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    accessAdminFilter = btn.dataset.filter || "all";
    accessAdminFilterButtons.forEach((b) => {
      b.classList.toggle("is-active", b === btn);
    });
    renderAccessAdminTable();
  });
});
accessAdminSearch?.addEventListener("input", () => {
  accessAdminQuery = accessAdminSearch.value || "";
  renderAccessAdminTable();
});
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
    startAccessProfilePreview(previewBtn.dataset.previewEmail || "");
    return;
  }
  const modulesBtn = target.closest("[data-modules-email]");
  if (modulesBtn instanceof HTMLElement) {
    openAccessModulesModal(modulesBtn.dataset.modulesEmail || "");
    return;
  }
  const editBtn = target.closest("[data-edit-email]");
  if (editBtn instanceof HTMLElement) {
    editAccessAdminDisplayName(editBtn.dataset.editEmail || "");
    return;
  }
  const deleteBtn = target.closest("[data-delete-email]");
  if (deleteBtn instanceof HTMLElement) {
    void deleteAccessAdminEmail(deleteBtn.dataset.deleteEmail || "");
  }
});

function closeAccessModulesModal() {
  accessModulesOverlay?.classList.add("hidden");
  accessModulesEmailValue = "";
  if (accessModulesError) accessModulesError.textContent = "";
}

const PRIMARY_ADMIN_EMAIL = "leonel.gallo@thomsonreuters.com";

function startAccessProfilePreview(email, modulesOverride = null) {
  if (!email) return;
  const current = accessAdminItemsCache.find((item) => item.email === email);
  if (!current || current.isPending) return;
  const displayName = formatAccessDisplayName(current.email, current.displayNameOverride);
  startViewAsProfile({
    email: current.email,
    displayName,
    modules: modulesOverride || current.modules || {},
  });
  window.location.hash = "#/planillas";
  window.location.reload();
}

function modulesFromAccessForm() {
  return {
    oportunidad: !!accessModOportunidad?.checked,
    pdfPortal: !!accessModPdf?.checked,
    blanqueo: !!accessModBlanqueo?.checked,
    blanqueoConfirm: !!accessModBlanqueoConfirm?.checked,
    blanqueoLoad: !!accessModBlanqueoLoad?.checked,
    borradoBases: !!accessModBorradoBases?.checked,
    borradoBasesConfirm: !!accessModBorradoBasesConfirm?.checked,
    borradoBasesLoad: !!accessModBorradoBasesLoad?.checked,
  };
}

function previewAccessModulesProfile() {
  if (!accessModulesEmailValue) return;
  startAccessProfilePreview(accessModulesEmailValue, modulesFromAccessForm());
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

function openAccessModulesModal(email) {
  if (!accessModulesOverlay || !email) return;
  const current = accessAdminItemsCache.find((item) => item.email === email);
  const mods = current?.modules || {};
  const isPrimary = String(email).trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
  accessModulesEmailValue = email;
  const displayName = formatAccessDisplayName(email, current?.displayNameOverride);
  if (accessModulesName) accessModulesName.textContent = displayName;
  if (accessModulesEmail) accessModulesEmail.textContent = email;
  if (accessModBlanqueoLoad) delete accessModBlanqueoLoad.dataset.userTouched;
  if (accessModBorradoBasesLoad) delete accessModBorradoBasesLoad.dataset.userTouched;
  if (accessModOportunidad) accessModOportunidad.checked = !!mods.oportunidad;
  if (accessModPdf) accessModPdf.checked = !!mods.pdfPortal;
  if (accessModBlanqueo) accessModBlanqueo.checked = !!mods.blanqueo;
  if (accessModBlanqueoConfirm) accessModBlanqueoConfirm.checked = !!mods.blanqueoConfirm;
  if (accessModBlanqueoLoad) {
    accessModBlanqueoLoad.checked = mods.blanqueoLoad == null
      ? !!mods.blanqueo && !mods.blanqueoConfirm
      : !!mods.blanqueoLoad;
  }
  if (accessModBorradoBases) accessModBorradoBases.checked = !!mods.borradoBases;
  if (accessModBorradoBasesConfirm) accessModBorradoBasesConfirm.checked = !!mods.borradoBasesConfirm;
  if (accessModBorradoBasesLoad) {
    accessModBorradoBasesLoad.checked = mods.borradoBasesLoad == null
      ? !!mods.borradoBases && !mods.borradoBasesConfirm
      : !!mods.borradoBasesLoad;
  }
  if (accessModSt2Admin) {
    accessModSt2Admin.checked = isPrimary || !!current?.isSt2Admin;
    accessModSt2Admin.disabled = isPrimary;
  }
  if (accessModSt2AdminWrap) {
    accessModSt2AdminWrap.classList.toggle("is-primary-locked", isPrimary);
  }
  if (accessModulesError) accessModulesError.textContent = "";
  accessModulesOverlay.classList.remove("hidden");
}

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
  if (!accessModulesEmailValue || accessModulesSaving) return;
  accessModulesSaving = true;
  if (accessModulesSave) accessModulesSave.disabled = true;
  if (accessModulesError) accessModulesError.textContent = "";
  try {
    const response = await fetch("/api/access/registrations/modules", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: accessModulesEmailValue,
        oportunidad: !!accessModOportunidad?.checked,
        pdfPortal: !!accessModPdf?.checked,
        blanqueo: !!accessModBlanqueo?.checked,
        blanqueoConfirm: !!accessModBlanqueoConfirm?.checked,
        blanqueoLoad: !!accessModBlanqueoLoad?.checked,
        borradoBases: !!accessModBorradoBases?.checked,
        borradoBasesConfirm: !!accessModBorradoBasesConfirm?.checked,
        borradoBasesLoad: !!accessModBorradoBasesLoad?.checked,
        st2Admin: !!accessModSt2Admin?.checked,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
    const mods = data.modules || {};
    accessAdminItemsCache = accessAdminItemsCache.map((item) =>
      item.email === accessModulesEmailValue
        ? {
            ...item,
            isSt2Admin: !!(data.isSt2Admin ?? accessModSt2Admin?.checked),
            modules: {
              oportunidad: !!mods.oportunidad,
              pdfPortal: !!mods.pdfPortal,
              blanqueo: !!mods.blanqueo,
              blanqueoConfirm: !!mods.blanqueoConfirm,
              blanqueoLoad: !!mods.blanqueoLoad,
              borradoBases: !!mods.borradoBases,
              borradoBasesConfirm: !!mods.borradoBasesConfirm,
              borradoBasesLoad: !!mods.borradoBasesLoad,
            },
          }
        : item
    );
    closeAccessModulesModal();
    renderAccessAdminTable();
  } catch (err) {
    if (accessModulesError) accessModulesError.textContent = err?.message || "No se pudo guardar.";
  } finally {
    accessModulesSaving = false;
    if (accessModulesSave) accessModulesSave.disabled = false;
  }
}

accessModulesClose?.addEventListener("click", closeAccessModulesModal);
accessModulesCancel?.addEventListener("click", closeAccessModulesModal);
accessModulesSave?.addEventListener("click", () => { void saveAccessModules(); });
accessModulesPreview?.addEventListener("click", () => {
  previewAccessModulesProfile();
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
    label: "SQL/ONVIO-SAAS",
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
    if (saved && THOM_PORTALS[saved]) return saved;
  } catch {
    // ignore
  }
  return "bejerman";
}

function setThomPortalId(id) {
  if (!THOM_PORTALS[id]) return;
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

function reclaimNamedWindow(name) {
  try {
    const win = window.open("", name);
    if (win && win !== window && !win.closed) return win;
  } catch {
    // ignore
  }
  return null;
}

function closeThomPopup() {
  // Cancela cualquier openThomWindow pendiente (doble rAF).
  thomOpenGeneration += 1;
  stopThomPopupWatch();

  safeCloseWindow(thomPopup);
  thomPopup = null;

  // Por si perdimos la referencia tras navegar a css-latam (cross-origin).
  safeCloseWindow(reclaimNamedWindow(THOM_POPUP_NAME));

  safeCloseWindow(thomBrowserTab);
  thomBrowserTab = null;
  safeCloseWindow(reclaimNamedWindow(THOM_TAB_NAME));

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
  const zoom = kind === "thom" ? appConfig?.thomZoomFactor : appConfig?.aiPlatformZoomFactor;
  if (typeof zoom === "number" && zoom > 0.25 && zoom < 2) return zoom;
  return 0.9;
}

function applyEmbedZoom(kind) {
  const frame = kind === "thom" ? thomFrame : aiFrame;
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
  const frame = kind === "thom" ? thomFrame : aiFrame;
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
  const el = document.getElementById(kind === "thom" ? "thomEmbedHint" : "aiEmbedHint");
  if (!el) return;
  el.classList.add("hidden");
  el.setAttribute("aria-hidden", "true");
  el.textContent = "";
}

function setEmbedHint(kind, message) {
  const el = document.getElementById(kind === "thom" ? "thomEmbedHint" : "aiEmbedHint");
  if (!el) return;
  // Hints de THOM / AI ocultos: el toolbar ya tiene «Abrir en navegador».
  el.classList.add("hidden");
  el.setAttribute("aria-hidden", "true");
  el.textContent = "";
}

function goHome() {
  hideAbout();
  closeThomPopup();
  switchTab("planillas");
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
  if (tabId === ADMIN_TAB_ID) return "ST2 · ADMIN";
  if (tabId === "thom") return "ST2 · THOM";
  if (tabId === "ai") return "ST2 · AI Platform";
  if (tabId === "portal") return "ST2 · Portal Cliente";
  return "ST2";
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
  if (aboutRouteOpen || normalizeShellPath(window.location.pathname) === "/about") {
    hideAbout({ history: "restore" });
  }
  if (tabId === ADMIN_TAB_ID && !isSt2SuperAdmin()) {
    navigateTab("planillas", { history: "replace" });
    return;
  }
  const currentTab = document.querySelector(".tab-btn.active")?.dataset?.tab;
  if (tabId === "planillas") {
    switchTab("planillas");
    if (currentTab && currentTab !== "planillas") {
      goPlanillasHome({ history });
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
    if (fromPath && fromPath !== activePortalId) {
      void switchPortal(fromPath, { history: "none" });
    }
  }
  syncTabHistory(tabId, history);
}

function applyTopTabEntry() {
  if (applyAboutFromPath()) return;

  const tab = tabFromPath(window.location.pathname);
  if (tab === "planillas") return;

  const thom = thomPortalFromPath(window.location.pathname);
  if (tab === "thom" && thom) setThomPortalId(thom);
  const portal = portalIdFromPath(window.location.pathname);
  if (tab === "portal" && portal) activePortalId = portal;

  window.history.replaceState({ tab: "planillas" }, "", "/");
  navigateTab(tab, { history: "push" });
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

  statusBar.classList.toggle("hidden", tabId !== "portal");
  portalSistemaBar?.classList.toggle("hidden", tabId !== "portal");
  thomPortalBar?.classList.toggle("hidden", tabId !== "thom");
  document.body.classList.toggle("portal-tab-active", tabId === "portal");
  document.body.classList.toggle("thom-tab-active", tabId === "thom");
  document.body.classList.toggle("admin-tab-active", tabId === ADMIN_TAB_ID);
  document.body.classList.toggle("embed-active", tabId === "thom" || tabId === "ai");

  if (tabId !== "thom") {
    closeThomPopup();
  }

  stopEngagementTimer();
  if (tabId === "thom") {
    activateThomTab();
    startEngagementTimer("thom");
  } else if (tabId === "ai") {
    loadEmbedFrame("ai");
    startEngagementTimer("ai");
  } else if (tabId === ADMIN_TAB_ID) {
    void activateAdminTab();
  }

  refreshBadges();
}

function initEmbedReminders() {
  bindEmbedEngagement(thomFrame, "thom");
  bindEmbedEngagement(aiFrame, "ai");
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
  window.addEventListener("pagehide", () => closeThomPopup());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleThomPopupReposition();
  });
  initThomPortalSelector();
  initDailyTabReminders();
}

document.getElementById("thomGateOpenBtn")?.addEventListener("click", () => focusThomPopup());
document.getElementById("thomGateCloseBtn")?.addEventListener("click", () => closeThomPopup());
document.getElementById("thomOpenBtn")?.addEventListener("click", openThomBrowserTab);
document.getElementById("thomProxyOpenBtn")?.addEventListener("click", openThomBrowserTab);
document.getElementById("aiReloadBtn").addEventListener("click", () => {
  if (isEmbedFrameEmpty(aiFrame)) loadEmbedFrame("ai", { force: true });
  else aiFrame.contentWindow?.location.reload();
});
document.getElementById("aiOpenBtn").addEventListener("click", () => {
  if (appConfig?.aiPlatformUrl) window.open(appConfig.aiPlatformUrl, "_blank", "noopener");
});

searchInput.addEventListener("input", scheduleSearch);
typeFilter.addEventListener("change", runSearch);

document.querySelectorAll("[data-portal-suggest]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const q = btn.getAttribute("data-portal-suggest") || "";
    if (!searchInput || !q) return;
    searchInput.value = q;
    searchInput.focus();
    scheduleSearch();
  });
});

// Estado vacío inicial con sugerencias visibles.
resultsEmpty?.setAttribute("data-mode", "idle");
setPreviewIdle(true);

async function bootstrapApp() {
  applyAboutUpdated();
  await ensureAppAccess();
  syncAdminTabVisibility();
  syncViewAsBanner();
  bindAboutToolsUi();
  void refreshAboutTools({ silent: true });
  await initPlanillas();
  syncAdminTabVisibility();
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
      const thom = thomPortalFromPath(window.location.pathname);
      if (tab === "thom" && thom) setThomPortalId(thom);
      const portal = portalIdFromPath(window.location.pathname);
      if (tab === "portal" && portal) void switchPortal(portal, { history: "none" });
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
}

void bootstrapApp();

const UPDATE_CHECK_MS = 45000;
let lastLiveBuild = "";
let updateCheckerStarted = false;

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

function applyLiveBuild(liveBuild) {
  const live = String(liveBuild || "").trim();
  if (!live) return;
  lastLiveBuild = live;
  if (!buildsDiffer(loadedAppBuild(), live)) {
    setUpdateBannerVisible(false);
    return;
  }
  setUpdateBannerVisible(true);
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
    fetch("/api/planillas/session/heartbeat", { method: "POST", credentials: "include" })
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
  showIdleResultsState();
  await Promise.allSettled([loadAppConfig(), loadTypes(), checkHealth()]);
}
