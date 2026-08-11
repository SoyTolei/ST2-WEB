import { getPlanUserEmail } from "./plan-user.js";

/**
 * Quién ve la opción en Sistema de Planillas.
 * Lista vacía = oculto para todos.
 * Override de prueba: localStorage.setItem("st2-pdf-portal-force", "1")
 * (Más adelante: toggle desde panel admin.)
 */
const PDF_PORTAL_ALLOWED_EMAILS = [
  "franco.zanna@thomsonreuters.com",
  "leonel.gallo@thomsonreuters.com",
];

const FORCE_KEY = "st2-pdf-portal-force";

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
  editor.addEventListener("paste", () => {
    setTimeout(refreshPreview, 0);
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
        throw new Error(data.error || data.title || `Error ${response.status}`);
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

function sanitizePreviewHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  const walk = (node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = /** @type {HTMLElement} */ (node);
      const tag = el.tagName.toLowerCase();
      const allowed = new Set(["p", "div", "br", "span", "b", "strong", "i", "em", "u", "ul", "ol", "li"]);
      if (!allowed.has(tag)) {
        const parent = el.parentNode;
        while (el.firstChild) parent?.insertBefore(el.firstChild, el);
        parent?.removeChild(el);
        return;
      }
      [...el.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name === "style") {
          const align = /text-align\s*:\s*(left|center|right|justify)/i.exec(attr.value);
          el.removeAttribute("style");
          if (align) el.style.textAlign = align[1].toLowerCase();
          return;
        }
        if (name === "align" && /^(left|center|right|justify)$/i.test(attr.value)) return;
        el.removeAttribute(attr.name);
      });
    }
    [...node.childNodes].forEach(walk);
  };
  [...tmp.childNodes].forEach(walk);
  return tmp.innerHTML;
}
