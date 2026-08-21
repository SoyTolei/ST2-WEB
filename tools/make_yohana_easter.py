"""Quita fondo negro y genera GIF animado para el easter egg del hero.

Uso:
  python tools/make_yohana_easter.py <ruta.gif>           # liviano (~96px, ~48 frames)
  python tools/make_yohana_easter.py <ruta.gif> --full    # todos los frames, más grande
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "src" / "PortalClienchi.Web" / "wwwroot" / "img"
OUT_GIF = OUT_DIR / "yohana-corner.gif"
OUT_PNG = OUT_DIR / "yohana-corner.png"


def strip_black(im: Image.Image, thresh: int = 28) -> Image.Image:
    im = im.convert("RGBA")
    pixels = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, _a = pixels[x, y]
            if r <= thresh and g <= thresh and b <= thresh:
                pixels[x, y] = (0, 0, 0, 0)
    for _ in range(2):
        for y in range(h):
            for x in range(w):
                r, g, b, a = pixels[x, y]
                if a == 0 or r > 40 or g > 40 or b > 40:
                    continue
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and pixels[nx, ny][3] == 0:
                        pixels[x, y] = (0, 0, 0, 0)
                        break
    return im


def fit(im: Image.Image, max_side: int) -> Image.Image:
    w, h = im.size
    scale = min(1.0, max_side / max(w, h))
    if scale >= 1:
        return im
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    return im.resize((nw, nh), Image.Resampling.NEAREST)


def opaque_bbox(im: Image.Image, pad: int = 2):
    px = im.load()
    w, h = im.size
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 0:
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return (
        max(0, min(xs) - pad),
        max(0, min(ys) - pad),
        min(w, max(xs) + pad + 1),
        min(h, max(ys) + pad + 1),
    )


def rgba_to_palette(im: Image.Image, colors: int = 128) -> Image.Image:
    """GIF-compatible palette frame with real transparency (browser-safe)."""
    rgba = im.convert("RGBA")
    alpha = rgba.split()[-1]
    # Reserve last palette index for transparent
    rgb = Image.new("RGB", rgba.size, (0, 0, 0))
    rgb.paste(rgba, mask=alpha.point(lambda a: 255 if a >= 16 else 0))
    pal = rgb.convert("P", palette=Image.Palette.ADAPTIVE, colors=max(2, colors - 1))
    # Force transparent pixels to index 0 and mark transparency
    mask = alpha.point(lambda a: 255 if a < 16 else 0)
    # Rebuild with transparent index at 0: paste opaque palette onto blank
    blank = Image.new("P", rgba.size, 0)
    blank.putpalette(pal.getpalette())
    blank.paste(pal, mask=Image.eval(mask, lambda v: 0 if v else 255))
    blank.info["transparency"] = 0
    return blank


def process(src: Path, *, full: bool = False) -> Path:
    src = src.resolve()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Never overwrite the only copy of a heavy source in-place before reading
    work = src
    if src == OUT_GIF.resolve():
        bak = OUT_DIR / "yohana-corner.src.gif"
        shutil.copy2(src, bak)
        work = bak
        print(f"Backup fuente: {bak} ({bak.stat().st_size} bytes)")

    im = Image.open(work)
    n_frames = getattr(im, "n_frames", 1)
    animated = n_frames > 1 or bool(getattr(im, "is_animated", False))
    max_side = 160 if full else 96
    max_frames = 9999 if full else 48
    colors = 192 if full else 96

    if animated:
        step = max(1, n_frames // max_frames) if not full else 1
        frames: list[Image.Image] = []
        durations: list[int] = []
        for i, frame in enumerate(ImageSequence.Iterator(im)):
            if i % step != 0:
                continue
            cleaned = fit(strip_black(frame.copy()), max_side)
            frames.append(cleaned)
            dur = int(frame.info.get("duration", 80))
            durations.append(max(40, dur * step))

        box = None
        for f in frames:
            b = opaque_bbox(f)
            if not b:
                continue
            if box is None:
                box = list(b)
            else:
                box[0] = min(box[0], b[0])
                box[1] = min(box[1], b[1])
                box[2] = max(box[2], b[2])
                box[3] = max(box[3], b[3])
        if box:
            frames = [f.crop(tuple(box)) for f in frames]

        qframes = [rgba_to_palette(f, colors=colors) for f in frames]
        qframes[0].save(
            OUT_GIF,
            save_all=True,
            append_images=qframes[1:],
            duration=durations[: len(qframes)],
            loop=0,
            disposal=2,
            transparency=0,
            optimize=False,
        )
        # Preview estático solo para herramientas locales (no lo usa el sitio)
        frames[0].save(OUT_PNG, "PNG")
        print(
            f"GIF: {OUT_GIF} frames={len(qframes)} size={qframes[0].size} "
            f"bytes={OUT_GIF.stat().st_size} full={full}"
        )
        return OUT_GIF

    cleaned = fit(strip_black(im), max_side)
    box = opaque_bbox(cleaned)
    if box:
        cleaned = cleaned.crop(box)
    cleaned.save(OUT_PNG, "PNG")
    print(f"PNG (sin animación): {OUT_PNG} {cleaned.size}")
    return OUT_PNG


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python make_yohana_easter.py <ruta> [--full]")
        sys.exit(1)
    full = "--full" in sys.argv[2:]
    process(Path(sys.argv[1]), full=full)
