import { getPlanUserEmail } from "./plan-user.js";
import { canSeePdfPortalModule as canSeeFromAccess } from "./module-access.js";

/**
 * Override de prueba: localStorage.setItem("st2-pdf-portal-force", "1")
 * o localStorage.setItem("st2-modules-force-all", "1")
 */
const FORCE_KEY = "st2-pdf-portal-force";
const DEFAULT_EDITOR_COLOR = "#0f172a";
const DEFAULT_PREVIEW_COLOR = "#1e293b";

let userSheetThemeOverride = null; // null = sincroniza con tema de ST2; "dark" | "light"

export function isSheetDarkMode() {
  if (userSheetThemeOverride === "dark") return true;
  if (userSheetThemeOverride === "light") return false;
  return document.documentElement.classList.contains("st2-theme-dark");
}

export function syncSheetThemeUi() {
  const isDark = isSheetDarkMode();
  const preview = document.getElementById("pdf-portal-preview");
  const badgeText = document.getElementById("pdf-portal-sheet-badge-text");
  const toggleBtn = document.getElementById("pdf-portal-sheet-toggle");

  if (preview) {
    preview.classList.toggle("sheet-dark", isDark);
    preview.classList.toggle("sheet-light", !isDark);
  }
  if (badgeText) {
    badgeText.textContent = isDark
      ? "Cambiar fondo PDF a blanco ☀️ 🖨️"
      : "Cambiar fondo PDF a Oscuro 🌙";
  }
  if (toggleBtn) {
    toggleBtn.setAttribute("title", isDark
      ? "Vista previa y PDF en hoja oscura. Clic para cambiar fondo PDF a blanco para imprimir."
      : "Vista previa y PDF en hoja blanca. Clic para cambiar fondo PDF a oscuro.");
    toggleBtn.setAttribute("aria-label", isDark ? "Cambiar fondo PDF a blanco" : "Cambiar fondo PDF a Oscuro");
  }

  const previewLogo = document.getElementById("pdf-portal-preview-logo");
  if (previewLogo) {
    previewLogo.src = isDark
      ? "/img/portal-cliente-logo-dark.png?v=20260905i"
      : "/img/portal-cliente-logo.png?v=20260905i";
  }
}

let pdfPortalInited = false;

export function canSeePdfPortalModule(email = getPlanUserEmail()) {
  try {
    if (localStorage.getItem(FORCE_KEY) === "1") return true;
  } catch { /* ignore */ }

  if (!String(email || "").trim()) return false;
  return canSeeFromAccess();
}

function sistemaHidesCommercialModules() {
  const sistema = document.body.dataset.planSistema;
  return sistema === "Legal" || sistema === "Chile";
}

export function syncPdfPortalModuleVisibility() {
  const btn = document.getElementById("plan-modulo-pdf-portal");
  if (!btn) return;
  const allowed = canSeePdfPortalModule() && !sistemaHidesCommercialModules();
  btn.classList.toggle("hidden", !allowed);
  btn.setAttribute("aria-hidden", allowed ? "false" : "true");
}

let lastRecordedSelection = null;

export function bindPortalFrameContentWatcher(frame = document.getElementById("portalFrame")) {
  if (!frame) return;
  const attach = () => {
    try {
      const doc = frame.contentDocument || frame.contentWindow?.document;
      if (!doc) return;
      const onSelect = () => {
        try {
          const win = frame.contentWindow;
          const sel = win?.getSelection();
          if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
            const text = sel.toString().trim();
            if (text.length > 0) {
              const range = sel.getRangeAt(0);
              const div = document.createElement("div");
              div.appendChild(range.cloneContents());
              lastRecordedSelection = {
                title: findPortalDocTitle(doc),
                html: div.innerHTML,
                text: text,
                source: "selection",
                timestamp: Date.now(),
              };
            }
          }
        } catch { /* ignore */ }
      };
      doc.removeEventListener("selectionchange", onSelect);
      doc.removeEventListener("mouseup", onSelect);
      doc.removeEventListener("keyup", onSelect);
      doc.addEventListener("selectionchange", onSelect, { passive: true });
      doc.addEventListener("mouseup", onSelect, { passive: true });
      doc.addEventListener("keyup", onSelect, { passive: true });
    } catch { /* cross-origin or restricted */ }
  };

  frame.addEventListener("load", attach);
  attach();
}

function findPortalDocTitle(doc) {
  if (!doc) return "";
  const titleSelectors = [
    "h1",
    ".article-title",
    ".knowledge-title",
    ".faq-title",
    ".document-title",
    ".topic-title",
    ".title-header",
    ".page-header h1",
    ".page-header h2",
    "h2.title",
    ".card-title",
  ];
  for (const sel of titleSelectors) {
    const el = doc.querySelector(sel);
    if (el) {
      const text = (el.textContent || "").trim();
      if (text.length >= 3 && text.length < 160) {
        return text;
      }
    }
  }

  const rawTitle = (doc.title || "").trim();
  if (rawTitle) {
    const clean = rawTitle
      .replace(/^portal\s+del?\s+cliente\s*[-|–—:]\s*/i, "")
      .replace(/^thomson\s+reuters\s*[-|–—:]\s*/i, "")
      .replace(/\s*[-|–—:]\s*thomson\s+reuters.*$/i, "")
      .replace(/\s*[-|–—:]\s*portal.*$/i, "")
      .trim();
    if (clean.length >= 3 && clean.length < 160) return clean;
  }
  return "";
}

function cleanPortalNoiseElements(root) {
  if (!root) return;
  const removeSelectors = [
    "script",
    "style",
    "noscript",
    "svg",
    "nav",
    "header",
    "footer",
    "aside",
    "button",
    "input",
    "select",
    "textarea",
    "form",
    ".navbar",
    ".nav",
    ".menu",
    ".sidebar",
    ".header",
    ".footer",
    ".toolbar",
    ".breadcrumb",
    ".pagination",
    ".search-bar",
    ".search-form",
    ".actions-bar",
    ".btn",
    "[role='navigation']",
    "[role='search']",
  ];
  root.querySelectorAll(removeSelectors.join(",")).forEach((el) => {
    if (el !== root) el.remove();
  });
}

function extractArticleFromPortalDoc(doc) {
  if (!doc || !doc.body) return null;

  const title = findPortalDocTitle(doc);

  const contentSelectors = [
    "article",
    ".article-content",
    ".article-body",
    ".knowledge-content",
    ".knowledge-body",
    ".knowledge-detail",
    ".faq-content",
    ".faq-body",
    ".document-body",
    ".instruction-content",
    ".instruction-body",
    ".topic-content",
    ".guide-content",
    ".detail-content",
    ".content-detail",
    ".post-content",
    ".entry-content",
    "[role='main']",
    "main",
    "#main-content",
    ".main-content",
    ".content-view",
    ".view-content",
    ".modal-body",
    ".card-body",
  ];

  let targetEl = null;
  for (const sel of contentSelectors) {
    const found = doc.querySelector(sel);
    if (found && (found.innerText || found.textContent || "").trim().length > 30) {
      targetEl = found;
      break;
    }
  }

  const sourceNode = targetEl || doc.body;
  const clone = sourceNode.cloneNode(true);
  cleanPortalNoiseElements(clone);

  const rawText = (clone.innerText || clone.textContent || "").trim();
  if (!rawText || rawText.length < 15) {
    return title ? { title, html: "", text: "", source: "title-only" } : null;
  }

  return {
    title: title || "",
    html: clone.innerHTML,
    text: rawText,
    source: targetEl ? "article" : "page",
  };
}

export function extractContentFromPortalFrame(frame = document.getElementById("portalFrame")) {
  if (!frame) return null;

  let doc = null;
  let win = null;
  try {
    doc = frame.contentDocument || frame.contentWindow?.document;
    win = frame.contentWindow;
  } catch (e) {
    console.warn("No se pudo acceder al iframe de Portal:", e);
    return null;
  }

  // 1. Prioridad: ¿hay texto seleccionado activamente en el iframe?
  try {
    const sel = win?.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      const text = sel.toString().trim();
      if (text.length > 0) {
        const range = sel.getRangeAt(0);
        const div = document.createElement("div");
        div.appendChild(range.cloneContents());
        return {
          title: findPortalDocTitle(doc),
          html: div.innerHTML,
          text: text,
          source: "selection",
        };
      }
    }
  } catch { /* ignore */ }

  // 2. ¿Hubo una selección reciente en los últimos 4 segundos?
  if (lastRecordedSelection && Date.now() - lastRecordedSelection.timestamp < 4000) {
    return lastRecordedSelection;
  }

  // 3. Si no hay selección, extraer el instructivo o contenido principal que se está viendo
  if (doc) {
    return extractArticleFromPortalDoc(doc);
  }

  return null;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function extractDocumentTitle(cleanText, cleanHtml) {
  // A. Si hay texto plano copiado, la primera línea separada del cuerpo es el título
  if (cleanText) {
    const lines = cleanText
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    if (lines.length > 0) {
      const firstLine = lines[0];
      if (firstLine.length >= 3 && firstLine.length <= 160) {
        return firstLine;
      }
    }
  }

  // B. Si hay HTML, buscar el primer encabezado o bloque con texto
  if (cleanHtml) {
    try {
      const tmp = document.createElement("div");
      tmp.innerHTML = cleanHtml;
      const titleElem = tmp.querySelector("h1, h2, h3, .article-title, .title, .topic-title, .knowledge-title, .page-header");
      if (titleElem) {
        const text = (titleElem.textContent || "").trim().replace(/\s+/g, " ");
        if (text.length >= 3 && text.length <= 160) return text;
      }
      const firstBlock = tmp.querySelector("p, div, li, span");
      if (firstBlock) {
        const text = (firstBlock.textContent || "").trim().replace(/\s+/g, " ");
        if (text.length >= 3 && text.length <= 160) return text;
      }
    } catch { /* ignore */ }
  }

  return "";
}

export async function pasteFromClipboardToEditor({ silent = false } = {}) {
  const brand = document.getElementById("pdf-portal-brand");
  const editor = document.getElementById("pdf-portal-editor");
  const statusEl = document.getElementById("pdf-portal-status");
  if (!editor) return false;

  let text = "";
  let html = "";

  // 1. Intentar leer formato enriquecido HTML desde el portapapeles
  if (navigator.clipboard?.read) {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes("text/html")) {
          const blob = await item.getType("text/html");
          html = await blob.text();
        }
        if (!text && item.types.includes("text/plain")) {
          const blob = await item.getType("text/plain");
          text = await blob.text();
        }
      }
    } catch {
      // Fallback a readText
    }
  }

  // 2. Si no se obtuvo HTML o falló el item, intentar con readText
  if (!html && !text && navigator.clipboard?.readText) {
    try {
      text = await navigator.clipboard.readText();
    } catch (e) {
      if (!silent) {
        console.warn("No se pudo leer el portapapeles:", e);
      }
    }
  }

  const cleanText = (text || "").trim();
  const cleanHtml = (html || "").trim();

  if (!cleanText && !cleanHtml) {
    if (!silent && statusEl) {
      statusEl.textContent = "El portapapeles está vacío. Copiá el texto en el portal (Ctrl+C) y tocalo acá.";
      statusEl.className = "pdf-portal-status is-error";
    }
    return false;
  }

  // 3. Detección inteligente de título: siempre toma la primera línea copiada separada del cuerpo
  const candidateTitle = extractDocumentTitle(cleanText, cleanHtml);
  if (brand && candidateTitle) {
    brand.value = candidateTitle;
    brand.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // 4. Inyectar contenido en el editor
  if (cleanHtml) {
    editor.innerHTML = sanitizePasteHtml(cleanHtml);
  } else if (text) {
    const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const bodyText = candidateTitle && rawLines.length > 1 && rawLines[0] === candidateTitle
      ? rawLines.slice(1).join("\n\n")
      : text;
    const paras = bodyText.split(/\r?\n\r?\n/).filter((p) => p.trim());
    if (paras.length > 1) {
      editor.innerHTML = paras
        .map((p) => `<p>${escapeHtml(p).replace(/\r?\n/g, "<br/>")}</p>`)
        .join("");
    } else {
      editor.innerText = bodyText;
    }
  }

  fixInvisibleEditorColors(editor);
  editor.dispatchEvent(new Event("input", { bubbles: true }));

  if (statusEl) {
    statusEl.textContent = "✓ Contenido pegado con éxito desde el portapapeles.";
    statusEl.className = "pdf-portal-status is-success";
  }

  return true;
}

export async function openPdfPortalModal(initialData = null) {
  const modal = document.getElementById("pdf-portal-modal");
  if (!modal) return;
  initPdfPortalGenerator();
  userSheetThemeOverride = null; // Al abrir, arranca sincronizado con el modo actual del usuario
  syncSheetThemeUi();
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");

  const brand = document.getElementById("pdf-portal-brand");
  const editor = document.getElementById("pdf-portal-editor");
  const statusEl = document.getElementById("pdf-portal-status");

  let applied = false;

  if (initialData) {
    if (initialData.title && brand) {
      brand.value = initialData.title;
    }
    if (editor) {
      if (initialData.html && initialData.html.trim()) {
        editor.innerHTML = sanitizePasteHtml(initialData.html);
      } else if (initialData.text) {
        editor.innerText = initialData.text;
      }
      fixInvisibleEditorColors(editor);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (statusEl) {
      if (initialData.source === "selection") {
        statusEl.textContent = "Texto seleccionado en el portal copiado al generador.";
        statusEl.className = "pdf-portal-status is-success";
      } else if (initialData.source === "article" || initialData.source === "page") {
        statusEl.textContent = "Contenido extraído automáticamente del portal.";
        statusEl.className = "pdf-portal-status is-success";
      }
    }
  } else {
    // Si se abre de forma normal sin datos iniciales, limpiar estado para no mostrar residuos
    clearPdfPortalState();
  }

  setTimeout(() => {
    if (brand && !brand.value) {
      brand.focus();
    } else if (editor) {
      editor.focus();
    }
  }, 50);
}

export function clearPdfPortalState() {
  const brandInput = document.getElementById("pdf-portal-brand");
  const editor = document.getElementById("pdf-portal-editor");
  const previewBrand = document.getElementById("pdf-portal-preview-brand");
  const previewBody = document.getElementById("pdf-portal-preview-body");
  const statusEl = document.getElementById("pdf-portal-status");

  if (brandInput) brandInput.value = "";
  if (editor) editor.innerHTML = "";
  if (previewBrand) {
    previewBrand.textContent = "";
    previewBrand.classList.add("hidden");
  }
  if (previewBody) {
    previewBody.innerHTML = "";
  }
  if (statusEl) {
    statusEl.textContent = "";
    statusEl.className = "pdf-portal-status";
  }
  lastRecordedSelection = null;
}

export function closePdfPortalModal() {
  const modal = document.getElementById("pdf-portal-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  clearPdfPortalState();
  if (window.location.pathname === "/pdfportal" || window.location.pathname === "/pdf-portal") {
    try {
      window.history.replaceState({}, "", "/planillas");
    } catch { /* ignore */ }
  }
}

export function initPdfPortalGenerator() {
  // Visibilidad: usa cache de módulos; no fuerza otro GET en el arranque.
  syncPdfPortalModuleVisibility();
  const brandInput = document.getElementById("pdf-portal-brand");
  const editor = document.getElementById("pdf-portal-editor");
  const previewBrand = document.getElementById("pdf-portal-preview-brand");
  const previewBody = document.getElementById("pdf-portal-preview-body");
  const statusEl = document.getElementById("pdf-portal-status");
  const generateBtn = document.getElementById("pdf-portal-generate");
  const clearBtn = document.getElementById("pdf-portal-clear");
  const fontSizeSel = document.getElementById("pdf-portal-font-size");
  const fontColorInp = document.getElementById("pdf-portal-font-color");
  const linkBtn = document.getElementById("pdf-portal-link");
  const pasteActionBtn = document.getElementById("pdf-portal-paste-action");

  if (!editor || pdfPortalInited) {
    syncPdfPortalModuleVisibility();
    return;
  }
  pdfPortalInited = true;

  syncPdfPortalModuleVisibility();

  // En tema oscuro, inicializar color de texto con blanco/claro
  const isDark = document.documentElement.classList.contains("st2-theme-dark");
  if (fontColorInp && isDark && (fontColorInp.value === "#0f172a" || !fontColorInp.value)) {
    fontColorInp.value = "#f2f2f2";
  }

  const refreshPreview = () => {
    syncSheetThemeUi();
    fixInvisibleEditorColors(editor);
    const brand = (brandInput?.value || "").trim();
    if (previewBrand) {
      if (brand) {
        previewBrand.textContent = brand;
        previewBrand.classList.remove("hidden");
      } else {
        previewBrand.textContent = "";
        previewBrand.classList.add("hidden");
      }
    }
    if (previewBody) {
      previewBody.innerHTML = sanitizePreviewHtml(editor.innerHTML);
    }
  };

  const sheetToggleBtn = document.getElementById("pdf-portal-sheet-toggle");
  sheetToggleBtn?.addEventListener("click", () => {
    userSheetThemeOverride = isSheetDarkMode() ? "light" : "dark";
    syncSheetThemeUi();
    refreshPreview();
  });

  const mainThemeToggle = document.getElementById("themeToggleBtn");
  mainThemeToggle?.addEventListener("click", () => {
    if (userSheetThemeOverride === null) {
      setTimeout(() => {
        syncSheetThemeUi();
        refreshPreview();
      }, 50);
    }
  });

  brandInput?.addEventListener("input", refreshPreview);
  editor.addEventListener("input", refreshPreview);
  editor.addEventListener("paste", (e) => {
    handleRichPaste(e, editor);
    setTimeout(refreshPreview, 0);
  });

  document.querySelectorAll(".pdf-fmt-btn[data-cmd]").forEach((btn) => {
    btn.addEventListener("mousedown", (ev) => ev.preventDefault());
    btn.addEventListener("click", () => {
      const cmd = btn.getAttribute("data-cmd");
      if (!cmd) return;
      editor.focus();
      document.execCommand(cmd, false);
      refreshPreview();
    });
  });

  fontSizeSel?.addEventListener("change", () => {
    const v = fontSizeSel.value;
    if (!v) return;
    editor.focus();
    document.execCommand("fontSize", false, v);
    refreshPreview();
  });

  fontColorInp?.addEventListener("input", () => {
    editor.focus();
    const color = editorSafeColor(fontColorInp.value) || DEFAULT_EDITOR_COLOR;
    fontColorInp.value = color;
    document.execCommand("foreColor", false, color);
    refreshPreview();
  });

  linkBtn?.addEventListener("mousedown", (ev) => ev.preventDefault());
  linkBtn?.addEventListener("click", () => {
    editor.focus();
    const url = window.prompt("URL del hipervínculo (https://…)", "https://");
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!isSafeHref(trimmed)) {
      setStatus("URL no válida. Usá http(s):// o mailto:", true);
      return;
    }
    document.execCommand("createLink", false, trimmed);
    refreshPreview();
  });

  const onPasteClick = async () => {
    await pasteFromClipboardToEditor({ silent: false });
    editor.focus();
    refreshPreview();
  };

  pasteActionBtn?.addEventListener("click", onPasteClick);

  clearBtn?.addEventListener("click", () => {
    clearPdfPortalState();
    refreshPreview();
    editor.focus();
  });

  generateBtn?.addEventListener("click", () => {
    void generatePdf();
  });

  const modal = document.getElementById("pdf-portal-modal");
  const modalCloseBtn = document.getElementById("pdf-portal-modal-close");

  modalCloseBtn?.addEventListener("click", () => closePdfPortalModal());

  modal?.addEventListener("click", (e) => {
    if (e.target === modal) {
      closePdfPortalModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closePdfPortalModal();
    }
  });

  refreshPreview();

  async function generatePdf() {
    setStatus("Generando PDF…");
    generateBtn.disabled = true;
    try {
      fixInvisibleEditorColors(editor);
      const isDark = isSheetDarkMode();
      const payload = {
        brand: (brandInput?.value || "").trim(),
        html: normalizeEditorHtmlForPdf(editor),
        text: editor.innerText || "",
        darkMode: isDark,
      };
      const response = await fetch("/api/portal-pdf/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || data.error || data.title || `Error ${response.status}`);
      }

      const blob = await response.blob();
      const cd = response.headers.get("Content-Disposition") || "";
      const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(cd);
      const defaultName = payload.brand
        ? `Portal Cliente - ${payload.brand.replace(/[\\/:*?"<>|]/g, " ").trim()}.pdf`
        : "Portal Cliente.pdf";
      let fileName = defaultName;
      if (match && match[1]) {
        const raw = match[1].replace(/"/g, "").trim();
        try {
          fileName = decodeURIComponent(raw);
        } catch {
          fileName = raw;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (brandInput) brandInput.value = "";
      editor.innerHTML = "";
      refreshPreview();
      setStatus(`PDF listo: ${fileName}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "No se pudo generar el PDF.", true);
    } finally {
      generateBtn.disabled = false;
    }
  }

  function setStatus(text, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.classList.toggle("is-error", !!isError && !!text);
  }
}

function handleRichPaste(e, editor) {
  const html = e.clipboardData?.getData("text/html");
  const plain = e.clipboardData?.getData("text/plain");
  if (!html && !plain) return;

  e.preventDefault();
  if (html) {
    const cleaned = sanitizePasteHtml(html);
    document.execCommand("insertHTML", false, cleaned);
  } else {
    document.execCommand("insertText", false, plain);
  }
  fixInvisibleEditorColors(editor);
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

function isSafeImgSrc(src) {
  if (!src) return false;
  const s = src.trim();
  return s.startsWith("data:image/") || s.startsWith("/") || isSafeHref(s);
}

/** Normaliza el HTML del editor a párrafos/br simples para el PDF, respetando tablas e imágenes. */
function normalizeEditorHtmlForPdf(root) {
  const clone = root.cloneNode(true);
  clone.querySelectorAll("div").forEach((div) => {
    if (div.closest("ul,ol,li,table")) return;
    const p = document.createElement("p");
    const align = div.style.textAlign || div.getAttribute("align") || "";
    if (align) p.style.textAlign = align;
    while (div.firstChild) p.appendChild(div.firstChild);
    if (!p.textContent?.trim() && !p.querySelector("img,br,table")) {
      p.appendChild(document.createElement("br"));
    }
    div.replaceWith(p);
  });
  return clone.innerHTML || "";
}

/** Colores claros sobre fondo blanco del editor → se fuerzan a oscuro. */
function fixInvisibleEditorColors(root) {
  if (!root) return;
  const walk = (el) => {
    if (el.nodeType !== Node.ELEMENT_NODE) return;
    const node = /** @type {HTMLElement} */ (el);

    const styleColor = node.style?.color;
    if (styleColor) {
      const fixed = editorSafeColor(styleColor);
      if (fixed) node.style.color = fixed;
    }

    if (node.tagName === "FONT") {
      const attr = node.getAttribute("color");
      if (attr) {
        const fixed = editorSafeColor(attr);
        if (fixed) node.setAttribute("color", fixed);
      }
    }

    [...node.children].forEach(walk);
  };
  [...root.children].forEach(walk);
}

function sanitizePasteHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";

  const body = tmp.querySelector("body");
  const root = body || tmp;

  const walk = (node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = /** @type {HTMLElement} */ (node);
    const tag = el.tagName.toLowerCase();

    if (tag === "script" || tag === "style" || tag === "meta" || tag === "link" || tag === "xml" || tag === "o:p") {
      el.remove();
      return;
    }

    const allowed = new Set([
      "p", "div", "br", "span", "b", "strong", "i", "em", "u", "s", "strike", "del",
      "ul", "ol", "li", "a", "h1", "h2", "h3", "h4", "h5", "h6", "font", "blockquote",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "hr", "img",
    ]);

    if (!allowed.has(tag)) {
      const parent = el.parentNode;
      while (el.firstChild) parent?.insertBefore(el.firstChild, el);
      parent?.removeChild(el);
      return;
    }

    const keep = {};
    if (tag === "a") {
      const href = el.getAttribute("href");
      if (href && isSafeHref(href)) keep.href = href;
      keep.target = "_blank";
      keep.rel = "noopener noreferrer";
    }

    if (tag === "img") {
      const src = el.getAttribute("src");
      if (src && isSafeImgSrc(src)) {
        keep.src = src;
        const alt = el.getAttribute("alt");
        if (alt) keep.alt = alt;
      } else {
        el.remove();
        return;
      }
    }

    if (tag === "th" || tag === "td") {
      const cs = el.getAttribute("colspan");
      if (cs) keep.colspan = cs;
      const rs = el.getAttribute("rowspan");
      if (rs) keep.rowspan = rs;
    }

    const isHeading = /^h[1-6]$/.test(tag);
    const styleKeep = [];
    const style = el.getAttribute("style") || "";

    const align = /text-align\s*:\s*(left|center|right|justify)/i.exec(style);
    if (align) {
      const a = align[1].toLowerCase();
      // Títulos corporativos nunca van justificados para no estirar palabras
      styleKeep.push(`text-align:${isHeading && a === "justify" ? "left" : a}`);
    } else if (isHeading) {
      styleKeep.push("text-align:left");
    }

    const color = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(style);
    if (color) {
      const c = editorSafeColor(color[1].trim()) || DEFAULT_EDITOR_COLOR;
      styleKeep.push(`color:${c}`);
    } else if (tag === "h1" || tag === "h2") {
      styleKeep.push("color:#e05a10");
    }

    const size = /font-size\s*:\s*([^;]+)/i.exec(style);
    if (size) styleKeep.push(`font-size:${size[1].trim()}`);
    const weight = /font-weight\s*:\s*([^;]+)/i.exec(style);
    if (weight) styleKeep.push(`font-weight:${weight[1].trim()}`);
    const fstyle = /font-style\s*:\s*([^;]+)/i.exec(style);
    if (fstyle) styleKeep.push(`font-style:${fstyle[1].trim()}`);
    const deco = /text-decoration(?:-line)?\s*:\s*([^;]+)/i.exec(style);
    if (deco) styleKeep.push(`text-decoration:${deco[1].trim()}`);

    const alignAttr = el.getAttribute("align");
    if (alignAttr && /^(left|center|right|justify)$/i.test(alignAttr)) {
      const a = alignAttr.toLowerCase();
      styleKeep.push(`text-align:${isHeading && a === "justify" ? "left" : a}`);
    }

    if (tag === "font") {
      const fc = el.getAttribute("color");
      if (fc) {
        const c = editorSafeColor(fc) || DEFAULT_EDITOR_COLOR;
        keep.color = c;
      }
      const fs = el.getAttribute("size");
      if (fs) keep.size = fs;
    }

    [...el.attributes].forEach((attr) => el.removeAttribute(attr.name));
    Object.entries(keep).forEach(([k, v]) => el.setAttribute(k, v));
    if (styleKeep.length) el.setAttribute("style", styleKeep.join(";"));

    [...el.childNodes].forEach(walk);
  };

  [...root.childNodes].forEach(walk);
  return root.innerHTML;
}

function sanitizePreviewHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  const walk = (node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = /** @type {HTMLElement} */ (node);
      const tag = el.tagName.toLowerCase();
      const allowed = new Set([
        "p", "div", "br", "span", "b", "strong", "i", "em", "u", "s", "strike", "del",
        "ul", "ol", "li", "a", "h1", "h2", "h3", "h4", "h5", "h6", "font",
        "table", "thead", "tbody", "tfoot", "tr", "th", "td", "hr", "img",
      ]);
      if (!allowed.has(tag)) {
        const parent = el.parentNode;
        while (el.firstChild) parent?.insertBefore(el.firstChild, el);
        parent?.removeChild(el);
        return;
      }

      const keep = {};
      if (tag === "a") {
        const href = el.getAttribute("href");
        if (href && isSafeHref(href)) {
          keep.href = href;
          keep.target = "_blank";
          keep.rel = "noopener noreferrer";
        }
      }

      if (tag === "img") {
        const src = el.getAttribute("src");
        if (src && isSafeImgSrc(src)) {
          keep.src = src;
          const alt = el.getAttribute("alt");
          if (alt) keep.alt = alt;
        } else {
          el.remove();
          return;
        }
      }

      if (tag === "th" || tag === "td") {
        const cs = el.getAttribute("colspan");
        if (cs) keep.colspan = cs;
        const rs = el.getAttribute("rowspan");
        if (rs) keep.rowspan = rs;
      }

      const isHeading = /^h[1-6]$/.test(tag);
      const styleKeep = [];
      const style = el.getAttribute("style") || "";
      const align = /text-align\s*:\s*(left|center|right|justify)/i.exec(style);
      if (align) {
        const a = align[1].toLowerCase();
        styleKeep.push(`text-align:${isHeading && a === "justify" ? "left" : a}`);
      } else if (isHeading) {
        styleKeep.push("text-align:left");
      }

      const isDark = isSheetDarkMode();
      const defaultPreviewCol = isDark ? "#f2f2f2" : "#1e293b";
      const color = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(style);
      if (color) {
        const c = normalizeCssColor(color[1].trim()) || defaultPreviewCol;
        styleKeep.push(`color:${previewSafeColor(c)}`);
      } else if (tag === "h1" || tag === "h2") {
        styleKeep.push(`color:${isDark ? "#fb923c" : "#e05a10"}`);
      }

      const size = /font-size\s*:\s*([^;]+)/i.exec(style);
      if (size) styleKeep.push(`font-size:${size[1].trim()}`);
      const weight = /font-weight\s*:\s*([^;]+)/i.exec(style);
      if (weight) styleKeep.push(`font-weight:${weight[1].trim()}`);
      const fstyle = /font-style\s*:\s*([^;]+)/i.exec(style);
      if (fstyle) styleKeep.push(`font-style:${fstyle[1].trim()}`);
      const deco = /text-decoration(?:-line)?\s*:\s*([^;]+)/i.exec(style);
      if (deco) styleKeep.push(`text-decoration:${deco[1].trim()}`);

      if (tag === "font") {
        const fc = el.getAttribute("color");
        if (fc) {
          const c = normalizeCssColor(fc);
          if (c) styleKeep.push(`color:${previewSafeColor(c)}`);
        }
        const fs = el.getAttribute("size");
        if (fs) keep.size = fs;
      }

      const alignAttr = el.getAttribute("align");
      if (alignAttr && /^(left|center|right|justify)$/i.test(alignAttr)) {
        const a = alignAttr.toLowerCase();
        styleKeep.push(`text-align:${isHeading && a === "justify" ? "left" : a}`);
      }

      [...el.attributes].forEach((attr) => el.removeAttribute(attr.name));
      Object.entries(keep).forEach(([k, v]) => el.setAttribute(k, v));
      if (styleKeep.length) el.setAttribute("style", styleKeep.join(";"));
    }
    [...node.childNodes].forEach(walk);
  };
  [...tmp.childNodes].forEach(walk);
  return tmp.innerHTML;
}

/** Editor: garantiza contraste según el tema activo del editor (oscuro o claro). */
function editorSafeColor(raw) {
  const isDark = document.documentElement.classList.contains("st2-theme-dark");
  const n = normalizeCssColor(raw);
  const defaultCol = isDark ? "#f2f2f2" : DEFAULT_EDITOR_COLOR;
  if (!n) return defaultCol;
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  if (isDark) {
    // En tema oscuro: grises neutros y oscuros pasan a blanco puro claro
    if (sat < 0.35 || lum < 0.25) return defaultCol;
  } else {
    // En tema claro: colores casi blancos pasan a oscuro
    if (lum > 0.82) return defaultCol;
  }
  return n;
}

/** Preview/PDF: garantiza contraste bimodal según la hoja sea oscura o blanca. */
function previewSafeColor(hex) {
  const n = normalizeCssColor(hex);
  const isDark = isSheetDarkMode();
  const defaultCol = isDark ? "#f2f2f2" : "#1e293b";
  if (!n) return defaultCol;
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  if (isDark) {
    // En hoja oscura: los grises neutros (sat < 0.35) y tonos oscuros (lum < 0.25)
    // se transforman en blanco puro claro (#f2f2f2) igual que en el documento PDF final.
    // Los acentos de color vivos (naranjas, azules, verdes) se preservan intactos.
    if (sat < 0.35 || lum < 0.25) return defaultCol;
  } else {
    // En hoja blanca: colores muy claros (lum > 0.80) se normalizan a oscuro
    if (lum > 0.80) return defaultCol;
  }
  return n;
}

function normalizeCssColor(raw) {
  if (!raw) return null;
  const v = String(raw).trim();
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(v);
  if (rgb) {
    const r = +rgb[1];
    const g = +rgb[2];
    const b = +rgb[3];
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  }
  if (v.startsWith("#")) {
    let hex = v.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    if (hex.length >= 6 && /^[0-9a-f]+$/i.test(hex.slice(0, 6))) return `#${hex.slice(0, 6).toLowerCase()}`;
  }
  const named = {
    black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff",
    yellow: "#ffff00", orange: "#ffa500", purple: "#800080", gray: "#808080", grey: "#808080",
    navy: "#000080", teal: "#008080", maroon: "#800000", silver: "#c0c0c0", lime: "#00ff00",
    aqua: "#00ffff", cyan: "#00ffff", fuchsia: "#ff00ff", magenta: "#ff00ff",
  };
  return named[v.toLowerCase()] || null;
}

function isSafeHref(href) {
  const h = String(href || "").trim();
  if (!h) return false;
  if (h.startsWith("#") || h.startsWith("/") || h.startsWith("./")) return true;
  try {
    const u = new URL(h, window.location.origin);
    return ["http:", "https:", "mailto:"].includes(u.protocol);
  } catch {
    return false;
  }
}
