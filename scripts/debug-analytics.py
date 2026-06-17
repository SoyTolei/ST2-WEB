import sys
from playwright.sync_api import sync_playwright
BASE = "http://ai-support-tools.legalone.com.br"
LOGIN = f"{BASE}/Account/Login?ReturnUrl=%2Fsuporte%2Ftemplates"

def login(page, e, p):
    page.goto(LOGIN, wait_until="networkidle", timeout=90000)
    page.fill('input[name="Input.Email"]', e)
    page.fill('input[name="Input.Password"]', p)
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

def expand(page, idx):
    page.locator("button.btn-template-header").nth(idx).click()
    page.wait_for_timeout(1500)

email, password = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page(viewport={"width":1440,"height":960})
    login(page, email, password)
    expand(page, 8)  # Analytics - but need Legal One collapsed first
    cards = page.locator(".template-card-wrapper")
    print("analytics cards", cards.count())
    for i in range(cards.count()):
        print(i, cards.nth(i).inner_text().replace("\n"," | ")[:80])
