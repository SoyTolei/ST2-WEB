"""Analiza y (con --apply) saca los !important innecesarios de un CSS (por defecto theme-dark.css).

Uso: python important_cleanup.py <wwwroot> [--apply] [--target archivo.css] [--why texto]
Requiere la app corriendo en local. Criterio conservador: solo saca un !important si
ninguna otra regla que pueda caer en el mismo elemento le ganaría sin él (especificidad
y orden reales), la propiedad no se pone inline desde JS ni la anima un @keyframes que
aplique a ese elemento. Verificar siempre después con computed_snapshot.py --diff."""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
WWW = Path(sys.argv[1])
APPLY = "--apply" in sys.argv
TARGET = sys.argv[sys.argv.index("--target") + 1] if "--target" in sys.argv else "theme-dark.css"
BASE = "http://localhost:5180"
ROUTES = ["/planillas", "/transferencia", "/referral", "/oportunidad", "/blanqueo", "/borrado-bases", "/pdf", "/portal", "/criptico.html"]
COLOR_IDS = ["ref-mark-chile-bases", "plan-status"]  # únicos con color inline real desde JS
INLINE_PROPS = ["width", "top", "left", "transform", "opacity", "transition", "height", "z-index",
                "position", "grid-column", "animation", "clip-path", "zoom", "text-align", "stroke-dashoffset",
                "max-width", "justify-content", "grid-template-columns", "border-radius"]

# ---------- co-ocurrencia de clases desde el código fuente ----------
cooccur = defaultdict(set)
wildcard = set()


def add_group(tokens, dynamic=False):
    toks = [t for t in tokens if t and re.fullmatch(r"#?[A-Za-z_][\w-]*", t)]
    for t in toks:
        cooccur[t].update(toks)
        if dynamic:
            wildcard.add(t)


sources = list((WWW / "js").rglob("*.js")) + [WWW / "index.html", WWW / "criptico.html"]
prefixes = set()
for path in sources:
    text = path.read_bytes().decode("utf-8", "replace")
    for m in re.finditer(r"""id\s*=\s*["'`]([A-Za-z][\w-]*)["'`]""", text):
        wildcard.add("#" + m.group(1))
    for m in re.finditer(r"""class(?:Name)?\s*(?:=|\+=)\s*(["'`])(.*?)\1""", text, re.S):
        raw = m.group(2)
        dynamic = "${" in raw or m.group(0).find("+=") >= 0
        # Prefijos de clases armadas dinámicamente dentro del atributo: "is-${estado}".
        prefixes.update(re.findall(r"([A-Za-z][\w-]*-)\$\{", raw))
        add_group(re.sub(r"\$\{[^}]*\}", " ", raw).split(), dynamic)
    # Ids declarados en plantillas: existen, aunque no sepamos con qué clases.
    for m in re.finditer(r"""id\s*=\s*["'`]([A-Za-z][\w-]*)["'`]""", text):
        wildcard.add("#" + m.group(1))
    for m in re.finditer(r"classList\.(?:add|toggle|replace)\(([^)]*)\)", text):
        prefixes.update(re.findall(r"([A-Za-z][\w-]*-)\$\{", m.group(1)))
        for t in re.findall(r"""["'`]([\w-]+)["'`]""", m.group(1)):
            wildcard.add(t)
    for m in re.finditer(r"""(?:classes|className|cls)\s*:\s*(["'`])(.*?)\1""", text):
        add_group(re.sub(r"\$\{[^}]*\}", " ", m.group(2)).split(), "${" in m.group(2))

# ---------- parser mínimo del CSS objetivo ----------
css_path = WWW / "css" / TARGET
src = css_path.read_bytes().decode("utf-8")
masked = re.sub(r"/\*.*?\*/", lambda m: " " * len(m.group()), src, flags=re.S)


def match_brace(s, i):
    depth = 0
    for j in range(i, len(s)):
        if s[j] == "{":
            depth += 1
        elif s[j] == "}":
            depth -= 1
            if depth == 0:
                return j
    raise ValueError("llave sin cerrar")


def split_decls(body, offset):
    out, depth, start, q = [], 0, 0, None
    for i, ch in enumerate(body + ";"):
        if q:
            if ch == q:
                q = None
            continue
        if ch in "\"'":
            q = ch
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        elif ch == ";" and depth == 0:
            seg = body[start:i]
            if ":" in seg and seg.strip():
                out.append((offset + start, offset + i, seg))
            start = i + 1
    return out


rules = []  # (selector, [ (start, end, text) ])


def parse(s, a, b):
    i = a
    while i < b:
        brace = s.find("{", i, b)
        if brace < 0:
            break
        prelude = s[i:brace]
        prelude = prelude[max(prelude.rfind(";"), prelude.rfind("}")) + 1:].strip()
        end = match_brace(s, brace)
        if prelude.startswith("@"):
            name = prelude.split()[0].lower()
            if name in ("@media", "@supports", "@container", "@layer", "@document"):
                parse(s, brace + 1, end)
        else:
            rules.append((prelude, split_decls(s[brace + 1:end], brace + 1)))
        i = end + 1


parse(masked, 0, len(masked))

def norm(sel):
    s = re.sub(r"\s+", "", sel).replace("::", ":").replace('"', "").replace("'", "").lower()
    s = s.replace("(even)", "(2n)").replace("(odd)", "(2n+1)")
    return s

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_init_script("try { localStorage.setItem('st2-theme', 'dark'); } catch (e) {}")
    page = ctx.new_page()
    for route in ROUTES:
        page.goto(BASE + route, wait_until="networkidle")
        page.wait_for_timeout(600)
        groups = page.evaluate("() => [...document.querySelectorAll('[class],[id]')].map(e => [...e.classList, ...(e.id ? ['#' + e.id] : [])])")
        for g in groups:
            add_group(g)
    page.goto(BASE + "/planillas", wait_until="networkidle")
    page.wait_for_timeout(600)
    analyzer = (HERE / "important_analyzer.js").read_text(encoding="utf-8")
    result = page.evaluate(analyzer, {
        "cooccur": {k: sorted(v) for k, v in cooccur.items()},
        "wildcard": sorted(w for w in wildcard if not (w.startswith("#") and w in cooccur)),
        "prefixes": sorted(prefixes),
        "inlineProps": INLINE_PROPS,
        "colorIds": COLOR_IDS,
        "target": TARGET,
    })
    # Longhands de cada declaración fuente.
    pending = []
    for _, decls in rules:
        for (s0, e0, text) in decls:
            if "!important" in text:
                prop, _, value = text.partition(":")
                pending.append((prop.strip().lower(), value.replace("!important", "").strip()))
    uniq = sorted(set(pending))
    longhands = page.evaluate("""(items) => items.map(([p, v]) => {
        const s = document.createElement('div').style;
        try { s.setProperty(p, v); } catch (e) {}
        const out = []; for (let i = 0; i < s.length; i++) out.push(s[i]);
        return out.length ? out : (p.startsWith('--') ? [p] : []);
    })""", [list(x) for x in uniq])
    lh = dict(zip(uniq, longhands))
    browser.close()

if "--why" in sys.argv:
    needle = sys.argv[sys.argv.index("--why") + 1]
    for r in result:
        if needle in r["selector"]:
            print("WHY", r["selector"][:110], r["props"])
    print("token en cooccur:", "#" + needle in cooccur, "| wildcard:", "#" + needle in wildcard)
    sys.exit(0)

# ---------- alinear reglas fuente con CSSOM ----------
j = 0
edits = []
stats = Counter()
reasons = Counter()
examples = defaultdict(list)
for sel, decls in rules:
    # Resincroniza: si la regla CSSOM actual coincide con una fuente más adelante, esta fuente
    # fue descartada por el navegador; si coincide con una CSSOM más adelante, se saltean esas.
    if j < len(result) and norm(result[j]["selector"]) != norm(sel):
        ahead = next((k for k in range(j + 1, min(j + 4, len(result))) if norm(result[k]["selector"]) == norm(sel)), None)
        if ahead is not None:
            j = ahead
    if j < len(result) and norm(result[j]["selector"]) == norm(sel):
        props = result[j]["props"]
        j += 1
    else:
        props = None
        stats["sin-alinear"] += 1
        if stats["sin-alinear"] <= 3 and j < len(result):
            print("NO ALINEA | fuente:", norm(sel)[:160], "| cssom:", norm(result[j]["selector"])[:160])
    for (s0, e0, text) in decls:
        if "!important" not in text:
            continue
        stats["important"] += 1
        prop, _, value = text.partition(":")
        key = (prop.strip().lower(), value.replace("!important", "").strip())
        hands = lh.get(key) or []
        if props is None or not hands:
            reasons["sin-datos"] += 1
            continue
        verdicts = [props.get(h, {"ok": False, "why": "no-important"}) for h in hands]
        if all(v["ok"] for v in verdicts):
            edits.append((s0, e0, text))
            stats["removible"] += 1
        else:
            bad = next(v for v in verdicts if not v["ok"])
            reasons[bad["why"]] += 1
            if bad["why"] == "conflict" and len(examples[prop.strip()]) < 2:
                examples[prop.strip()].append(f"{sel[:70]}  vs  {bad.get('with')} ({bad.get('file')})")

print("alineadas", j, "de", len(result), "reglas CSSOM;", dict(stats))
print("motivos para dejarlo:", dict(reasons))
for k, v in list(examples.items())[:6]:
    print(" ", k, "->", v[0])

if APPLY and edits:
    out = src
    for s0, e0, text in sorted(edits, key=lambda t: -t[0]):
        seg = out[s0:e0]
        new = re.sub(r"\s*!important", "", seg, count=1)
        out = out[:s0] + new + out[e0:]
    css_path.write_bytes(out.encode("utf-8"))
    print("aplicado:", len(edits), "!important removidos")
