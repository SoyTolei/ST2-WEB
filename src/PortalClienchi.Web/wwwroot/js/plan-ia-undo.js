/** Snapshot / restore de campos antes de aplicar IA manual. */

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
    const el = document.getElementById(def.id);
    if (!el) continue;
    if (def.kind === "placeholder-textarea") {
      snap[def.id] = {
        value: el.value,
        placeholder: def.placeholderActive ?? el.classList.contains("placeholder-active"),
      };
    } else if (def.kind === "radio-group") {
      const checked = document.querySelector(`input[name="${def.name}"]:checked`);
      snap[def.id] = checked?.value ?? null;
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
    const el = document.getElementById(def.id);
    if (!el) continue;
    const data = snap[def.id];
    if (def.kind === "placeholder-textarea") {
      el.value = data.value;
      el.classList.toggle("placeholder-active", !!data.placeholder);
      if (def.onRestore) def.onRestore(!!data.placeholder);
    } else if (def.kind === "radio-group") {
      document.querySelectorAll(`input[name="${def.name}"]`).forEach((input) => {
        input.checked = input.value === data;
      });
      if (def.onRestore) def.onRestore(data);
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
      ? "Deshacer cambios de la IA"
      : "Disponible después de usar «Mejorar redacción con IA»";
    undoBtn.setAttribute("aria-disabled", snapshot ? "false" : "true");
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
      updateUndoUi();
    },
    clearSnapshot() {
      snapshot = null;
      updateUndoUi();
    },
    hasSnapshot: () => !!snapshot,
  };
}
