import { initPlanillas, goPlanillasHome } from "./planillas.js";
import { ensureAppAccess } from "./plan-user.js";
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
const homeBtn = document.getElementById("homeBtn");
const aboutOverlay = document.getElementById("st2-about-overlay");
const aboutCloseBtn = document.getElementById("st2-about-close");
const aboutTaglineEl = document.getElementById("st2-about-tagline");
const aboutUpdatedEl = document.getElementById("st2-about-updated");
const accessAdminOverlay = document.getElementById("st2-access-admin-overlay");
const accessAdminClose = document.getElementById("st2-access-admin-close");
const accessAdminLogin = document.getElementById("st2-access-admin-login");
const accessAdminPanel = document.getElementById("st2-access-admin-panel");
const accessAdminUser = document.getElementById("st2-access-admin-user");
const accessAdminPass = document.getElementById("st2-access-admin-pass");
const accessAdminError = document.getElementById("st2-access-admin-error");
const accessAdminSubmit = document.getElementById("st2-access-admin-submit");
const accessAdminStatus = document.getElementById("st2-access-admin-status");
const accessAdminBody = document.getElementById("st2-access-admin-body");
const accessAdminCount = document.getElementById("st2-access-admin-count");
const accessAdminTableWrap = document.getElementById("st2-access-admin-table-wrap");
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
const portalSistemaPills = document.getElementById("portalSistemaPills");

const placeholderHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><style>
body{font-family:Segoe UI,sans-serif;padding:24px;color:#6b7280;background:#fff;margin:0}
</style></head><body><p>Elegí un resultado de la lista para ver el instructivo acá.</p></body></html>`;

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

function setResultsEmpty(title, hint = "") {
  if (resultsEmptyTitle) resultsEmptyTitle.textContent = title;
  if (resultsEmptyHint) {
    resultsEmptyHint.textContent = hint;
    resultsEmptyHint.classList.toggle("hidden", !hint);
  }
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
    "Escribí al menos 2 letras para buscar instructivos.",
    "Podés filtrar por tipo de contenido y por año.",
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

function resetPreviewToPlaceholder() {
  detailAbort?.abort();
  hidePreviewLoading();
  previewTitle.textContent = "Seleccioná un resultado";
  previewProduct.textContent = "";
  previewTypeBadge.classList.add("hidden");
  previewFrame.removeAttribute("src");
  previewFrame.srcdoc = placeholderHtml;
  setPreviewActionsVisible(false);
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

  activePortalId = appConfig?.defaultPortalId ?? portals[0]?.id ?? "bejerman";
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

async function switchPortal(portalId) {
  if (!portalId || portalId === activePortalId) return;
  activePortalId = portalId;

  for (const btn of portalSistemaPills?.querySelectorAll(".portal-sistema-pill") ?? []) {
    const active = btn.dataset.portalId === portalId;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  }

  searchInput.value = "";
  if (typeFilter.options.length) typeFilter.selectedIndex = 0;
  resetPortalSearchUi();
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

const ADMIN_ENTRY_HASH = "#st2-reg";
const ADMIN_TAGLINE_CLICKS = 5;
const ADMIN_TAGLINE_WINDOW_MS = 2500;

let adminTaglineClicks = 0;
let adminTaglineTimer = null;
let accessAdminLoading = false;

function resetAdminTaglineClicks() {
  adminTaglineClicks = 0;
  if (adminTaglineTimer) {
    clearTimeout(adminTaglineTimer);
    adminTaglineTimer = null;
  }
}

function registerAdminTaglineClick() {
  adminTaglineClicks += 1;
  if (adminTaglineTimer) clearTimeout(adminTaglineTimer);
  adminTaglineTimer = setTimeout(resetAdminTaglineClicks, ADMIN_TAGLINE_WINDOW_MS);
  if (adminTaglineClicks >= ADMIN_TAGLINE_CLICKS) {
    resetAdminTaglineClicks();
    void openAccessAdminOverlay();
  }
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

async function openAccessAdminOverlay() {
  if (!accessAdminOverlay) return;
  accessAdminOverlay.classList.remove("hidden");
  accessAdminOverlay.setAttribute("aria-hidden", "false");
  showAccessAdminLogin();

  try {
    const response = await fetch("/api/access/admin/session", { credentials: "include" });
    if (response.status === 404) {
      hideAccessAdminOverlay();
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (data.authenticated) {
      showAccessAdminPanel();
      void loadAccessAdminRegistrations();
      return;
    }
  } catch {
    /* login manual */
  }

  accessAdminUser?.focus();
}

function hideAccessAdminOverlay() {
  accessAdminOverlay?.classList.add("hidden");
  accessAdminOverlay?.setAttribute("aria-hidden", "true");
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
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (accessAdminError) accessAdminError.textContent = data.error || "Acceso denegado.";
      return;
    }
    showAccessAdminPanel();
    await loadAccessAdminRegistrations();
  } catch {
    if (accessAdminError) accessAdminError.textContent = "No se pudo contactar al servidor.";
  } finally {
    accessAdminSubmit.disabled = false;
  }
}

async function loadAccessAdminRegistrations() {
  if (!accessAdminStatus || accessAdminLoading) return;
  accessAdminLoading = true;
  accessAdminStatus.textContent = "Cargando…";
  accessAdminTableWrap?.classList.add("hidden");

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

    const items = Array.isArray(data.items) ? data.items : [];
    if (accessAdminCount) accessAdminCount.textContent = String(items.length);

    if (!items.length) {
      accessAdminStatus.textContent = "Todavía no hay accesos registrados.";
      return;
    }

    accessAdminStatus.textContent = `${items.length} usuario${items.length === 1 ? "" : "s"} registrado${items.length === 1 ? "" : "s"}.`;
    if (accessAdminBody) {
      accessAdminBody.innerHTML = items.map((item) => {
        const email = item.email || item.Email || "";
        const lastSeen = item.lastSeenAt || item.LastSeenAt || "";
        const count = item.loginCount ?? item.LoginCount ?? 0;
        return `<tr>
          <td class="st2-access-admin-email" title="${escapeHtml(email)}">${escapeHtml(email)}</td>
          <td>${escapeHtml(formatAccessDate(lastSeen))}</td>
          <td class="st2-access-admin-num">${escapeHtml(String(count))}</td>
        </tr>`;
      }).join("");
    }

    accessAdminTableWrap?.classList.remove("hidden");
  } catch {
    accessAdminStatus.textContent = "No se pudo contactar al servidor.";
  } finally {
    accessAdminLoading = false;
  }
}

function showAbout() {
  if (aboutTaglineEl) {
    aboutTaglineEl.textContent = getAboutVersionLabel();
  }
  if (aboutUpdatedEl) {
    const updated = appConfig?.webUpdatedLabel?.trim();
    aboutUpdatedEl.textContent = updated || "";
    aboutUpdatedEl.classList.toggle("hidden", !updated);
  }
  aboutOverlay?.classList.remove("hidden");
  aboutOverlay?.setAttribute("aria-hidden", "false");
  aboutCloseBtn?.focus();
}

function hideAbout() {
  aboutOverlay?.classList.add("hidden");
  aboutOverlay?.setAttribute("aria-hidden", "true");
  aboutBtn?.focus();
}

aboutBtn?.addEventListener("click", showAbout);
aboutTaglineEl?.addEventListener("click", registerAdminTaglineClick);
accessAdminClose?.addEventListener("click", hideAccessAdminOverlay);
accessAdminSubmit?.addEventListener("click", () => { void submitAccessAdminLogin(); });
accessAdminPass?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void submitAccessAdminLogin();
});
accessAdminOverlay?.addEventListener("click", (e) => {
  if (e.target === accessAdminOverlay) hideAccessAdminOverlay();
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
  if (e.key === "Escape" && accessAdminOverlay && !accessAdminOverlay.classList.contains("hidden")) {
    hideAccessAdminOverlay();
  }
});
window.addEventListener("hashchange", () => {
  if (location.hash === ADMIN_ENTRY_HASH) void openAccessAdminOverlay();
});

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

function getEmbedFrameUrl(kind) {
  if (kind === "thom") {
    if (appConfig?.thomFrameUrl) return appConfig.thomFrameUrl;
    const tap = appConfig?.thomTapUrl ?? "https://css-latam.int.thomsonreuters.com/css-tap";
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
  return appConfig?.thomEmbedMode === "proxy";
}

/** @deprecated use isThomWindowMode */
function isThomDirectEmbed() {
  return isThomWindowMode();
}

function getThomTapUrl() {
  const external = appConfig?.thomTapUrl ?? "https://css-latam.int.thomsonreuters.com/css-tap";
  if (appConfig?.thomProxyReachable) {
    try {
      const u = new URL(external);
      return `${window.location.origin}${u.pathname}${u.search}`;
    } catch {
      return `${window.location.origin}/css-tap`;
    }
  }
  return external;
}

let thomPopup = null;
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

/** Offset definitivo del popup THOM respecto al borde de .tab-bar (calibrado en Edge). */
const THOM_POPUP_TOP_OFFSET = 75;

function getThomPanelRect(popupChrome = THOM_POPUP_CHROME_WITH_URL) {
  const tabBar = document.querySelector(".tab-bar");
  const tabRect = tabBar?.getBoundingClientRect();
  if (!tabRect) {
    return { top: 160, left: 0, width: 1100, height: 720 };
  }

  const viewportTop = Math.round(tabRect.bottom + THOM_POPUP_TOP_OFFSET);
  const viewportHeight = Math.max(420, Math.round(window.innerHeight - viewportTop + 4));
  const chromeTop = window.outerHeight - window.innerHeight;
  const chromeLeft = Math.max(0, (window.outerWidth - window.innerWidth) / 2);

  return {
    top: Math.round(window.screenY + chromeTop + viewportTop),
    left: Math.round(window.screenX + chromeLeft),
    width: Math.max(480, Math.round(window.innerWidth)),
    height: viewportHeight + popupChrome,
  };
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
  } catch {
    // El navegador puede bloquear moveTo/resizeTo en ventanas no propias.
  }
}

function scheduleThomPopupReposition() {
  clearTimeout(thomPopupResizeTimer);
  thomPopupResizeTimer = setTimeout(repositionThomPopup, 120);
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

function closeThomPopup() {
  if (!thomPopup || thomPopup.closed) {
    thomPopup = null;
    updateThomDirectUi();
    return;
  }
  try {
    thomPopup.close();
  } catch {
    // ignore
  }
  thomPopup = null;
  updateThomDirectUi();
}

function updateThomDirectUi() {
  const windowMode = isThomWindowMode();
  const embedded = isThomEmbeddedProxy();
  const openLabel = windowMode ? "Abrir en otra pestaña del navegador" : "Abrir en navegador";
  const openBtn = document.getElementById("thomOpenBtn");
  const proxyOpenBtn = document.getElementById("thomProxyOpenBtn");
  if (openBtn) openBtn.textContent = openLabel;
  if (proxyOpenBtn) proxyOpenBtn.textContent = openLabel;
  document.getElementById("thomProxyOpenWrap")?.classList.toggle("hidden", !embedded);
  thomFrame?.classList.toggle("hidden", windowMode);
  thomDirectGate?.classList.toggle("hidden", embedded || !windowMode);
  thomDirectGate?.classList.toggle("embed-panel-active", windowMode && !!(thomPopup && !thomPopup.closed));
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
  const popupName = "st2ThomPanel";

  if (!reload && thomPopup && !thomPopup.closed) {
    thomPopup.focus();
    alignThomPopupAfterOpen();
    updateThomDirectUi();
    setEmbedHint("thom", "THOM activo sobre el panel. Usá «Enfocar THOM» si quedó detrás.");
    return thomPopup;
  }

  if (thomPopup?.closed) thomPopup = null;

  const openPopup = () => {
    const rect = getThomPanelRect();
    const features = buildThomPopupFeatures(rect);

    thomPopup = window.open("about:blank", popupName, features);
    if (!thomPopup) {
      window.open(url, "_blank", "noopener");
      setEmbedHint("thom", "Permití ventanas emergentes para abrir THOM en este espacio.");
      return null;
    }

    watchThomPopupLoad(thomPopup);
    alignThomPopupAfterOpen();

    try {
      thomPopup.location.replace(url);
    } catch {
      thomPopup.location.href = url;
    }

    thomPopup.focus();
    showThomPanelPlaceholder();
    updateThomDirectUi();
    alignThomPopupAfterOpen({ afterNavigate: true });
    scheduleThomHelpCollapse(thomPopup);
    setEmbedHint("thom", "THOM abierto en este espacio. Necesitas tener ZScaler activado.");
    return thomPopup;
  };

  // Esperar un frame para que el layout de pestañas (embed-active) esté medido.
  requestAnimationFrame(() => requestAnimationFrame(openPopup));
  return thomPopup;
}

function openThomBrowserTab() {
  window.open(getThomTapUrl(), "_blank", "noopener");
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
  return 0.78;
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
  if (el) el.textContent = kind === "thom"
    ? (isThomEmbeddedProxy()
      ? "THOM embebido · ZScaler activado · el login SSO puede demorar unos segundos"
      : "Necesitas tener ZScaler activado.")
    : "Sesión corporativa · si no carga, «Abrir en navegador»";
}

function setEmbedHint(kind, message) {
  const el = document.getElementById(kind === "thom" ? "thomEmbedHint" : "aiEmbedHint");
  if (el) el.textContent = message;
}

function goHome() {
  hideAbout();
  closeThomPopup();
  goPlanillasHome();
  switchTab("planillas");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function switchTab(tabId) {
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
  document.body.classList.toggle("portal-tab-active", tabId === "portal");
  document.body.classList.toggle("embed-active", tabId === "thom" || tabId === "ai");

  if (tabId !== "thom" && isThomWindowMode()) {
    closeThomPopup();
  }

  stopEngagementTimer();
  if (tabId === "thom") {
    activateThomTab();
    startEngagementTimer("thom");
  } else if (tabId === "ai") {
    loadEmbedFrame("ai");
    startEngagementTimer("ai");
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
  initDailyTabReminders();
}

document.getElementById("thomGateOpenBtn")?.addEventListener("click", openThomWindow);
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

async function bootstrapApp() {
  await ensureAppAccess();
  if (location.hash === ADMIN_ENTRY_HASH) {
    void openAccessAdminOverlay();
  }
  initEmbedReminders();
  void initPlanillas();
  void bootstrapPortal();
}

void bootstrapApp();

async function bootstrapPortal() {
  showIdleResultsState();
  await Promise.allSettled([loadAppConfig(), loadTypes(), checkHealth()]);
}
