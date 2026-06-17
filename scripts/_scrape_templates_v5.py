import time, json, re
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
            http_only = True; line = line[len("#HttpOnly_"):]
        elif line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) != 7: continue
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
        const typ = (el.type || el.tagName.toLowerCase()).toLowerCase();
        if (typ === 'hidden' || typ === 'submit' || typ === 'button') continue;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        let label = '';
        if (el.id) {
          const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          if (l) label = l.innerText.trim();
        }
        if (!label) {
          const g = el.closest('.mb-3,.form-floating,.col-md-6,.col-12,.row');
          if (g) { const l = g.querySelector('label'); if (l) label = l.innerText.trim(); }
        }
        const req = !!el.required || label.includes('*');
        out.push({name: el.name||el.id||'', type: typ==='select-one'?'select':typ, label: label.replace(/\\*/g,'').trim(), required: req, placeholder: el.placeholder||''});
      }
      return out;
    }
    """)

def click_header_by_text(page, text):
    return page.evaluate("""
      (text) => {
        for (const b of document.querySelectorAll('button.btn-template-header')) {
          const t = b.innerText.replace(/\\s+/g,' ').trim();
          if (t === text || t.endsWith(text)) { b.click(); return true; }
        }
        return false;
      }
    """, text)

def nested_headers(page):
    return page.evaluate("""
      () => [...document.querySelectorAll('button.btn-template-header')]
        .map(b => b.innerText.replace(/\\s+/g,' ').trim())
        .filter(Boolean)
    """)

def small_tools(page):
    return page.evaluate("""
      () => [...document.querySelectorAll('button.ai-tool-btn-small')]
        .filter(b => b.offsetParent !== null)
        .map(b => b.innerText.replace(/\\s+/g,' ').trim())
    """)

def click_small_tool(page, text):
    return page.evaluate("""
      (text) => {
        for (const b of document.querySelectorAll('button.ai-tool-btn-small')) {
          if (b.innerText.replace(/\\s+/g,' ').trim() === text) { b.click(); return true; }
        }
        return false;
      }
    """, text)

PRODUCTS = [
    ("Legal One", ["Sistema","RTO/Proview","NFSe","Mobile","Datacloud","Performance","Entitlement"]),
    ("Legal One Analytics", None),
    ("HighQ", None),
]

catalog = {"source": URL, "products": []}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(ignore_https_errors=True)
    context.add_cookies(parse_netscape_cookies(COOKIE_FILE))

    for product, preset_cats in PRODUCTS:
        page = context.new_page()
        page.goto(URL, wait_until="networkidle", timeout=120000)
        time.sleep(1.5)
        click_header_by_text(page, product)
        time.sleep(1.5)
        if preset_cats is None:
            # cards layout: sub-templates are ai-tool-btn-small at product level
            headers = nested_headers(page)
            preset_cats = [h for h in headers if h not in ("Legal One","Legal One Analytics","HighQ")]
        categories = []
        for cat in preset_cats:
            page.goto(URL, wait_until="networkidle", timeout=120000)
            time.sleep(1)
            click_header_by_text(page, product)
            time.sleep(1)
            click_header_by_text(page, cat)
            time.sleep(1.2)
            subs = small_tools(page)
            sub_templates = []
            if subs:
                for sub in subs:
                    page.goto(URL, wait_until="networkidle", timeout=120000)
                    time.sleep(0.8)
                    click_header_by_text(page, product)
                    time.sleep(0.8)
                    click_header_by_text(page, cat)
                    time.sleep(0.8)
                    click_small_tool(page, sub)
                    time.sleep(1.2)
                    fields = extract_fields(page)
                    sub_templates.append({"id": slug(sub), "label": sub, "fields": fields})
            else:
                fields = extract_fields(page)
                if fields:
                    sub_templates.append({"id": slug(cat), "label": cat, "fields": fields})
            categories.append({"id": slug(cat), "label": cat, "subTemplates": sub_templates})
        catalog["products"].append({"id": slug(product), "label": product, "categories": categories})
        page.close()
    browser.close()

(OUT/"template-catalog-full.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding='utf-8')
print('products', len(catalog['products']))
for p in catalog['products']:
    print(p['label'], 'cats', len(p['categories']), 'subs', sum(len(c['subTemplates']) for c in p['categories']))
