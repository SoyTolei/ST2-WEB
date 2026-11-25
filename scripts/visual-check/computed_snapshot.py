"""Foto del estilo computado de todos los elementos (y ::before/::after) en cada ruta.
Uso: computed_snapshot.py <salida.json> [theme]   |   computed_snapshot.py --diff a.json b.json"""
import json
import sys

ROUTES = ["/planillas", "/transferencia", "/referral", "/oportunidad", "/blanqueo", "/borrado-bases", "/pdf", "/portal", "/criptico.html"]
BASE = "http://localhost:5180"

JS = """() => {
  const props = [...getComputedStyle(document.body)].filter(p => !p.startsWith('--'));
  const els = [...document.querySelectorAll('body *')].filter(e => !e.closest('svg') || e.tagName === 'svg');
  const out = [];
  for (const el of els) {
    const key = el.tagName + (el.id ? '#' + el.id : '') + '.' + [...el.classList].join('.');
    for (const pe of [null, '::before', '::after']) {
      const cs = getComputedStyle(el, pe);
      if (pe && (cs.content === 'none' || cs.content === 'normal')) continue;
      const vals = {};
      for (const p of props) vals[p] = cs.getPropertyValue(p);
      out.push([key + (pe || ''), vals]);
    }
  }
  return out;
}"""


def snapshot(path, theme):
    from playwright.sync_api import sync_playwright
    data = {}
    with sync_playwright() as p:
        b = p.chromium.launch(channel="msedge", headless=True)
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
        ctx.add_init_script(f"try {{ localStorage.setItem('st2-theme', '{theme}'); }} catch (e) {{}}")
        page = ctx.new_page()
        for r in ROUTES:
            page.goto(BASE + r, wait_until="networkidle")
            page.add_style_tag(content="*,*::before,*::after{animation:none!important;transition:none!important}")
            page.wait_for_timeout(700)
            data[r] = page.evaluate(JS)
            print(r, len(data[r]))
        b.close()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)


def diff(a_path, b_path):
    a = json.load(open(a_path, encoding="utf-8"))
    b = json.load(open(b_path, encoding="utf-8"))
    total = 0
    for route in a:
        ra, rb = a[route], b.get(route, [])
        if len(ra) != len(rb):
            print(f"{route}: cantidad distinta {len(ra)} vs {len(rb)}")
        for (ka, va), (kb, vb) in zip(ra, rb):
            if ka != kb:
                print(f"{route}: orden distinto {ka} / {kb}")
                break
            for prop, val in va.items():
                if vb.get(prop) != val:
                    total += 1
                    if total <= 25:
                        print(f"{route} {ka[:70]} {prop}: {val[:40]} -> {vb.get(prop, '')[:40]}")
    print("diferencias:", total)
    return total


if __name__ == "__main__":
    if sys.argv[1] == "--diff":
        sys.exit(1 if diff(sys.argv[2], sys.argv[3]) else 0)
    snapshot(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "dark")
