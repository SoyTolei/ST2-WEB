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
  syncChileAdjuntosPanel(cfg);
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
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const basesCheck = document.getElementById("ref-chile-bases-check");
  if (basesCheck) basesCheck.checked = false;
  document.getElementById("ref-card-chile-bases")?.classList.remove("selected");
  const basesMark = document.getElementById("ref-mark-chile-bases");
  if (basesMark) {
    basesMark.textContent = "○";
    basesMark.style.color = "#94a3b8";
  }
  document.getElementById("ref-chile-bases-panel")?.classList.add("hidden");

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
  return {
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
    adjuntaPantallas: !!document.getElementById("ref-chile-pantallas")?.checked,
  };
}

export function syncChileReferralCards() {
  const basesCheck = document.getElementById("ref-chile-bases-check");
  const basesCard = document.getElementById("ref-card-chile-bases");
  const basesMark = document.getElementById("ref-mark-chile-bases");
  if (basesCheck && basesCard) {
    basesCard.classList.toggle("selected", basesCheck.checked);
    if (basesMark) {
      basesMark.textContent = basesCheck.checked ? "✓" : "○";
      basesMark.style.color = basesCheck.checked ? "#16a34a" : "#94a3b8";
    }
    document.getElementById("ref-chile-bases-panel")?.classList.toggle("hidden", !basesCheck.checked);
  }
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

    const moduloBtn = e.target.closest("[data-chile-modulo]");
    if (moduloBtn) {
      const val = moduloBtn.dataset.chileModulo;
      if (hyperrentaModulos.has(val)) hyperrentaModulos.delete(val);
      else hyperrentaModulos.add(val);
      buildChileReferralPanel();
    }
  });

  document.getElementById("ref-chile-post")?.addEventListener("click", (e) => {
    const tipoBtn = e.target.closest("[data-chile-tipo-base]");
    if (tipoBtn) {
      const val = tipoBtn.dataset.chileTipoBase;
      tipoBaseSel = tipoBaseSel === val ? null : val;
      const basesCheck = document.getElementById("ref-chile-bases-check");
      if (basesCheck && !basesCheck.checked) basesCheck.checked = true;
      buildChileReferralPanel();
      return;
    }

    const baseBtn = e.target.closest("[data-chile-base-adjunta]");
    if (baseBtn) {
      const val = baseBtn.dataset.chileBaseAdjunta === "si";
      baseAdjuntaSel = baseAdjuntaSel === val ? null : val;
      const basesCheck = document.getElementById("ref-chile-bases-check");
      if (basesCheck && !basesCheck.checked) basesCheck.checked = true;
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
      <div class="plan-field"><label for="ref-chile-anio">Año</label><input id="ref-chile-anio" type="text" inputmode="numeric" maxlength="4" value="${escapeAttr(readField("ref-chile-anio"))}"/></div>
      <div class="plan-field"><label for="ref-chile-rut">RUT con inconvenientes</label><input id="ref-chile-rut" type="text" value="${escapeAttr(readField("ref-chile-rut"))}"/></div>
    </div>`;

  if (productoSel === "HYPERRENTA") {
    const versiones = (cfg.hyperrentaVersiones || []).map((v) => {
      const id = typeof v === "string" ? v : v.id;
      const label = typeof v === "string" ? v : v.label;
      return `<button type="button" class="plan-segment-btn${hyperrentaVersionSel === id ? " active" : ""}" data-chile-hr-version="${escapeAttr(id)}">${escapeHtml(label)}</button>`;
    }).join("");
    const modulos = (cfg.hyperrentaModulos || []).map((m) =>
      `<button type="button" class="plan-segment-btn${hyperrentaModulos.has(m) ? " active" : ""}" data-chile-modulo="${escapeAttr(m)}">${escapeHtml(m)}</button>`
    ).join("");

    root.innerHTML = `
      <div class="plan-bej-row">
        <span class="plan-bej-label">Versión</span>
        <div class="plan-segment-track plan-segment-track-wide">${versiones}</div>
      </div>
      <div class="plan-bej-row plan-chile-modulos-row">
        <span class="plan-bej-label">Módulos</span>
        <div class="plan-segment-track plan-segment-track-wide plan-chile-modulos-track">${modulos}</div>
      </div>
      ${anioRut}`;
    return;
  }

  root.innerHTML = `
    <div class="plan-bej-row">
      <span class="plan-bej-label">Versión</span>
      <div class="plan-field plan-chile-version-field">
        <input id="ref-chile-version" type="text" value="${escapeAttr(readField("ref-chile-version"))}"/>
      </div>
    </div>
    ${anioRut}`;
}

function syncChileAdjuntosPanel(cfg) {
  const wrap = document.getElementById("ref-chile-adj-bases-wrap");
  const showBases = productoSel === "CONTABILIDAD" || productoSel === "REMUNERACIONES";
  wrap?.classList.toggle("hidden", !showBases);

  if (!showBases) {
    tipoBaseSel = null;
    baseAdjuntaSel = null;
    const basesCheck = document.getElementById("ref-chile-bases-check");
    if (basesCheck?.checked) {
      basesCheck.checked = false;
      syncChileReferralCards();
    }
    return;
  }

  const tipoRow = document.getElementById("ref-chile-tipo-base-pills");
  const baseRow = document.getElementById("ref-chile-base-adjunta-pills");
  if (tipoRow) {
    tipoRow.innerHTML = (cfg?.tiposBase || []).map((t) =>
      `<button type="button" class="plan-segment-btn${tipoBaseSel === t ? " active" : ""}" data-chile-tipo-base="${t}">${t}</button>`
    ).join("");
  }
  if (baseRow) {
    baseRow.innerHTML = `
      <button type="button" class="plan-segment-btn${baseAdjuntaSel === true ? " active" : ""}" data-chile-base-adjunta="si">Sí</button>
      <button type="button" class="plan-segment-btn${baseAdjuntaSel === false ? " active" : ""}" data-chile-base-adjunta="no">No</button>`;
  }

  const motorWrap = document.getElementById("ref-chile-motor-wrap");
  motorWrap?.classList.toggle("hidden", tipoBaseSel !== "SQL");
  if (tipoBaseSel !== "SQL") {
    const motor = document.getElementById("ref-chile-motor-sql");
    if (motor) motor.value = "";
  }

  syncChileReferralCards();
}

function readField(id) {
  return document.getElementById(id)?.value || "";
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function escapeHtml(value) {
  return escapeAttr(value);
}
