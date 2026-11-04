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




# ----------------------------------------------------------------------------- extended set
# Each scene below is vectorised numpy arithmetic (no per-pixel Python loops) so a
# 3-second 540p clip renders in well under a minute.


def _blobs(buf: np.ndarray, xs: np.ndarray, ys: np.ndarray, colours: np.ndarray) -> None:
    """Additive point sprites with a tiny 3x3 softening kernel."""
    xi = np.clip(xs.astype(int), 0, WIDTH - 1)
    yi = np.clip(ys.astype(int), 0, HEIGHT - 1)
    for dx, dy, weight in ((0, 0, 1.0), (1, 0, 0.45), (-1, 0, 0.45), (0, 1, 0.45), (0, -1, 0.45)):
        np.add.at(buf, (np.clip(yi + dy, 0, HEIGHT - 1), np.clip(xi + dx, 0, WIDTH - 1)),
                  colours * weight)


def scene_desert(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((52, 26, 18), (214, 138, 74), power=0.55)
    c.radial_glow(0.72, 0.30, 0.42, (255, 196, 120), 0.9)
    xs = np.arange(0, WIDTH + 6, 6, dtype=np.float32)
    for layer, (base, colour, amp) in enumerate(
        [(0.52, (120, 62, 40), 1.0), (0.66, (86, 42, 30), 1.5), (0.82, (52, 24, 20), 2.1)]
    ):
        ys = HEIGHT * base + amp * 22 * np.sin(xs * (0.006 + layer * 0.003) + t * (0.4 + layer * 0.3))
        ridge = np.clip(ys.astype(int), 0, HEIGHT - 1)
        for i in range(len(xs) - 1):
            x0, x1 = int(xs[i]), min(int(xs[i + 1]) + 1, WIDTH)
            if x0 >= WIDTH:
                break
            c.buf[ridge[i]:, x0:x1] = c.buf[ridge[i]:, x0:x1] * 0.25 + np.array(colour, np.float32) * 0.75
        c.glow_line(xs, ys, tuple(np.array(colour, np.float32) * 1.4), width=0.7, strength=0.3)
    c.vignette(0.45)
    c.grain(np.random.default_rng(int(t * 1000) + 11), 1.4)
    return c


AURORA_BANDS = [(0.10, (40, 220, 150)), (0.16, (40, 160, 220)), (0.08, (150, 60, 220))]


def scene_aurora(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((3, 8, 18), (1, 3, 8))
    sx, sy, sb, sp = build_stars(31, 150)
    _blobs(c.buf, sx, sy * 0.6, np.repeat((sb * 120)[:, None], 3, axis=1))
    for index, (height, colour) in enumerate(AURORA_BANDS):
        for ribbon in range(3):
            xs = np.arange(0, WIDTH + 8, 8, dtype=np.float32)
            ys = HEIGHT * (0.18 + height + ribbon * 0.05)
            ys = ys + 26 * np.sin(xs * 0.004 + t * (0.7 + index * 0.2) + ribbon) + 12 * np.sin(
                xs * 0.011 - t * 1.3
            )
            c.glow_line(xs, ys, tuple(np.array(colour, np.float32)), width=14 - ribbon * 3, strength=0.10)
            c.glow_line(xs, ys, tuple(np.array(colour, np.float32) * 1.6), width=3.5, strength=0.16)
    c.vignette(0.5)
    c.grain(np.random.default_rng(int(t * 1000) + 12), 1.0)
    return c


SNOW = np.random.default_rng(41).random((320, 4))


def scene_snow(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((18, 26, 38), (52, 62, 78))
    for layer, (base, col) in enumerate([(0.62, (70, 80, 96)), (0.75, (48, 56, 70)), (0.9, (30, 36, 48))]):
        xs = np.arange(0, WIDTH + 6, 6, dtype=np.float32)
        ys = HEIGHT * base + 18 * np.sin(xs * (0.005 + layer * 0.004) + layer)
        ridge = np.clip(ys.astype(int), 0, HEIGHT - 1)
        for i in range(len(xs) - 1):
            x0, x1 = int(xs[i]), min(int(xs[i + 1]) + 1, WIDTH)
            if x0 >= WIDTH:
                break
            c.buf[ridge[i]:, x0:x1] = np.array(col, np.float32)
    for px, py, speed, size in SNOW:
        y = (py * HEIGHT + t * (30 + speed * 70)) % (HEIGHT + 20) - 10
        x = px * WIDTH + 18 * math.sin(t * (0.6 + speed) + py * 9)
        bright = 150 + size * 105
        _blobs(c.buf, np.array([x]), np.array([y]), np.array([[bright, bright, bright * 1.03]]))
    c.vignette(0.4)
    c.grain(np.random.default_rng(int(t * 1000) + 13), 1.2)
    return c


RAIN = np.random.default_rng(53).random((130, 4))


def scene_neon(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((6, 4, 14), (2, 1, 6))
    c.radial_glow(0.28, 0.55, 0.5, (120, 20, 120), 0.5)
    c.radial_glow(0.74, 0.5, 0.5, (20, 110, 140), 0.45)
    for index, px in enumerate(np.linspace(0.08, 0.92, 7)):
        x = px * WIDTH
        hue = np.array([235, 60, 210], np.float32) if index % 2 == 0 else np.array([60, 200, 235], np.float32)
        c.glow_line(np.array([x, x]), np.array([HEIGHT * 0.42, HEIGHT]), tuple(hue * 0.55), width=2.0, strength=0.5)
        c.glow_line(np.array([x - 16, x + 16]), np.array([HEIGHT - 40, HEIGHT - 40]), tuple(hue), width=1.2, strength=0.5)
    for px, py, speed, length in RAIN:
        y = (py * HEIGHT + t * (420 + speed * 260)) % (HEIGHT + 60) - 30
        x = px * WIDTH + (y * 0.18)
        c.glow_line(np.array([x, x - length * 12]), np.array([y, y + length * 40]),
                    (150, 200, 255), width=0.7, strength=0.35)
    c.vignette(0.5)
    c.grain(np.random.default_rng(int(t * 1000) + 14), 1.4)
    return c


EMBERS = np.random.default_rng(67).random((140, 4))


def scene_embers(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((10, 4, 3), (28, 8, 4))
    c.radial_glow(0.5, 1.02, 0.75, (220, 90, 20), 0.6)
    for px, py, speed, size in EMBERS:
        y = HEIGHT * (1.05 - (py + t * (0.10 + speed * 0.18)) % 1.05)
        x = px * WIDTH + 30 * math.sin(t * (0.8 + speed) + py * 12)
        life = min(1.0, (HEIGHT - y) / (HEIGHT * 0.35))
        heat = np.array([255, 120 + size * 90, 40], np.float32) * (0.35 + 0.65 * life) * (0.4 + size * 0.6)
        _blobs(c.buf, np.array([x]), np.array([y]), heat[None, :])
    c.vignette(0.55)
    c.grain(np.random.default_rng(int(t * 1000) + 15), 1.3)
    return c


def scene_ink(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((14, 10, 22), (4, 3, 8))
    warp = np.sin(c.nx * 4.2 + t * 0.9) * np.cos(c.ny * 3.4 - t * 0.7)
    f1 = np.sin((c.nx + warp * 0.22) * 6.0 - t * 1.1) * np.cos((c.ny - warp * 0.16) * 5.0 + t * 0.8)
    f2 = np.sin((c.nx - warp * 0.3) * 3.0 + t * 0.6) * np.sin((c.ny + warp * 0.2) * 7.0 - t * 0.9)
    ink = np.clip((f1 + f2) * 0.5 + 0.5, 0, 1) ** 2
    c.buf -= ink[..., None] * np.array([10, 12, 18], np.float32)
    c.buf += (1 - ink)[..., None] * np.array([58, 26, 96], np.float32) * 0.55
    c.radial_glow(0.5, 0.45, 0.5, (120, 80, 180), 0.28)
    c.vignette(0.55)
    c.grain(np.random.default_rng(int(t * 1000) + 16), 1.1)
    return c


def scene_underwater(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((6, 46, 62), (2, 14, 26))
    c.radial_glow(0.5, -0.05, 0.75, (120, 220, 230), 0.55)
    for band in range(9):
        for offset in (0.0, 0.5):
            phase = t * (1.1 + band * 0.06) + band * 0.9 + offset
            centre = 0.5 + 0.34 * math.sin(phase * 0.8)
            width = 0.045 + 0.02 * math.sin(phase * 1.3)
            mask = np.exp(-(((c.nx - centre) / width) ** 2 + ((c.ny - 0.35) / 0.9) ** 2))
            c.buf += np.array([120, 210, 210], np.float32) * (mask[..., None] * 0.11)
    c.vignette(0.45)
    c.grain(np.random.default_rng(int(t * 1000) + 17), 1.2)
    return c


def scene_ruins(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((40, 32, 30), (150, 116, 86), power=0.6)
    c.radial_glow(0.5, 0.42, 0.5, (230, 180, 120), 0.5)
    rng = np.random.default_rng(77)
    for index in range(9):
        x = int(WIDTH * (0.06 + index * 0.11) + rng.integers(-10, 10))
        height = int(HEIGHT * (0.28 + rng.random() * 0.3))
        width = int(14 + rng.random() * 12)
        top = int(HEIGHT * 0.62) - height
        c.buf[top: int(HEIGHT * 0.86), x: x + width] = np.array([38, 30, 26], np.float32)
        c.buf[top - 10: top, x - 4: x + width + 4] = np.array([52, 42, 36], np.float32)
    c.glow_line(np.arange(0, WIDTH + 4, 4, dtype=np.float32),
                np.full(len(np.arange(0, WIDTH + 4, 4)), HEIGHT * 0.86, np.float32),
                (70, 56, 44), width=2.0, strength=0.4)
    dust = np.random.default_rng(int(t * 1000) + 18).random((60, 3))
    for px, py, size in dust:
        x = (px * WIDTH + t * 24) % WIDTH
        y = (py * HEIGHT - t * 9) % HEIGHT
        _blobs(c.buf, np.array([x]), np.array([y]), np.array([[180, 160, 130]]) * size)
    c.vignette(0.5)
    c.grain(np.random.default_rng(int(t * 1000) + 18), 1.5)
    return c


def scene_clouds(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((30, 48, 72), (128, 140, 158))
    field = np.zeros((HEIGHT, WIDTH), np.float32)
    for octave, (freq, amp) in enumerate([(2.2, 1.0), (5.0, 0.5), (11.0, 0.25), (23.0, 0.12)]):
        field += amp * np.sin(c.nx * freq + c.ny * freq * 0.45 + t * (0.35 + octave * 0.12) + octave)
    cloud = np.clip(field / 1.87 * 0.5 + 0.5, 0, 1) ** 1.6
    c.buf += cloud[..., None] * np.array([190, 198, 214], np.float32) * 0.85
    c.buf += (1 - cloud)[..., None] * np.array([28, 40, 62], np.float32) * 0.5
    c.vignette(0.35)
    c.grain(np.random.default_rng(int(t * 1000) + 19), 1.1)
    return c


def scene_lava(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((18, 6, 4), (6, 3, 2))
    field = np.sin(c.nx * 9.0 + t * 1.4) * np.cos(c.ny * 7.0 - t * 1.1) + np.sin(
        (c.nx + c.ny) * 13.0 - t * 2.1
    )
    crack = np.clip(1.0 - np.abs(field) * 1.15, 0, 1) ** 3
    c.buf += crack[..., None] * np.array([255, 128, 30], np.float32) * 1.0
    c.buf += (crack**0.5)[..., None] * np.array([180, 40, 10], np.float32) * 0.7
    c.vignette(0.5)
    c.grain(np.random.default_rng(int(t * 1000) + 20), 1.6)
    return c


FIREWORK_BURSTS = [(0.25, 0.35, 0.0, (255, 210, 120)), (0.62, 0.28, 0.9, (140, 200, 255)),
                   (0.45, 0.5, 1.8, (255, 150, 190)), (0.8, 0.42, 2.5, (170, 255, 190))]


def scene_fireworks(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((3, 4, 12), (8, 6, 14))
    angles = np.linspace(0, math.tau, 46, endpoint=False)
    for bx, by, offset, colour in FIREWORK_BURSTS:
        local = (t - offset) % 2.9
        if local > 2.2:
            continue
        radius = 14 + local * 120
        fade = max(0.0, 1 - local / 2.2) ** 1.5
        xs = bx * WIDTH + np.cos(angles) * radius
        ys = by * HEIGHT + np.sin(angles) * radius * 0.9 + local * local * 26
        colours = np.repeat((np.array(colour, np.float32) * fade)[None, :], len(angles), axis=0)
        _blobs(c.buf, xs, ys, colours)
    c.vignette(0.45)
    c.grain(np.random.default_rng(int(t * 1000) + 21), 1.3)
    return c


PEAKS = [(0.58, (46, 54, 76), 1.0), (0.68, (30, 36, 54), 1.5), (0.8, (18, 22, 34), 2.2)]


def scene_mountain(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((12, 16, 34), (120, 96, 96), power=0.7)
    c.radial_glow(0.62, 0.34, 0.4, (250, 190, 140), 0.75)
    xs = np.arange(0, WIDTH + 4, 4, dtype=np.float32)
    for index, (base, colour, sharp) in enumerate(PEAKS):
        ys = HEIGHT * base
        for k in range(3):
            ys = ys + (26 - index * 7) * np.sin(xs * (0.004 + k * 0.003) * sharp + index * 2 + t * 0.12)
        ridge = np.clip(ys.astype(int), 0, HEIGHT - 1)
        for i in range(len(xs) - 1):
            x0, x1 = int(xs[i]), min(int(xs[i + 1]) + 1, WIDTH)
            if x0 >= WIDTH:
                break
            c.buf[ridge[i]:, x0:x1] = np.array(colour, np.float32)
        c.glow_line(xs, ys, tuple(np.array(colour, np.float32) * 1.6), width=1.0, strength=0.22)
    c.vignette(0.42)
    c.grain(np.random.default_rng(int(t * 1000) + 22), 1.3)
    return c


BOKEH = np.random.default_rng(91).random((26, 4))


def scene_rainwindow(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((16, 20, 30), (6, 8, 14))
    for px, py, size, hue in BOKEH:
        x = px * WIDTH
        y = py * HEIGHT * 0.75
        radius = 18 + size * 54
        colour = np.array([255, 190, 120], np.float32) if hue > 0.5 else np.array([110, 170, 255], np.float32)
        mask = np.exp(-(((c.x - x) ** 2 + (c.y - y) ** 2) / (radius**2 * 1.6)))
        c.buf += colour * (mask[..., None] * 0.16)
    streaks = np.random.default_rng(int(t * 3) + 5).random((70, 3))
    for px, py, speed in streaks:
        x = px * WIDTH
        y = (py * HEIGHT + t * (90 + speed * 200)) % (HEIGHT + 80) - 40
        c.glow_line(np.array([x, x]), np.array([y, y + 24 + speed * 40]), (190, 210, 240), width=1.0,
                    strength=0.16)
    c.vignette(0.5)
    c.grain(np.random.default_rng(int(t * 1000) + 23), 1.2)
    return c


def scene_cyber(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((8, 2, 16), (2, 1, 8))
    horizon = HEIGHT * 0.52
    c.radial_glow(0.5, horizon, 0.6, (200, 40, 160), 0.5)
    sky = c.ny < horizon / HEIGHT
    for i in range(14):
        y = horizon + (HEIGHT - horizon) * (i / 14) ** 2
        colour = (np.array([240, 60, 200], np.float32) if i % 3 else np.array([60, 220, 240], np.float32))
        c.glow_line(np.array([0, WIDTH], np.float32), np.array([y, y], np.float32), tuple(colour),
                    width=0.9, strength=0.30)
    for k in range(-9, 10):
        x_bottom = WIDTH / 2 + k * WIDTH * 0.16
        c.glow_line(np.array([WIDTH / 2, x_bottom], np.float32),
                    np.array([horizon, HEIGHT], np.float32), (60, 220, 240), width=0.8, strength=0.18)
    scan = (t * 0.35) % 1.0
    c.glow_line(np.array([0, WIDTH], np.float32),
                np.array([horizon + (HEIGHT - horizon) * scan] * 2, np.float32),
                (240, 60, 200), width=1.6, strength=0.35)
    c.buf += np.where(sky[..., None], np.array([18, 4, 30], np.float32), 0.0)
    c.vignette(0.45)
    c.grain(np.random.default_rng(int(t * 1000) + 24), 1.3)
    return c


def scene_storm(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((14, 16, 24), (40, 42, 52))
    field = np.zeros((HEIGHT, WIDTH), np.float32)
    for freq, amp in [(2.0, 1.0), (4.6, 0.55), (9.0, 0.3)]:
        field += amp * np.sin(c.nx * freq + t * 0.3 + c.ny * freq * 0.6)
    cloud = np.clip(field / 1.85 * 0.5 + 0.5, 0, 1) ** 1.4
    c.buf += cloud[..., None] * np.array([54, 58, 70], np.float32) * 0.9
    # lightning flashes on a fixed rhythm
    flash = max(0.0, math.sin(t * 3.1)) ** 24
    if flash > 0.05:
        c.buf += np.array([220, 230, 255], np.float32) * flash * 0.55
        rng = np.random.default_rng(int(t * 8))
        x = WIDTH * (0.3 + rng.random() * 0.4)
        y = HEIGHT * 0.2
        for _ in range(7):
            x2 = x + rng.normal(0, 46)
            y2 = y + rng.uniform(30, 60)
            c.glow_line(np.array([x, x2], np.float32), np.array([y, y2], np.float32), (240, 245, 255),
                        width=1.4, strength=flash)
            x, y = x2, y2
    c.vignette(0.5)
    c.grain(np.random.default_rng(int(t * 1000) + 25), 1.5)
    return c


PETALS = np.random.default_rng(103).random((70, 4))


def scene_blossom(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((60, 40, 48), (150, 120, 128))
    c.radial_glow(0.35, 0.25, 0.6, (255, 214, 224), 0.5)
    for px, py, speed, size in PETALS:
        y = (py * HEIGHT + t * (26 + speed * 46)) % (HEIGHT + 40) - 20
        x = px * WIDTH + 40 * math.sin(t * (0.5 + speed) + py * 10)
        pink = np.array([255, 190 + size * 40, 205], np.float32) * (0.5 + size * 0.5)
        _blobs(c.buf, np.array([x]), np.array([y]), pink[None, :])
    c.vignette(0.42)
    c.grain(np.random.default_rng(int(t * 1000) + 26), 1.2)
    return c


GALAXY_STARS = np.random.default_rng(113).random((900, 3))


def scene_galaxy(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((4, 4, 12), (1, 1, 5))
    cx, cy = 0.5, 0.5
    arms = 3
    for px, py, bright in GALAXY_STARS:
        arm = int(px * arms)
        radius = 0.04 + (py**1.6) * 0.44
        angle = arm * (math.tau / arms) + radius * 7.0 + t * 0.12 + px * 0.6
        x = (cx + radius * math.cos(angle)) * WIDTH
        y = (cy + radius * math.sin(angle) * 0.62) * HEIGHT
        tint = np.array([200 + bright * 55, 190 + bright * 50, 255], np.float32) * (0.35 + bright * 0.65)
        _blobs(c.buf, np.array([x]), np.array([y]), tint[None, :] * 0.5)
    mask = np.exp(-(((c.nx - cx) ** 2 + ((c.ny - cy) * 1.6) ** 2) / 0.055))
    c.buf += np.array([130, 110, 200], np.float32) * (mask[..., None] * 0.35)
    c.radial_glow(cx, cy, 0.14, (255, 240, 220), 0.85)
    c.vignette(0.5)
    c.grain(np.random.default_rng(int(t * 1000) + 27), 1.1)
    return c


def scene_tunnel(t: float) -> Canvas:
    c = Canvas()
    c.vertical_gradient((4, 5, 10), (2, 2, 6))
    angle = np.arctan2(c.ny - 0.5, (c.nx - 0.5) * (WIDTH / HEIGHT))
    radius = np.sqrt((c.nx - 0.5) ** 2 + ((c.ny - 0.5) * (HEIGHT / WIDTH)) ** 2)
    phase = np.sin(angle * 12 + t * 2.4)
    lines = np.clip(1.0 - np.abs(phase) * 3.2, 0, 1) ** 2
    depth = np.clip(1.0 - radius * 1.7, 0, 1) ** 1.4
    c.buf += lines[..., None] * depth[..., None] * np.array([212, 175, 55], np.float32) * 0.9
    for ring in range(6):
        r = 0.06 + ((ring / 6 + t * 0.22) % 1.0) * 0.55
        mask = np.exp(-(((radius - r) / 0.012) ** 2))
        c.buf += np.array([120, 150, 220], np.float32) * (mask[..., None] * 0.25)
    c.vignette(0.35)
    c.grain(np.random.default_rng(int(t * 1000) + 28), 1.2)
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
    Clip("desert", scene_desert),
    Clip("aurora", scene_aurora),
    Clip("snow", scene_snow),
    Clip("neon", scene_neon),
    Clip("embers", scene_embers),
    Clip("ink", scene_ink),
    Clip("underwater", scene_underwater),
    Clip("ruins", scene_ruins),
    Clip("clouds", scene_clouds),
    Clip("lava", scene_lava),
    Clip("fireworks", scene_fireworks),
    Clip("mountain", scene_mountain),
    Clip("rainwindow", scene_rainwindow),
    Clip("cyber", scene_cyber),
    Clip("storm", scene_storm),
    Clip("blossom", scene_blossom),
    Clip("galaxy", scene_galaxy),
    Clip("tunnel", scene_tunnel),
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
