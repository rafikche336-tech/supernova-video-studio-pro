'use client';

import { useEffect, type RefObject } from 'react';

interface Star {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly baseAlpha: number;
  readonly phase: number;
  readonly speed: number;
}

interface Meteor {
  x: number;
  y: number;
  readonly vx: number;
  readonly vy: number;
  life: number;
}

const STAR_COUNT = 110;
/** Expected meteors per second. */
const METEOR_RATE = 0.85;
const METEOR_LIFETIME = 1.35;
const MAX_DEVICE_PIXEL_RATIO = 2;
const GOLD = '212, 175, 55';

function createStars(width: number, height: number): Star[] {
  return Array.from({ length: STAR_COUNT }, () => {
    const radius = Math.random() * 1.15 + 0.35;
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      radius,
      baseAlpha: Math.random() * 0.55 + 0.25,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 1.1 + 0.25,
    };
  });
}

/**
 * Animated starfield with meteors.
 *
 * Performance/sizing notes (all v1 bugs):
 *  - the backing store is resized only on mount/resize, never per frame;
 *  - the canvas is DPR-aware, so it is sharp on retina screens;
 *  - stars are re-sampled on resize instead of staying bunched in a corner;
 *  - stars are batched into three alpha buckets (3 fills/frame, not 110);
 *  - dead meteors are filtered out instead of spliced mid-iteration;
 *  - the loop stops when the tab is hidden or `prefers-reduced-motion` is set,
 *    in which case a single static frame is drawn.
 */
export function useStarfield(canvasRef: RefObject<HTMLCanvasElement | null>): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let meteors: Meteor[] = [];
    let frameId = 0;
    let lastTimestamp = 0;
    let running = false;

    const render = (deltaSeconds: number) => {
      context.clearRect(0, 0, width, height);

      // --- stars: one path per alpha bucket, three fills in total -----------
      const time = performance.now() / 1000;
      const buckets: Path2D[] = [new Path2D(), new Path2D(), new Path2D()];

      for (const star of stars) {
        const twinkle = 0.65 + 0.35 * Math.sin(time * star.speed + star.phase);
        const alpha = Math.min(1, star.baseAlpha * twinkle * 1.5);
        const bucketIndex = Math.min(buckets.length - 1, Math.floor(alpha * buckets.length));
        const path = buckets[bucketIndex];
        if (!path) continue;

        path.moveTo(star.x + star.radius, star.y);
        path.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      }

      const bucketAlphas = [0.22, 0.5, 0.85];
      buckets.forEach((path, index) => {
        context.fillStyle = `rgba(255, 255, 255, ${bucketAlphas[index] ?? 0.5})`;
        context.fill(path);
      });

      // --- meteors ---------------------------------------------------------
      if (deltaSeconds > 0 && Math.random() < METEOR_RATE * deltaSeconds) {
        meteors.push({
          x: Math.random() * width * 0.5,
          y: -24,
          vx: 190 + Math.random() * 120,
          vy: 110 + Math.random() * 70,
          life: METEOR_LIFETIME,
        });
      }

      // Filtering (not splicing) keeps every surviving meteor in the loop.
      meteors = meteors.filter((meteor) => {
        if (deltaSeconds > 0) {
          meteor.x += meteor.vx * deltaSeconds;
          meteor.y += meteor.vy * deltaSeconds;
          meteor.life -= deltaSeconds;
        }

        if (meteor.life <= 0) return false;

        const fade = meteor.life / METEOR_LIFETIME;

        // Three segments give a cheap tapered tail — no per-frame gradients.
        context.lineCap = 'round';
        for (let segment = 0; segment < 3; segment += 1) {
          const tailScale = 1 - segment * 0.32;
          context.strokeStyle = `rgba(${GOLD}, ${(fade * (0.55 - segment * 0.15)).toFixed(3)})`;
          context.lineWidth = 2.1 - segment * 0.55;
          context.beginPath();
          context.moveTo(
            meteor.x - meteor.vx * 0.02 * segment,
            meteor.y - meteor.vy * 0.02 * segment,
          );
          context.lineTo(
            meteor.x - meteor.vx * 0.06 * segment * tailScale,
            meteor.y - meteor.vy * 0.06 * segment * tailScale,
          );
          context.stroke();
        }

        return true;
      });
    };

    const step = (timestamp: number) => {
      const deltaSeconds = lastTimestamp ? Math.min((timestamp - lastTimestamp) / 1000, 0.1) : 0;
      lastTimestamp = timestamp;

      render(deltaSeconds);

      frameId = window.requestAnimationFrame(step);
    };

    const start = () => {
      if (running || motionQuery.matches) return;
      running = true;
      lastTimestamp = 0;
      frameId = window.requestAnimationFrame(step);
    };

    const stop = () => {
      running = false;
      lastTimestamp = 0;
      if (frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }
    };

    const resize = () => {
      const devicePixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
      const rect = canvas.getBoundingClientRect();

      width = Math.max(Math.floor(rect.width), 1);
      height = Math.max(Math.floor(rect.height), 1);

      canvas.width = Math.round(width * devicePixelRatio);
      canvas.height = Math.round(height * devicePixelRatio);

      // Draw in CSS pixels; the transform handles the DPR scaling.
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

      stars = createStars(width, height);
      meteors = [];

      if (!running) render(0);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    };

    const handleMotionPreference = () => {
      if (motionQuery.matches) {
        stop();
        render(0);
      } else {
        start();
      }
    };

    resize();

    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => resize());

    resizeObserver?.observe(canvas);
    document.addEventListener('visibilitychange', handleVisibility);
    motionQuery.addEventListener('change', handleMotionPreference);

    if (motionQuery.matches) {
      render(0);
    } else {
      start();
    }

    return () => {
      stop();
      resizeObserver?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      motionQuery.removeEventListener('change', handleMotionPreference);
    };
  }, [canvasRef]);
}
