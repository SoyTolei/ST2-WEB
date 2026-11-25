import { createCodeSlots, groupsFromEnumeration, lettersOf } from "./st2-code-slots.js";

const API = "/api/cryptic";
const STATE_LABELS = {
  available: "Te falta",
  solved: "Resuelto",
  blocked: "Bloqueado",
  upcoming: "Próximamente",
  closed: "Cerrado",
  failed: "Sin intentos",
};

let host = null;
let snapshot = null;
let selectedSlot = null;
/** Día anterior elegido (yyyy-MM-dd). null = el Críptico vigente. */
let viewDate = null;
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
const almostBySlot = new Map();
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
  if (!host) return;
  if (document.hidden && !quiet) return;
  if (!quiet) host.setAttribute("aria-busy", "true");
  try {
    const query = viewDate ? `?date=${encodeURIComponent(viewDate)}` : "";
    const response = await fetch(`${API}/status${query}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await readProblem(response));
    snapshot = await response.json();
    // Si el día pedido ya venció, el servidor devuelve el vigente.
    if (snapshot?.phase !== "archive") viewDate = null;
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
      // Perder una ronda no frena la siguiente: si hay otra abierta, se pasa a esa.
      if (!selected || selected.state === "upcoming" || selected.state === "blocked" || selected.state === "failed") {
        selectedSlot = rounds.find((round) => round.state === "available")?.slot ?? selectedSlot;
      }
    }
    if (!document.hidden) render();
    publishPending();
    scheduleRefresh();
  } catch (error) {
    if (!quiet && !document.hidden) renderError(error?.message || "No se pudo cargar el Críptico.");
  } finally {
    host?.removeAttribute("aria-busy");
  }
}

function publishPending() {
  // Mirando un día anterior: el aviso sigue reflejando el Críptico vigente.
  if (snapshot?.phase === "archive") return;
  const publicPage = document.body.classList.contains("st2-cryptic-public");
  const rounds = snapshot?.rounds || [];
  const available = publicPage ? [] : rounds.filter((round) => round.state === "available");
  document.dispatchEvent(new CustomEvent("st2:cryptic-pending", {
    detail: {
      pending: available.length > 0,
      phase: snapshot?.phase || "",
      date: snapshot?.date || "",
      slots: available.map((round) => Number(round.slot)),
      afternoon: available.some((round) => Number(round.slot) > 12 * 60),
    },
  }));
}

function scheduleRefresh() {
  window.clearTimeout(refreshTimer);
  const untilNext = snapshot?.nextAt
    ? new Date(snapshot.nextAt).getTime() - Date.now() + 1200
    : NaN;
  const waiting = Number.isFinite(untilNext) && untilNext > 0;
  const heartbeat = document.hidden ? 3 * 60 * 1000 : 90 * 1000;
  const delay = waiting
    ? Math.max(8000, Math.min(heartbeat, untilNext))
    : heartbeat;
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

function formatNext(iso) {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(when);
}

function roundIcon(state) {
  if (state === "solved") return "✓";
  if (state === "available") return "●";
  if (state === "failed") return "×";
  return "○";
}

function slotKey(slot) {
  return `${snapshot?.date || ""}|${slot}`;
}

const shortDay = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});

function dayChipLabel(isoDate) {
  const label = shortDay.format(new Date(`${isoDate}T12:00:00Z`)).replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function archiveDayState(day) {
  const total = Number(day.total || 0);
  const solved = Number(day.solved || 0);
  const failed = Number(day.failed || 0);
  if (total > 0 && solved === total) return { tone: "is-done", text: "✓ Completo" };
  if (total > 0 && solved + failed === total) return { tone: "is-closed", text: solved ? `${solved}/${total}` : "Sin intentos" };
  if (solved > 0) return { tone: "is-pending", text: `${solved}/${total}` };
  return { tone: "is-pending", text: "Por jugar" };
}

const ARCHIVE_HINT = "Día anterior: hasta 10 puntos por ronda, sin bonus del día.";

function renderDayPicker() {
  const archive = snapshot?.archive || [];
  if (!archive.length) return "";
  const archived = snapshot.phase === "archive";
  return `
    <nav class="st2-cryptic-days" aria-label="Críptico de días anteriores">
      <button type="button" class="st2-cryptic-day ${archived ? "" : "is-active"}" data-cryptic-day="" aria-pressed="${archived ? "false" : "true"}">Hoy</button>
      ${archive.map((day) => {
        const state = archiveDayState(day);
        const active = archived && day.date === snapshot.date;
        return `
        <button type="button" class="st2-cryptic-day ${state.tone} ${active ? "is-active" : ""}" data-cryptic-day="${escapeHtml(day.date)}" aria-pressed="${active ? "true" : "false"}" title="${ARCHIVE_HINT}">
          ${escapeHtml(dayChipLabel(day.date))}
          <small>${escapeHtml(state.text)}</small>
        </button>`;
      }).join("")}
    </nav>
  `;
}

function render() {
  if (!host || !snapshot || submitting) return;
  const round = getSelectedRound();
  const rounds = snapshot.rounds || [];
  const ranking = snapshot.ranking || [];
  const ranked = snapshot.ranked !== false;
  const stage = document.body.classList.contains("st2-cryptic-public");
  const archived = snapshot.phase === "archive";
  const holiday = snapshot.phase === "holiday";
  const weekend = snapshot.phase === "weekend" || holiday;
  const pendingPast = (snapshot.archive || []).some((day) => archiveDayState(day).tone === "is-pending");
  const weekday = new Date(`${snapshot.date}T12:00:00-03:00`).getDay();
  const dateLabel = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${snapshot.date}T12:00:00-03:00`));
  const weekendBase = holiday
    ? `Hoy es feriado${snapshot.closure ? `: ${snapshot.closure}` : ""}. No hay críptico. Vuelve el próximo día hábil a las 09:00.`
    : weekday === 0 || weekday === 6
      ? "El Críptico es de lunes a viernes. Vuelve el lunes a las 09:00."
      : "Hoy arranca a las 09:00.";
  const weekendCopy = pendingPast
    ? `${weekendBase} Mientras tanto, podés jugar los días anteriores.`
    : weekendBase;

  activeSlots?.destroy();
  activeSlots = null;
  host.innerHTML = `
    <div class="st2-cryptic-head">
      <div>
        <span class="st2-cryptic-kicker">${archived ? "Día anterior" : "Desafío del día"}</span>
        <h2 id="st2-cryptic-title">Críptico ST²</h2>
        <p>${escapeHtml(dateLabel)}</p>
        ${stage && snapshot.nextAt && !archived ? `<p class="st2-cryptic-next">Siguiente críptico: ${escapeHtml(formatNext(snapshot.nextAt))}</p>` : ""}
      </div>
    </div>
    ${renderDayPicker()}
    ${stage ? "" : ""}
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
      ${weekend ? renderNotice(holiday ? "Feriado" : "Fin de semana", weekendCopy) : renderRound(round)}
    </div>
    ${stage ? "" : ""}
    ${!stage && ranked ? `
    <div class="st2-cryptic-foot">
      <button type="button" class="st2-cryptic-rank-link" data-cryptic-action="ranking" aria-expanded="${rankingOpen ? "true" : "false"}">
        ${rankingOpen ? "Ocultar ranking" : "Ver ranking"}
      </button>
    </div>
    <div class="st2-cryptic-ranking ${rankingOpen ? "" : "hidden"}" data-cryptic-ranking ${rankingOpen ? "" : "hidden"}>
      <div class="st2-cryptic-rank-tabs" role="tablist" aria-label="Rankings">
        <button type="button" role="tab" data-cryptic-action="rank-tab" data-rank-tab="today" class="${rankingTab === "general" ? "" : "is-active"}" aria-selected="${rankingTab === "general" ? "false" : "true"}">${archived ? "Ese día" : "Hoy"}</button>
        <button type="button" role="tab" data-cryptic-action="rank-tab" data-rank-tab="general" class="${rankingTab === "general" ? "is-active" : ""}" aria-selected="${rankingTab === "general" ? "true" : "false"}">General${snapshot.season ? ` · ${escapeHtml(snapshot.season)}` : ""}</button>
      </div>
      ${renderRankingList(
        rankingTab === "general" ? (snapshot.seasonRanking || []) : ranking,
        rankingTab === "general"
          ? `Todavía no hay puntos en el ranking ${snapshot.season || "general"}.`
          : archived ? "Ese día nadie sumó puntos." : "Todavía nadie sumó puntos.",
      )}
    </div>` : ""}
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
  const nextKind = nextHintKind(round);
  return `
    <blockquote class="st2-cryptic-clue">${renderMarkedClue(clueText, round)} <b>${escapeHtml(round.enumeration || "")}</b></blockquote>
    ${solved ? renderSolution(round) : failed ? renderFailed(round) : `
      <form class="st2-cryptic-form" data-cryptic-form>
        <div data-code-slots></div>
        <div class="st2-cryptic-actions">
          <button type="button" data-cryptic-action="hint" ${nextKind ? "" : "disabled"}>
            💡 Dame una pista
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

function renderFailed(round) {
  const rounds = snapshot?.rounds || [];
  const open = rounds.find((item) => item.slot !== round.slot && item.state === "available");
  const later = rounds.find((item) => item.slot > round.slot && item.state === "upcoming");
  let body = "La explicación se revela sólo al resolver.";
  if (open) body += ` La de las ${open.label} sigue en juego.`;
  else if (later) body += ` La de las ${later.label} se juega igual cuando abra.`;
  else if (snapshot?.phase !== "archive") body += " El próximo día hábil hay revancha.";
  return `
    <div class="st2-cryptic-notice is-failed">
      <strong>Se terminaron los intentos</strong>
      <p>${escapeHtml(body)}</p>
      ${open ? `<button type="button" class="st2-cryptic-go" data-cryptic-slot="${open.slot}">Ir a la de las ${escapeHtml(open.label)}</button>` : ""}
    </div>
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

function nextHintKind(round) {
  if (!round) return "";
  const mask = Number(round.hintMask || 0);
  const structural = HINT_ORDER.find((item) => (mask & item.bit) === 0);
  if (structural) return structural.kind;
  const shown = (mask >> 5) & 31;
  const total = groupsFromEnumeration(round.enumeration).reduce((sum, count) => sum + count, 0);
  if (total > 1 && shown < total - 1) return "letters";
  return "";
}

function parseAlmost(almost) {
  const raw = String(almost || "");
  const hints = new Map();
  for (let index = 0; index < raw.length; index += 1) {
    const char = lettersOf(raw[index])[0] || "";
    if (char) hints.set(index, char);
  }
  return hints;
}

function mergeSlotDraft(round, length) {
  const hints = parseAlmost(round?.almost);
  const draft = draftBySlot.get(slotKey(round?.slot));
  const slots = Array.from({ length }, () => "");
  for (const [index, char] of hints) {
    if (index < length) slots[index] = char;
  }
  if (Array.isArray(draft)) {
    for (let index = 0; index < length; index += 1) {
      if (slots[index] || hints.has(index)) continue;
      const char = lettersOf(draft[index] || "")[0] || "";
      if (char) slots[index] = char;
    }
  }
  return { slots, hints };
}

function animatedHintIndices(round, hints) {
  const slot = slotKey(round?.slot);
  const next = String(round?.almost || "");
  const hadPrev = almostBySlot.has(slot);
  const prev = parseAlmost(almostBySlot.get(slot) || "");
  almostBySlot.set(slot, next);
  if (!hadPrev) return [];
  const fresh = [];
  for (const index of hints.keys()) {
    if (!prev.has(index)) fresh.push(index);
  }
  return fresh;
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
  return `<ul class="st2-cryptic-hint-list">${rows.join("")}</ul>`;
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
  const layout = groups.length ? groups : [8];
  const length = layout.reduce((sum, count) => sum + count, 0);
  const { slots, hints } = mergeSlotDraft(round, length);
  const animateIndices = animatedHintIndices(round, hints);
  const shouldFocus = pendingFocus;
  pendingFocus = false;
  const check = host?.querySelector("[data-cryptic-check]");
  const syncCheck = () => {
    if (!check || !activeSlots) return;
    check.disabled = !activeSlots.complete();
  };
  activeSlots = createCodeSlots(container, {
    groups: layout,
    initial: slots,
    locked: [...hints.keys()],
    animateIndices,
    autoFocus: shouldFocus,
    onChange: (_code, snapshot) => {
      draftBySlot.set(slotKey(round.slot), snapshot);
      syncCheck();
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
  syncCheck();
}

async function submitAttempt(form) {
  const round = getSelectedRound();
  const status = form.querySelector("[data-cryptic-status]");
  const answer = activeSlots?.value()?.trim() || "";
  if (!round || !activeSlots || !activeSlots.complete() || submitting) return;

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
      body: JSON.stringify({ slot: round.slot, answer, date: viewDate || undefined }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error || `Error ${response.status}`);
    draftBySlot.delete(slotKey(round.slot));
    snapshot = body.status || snapshot;
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
  if (!round || !kind || hintPending) return;
  if (kind !== "letters") {
    const choice = HINT_ORDER.find((item) => item.kind === kind);
    if (!choice) return;
    if ((Number(round.hintMask || 0) & choice.bit) !== 0) return;
  }
  hintPending = true;
  try {
    const response = await fetch(`${API}/hint`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot: round.slot, kind, date: viewDate || undefined }),
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
    const dayButton = event.target.closest("[data-cryptic-day]");
    if (dayButton) {
      const next = dayButton.dataset.crypticDay || null;
      if (next === viewDate) return;
      viewDate = next;
      selectedSlot = null;
      statusNote = "";
      statusTone = "";
      rankingTab = "today";
      void loadStatus();
      return;
    }

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
      void revealHint(nextHintKind(getSelectedRound()));
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
    viewDate = null;
    rankingOpen = false;
    draftBySlot.clear();
    almostBySlot.clear();
    void loadStatus();
  });
  void loadStatus();
}
