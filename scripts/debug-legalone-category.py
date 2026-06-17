"""Debug one category expansion."""
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
        page.wait_for_timeout(1500)

        page.get_by_role("button", name=re.compile(r"Legal One$")).click()
        page.wait_for_timeout(1000)
        page.locator("button.btn-template-header strong", has_text="Sistema").locator("xpath=ancestor::button[1]").click()
        page.wait_for_timeout(1200)

        html = page.locator(".container-fluid").filter(has_text="Criador de Templates").first.inner_html()
        out = r"c:\PARA LOGMEIN\XXXXXXXX\TEST EXES\PortalClienchiWEB\scripts\lo-sistema-expanded.html"
        open(out, "w", encoding="utf-8").write(html)

        for sel in [
            ".template-card-wrapper",
            ".template-card",
            ".card.h-100",
            "a.template-card",
            "button.template-card",
            ".col-md-3",
            ".col-md-4",
            ".row.g-3",
        ]:
            loc = page.locator(sel)
            print(f"{sel}: {loc.count()}")
            for i in range(min(loc.count(), 15)):
                print(" ", re.sub(r"\s+", " ", loc.nth(i).inner_text()).strip()[:100])

        browser.close()
        print("saved", out)


if __name__ == "__main__":
    main()
