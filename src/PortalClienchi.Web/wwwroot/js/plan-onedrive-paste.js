/** Windows/Explorer a veces pega el nombre de la carpeta; priorizamos la URL del clipboard. */
export function extractUrlFromClipboardData(data) {
  if (!data) return "";

  const uriList = data.getData("text/uri-list")?.trim();
  if (uriList) {
    const line = uriList.split(/\r?\n/).find((l) => l && !l.startsWith("#"));
    if (line && /^https?:\/\//i.test(line)) return line.trim();
  }

  const html = data.getData("text/html") || "";
  if (html) {
    const hrefMatch = html.match(/href\s*=\s*["']([^"']+)["']/i);
    if (hrefMatch?.[1]) {
      const href = hrefMatch[1].trim().replace(/&amp;/g, "&");
      if (/^https?:\/\//i.test(href)) return href;
    }
  }

  const plain = (data.getData("text/plain") || "").trim();
  if (!plain) return "";

  if (/^https?:\/\//i.test(plain)) return plain.split(/\s+/)[0];

  const embedded = plain.match(/https?:\/\/[^\s<>"']+/i);
  return embedded ? embedded[0] : "";
}

export function normalizeOnedriveUrl(value) {
  let text = String(value || "").trim().replace(/&amp;/g, "&");
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) {
    return text.split(/\s+/)[0].replace(/[.,;)\]]+$/, "");
  }
  const embedded = text.match(/https?:\/\/[^\s<>"']+/i);
  return embedded ? embedded[0].replace(/[.,;)\]]+$/, "") : "";
}

export function setupOnedrivePasteInput(input) {
  if (!input || input.dataset.onedrivePasteBound === "1") return;
  input.dataset.onedrivePasteBound = "1";

  input.addEventListener("paste", (e) => {
    const url = extractUrlFromClipboardData(e.clipboardData)
      || normalizeOnedriveUrl(e.clipboardData?.getData("text/plain"));
    if (!url) return;

    e.preventDefault();
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = `${input.value.slice(0, start)}${url}${input.value.slice(end)}`;
    const caret = start + url.length;
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  input.addEventListener("blur", () => {
    const normalized = normalizeOnedriveUrl(input.value);
    if (normalized && normalized !== input.value) input.value = normalized;
  });
}
