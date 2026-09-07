/**
 * GlitchText (vanilla) — port de React Bits.
 */

export function mountGlitchText(el, opts = {}) {
  if (!el || el.dataset.st2Glitch === "1") return el;
  const {
    speed = 1,
    enableShadows = true,
    enableOnHover = true,
    text = null,
  } = opts;

  const label = String(text ?? el.textContent ?? "").trim();
  if (!label) return el;

  el.dataset.st2Glitch = "1";
  el.dataset.text = label;
  el.textContent = label;
  el.classList.add("st2-glitch");
  el.classList.toggle("enable-on-hover", !!enableOnHover);
  el.style.setProperty("--after-duration", `${speed * 3}s`);
  el.style.setProperty("--before-duration", `${speed * 2}s`);
  el.style.setProperty("--after-shadow", enableShadows ? "-5px 0 red" : "none");
  el.style.setProperty("--before-shadow", enableShadows ? "5px 0 cyan" : "none");
  return el;
}

export function initSuiteGlitchText() {
  const access = document.querySelector("#st2-access-gate .st2-access-suite");
  if (access) {
    mountGlitchText(access, {
      speed: 0.85,
      enableShadows: true,
      enableOnHover: true,
    });
  }

  const hero = document.querySelector(".planillas-hero .planillas-hero-title-main");
  if (hero) {
    mountGlitchText(hero, {
      speed: 1,
      enableShadows: true,
      enableOnHover: true,
    });
  }
}
