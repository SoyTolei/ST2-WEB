import sys
from playwright.sync_api import sync_playwright
BASE = "http://ai-support-tools.legalone.com.br"
LOGIN = f"{BASE}/Account/Login?ReturnUrl=%2Fsuporte%2Ftemplates"
email, password = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page(viewport={"width":1440,"height":960})
    page.goto(LOGIN, wait_until="networkidle", timeout=90000)
    page.fill('input[name="Input.Email"]', email)
    page.fill('input[name="Input.Password"]', password)
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    page.wait_for_selector("button.btn-template-header")
    page.wait_for_timeout(3000)
    h = page.locator("button.btn-template-header")
    print("before", h.count())
    h.nth(0).scroll_into_view_if_needed()
    h.nth(0).click(force=True)
    try:
        page.wait_for_function("() => document.querySelectorAll('button.btn-template-header').length > 5", timeout=15000)
    except Exception as e:
        print("wait fail", e)
    page.wait_for_timeout(2000)
    h = page.locator("button.btn-template-header")
    print("after", h.count())
    for i in range(h.count()):
        print(i, h.nth(i).inner_text().replace("\n"," ")[:70])
    page.screenshot(path=r"c:\PARA LOGMEIN\XXXXXXXX\TEST EXES\PortalClienchiWEB\scripts\lo-screenshot.png", full_page=True)
