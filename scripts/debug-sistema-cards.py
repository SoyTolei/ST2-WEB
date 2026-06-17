import sys
from playwright.sync_api import sync_playwright
BASE = "http://ai-support-tools.legalone.com.br"
LOGIN = f"{BASE}/Account/Login?ReturnUrl=%2Fsuporte%2Ftemplates"

def login(page, email, password):
    page.goto(LOGIN, wait_until="networkidle", timeout=90000)
    page.fill('input[name="Input.Email"]', email)
    page.fill('input[name="Input.Password"]', password)
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    page.wait_for_selector("button.btn-template-header")
    page.wait_for_timeout(2000)

email, password = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page(viewport={"width":1440,"height":960})
    login(page, email, password)
    h = page.locator("button.btn-template-header")
    h.nth(0).click()
    page.wait_for_function("() => document.querySelectorAll('button.btn-template-header').length > 5")
    page.wait_for_timeout(1000)
    page.locator("button.btn-template-header").nth(1).click()  # Sistema
    page.wait_for_timeout(2000)
    cards = page.locator(".template-card-wrapper")
    print("cards", cards.count())
    for i in range(cards.count()):
        print(i, cards.nth(i).inner_text().replace("\n"," | ")[:100])
