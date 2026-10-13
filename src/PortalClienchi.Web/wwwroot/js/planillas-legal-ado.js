/**
 * Westlaw International · Plantilla ADO (Bug / User Story para el equipo global).
 * Solo arma texto para copiar y pegar: no crea work items por la API de ADO.
 * Valores fijos del proceso (IDs de backlog, Area, asignado, países) vienen de Legal:Ado en appsettings.
 */
import { planTextPreviewHtml, planFormActionsHtml, showPlanTextPreview, clearPlanTextPreview, mountPlanTextPreview } from "./plan-text-preview.js";
import { enhancePlanSelect, syncPlanCustomSelect } from "./plan-custom-select.js";
import { injectModuleHeaders } from "./planillas-icons.js";

/** Etiquetas de la salida por idioma. Ajustar textos acá, sin tocar la lógica. */
export const ADO_LABELS = {
  en: {
    blockHeading: "ENGLISH",
    title: "Title",
    type: "Work item type",
    typeBug: "Bug",
    typeStory: "User Story",
    backlog: "Backlog",
    backlogApplication: "Application",
    backlogContent: "Content",
    area: "Area",
    assignedTo: "Assigned to",
    state: "State",
    reason: "Reason",
    iteration: "Iteration",
    tags: "Tags",
    otherFields: "Other fields",
    otherFieldsValue: "leave empty",
    actual: "What is actually happening",
    expected: "What is expected after the fix",
    errors: "Error messages",
    steps: "Steps to recreate",
    change: "What I would like changed or enhanced",
    howItWorks: "How it will look / work after the development",
    uuids: "UUIDs / URLs",
    query: "Query",
    screenshots: "Screenshots",
    questions: "Questions for Alex",
  },
  es: {
    blockHeading: "ESPAÑOL",
    title: "Título",
    type: "Tipo de item",
    typeBug: "Bug",
    typeStory: "User Story",
    backlog: "Backlog",
    backlogApplication: "Aplicación",
    backlogContent: "Contenido",
    area: "Area",
    assignedTo: "Asignado a",
    state: "State",
    reason: "Reason",
    iteration: "Iteration",
    tags: "Tags",
    otherFields: "Demás campos",
    otherFieldsValue: "dejar vacíos",
    actual: "Qué está pasando realmente",
    expected: "Qué se espera después del arreglo",
    errors: "Mensajes de error",
    steps: "Pasos para reproducirlo",
    change: "Qué me gustaría cambiar o mejorar",
    howItWorks: "Cómo se verá o funcionará después del desarrollo",
    uuids: "UUIDs / URLs",
    query: "Query",
    screenshots: "Capturas de pantalla",
    questions: "Preguntas para Alex",
  },
};

/** Orden del cuerpo por tipo. Los opcionales vacíos no se imprimen. */
const ADO_BODY_FIELDS = {
  bug: ["actual", "expected", "errors", "steps", "uuids", "query", "screenshots", "questions"],
  story: ["change", "howItWorks", "uuids", "query", "screenshots", "questions"],
};

const ADO_REQUIRED_BY_TYPE = {
  bug: ["actual", "expected", "steps"],
  story: ["change", "howItWorks"],
};

const ADO_BLOCK_SEPARATOR = "\n\n========================================\n\n";

/**
 * Fase 2: acá se conecta la traducción automática (vía endpoint del backend, nunca con claves en el front).
 * Hoy devuelve el texto tal cual lo escribió el usuario.
 */
export function translateFreeText(text, _targetLang) {
  return String(text ?? "");
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Nombre en inglés si el país está en la lista (por nombre en español o inglés); si no, tal cual. */
export function resolveCountryEn(country, countries = []) {
  const raw = String(country || "").trim();
  const key = normalizeKey(raw);
  if (!key) return "";
  const hit = (countries || []).find((c) => normalizeKey(c?.es) === key || normalizeKey(c?.en) === key);
  return String(hit?.en || "").trim() || raw;
}

/**
 * Título del item: país + tipo de contenido (si aplica) + descripción corta.
 * El proceso no define cómo marcar que lo reportó un cliente: si cambia, se ajusta solo acá.
 */
export function buildAdoTitle({ country, contentType, shortDescription, customer } = {}, countries = []) {
  const parts = [
    resolveCountryEn(country, countries),
    String(contentType || "").trim(),
    translateFreeText(shortDescription, "en").trim(),
  ].filter(Boolean);
  const base = parts.join(" – ");
  const customerName = String(customer || "").trim();
  return customerName ? `${base} (Customer issue: ${customerName})` : base;
}

/** Devuelve las claves obligatorias que faltan. */
export function validateAdoValues(values) {
  const missing = [];
  if (!String(values?.country || "").trim()) missing.push("country");
  if (!String(values?.shortDescription || "").trim()) missing.push("shortDescription");
  for (const key of ADO_REQUIRED_BY_TYPE[values?.type === "story" ? "story" : "bug"]) {
    if (!String(values?.[key] || "").trim()) missing.push(key);
  }
  if (values?.isCustomer && !String(values?.customerName || "").trim()) missing.push("customerName");
  return missing;
}

function buildAdoBlock(values, settings, lang, withHeading) {
  const L = ADO_LABELS[lang];
  const type = values.type === "story" ? "story" : "bug";
  const isContent = values.backlog === "content";
  const backlog = (isContent ? settings?.content : settings?.application) || {};
  const customer = values.isCustomer ? String(values.customerName || "").trim() : "";
  const lines = [];

  if (withHeading) lines.push(`=== ${L.blockHeading} ===`, "");

  lines.push(`${L.title}: ${buildAdoTitle({
    country: values.country,
    contentType: values.contentType,
    shortDescription: values.shortDescription,
    customer,
  }, settings?.countries)}`);
  lines.push(`${L.type}: ${type === "story" ? L.typeStory : L.typeBug}`);

  const parent = [backlog.parentType, backlog.parentId].filter((x) => String(x || "").trim()).join(" ");
  lines.push(`${L.backlog}: ${isContent ? L.backlogContent : L.backlogApplication}${parent ? ` (${parent})` : ""}`);

  const defaults = [
    [L.area, backlog.area],
    [L.assignedTo, settings?.assignedTo],
    [L.state, settings?.state],
    [L.reason, settings?.reason],
    [L.iteration, settings?.iteration],
  ];
  for (const [label, value] of defaults) {
    if (String(value || "").trim()) lines.push(`${label}: ${String(value).trim()}`);
  }
  if (customer && String(settings?.customerTag || "").trim()) {
    lines.push(`${L.tags}: ${settings.customerTag.trim()}`);
  }
  lines.push(`${L.otherFields}: ${L.otherFieldsValue}`);

  for (const key of ADO_BODY_FIELDS[type]) {
    const text = translateFreeText(values[key], lang).trim();
    if (!text) continue;
    lines.push("", `${L[key]}:`, text);
  }

  return lines.join("\n");
}

/** Texto plano listo para pegar en la descripción de ADO. outputLang: "en" | "es" | "both". */
export function buildAdoOutput(values, settings, outputLang = "en") {
  const langs = outputLang === "both" ? ["en", "es"] : [outputLang === "es" ? "es" : "en"];
  return langs
    .map((lang) => buildAdoBlock(values, settings, lang, langs.length > 1))
    .join(ADO_BLOCK_SEPARATOR);
}

/* ---------------------------------------------------------------- UI ---- */

const FIELD_IDS = {
  type: "ado-type",
  backlog: "ado-backlog",
  country: "ado-country",
  contentType: "ado-content-type",
  shortDescription: "ado-short",
  isCustomer: "ado-customer",
  customerName: "ado-customer-name",
  actual: "ado-actual",
  expected: "ado-expected",
  errors: "ado-errors",
  steps: "ado-steps",
  change: "ado-change",
  howItWorks: "ado-how",
  uuids: "ado-uuids",
  query: "ado-query",
  screenshots: "ado-screenshots",
  questions: "ado-questions",
  outputLang: "ado-lang",
};

const FORM_LABELS = {
  country: "País",
  shortDescription: "Descripción corta",
  customerName: "Nombre del cliente",
  actual: "Qué está pasando realmente",
  expected: "Qué se espera después del arreglo",
  steps: "Pasos para reproducirlo",
  change: "Qué se quiere cambiar o mejorar",
  howItWorks: "Cómo se vería o funcionaría cuando esté desarrollado",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textField(key, label, { required = false, placeholder = "", attrs = "" } = {}) {
  return `<div class="plan-field"${attrs}>
    <label for="${FIELD_IDS[key]}">${escapeHtml(label)}${required ? " *" : ""}</label>
    <input id="${FIELD_IDS[key]}" type="text" autocomplete="off" placeholder="${escapeHtml(placeholder)}"/>
  </div>`;
}

function areaField(key, label, { required = false, placeholder = "", attrs = "" } = {}) {
  return `<div class="plan-field"${attrs}>
    <label for="${FIELD_IDS[key]}">${escapeHtml(label)}${required ? " *" : ""}</label>
    <textarea id="${FIELD_IDS[key]}" rows="4" placeholder="${escapeHtml(placeholder)}"></textarea>
  </div>`;
}

function formHtml(settings) {
  const countries = (settings?.countries || [])
    .map((c) => `<option value="${escapeHtml(c?.es || c?.en || "")}"></option>`)
    .join("");
  return `
    <div class="plan-legal-form-shell plan-legal-ado">
      <p class="plan-legal-ado-reminder">☝️ Cada item tiene que tener <strong>un solo problema o mejora</strong>: pueden trabajarlos distintos desarrolladores en distintas iteraciones.</p>
      <form id="ado-form" class="plan-form-grid plan-legal-form-grid plan-legal-ado-form" autocomplete="off">
        <div class="plan-legal-section">
          <p class="plan-ref-title">Tipo y destino</p>
          <div class="plan-legal-section-body plan-legal-checklist-grid">
            <div class="plan-field">
              <label for="${FIELD_IDS.type}">Tipo de item *</label>
              <select id="${FIELD_IDS.type}" class="plan-select">
                <option value="bug">Bug — hay un error o algo no funciona como se espera</option>
                <option value="story">Story — mejora o cambio no relacionado con un error</option>
                <option value="template">Cambio de template, nombre de link o página de categoría</option>
              </select>
            </div>
            <div class="plan-field" data-ado-hide-template>
              <label for="${FIELD_IDS.backlog}">Backlog *</label>
              <select id="${FIELD_IDS.backlog}" class="plan-select">
                <option value="application">Aplicación</option>
                <option value="content">Contenido</option>
              </select>
            </div>
          </div>
        </div>

        <div id="ado-template-warn" class="plan-legal-ado-warn hidden" role="alert">
          Los cambios de template, de nombre de link o de página de categoría <strong>no se cargan en ADO</strong>:
          se mandan por mail a <strong>${escapeHtml(settings?.templateChangeContact || "Alex Troutman")}</strong>. Para este caso no se genera plantilla.
        </div>

        <div class="plan-legal-section" data-ado-hide-template>
          <p class="plan-ref-title">Título</p>
          <div class="plan-legal-section-body plan-legal-checklist-grid">
            <div class="plan-field">
              <label for="${FIELD_IDS.country}">País *</label>
              <input id="${FIELD_IDS.country}" type="text" list="ado-country-list" autocomplete="off" placeholder="Elegí de la lista o escribí otro"/>
              <datalist id="ado-country-list">${countries}</datalist>
            </div>
            ${textField("contentType", "Tipo de contenido (opcional)", { placeholder: "Ej. Jurisprudence" })}
            ${textField("shortDescription", "Descripción corta", { required: true, placeholder: "Ej. The jurisdiction filter is erroring" })}
            <div class="plan-field">
              <label class="plan-legal-check"><input id="${FIELD_IDS.isCustomer}" type="checkbox"/> Lo reportó un cliente</label>
              <input id="${FIELD_IDS.customerName}" class="hidden" type="text" autocomplete="off" placeholder="Nombre del cliente *"/>
            </div>
          </div>
          <p id="ado-title-preview" class="plan-legal-ado-title-preview" aria-live="polite"></p>
        </div>

        <div class="plan-legal-section" data-ado-only="bug">
          <p class="plan-ref-title">Bug</p>
          <div class="plan-legal-section-body">
            ${areaField("actual", "Qué está pasando realmente", { required: true })}
            ${areaField("expected", "Qué se espera después del arreglo", { required: true })}
            ${areaField("errors", "Mensajes de error (opcional)")}
            ${areaField("steps", "Pasos para reproducirlo", { required: true, placeholder: "1. …\n2. …" })}
          </div>
        </div>

        <div class="plan-legal-section hidden" data-ado-only="story">
          <p class="plan-ref-title">Story</p>
          <div class="plan-legal-section-body">
            ${areaField("change", "Qué se quiere cambiar o mejorar", { required: true })}
            ${areaField("howItWorks", "Cómo se vería o funcionaría cuando esté desarrollado", { required: true })}
          </div>
        </div>

        <div class="plan-legal-section" data-ado-hide-template>
          <p class="plan-ref-title">Información adicional (opcional)</p>
          <div class="plan-legal-section-body plan-legal-checklist-grid">
            ${areaField("uuids", "UUIDs o URLs")}
            ${areaField("query", "Query (problemas de búsqueda o resultados)")}
            ${areaField("screenshots", "Screenshots (texto o referencia)")}
            ${areaField("questions", "Preguntas para Alex")}
          </div>
        </div>

        <div class="plan-legal-section" data-ado-hide-template>
          <p class="plan-ref-title">Salida</p>
          <div class="plan-legal-section-body plan-legal-checklist-grid">
            <div class="plan-field">
              <label for="${FIELD_IDS.outputLang}">Idioma de salida</label>
              <select id="${FIELD_IDS.outputLang}" class="plan-select">
                <option value="en">Inglés</option>
                <option value="es">Español</option>
                <option value="both">Ambos</option>
              </select>
            </div>
            <div class="plan-field">
              <label>Valores por defecto (informativo)</label>
              <dl id="ado-defaults" class="plan-legal-ado-defaults"></dl>
            </div>
          </div>
        </div>
      </form>
      ${planFormActionsHtml({ copyId: "ado-btn-copiar", previewId: "ado-btn-ver", clearId: "ado-btn-limpiar" })}
      ${planTextPreviewHtml("ado-text-preview", "ado-form-status")}
      <p id="ado-form-status" class="plan-status-bar"></p>
    </div>
  `;
}

function el(key) {
  return document.getElementById(FIELD_IDS[key]);
}

function readValues() {
  const val = (key) => String(el(key)?.value || "");
  return {
    type: val("type") || "bug",
    backlog: val("backlog") || "application",
    country: val("country"),
    contentType: val("contentType"),
    shortDescription: val("shortDescription"),
    isCustomer: !!el("isCustomer")?.checked,
    customerName: val("customerName"),
    actual: val("actual"),
    expected: val("expected"),
    errors: val("errors"),
    steps: val("steps"),
    change: val("change"),
    howItWorks: val("howItWorks"),
    uuids: val("uuids"),
    query: val("query"),
    screenshots: val("screenshots"),
    questions: val("questions"),
    outputLang: val("outputLang") || "en",
  };
}

function setStatus(msg, isError = false) {
  const status = document.getElementById("ado-form-status");
  if (!status) return;
  status.textContent = msg || "";
  status.classList.toggle("is-error", !!isError && !!msg);
  status.classList.toggle("error", !!isError && !!msg);
}

function clearInvalid() {
  document.querySelectorAll("#ado-form .st2-field-invalid").forEach((node) => {
    node.classList.remove("st2-field-invalid");
    node.removeAttribute("aria-invalid");
  });
}

function syncDefaults(settings) {
  const box = document.getElementById("ado-defaults");
  if (!box) return;
  const isContent = el("backlog")?.value === "content";
  const backlog = (isContent ? settings?.content : settings?.application) || {};
  const parent = [backlog.parentType, backlog.parentId].filter((x) => String(x || "").trim()).join(" ");
  const rows = [
    ["Backlog", `${isContent ? "Contenido" : "Aplicación"}${parent ? ` (${parent})` : ""}`],
    ["Area", backlog.area],
    ["Asignado a", settings?.assignedTo],
    ["State", settings?.state],
    ["Reason", settings?.reason],
    ["Iteration", settings?.iteration],
    ["Tag", el("isCustomer")?.checked ? settings?.customerTag : ""],
  ].filter(([, v]) => String(v || "").trim());
  box.innerHTML = rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join("");
}

function syncTitlePreview(settings) {
  const preview = document.getElementById("ado-title-preview");
  if (!preview) return;
  const v = readValues();
  const title = buildAdoTitle({
    country: v.country,
    contentType: v.contentType,
    shortDescription: v.shortDescription,
    customer: v.isCustomer ? v.customerName : "",
  }, settings?.countries);
  preview.textContent = title ? `Título en ADO: ${title}` : "";
}

function syncVisibility(settings) {
  const type = el("type")?.value || "bug";
  const isTemplate = type === "template";
  document.querySelectorAll("#ado-form [data-ado-only]").forEach((node) => {
    node.classList.toggle("hidden", isTemplate || node.getAttribute("data-ado-only") !== type);
  });
  document.querySelectorAll("#ado-form [data-ado-hide-template]").forEach((node) => {
    node.classList.toggle("hidden", isTemplate);
  });
  document.getElementById("ado-template-warn")?.classList.toggle("hidden", !isTemplate);
  ["ado-btn-copiar", "ado-btn-ver"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = isTemplate;
  });
  const customer = el("customerName");
  customer?.classList.toggle("hidden", !el("isCustomer")?.checked);
  if (isTemplate) clearPlanTextPreview("ado-text-preview");
  syncDefaults(settings);
  syncTitlePreview(settings);
}

function generate(settings) {
  clearInvalid();
  const values = readValues();
  if (values.type === "template") return "";
  const missing = validateAdoValues(values);
  if (missing.length) {
    missing.forEach((key) => {
      const node = el(key);
      node?.classList.add("st2-field-invalid");
      node?.setAttribute("aria-invalid", "true");
    });
    setStatus(`Falta completar: ${missing.map((k) => FORM_LABELS[k] || k).join(", ")}.`, true);
    const first = el(missing[0]);
    first?.focus();
    first?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    return "";
  }
  return buildAdoOutput(values, settings, values.outputLang);
}

function resetForm(settings) {
  document.getElementById("ado-form")?.reset();
  clearInvalid();
  document.querySelectorAll("#ado-form select.plan-select").forEach(syncPlanCustomSelect);
  clearPlanTextPreview("ado-text-preview");
  setStatus("");
  syncVisibility(settings);
}

/** Pinta el formulario en root. settings = config.legal.ado del servidor. */
export function renderAdoForm(root, settings) {
  if (!root) return;
  root.innerHTML = formHtml(settings || {});

  const form = document.getElementById("ado-form");
  form?.addEventListener("submit", (e) => e.preventDefault());
  form?.addEventListener("input", (e) => {
    const target = e.target;
    if (target instanceof HTMLElement && target.classList.contains("st2-field-invalid")) {
      target.classList.remove("st2-field-invalid");
      target.removeAttribute("aria-invalid");
    }
    syncTitlePreview(settings);
  });
  form?.addEventListener("change", () => syncVisibility(settings));

  document.getElementById("ado-btn-ver")?.addEventListener("click", () => {
    const text = generate(settings);
    if (!text) return;
    showPlanTextPreview("ado-text-preview", text);
    setStatus("Plantilla lista. Podés copiarla desde el panel de vista previa.");
  });
  document.getElementById("ado-btn-copiar")?.addEventListener("click", async () => {
    const text = generate(settings);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Plantilla copiada al portapapeles.");
    } catch {
      showPlanTextPreview("ado-text-preview", text);
      setStatus("No se pudo copiar automáticamente: copiala desde la vista previa.", true);
    }
  });
  document.getElementById("ado-btn-limpiar")?.addEventListener("click", () => resetForm(settings));

  mountPlanTextPreview("ado-text-preview");
  document.querySelectorAll("#ado-form select.plan-select").forEach(enhancePlanSelect);
  injectModuleHeaders();
  syncVisibility(settings);
  requestAnimationFrame(() => root.classList.add("is-ready"));
}
