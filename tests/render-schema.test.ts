import { describe, expect, it } from 'vitest';
import { MAX_PROMPT_LENGTH } from '@/lib/config';
import { formatIssues, renderRequestSchema } from '@/lib/render/schema';

describe('renderRequestSchema', () => {
  it('accepts a valid payload and trims the prompt', () => {
    const result = renderRequestSchema.safeParse({ prompt: '  ocean at dusk  ', engine: 'wan' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ prompt: 'ocean at dusk', engine: 'wan' });
    }
  });

  it('rejects prototype-chain engine names', () => {
    for (const engine of ['__proto__', 'constructor', 'prototype', 'toString', 'hasOwnProperty']) {
      const result = renderRequestSchema.safeParse({ prompt: 'a shot', engine });
      expect(result.success, `engine "${engine}" should be rejected`).toBe(false);
    }
  });

  it('rejects unknown engines and legacy ids', () => {
    expect(renderRequestSchema.safeParse({ prompt: 'a shot', engine: 'wan2.2' }).success).toBe(
      false,
    );
    expect(renderRequestSchema.safeParse({ prompt: 'a shot', engine: 'WAN' }).success).toBe(false);
  });

  it('rejects empty and whitespace-only prompts', () => {
    expect(renderRequestSchema.safeParse({ prompt: '', engine: 'wan' }).success).toBe(false);
    expect(renderRequestSchema.safeParse({ prompt: '   ', engine: 'wan' }).success).toBe(false);
  });

  it('rejects prompts over the length cap', () => {
    const result = renderRequestSchema.safeParse({
      prompt: 'a'.repeat(MAX_PROMPT_LENGTH + 1),
      engine: 'wan',
    });

    expect(result.success).toBe(false);
  });

  it('accepts a prompt exactly at the cap', () => {
    const result = renderRequestSchema.safeParse({
      prompt: 'a'.repeat(MAX_PROMPT_LENGTH),
      engine: 'wan',
    });

    expect(result.success).toBe(true);
  });

  it('rejects control characters', () => {
    expect(
      renderRequestSchema.safeParse({ prompt: 'bad\u0000prompt', engine: 'wan' }).success,
    ).toBe(false);
  });

  it('rejects unknown extra keys', () => {
    const result = renderRequestSchema.safeParse({
      prompt: 'a shot',
      engine: 'wan',
      evil: 'payload',
    });

    expect(result.success).toBe(false);
  });

  it('rejects non-object payloads', () => {
    expect(renderRequestSchema.safeParse(null).success).toBe(false);
    expect(renderRequestSchema.safeParse('prompt').success).toBe(false);
    expect(renderRequestSchema.safeParse([]).success).toBe(false);
  });

  it('formats issues with a readable path', () => {
    const result = renderRequestSchema.safeParse({ prompt: '', engine: 'nope' });
    expect(result.success).toBe(false);

    if (!result.success) {
      const issues = formatIssues(result.error);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.every((issue) => typeof issue.path === 'string')).toBe(true);
      expect(issues.some((issue) => issue.path === 'engine')).toBe(true);
    }
  });
});
