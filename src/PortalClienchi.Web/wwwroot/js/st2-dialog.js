/**
 * Avisos y confirmaciones con el estilo de la web (reemplazan alert/confirm del navegador).
 */

let overlay = null;
let titleEl = null;
let bodyEl = null;
let detailEl = null;
let okBtn = null;
let cancelBtn = null;
let closeBtn = null;
let resolver = null;

function settle(value) {
  const fn = resolver;
  resolver = null;
  overlay?.classList.add("hidden");
  overlay?.setAttribute("aria-hidden", "true");
  if (fn) fn(value);
}

function build() {
  if (overlay) return;

  overlay = document.createElement("div");
  overlay.id = "st2-notice-overlay";
  overlay.className = "st2-tool-url-overlay hidden";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "st2-notice-title");
  overlay.setAttribute("aria-hidden", "true");

  overlay.innerHTML = `
    <div class="st2-tool-url-dialog st2-msg-dialog st2-notice-dialog">
      <div class="st2-msg-dialog-head">
        <h3 id="st2-notice-title">Aviso</h3>
        <button type="button" id="st2-notice-close" class="st2-msg-close" aria-label="Cerrar">×</button>
      </div>
      <p id="st2-notice-body" class="st2-tool-url-lead st2-msg-body"></p>
      <p id="st2-notice-detail" class="st2-notice-detail hidden"></p>
      <div class="st2-tool-url-actions">
        <button type="button" id="st2-notice-cancel" class="st2-tool-url-btn st2-tool-url-btn--ghost hidden">Cancelar</button>
        <button type="button" id="st2-notice-ok" class="st2-tool-url-btn st2-tool-url-btn--primary">Entendido</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  titleEl = overlay.querySelector("#st2-notice-title");
  bodyEl = overlay.querySelector("#st2-notice-body");
  detailEl = overlay.querySelector("#st2-notice-detail");
  okBtn = overlay.querySelector("#st2-notice-ok");
  cancelBtn = overlay.querySelector("#st2-notice-cancel");
  closeBtn = overlay.querySelector("#st2-notice-close");

  okBtn?.addEventListener("click", () => settle(true));
  cancelBtn?.addEventListener("click", () => settle(false));
  closeBtn?.addEventListener("click", () => settle(false));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) settle(false);
  });
  document.addEventListener("keydown", (e) => {
    if (!resolver || overlay.classList.contains("hidden")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      settle(false);
    }
    if (e.key === "Enter") {
      e.preventDefault();
      settle(true);
    }
  });
}

function open({ title, body, detail, okLabel, cancelLabel, tone }) {
  build();
  // Si ya había un aviso abierto, se descarta para no encolar diálogos.
  if (resolver) settle(false);

  if (titleEl) titleEl.textContent = title || "Aviso";
  if (bodyEl) bodyEl.textContent = body || "";
  if (detailEl) {
    const text = String(detail || "").trim();
    detailEl.textContent = text;
    detailEl.classList.toggle("hidden", !text);
  }
  if (okBtn) okBtn.textContent = okLabel || "Entendido";
  if (cancelBtn) {
    cancelBtn.textContent = cancelLabel || "Cancelar";
    cancelBtn.classList.toggle("hidden", !cancelLabel);
  }
  overlay.classList.toggle("is-warn", tone === "warn");
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  okBtn?.focus();

  return new Promise((resolve) => {
    resolver = resolve;
  });
}

/**
 * Aviso de un solo botón. Reemplaza a `alert`.
 * @param {string} body Mensaje principal.
 * @param {{ title?: string, detail?: string, okLabel?: string, tone?: "warn" }} [opts]
 */
export function alertSt2(body, opts = {}) {
  return open({
    title: opts.title || "Aviso",
    body,
    detail: opts.detail,
    okLabel: opts.okLabel || "Entendido",
    tone: opts.tone || "warn",
  });
}

/** Aviso de error (mismo diálogo, otro título por defecto). */
export function errorSt2(body, opts = {}) {
  return open({
    title: opts.title || "No se pudo continuar",
    body,
    detail: opts.detail,
    okLabel: opts.okLabel || "Entendido",
  });
}

/**
 * Confirmación con dos botones. Reemplaza a `confirm`.
 * @returns {Promise<boolean>}
 */
export function askSt2(body, opts = {}) {
  return open({
    title: opts.title || "Confirmar",
    body,
    detail: opts.detail,
    okLabel: opts.okLabel || "Sí",
    cancelLabel: opts.cancelLabel || "No",
  });
}
