import { getPlanUserEmail } from "./plan-user.js";
import { canSeePdfPortalModule as canSeeFromAccess } from "./module-access.js";

/**
 * Override de prueba: localStorage.setItem("st2-pdf-portal-force", "1")
 * o localStorage.setItem("st2-modules-force-all", "1")
 */
const FORCE_KEY = "st2-pdf-portal-force";
const DEFAULT_EDITOR_COLOR = "#0f172a";
const DEFAULT_PREVIEW_COLOR = "#f2f2f2";

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

  if (!editor || pdfPortalInited) {
    syncPdfPortalModuleVisibility();
    return;
  }
  pdfPortalInited = true;

  syncPdfPortalModuleVisibility();

  const refreshPreview = () => {
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

  clearBtn?.addEventListener("click", () => {
    if (brandInput) brandInput.value = "";
    editor.innerHTML = "";
    setStatus("");
    refreshPreview();
    editor.focus();
  });

  generateBtn?.addEventListener("click", () => {
    void generatePdf();
  });

  refreshPreview();

  async function generatePdf() {
    setStatus("Generando PDF…");
    generateBtn.disabled = true;
    try {
      fixInvisibleEditorColors(editor);
      const payload = {
        brand: (brandInput?.value || "").trim(),
        html: normalizeEditorHtmlForPdf(editor),
        text: editor.innerText || "",
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
      const fileName = match
        ? decodeURIComponent(match[1].replace(/"/g, "").trim())
        : `portal-${Date.now()}.pdf`;

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

/** Normaliza el HTML del editor a párrafos/br simples para el PDF. */
function normalizeEditorHtmlForPdf(root) {
  const clone = root.cloneNode(true);
  // Chrome suele usar DIV por línea → P para el parser.
  clone.querySelectorAll("div").forEach((div) => {
    if (div.closest("ul,ol,li,table")) return;
    const p = document.createElement("p");
    const align = div.style.textAlign || div.getAttribute("align") || "";
    if (align) p.style.textAlign = align;
    while (div.firstChild) p.appendChild(div.firstChild);
    if (!p.textContent?.trim() && !p.querySelector("img,br")) {
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

    const styleKeep = [];
    const style = el.getAttribute("style") || "";
    const align = /text-align\s*:\s*(left|center|right|justify)/i.exec(style);
    if (align) styleKeep.push(`text-align:${align[1].toLowerCase()}`);
    const color = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(style);
    if (color) {
      const c = editorSafeColor(color[1].trim()) || DEFAULT_EDITOR_COLOR;
      styleKeep.push(`color:${c}`);
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
      styleKeep.push(`text-align:${alignAttr.toLowerCase()}`);
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

      const styleKeep = [];
      const style = el.getAttribute("style") || "";
      const align = /text-align\s*:\s*(left|center|right|justify)/i.exec(style);
      if (align) styleKeep.push(`text-align:${align[1].toLowerCase()}`);

      const color = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(style);
      if (color) {
        const c = normalizeCssColor(color[1].trim()) || DEFAULT_EDITOR_COLOR;
        styleKeep.push(`color:${previewSafeColor(c)}`);
      } else {
        // Sin color explícito → claro para fondo oscuro de preview
        styleKeep.push(`color:${DEFAULT_PREVIEW_COLOR}`);
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
        styleKeep.push(`text-align:${alignAttr.toLowerCase()}`);
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

/** Editor (fondo blanco): colores muy claros → oscuro. */
function editorSafeColor(raw) {
  const n = normalizeCssColor(raw);
  if (!n) return DEFAULT_EDITOR_COLOR;
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.82 ? DEFAULT_EDITOR_COLOR : n;
}

/** Preview/PDF (fondo oscuro): colores muy oscuros → claro. */
function previewSafeColor(hex) {
  const n = normalizeCssColor(hex);
  if (!n) return DEFAULT_PREVIEW_COLOR;
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum < 0.18 ? DEFAULT_PREVIEW_COLOR : n;
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
