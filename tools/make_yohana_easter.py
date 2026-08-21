"""Quita fondo negro casi puro de PNG/JPEG/GIF y guarda en wwwroot/img."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "src" / "PortalClienchi.Web" / "wwwroot" / "img"


def strip_black(im: Image.Image, thresh: int = 28) -> Image.Image:
    im = im.convert("RGBA")
    pixels = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
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


def crop_opaque(im: Image.Image, pad: int = 4) -> Image.Image:
    pixels = im.load()
    w, h = im.size
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            if pixels[x, y][3] > 0:
                xs.append(x)
                ys.append(y)
    if not xs:
        return im
    left = max(0, min(xs) - pad)
    right = min(w, max(xs) + pad + 1)
    top = max(0, min(ys) - pad)
    bottom = min(h, max(ys) + pad + 1)
    return im.crop((left, top, right, bottom))


def process(src: Path) -> Path:
    src = src.resolve()
    im = Image.open(src)
    n_frames = getattr(im, "n_frames", 1)
    animated = n_frames > 1 or bool(getattr(im, "is_animated", False))

    if animated:
        frames = []
        durations = []
        bbox = None
        for frame in ImageSequence.Iterator(im):
            cleaned = strip_black(frame.copy())
            frames.append(cleaned)
            durations.append(frame.info.get("duration", 80))
            # accumulate bbox
            px = cleaned.load()
            w, h = cleaned.size
            for y in range(h):
                for x in range(w):
                    if px[x, y][3] > 0:
                        if bbox is None:
                            bbox = [x, y, x, y]
                        else:
                            bbox[0] = min(bbox[0], x)
                            bbox[1] = min(bbox[1], y)
                            bbox[2] = max(bbox[2], x)
                            bbox[3] = max(bbox[3], y)
        if bbox:
            pad = 4
            box = (
                max(0, bbox[0] - pad),
                max(0, bbox[1] - pad),
                min(frames[0].size[0], bbox[2] + pad + 1),
                min(frames[0].size[1], bbox[3] + pad + 1),
            )
            frames = [f.crop(box) for f in frames]
        out = OUT_DIR / "yohana-corner.gif"
        frames[0].save(
            out,
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=0,
            disposal=2,
            transparency=0,
            optimize=False,
        )
        # Also keep a PNG first-frame fallback
        frames[0].save(OUT_DIR / "yohana-corner.png", "PNG")
        print(f"GIF animado: {out} ({len(frames)} frames)")
        return out

    cleaned = crop_opaque(strip_black(im))
    out = OUT_DIR / "yohana-corner.png"
    cleaned.save(out, "PNG")
    print(f"PNG estático: {out} {cleaned.size} (el origen no era GIF animado)")
    return out


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python make_yohana_easter.py <ruta-gif-o-imagen>")
        sys.exit(1)
    process(Path(sys.argv[1]))
