/** Select visual con hover naranja (el <select> nativo queda oculto para el valor). */

export function syncPlanCustomSelect(select) {
  select?.__planCustomSelectSync?.();
}

export function enhancePlanSelect(select) {
  if (!select || select.dataset.customSelect === "1") return;
  select.dataset.customSelect = "1";

  const wrap = document.createElement("div");
  wrap.className = "plan-custom-select";
  select.parentNode?.insertBefore(wrap, select);
  wrap.appendChild(select);
  select.classList.add("plan-custom-select-native");

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "plan-select plan-custom-select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const listId = `${select.id || "plan-select"}-list`;
  trigger.setAttribute("aria-controls", listId);

  const menu = document.createElement("ul");
  menu.className = "plan-custom-select-menu hidden";
  menu.id = listId;
  menu.setAttribute("role", "listbox");

  wrap.appendChild(trigger);
  wrap.appendChild(menu);

  let open = false;

  function syncTrigger() {
    const opt = select.selectedOptions[0];
    trigger.textContent = opt?.textContent?.trim() || "Seleccionar…";
    trigger.classList.toggle("has-value", Boolean(select.value));
    menu.querySelectorAll(".plan-custom-select-option").forEach((li) => {
      const selected = li.dataset.value === select.value;
      li.setAttribute("aria-selected", selected ? "true" : "false");
    });
  }

  function rebuildMenu() {
    menu.innerHTML = "";
    [...select.options].forEach((opt) => {
      const li = document.createElement("li");
      li.className = "plan-custom-select-option";
      li.setAttribute("role", "option");
      li.dataset.value = opt.value;
      li.textContent = opt.textContent;
      li.tabIndex = -1;
      li.addEventListener("mousedown", (e) => e.preventDefault());
      li.addEventListener("click", () => pick(opt.value));
      menu.appendChild(li);
    });
    syncTrigger();
  }

  function pick(value) {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    closeMenu();
    syncTrigger();
  }

  function openMenu() {
    if (open) return;
    open = true;
    menu.classList.remove("hidden");
    trigger.setAttribute("aria-expanded", "true");
    const selected = menu.querySelector('[aria-selected="true"]');
    selected?.scrollIntoView({ block: "nearest" });
  }

  function closeMenu() {
    if (!open) return;
    open = false;
    menu.classList.add("hidden");
    trigger.setAttribute("aria-expanded", "false");
  }

  trigger.addEventListener("click", () => {
    if (open) closeMenu();
    else openMenu();
  });

  trigger.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu();
    }
    if (e.key === "Escape") closeMenu();
  });

  menu.addEventListener("keydown", (e) => {
    const items = [...menu.querySelectorAll(".plan-custom-select-option")];
    const idx = items.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      trigger.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = items[Math.min(idx + 1, items.length - 1)] || items[0];
      next?.focus();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = items[Math.max(idx - 1, 0)] || items[items.length - 1];
      prev?.focus();
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const item = document.activeElement;
      if (item?.classList.contains("plan-custom-select-option")) pick(item.dataset.value);
    }
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) closeMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  select.addEventListener("change", syncTrigger);

  const observer = new MutationObserver(rebuildMenu);
  observer.observe(select, { childList: true, subtree: true });

  select.__planCustomSelectSync = syncTrigger;
  rebuildMenu();
}
