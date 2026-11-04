import { z } from 'zod';

/**
 * Environment variables, validated once at the process boundary.
 *
 * This module is **server-only** — never import it from a `'use client'` file,
 * or the values end up in the browser bundle.
 *
 * Adding a variable? Add it to `.env.example` and to the configuration table in
 * README.md too.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /**
   * Which video backend to use.
   *
   *   auto (default) — fal.ai if FAL_KEY is set, then Replicate if
   *                    REPLICATE_API_TOKEN is set, otherwise the demo renderer.
   *   fal            — force fal.ai (falls back to demo if the key is missing).
   *   replicate      — force Replicate.
   *   demo           — never call a network provider.
   *
   * `live` is accepted as a legacy alias of `auto`.
   */
  RENDER_PROVIDER: z
    .enum(['auto', 'demo', 'fal', 'replicate', 'live'])
    .default('auto')
    .transform((value) => (value === 'live' ? 'auto' : value)),

  /** fal.ai — https://fal.ai/dashboard/keys (free signup credit). */
  FAL_KEY: z.string().min(8).optional(),
  FAL_VIDEO_MODEL: z.string().min(3).default('fal-ai/ltx-2/text-to-video/fast'),
  /** Test hook: point the client at a local stub instead of queue.fal.run. */
  FAL_API_BASE_URL: z.url().optional(),

  /** Replicate — https://replicate.com/account/api-tokens (pay per use). */
  REPLICATE_API_TOKEN: z.string().min(8).optional(),
  REPLICATE_VIDEO_MODEL: z.string().min(3).default('lightricks/ltx-video'),
  REPLICATE_API_BASE_URL: z.url().optional(),

  /**
   * Optional generation knobs. Left undefined by default because not every model
   * accepts them, and an unknown field is a hard 422 on both providers.
   */
  VIDEO_DURATION_SECONDS: z.coerce.number().positive().max(30).optional(),
  VIDEO_ASPECT_RATIO: z.enum(['16:9', '9:16', '1:1', '4:3', '3:4', '21:9']).optional(),

  /** Where downloaded AI videos are stored. Must be on a persistent volume. */
  MEDIA_DIR: z.string().min(1).default('data/videos'),
  /** Refuse to store videos larger than this (bytes). */
  VIDEO_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(64 * 1024 * 1024),

  /** Absolute canonical URL – used for metadata, OG tags, sitemap and robots. */
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),

  /** SQLite file (relative to the project root) or `:memory:` in tests. */
  DATABASE_PATH: z.string().min(1).default('data/supernova.db'),

  /** Auth.js signing secret. Required in production (see lib/auth.ts). */
  AUTH_SECRET: z.string().min(16).optional(),
  AUTH_GITHUB_ID: z.string().min(1).optional(),
  AUTH_GITHUB_SECRET: z.string().min(1).optional(),

  RATE_LIMIT_CAPACITY: z.coerce.number().int().positive().default(12),
  RATE_LIMIT_REFILL_PER_SECOND: z.coerce.number().positive().default(0.2),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration — ${details}`);
  }

  cached = parsed.data;
  return cached;
}

/** Test helper — clears the memoised environment. */
export function resetEnvCache(): void {
  cached = null;
}

/** True when no live backend is configured for the current process. */
export function isDemoMode(): boolean {
  const env = getEnv();
  if (env.RENDER_PROVIDER === 'demo') return true;
  if (env.RENDER_PROVIDER === 'fal') return !env.FAL_KEY;
  if (env.RENDER_PROVIDER === 'replicate') return !env.REPLICATE_API_TOKEN;
  return !env.FAL_KEY && !env.REPLICATE_API_TOKEN;
}
