import { initPlanillas } from "./planillas.js";
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
const statusText = document.getElementById("statusText");
const statusBar = document.getElementById("statusBar");
const yearFilterPanel = document.getElementById("yearFilterPanel");
const yearFilterButtons = document.getElementById("yearFilterButtons");
const previewFrame = document.getElementById("previewFrame");
const previewLoading = document.getElementById("previewLoading");
const previewTitle = document.getElementById("previewTitle");
const previewProduct = document.getElementById("previewProduct");
const previewTypeBadge = document.getElementById("previewTypeBadge");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const openPortalBtn = document.getElementById("openPortalBtn");
const openMediaBtn = document.getElementById("openMediaBtn");
const downloadContentBtn = document.getElementById("downloadContentBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const aboutBtn = document.getElementById("aboutBtn");
const aboutOverlay = document.getElementById("st2-about-overlay");
const aboutCloseBtn = document.getElementById("st2-about-close");
const aboutTaglineEl = document.getElementById("st2-about-tagline");
const thomFrame = document.getElementById("thomFrame");
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

async function loadTypes() {
  const types = await apiGet("/api/types");
  typeFilter.innerHTML = types
    .map((t) => `<option value="${escapeHtml(t.key)}">${escapeHtml(t.label)}</option>`)
    .join("");
}

async function loadAppConfig() {
  appConfig = await apiGet("/api/app-config");
  applyEmbedZoom("thom");
  applyEmbedZoom("ai");
}

async function checkHealth() {
  try {
    const health = await apiGet("/api/health");
    if (!health.credentialsConfigured) {
      setStatus("Faltan credenciales. Copiá appsettings.local.json en la carpeta del proyecto y reiniciá el servidor.");
      return;
    }
    if (!health.connected) {
      setStatus(health.message || "No se pudo conectar al portal. Verificá usuario/contraseña y reiniciá el servidor.");
      return;
    }
    setStatus("Escribí al menos 2 letras para buscar (ignora tildes).");
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
    yearFilterPanel.classList.add("hidden");
    yearFilterButtons.innerHTML = "";
    resultsList.innerHTML = "";
    setStatus("Escribí al menos 2 letras para buscar.");
    return;
  }

  searchAbort?.abort();
  searchAbort = new AbortController();

  setStatus("Buscando…");
  resultsList.innerHTML = "";

  try {
    const params = new URLSearchParams({ q: query });
    if (typeFilter.value) params.set("type", typeFilter.value);

    const data = await apiGet(`/api/search?${params}`, searchAbort.signal);
    lastResults = data.results ?? [];
    yearFilterMode = "all";
    rebuildYearTabs(data.years ?? [], data.hasUndated);
    await applyYearFilterAndDisplay();
  } catch (err) {
    if (err.name === "AbortError") return;
    setStatus(err.message || "Error al buscar.");
    console.error(err);
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
    await applyYearFilterAndDisplay();
  });
  yearFilterButtons.appendChild(btn);
}

function filterByYear(results) {
  if (yearFilterMode === "all") return results;
  if (yearFilterMode === "undated") return results.filter((r) => r.sortYear === 0);
  return results.filter((r) => r.sortYear === yearFilterValue);
}

async function applyYearFilterAndDisplay() {
  const filtered = filterByYear(lastResults);

  organizeAbort?.abort();
  organizeAbort = new AbortController();

  try {
    const data = await apiPost("/api/organize", filtered, organizeAbort.signal);
    renderResults(data.displayItems ?? []);
    updateStatusText(filtered);
  } catch (err) {
    if (err.name === "AbortError") return;
    setStatus(err.message || "Error al organizar resultados.");
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

function updateStatusText(visible) {
  const total = lastResults.length;
  const yearHint =
    yearFilterMode === "all" ? "" : yearFilterMode === "undated" ? " · sin fecha" : ` · año ${yearFilterValue}`;
  const multiTopics = groupCount(visible);

  if (total === 0) {
    setStatus("Sin resultados. Probá con otras palabras.");
  } else if (visible.length === 0) {
    setStatus(`Ningún resultado para este filtro${yearHint}. Probá «Todos» u otro año.`);
  } else if (multiTopics > 0) {
    setStatus(`${visible.length} de ${total}${yearHint} · ${multiTopics} tema(s) con varias versiones`);
  } else {
    setStatus(`${visible.length} de ${total}${yearHint} encontrados.`);
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
    const params = new URLSearchParams({ type: type ?? result?.type ?? "faq" });
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

function showAbout() {
  const build = appConfig?.webBuild;
  if (aboutTaglineEl) {
    aboutTaglineEl.textContent = build
      ? `Versión web · ${build.slice(0, 7)}`
      : "Versión web";
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
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

function getEmbedFrameUrl(kind) {
  if (kind === "thom") {
    const tap = appConfig?.thomTapUrl ?? "https://css-latam.int.thomsonreuters.com/css-tap";
    try {
      const u = new URL(tap);
      return `/embed/thom${u.pathname}${u.search}`;
    } catch {
      return "/embed/thom/css-tap";
    }
  }
  if (kind === "ai") return appConfig?.aiPlatformUrl;
  return null;
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
  return 0.82;
}

function applyEmbedZoom(kind) {
  const frame = kind === "thom" ? thomFrame : aiFrame;
  if (!frame) return;
  frame.style.zoom = String(getEmbedZoom(kind));
}

function loadEmbedFrame(kind, { force = false } = {}) {
  const frame = kind === "thom" ? thomFrame : aiFrame;
  const url = getEmbedFrameUrl(kind);
  if (!frame || !url) return;
  if (!force && !needsEmbedReload(frame, url)) return;
  applyEmbedZoom(kind);
  frame.src = url;
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
  document.body.classList.toggle("embed-active", tabId === "thom" || tabId === "ai");

  stopEngagementTimer();
  if (tabId === "thom") {
    loadEmbedFrame("thom");
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
  initDailyTabReminders();
}

document.getElementById("thomReloadBtn").addEventListener("click", () => {
  if (isEmbedFrameEmpty(thomFrame)) loadEmbedFrame("thom", { force: true });
  else thomFrame.contentWindow?.location.reload();
});
document.getElementById("thomOpenBtn").addEventListener("click", () => {
  if (appConfig?.thomTapUrl) window.open(appConfig.thomTapUrl, "_blank", "noopener");
});
document.getElementById("aiReloadBtn").addEventListener("click", () => {
  if (isEmbedFrameEmpty(aiFrame)) loadEmbedFrame("ai", { force: true });
  else aiFrame.contentWindow?.location.reload();
});
document.getElementById("aiOpenBtn").addEventListener("click", () => {
  if (appConfig?.aiPlatformUrl) window.open(appConfig.aiPlatformUrl, "_blank", "noopener");
});

searchInput.addEventListener("input", scheduleSearch);
typeFilter.addEventListener("change", runSearch);

initEmbedReminders();
void initPlanillas();
void bootstrapPortal();

async function bootstrapPortal() {
  await Promise.allSettled([loadAppConfig(), loadTypes(), checkHealth()]);
}
