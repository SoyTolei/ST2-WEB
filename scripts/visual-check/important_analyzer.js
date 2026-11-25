// Se evalúa en la página (Playwright). Recibe { cooccur, wildcard, inlineProps, target } y devuelve
// para cada regla de estilo de theme-dark.css (en orden CSSOM) qué longhands !important son removibles.
(input) => {
  const cooccur = new Map(Object.entries(input.cooccur).map(([k, v]) => [k, new Set(v)]));
  const wildcard = new Set(input.wildcard);
  const LEGACY_PE = new Set(["before", "after", "first-line", "first-letter"]);

  // ---------- selectores ----------
  function splitTop(sel, seps) {
    const out = []; let depth = 0, buf = "", q = null;
    for (let i = 0; i < sel.length; i++) {
      const ch = sel[i];
      if (q) { buf += ch; if (ch === q && sel[i - 1] !== "\\") q = null; continue; }
      if (ch === '"' || ch === "'") { q = ch; buf += ch; continue; }
      if (ch === "(" || ch === "[") depth++;
      if (ch === ")" || ch === "]") depth--;
      if (depth === 0 && seps.includes(ch)) { out.push(buf); buf = ""; continue; }
      buf += ch;
    }
    out.push(buf);
    return out.map((s) => s.trim()).filter(Boolean);
  }

  function readIdent(s, i) {
    let j = i;
    while (j < s.length && /[\w\-\\ -￿]/.test(s[j])) j++;
    return [s.slice(i, j), j];
  }

  function readParens(s, i) { // s[i] === "("
    let depth = 0, j = i;
    for (; j < s.length; j++) {
      if (s[j] === "(") depth++;
      else if (s[j] === ")") { depth--; if (depth === 0) break; }
    }
    return [s.slice(i + 1, j), j + 1];
  }

  function maxSpec(list) {
    let best = [0, 0, 0];
    for (const part of splitTop(list, [","])) {
      const sp = spec(part);
      if (cmp(sp, best) > 0) best = sp;
    }
    return best;
  }

  function spec(sel) {
    let a = 0, b = 0, c = 0, i = 0;
    const s = sel;
    let atCompoundStart = true;
    while (i < s.length) {
      const ch = s[i];
      if (ch === "#") { const [, j] = readIdent(s, i + 1); a++; i = j; atCompoundStart = false; continue; }
      if (ch === ".") { const [, j] = readIdent(s, i + 1); b++; i = j; atCompoundStart = false; continue; }
      if (ch === "[") { let j = i; let d = 0; for (; j < s.length; j++) { if (s[j] === "[") d++; else if (s[j] === "]") { d--; if (!d) break; } } b++; i = j + 1; atCompoundStart = false; continue; }
      if (ch === ":") {
        const isPE = s[i + 1] === ":";
        const [name, j] = readIdent(s, i + (isPE ? 2 : 1));
        let k = j, args = null;
        if (s[k] === "(") { [args, k] = readParens(s, k); }
        const n = name.toLowerCase();
        if (isPE || LEGACY_PE.has(n)) c++;
        else if (n === "where") { /* 0 */ }
        else if (["is", "not", "has", "matches", "-webkit-any", "-moz-any"].includes(n)) {
          const m = args ? maxSpec(args) : [0, 0, 0]; a += m[0]; b += m[1]; c += m[2];
        } else if ((n === "nth-child" || n === "nth-last-child") && args && / of /.test(args)) {
          b++; const m = maxSpec(args.split(/ of /)[1]); a += m[0]; b += m[1]; c += m[2];
        } else b++;
        i = k; atCompoundStart = false; continue;
      }
      if (" >+~".includes(ch)) { i++; atCompoundStart = true; continue; }
      if (ch === "*") { i++; atCompoundStart = false; continue; }
      if (/[a-zA-Z]/.test(ch) && atCompoundStart) { const [, j] = readIdent(s, i); c++; i = j; atCompoundStart = false; continue; }
      i++;
    }
    return [a, b, c];
  }

  function cmp(x, y) { for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; }

  function subject(sel) {
    const parts = splitTop(sel, [" ", ">", "+", "~"]);
    const last = parts[parts.length - 1] || "";
    const classes = new Set(); let id = null, tag = null, pe = "";
    let i = 0;
    while (i < last.length) {
      const ch = last[i];
      if (ch === ".") { const [n, j] = readIdent(last, i + 1); classes.add(n); i = j; continue; }
      if (ch === "#") { const [n, j] = readIdent(last, i + 1); id = n; i = j; continue; }
      if (ch === "[") { let j = last.indexOf("]", i); i = j < 0 ? last.length : j + 1; continue; }
      if (ch === ":") {
        const isPE = last[i + 1] === ":";
        const [n, j] = readIdent(last, i + (isPE ? 2 : 1));
        let k = j; if (last[k] === "(") [, k] = readParens(last, k);
        if (isPE || LEGACY_PE.has(n.toLowerCase())) pe = n.toLowerCase();
        i = k; continue;
      }
      if (/[a-zA-Z]/.test(ch) && i === 0) { const [n, j] = readIdent(last, i); tag = n.toLowerCase(); i = j; continue; }
      i++;
    }
    return { classes, id, tag, pe };
  }

  const prefixes = input.prefixes || [];
  const wild = (t) => wildcard.has(t) || (!cooccur.has(t) && prefixes.some((p) => t.replace(/^#/, "").startsWith(p)));
  const dead = (t) => !cooccur.has(t) && !wild(t);

  function mayOverlap(A, B) {
    if (A.pe !== B.pe) return false;
    if (A.id && B.id && A.id !== B.id) return false;
    if (A.tag && B.tag && A.tag !== B.tag) return false;
    const tA = [...A.classes, ...(A.id ? ["#" + A.id] : [])];
    const tB = [...B.classes, ...(B.id ? ["#" + B.id] : [])];
    // Una clase/id que no existe en ningún lado: esa regla no aplica a nada.
    if (tA.some(dead) || tB.some(dead)) return false;
    if (!tA.length || !tB.length) return true;
    for (const x of tB) {
      if (tA.includes(x) || wild(x)) continue;
      if (tA.some((c) => wild(c) || cooccur.get(c)?.has(x))) continue;
      return false;
    }
    return true;
  }

  // ---------- recorrido del CSSOM ----------
  const decls = []; // { prop, important, sel, spec, subj, order, sheet, ruleRef }
  const themeRules = []; // reglas de estilo de theme-dark.css en orden
  const keyframeProps = new Map(); // nombre -> Set(props)
  const animRules = []; // { sub, names }
  let order = 0;
  function walk(rules, sheetHref) {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        const o = order++;
        const sels = splitTop(rule.selectorText, [","]).map((s) => ({ s, sp: spec(s), sub: subject(s) }));
        const entry = { rule, order: o, sels, href: sheetHref };
        for (let i = 0; i < rule.style.length; i++) {
          const prop = rule.style[i];
          const important = rule.style.getPropertyPriority(prop) === "important";
          for (const sel of sels) decls.push({ prop, important, sel, order: o, entry });
        }
        if (sheetHref.endsWith(input.target)) themeRules.push(entry);
        const names = rule.style.getPropertyValue("animation-name");
        if (names && names !== "none") {
          const list = names.split(",").map((n) => n.trim()).filter((n) => n && n !== "none");
          for (const sel of sels) animRules.push({ sub: sel.sub, names: list });
        }
      } else if (rule instanceof CSSKeyframesRule) {
        if (!keyframeProps.has(rule.name)) keyframeProps.set(rule.name, new Set());
        const set = keyframeProps.get(rule.name);
        for (const kf of rule.cssRules) for (let i = 0; i < kf.style.length; i++) set.add(kf.style[i]);
      } else if (rule.cssRules) {
        walk(rule.cssRules, sheetHref);
      }
    }
  }
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    walk(rules, (sheet.href || "").split("?")[0]);
  }

  const inline = new Set();
  const scratch = document.createElement("div").style;
  for (const p of input.inlineProps) {
    inline.add(p);
    scratch.cssText = "";
    try { scratch.setProperty(p, "initial"); } catch { }
    for (let i = 0; i < scratch.length; i++) inline.add(scratch[i]);
  }

  const byProp = new Map();
  for (const d of decls) {
    if (!byProp.has(d.prop)) byProp.set(d.prop, []);
    byProp.get(d.prop).push(d);
  }

  function removable(entry, prop) {
    if (!entry.rule.style.getPropertyPriority(prop)) return { ok: false, why: "no-important" };
    if (prop.startsWith("--")) return { ok: false, why: "custom-prop" };
    if (inline.has(prop)) return { ok: false, why: "inline-js" };
    if (prop === "color" && entry.sels.some((sel) => input.colorIds.includes(sel.sub.id) || /pdf-portal/.test(sel.s))) {
      return { ok: false, why: "inline-js-color" };
    }
    for (const sel of entry.sels) {
      for (const a of animRules) {
        if (!a.names.some((n) => keyframeProps.get(n)?.has(prop))) continue;
        if (mayOverlap(sel.sub, a.sub)) return { ok: false, why: "animated" };
      }
    }
    for (const sel of entry.sels) {
      for (const o of byProp.get(prop) || []) {
        if (o.entry === entry) continue;
        if (!mayOverlap(sel.sub, o.sel.sub)) continue;
        const c = cmp(sel.sp, o.sel.sp);
        const dBeatsO = c > 0 || (c === 0 && entry.order > o.order);
        if (o.important ? dBeatsO : !dBeatsO) {
          return { ok: false, why: "conflict", with: o.sel.s.slice(0, 120), file: o.entry.href.split("/").pop() };
        }
      }
    }
    return { ok: true };
  }

  return themeRules.map((entry) => {
    const props = {};
    for (let i = 0; i < entry.rule.style.length; i++) {
      const p = entry.rule.style[i];
      if (entry.rule.style.getPropertyPriority(p)) props[p] = removable(entry, p);
    }
    return { selector: entry.rule.selectorText, props };
  });
}
