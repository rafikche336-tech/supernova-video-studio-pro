#!/usr/bin/env python3
"""
Generate `public/og.png` (1200×630), the Open Graph / Twitter card image.

    python3 -m venv .venv-clips && .venv-clips/bin/pip install pillow
    .venv-clips/bin/python scripts/generate-og-image.py

Only needs to be re-run when the branding changes.
"""

from __future__ import annotations

import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

WIDTH, HEIGHT = 1200, 630
BG = (5, 5, 7)
GOLD = (212, 175, 55)
GOLD_BRIGHT = (240, 207, 107)
WHITE = (255, 255, 255)
MUTED = (150, 150, 160)

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
FONT_REGULAR = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def load_font(paths: list[str], size: int) -> ImageFont.FreeTypeFont:
    for path in paths:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    raise SystemExit("No usable TTF font found; install fonts-dejavu.")


def star(path: ImageDraw.ImageDraw, cx: float, cy: float, radius: float) -> None:
    """Five-point gold star (matches app/icon.svg)."""
    points = []
    for index in range(10):
        angle = -math.pi / 2 + index * math.pi / 5
        r = radius if index % 2 == 0 else radius * 0.42
        points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    path.polygon(points, fill=GOLD)


def main() -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    canvas = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(canvas)

    # Soft radial glow, like the app's starfield centre.
    glow = Image.new("RGB", (WIDTH, HEIGHT), BG)
    glow_draw = ImageDraw.Draw(glow)
    for radius, colour in ((520, (26, 22, 12)), (360, (34, 29, 15)), (220, (42, 35, 18))):
        glow_draw.ellipse(
            (WIDTH / 2 - radius, -radius * 0.55, WIDTH / 2 + radius, radius * 1.2),
            fill=colour,
        )
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    canvas = Image.blend(canvas, glow, 0.85)
    draw = ImageDraw.Draw(canvas)

    # Starfield.
    rng = random.Random(11)
    for _ in range(190):
        x, y = rng.uniform(0, WIDTH), rng.uniform(0, HEIGHT)
        r = rng.uniform(0.6, 1.9)
        alpha = rng.uniform(0.16, 0.75)
        draw.ellipse((x, y, x + r, y + r), fill=tuple(int(c * alpha) for c in WHITE))

    # Meteor: three concentric strokes read as a tapered streak with a glow.
    meteor_start, meteor_end = (1010, 22), (742, 196)
    for width, colour in ((14, (38, 31, 12)), (7, (96, 78, 28)), (3, (176, 145, 48)), (1, GOLD_BRIGHT)):
        draw.line((*meteor_start, *meteor_end), fill=colour, width=width)

    title_font = load_font(FONT_CANDIDATES, 96)
    accent_font = load_font(FONT_CANDIDATES, 54)
    body_font = load_font(FONT_REGULAR, 30)
    pill_font = load_font(FONT_CANDIDATES, 24)

    star(draw, WIDTH / 2, 132, 44)

    def centre(text: str, font: ImageFont.FreeTypeFont, y: int, fill: tuple) -> None:
        left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
        draw.text(((WIDTH - (right - left)) / 2 - left, y), text, font=font, fill=fill)

    centre("SUPERNOVA", title_font, 196, WHITE)
    centre("VIDEO STUDIO PRO", accent_font, 316, GOLD_BRIGHT)
    centre("Eight engines. One studio. Describe a shot, get video.", body_font, 404, MUTED)

    # Demo-mode pill.
    pill_text = "DEMO MODE  ·  self-hosted sample clips"
    left, top, right, bottom = draw.textbbox((0, 0), pill_text, font=pill_font)
    pill_width, pill_height = (right - left) + 52, (bottom - top) + 26
    pill_x, pill_y = (WIDTH - pill_width) / 2, 474
    draw.rounded_rectangle(
        (pill_x, pill_y, pill_x + pill_width, pill_y + pill_height),
        radius=pill_height / 2,
        outline=GOLD,
        width=2,
        fill=(28, 23, 10),
    )
    draw.text(
        (pill_x + 26 - left, pill_y + 13 - top),
        pill_text,
        font=pill_font,
        fill=GOLD_BRIGHT,
    )

    target = os.path.join(root, "public", "og.png")
    canvas.save(target, optimize=True)
    print(f"✓ wrote {target} ({os.path.getsize(target) / 1024:,.0f} KB)")


if __name__ == "__main__":
    main()
