import { getPlanUserEmail } from "./plan-user.js";

/**
 * Quién ve la opción en Sistema de Planillas.
 * Lista vacía = oculto para todos.
 * Override de prueba: localStorage.setItem("st2-pdf-portal-force", "1")
 */
const PDF_PORTAL_ALLOWED_EMAILS = [
  "franco.zanna@thomsonreuters.com",
  "leonel.gallo@thomsonreuters.com",
];

const FORCE_KEY = "st2-pdf-portal-force";
const DEFAULT_PREVIEW_COLOR = "#f2f2f2";

let pdfPortalInited = false;

export function canSeePdfPortalModule(email = getPlanUserEmail()) {
  try {
    if (localStorage.getItem(FORCE_KEY) === "1") return true;
  } catch { /* ignore */ }

  const list = PDF_PORTAL_ALLOWED_EMAILS
    .map((e) => String(e || "").trim().toLowerCase())
    .filter(Boolean);

  if (list.length === 0) return false;

  const current = String(email || "").trim().toLowerCase();
  return !!current && list.includes(current);
}

export function syncPdfPortalModuleVisibility() {
  const btn = document.getElementById("plan-modulo-pdf-portal");
  if (!btn) return;
  const allowed = canSeePdfPortalModule();
  btn.classList.toggle("hidden", !allowed);
  btn.setAttribute("aria-hidden", allowed ? "false" : "true");
}

export function initPdfPortalGenerator() {
  const brandInput = document.getElementById("pdf-portal-brand");
  const editor = document.getElementById("pdf-portal-editor");
  const previewBrand = document.getElementById("pdf-portal-preview-brand");
  const previewBody = document.getElementById("pdf-portal-preview-body");
  const statusEl = document.getElementById("pdf-portal-status");
  const generateBtn = document.getElementById("pdf-portal-generate");
  const clearBtn = document.getElementById("pdf-portal-clear");
  const loadTxtBtn = document.getElementById("pdf-portal-load-txt");
  const fileInput = document.getElementById("pdf-portal-file");
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
    const brand = (brandInput?.value || "").trim();
    if (previewBrand) {
      if (brand) {
        previewBrand.textContent = brand.toUpperCase();
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
    document.execCommand("foreColor", false, fontColorInp.value);
    refreshPreview();
  });

  linkBtn?.addEventListener("mousedown", (ev) => ev.preventDefault());
  linkBtn?.addEventListener("click", () => {
    editor.focus();
    const existing = document.queryCommandValue("createLink") || "";
    const url = window.prompt("URL del hipervínculo (https://…)", existing || "https://");
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) {
      document.execCommand("unlink", false);
    } else {
      document.execCommand("createLink", false, trimmed);
    }
    refreshPreview();
  });

  clearBtn?.addEventListener("click", () => {
    if (brandInput) brandInput.value = "";
    editor.innerHTML = "";
    setStatus("");
    refreshPreview();
    editor.focus();
  });

  loadTxtBtn?.addEventListener("click", () => fileInput?.click());
  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const { brand, body } = parseTxtPayload(raw);
      if (brandInput && brand) brandInput.value = brand;
      editor.innerText = body;
      setStatus(`TXT cargado: ${file.name}`);
      refreshPreview();
    } catch {
      setStatus("No se pudo leer el archivo .txt.", true);
    } finally {
      fileInput.value = "";
    }
  });

  generateBtn?.addEventListener("click", () => {
    void generatePdf();
  });

  refreshPreview();

  async function generatePdf() {
    setStatus("Generando PDF…");
    generateBtn.disabled = true;
    try {
      const payload = {
        brand: (brandInput?.value || "").trim(),
        html: editor.innerHTML || "",
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
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

function sanitizePasteHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";

  // Word mete wrappers enormes; nos quedamos con body si existe.
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
      const c = normalizeCssColor(color[1].trim());
      if (c) styleKeep.push(`color:${c}`);
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
        const c = normalizeCssColor(fc);
        if (c) styleKeep.push(`color:${c}`);
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
        const c = normalizeCssColor(color[1].trim()) || DEFAULT_PREVIEW_COLOR;
        styleKeep.push(`color:${previewSafeColor(c)}`);
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

function parseTxtPayload(raw) {
  const lines = String(raw || "").replace(/\r\n/g, "\n").split("\n");
  let brand = "";
  let bodyStart = 0;

  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const kv = /^(?:MARCA|BRAND|LOGO)\s*[:=]\s*(.+)$/i.exec(line);
    if (kv) {
      brand = kv[1].trim();
      bodyStart = i + 1;
      break;
    }
    if (line.startsWith("#")) {
      brand = line.replace(/^#+\s*/, "").trim();
      bodyStart = i + 1;
      break;
    }
    break;
  }

  return {
    brand,
    body: lines.slice(bodyStart).join("\n").trim(),
  };
}
