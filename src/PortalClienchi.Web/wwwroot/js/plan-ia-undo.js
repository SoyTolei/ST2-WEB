/** Snapshot / restore de campos antes de aplicar IA manual. */

const IA_UNDO_HINT = "Volvé atrás si no te convence";
const IA_UNDO_DEFAULT = "Deshacer cambios de la IA";
const iaUndoHintTimers = new Map();

export function notifyIaUndoHint(undoBtnId) {
  const undoBtn = document.getElementById(undoBtnId);
  if (!undoBtn) return;

  const prev = iaUndoHintTimers.get(undoBtnId);
  if (prev) clearTimeout(prev);

  undoBtn.title = IA_UNDO_HINT;
  undoBtn.setAttribute("aria-label", IA_UNDO_HINT);
  undoBtn.classList.add("is-hint");

  const timer = setTimeout(() => {
    if (!undoBtn.disabled) {
      undoBtn.title = IA_UNDO_DEFAULT;
      undoBtn.setAttribute("aria-label", IA_UNDO_DEFAULT);
    }
    undoBtn.classList.remove("is-hint");
    iaUndoHintTimers.delete(undoBtnId);
  }, 8000);

  iaUndoHintTimers.set(undoBtnId, timer);
}

function clearIaUndoHint(undoBtn) {
  if (!undoBtn) return;
  const timer = iaUndoHintTimers.get(undoBtn.id);
  if (timer) {
    clearTimeout(timer);
    iaUndoHintTimers.delete(undoBtn.id);
  }
  undoBtn.classList.remove("is-hint");
}

export function syncIaUndoBar(iaBtnId, undoBtnId, visible) {
  const show = !!visible;
  document.getElementById(iaBtnId)?.classList.toggle("hidden", !show);
  document.getElementById(undoBtnId)?.classList.toggle("hidden", !show);
  document
    .getElementById(undoBtnId)
    ?.closest(".plan-ia-group")
    ?.classList.toggle("hidden", !show);
}

export function snapshotFields(fieldDefs) {
  const snap = {};
  for (const def of fieldDefs) {
    if (def.kind === "radio-group") {
      const scope = def.scope ? document.getElementById(def.scope) : document;
      const checked = scope?.querySelector(`input[name="${def.name}"]:checked`);
      snap[def.id] = checked?.value ?? null;
      continue;
    }

    const el = document.getElementById(def.id);
    if (!el) continue;
    if (def.kind === "placeholder-textarea") {
      snap[def.id] = {
        value: el.value,
        placeholder: def.placeholderActive ?? el.classList.contains("placeholder-active"),
      };
    } else {
      snap[def.id] = el.value;
    }
  }
  return snap;
}

export function restoreFields(fieldDefs, snap) {
  if (!snap) return;
  for (const def of fieldDefs) {
    if (!(def.id in snap)) continue;
    const data = snap[def.id];
    if (def.kind === "radio-group") {
      const scope = def.scope ? document.getElementById(def.scope) : document;
      scope?.querySelectorAll(`input[name="${def.name}"]`).forEach((input) => {
        input.checked = input.value === data;
      });
      if (def.onRestore) def.onRestore(data);
      continue;
    }

    const el = document.getElementById(def.id);
    if (!el) continue;
    if (def.kind === "placeholder-textarea") {
      el.value = data.value;
      el.classList.toggle("placeholder-active", !!data.placeholder);
      if (def.onRestore) def.onRestore(!!data.placeholder);
    } else {
      el.value = data;
    }
  }
}

export function bindIaUndoButtons({ undoBtnId, getSnapshot, onUndo }) {
  const undoBtn = document.getElementById(undoBtnId);
  let snapshot = null;

  const updateUndoUi = () => {
    if (!undoBtn) return;
    undoBtn.disabled = !snapshot;
    undoBtn.title = snapshot
      ? IA_UNDO_DEFAULT
      : "Disponible después de usar «Mejorar redacción con IA»";
    undoBtn.setAttribute("aria-disabled", snapshot ? "false" : "true");
    undoBtn.setAttribute(
      "aria-label",
      snapshot ? IA_UNDO_DEFAULT : "Deshacer cambios de la IA (disponible después de mejorar con IA)",
    );
  };

  updateUndoUi();

  return {
    saveSnapshot() {
      snapshot = getSnapshot();
      updateUndoUi();
    },
    undo() {
      if (!snapshot) return;
      onUndo(snapshot);
      snapshot = null;
      clearIaUndoHint(undoBtn);
      updateUndoUi();
    },
    clearSnapshot() {
      snapshot = null;
      clearIaUndoHint(undoBtn);
      updateUndoUi();
    },
    hasSnapshot: () => !!snapshot,
  };
}
