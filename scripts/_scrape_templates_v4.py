import json, time, re, sys
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

def norm(s):
    return re.sub(r"\s+", " ", s or "").strip()

def extract_fields(page):
    fields = page.evaluate("""
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
        out.push({
          name: el.name || el.id || '',
          type: typ === 'select-one' ? 'select' : typ,
          label: label.replace(/\\*/g,'').trim(),
          required: !!el.required || (label.includes('*')),
          placeholder: el.placeholder || ''
        });
      }
      return out;
    }
    """)
    cleaned = []
    for f in fields:
        if f.get("type") == "password":
            f = {**f, "type": "password", "label": f.get("label") or "Senha", "sensitive": True}
        cleaned.append(f)
    return cleaned

def open_page(context):
    page = context.new_page()
    page.goto(URL, wait_until="networkidle", timeout=120000)
    page.wait_for_selector("button.btn-template-header", timeout=60000)
    time.sleep(1.5)
    return page

def click_product(page, index):
    page.evaluate("(i) => document.querySelectorAll('button.btn-template-header')[i]?.click()", index)
    time.sleep(1.8)

def visible_tool_buttons(page):
    return page.evaluate("""
    () => [...document.querySelectorAll('button.ai-tool-btn-small')]
      .filter(b => b.offsetParent !== null)
      .map(b => b.innerText.replace(/\\s+/g,' ').trim())
      .filter(Boolean)
    """)

def click_tool_by_label(page, label):
    page.evaluate("""
      (label) => {
        for (const b of document.querySelectorAll('button.ai-tool-btn-small, button.btn, a.btn')) {
          if (b.innerText.replace(/\\s+/g,' ').trim() === label) { b.click(); return true; }
        }
        return false;
      }
    """, label)
    time.sleep(1.8)

def go_back_templates(page):
    for sel in ["a:has-text('Voltar')", "button:has-text('Voltar')"]:
        loc = page.locator(sel).first
        if loc.count() and loc.is_visible():
            loc.click()
            time.sleep(1.5)
            return True
    page.goto(URL, wait_until="networkidle", timeout=120000)
    time.sleep(1.5)
    return False

catalog = {"source": URL, "scrapedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "products": []}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(ignore_https_errors=True)
    context.add_cookies(parse_netscape_cookies(COOKIE_FILE))

    product_names = ["Legal One", "Legal One Analytics", "HighQ"]
    for pi, pname in enumerate(product_names):
        page = open_page(context)
        click_product(page, pi)
        top_cats = visible_tool_buttons(page)
        # Analytics/HighQ may show cards directly as categories
        if pname == "Legal One":
            categories_spec = top_cats
        elif pname == "Legal One Analytics":
            categories_spec = top_cats if top_cats else ["Bug", "Servicios"]
        else:
            categories_spec = top_cats if top_cats else ["Bug General", "Bug Workflow", "Performance"]

        product_entry = {"id": slug(pname), "label": pname, "categories": []}

        for cat in categories_spec:
            page = open_page(context)
            click_product(page, pi)
            if not click_tool_by_label(page, cat):
                continue
            time.sleep(1)
            subs = visible_tool_buttons(page)
            # remove category labels duplicated
            subs = [s for s in subs if s != cat]
            sub_templates = []
            if subs:
                for sub in subs:
                    page = open_page(context)
                    click_product(page, pi)
                    click_tool_by_label(page, cat)
                    click_tool_by_label(page, sub)
                    fields = extract_fields(page)
                    sub_templates.append({"id": slug(sub), "label": sub, "fields": fields})
            else:
                # category opens form directly
                fields = extract_fields(page)
                if fields:
                    sub_templates.append({"id": slug(cat), "label": cat, "fields": fields})
            product_entry["categories"].append({"id": slug(cat), "label": cat, "subTemplates": sub_templates})
            page.close()

        catalog["products"].append(product_entry)
        sys.stdout.buffer.write((json.dumps({"done": pname, "cats": len(product_entry["categories"])}, ensure_ascii=False)+"\n").encode("utf-8"))

    browser.close()

out_path = OUT / "template-catalog-full.json"
out_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
sys.stdout.buffer.write(f"WROTE {out_path}\n".encode("utf-8"))
