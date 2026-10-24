import { createCodeSlots, groupsFromEnumeration } from "./st2-code-slots.js?v=20261023g";

const API = "/api/cryptic";
const STATE_LABELS = {
  available: "Disponible",
  solved: "Resuelto",
  blocked: "Bloqueado",
  upcoming: "Próximamente",
  closed: "Cerrado",
  failed: "Sin intentos",
};

let host = null;
let snapshot = null;
let selectedSlot = null;
let hintLevel = 0;
let hintSlot = null;
let hintPending = false;
let rankingOpen = false;
let refreshTimer = 0;
let initialized = false;
let submitting = false;
let pendingFocus = false;
let statusNote = "";
let statusTone = "";
const draftBySlot = new Map();
let activeSlots = null;

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

async function loadStatus({ quiet = false } = {}) {
  if (!host || document.hidden) return;
  if (!quiet) host.setAttribute("aria-busy", "true");
  try {
    const response = await fetch(`${API}/status`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await readProblem(response));
    snapshot = await response.json();
    if (submitting) {
      scheduleRefresh();
      return;
    }
    const rounds = snapshot?.rounds || [];
    if (!rounds.some((round) => round.slot === selectedSlot)) {
      selectedSlot = rounds.find((round) => round.state === "available")?.slot
        ?? rounds.find((round) => round.state === "solved")?.slot
        ?? rounds[0]?.slot
        ?? null;
    }
    if (rounds.some((round) => round.state === "available" && round.slot !== selectedSlot)) {
      const selected = rounds.find((round) => round.slot === selectedSlot);
      if (!selected || selected.state === "upcoming" || selected.state === "blocked") {
        selectedSlot = rounds.find((round) => round.state === "available")?.slot ?? selectedSlot;
      }
    }
    render();
    const pending = (snapshot?.rounds || []).some((round) => round.state === "available");
    document.dispatchEvent(new CustomEvent("st2:cryptic-pending", { detail: { pending } }));
    scheduleRefresh();
  } catch (error) {
    if (!quiet) renderError(error?.message || "No se pudo cargar el Críptico.");
  } finally {
    host?.removeAttribute("aria-busy");
  }
}

function scheduleRefresh() {
  window.clearTimeout(refreshTimer);
  if (!snapshot?.nextAt) return;
  const delay = Math.max(5000, Math.min(30 * 60 * 1000, new Date(snapshot.nextAt).getTime() - Date.now() + 1200));
  refreshTimer = window.setTimeout(() => void loadStatus({ quiet: true }), delay);
}

function getSelectedRound() {
  const rounds = snapshot?.rounds || [];
  return rounds.find((round) => round.slot === selectedSlot)
    || rounds.find((round) => round.state === "available")
    || rounds[0]
    || null;
}

function difficultyLabel(value) {
  if (value >= 3) return "Difícil";
  if (value === 2) return "Intermedio";
  return "Entrada";
}

function roundIcon(state) {
  if (state === "solved") return "✓";
  if (state === "available") return "●";
  if (state === "failed") return "×";
  return "○";
}

function render() {
  if (!host || !snapshot || submitting) return;
  const round = getSelectedRound();
  if (round) {
    const revealed = Number(round.hintsUsed || 0);
    if (hintSlot !== round.slot) {
      hintSlot = round.slot;
      hintLevel = revealed;
    } else {
      hintLevel = Math.max(hintLevel, revealed);
    }
  }
  const rounds = snapshot.rounds || [];
  const ranking = snapshot.ranking || [];
  const dateLabel = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${snapshot.date}T12:00:00-03:00`));

  activeSlots?.destroy();
  activeSlots = null;
  host.innerHTML = `
    <div class="st2-cryptic-head">
      <div>
        <span class="st2-cryptic-kicker">Desafío diario</span>
        <h2 id="st2-cryptic-title">Críptico ST²</h2>
        <p>${escapeHtml(dateLabel)}</p>
      </div>
      <button type="button" class="st2-cryptic-rank-toggle" data-cryptic-action="ranking" aria-expanded="${rankingOpen ? "true" : "false"}">
        Ranking <span>${ranking.length}</span>
      </button>
    </div>
    <div class="st2-cryptic-rounds" role="tablist" aria-label="Rondas del Críptico" style="grid-template-columns: repeat(${rounds.length}, minmax(0, 1fr))">
      ${rounds.map((item) => `
        <button type="button"
          class="st2-cryptic-round ${item.slot === round?.slot ? "is-active" : ""} is-${escapeHtml(item.state)}"
          role="tab"
          aria-selected="${item.slot === round?.slot ? "true" : "false"}"
          data-cryptic-slot="${item.slot}">
          <span aria-hidden="true">${roundIcon(item.state)}</span>
          <strong>${escapeHtml(item.label)}</strong>
          <small>${escapeHtml(STATE_LABELS[item.state] || item.state)}</small>
        </button>
      `).join("")}
    </div>
    <div class="st2-cryptic-body">
      ${renderRound(round)}
    </div>
    <div class="st2-cryptic-ranking ${rankingOpen ? "" : "hidden"}" data-cryptic-ranking ${rankingOpen ? "" : "hidden"}>
      <div class="st2-cryptic-ranking-head">
        <strong>Ranking de hoy</strong>
        <small>10 por ronda · 25 si completás las dos · −1 por pista</small>
      </div>
      ${ranking.length ? `
        <ol>
          ${ranking.map((item) => `
            <li>
              <span class="st2-cryptic-rank-pos">${item.rank}</span>
              <span class="st2-cryptic-rank-player">${escapeHtml(item.player)}</span>
              <span class="st2-cryptic-rank-meta">${item.wins} victoria${item.wins === 1 ? "" : "s"}</span>
              <strong>${item.points} pt${item.points === 1 ? "" : "s"}</strong>
            </li>
          `).join("")}
        </ol>
      ` : `<p class="st2-cryptic-empty">Todavía nadie sumó puntos.</p>`}
    </div>
  `;
  mountAnswerSlots(round);
}

function renderRound(round) {
  if (!round) return `<p class="st2-cryptic-empty">No hay rondas programadas.</p>`;

  if (round.state === "upcoming") {
    return renderNotice("Todavía no abrió", `Esta ronda empieza a las ${round.label}.`);
  }
  if (round.state === "blocked") {
    return renderNotice("Está bloqueada", "Resolvé las rondas anteriores para desbloquearla.");
  }
  if (round.state === "closed") {
    return renderNotice("Nueva jornada", "El Críptico siguiente empieza a las 09:00.");
  }

  const solved = round.state === "solved";
  const failed = round.state === "failed";
  const clue = escapeHtml(clueWithoutCount(round.clue, round.enumeration));
  const letterCount = groupsFromEnumeration(round.enumeration).reduce((sum, count) => sum + count, 0);
  const attempts = round.attemptsRemaining;
  const note = statusNote || (letterCount
    ? `Te quedan ${attempts} intento${attempts === 1 ? "" : "s"}. Tocá Comprobar cuando esté lista.`
    : "");
  const tone = statusNote ? statusTone : "";
  return `
    <blockquote class="st2-cryptic-clue">${clue} <b>${escapeHtml(round.enumeration || "")}</b></blockquote>
    ${solved ? renderSolution(round) : failed ? `
      <div class="st2-cryptic-notice is-failed">
        <strong>Se terminaron los intentos</strong>
        <p>La explicación se revela sólo al resolver. Mañana hay revancha.</p>
      </div>
    ` : `
      <form class="st2-cryptic-form" data-cryptic-form>
        <label for="st2-cryptic-answer">Tu respuesta</label>
        <div class="st2-cryptic-answer-row">
          <div data-code-slots></div>
          <button type="submit" class="st2-cryptic-check" data-cryptic-check disabled>Comprobar</button>
        </div>
        <p class="st2-cryptic-status ${tone}" data-cryptic-status role="status" aria-live="polite">${escapeHtml(note)}</p>
      </form>
      ${renderHints(round)}
    `}
  `;
}

function clueWithoutCount(clue, enumeration) {
  const text = String(clue || "").trim();
  const mark = String(enumeration || "").trim();
  if (mark && text.endsWith(mark)) return text.slice(0, -mark.length).trim();
  return text.replace(/\s*\(\d[\d,\s]*\)\s*$/, "").trim();
}

function renderNotice(title, body) {
  return `
    <div class="st2-cryptic-notice">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
    </div>
  `;
}

function renderHints(round) {
  const rows = [];
  if (hintLevel >= 1) rows.push(`<li><b>Definición:</b> ${escapeHtml(round.definition)}</li>`);
  if (hintLevel >= 2) rows.push(`<li><b>Mecanismo:</b> ${escapeHtml(round.mechanism)}</li>`);
  if (hintLevel >= 3) rows.push(`<li><b>Indicador:</b> ${escapeHtml(round.indicator || "sin indicador explícito")}</li>`);
  if (hintLevel >= 4) rows.push(`<li><b>Material:</b> ${escapeHtml(round.fodder)}</li>`);
  return `
    <div class="st2-cryptic-hints">
      <button type="button" data-cryptic-action="hint" ${hintLevel >= 4 ? "disabled" : ""}>
        ${hintLevel === 0 ? "Necesito una pista" : hintLevel >= 4 ? "Todas las ayudas reveladas" : "Revelar otra ayuda"}
      </button>
      ${rows.length ? `<ul>${rows.join("")}</ul>` : ""}
    </div>
  `;
}

function renderSolution(round) {
  return `
    <div class="st2-cryptic-solution">
      <div class="st2-cryptic-answer">
        <span>Respuesta</span>
        <strong>${escapeHtml(round.answer)}</strong>
        <small>+${round.points} punto${round.points === 1 ? "" : "s"}</small>
      </div>
      <dl>
        <div><dt>Definición</dt><dd>${escapeHtml(round.definition)}</dd></div>
        <div><dt>Mecanismo</dt><dd>${escapeHtml(round.mechanism)}</dd></div>
        ${round.indicator ? `<div><dt>Indicador</dt><dd>${escapeHtml(round.indicator)}</dd></div>` : ""}
        <div><dt>Material</dt><dd>${escapeHtml(round.fodder)}</dd></div>
      </dl>
      <p class="st2-cryptic-parse">${escapeHtml(round.parse)}</p>
    </div>
  `;
}

function mountAnswerSlots(round) {
  const container = host?.querySelector("[data-code-slots]");
  if (!container || !round || round.state === "solved" || round.state === "failed") return;
  const groups = groupsFromEnumeration(round.enumeration);
  const letterCount = groups.reduce((sum, count) => sum + count, 0);
  const hint = letterCount
    ? `Te quedan ${round.attemptsRemaining} intento${round.attemptsRemaining === 1 ? "" : "s"}. Tocá Comprobar cuando esté lista.`
    : "";
  const shouldFocus = pendingFocus;
  pendingFocus = false;
  const check = host?.querySelector("[data-cryptic-check]");
  const syncCheck = (code) => {
    if (!check || !activeSlots) return;
    check.disabled = String(code || "").length !== activeSlots.length;
  };
  activeSlots = createCodeSlots(container, {
    groups: groups.length ? groups : [8],
    initial: draftBySlot.get(round.slot) || "",
    autoFocus: shouldFocus,
    onChange: (code) => {
      draftBySlot.set(round.slot, code);
      syncCheck(code);
      if (!statusNote) return;
      statusNote = "";
      statusTone = "";
      const status = host?.querySelector("[data-cryptic-status]");
      if (!status) return;
      status.textContent = hint;
      status.className = "st2-cryptic-status";
    },
  });
  syncCheck(activeSlots.value());
}

async function submitAttempt(form) {
  const round = getSelectedRound();
  const status = form.querySelector("[data-cryptic-status]");
  const answer = activeSlots?.value()?.trim() || "";
  if (!round || !activeSlots || answer.length !== activeSlots.length || submitting) return;

  submitting = true;
  activeSlots.setBusy(true);
  statusNote = "Comprobando…";
  statusTone = "";
  if (status) {
    status.textContent = statusNote;
    status.className = "st2-cryptic-status";
  }

  try {
    const response = await fetch(`${API}/attempt`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot: round.slot, answer }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error || `Error ${response.status}`);
    snapshot = body.status || snapshot;
    hintLevel = 0;
    draftBySlot.delete(round.slot);
    if (!body.correct) {
      await activeSlots.fail();
      statusNote = body.message || "Esa no es.";
      statusTone = "is-error";
      pendingFocus = true;
      return;
    }
    statusNote = "";
    statusTone = "";
    await activeSlots.succeed();
  } catch (error) {
    statusNote = error?.message || "No se pudo comprobar.";
    statusTone = "is-error";
    pendingFocus = true;
  } finally {
    submitting = false;
    render();
    const solution = host?.querySelector(".st2-cryptic-solution");
    solution?.classList.add("is-revealed");
  }
}

async function revealHint() {
  const round = getSelectedRound();
  if (!round || hintLevel >= 4 || hintPending) return;
  hintPending = true;
  try {
    const response = await fetch(`${API}/hint`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot: round.slot }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error || `Error ${response.status}`);
    hintSlot = round.slot;
    hintLevel = Number(body.level || hintLevel + 1);
    render();
  } catch (error) {
    statusNote = error?.message || "No se pudo revelar la pista.";
    statusTone = "is-error";
    render();
  } finally {
    hintPending = false;
  }
}

function renderError(message) {
  if (!host) return;
  host.innerHTML = `
    <div class="st2-cryptic-notice is-failed">
      <strong>Críptico no disponible</strong>
      <p>${escapeHtml(message)}</p>
      <button type="button" data-cryptic-action="retry">Reintentar</button>
    </div>
  `;
}

function bindHostEvents() {
  host?.addEventListener("click", (event) => {
    const roundButton = event.target.closest("[data-cryptic-slot]");
    if (roundButton) {
      selectedSlot = Number(roundButton.dataset.crypticSlot);
      hintLevel = 0;
      hintSlot = null;
      statusNote = "";
      statusTone = "";
      render();
      return;
    }

    const action = event.target.closest("[data-cryptic-action]")?.dataset.crypticAction;
    if (action === "hint") {
      void revealHint();
    } else if (action === "ranking") {
      rankingOpen = !rankingOpen;
      render();
    } else if (action === "retry") {
      void loadStatus();
    }
  });

  host?.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-cryptic-form]");
    if (!form) return;
    event.preventDefault();
    void submitAttempt(form);
  });
}

export function initDailyCryptic() {
  if (initialized) return;
  host = document.getElementById("st2-cryptic");
  if (!host) return;
  initialized = true;
  bindHostEvents();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void loadStatus({ quiet: true });
  });
  document.addEventListener("st2:session-changed", () => {
    snapshot = null;
    selectedSlot = null;
    hintLevel = 0;
    hintSlot = null;
    rankingOpen = false;
    void loadStatus();
  });
  void loadStatus();
}
