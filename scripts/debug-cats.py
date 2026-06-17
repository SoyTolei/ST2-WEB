import re, sys
from playwright.sync_api import sync_playwright
BASE = "http://ai-support-tools.legalone.com.br"
LOGIN = f"{BASE}/Account/Login?ReturnUrl=%2Fsuporte%2Ftemplates"

email, password = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page(viewport={"width":1440,"height":960})
    page.goto(LOGIN, wait_until="domcontentloaded")
    page.fill('input[name="Input.Email"]', email)
    page.fill('input[name="Input.Password"]', password)
    page.click('button[type="submit"]')
    page.wait_for_selector("button.btn-template-header")
    page.locator("button.btn-template-header").filter(has=page.locator("strong:text-is('Legal One')")).click()
    page.wait_for_timeout(1500)
    for sel in [
        "div.mb-3.ms-4 button.btn-template-header strong",
        "div.mt-2 button.btn-template-header strong",
        "button.btn-template-header strong",
    ]:
        loc = page.locator(sel)
        print(sel, loc.count())
        for i in range(min(loc.count(), 20)):
            print(" ", loc.nth(i).inner_text().strip())
