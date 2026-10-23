const API = "/api/cryptic/admin/clues";

let initialized = false;
let items = [];
let loading = false;

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

async function readProblem(response) {
  const body = await response.json().catch(() => ({}));
  return body?.error || body?.detail || `Error ${response.status}`;
}

function formElement() {
  return byId("st2-cryptic-admin-form");
}

function setFormOpen(open) {
  const form = formElement();
  form?.classList.toggle("hidden", !open);
  form?.toggleAttribute("hidden", !open);
  if (open) byId("st2-cryptic-admin-clue")?.focus();
}

function clearForm() {
  const values = {
    "st2-cryptic-admin-id": "",
    "st2-cryptic-admin-clue": "",
    "st2-cryptic-admin-answer": "",
    "st2-cryptic-admin-enumeration": "",
    "st2-cryptic-admin-definition": "",
    "st2-cryptic-admin-mechanism": "",
    "st2-cryptic-admin-indicator": "",
    "st2-cryptic-admin-fodder": "",
    "st2-cryptic-admin-wordplay": "",
    "st2-cryptic-admin-parse": "",
    "st2-cryptic-admin-aliases": "",
  };
  Object.entries(values).forEach(([id, value]) => {
    const input = byId(id);
    if (input) input.value = value;
  });
  const difficulty = byId("st2-cryptic-admin-difficulty");
  if (difficulty) difficulty.value = "1";
  const reviewed = byId("st2-cryptic-admin-reviewed");
  const active = byId("st2-cryptic-admin-active");
  if (reviewed) reviewed.checked = false;
  if (active) active.checked = true;
  const status = byId("st2-cryptic-admin-status");
  if (status) status.textContent = "";
}

function fillForm(item) {
  const values = {
    "st2-cryptic-admin-id": item.id,
    "st2-cryptic-admin-clue": item.clue,
    "st2-cryptic-admin-answer": item.answer,
    "st2-cryptic-admin-enumeration": item.enumeration,
    "st2-cryptic-admin-definition": item.definition,
    "st2-cryptic-admin-mechanism": item.mechanism,
    "st2-cryptic-admin-indicator": item.indicator,
    "st2-cryptic-admin-fodder": item.fodder,
    "st2-cryptic-admin-wordplay": item.wordplay,
    "st2-cryptic-admin-parse": item.parse,
    "st2-cryptic-admin-aliases": (item.acceptedAnswers || []).join(", "),
  };
  Object.entries(values).forEach(([id, value]) => {
    const input = byId(id);
    if (input) input.value = value ?? "";
  });
  byId("st2-cryptic-admin-difficulty").value = String(item.difficulty || 1);
  byId("st2-cryptic-admin-reviewed").checked = !!item.reviewed;
  byId("st2-cryptic-admin-active").checked = !!item.active;
  setFormOpen(true);
}

function readForm() {
  const aliases = byId("st2-cryptic-admin-aliases").value
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const id = Number(byId("st2-cryptic-admin-id").value || 0);
  return {
    id: id || null,
    clue: byId("st2-cryptic-admin-clue").value.trim(),
    answer: byId("st2-cryptic-admin-answer").value.trim(),
    enumeration: byId("st2-cryptic-admin-enumeration").value.trim(),
    definition: byId("st2-cryptic-admin-definition").value.trim(),
    mechanism: byId("st2-cryptic-admin-mechanism").value.trim(),
    indicator: byId("st2-cryptic-admin-indicator").value.trim(),
    fodder: byId("st2-cryptic-admin-fodder").value.trim(),
    wordplay: byId("st2-cryptic-admin-wordplay").value.trim(),
    parse: byId("st2-cryptic-admin-parse").value.trim(),
    difficulty: Number(byId("st2-cryptic-admin-difficulty").value || 1),
    acceptedAnswers: aliases,
    reviewed: byId("st2-cryptic-admin-reviewed").checked,
    active: byId("st2-cryptic-admin-active").checked,
  };
}

function difficultyLabel(value) {
  if (value >= 3) return "Difícil";
  if (value === 2) return "Intermedia";
  return "Entrada";
}

function render() {
  const list = byId("st2-cryptic-admin-list");
  const summary = byId("st2-cryptic-admin-summary");
  if (!list || !summary) return;
  const query = (byId("st2-cryptic-admin-search")?.value || "").trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (!query) return true;
    return `${item.clue} ${item.answer} ${item.mechanism} ${item.definition}`.toLowerCase().includes(query);
  });
  const reviewed = items.filter((item) => item.reviewed && item.active).length;
  summary.textContent = `${items.length} pistas · ${reviewed} revisadas y activas`;

  if (!filtered.length) {
    list.innerHTML = `<p class="st2-cryptic-admin-empty">No hay pistas que coincidan.</p>`;
    return;
  }

  list.innerHTML = filtered.map((item) => `
    <article class="st2-cryptic-admin-item ${item.active ? "" : "is-inactive"}">
      <div class="st2-cryptic-admin-item-main">
        <div class="st2-cryptic-admin-item-badges">
          <span>D${item.difficulty} · ${difficultyLabel(item.difficulty)}</span>
          <span>${escapeHtml(item.mechanism)}</span>
          <span class="${item.reviewed ? "is-reviewed" : "is-pending"}">${item.reviewed ? "Revisada" : "Borrador"}</span>
          ${item.active ? "" : "<span>Inactiva</span>"}
        </div>
        <strong>${escapeHtml(item.clue)} ${escapeHtml(item.enumeration)}</strong>
        <p><b>${escapeHtml(item.answer)}</b> · ${escapeHtml(item.parse)}</p>
      </div>
      <button type="button" data-cryptic-admin-edit="${item.id}" aria-label="Editar pista">Editar</button>
    </article>
  `).join("");
}

async function save(event) {
  event.preventDefault();
  const status = byId("st2-cryptic-admin-status");
  const submit = formElement()?.querySelector("button[type='submit']");
  if (status) status.textContent = "Guardando…";
  if (submit) submit.disabled = true;
  try {
    const response = await fetch(API, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(readForm()),
    });
    if (!response.ok) throw new Error(await readProblem(response));
    clearForm();
    setFormOpen(false);
    await loadCrypticAdminClues();
  } catch (error) {
    if (status) status.textContent = error?.message || "No se pudo guardar.";
  } finally {
    if (submit) submit.disabled = false;
  }
}

export async function loadCrypticAdminClues() {
  if (loading) return;
  loading = true;
  const summary = byId("st2-cryptic-admin-summary");
  if (summary) summary.textContent = "Cargando pistas…";
  try {
    const response = await fetch(API, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await readProblem(response));
    const body = await response.json();
    items = body?.items || [];
    render();
  } catch (error) {
    if (summary) summary.textContent = error?.message || "No se pudo cargar el banco.";
  } finally {
    loading = false;
  }
}

export function initCrypticAdmin() {
  if (initialized || !byId("st2-cryptic-admin-list")) return;
  initialized = true;
  byId("st2-cryptic-admin-new")?.addEventListener("click", () => {
    clearForm();
    setFormOpen(true);
  });
  byId("st2-cryptic-admin-cancel")?.addEventListener("click", () => {
    clearForm();
    setFormOpen(false);
  });
  byId("st2-cryptic-admin-search")?.addEventListener("input", render);
  formElement()?.addEventListener("submit", save);
  byId("st2-cryptic-admin-list")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cryptic-admin-edit]");
    if (!button) return;
    const item = items.find((entry) => entry.id === Number(button.dataset.crypticAdminEdit));
    if (item) fillForm(item);
  });
}
