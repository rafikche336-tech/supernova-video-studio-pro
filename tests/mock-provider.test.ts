import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockRenderProvider } from '@/lib/render/mock-provider';

const START = new Date('2026-01-01T00:00:00.000Z');

describe('MockRenderProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports demo mode', () => {
    expect(new MockRenderProvider().mode).toBe('demo');
  });

  it('walks a job from queued to succeeded', async () => {
    const provider = new MockRenderProvider({ durationMs: 1000 });

    const created = await provider.create({ prompt: 'ocean at night', engine: 'wan' });
    expect(created.status).toBe('queued');
    expect(created.progress).toBe(0);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);

    vi.setSystemTime(new Date(START.getTime() + 500));
    const running = await provider.get(created.id);
    expect(running?.status).toBe('running');
    // Duration scales slightly with prompt length, so assert a range.
    expect(running?.progress).toBeGreaterThan(0);
    expect(running?.progress).toBeLessThan(100);
    expect(running?.videoUrl).toBeUndefined();

    // Past the whole duration (base + prompt-length allowance).
    vi.setSystemTime(new Date(START.getTime() + 2000));
    const done = await provider.get(created.id);
    expect(done?.status).toBe('succeeded');
    expect(done?.progress).toBe(100);
    expect(done?.videoUrl).toBe('/media/ocean.mp4');
    expect(done?.posterUrl).toBe('/media/posters/ocean.jpg');
    expect(done?.videoAlt).toBeTruthy();
  });

  it('falls back to the engine clip when the prompt has no keywords', async () => {
    const provider = new MockRenderProvider({ durationMs: 100 });

    const job = await provider.create({ prompt: 'zzz', engine: 'mochi' });
    vi.setSystemTime(new Date(START.getTime() + 500));

    const done = await provider.get(job.id);
    expect(done?.videoUrl).toBe('/media/silk.mp4');
  });

  it('returns null for unknown ids', async () => {
    const provider = new MockRenderProvider();
    expect(await provider.get('7f3f1c62-0000-4000-8000-000000000000')).toBeNull();
  });

  it('expires jobs after the TTL', async () => {
    const provider = new MockRenderProvider({ durationMs: 10 });

    const job = await provider.create({ prompt: 'forest', engine: 'wan' });

    // TTL is 10 minutes; jump past it.
    vi.setSystemTime(new Date(START.getTime() + 11 * 60 * 1000));
    expect(await provider.get(job.id)).toBeNull();
  });

  it('keeps prompts bounded to what was validated', async () => {
    const provider = new MockRenderProvider({ durationMs: 10 });
    const job = await provider.create({ prompt: 'ocean', engine: 'wan' });

    expect(job.prompt).toBe('ocean');
    expect(job.engine).toBe('wan');
  });
});
