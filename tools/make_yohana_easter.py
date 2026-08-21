"""Quita fondo negro y reduce GIF/PNG para el easter egg del hero."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "src" / "PortalClienchi.Web" / "wwwroot" / "img"
MAX_SIDE = 96


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


def fit(im: Image.Image, max_side: int = MAX_SIDE) -> Image.Image:
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


def process(src: Path) -> Path:
    src = src.resolve()
    im = Image.open(src)
    n_frames = getattr(im, "n_frames", 1)
    animated = n_frames > 1 or bool(getattr(im, "is_animated", False))

    if animated:
        # Sample frames if too many (keep ~24fps feel for idle bob)
        step = max(1, n_frames // 48)  # cap ~48 frames
        frames = []
        durations = []
        for i, frame in enumerate(ImageSequence.Iterator(im)):
            if i % step != 0:
                continue
            cleaned = fit(strip_black(frame.copy()))
            frames.append(cleaned)
            durations.append(max(40, int(frame.info.get("duration", 80) * step)))

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

        # Quantize for smaller GIF
        qframes = []
        for f in frames:
            q = f.convert("RGBA")
            # composite on transparent then palette
            alpha = q.split()[-1]
            pal = q.convert("RGB").convert(
                "P", palette=Image.Palette.ADAPTIVE, colors=64
            )
            # restore transparency for near-zero alpha
            mask = alpha.point(lambda a: 255 if a < 16 else 0)
            pal.info["transparency"] = 0
            # Use disposal-friendly approach: convert via RGBA paste
            rgba = q.copy()
            qframes.append(rgba)

        out = OUT_DIR / "yohana-corner.gif"
        qframes[0].save(
            out,
            save_all=True,
            append_images=qframes[1:],
            duration=durations[: len(qframes)],
            loop=0,
            disposal=2,
            optimize=False,
        )
        qframes[0].save(OUT_DIR / "yohana-corner.png", "PNG")
        print(f"GIF: {out} frames={len(qframes)} size={qframes[0].size} bytes={out.stat().st_size}")
        return out

    cleaned = fit(strip_black(im))
    box = opaque_bbox(cleaned)
    if box:
        cleaned = cleaned.crop(box)
    out = OUT_DIR / "yohana-corner.png"
    cleaned.save(out, "PNG")
    print(f"PNG: {out} {cleaned.size}")
    return out


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python make_yohana_easter.py <ruta>")
        sys.exit(1)
    process(Path(sys.argv[1]))
