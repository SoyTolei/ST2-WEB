"""Scrape full Legal One templates catalog."""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://ai-support-tools.legalone.com.br"
LOGIN = f"{BASE}/Account/Login?ReturnUrl=%2Fsuporte%2Ftemplates"
TEMPLATES = f"{BASE}/suporte/templates"
OUT = Path(__file__).resolve().parent / "legalone-templates-catalog.json"

PRODUCTS = ["Legal One", "Legal One Analytics", "HighQ"]


def slug(s: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower().strip())).strip("-") or "item"


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def login(page, email: str, password: str) -> None:
    page.goto(LOGIN, wait_until="networkidle", timeout=120000)
    page.fill('input[name="Input.Email"]', email)
    page.fill('input[name="Input.Password"]', password)
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    page.wait_for_selector("button.btn-template-header", timeout=60000)
    page.wait_for_timeout(2500)


def goto_templates(page) -> None:
    page.goto(TEMPLATES, wait_until="networkidle", timeout=120000)
    page.wait_for_selector("button.btn-template-header", timeout=60000)
    page.wait_for_timeout(2000)


def header_labels(page) -> list[str]:
    return [norm(x) for x in page.locator("button.btn-template-header").all_inner_texts()]


def click_header_label(page, label: str) -> None:
    btn = page.locator("button.btn-template-header").filter(
        has=page.locator(f"strong:text-is('{label}')")
    )
    btn.first.scroll_into_view_if_needed()
    btn.first.click()
    page.wait_for_timeout(1400)


def scrape_form(page) -> dict:
    page.wait_for_timeout(1000)
    title = ""
    if page.locator("h4, h5").count():
        title = norm(page.locator("h4, h5").first.inner_text())

    fields = []
    for inp in page.locator("input:not([type=hidden]):not([type=submit]), textarea, select").all():
        fid = inp.get_attribute("id") or inp.get_attribute("name") or ""
        ftype = inp.get_attribute("type") or inp.evaluate("el => el.tagName.toLowerCase()")
        placeholder = inp.get_attribute("placeholder") or ""
        flabel = ""
        if fid:
            lab = page.locator(f'label[for="{fid}"]')
            if lab.count():
                flabel = norm(lab.first.inner_text())
        if not flabel:
            flabel = norm(inp.evaluate(
                """el => {
                    const p = el.closest('.mb-3,.form-group,.field');
                    if (!p) return '';
                    const l = p.querySelector('label');
                    return l ? l.innerText : '';
                }"""
            ))
        fields.append({"id": fid, "label": flabel, "type": ftype, "placeholder": placeholder})

    blocks = []
    for sel in [".ql-editor", ".alert-info", ".alert-warning", "pre", "p.lead"]:
        for el in page.locator(sel).all():
            t = norm(el.inner_text())
            if len(t) > 25:
                blocks.append(t[:3000])

    actions = []
    for b in page.locator("button").all():
        t = norm(b.inner_text())
        if t and any(k in t.lower() for k in ("gerar", "copiar", "voltar", "limpar")):
            actions.append(t)

    return {"title": title, "fields": fields, "blocks": blocks[:8], "actions": actions}


def card_labels(page) -> list[str]:
    labels = []
    cards = page.locator(".template-card-wrapper")
    for i in range(cards.count()):
        t = norm(cards.nth(i).inner_text())
        first = t.split("★")[0].strip().split("\n")[0].strip()
        if first:
            labels.append(first)
    return labels


def scrape(email: str, password: str) -> dict:
    catalog = {"products": [], "scrapedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 960})
        login(page, email, password)

        for product in PRODUCTS:
            print(f"\n=== {product} ===")
            goto_templates(page)
            click_header_label(page, product)

            labels = header_labels(page)
            categories = [x for x in labels if x not in PRODUCTS and x != product]
            prod = {"id": slug(product), "label": product, "categories": []}

            if categories:
                for cat in categories:
                    print(f"  cat: {cat}")
                    goto_templates(page)
                    click_header_label(page, product)
                    click_header_label(page, cat)
                    tpl_names = card_labels(page)
                    print(f"    templates: {len(tpl_names)} -> {tpl_names}")

                    cat_obj = {"id": slug(cat), "label": cat, "templates": []}
                    for tpl_name in tpl_names:
                        goto_templates(page)
                        click_header_label(page, product)
                        click_header_label(page, cat)
                        card = page.locator(".template-card-wrapper").filter(has_text=tpl_name).first
                        card.click()
                        page.wait_for_timeout(1200)
                        form = scrape_form(page)
                        form["id"] = slug(tpl_name)
                        form["label"] = tpl_name
                        cat_obj["templates"].append(form)
                        print(f"      ok: {tpl_name} ({len(form['fields'])} fields)")

                    prod["categories"].append(cat_obj)
            else:
                tpl_names = card_labels(page)
                print(f"  direct templates: {tpl_names}")
                cat_obj = {"id": "general", "label": product, "templates": []}
                for tpl_name in tpl_names:
                    goto_templates(page)
                    click_header_label(page, product)
                    card = page.locator(".template-card-wrapper").filter(has_text=tpl_name).first
                    card.click()
                    page.wait_for_timeout(1200)
                    form = scrape_form(page)
                    form["id"] = slug(tpl_name)
                    form["label"] = tpl_name
                    cat_obj["templates"].append(form)
                    print(f"    ok: {tpl_name}")
                prod["categories"].append(cat_obj)

            catalog["products"].append(prod)

        browser.close()
    return catalog


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: scrape-legalone-templates.py email password", file=sys.stderr)
        return 1
    data = scrape(sys.argv[1], sys.argv[2])
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    n = sum(len(c["templates"]) for p in data["products"] for c in p["categories"])
    print(f"\nSaved {OUT} ({n} templates)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
