let ctx = null;
let productoSel = null;
let hyperrentaVersionSel = null;
let hyperrentaModulos = new Set();
let tipoBaseSel = null;
/** @type {boolean | null} */
let baseAdjuntaSel = null;

export function initChileReferral(context) {
  ctx = context;
  bindChileReferralEvents();
}

export function buildChileReferralPanel() {
  const cfg = ctx?.getConfig()?.chile?.referral;
  const row = document.getElementById("ref-chile-producto-pills");
  if (!cfg || !row) return;

  row.innerHTML = (cfg.productos || []).map((p) =>
    `<button type="button" class="plan-segment-btn${productoSel === p.id ? " active" : ""}" data-chile-producto="${p.id}">${p.label}</button>`
  ).join("");

  renderChileProductFields(cfg);
}

export function resetChileReferral() {
  productoSel = null;
  hyperrentaVersionSel = null;
  hyperrentaModulos = new Set();
  tipoBaseSel = null;
  baseAdjuntaSel = null;

  [
    "ref-chile-anio",
    "ref-chile-rut",
    "ref-chile-version",
    "ref-chile-usuario",
    "ref-chile-clave",
    "ref-chile-so",
    "ref-chile-motor-sql",
    "ref-chile-contacto-nombre",
    "ref-chile-contacto-tel",
    "ref-chile-contacto-correo",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const check = document.getElementById("ref-chile-pantallas");
  if (check) check.checked = false;
  document.getElementById("ref-card-chile-pantallas")?.classList.remove("selected");
  const mark = document.getElementById("ref-mark-chile-pantallas");
  if (mark) {
    mark.textContent = "○";
    mark.style.color = "#94a3b8";
  }
  document.getElementById("ref-chile-capturas")?.classList.add("hidden");

  buildChileReferralPanel();
}

export function buildChileReferralPayload() {
  const payload = {
    producto: productoSel || "",
    hyperrentaVersion: hyperrentaVersionSel || "",
    hyperrentaModulos: [...hyperrentaModulos],
    version: document.getElementById("ref-chile-version")?.value.trim() || "",
    tipoBase: tipoBaseSel || "",
    baseAdjunta: baseAdjuntaSel,
    anio: document.getElementById("ref-chile-anio")?.value.trim() || "",
    rut: document.getElementById("ref-chile-rut")?.value.trim() || "",
    usuario: document.getElementById("ref-chile-usuario")?.value.trim() || "",
    clave: document.getElementById("ref-chile-clave")?.value.trim() || "",
    sistemaOperativo: document.getElementById("ref-chile-so")?.value.trim() || "",
    versionMotorSql: document.getElementById("ref-chile-motor-sql")?.value.trim() || "",
    contactoNombre: document.getElementById("ref-chile-contacto-nombre")?.value.trim() || "",
    contactoTelefono: document.getElementById("ref-chile-contacto-tel")?.value.trim() || "",
    contactoCorreo: document.getElementById("ref-chile-contacto-correo")?.value.trim() || "",
    adjuntaPantallas: !!document.getElementById("ref-chile-pantallas")?.checked,
  };

  return payload;
}

export function getChileProductoSel() {
  return productoSel;
}

function bindChileReferralEvents() {
  document.getElementById("ref-chile-panel")?.addEventListener("click", (e) => {
    const productoBtn = e.target.closest("[data-chile-producto]");
    if (productoBtn) {
      const val = productoBtn.dataset.chileProducto;
      if (productoSel !== val) {
        productoSel = val;
        hyperrentaVersionSel = null;
        hyperrentaModulos = new Set();
        tipoBaseSel = null;
        baseAdjuntaSel = null;
      } else {
        productoSel = null;
        hyperrentaVersionSel = null;
        hyperrentaModulos = new Set();
        tipoBaseSel = null;
        baseAdjuntaSel = null;
      }
      buildChileReferralPanel();
      return;
    }

    const versionBtn = e.target.closest("[data-chile-hr-version]");
    if (versionBtn) {
      const val = versionBtn.dataset.chileHrVersion;
      hyperrentaVersionSel = hyperrentaVersionSel === val ? null : val;
      buildChileReferralPanel();
      return;
    }

    const tipoBtn = e.target.closest("[data-chile-tipo-base]");
    if (tipoBtn) {
      const val = tipoBtn.dataset.chileTipoBase;
      tipoBaseSel = tipoBaseSel === val ? null : val;
      if (tipoBaseSel !== "SQL") {
        const motor = document.getElementById("ref-chile-motor-sql");
        if (motor) motor.value = "";
      }
      buildChileReferralPanel();
      return;
    }

    const baseBtn = e.target.closest("[data-chile-base-adjunta]");
    if (baseBtn) {
      const val = baseBtn.dataset.chileBaseAdjunta === "si";
      baseAdjuntaSel = baseAdjuntaSel === val ? null : val;
      buildChileReferralPanel();
      return;
    }

    const moduloBtn = e.target.closest("[data-chile-modulo]");
    if (moduloBtn) {
      const val = moduloBtn.dataset.chileModulo;
      if (hyperrentaModulos.has(val)) hyperrentaModulos.delete(val);
      else hyperrentaModulos.add(val);
      buildChileReferralPanel();
    }
  });
}

function renderChileProductFields(cfg) {
  const root = document.getElementById("ref-chile-product-fields");
  if (!root) return;

  if (!productoSel) {
    root.innerHTML = "";
    return;
  }

  const anioRut = `
    <div class="plan-form-2col plan-form-2col-tight plan-chile-meta-row">
      <div class="plan-field"><label for="ref-chile-anio">Año</label><input id="ref-chile-anio" type="text" inputmode="numeric" maxlength="4" value="${escapeAttr(document.getElementById("ref-chile-anio")?.value || "")}"/></div>
      <div class="plan-field"><label for="ref-chile-rut">RUT con inconvenientes</label><input id="ref-chile-rut" type="text" value="${escapeAttr(document.getElementById("ref-chile-rut")?.value || "")}"/></div>
    </div>`;

  if (productoSel === "HYPERRENTA") {
    const versiones = (cfg.hyperrentaVersiones || []).map((v) =>
      `<button type="button" class="plan-segment-btn${hyperrentaVersionSel === v ? " active" : ""}" data-chile-hr-version="${escapeAttr(v)}">${v}</button>`
    ).join("");
    const modulos = (cfg.hyperrentaModulos || []).map((m) =>
      `<button type="button" class="borrado-bases-check${hyperrentaModulos.has(m) ? " is-on" : ""}" data-chile-modulo="${escapeAttr(m)}">${m}</button>`
    ).join("");

    root.innerHTML = `
      <div class="plan-bej-row">
        <span class="plan-bej-label">Versión</span>
        <div class="plan-segment-track plan-segment-track-wide">${versiones}</div>
      </div>
      <div class="plan-bej-row plan-chile-modulos-row">
        <span class="plan-bej-label">Módulos</span>
        <div class="borrado-bases-checks plan-chile-modulos-checks">${modulos}</div>
      </div>
      ${anioRut}`;
    return;
  }

  const tipos = (cfg.tiposBase || []).map((t) =>
    `<button type="button" class="plan-segment-btn${tipoBaseSel === t ? " active" : ""}" data-chile-tipo-base="${t}">${t}</button>`
  ).join("");
  const baseAdj = `
    <button type="button" class="plan-segment-btn${baseAdjuntaSel === true ? " active" : ""}" data-chile-base-adjunta="si">Sí</button>
    <button type="button" class="plan-segment-btn${baseAdjuntaSel === false ? " active" : ""}" data-chile-base-adjunta="no">No</button>`;

  root.innerHTML = `
    <div class="plan-bej-row">
      <span class="plan-bej-label">Versión</span>
      <div class="plan-field plan-chile-version-field">
        <input id="ref-chile-version" type="text" value="${escapeAttr(document.getElementById("ref-chile-version")?.value || "")}"/>
      </div>
    </div>
    <div class="plan-bej-row">
      <span class="plan-bej-label">Tipo de base</span>
      <div class="plan-segment-track">${tipos}</div>
    </div>
    <div class="plan-bej-row">
      <span class="plan-bej-label">Base adjunta</span>
      <div class="plan-segment-track">${baseAdj}</div>
    </div>
    ${anioRut}`;
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}
