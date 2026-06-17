import re, json, time
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
        cookies.append({
            "name": name,
            "value": value,
            "domain": domain.lstrip("."),
            "path": p,
            "httpOnly": http_only or flag.upper() == "TRUE",
            "secure": secure.upper() == "TRUE",
        })
    return cookies

def scrape_fields(page):
    fields = []
    for inp in page.locator("input, textarea, select").all():
        try:
            if not inp.is_visible():
                continue
            tag = inp.evaluate("el => el.tagName.toLowerCase()")
            typ = inp.get_attribute("type") or ("textarea" if tag=="textarea" else tag)
            if typ in ("hidden", "checkbox", "submit", "button"):
                continue
            name = inp.get_attribute("name") or inp.get_attribute("id") or ""
            placeholder = inp.get_attribute("placeholder") or ""
            required = inp.evaluate("el => el.required")
            label = inp.evaluate("""
              el => {
                const id = el.id;
                if (id) {
                  const l = document.querySelector(`label[for='${id}']`);
                  if (l) return l.innerText.trim();
                }
                const p = el.closest('.mb-3,.form-group,.col');
                if (p) {
                  const l = p.querySelector('label');
                  if (l) return l.innerText.trim();
                }
                return '';
              }
            """)
            fields.append({"name": name, "type": typ, "label": label, "required": required, "placeholder": placeholder})
        except Exception:
            pass
    return fields

catalog = {"products": []}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(ignore_https_errors=True)
    context.add_cookies(parse_netscape_cookies(COOKIE_FILE))
    page = context.new_page()
    page.goto(URL, wait_until="domcontentloaded", timeout=120000)
    page.wait_for_selector("button.btn-template-header", timeout=60000)
    time.sleep(3)
    headers = page.locator("button.btn-template-header")
    count = headers.count()
    for hi in range(count):
        btn = headers.nth(hi)
        product_label = btn.inner_text().strip().replace("\n", " ")
        btn.click(force=True)
        time.sleep(1.2)
        # category buttons inside expanded section - may be ai-tool-btn-small or nested headers
        cat_buttons = page.locator("button.ai-tool-btn-small:visible, button.btn-template-header.active ~ div button, .template-card-wrapper button.ai-tool-btn-small")
        # broader: all visible small tool buttons after expand
        cat_buttons = page.locator("button.ai-tool-btn-small")
        cats = []
        cat_count = cat_buttons.count()
        for ci in range(cat_count):
            cb = cat_buttons.nth(ci)
            if not cb.is_visible():
                continue
            cat_label = cb.inner_text().strip()
            cb.click(force=True)
            time.sleep(1)
            # sub templates
            subs = page.locator("button.ai-tool-btn-small:visible")
            sub_templates = []
            # if same buttons, look for template cards in modal/panel
            cards = page.locator(".template-card-wrapper button, .modal button.ai-tool-btn-small, a.ai-tool-btn-small")
            card_count = cards.count()
            for si in range(card_count):
                card = cards.nth(si)
                if not card.is_visible():
                    continue
                slabel = card.inner_text().strip()
                card.click(force=True)
                time.sleep(0.8)
                fields = scrape_fields(page)
                sub_templates.append({"id": re.sub(r"[^a-z0-9]+","-", slabel.lower()).strip("-"), "label": slabel, "fields": fields})
                # close modal if any
                for sel in ["button.btn-close", "button:has-text('Fechar')", "button:has-text('Voltar')"]:
                    loc = page.locator(sel).first
                    if loc.count() and loc.is_visible():
                        try:
                            loc.click(timeout=1000)
                            time.sleep(0.3)
                        except Exception:
                            pass
            cats.append({"id": re.sub(r"[^a-z0-9]+","-", cat_label.lower()).strip("-"), "label": cat_label, "subTemplates": sub_templates})
        catalog["products"].append({"label": product_label, "categories": cats})
        # collapse? click header again
        btn.click(force=True)
        time.sleep(0.5)

    (OUT / "template-catalog-playwright-v2.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "scrape_playwright_body.txt").write_text(page.locator("body").inner_text(), encoding="utf-8")
    print(json.dumps({"products": len(catalog["products"]), "body_preview": page.locator("body").inner_text()[:800]}, ensure_ascii=False))
    browser.close()
