"""
Prueba visual de ST2: saca capturas de cada pantalla (tema claro y oscuro)
y las compara contra una referencia para detectar cambios no buscados.

Requisitos: app corriendo en local (dotnet run) y Playwright para Python
(`pip install playwright`). Usa el Edge instalado, no descarga navegadores.

Uso:
  python scripts/visual-check/visual_check.py capture <carpeta>
  python scripts/visual-check/visual_check.py compare <referencia> <nueva> [<salida-diffs>] [--threshold N]

--threshold: diferencia mínima por canal para contar un píxel (24 por defecto, ignora
antialiasing). Para revisar cambios de color sutiles a propósito, usar 4.

Flujo típico:
  1. capture antes   -> referencia
  2. hacer el cambio
  3. capture despues -> nueva
  4. compare antes despues diffs  (lista las pantallas que cambiaron y guarda el diff)
"""

from __future__ import annotations

import sys
from pathlib import Path

BASE_URL = "http://localhost:5180"

# Pantallas del shell (St2AppRoutes) más la página pública del Críptico.
SCREENS: list[tuple[str, str]] = [
    ("inicio", "/"),
    ("planillas", "/planillas"),
    ("transferencia", "/transferencia"),
    ("referral", "/referral"),
    ("oportunidad", "/oportunidad"),
    ("blanqueo", "/blanqueo"),
    ("borrado-bases", "/borrado-bases"),
    ("chile", "/chile"),
    ("pdf", "/pdf"),
    ("portal", "/portal"),
    ("admin", "/admin"),
    ("about", "/about"),
    ("herramientas", "/herramientas"),
    ("criptico-publico", "/criptico.html"),
]

THEMES = ("light", "dark")

# Congela todo lo que se mueve para que dos capturas iguales den igual.
FREEZE_CSS = """
*, *::before, *::after {
  animation: none !important;
  transition: none !important;
  caret-color: transparent !important;
}
canvas, video { visibility: hidden !important; }
#st2-tour-root, .st2-sonner, [data-sonner-toaster] { display: none !important; }
/* El contador de la campanita depende de avisos del momento. */
#st2-greet-bell { visibility: hidden !important; }
"""

# Ventana alta en vez de full_page: la app scrollea dentro de un contenedor y
# las decoraciones del header se salen del ancho (recortadas, sin scroll real).
VIEWPORT = {"width": 1440, "height": 2000}


def capture(out_dir: Path) -> None:
    from playwright.sync_api import sync_playwright

    out_dir.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        for theme in THEMES:
            context = browser.new_context(viewport=VIEWPORT, reduced_motion="reduce")
            context.add_init_script(
                f"try {{ localStorage.setItem('st2-theme', '{theme}'); }} catch (e) {{}}"
            )
            page = context.new_page()
            page.on(
                "pageerror",
                lambda e, t=theme: errors.append(f"[{t}] {e}"),
            )
            for name, path in SCREENS:
                try:
                    page.goto(BASE_URL + path, wait_until="networkidle", timeout=30000)
                except Exception as exc:  # pantalla que no termina de cargar
                    errors.append(f"[{theme}] {name}: {exc.__class__.__name__}")
                page.add_style_tag(content=FREEZE_CSS)
                page.wait_for_timeout(1200)
                page.screenshot(path=str(out_dir / f"{name}--{theme}.png"), full_page=False)
                print(f"  {name}--{theme}")
            context.close()
        browser.close()
    report = out_dir / "errores.txt"
    report.write_text("\n".join(errors) or "sin errores de JS", encoding="utf-8")
    print(f"Listo: {out_dir} ({len(errors)} errores de JS, ver errores.txt)")


def compare(base_dir: Path, new_dir: Path, diff_dir: Path | None, threshold: int = 24) -> int:
    from PIL import Image, ImageChops

    if diff_dir:
        diff_dir.mkdir(parents=True, exist_ok=True)
    changed = 0
    for base in sorted(base_dir.glob("*.png")):
        other = new_dir / base.name
        if not other.exists():
            print(f"FALTA     {base.name}")
            changed += 1
            continue
        a = Image.open(base).convert("RGB")
        b = Image.open(other).convert("RGB")
        if a.size != b.size:
            print(f"TAMANO    {base.name}: {a.size} -> {b.size}")
            changed += 1
            continue
        diff = ImageChops.difference(a, b).convert("L").point(lambda v: 255 if v > threshold else 0)
        box = diff.getbbox()
        if not box:
            print(f"igual     {base.name}")
            continue
        pixels = sum(1 for v in diff.getdata() if v)
        pct = 100 * pixels / (a.size[0] * a.size[1])
        print(f"CAMBIO    {base.name}: {pct:.3f}% en {box}")
        changed += 1
        if diff_dir:
            # Original con la zona que cambió marcada en rojo, para mirar rápido.
            red = Image.new("RGB", a.size, (255, 0, 0))
            marked = Image.composite(red, b, diff)
            marked.save(diff_dir / base.name)
    print(f"\n{changed} pantalla(s) con diferencias.")
    return changed


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[0] == "capture":
        capture(Path(argv[1]))
        return 0
    if len(argv) >= 3 and argv[0] == "compare":
        threshold = 24
        if "--threshold" in argv:
            i = argv.index("--threshold")
            threshold = int(argv[i + 1])
            argv = argv[:i] + argv[i + 2:]
        diff_dir = Path(argv[3]) if len(argv) >= 4 else None
        return 1 if compare(Path(argv[1]), Path(argv[2]), diff_dir, threshold) else 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
