import json, time, re
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(r"c:\PARA LOGMEIN\XXXXXXXX\TEST EXES\PortalClienchiWEB\scripts")
COOKIE_FILE = Path(r"C:\Users\6128530\AppData\Local\Temp\lo-cookies2.txt")
URL = "http://ai-support-tools.legalone.com.br/suporte/templates"

def parse_netscape_cookies(path):
    cookies = []
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        http_only = False
        line = raw
        if line.startswith("#HttpOnly_"):
            http_only = True
            line = line[len("#HttpOnly_"):]
        elif line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) != 7:
            continue
        domain, flag, p, secure, expiry, name, value = parts
        cookies.append({"name": name, "value": value, "domain": domain.lstrip("."), "path": p, "httpOnly": http_only, "secure": secure.upper()=="TRUE"})
    return cookies

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def extract_fields(page):
    return page.evaluate("""
    () => {
      const out = [];
      for (const el of document.querySelectorAll('input, textarea, select')) {
        if (!el.offsetParent && el.type !== 'hidden') continue;
        const typ = el.type || el.tagName.toLowerCase();
        if (['hidden','submit','button'].includes(typ)) continue;
        let label = '';
        if (el.id) {
          const l = document.querySelector(`label[for="${el.id}"]`);
          if (l) label = l.innerText.trim();
        }
        if (!label) {
          const g = el.closest('.mb-3,.form-floating,.col-md-6,.col-12');
          if (g) { const l = g.querySelector('label'); if (l) label = l.innerText.trim(); }
        }
        out.push({name: el.name||el.id||'', type: typ, label, required: !!el.required, placeholder: el.placeholder||''});
      }
      return out;
    }
    """)

catalog = {"source": URL, "products": []}
log = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(ignore_https_errors=True)
    context.add_cookies(parse_netscape_cookies(COOKIE_FILE))
    page = context.new_page()
    page.goto(URL, wait_until="networkidle", timeout=120000)
    page.wait_for_function("() => document.querySelectorAll('button.btn-template-header').length >= 3", timeout=60000)
    time.sleep(2)

    product_names = page.evaluate("""
      () => [...document.querySelectorAll('button.btn-template-header')].map(b => b.innerText.replace(/\\s+/g,' ').trim())
    """)
    log.append({"product_names": product_names})

    for pi, pname in enumerate(product_names):
        page.evaluate(f"() => document.querySelectorAll('button.btn-template-header')[{pi}]?.click()")
        time.sleep(2.5)
        body = page.evaluate("() => document.body.innerText")
        log.append({"after_product": pname, "body": body[:4000]})
        # categories
        cat_labels = page.evaluate("""
          () => [...document.querySelectorAll('button.ai-tool-btn-small')].map(b => b.innerText.replace(/\\s+/g,' ').trim()).filter(Boolean)
        """)
        categories = []
        for ci, clabel in enumerate(cat_labels):
            page.evaluate(f"""
              () => {{
                const btns = [...document.querySelectorAll('button.ai-tool-btn-small')];
                btns[{ci}]?.click();
              }}
            """)
            time.sleep(2)
            sub_labels = page.evaluate("""
              () => {
                const seen = new Set();
                const res = [];
                for (const b of document.querySelectorAll('button.ai-tool-btn-small, .template-card-wrapper button, button.btn-outline-success')) {
                  const t = b.innerText.replace(/\\s+/g,' ').trim();
                  if (!t || seen.has(t)) continue;
                  seen.add(t);
                  res.push(t);
                }
                return res;
              }
            """)
            sub_templates = []
            for si, sl in enumerate(sub_labels):
                if sl == clabel:
                    continue
                page.evaluate(f"""
                  () => {{
                    const target = {json.dumps(sl)};
                    for (const b of document.querySelectorAll('button')) {{
                      if (b.innerText.replace(/\\s+/g,' ').trim() === target) {{ b.click(); return; }}
                    }}
                  }}
                """)
                time.sleep(1.5)
                fields = extract_fields(page)
                if fields:
                    sub_templates.append({"id": slug(sl), "label": sl, "fields": fields})
            categories.append({"id": slug(clabel), "label": clabel, "subTemplates": sub_templates})
        catalog["products"].append({"id": slug(pname), "label": pname, "categories": categories})

    (OUT / "template-catalog-playwright-v3.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "template-catalog-playwright-log.json").write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"products": len(catalog["products"]), "last_body": log[-1]["body"][:500] if log else ""}, ensure_ascii=False))
    browser.close()
