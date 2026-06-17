"""Debug DOM structure of Legal One templates page."""
import re
import sys
from playwright.sync_api import sync_playwright

BASE = "http://ai-support-tools.legalone.com.br"
LOGIN = f"{BASE}/Account/Login?ReturnUrl=%2Fsuporte%2Ftemplates"


def main():
    email, password = sys.argv[1], sys.argv[2]
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        page.goto(LOGIN, wait_until="networkidle", timeout=60000)
        page.fill('input[name="Input.Email"]', email)
        page.fill('input[name="Input.Password"]', password)
        page.click('button[type="submit"]')
        page.wait_for_url(re.compile(r"/suporte/templates"), timeout=60000)
        page.wait_for_timeout(2000)

        headers = page.locator("button.btn-template-header")
        print("headers", headers.count())
        headers.first.click()
        page.wait_for_timeout(1500)

        html = page.locator(".container-fluid").filter(has_text="Criador de Templates").first.inner_html()
        open(r"c:\PARA LOGMEIN\XXXXXXXX\TEST EXES\PortalClienchiWEB\scripts\lo-expanded-snippet.html", "w", encoding="utf-8").write(html[:50000])

        # dump button texts
        for sel in [
            "button.btn-template-header",
            "button.btn-subcategory-header",
            "button.btn-category-header",
            ".template-card-wrapper",
            ".template-card",
            "button",
        ]:
            loc = page.locator(sel)
            n = min(loc.count(), 40)
            print(f"\n=== {sel} ({loc.count()}) ===")
            for i in range(n):
                t = re.sub(r"\s+", " ", loc.nth(i).inner_text()).strip()[:80]
                cls = loc.nth(i).get_attribute("class") or ""
                print(f"  [{i}] {t!r} class={cls[:60]}")

        browser.close()


if __name__ == "__main__":
    main()
