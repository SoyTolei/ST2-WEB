/**
 * BranchedMenu (vanilla) — menú en árbol con ramas SVG que se dibujan hasta el ítem activo.
 * items: [{ label, children: [{ value, label, icon?: svgString, tone?: "danger" }] }]
 * onSelect(value, item) puede devolver false para no marcar el ítem como activo (ej. "Cerrar sesión").
 */
const PAD = 6;
const MARK = 16;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createBranchedMenu(root, {
  items = [],
  open = [0],
  active = "",
  onSelect,
  rowHeight = 34,
  indent = 40,
  trunk = 14,
  radius = 10,
} = {}) {
  if (!root) return null;
  const openSet = new Set(open);
  let current = active;

  const r = Math.min(radius, rowHeight / 2 - 2);
  const endX = indent - 8;
  const rowY = (k) => PAD + k * rowHeight + rowHeight / 2;
  const branch = (k) => `M ${trunk} ${rowY(k) - r} A ${r} ${r} 0 0 0 ${trunk + r} ${rowY(k)} H ${endX}`;
  const reach = (k) => `M ${trunk} 0 V ${rowY(k) - r} A ${r} ${r} 0 0 0 ${trunk + r} ${rowY(k)} H ${endX}`;
  const length = (k) => rowY(k) - r + (Math.PI * r) / 2 + (endX - trunk - r);

  root.classList.add("branched-menu");
  root.style.setProperty("--bm-row", `${rowHeight}px`);
  root.style.setProperty("--bm-indent", `${indent}px`);

  root.innerHTML = `
    <span class="branched-menu__marker" aria-hidden="true"></span>
    ${items.map((item, i) => {
      const kids = item.children || [];
      const bodyH = PAD * 2 + kids.length * rowHeight;
      return `
        <div class="branched-menu__section" data-section="${i}">
          <button type="button" class="branched-menu__head" data-head="${i}" aria-expanded="false">${escapeHtml(item.label)}</button>
          <div class="branched-menu__body">
            <div class="branched-menu__fold">
              <div class="branched-menu__tree" style="height:${bodyH}px">
                <svg class="branched-menu__lines" width="${indent}" height="${bodyH}" aria-hidden="true">
                  <path class="branched-menu__base" d="M ${trunk} 0 V ${rowY(kids.length - 1) - r}"/>
                  ${kids.map((_, k) => `<path class="branched-menu__base" d="${branch(k)}"/>`).join("")}
                  ${kids.map((kid, k) => `<path class="branched-menu__reach" data-reach="${escapeHtml(kid.value)}" d="${reach(k)}" style="stroke-dasharray:${length(k)};stroke-dashoffset:${length(k)}"/>`).join("")}
                </svg>
                ${kids.map((kid) => `
                  <button type="button" class="branched-menu__item${kid.tone === "danger" ? " branched-menu__item--danger" : ""}" data-value="${escapeHtml(kid.value)}" role="menuitem">
                    ${kid.icon ? `<span class="branched-menu__icon" aria-hidden="true">${kid.icon}</span>` : ""}
                    <span class="branched-menu__label">${escapeHtml(kid.label)}</span>
                  </button>`).join("")}
              </div>
            </div>
          </div>
        </div>`;
    }).join("")}
  `;

  const marker = root.querySelector(".branched-menu__marker");
  const findKid = (value) => {
    for (let i = 0; i < items.length; i += 1) {
      const kid = (items[i].children || []).find((k) => k.value === value);
      if (kid) return { section: i, kid };
    }
    return null;
  };

  function sync({ glide = true } = {}) {
    root.querySelectorAll(".branched-menu__section").forEach((section) => {
      const i = Number(section.getAttribute("data-section"));
      const isOpen = openSet.has(i);
      section.toggleAttribute("data-open", isOpen);
      section.querySelector(".branched-menu__head")?.setAttribute("aria-expanded", isOpen ? "true" : "false");
      section.querySelectorAll(".branched-menu__item").forEach((btn) => {
        btn.tabIndex = isOpen ? 0 : -1;
      });
    });
    root.querySelectorAll(".branched-menu__item").forEach((btn) => {
      const on = btn.getAttribute("data-value") === current;
      btn.toggleAttribute("data-active", on);
      if (on) btn.setAttribute("aria-current", "true");
      else btn.removeAttribute("aria-current");
    });
    root.querySelectorAll(".branched-menu__reach").forEach((path) => {
      const full = path.style.strokeDasharray;
      path.style.strokeDashoffset = path.getAttribute("data-reach") === current ? "0" : full;
    });

    const hit = findKid(current);
    const head = hit ? root.querySelector(`[data-head="${hit.section}"]`) : null;
    const show = !!head && openSet.has(hit.section);
    if (!marker) return;
    if (!glide) marker.style.transition = "none";
    if (show) marker.style.top = `${head.offsetTop + (head.offsetHeight - MARK) / 2}px`;
    marker.toggleAttribute("data-on", show);
    if (!glide) {
      void marker.offsetHeight;
      marker.style.transition = "";
    }
  }

  root.addEventListener("click", (e) => {
    const head = e.target.closest("[data-head]");
    if (head) {
      e.preventDefault();
      e.stopPropagation();
      const i = Number(head.getAttribute("data-head"));
      if (openSet.has(i)) openSet.delete(i);
      else openSet.add(i);
      sync();
      return;
    }
    const btn = e.target.closest(".branched-menu__item");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const value = btn.getAttribute("data-value");
    const hit = findKid(value);
    const keep = onSelect?.(value, hit?.kid);
    if (keep !== false) {
      current = value;
      sync();
    }
  });

  sync({ glide: false });

  return {
    setActive(value) {
      current = value;
      sync();
    },
    /** Al volverse visible (estaba con display:none) hay que recalcular la marca. */
    refresh() {
      sync({ glide: false });
    },
  };
}
