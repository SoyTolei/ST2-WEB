let overlay;
let modal;
let titleEl;
let subtitleEl;
let bodyEl;
let saveBtn;
let closeBtn;
let backBtn;
let navStack = [];
let resolveDialog = null;
let activeConfig = null;

const PERS_KEY = "Nombre de la PERS/ACTU a medida.";
const NO_MAM = "No utiliza MAM";
const NO_SDK = "No utiliza SDK";
const TIENE_TRIGGERS = "Tiene triggers";

const TRIGGERS_SQL_FALLBACK = [
  {
    num: "1",
    title: "Consultar triggers y su estado",
    explanation: "Lista cada trigger de usuario con su tabla, esquema y si está habilitado o deshabilitado.",
    query: `-- CONSULTAR TRIGGERS Y SU ESTADO
-- Lista cada trigger de usuario con su tabla y si esta habilitado o no.
-- Columna IsDisabled => 0 = HABILITADO, 1 = DESHABILITADO.
SELECT
    t.name AS TriggerName,
    OBJECT_NAME(t.parent_id) AS TableName,
    s.name AS SchemaName,
    t.is_disabled AS IsDisabled,
    t.create_date,
    t.modify_date
FROM sys.triggers t
INNER JOIN sys.tables tbl ON t.parent_id = tbl.object_id
INNER JOIN sys.schemas s ON tbl.schema_id = s.schema_id
WHERE t.is_ms_shipped = 0
ORDER BY TableName, TriggerName;`,
  },
  {
    num: "2",
    title: "Tablas con triggers en la base",
    explanation: "Resumen por tabla: cuántos triggers tiene y cuántos están habilitados o deshabilitados.",
    query: `-- TABLAS CON TRIGGERS EN LA BASE
SELECT
    s.name AS SchemaName,
    t.name AS TableName,
    COUNT(tr.object_id) AS TotalTriggers,
    SUM(CASE WHEN tr.is_disabled = 0 THEN 1 ELSE 0 END) AS Habilitados,
    SUM(CASE WHEN tr.is_disabled = 1 THEN 1 ELSE 0 END) AS Deshabilitados
FROM sys.triggers tr
INNER JOIN sys.tables t ON tr.parent_id = t.object_id
INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE tr.is_ms_shipped = 0
GROUP BY s.name, t.name
ORDER BY TableName;`,
  },
  {
    num: "3",
    title: "Deshabilitar todos los triggers",
    explanation: "Genera las sentencias ALTER TABLE … DISABLE TRIGGER ALL. Copiá las columnas del resultado (a + TABLA + b) y ejecutalas.",
    query: `/* DESHABILITAR — copiá columnas a + TABLA + b y ejecutá */
select
'ALTER TABLE ' as a,
TABLA = LTRIM(RTRIM(SO.name)),
'DISABLE TRIGGER ALL ' as b
from sysobjects as SO
left join sysobjects as SOdel on SO.deltrig = SOdel.id
left join sysobjects as SOins on SO.instrig = SOins.id
left join sysobjects as SOupd on SO.updtrig = SOupd.id
left join sysobjects as SOsel on SO.seltrig = SOsel.id
where (SO.deltrig <> 0 or SO.instrig <> 0 or SO.updtrig <> 0 or SO.seltrig <> 0)
and SO.xtype <> 'TR';`,
  },
  {
    num: "4",
    title: "Habilitar todos los triggers",
    explanation: "Genera las sentencias ALTER TABLE … ENABLE TRIGGER ALL para volver a habilitar los triggers deshabilitados.",
    query: `/* HABILITAR — copiá columnas a + TABLA + b y ejecutá */
select
'ALTER TABLE ' as a,
TABLA = LTRIM(RTRIM(SO.name)),
'ENABLE TRIGGER ALL ' as b
from sysobjects as SO
left join sysobjects as SOdel on SO.deltrig = SOdel.id
left join sysobjects as SOins on SO.instrig = SOins.id
left join sysobjects as SOupd on SO.updtrig = SOupd.id
left join sysobjects as SOsel on SO.seltrig = SOsel.id
where (SO.deltrig <> 0 or SO.instrig <> 0 or SO.updtrig <> 0 or SO.seltrig <> 0)
and SO.xtype <> 'TR';`,
  },
];

function triggersQueries(referralCfg) {
  const fromApi = referralCfg?.triggersSql;
  return fromApi?.length ? fromApi : TRIGGERS_SQL_FALLBACK;
}

function qSel(attr, value) {
  return `[${attr}="${CSS.escape(value)}"]`;
}

export function initReferralDialogs() {
  overlay = document.getElementById("plan-modal-overlay");
  modal = document.getElementById("plan-ref-modal");
  titleEl = document.getElementById("plan-modal-title");
  subtitleEl = document.getElementById("plan-modal-subtitle");
  bodyEl = document.getElementById("plan-modal-body");
  saveBtn = document.getElementById("plan-modal-save");
  closeBtn = document.getElementById("plan-modal-close");
  backBtn = document.getElementById("plan-modal-back");

  closeBtn?.addEventListener("click", () => finishDialog(false));
  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) finishDialog(false);
  });
  backBtn?.addEventListener("click", popNav);
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function optionCheck(attr, name, checked) {
  return `<label class="plan-opt-check">
    <input type="checkbox" ${attr}="${esc(name)}" ${checked ? "checked" : ""}/>
    <span class="plan-opt-check-ui"></span>
    <span class="plan-opt-check-text">${esc(name)}</span>
  </label>`;
}

function optionWell(inner) {
  return `<div class="plan-option-well">${inner}</div>`;
}

function setView({ accent, title, subtitle, width, acceptText, bodyHtml, tall }) {
  modal.dataset.accent = accent;
  const w = width || 680;
  modal.style.width = `min(94vw, ${w}px)`;
  modal.style.maxWidth = `${w}px`;
  bodyEl.classList.toggle("tall", !!tall);
  titleEl.textContent = title;
  if (subtitle) {
    subtitleEl.textContent = subtitle;
    subtitleEl.classList.remove("hidden");
  } else {
    subtitleEl.classList.add("hidden");
  }
  saveBtn.textContent = acceptText || "Aceptar";
  bodyEl.innerHTML = bodyHtml;
}

function snapshotView() {
  return {
    accent: modal.dataset.accent,
    title: titleEl.textContent,
    subtitle: subtitleEl.classList.contains("hidden") ? null : subtitleEl.textContent,
    width: parseInt(modal.style.maxWidth, 10) || 540,
    acceptText: saveBtn.textContent,
    bodyHtml: bodyEl.innerHTML,
    onMount: activeConfig?.onMount,
    onAccept: activeConfig?.onAccept,
  };
}

function activateView(config, { pop = false } = {}) {
  activeConfig = config;
  setView(config);
  config.onMount?.(bodyEl);
  saveBtn.onclick = () => {
    const result = config.onAccept?.(bodyEl);
    if (result === false) return;
    if (pop) popNav();
    else finishDialog(true, result);
  };
}

function pushNav() {
  navStack.push(snapshotView());
  backBtn?.classList.remove("hidden");
}

function popNav() {
  const prev = navStack.pop();
  if (!prev) return;
  activateView(prev, { pop: false });
  if (navStack.length === 0) backBtn?.classList.add("hidden");
}

function finishDialog(ok, value) {
  overlay?.classList.add("hidden");
  navStack = [];
  activeConfig = null;
  backBtn?.classList.add("hidden");
  const r = resolveDialog;
  resolveDialog = null;
  r?.(ok ? value : null);
}

function showDialog(config) {
  return new Promise((resolve) => {
    resolveDialog = resolve;
    navStack = [];
    backBtn?.classList.add("hidden");
    activateView(config);
    overlay?.classList.remove("hidden");
  });
}

function openSubView(config) {
  pushNav();
  activateView({ ...config, onAccept: () => popNav() });
}

function applyMamMutex(body) {
  const checks = [...body.querySelectorAll("[data-mam]")];
  const noMam = body.querySelector(qSel("data-mam", NO_MAM));
  const changed = checks.find((c) => c === document.activeElement) || checks.find((c) => c.matches(":focus"));
  const last = changed?.dataset.mam;

  if (last === NO_MAM && noMam?.checked) {
    checks.forEach((c) => { if (c.dataset.mam !== NO_MAM) c.checked = false; });
  } else if (last && last !== NO_MAM && body.querySelector(qSel("data-mam", last))?.checked) {
    if (noMam) noMam.checked = false;
  }

  const persCb = body.querySelector(qSel("data-mam", PERS_KEY));
  const persInput = body.querySelector("#ref-mam-pers");
  if (persInput) {
    const on = persCb?.checked === true;
    persInput.disabled = !on;
    persInput.closest(".plan-opt-field-indent")?.classList.toggle("disabled", !on);
  }
}

function applySdkMutex(body) {
  const checks = [...body.querySelectorAll("[data-sdk]")];
  const noSdk = body.querySelector(qSel("data-sdk", NO_SDK));
  const changed = checks.find((c) => c === document.activeElement);
  const last = changed?.dataset.sdk;

  if (last === NO_SDK && noSdk?.checked) {
    checks.forEach((c) => { if (c.dataset.sdk !== NO_SDK) c.checked = false; });
  } else if (last && last !== NO_SDK && body.querySelector(qSel("data-sdk", last))?.checked) {
    if (noSdk) noSdk.checked = false;
  }
}

function readMamFromBody(body, opts) {
  const selections = {};
  opts.forEach((o) => {
    selections[o] = body.querySelector(qSel("data-mam", o))?.checked === true;
  });
  if (selections[NO_MAM]) {
    opts.forEach((o) => { if (o !== NO_MAM) selections[o] = false; });
  }
  return {
    selections,
    persActu: body.querySelector("#ref-mam-pers")?.value.trim() || "",
  };
}

function readSdkFromBody(body, opts) {
  const selections = {};
  opts.forEach((o) => {
    selections[o] = body.querySelector(qSel("data-sdk", o))?.checked === true;
  });
  if (selections[NO_SDK]) {
    opts.forEach((o) => { if (o !== NO_SDK) selections[o] = false; });
  }
  return {
    selections,
    app: body.querySelector("#ref-sdk-app")?.value.trim() || "",
  };
}

function mamHasSelection(selections) {
  return Object.values(selections).some(Boolean);
}

function renderSqlTriggerCards(queries) {
  return (queries || []).map((q) => `
    <div class="plan-sql-card">
      <div class="plan-sql-card-head">
        <span class="plan-sql-num">${esc(q.num)}</span>
        <strong>${esc(q.title)}</strong>
      </div>
      <p class="plan-modal-hint">${esc(q.explanation)}</p>
      <textarea class="plan-sql-code" readonly rows="8">${esc(q.query)}</textarea>
      <button type="button" class="plan-sql-copy">Copiar consulta</button>
    </div>`).join("");
}

function renderSqlTriggersBody(queries) {
  const hint = `<p class="plan-modal-hint">Consultas listas para SQL Server. Copiá la que necesites y ejecutala en la base del cliente. IsDisabled: 0 = habilitado, 1 = deshabilitado.</p>`;
  return hint + renderSqlTriggerCards(queries);
}

function bindSqlCopy(body) {
  body.querySelectorAll(".plan-sql-copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const query = btn.closest(".plan-sql-card")?.querySelector(".plan-sql-code")?.value || "";
      try {
        await navigator.clipboard.writeText(query);
        const orig = btn.textContent;
        btn.textContent = "¡Copiado!";
        btn.disabled = true;
        setTimeout(() => {
          btn.textContent = orig;
          btn.disabled = false;
        }, 1800);
      } catch {
        btn.textContent = "No se pudo copiar";
      }
    });
  });
}

function openSqlTriggersNav(referralCfg) {
  openSubView({
    accent: "mam",
    title: "Triggers — consultas SQL",
    subtitle: "Consultar · tablas · deshabilitar · habilitar",
    width: 820,
    tall: true,
    acceptText: "Cerrar",
    bodyHtml: renderSqlTriggersBody(triggersQueries(referralCfg)),
    onMount: bindSqlCopy,
  });
}

function renderMamSqlSection(referralCfg) {
  return `<div id="ref-mam-sql-section" class="plan-mam-sql-section">
    <div class="plan-mam-sql-head">
      <h4 class="plan-modal-section">Consultas SQL — Triggers</h4>
      <button type="button" id="ref-mam-sql-expand" class="plan-sql-expand-btn">Vista ampliada</button>
    </div>
    <p class="plan-modal-hint">Consultas listas para SQL Server. Copiá la que necesites y ejecutala en la base del cliente. IsDisabled: 0 = habilitado, 1 = deshabilitado.</p>
    ${renderSqlTriggerCards(triggersQueries(referralCfg))}
  </div>`;
}

export async function runMamDialog(referralCfg, { mamState, mamPersActu, mamTriggers }) {
  const opts = referralCfg?.mamOpciones || [];
  let triggers = mamTriggers || "";

  const buildMamBody = () => {
    let options = "";
    opts.forEach((o) => {
      if (o === NO_MAM) options += `<div class="plan-opt-divider"></div>`;
      options += optionCheck("data-mam", o, !!mamState[o]);
      if (o === PERS_KEY) {
        options += `<div class="plan-opt-field-indent">
          <label class="plan-opt-field-label" for="ref-mam-pers">Nombre PERS/ACTU</label>
          <input id="ref-mam-pers" type="text" class="plan-opt-input" value="${esc(mamPersActu)}" placeholder="Nombre de la personalización"/>
        </div>`;
      }
    });

    const sqlBtn = `<button type="button" id="ref-mam-sql-btn" class="plan-tool-card mam">
      <span class="plan-tool-icon mam">SQL</span>
      <span class="plan-tool-texts">
        <strong>Ir a consultas SQL para triggers</strong>
        <span>Desplazá hacia abajo o abrí la vista ampliada</span>
      </span>
      <span class="plan-tool-arrow">↓</span>
    </button>`;

    return `<p class="plan-modal-hint">Marcá las opciones que correspondan. «No utiliza MAM» desmarca el resto.</p>
      ${optionWell(options)}
      ${sqlBtn}
      ${renderMamSqlSection(referralCfg)}`;
  };

  const mountMam = (body) => {
    body.querySelectorAll("[data-mam]").forEach((cb) => {
      cb.addEventListener("change", () => applyMamMutex(body));
    });
    applyMamMutex(body);
    bindSqlCopy(body);
    body.querySelector("#ref-mam-sql-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      const section = body.querySelector("#ref-mam-sql-section");
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
        section.classList.add("highlight");
        setTimeout(() => section.classList.remove("highlight"), 1200);
      } else {
        openSqlTriggersNav(referralCfg);
      }
    });
    body.querySelector("#ref-mam-sql-expand")?.addEventListener("click", (e) => {
      e.preventDefault();
      openSqlTriggersNav(referralCfg);
    });
  };

  const result = await showDialog({
    accent: "mam",
    title: "Opciones de MAM",
    subtitle: "Modificaciones a Medida",
    width: 680,
    tall: true,
    acceptText: "Aceptar",
    bodyHtml: buildMamBody(),
    onMount: mountMam,
    onAccept: (body) => readMamFromBody(body, opts),
  });

  if (!result) return null;

  let { selections, persActu } = result;
  if (!mamHasSelection(selections)) return null;

  if (selections[TIENE_TRIGGERS] && !triggers) {
    const tr = await showDialog({
      accent: "mam",
      title: "Triggers desactivados",
      subtitle: "Detalle para incluir en el texto generado",
      width: 560,
      acceptText: "Aceptar",
      bodyHtml: `<label class="plan-opt-field-label" for="ref-mam-triggers">¿Se desactivaron triggers? Indique cuáles:</label>
        <textarea id="ref-mam-triggers" class="plan-opt-textarea" rows="5" placeholder="Listá los triggers desactivados…">${esc(triggers)}</textarea>`,
      onAccept: (body) => body.querySelector("#ref-mam-triggers")?.value.trim() || "",
    });
    if (tr !== null) triggers = tr;
  }

  return { mamState: selections, mamPersActu: persActu, mamTriggers: triggers };
}

export async function runSdkDialog(referralCfg, { sdkState, sdkApp }) {
  const opts = referralCfg?.sdkOpciones || [];

  const buildBody = () => {
    let options = "";
    opts.forEach((o) => {
      if (o === NO_SDK) options += `<div class="plan-opt-divider"></div>`;
      options += optionCheck("data-sdk", o, !!sdkState[o]);
    });
    return `${optionWell(options)}
      <div class="plan-opt-divider"></div>
      <div class="plan-opt-centered">
        <label class="plan-opt-field-label" for="ref-sdk-app">¿Qué aplicación utilizan para la integración?</label>
        <input id="ref-sdk-app" type="text" class="plan-opt-input wide" value="${esc(sdkApp)}" placeholder="Nombre de la aplicación"/>
      </div>`;
  };

  const result = await showDialog({
    accent: "sdk",
    title: "Opciones de SDK",
    subtitle: "Integraciones y desarrollo a medida",
    width: 640,
    tall: true,
    acceptText: "Aceptar",
    bodyHtml: buildBody(),
    onMount: (body) => {
      body.querySelectorAll("[data-sdk]").forEach((cb) => {
        cb.addEventListener("change", () => applySdkMutex(body));
      });
    },
    onAccept: (body) => readSdkFromBody(body, opts),
  });

  if (!result) return null;
  if (!Object.values(result.selections).some(Boolean)) return null;
  return { sdkState: result.selections, sdkApp: result.app };
}

export async function runPlanillaDialog(planillaState) {
  const s = planillaState;
  const required = [
    ["pl-proceso", "El proceso funcionaba correctamente", s.procesoFuncionaba],
    ["pl-reproduce", "Se pudo reproducir el error", s.reproduceError],
    ["pl-ultima", "Última actualización aplicada correctamente", s.ultimaActualizOk],
  ];
  const optional = [
    ["pl-relevada", "¿Se relevó planilla técnica?", s.relevada],
    ["pl-vinculos", "Se actualizaron vínculos", s.optVinculos],
    ["pl-modelo", "Se pudo reproducir en la base MODELO", s.optBaseModelo],
    ["pl-solo", "Solo ocurre en la base del cliente", s.optSoloCliente],
    ["pl-sist", "El cliente lo reproduce sistemáticamente", s.optReproduceSistematicamente],
  ];

  const renderChecks = (items) => items.map(([id, label, on]) =>
    `<label class="plan-opt-check">
      <input type="checkbox" id="${id}" ${on ? "checked" : ""}/>
      <span class="plan-opt-check-ui"></span>
      <span class="plan-opt-check-text">${esc(label)}</span>
    </label>`).join("");

  const bodyHtml = `<p class="plan-modal-hint">Completá los ítems obligatorios. Los opcionales suman detalle al referral.</p>
    <h4 class="plan-modal-section">Obligatorio</h4>
    ${optionWell(renderChecks(required))}
    <h4 class="plan-modal-section">Opcional</h4>
    ${optionWell(renderChecks(optional))}`;

  const result = await showDialog({
    accent: "planilla",
    title: "Planilla técnica",
    subtitle: "Relevamiento y comprobaciones del caso",
    width: 680,
    tall: true,
    acceptText: "Aceptar",
    bodyHtml,
    onAccept: () => ({
      relevada: document.getElementById("pl-relevada")?.checked === true,
      procesoFuncionaba: document.getElementById("pl-proceso")?.checked === true,
      reproduceError: document.getElementById("pl-reproduce")?.checked === true,
      ultimaActualizOk: document.getElementById("pl-ultima")?.checked === true,
      optVinculos: document.getElementById("pl-vinculos")?.checked === true,
      optBaseModelo: document.getElementById("pl-modelo")?.checked === true,
      optSoloCliente: document.getElementById("pl-solo")?.checked === true,
      optReproduceSistematicamente: document.getElementById("pl-sist")?.checked === true,
    }),
  });

  return result || null;
}
