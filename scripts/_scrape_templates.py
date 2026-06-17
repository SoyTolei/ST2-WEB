import re, json, time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(r"c:\PARA LOGMEIN\XXXXXXXX\TEST EXES\PortalClienchiWEB\scripts")
COOKIE_FILE = Path(r"C:\Users\6128530\AppData\Local\Temp\lo-cookies2.txt")
URL = "http://ai-support-tools.legalone.com.br/suporte/templates"

def parse_netscape_cookies(path):
    cookies = []
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if not line or line.startswith("#"):
            if line.startswith("#HttpOnly_"):
                line = line[10:]
            else:
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
            "httpOnly": flag.upper() == "TRUE" or "#HttpOnly" in domain,
            "secure": secure.upper() == "TRUE",
        })
    return cookies

html_dump = OUT / "scrape_playwright_templates.html"
screenshot = OUT / "scrape_playwright_templates.png"
catalog_json = OUT / "template-catalog-scraped.json"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(ignore_https_errors=True)
    if COOKIE_FILE.exists():
        context.add_cookies(parse_netscape_cookies(COOKIE_FILE))
    page = context.new_page()
    page.goto(URL, wait_until="networkidle", timeout=120000)
    time.sleep(2)
    if "Login" in page.title() or page.locator('input[name="Input.Email"]').count():
        print("LOGIN_REQUIRED")
    # expand product headers
    headers = page.locator("button.btn-template-header")
    n = headers.count()
    print("headers", n)
    for i in range(n):
        headers.nth(i).click()
        time.sleep(0.8)
    # expand nested category buttons if any
    for _ in range(3):
        subs = page.locator("button.btn-template-header.active, button.btn-template-subheader, .template-card-wrapper button")
        c = subs.count()
        if c == 0:
            break
        for i in range(min(c, 50)):
            try:
                subs.nth(i).click(timeout=2000)
                time.sleep(0.3)
            except Exception:
                pass
    html_dump.write_text(page.content(), encoding="utf-8")
    page.screenshot(path=str(screenshot), full_page=True)
    # extract structure via evaluate
    data = page.evaluate("""
    () => {
      const products = [];
      document.querySelectorAll('.mb-3').forEach(block => {
        const hdr = block.querySelector('button.btn-template-header');
        if (!hdr) return;
        const plabel = hdr.innerText.trim();
        const categories = [];
        block.querySelectorAll('.template-section, .category-section, .accordion-item').forEach(cat => {
          categories.push({html: cat.innerHTML.slice(0,500)});
        });
        products.push({label: plabel, html: block.innerHTML.slice(0, 8000)});
      });
      return {title: document.title, url: location.href, products, bodyText: document.body.innerText.slice(0, 50000)};
    }
    """)
    catalog_json.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("saved", catalog_json, "text_len", len(data.get("bodyText","")))
    browser.close()
