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
let rankingOpen = false;
let refreshTimer = 0;
let initialized = false;

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
  if (!host || !snapshot) return;
  const round = getSelectedRound();
  const rounds = snapshot.rounds || [];
  const ranking = snapshot.ranking || [];
  const dateLabel = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${snapshot.date}T12:00:00-03:00`));

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
    <div class="st2-cryptic-rounds" role="tablist" aria-label="Rondas del Críptico">
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
        <small>10 · 7 · 5 · 1 puntos por orden de llegada</small>
      </div>
      ${ranking.length ? `
        <ol>
          ${ranking.map((item) => `
            <li>
              <span class="st2-cryptic-rank-pos">${item.rank}</span>
              <span class="st2-cryptic-rank-player">${escapeHtml(item.player)}</span>
              <span class="st2-cryptic-rank-meta">${item.solved}/3 · ${item.wins} victoria${item.wins === 1 ? "" : "s"}</span>
              <strong>${item.points} pt${item.points === 1 ? "" : "s"}</strong>
            </li>
          `).join("")}
        </ol>
      ` : `<p class="st2-cryptic-empty">Todavía nadie sumó puntos.</p>`}
    </div>
  `;
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
    return renderNotice("La competencia cerró", "Mañana a las 08:00 empieza un Críptico nuevo.");
  }

  const solved = round.state === "solved";
  const failed = round.state === "failed";
  const clue = escapeHtml(round.clue || "");
  const attempts = `${round.attemptsRemaining} intento${round.attemptsRemaining === 1 ? "" : "s"}`;
  return `
    <div class="st2-cryptic-clue-meta">
      <span>${difficultyLabel(round.difficulty)}</span>
      <span>${escapeHtml(round.enumeration || "")}</span>
      ${solved && round.position ? `<span>puesto ${round.position}</span>` : `<span>${attempts}</span>`}
    </div>
    <blockquote class="st2-cryptic-clue">${clue} <b>${escapeHtml(round.enumeration || "")}</b></blockquote>
    ${solved ? renderSolution(round) : failed ? `
      <div class="st2-cryptic-notice is-failed">
        <strong>Se terminaron los intentos</strong>
        <p>La explicación se revela sólo al resolver. Mañana hay revancha.</p>
      </div>
    ` : `
      <form class="st2-cryptic-form" data-cryptic-form>
        <label for="st2-cryptic-answer">Tu respuesta</label>
        <div>
          <input id="st2-cryptic-answer" name="answer" type="text" autocomplete="off"
            autocapitalize="characters" spellcheck="false" maxlength="80" required/>
          <button type="submit">Probar</button>
        </div>
        <p class="st2-cryptic-status" data-cryptic-status role="status" aria-live="polite"></p>
      </form>
      ${renderHints(round)}
    `}
  `;
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

async function submitAttempt(form) {
  const round = getSelectedRound();
  const input = form.querySelector("input[name='answer']");
  const button = form.querySelector("button[type='submit']");
  const status = form.querySelector("[data-cryptic-status]");
  const answer = input?.value?.trim() || "";
  if (!round || !answer || !button) return;

  button.disabled = true;
  input.disabled = true;
  if (status) {
    status.textContent = "Comprobando…";
    status.classList.remove("is-error", "is-success");
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
    snapshot = body.status;
    hintLevel = 0;
    if (!body.correct) {
      render();
      const freshStatus = host?.querySelector("[data-cryptic-status]");
      const freshInput = host?.querySelector("input[name='answer']");
      if (freshStatus) {
        freshStatus.textContent = body.message;
        freshStatus.classList.add("is-error");
      }
      freshInput?.focus();
      return;
    }
    render();
    const solution = host?.querySelector(".st2-cryptic-solution");
    solution?.classList.add("is-revealed");
  } catch (error) {
    if (status) {
      status.textContent = error?.message || "No se pudo comprobar.";
      status.classList.add("is-error");
    }
    button.disabled = false;
    input.disabled = false;
    input.focus();
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
      render();
      return;
    }

    const action = event.target.closest("[data-cryptic-action]")?.dataset.crypticAction;
    if (action === "hint") {
      hintLevel = Math.min(4, hintLevel + 1);
      render();
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
    rankingOpen = false;
    void loadStatus();
  });
  void loadStatus();
}
