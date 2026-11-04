import { z } from 'zod';

/**
 * Environment variables, validated once at the process boundary.
 *
 * This module is **server-only** — never import it from a `'use client'` file,
 * or the values end up in the browser bundle.
 *
 * Adding a variable? Add it to `.env.example` too, and to docs/CONFIGURATION in
 * README.md.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /**
   * `demo` (default): ships procedurally generated clips, no model required.
   * `live`: uses the caller-provided backend (`RENDER_API_URL`), see
   * docs/ARCHITECTURE.md — not implemented in this repository yet.
   */
  RENDER_PROVIDER: z.enum(['demo', 'live']).default('demo'),
  RENDER_API_URL: z.url().optional(),
  RENDER_API_KEY: z.string().min(1).optional(),

  /** Absolute canonical URL – used for metadata, OG tags, sitemap and robots. */
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),

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

export function isDemoMode(): boolean {
  return getEnv().RENDER_PROVIDER === 'demo';
}
