import { createCodeSlots, groupsFromEnumeration } from "./st2-code-slots.js?v=20261023i";

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
let hintPending = false;
const HINT_ORDER = [
  { bit: 1, kind: "definition" },
  { bit: 2, kind: "mechanism" },
  { bit: 4, kind: "indicator" },
  { bit: 8, kind: "fodder" },
];
let rankingOpen = false;
let rankingTab = "today";
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
  const rounds = snapshot.rounds || [];
  const ranking = snapshot.ranking || [];
  const ranked = snapshot.ranked !== false;
  const weekend = snapshot.phase === "weekend";
  const weekday = new Date(`${snapshot.date}T12:00:00-03:00`).getDay();
  const dateLabel = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${snapshot.date}T12:00:00-03:00`));
  const weekendCopy = weekday === 0 || weekday === 6
    ? "El Críptico es de lunes a viernes. Vuelve el lunes a las 09:00."
    : "Hoy arranca a las 09:00.";

  activeSlots?.destroy();
  activeSlots = null;
  host.innerHTML = `
    <div class="st2-cryptic-head">
      <div>
        <span class="st2-cryptic-kicker">Desafío del día</span>
        <h2 id="st2-cryptic-title">Críptico ST²</h2>
        <p>${escapeHtml(dateLabel)}</p>
      </div>
    </div>
    <p class="st2-cryptic-about">La frase no dice la respuesta: la arma. Una parte define y la otra esconde las letras. Cada pista resta 2 puntos.</p>
    ${weekend ? "" : `
    <div class="st2-cryptic-rounds" role="tablist" aria-label="Rondas del Críptico" style="grid-template-columns: repeat(${Math.max(rounds.length, 1)}, minmax(0, 1fr))">
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
    </div>`}
    <div class="st2-cryptic-body">
      ${weekend ? renderNotice("Fin de semana", weekendCopy) : renderRound(round)}
    </div>
    ${ranked ? `
    <div class="st2-cryptic-foot">
      <button type="button" class="st2-cryptic-rank-link" data-cryptic-action="ranking" aria-expanded="${rankingOpen ? "true" : "false"}">
        ${rankingOpen ? "Ocultar ranking" : "Ver ranking"}
      </button>
    </div>
    <div class="st2-cryptic-ranking ${rankingOpen ? "" : "hidden"}" data-cryptic-ranking ${rankingOpen ? "" : "hidden"}>
      <div class="st2-cryptic-rank-tabs" role="tablist" aria-label="Rankings">
        <button type="button" role="tab" data-cryptic-action="rank-tab" data-rank-tab="today" class="${rankingTab === "general" ? "" : "is-active"}" aria-selected="${rankingTab === "general" ? "false" : "true"}">Hoy</button>
        <button type="button" role="tab" data-cryptic-action="rank-tab" data-rank-tab="general" class="${rankingTab === "general" ? "is-active" : ""}" aria-selected="${rankingTab === "general" ? "true" : "false"}">General</button>
      </div>
      ${renderRankingList(
        rankingTab === "general" ? (snapshot.seasonRanking || []) : ranking,
        rankingTab === "general" ? "Todavía no hay puntos en el ranking general." : "Todavía nadie sumó puntos.",
      )}
    </div>` : `<p class="st2-cryptic-guest-note">Sin usuario de ST² el críptico se juega igual. El ranking queda solo para quien entra con su cuenta.</p>`}
  `;
  mountAnswerSlots(round);
}

function renderRankingList(items, empty) {
  if (!items.length) return `<p class="st2-cryptic-empty">${escapeHtml(empty)}</p>`;
  return `
    <ol>
      ${items.map((item) => `
        <li>
          <span class="st2-cryptic-rank-pos">${item.rank}</span>
          <span class="st2-cryptic-rank-player">${escapeHtml(item.player)}</span>
          <span class="st2-cryptic-rank-meta">${item.wins} victoria${item.wins === 1 ? "" : "s"}</span>
          <strong>${item.points} pt${item.points === 1 ? "" : "s"}</strong>
        </li>
      `).join("")}
    </ol>
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
    return renderNotice("Nueva jornada", "El Críptico siguiente empieza a las 09:00.");
  }

  const solved = round.state === "solved";
  const failed = round.state === "failed";
  const clueText = clueWithoutCount(round.clue, round.enumeration);
  const attempts = round.attemptsRemaining;
  const missed = Number(round.attemptsUsed || 0) > 0 && attempts > 0;
  const tone = statusNote ? statusTone : "";
  const mask = Number(round.hintMask || 0);
  const nextKind = HINT_ORDER.find((item) => (mask & item.bit) === 0)?.kind;
  const hintLabel = nextKind ? (mask ? "Otra pista" : "Necesito una pista") : "Pistas listas";
  return `
    <blockquote class="st2-cryptic-clue">${renderMarkedClue(clueText, round)} <b>${escapeHtml(round.enumeration || "")}</b></blockquote>
    ${solved ? renderSolution(round) : failed ? `
      <div class="st2-cryptic-notice is-failed">
        <strong>Se terminaron los intentos</strong>
        <p>La explicación se revela sólo al resolver. El próximo día hábil hay revancha.</p>
      </div>
    ` : `
      <form class="st2-cryptic-form" data-cryptic-form>
        <div data-code-slots></div>
        <div class="st2-cryptic-actions">
          <button type="button" data-cryptic-action="hint" data-hint-kind="${nextKind || ""}" ${nextKind ? "" : "disabled"}>
            💡 ${hintLabel}
          </button>
          <button type="submit" class="st2-cryptic-check" data-cryptic-check disabled>Comprobar</button>
        </div>
        ${missed ? `<p class="st2-cryptic-attempts">Te quedan ${attempts} intento${attempts === 1 ? "" : "s"}.</p>` : ""}
        <p class="st2-cryptic-status ${tone}" data-cryptic-status role="status" aria-live="polite"${statusNote ? "" : " hidden"}>${escapeHtml(statusNote)}</p>
      </form>
      ${renderHintList(round)}
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

function popcount(mask) {
  let count = 0;
  let bits = Number(mask) || 0;
  while (bits) {
    count += bits & 1;
    bits >>= 1;
  }
  return count;
}

function renderHintList(round) {
  const mask = Number(round.hintMask || 0);
  const rows = [];
  if (mask & 1 && round.definition) rows.push(`<li><b>Definición:</b> ${escapeHtml(round.definition)}</li>`);
  if (mask & 2 && round.mechanism) rows.push(`<li><b>Mecanismo:</b> ${escapeHtml(round.mechanism)}</li>`);
  if (mask & 4 && round.indicator) rows.push(`<li><b>Indicador:</b> ${escapeHtml(round.indicator)}</li>`);
  if (mask & 8 && round.fodder) rows.push(`<li><b>Material:</b> ${escapeHtml(round.fodder)}</li>`);
  if (!rows.length) return "";
  return `
    <ul class="st2-cryptic-hint-list">${rows.join("")}</ul>
    <p class="st2-cryptic-hint-note">Estas pistas restan ${popcount(mask) * 2} puntos de los 10 de esta ronda.</p>
  `;
}

function renderMarkedClue(text, round) {
  const source = String(text || "");
  const mask = round.state === "solved" ? 15 : Number(round.hintMask || 0);
  const ranges = [];
  if ((mask & 1) && round.definition) ranges.push(...findClueRanges(source, round.definition, "definition"));
  if ((mask & 4) && round.indicator) ranges.push(...findClueRanges(source, round.indicator, "indicator"));
  if ((mask & 8) && round.fodder) ranges.push(...findClueRanges(source, round.fodder, "fodder", true));
  if (!ranges.length) return escapeHtml(source);

  const marks = Array.from({ length: source.length }, () => []);
  ranges.forEach((range) => {
    for (let index = range.start; index < range.end && index < source.length; index += 1) {
      if (!marks[index].includes(range.kind)) marks[index].push(range.kind);
    }
  });

  let html = "";
  let index = 0;
  while (index < source.length) {
    const key = marks[index].join(" ");
    let end = index + 1;
    while (end < source.length && marks[end].join(" ") === key) end += 1;
    const slice = escapeHtml(source.slice(index, end));
    html += key
      ? `<span class="st2-cryptic-mark ${marks[index].map((kind) => `is-${kind}`).join(" ")}">${slice}</span>`
      : slice;
    index = end;
  }
  return html;
}

function findClueRanges(text, value, kind, allowShort = false) {
  const ranges = [];
  const seen = new Set();
  const push = (start, end) => {
    const key = `${start}:${end}`;
    if (seen.has(key) || end <= start) return;
    seen.add(key);
    ranges.push({ start, end, kind });
  };

  String(value || "")
    .split(/\s*(?:\+|\/|;|,|\.\.\.|…)\s*/)
    .flatMap((part) => part.split(/[()«»"“”]+/))
    .map((part) => part.trim())
    .filter((part) => part.length >= (allowShort ? 1 : 3))
    .forEach((part) => {
      const pattern = flexiblePattern(part, part.length < 4);
      if (!pattern) return;
      for (const match of text.matchAll(pattern)) {
        if (match.index == null) continue;
        push(match.index, match.index + match[0].length);
      }
    });
  return ranges;
}

function flexiblePattern(token, wholeWord) {
  const folded = token.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (!/^[\p{L}\p{N}]+$/u.test(folded)) return null;
  const classes = {
    a: "[aáàä]",
    e: "[eéèë]",
    i: "[iíìï]",
    o: "[oóòö]",
    u: "[uúùü]",
    n: "[nñ]",
  };
  const body = [...folded].map((char) => classes[char] || char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("");
  const source = wholeWord ? `(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])` : body;
  return new RegExp(source, "giu");
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
      status.textContent = "";
      status.hidden = true;
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
    status.hidden = false;
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

async function revealHint(kind) {
  const round = getSelectedRound();
  const choice = HINT_ORDER.find((item) => item.kind === kind);
  if (!round || !choice || hintPending) return;
  if ((Number(round.hintMask || 0) & choice.bit) !== 0) return;
  hintPending = true;
  try {
    const response = await fetch(`${API}/hint`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot: round.slot, kind }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error || `Error ${response.status}`);
    await loadStatus({ quiet: true });
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
      statusNote = "";
      statusTone = "";
      render();
      return;
    }

    const action = event.target.closest("[data-cryptic-action]")?.dataset.crypticAction;
    if (action === "hint") {
      void revealHint(event.target.closest("[data-hint-kind]")?.dataset.hintKind);
    } else if (action === "ranking") {
      rankingOpen = !rankingOpen;
      render();
    } else if (action === "rank-tab") {
      rankingTab = event.target.closest("[data-rank-tab]")?.dataset.rankTab === "general" ? "general" : "today";
      rankingOpen = true;
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
    rankingOpen = false;
    void loadStatus();
  });
  void loadStatus();
}
