/**
 * DecryptedText (vanilla) — port simplificado de React Bits (animateOn: view).
 */

const DEFAULT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+";

function shuffleText(originalText, revealed, availableChars) {
  return originalText
    .split("")
    .map((char, i) => {
      if (char === " ") return " ";
      if (revealed.has(i)) return originalText[i];
      return availableChars[Math.floor(Math.random() * availableChars.length)];
    })
    .join("");
}

function getNextIndex(revealedSet, textLength, revealDirection) {
  switch (revealDirection) {
    case "end":
      return textLength - 1 - revealedSet.size;
    case "center": {
      const middle = Math.floor(textLength / 2);
      const offset = Math.floor(revealedSet.size / 2);
      const nextIndex = revealedSet.size % 2 === 0 ? middle + offset : middle - offset - 1;
      if (nextIndex >= 0 && nextIndex < textLength && !revealedSet.has(nextIndex)) {
        return nextIndex;
      }
      for (let i = 0; i < textLength; i += 1) {
        if (!revealedSet.has(i)) return i;
      }
      return 0;
    }
    case "start":
    default:
      return revealedSet.size;
  }
}

function renderChars(host, displayText, revealed, isDone, className, encryptedClassName) {
  const frag = document.createDocumentFragment();
  const chars = displayText.split("");
  for (let i = 0; i < chars.length; i += 1) {
    const span = document.createElement("span");
    const done = revealed.has(i) || isDone;
    span.className = `st2-decrypt-char ${done ? className : encryptedClassName}`.trim();
    if (!done) span.classList.add("is-encrypted");
    span.textContent = chars[i];
    frag.appendChild(span);
  }
  host.replaceChildren(frag);
}

/**
 * @param {HTMLElement} el
 * @param {object} [opts]
 */
export function mountDecryptedText(el, opts = {}) {
  if (!el || el.dataset.st2Decrypt === "1") return null;

  const {
    text = el.textContent.trim(),
    speed = 50,
    maxIterations = 10,
    sequential = false,
    revealDirection = "start",
    useOriginalCharsOnly = false,
    characters = DEFAULT_CHARS,
    className = "",
    encryptedClassName = "",
    parentClassName = "",
    animateOn = "view",
    loop = false,
    loopPause = 1100,
  } = opts;

  const original = String(text || "");
  if (!original) return null;

  el.dataset.st2Decrypt = "1";
  el.classList.add("st2-decrypt");
  if (parentClassName) el.classList.add(...parentClassName.split(/\s+/).filter(Boolean));

  const sr = document.createElement("span");
  sr.className = "st2-decrypt-sr";
  sr.textContent = original;

  const visual = document.createElement("span");
  visual.setAttribute("aria-hidden", "true");

  el.replaceChildren(sr, visual);

  const availableChars = useOriginalCharsOnly
    ? Array.from(new Set(original.split(""))).filter((c) => c !== " ")
    : characters.split("");

  let revealed = new Set();
  let isAnimating = false;
  let hasAnimated = false;
  let intervalId = null;
  let loopTimer = null;

  const paint = (display, done = false) => {
    sr.textContent = display;
    renderChars(visual, display, revealed, done, className, encryptedClassName);
  };

  paint(original, true);

  const stop = () => {
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (loopTimer != null) {
      clearTimeout(loopTimer);
      loopTimer = null;
    }
    isAnimating = false;
  };

  const startCycle = () => {
    if (isAnimating) return;
    revealed = new Set();
    isAnimating = true;
    let currentIteration = 0;
    paint(shuffleText(original, revealed, availableChars), false);

    intervalId = setInterval(() => {
      if (sequential) {
        if (revealed.size < original.length) {
          const nextIndex = getNextIndex(revealed, original.length, revealDirection);
          revealed = new Set(revealed);
          revealed.add(nextIndex);
          paint(shuffleText(original, revealed, availableChars), false);
        } else {
          clearInterval(intervalId);
          intervalId = null;
          isAnimating = false;
          paint(original, true);
          if (loop) {
            loopTimer = setTimeout(() => startCycle(), loopPause);
          }
        }
        return;
      }

      paint(shuffleText(original, revealed, availableChars), false);
      currentIteration += 1;
      if (currentIteration >= maxIterations) {
        clearInterval(intervalId);
        intervalId = null;
        isAnimating = false;
        revealed = new Set(Array.from({ length: original.length }, (_, i) => i));
        paint(original, true);
        if (loop) {
          loopTimer = setTimeout(() => startCycle(), loopPause);
        }
      }
    }, speed);
  };

  const triggerDecrypt = () => startCycle();

  if (animateOn === "view") {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasAnimated) {
            hasAnimated = true;
            triggerDecrypt();
            observer.disconnect();
          }
        }
      },
      { root: null, rootMargin: "0px", threshold: 0.1 }
    );
    observer.observe(el);

    if (document.body.classList.contains("st2-access-restoring")) {
      requestAnimationFrame(() => {
        if (!hasAnimated) {
          hasAnimated = true;
          triggerDecrypt();
          observer.disconnect();
        }
      });
    }
  } else {
    triggerDecrypt();
  }

  return { triggerDecrypt, stop };
}

export function initSplashDecryptedText() {
  const status = document.querySelector(".st2-boot-splash-status");
  if (!status) return;

  let target = status.querySelector("[data-st2-decrypt-target]");
  if (!target) {
    const dots = status.querySelector(".st2-boot-splash-dots");
    target = document.createElement("span");
    target.dataset.st2DecryptTarget = "1";
    target.textContent = "Cargando";
    status.textContent = "";
    status.appendChild(target);
    if (dots) status.appendChild(dots);
  }

  mountDecryptedText(target, {
    text: "Cargando",
    speed: 75,
    maxIterations: 12,
    sequential: true,
    revealDirection: "start",
    animateOn: "view",
    loop: true,
    loopPause: 1200,
    characters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$",
    encryptedClassName: "st2-decrypt-encrypted",
    className: "st2-decrypt-revealed",
  });
}
