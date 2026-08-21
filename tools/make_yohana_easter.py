"""Quita solo el fondo negro (flood desde bordes) y genera el GIF del easter egg.

Uso:
  python tools/make_yohana_easter.py <ruta.gif>           # liviano
  python tools/make_yohana_easter.py <ruta.gif> --full    # todos los frames, máxima calidad
"""
from __future__ import annotations

import shutil
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "src" / "PortalClienchi.Web" / "wwwroot" / "img"
OUT_GIF = OUT_DIR / "yohana-corner.gif"
OUT_PNG = OUT_DIR / "yohana-corner.png"
ORIGINAL_BAK = OUT_DIR / "yohana-corner.original.gif"


def strip_black_bg(im: Image.Image, thresh: int = 32) -> Image.Image:
    """Solo transparenta negros conectados a los bordes (no come el pelo negro)."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    def is_bg(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a < 8:
            return True
        return r <= thresh and g <= thresh and b <= thresh

    seen = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def try_seed(x: int, y: int) -> None:
        i = y * w + x
        if seen[i]:
            return
        if not is_bg(x, y):
            return
        seen[i] = 1
        q.append((x, y))

    for x in range(w):
        try_seed(x, 0)
        try_seed(x, h - 1)
    for y in range(h):
        try_seed(0, y)
        try_seed(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = x + dx, y + dy
            if nx < 0 or ny < 0 or nx >= w or ny >= h:
                continue
            i = ny * w + nx
            if seen[i]:
                continue
            if is_bg(nx, ny):
                seen[i] = 1
                q.append((nx, ny))
    return im


def fit(im: Image.Image, max_side: int) -> Image.Image:
    w, h = im.size
    scale = min(1.0, max_side / max(w, h))
    if scale >= 1:
        return im
    nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
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


def rgba_to_palette(im: Image.Image, colors: int = 255) -> Image.Image:
    """Convierte RGBA → P con transparencia en índice 0 (seguro en navegadores)."""
    rgba = im.convert("RGBA")
    w, h = rgba.size
    # Magenta de croma fuera de la paleta del sprite
    chroma = (255, 0, 255)
    rgb_pixels = []
    alpha = []
    for r, g, b, a in rgba.getdata():
        alpha.append(a)
        rgb_pixels.append(chroma if a < 16 else (r, g, b))
    rgb = Image.new("RGB", (w, h))
    rgb.putdata(rgb_pixels)
    pal = rgb.convert("P", palette=Image.Palette.ADAPTIVE, colors=max(2, min(255, colors)))
    palette = list(pal.getpalette() or [])
    while len(palette) < 768:
        palette.append(0)

    # Índice del chroma
    chroma_idx = None
    for i in range(256):
        r, g, b = palette[i * 3], palette[i * 3 + 1], palette[i * 3 + 2]
        if (r, g, b) == chroma or (r >= 250 and g <= 8 and b >= 250):
            chroma_idx = i
            break

    src = list(pal.getdata())
    # Remap: 0 = transparente; si un color opaco usaba 0, intercambiar con chroma_idx
    if chroma_idx is None:
        chroma_idx = 0

    # Construir nueva paleta donde slot 0 es negro dummy (transparente)
    new_pal = palette[:]
    out_data = []
    for i, idx in enumerate(src):
        if alpha[i] < 16 or idx == chroma_idx:
            out_data.append(0)
        elif idx == 0:
            # Color real que cayó en índice 0: mover a chroma_idx si libre, si no a 1
            out_data.append(chroma_idx if chroma_idx != 0 else 1)
        else:
            out_data.append(idx)

    out = Image.new("P", (w, h))
    out.putpalette(new_pal)
    out.putdata(out_data)
    out.info["transparency"] = 0
    return out


def process(src: Path, *, full: bool = False) -> Path:
    src = src.resolve()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Nunca destruir el original: siempre trabajamos desde .original.gif
    if src == OUT_GIF.resolve():
        if not ORIGINAL_BAK.exists() or src.stat().st_size >= ORIGINAL_BAK.stat().st_size:
            shutil.copy2(src, ORIGINAL_BAK)
            print(f"Original guardado: {ORIGINAL_BAK} ({ORIGINAL_BAK.stat().st_size} bytes)")
        work = ORIGINAL_BAK
    else:
        shutil.copy2(src, ORIGINAL_BAK)
        work = ORIGINAL_BAK
        print(f"Original guardado: {ORIGINAL_BAK} ({ORIGINAL_BAK.stat().st_size} bytes)")

    im = Image.open(work)
    n_frames = getattr(im, "n_frames", 1)
    animated = n_frames > 1 or bool(getattr(im, "is_animated", False))
    max_side = 240 if full else 96
    max_frames = 9999 if full else 48
    colors = 255 if full else 96

    if animated:
        step = max(1, n_frames // max_frames) if not full else 1
        frames: list[Image.Image] = []
        durations: list[int] = []
        for i, frame in enumerate(ImageSequence.Iterator(im)):
            if i % step != 0:
                continue
            cleaned = fit(strip_black_bg(frame.copy()), max_side)
            frames.append(cleaned)
            dur = int(frame.info.get("duration", 80) or 80)
            durations.append(max(20, dur * step))

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
        frames[0].save(OUT_PNG, "PNG")
        print(
            f"GIF: {OUT_GIF} frames={len(qframes)} size={qframes[0].size} "
            f"bytes={OUT_GIF.stat().st_size} full={full}"
        )
        return OUT_GIF

    cleaned = fit(strip_black_bg(im), max_side)
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
