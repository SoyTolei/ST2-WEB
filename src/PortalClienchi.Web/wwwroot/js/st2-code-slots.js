export function lettersOf(raw) {
  return (String(raw ?? "").normalize("NFC").match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/gu) || [])
    .join("")
    .toLocaleUpperCase("es-AR");
}

export function groupsFromEnumeration(enumeration) {
  return [...String(enumeration ?? "").matchAll(/\d+/g)]
    .map((match) => Number(match[0]))
    .filter((count) => count > 0);
}

const SETTLE = 0.3;
const BOUNCE = 0.2;
const RISE = 8;
const CASCADE = 20;

function playSpring(from, to, delayMs, onUpdate) {
  const zeta = 1 - BOUNCE;
  const omega = -Math.log(0.01) / (zeta * SETTLE);
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  const delta = to - from;
  const startAt = performance.now() + delayMs;

  return new Promise((resolve) => {
    const frame = (now) => {
      if (now < startAt) {
        requestAnimationFrame(frame);
        return;
      }
      const elapsed = (now - startAt) / 1000;
      const decay = Math.exp(-zeta * omega * elapsed);
      const value = to - delta * decay * (Math.cos(wd * elapsed) + ((zeta * omega) / wd) * Math.sin(wd * elapsed));
      const keepGoing = onUpdate(elapsed < SETTLE ? value : to);
      if (keepGoing === false || elapsed >= SETTLE) resolve();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

export function createCodeSlots(container, {
  groups,
  initial = "",
  onChange,
  autoFocus = false,
} = {}) {
  const layout = (groups?.length ? groups : [4]).filter((count) => count > 0);
  const length = layout.reduce((sum, count) => sum + count, 0);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const slots = Array.from({ length }, (_, index) => lettersOf(initial)[index] || "");
  let armed = !slots.every(Boolean);
  const slotEls = [];
  let active = Math.max(0, slots.findIndex((slot) => !slot) === -1 ? length - 1 : slots.findIndex((slot) => !slot));
  let focused = false;
  let busy = false;
  let destroyed = false;
  let typedFromKey = false;

  container.classList.add("code-slots");
  container.style.setProperty("--cs-accent", "#ec4899");
  container.style.setProperty("--cs-danger", "#ff3b30");
  const progress = Array.from({ length }, (_, index) => (slots[index] ? 1 : 0));
  const motionGen = Array.from({ length }, () => 0);
  container.innerHTML = `
    <div class="code-slots__row" data-status="idle">
      <input id="st2-cryptic-answer" class="code-slots__input" type="text" inputmode="text"
        autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="${length}"
        aria-label="Respuesta de ${length} letras" />
      ${layout.map((count) => `
        <span class="code-slots__word">
          ${Array.from({ length: count }, () => `
            <span class="code-slots__slot" aria-hidden="true">
              <span class="code-slots__fill"></span>
              <span class="code-slots__digit"></span>
            </span>
          `).join("")}
        </span>
      `).join("")}
      <span class="code-slots__wash" aria-hidden="true">
        <svg class="code-slots__check" viewBox="0 0 24 24">
          <path d="M5 12.5 9.2 17 19 7" />
        </svg>
      </span>
    </div>
  `;

  const row = container.querySelector(".code-slots__row");
  const input = container.querySelector(".code-slots__input");
  container.querySelectorAll(".code-slots__slot").forEach((el) => slotEls.push(el));

  const fit = () => {
    const width = container.clientWidth || 240;
    const gap = 4;
    const longest = Math.max(...layout);
    const columns = longest;
    let size = Math.floor((width - (columns - 1) * gap) / columns);
    if (size < 26) {
      const wrapped = Math.ceil(longest / 2);
      size = Math.floor((width - (wrapped - 1) * gap) / wrapped);
    }
    size = Math.max(20, Math.min(44, size));
    container.style.setProperty("--cs-size", `${size}px`);
    container.style.setProperty("--cs-font", `${Math.round(size * 0.46)}px`);
  };

  const applyProgress = (index, value) => {
    progress[index] = value;
    const el = slotEls[index];
    if (!el) return;
    el.querySelector(".code-slots__fill").style.transform = `scale(${Math.max(value, 0)})`;
    const digit = el.querySelector(".code-slots__digit");
    digit.style.opacity = String(Math.min(1, Math.max(value, 0)));
    digit.style.transform = `translateY(${(1 - value) * RISE}px)`;
  };

  const drive = (index, to, delayMs = 0) => {
    const gen = ++motionGen[index];
    if (to === 1 && progress[index] > 0.04) applyProgress(index, 0);
    const from = progress[index];
    if (reduceMotion) {
      applyProgress(index, to);
      return Promise.resolve();
    }
    return playSpring(from, to, delayMs, (value) => {
      if (destroyed || motionGen[index] !== gen) return false;
      applyProgress(index, value);
      return true;
    });
  };

  const paint = () => {
    slotEls.forEach((el, index) => {
      const char = slots[index];
      el.classList.toggle("is-active", focused && index === active && !busy);
      el.classList.toggle("is-caret", focused && index === active && !char && !busy && row.dataset.status !== "success");
      const digit = el.querySelector(".code-slots__digit");
      if (char) digit.textContent = char;
      if (!digit.style.transform) applyProgress(index, progress[index]);
    });
    if (focused) row.dataset.focused = "";
    else delete row.dataset.focused;
  };

  const emit = () => onChange?.(slots.join(""));

  const insert = (raw, from = active) => {
    if (busy || row.dataset.status === "success") return;
    if (slots.every(Boolean) && !armed) return;
    const chars = lettersOf(raw);
    if (!chars) return;
    const step = reduceMotion ? 0 : CASCADE;
    const replacing = slots.every(Boolean);
    let index = from;
    const letters = replacing ? chars.slice(0, 1) : chars;
    for (const char of letters) {
      if (index >= length) break;
      const el = slotEls[index];
      slots[index] = char;
      el.querySelector(".code-slots__digit").textContent = char;
      void drive(index, 1, (index - from) * step);
      index += 1;
    }
    active = Math.min(index, length - 1);
    armed = !slots.every(Boolean);
    paint();
    emit();
  };

  const clearSlot = (index, stepBack = false) => {
    if (busy) return;
    if (!slots[index]) {
      if (stepBack) active = index;
      paint();
      return;
    }
    const el = slotEls[index];
    slots[index] = "";
    armed = true;
    void drive(index, 0).then(() => {
      if (!slots[index]) el.querySelector(".code-slots__digit").textContent = "";
    });
    if (stepBack) active = index;
    paint();
    emit();
  };

  const onKeyDown = (event) => {
    if (busy || event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;
    if (key === "Enter") {
      event.preventDefault();
    } else if (/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]$/.test(key)) {
      event.preventDefault();
      typedFromKey = true;
      insert(key);
    } else if (key === "Backspace") {
      event.preventDefault();
      if (slots[active]) clearSlot(active);
      else if (active > 0) clearSlot(active - 1, true);
    } else if (key === "Delete") {
      event.preventDefault();
      clearSlot(active);
    } else if (key === "ArrowLeft") {
      event.preventDefault();
      active = Math.max(active - 1, 0);
      armed = true;
      paint();
    } else if (key === "ArrowRight") {
      event.preventDefault();
      active = Math.min(active + 1, length - 1);
      armed = true;
      paint();
    } else if (key === "Home") {
      event.preventDefault();
      active = 0;
      armed = true;
      paint();
    } else if (key === "End") {
      event.preventDefault();
      active = length - 1;
      armed = true;
      paint();
    }
  };

  const onMouseDown = (event) => {
    if (busy) return;
    const slot = event.target.closest(".code-slots__slot");
    event.preventDefault();
    if (slot) {
      const index = slotEls.indexOf(slot);
      const firstEmpty = slots.indexOf("");
      const limit = firstEmpty === -1 ? length - 1 : firstEmpty;
      active = Math.max(0, Math.min(index, limit));
      armed = true;
      paint();
    }
    input.focus();
  };

  input.addEventListener("keydown", onKeyDown);
  input.addEventListener("paste", (event) => {
    if (busy) return;
    event.preventDefault();
    insert(event.clipboardData?.getData("text") || "");
  });
  input.addEventListener("input", (event) => {
    const chars = lettersOf(event.target.value);
    event.target.value = "";
    if (typedFromKey) {
      typedFromKey = false;
      return;
    }
    if (!chars) return;
    insert(chars, chars.length === 1 ? active : 0);
  });
  input.addEventListener("focus", () => {
    focused = true;
    paint();
  });
  input.addEventListener("blur", () => {
    focused = false;
    paint();
  });
  row.addEventListener("mousedown", onMouseDown);

  const observer = new ResizeObserver(fit);
  observer.observe(container);
  fit();
  paint();
  if (autoFocus) input.focus();

  return {
    length,
    value: () => slots.join(""),
    focus: () => input.focus(),
    setBusy(next) {
      busy = next;
      input.disabled = next;
      if (next) row.dataset.disabled = "";
      else delete row.dataset.disabled;
      paint();
    },
    async fail() {
      if (destroyed) return;
      row.dataset.status = "error";
      const filled = slots.map((char, index) => (char ? index : -1)).filter((index) => index >= 0).reverse();
      const step = reduceMotion ? 0 : CASCADE;
      filled.forEach((index) => {
        slots[index] = "";
      });
      await Promise.all(filled.map((index, order) => drive(index, 0, order * step)));
      if (destroyed) return;
      slotEls.forEach((el) => {
        el.querySelector(".code-slots__digit").textContent = "";
      });
      slots.fill("");
      active = 0;
      armed = true;
      row.dataset.status = "idle";
      paint();
      emit();
    },
    async succeed() {
      if (destroyed) return;
      row.dataset.status = "success";
      paint();
      await wait(reduceMotion ? 180 : 620);
    },
    destroy() {
      destroyed = true;
      observer.disconnect();
    },
  };
}
