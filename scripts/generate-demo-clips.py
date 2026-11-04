#!/usr/bin/env python3
"""
Generate the royalty-free demo clips served from `public/media/`.

The studio ships in *demo mode*: instead of pretending to run a diffusion model,
it plays short, original, procedurally generated clips. Generating them here
(instead of hotlinking third-party sample videos) means:

  * we own the rights to every frame (CC0 — see THIRD_PARTY_NOTICES.md),
  * playback is same-origin, so downloads and CSP work without CORS exceptions,
  * the app does not depend on anyone else's uptime.

Usage (only needed when you want to regenerate the assets):

    python3 -m venv .venv-clips
    .venv-clips/bin/pip install numpy pillow imageio-ffmpeg
    .venv-clips/bin/python scripts/generate-demo-clips.py

Requirements: numpy, pillow, and an ffmpeg binary (imageio-ffmpeg provides one).
Output: public/media/<name>.mp4 and public/media/posters/<name>.jpg
"""

from __future__ import annotations

import math
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from typing import Callable

import numpy as np
from PIL import Image

WIDTH, HEIGHT = 960, 540
FPS = 24
DURATION = 3.0
FRAMES = int(FPS * DURATION)
GOLD = np.array([212, 175, 55], dtype=np.float32)


def ffmpeg_path() -> str:
    """Prefer a system ffmpeg, fall back to the imageio-ffmpeg wheel."""
    system = shutil.which("ffmpeg")
    if system:
        return system
    try:
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:  # pragma: no cover - environment dependent
        sys.exit("ffmpeg not found. Install ffmpeg or `pip install imageio-ffmpeg`.")


class Canvas:
    """Small float32 RGB helper with additive drawing primitives."""

    def __init__(self) -> None:
        self.buf = np.zeros((HEIGHT, WIDTH, 3), dtype=np.float32)
        yy, xx = np.mgrid[0:HEIGHT, 0:WIDTH].astype(np.float32)
        self.x = xx
        self.y = yy
        self.nx = xx / WIDTH
        self.ny = yy / HEIGHT

    def vertical_gradient(self, top: tuple, bottom: tuple, power: float = 1.0) -> None:
        t = (self.ny**power)[..., None]
        self.buf += np.array(top, np.float32) * (1 - t) + np.array(bottom, np.float32) * t

    def radial_glow(self, cx: float, cy: float, radius: float, colour: tuple, strength: float) -> None:
        d = np.sqrt((self.nx - cx) ** 2 + ((self.ny - cy) * (HEIGHT / WIDTH)) ** 2)
        falloff = np.clip(1.0 - d / radius, 0.0, 1.0) ** 2
        self.buf += np.array(colour, np.float32) * (falloff[..., None] * strength)

    def glow_line(self, xs: np.ndarray, ys: np.ndarray, colour: tuple, width: float, strength: float) -> None:
        """Additive polyline with a soft, distance-field falloff.

        ``colour`` is in 0-255 RGB space, like every other primitive here.
        """
        mask = np.zeros((HEIGHT, WIDTH), dtype=np.float32)
        for i in range(len(xs) - 1):
            x0, y0, x1, y1 = xs[i], ys[i], xs[i + 1], ys[i + 1]
            x_min = max(int(min(x0, x1) - width * 3), 0)
            x_max = min(int(max(x0, x1) + width * 3) + 1, WIDTH)
            if x_min >= x_max:
                continue
            sub_x = self.x[:, x_min:x_max]
            sub_y = self.y[:, x_min:x_max]
            dx, dy = x1 - x0, y1 - y0
            length_sq = dx * dx + dy * dy or 1.0
            t = np.clip(((sub_x - x0) * dx + (sub_y - y0) * dy) / length_sq, 0.0, 1.0)
            dist = np.sqrt((sub_x - (x0 + t * dx)) ** 2 + (sub_y - (y0 + t * dy)) ** 2)
            mask[:, x_min:x_max] += np.clip(1.0 - dist / (width * 3), 0.0, 1.0) ** 2
        self.buf += np.array(colour, np.float32) * (np.clip(mask, 0, 1)[..., None] * strength)

    def vignette(self, strength: float = 0.45) -> None:
        d = np.sqrt((self.nx - 0.5) ** 2 + (self.ny - 0.5) ** 2) / 0.75
        self.buf *= np.clip(1.0 - strength * d**2, 0.0, 1.0)[..., None]

    def grain(self, rng: np.random.Generator, amount: float = 2.0) -> None:
        self.buf += rng.normal(0.0, amount, (HEIGHT, WIDTH, 1)).astype(np.float32)

    def to_image(self) -> Image.Image:
        return Image.fromarray(np.clip(self.buf, 0, 255).astype(np.uint8), "RGB")


# ----------------------------------------------------------------------------- scenes


def build_stars(seed: int, count: int = 260) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    x = rng.uniform(0, WIDTH, count)
    y = rng.uniform(0, HEIGHT, count)
    bright = rng.uniform(0.25, 1.0, count)
    phase = rng.uniform(0, math.tau, count)
    return x, y, bright, phase


STARS = build_stars(7)
METEORS = [
    {"start": (-140.0, -60.0), "vx": 210.0, "vy": 118.0, "delay": 0.15},
    {"start": (520.0, -90.0), "vx": 232.0, "vy": 130.0, "delay": 1.25},
    {"start": (140.0, -140.0), "vx": 180.0, "vy": 104.0, "delay": 2.05},
]


def scene_space(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((6, 6, 14), (1, 1, 4))
    c.radial_glow(0.74, 0.22, 0.62, (46, 30, 78), 0.55)
    c.radial_glow(0.2, 0.8, 0.5, (16, 40, 62), 0.35)

    sx, sy, sb, sp = STARS
    drift_x = (sx + t * 3.0) % WIDTH
    drift_y = (sy + t * 1.6) % HEIGHT
    twinkle = 0.65 + 0.35 * np.sin(t * 2.4 + sp)
    alpha = np.clip(sb * twinkle, 0.0, 1.0)

    xi = drift_x.astype(int).clip(0, WIDTH - 1)
    yi = drift_y.astype(int).clip(0, HEIGHT - 1)
    for dx, dy, weight in ((0, 0, 1.0), (1, 0, 0.45), (0, 1, 0.45), (1, 1, 0.2)):
        np.add.at(c.buf, (np.clip(yi + dy, 0, HEIGHT - 1), np.clip(xi + dx, 0, WIDTH - 1)),
                  (alpha * 210.0 * weight)[:, None] * np.array([0.92, 0.95, 1.0], np.float32))

    for meteor in METEORS:
        local = t - meteor["delay"]
        if local <= 0:
            continue
        x0 = meteor["start"][0] + meteor["vx"] * local
        y0 = meteor["start"][1] + meteor["vy"] * local
        tail = np.linspace(1.0, 0.0, 9)
        xs = x0 - meteor["vx"] * 0.30 * tail
        ys = y0 - meteor["vy"] * 0.30 * tail
        fade = max(0.0, 1.0 - local / 1.9)
        c.glow_line(xs, ys, tuple(GOLD), width=1.8, strength=1.15 * fade)

    c.vignette(0.5)
    c.grain(np.random.default_rng(int(t * 1000) + 1), 1.4)
    return c


WAVE_ROWS = 7


def scene_ocean(t: float) -> Canvas:
    c = Canvas()
    horizon = 0.36
    # sky
    sky = c.ny < horizon
    t_sky = np.clip(c.ny / horizon, 0, 1)[..., None]
    c.buf += np.where(sky[..., None],
                      np.array([9, 20, 34], np.float32) * (1 - t_sky) + np.array([46, 44, 40], np.float32) * t_sky,
                      0.0)
    # sea
    t_sea = np.clip((c.ny - horizon) / (1 - horizon), 0, 1)[..., None]
    c.buf += np.where((~sky)[..., None],
                      np.array([10, 46, 62], np.float32) * (1 - t_sea) + np.array([2, 10, 20], np.float32) * t_sea,
                      0.0)
    c.radial_glow(0.5, horizon - 0.02, 0.34, (188, 146, 74), 0.85)   # setting sun
    c.radial_glow(0.5, horizon + 0.12, 0.5, (30, 96, 128), 0.5)

    xs = np.arange(-10, WIDTH + 10, 4, dtype=np.float32)
    for row in range(WAVE_ROWS):
        depth = row / max(WAVE_ROWS - 1, 1)
        amplitude = 2.0 + 22.0 * depth**1.4
        frequency = 0.0045 + 0.0035 * (1 - depth)
        y_base = HEIGHT * (horizon + (1 - horizon) * (0.04 + 0.92 * depth**1.7))
        ys = y_base + amplitude * np.sin(xs * frequency + t * (1.4 + depth * 1.8) + row * 1.1)
        ys += amplitude * 0.35 * np.sin(xs * frequency * 2.9 - t * 1.1)
        # warmer near the sun, cooler at the edges
        tint = (np.array([0.42 + 0.30 * depth, 0.60 + 0.12 * depth, 0.72 + 0.06 * depth]) * 255.0).astype(np.float32)
        c.glow_line(xs, ys, tuple(tint), width=0.9 + 1.6 * depth, strength=0.50 - 0.22 * depth)

    # sun glitter: short horizontal highlights that shimmer
    rng = np.random.default_rng(11)
    glints = rng.random((46, 3))
    for gx, gy, speed in glints:
        px = (0.5 + (gx - 0.5) * 0.42) * WIDTH
        py = HEIGHT * (horizon + 0.02 + (gy ** 1.5) * (1 - horizon) * 0.75)
        length = 5 + 18 * gy
        phase = math.sin(t * (2.2 + speed * 2.4) + gx * 18)
        if phase <= 0.35:
            continue
        alpha = (phase - 0.35) * 0.85 * (1 - gy * 0.5)
        shift = math.sin(t * 1.6 + gy * 9) * 5
        line_x = np.array([px + shift - length / 2, px + shift + length / 2], np.float32)
        line_y = np.full(2, py, np.float32)
        c.glow_line(line_x, line_y, (255.0, 224.0, 158.0), width=1.3, strength=alpha * 0.7)

    # fine ripple texture
    ripples = rng.random((150, 4))
    for rx, ry, speed, bright in ripples:
        px = rx * WIDTH
        py = HEIGHT * (horizon + 0.05 + (ry ** 1.2) * (1 - horizon) * 0.95)
        wave = math.sin(t * (1.4 + speed * 1.8) + rx * 14.0)
        length = 3 + 12 * ry
        x_line = np.array([px - length / 2, px + length / 2], np.float32)
        y_line = np.full(2, py + wave * 2.0, np.float32)
        c.glow_line(x_line, y_line, (150.0, 205.0, 225.0), width=0.7,
                    strength=0.10 * bright * (0.5 + 0.5 * wave) * (0.4 + ry))

    # horizon haze
    haze = np.exp(-((c.y - HEIGHT * horizon) / 34) ** 2)
    c.buf += np.array([84, 66, 46], np.float32) * (haze[..., None] * 0.22)

    c.vignette(0.42)
    c.grain(np.random.default_rng(int(t * 1000) + 2), 1.2)
    return c


def scene_forest(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((10, 20, 16), (3, 8, 7))
    c.radial_glow(0.3, 0.2, 0.7, (34, 64, 48), 0.5)
    c.radial_glow(0.7, 0.35, 0.5, (60, 74, 52), 0.22)

    layers = [(0.46, (14, 40, 30), 0.9, 0.010), (0.60, (9, 28, 22), 1.3, 0.016), (0.74, (5, 17, 14), 1.9, 0.023)]
    xs = np.arange(0, WIDTH + 6, 6, dtype=np.float32)
    for idx, (base, colour, amp, freq) in enumerate(layers):
        ys = HEIGHT * base + amp * 26 * np.sin(xs * freq + t * (0.5 + idx * 0.35) + idx * 2.0)
        ys += amp * 12 * np.sin(xs * (freq * 2.7) + t * 0.9)
        # fill everything below the ridge
        ridge = np.clip(ys.astype(int), 0, HEIGHT - 1)
        for i in range(0, len(xs) - 1):
            x_start = int(xs[i])
            x_end = int(xs[i + 1]) + 1
            if x_start >= WIDTH:
                break
            c.buf[ridge[i]:, x_start:min(x_end, WIDTH)] = (
                c.buf[ridge[i]:, x_start:min(x_end, WIDTH)] * 0.15
                + np.array(colour, np.float32) * 0.85
            )
        c.glow_line(xs, ys, tuple(np.array(colour, np.float32) * 1.5), width=0.8, strength=0.25)

    for band in range(3):
        y = HEIGHT * (0.5 + band * 0.12) + 8 * math.sin(t * 0.9 + band)
        mask = np.exp(-((c.y - y) / (16 + band * 9)) ** 2)
        c.buf += np.array([120, 150, 130], np.float32) * (mask[..., None] * 0.03)

    c.vignette(0.45)
    c.grain(np.random.default_rng(int(t * 1000) + 3), 1.3)
    return c


CITY_RNG = np.random.default_rng(21)
CITY_BUILDINGS = []
_cursor = 0
while _cursor < WIDTH:
    _w = int(CITY_RNG.integers(34, 92))
    _h = int(CITY_RNG.integers(90, 330))
    CITY_BUILDINGS.append((_cursor, _w, _h, CITY_RNG.random(24)))
    _cursor += _w + int(CITY_RNG.integers(4, 14))
CITY_WINDOWS = CITY_RNG.random((len(CITY_BUILDINGS), 14, 6))


def scene_city(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((7, 8, 22), (34, 18, 30))
    c.radial_glow(0.5, 0.62, 0.85, (78, 40, 34), 0.55)
    c.radial_glow(0.82, 0.14, 0.22, (196, 200, 226), 0.55)  # moon

    horizon = HEIGHT * 0.86
    xs = np.arange(0, WIDTH + 6, 6, dtype=np.float32)
    haze = np.exp(-((c.y - horizon) / 70) ** 2)
    c.buf += np.array([46, 26, 34], np.float32) * (haze[..., None] * 0.5)

    for index, (x, width, height, _) in enumerate(CITY_BUILDINGS):
        top = int(horizon - height)
        x_end = min(x + width, WIDTH)
        if x >= WIDTH:
            continue
        shade = 0.55 + 0.45 * ((index * 37) % 11) / 10.0
        c.buf[top:int(horizon), x:x_end] = np.array([10, 11, 20], np.float32) * shade

        cols, rows = 3, 9
        cell_w = max(width // (cols + 1), 6)
        cell_h = max(height // (rows + 2), 8)
        for row in range(rows):
            for col in range(cols):
                lit = CITY_WINDOWS[index][row][col]
                if lit < 0.45:
                    continue
                flicker = 0.75 + 0.25 * math.sin(t * 3.0 + lit * 20 + row)
                wx = x + cell_w // 2 + col * cell_w
                wy = top + cell_h + row * cell_h
                if wx + 3 >= WIDTH or wy + 3 >= int(horizon):
                    continue
                tint = np.array([236, 206, 128], np.float32) if lit > 0.72 else np.array([176, 196, 226], np.float32)
                c.buf[wy:wy + 3, wx:wx + 3] = tint * flicker * 0.6

    c.glow_line(xs, np.full_like(xs, horizon), (60, 40, 50), width=1.2, strength=0.5)
    c.vignette(0.42)
    c.grain(np.random.default_rng(int(t * 1000) + 4), 1.4)
    return c


PARTICLES = np.random.default_rng(99).random((160, 4))  # angle, radius, speed, brightness


def scene_gold(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((4, 3, 6), (2, 2, 4))
    c.radial_glow(0.5, 0.5, 0.85, (36, 28, 12), 0.6)

    for angle, radius, speed, bright in PARTICLES:
        theta = angle * math.tau + t * (0.35 + speed * 0.9)
        r = (0.10 + radius * 0.42) * (1.0 + 0.06 * math.sin(t * 1.7 + angle * 6))
        px = (0.5 + r * math.cos(theta)) * WIDTH
        py = (0.5 + r * math.sin(theta) * 0.82) * HEIGHT
        if not (0 <= px < WIDTH and 0 <= py < HEIGHT):
            continue
        xi, yi = int(px), int(py)
        fade = 0.55 + 0.45 * math.sin(t * 2.2 + radius * 12)
        c.buf[max(yi - 1, 0):yi + 2, max(xi - 1, 0):xi + 2] += GOLD * (bright * fade * 0.55)

    for ring in range(3):
        theta = np.linspace(0, math.tau, 160)
        rr = 0.12 + ring * 0.11 + 0.012 * math.sin(t * 2 + ring)
        xs = (0.5 + rr * np.cos(theta + t * (0.5 - ring * 0.1))) * WIDTH
        ys = (0.5 + rr * np.sin(theta + t * (0.5 - ring * 0.1)) * 0.82) * HEIGHT
        c.glow_line(xs, ys, tuple(GOLD), width=0.7, strength=0.16)

    c.vignette(0.55)
    c.grain(np.random.default_rng(int(t * 1000) + 5), 1.2)
    return c


def scene_silk(t: float) -> Canvas:
    c = Canvas()
    warp = np.sin(c.nx * 5.0 + t * 1.1) * np.cos(c.ny * 4.0 - t * 0.8)
    field = np.sin((c.nx + warp * 0.16) * 7.0 - t * 1.6) * 0.5 + 0.5
    field2 = np.sin((c.ny - warp * 0.13) * 6.0 + t * 1.2) * 0.5 + 0.5
    c.buf += (field[..., None] * np.array([16, 46, 62], np.float32))
    c.buf += (field2[..., None] * np.array([44, 22, 58], np.float32))
    c.vertical_gradient((2, 6, 10), (4, 2, 10))
    highlight = np.clip(1.0 - np.abs(field - field2) * 2.6, 0.0, 1.0) ** 3
    c.buf += highlight[..., None] * np.array([120, 168, 190], np.float32) * 0.7
    c.vignette(0.4)
    c.grain(np.random.default_rng(int(t * 1000) + 6), 1.1)
    return c


@dataclass(frozen=True)
class Clip:
    name: str
    scene: Callable[[float], Canvas]


CLIPS = [
    Clip("space", scene_space),
    Clip("ocean", scene_ocean),
    Clip("forest", scene_forest),
    Clip("city", scene_city),
    Clip("gold", scene_gold),
    Clip("silk", scene_silk),
]


def render_clip(clip: Clip, ffmpeg: str, out_dir: str, poster_dir: str) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        poster_frame = FRAMES // 3
        for index in range(FRAMES):
            t = index / FPS
            image = clip.scene(t).to_image()
            image.save(os.path.join(tmp, f"{index:03d}.png"))
            if index == poster_frame:
                image.save(os.path.join(poster_dir, f"{clip.name}.jpg"), quality=82, optimize=True)

        target = os.path.join(out_dir, f"{clip.name}.mp4")
        subprocess.run(
            [
                ffmpeg, "-y", "-loglevel", "error",
                "-framerate", str(FPS), "-i", os.path.join(tmp, "%03d.png"),
                "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p",
                "-crf", "29", "-preset", "medium", "-g", str(FPS),
                "-movflags", "+faststart", "-an", target,
            ],
            check=True,
        )
        size_kb = os.path.getsize(target) / 1024
        print(f"  ✓ {clip.name}.mp4  ({size_kb:,.0f} KB)")


def main() -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    media_dir = os.path.join(root, "public", "media")
    poster_dir = os.path.join(media_dir, "posters")
    os.makedirs(media_dir, exist_ok=True)
    os.makedirs(poster_dir, exist_ok=True)

    ffmpeg = ffmpeg_path()
    wanted = set(sys.argv[1:])
    clips = [c for c in CLIPS if not wanted or c.name in wanted]
    if not clips:
        sys.exit(f"No clip matched {sorted(wanted)}. Known: {[c.name for c in CLIPS]}")
    print(f"Rendering {len(clips)} clip(s) → {media_dir} (ffmpeg: {ffmpeg})")
    for clip in clips:
        render_clip(clip, ffmpeg, media_dir, poster_dir)
    print("Done.")


if __name__ == "__main__":
    main()
