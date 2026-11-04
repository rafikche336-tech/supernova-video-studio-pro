import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoRenderProvider } from '@/lib/render/providers/demo';
import { FalVideoProvider } from '@/lib/render/providers/fal';
import { ReplicateVideoProvider } from '@/lib/render/providers/replicate';
import { ProviderRouter } from '@/lib/render/providers/router';
import { extractVideoUrl, rampProgress, stripProviderPrefix } from '@/lib/render/providers/media';
import { RenderProviderError, makeProviderJobId, splitProviderJobId } from '@/lib/render/types';
import type { ProviderJob, RenderProvider } from '@/lib/render/types';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ helpers */

describe('provider media helpers', () => {
  it('finds video urls in every output shape', () => {
    const shapes = [
      { video: { url: 'https://cdn.example.com/a.mp4' } },
      { video_url: 'https://cdn.example.com/b.mp4' },
      { output: ['https://cdn.example.com/c.mp4'] },
      { output: 'https://cdn.example.com/d.mp4?token=1' },
      { videos: [{ url: 'https://cdn.example.com/e.mp4' }] },
      { data: { result: { url: 'https://cdn.example.com/f.mp4' } } },
    ];

    for (const shape of shapes) {
      expect(extractVideoUrl(shape)).toMatch(/\.mp4(\?|$)/);
    }
  });

  it('prefers a video over a thumbnail image', () => {
    const payload = {
      images: [{ url: 'https://cdn.example.com/thumb.jpg' }],
      video: { url: 'https://cdn.example.com/clip.mp4' },
    };

    expect(extractVideoUrl(payload)).toBe('https://cdn.example.com/clip.mp4');
  });

  it('returns null when there is no video', () => {
    expect(extractVideoUrl({ images: [{ url: 'https://x.test/a.png' }] })).toBeNull();
    expect(extractVideoUrl(null)).toBeNull();
    expect(extractVideoUrl('not a url')).toBeNull();
  });

  it('ramps progress monotonically and never claims completion', () => {
    const start = rampProgress(0, 45_000);
    const mid = rampProgress(22_500, 45_000);
    const end = rampProgress(45_000, 45_000);
    const over = rampProgress(120_000, 45_000);

    expect(start).toBeLessThan(mid);
    expect(mid).toBeLessThan(end);
    expect(end).toBe(92);
    expect(over).toBe(92);
  });

  it('splits and strips provider prefixes', () => {
    expect(splitProviderJobId('fal:abc')).toEqual({ provider: 'fal', id: 'abc' });
    expect(splitProviderJobId('no-prefix')).toEqual({ provider: 'unknown', id: 'no-prefix' });
    expect(stripProviderPrefix('fal', 'fal:abc')).toBe('abc');
    expect(stripProviderPrefix('fal', 'abc')).toBe('abc');
    expect(makeProviderJobId('demo', 'x')).toBe('demo:x');
  });
});

/* --------------------------------------------------------------- demo mode */

describe('DemoRenderProvider', () => {
  it('progresses from queued to succeeded with a bundled clip', async () => {
    const provider = new DemoRenderProvider({ durationMs: 1000 });
    const submitted = await provider.submit({ prompt: 'a neon city at night', engine: 'wan' });

    expect(submitted.status).toBe('queued');
    expect(submitted.providerJobId.startsWith('demo:')).toBe(true);

    const done = await provider.status(submitted.providerJobId, { submittedAt: Date.now() - 5000 });

    expect(done?.status).toBe('succeeded');
    expect(done?.clip).toBeTruthy();
    expect(done?.videoUrl).toBe(`/media/${done?.clip}.mp4`);
    expect(done?.posterUrl).toBe(`/media/posters/${done?.clip}.jpg`);
  });

  it('returns null for an unknown job id', async () => {
    const provider = new DemoRenderProvider();
    expect(await provider.status('demo:missing', { submittedAt: Date.now() })).toBeNull();
  });
});

/* ----------------------------------------------------------------- fal.ai */

describe('FalVideoProvider', () => {
  const config = {
    apiKey: 'fal-test-key',
    model: 'fal-ai/ltx-2/text-to-video/fast',
    baseUrl: 'https://queue.fal.run',
  };

  it('submits a prompt and returns a prefixed job id', async () => {
    const fetchMock = stubFetch(() => jsonResponse({ request_id: 'req_123', status: 'IN_QUEUE' }));
    const provider = new FalVideoProvider(config);

    const job = await provider.submit({ prompt: 'a quiet forest', engine: 'wan' });

    expect(job).toEqual(
      expect.objectContaining({ providerJobId: 'fal:req_123', status: 'queued', progress: 5 }),
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://queue.fal.run/fal-ai/ltx-2/text-to-video/fast');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).authorization).toBe('Key fal-test-key');
    expect(JSON.parse(String(init?.body))).toEqual({ prompt: 'a quiet forest' });
  });

  it('maps IN_QUEUE and IN_PROGRESS to non-terminal states', async () => {
    const provider = new FalVideoProvider(config);

    stubFetch(() => jsonResponse({ status: 'IN_QUEUE' }));
    expect((await provider.status('fal:req_1', { submittedAt: Date.now() }))?.status).toBe(
      'queued',
    );

    stubFetch(() => jsonResponse({ status: 'IN_PROGRESS' }));
    const running = await provider.status('fal:req_1', { submittedAt: Date.now() - 20_000 });
    expect(running?.status).toBe('running');
    expect(running?.progress).toBeGreaterThan(10);
    expect(running?.progress).toBeLessThanOrEqual(92);
  });

  it('fetches the result once COMPLETED', async () => {
    const provider = new FalVideoProvider(config);

    stubFetch((url) => {
      if (url.endsWith('/status')) return jsonResponse({ status: 'COMPLETED' });
      return jsonResponse({ video: { url: 'https://fal.media/files/clip.mp4?token=abc' } });
    });

    const job = await provider.status('fal:req_2', { submittedAt: Date.now() - 30_000 });

    expect(job?.status).toBe('succeeded');
    expect(job?.progress).toBe(100);
    expect(job?.videoUrl).toBe('https://fal.media/files/clip.mp4?token=abc');
  });

  it('reports provider failures with the provider message', async () => {
    const provider = new FalVideoProvider(config);

    stubFetch(() => jsonResponse({ status: 'FAILED', error: { message: 'NSFW filter tripped' } }));
    const job = await provider.status('fal:req_3', { submittedAt: Date.now() });

    expect(job?.status).toBe('failed');
    expect(job?.error).toBe('NSFW filter tripped');
  });

  it('fails when the result contains no video', async () => {
    const provider = new FalVideoProvider(config);

    stubFetch((url) =>
      url.endsWith('/status') ? jsonResponse({ status: 'COMPLETED' }) : jsonResponse({}),
    );
    const job = await provider.status('fal:req_4', { submittedAt: Date.now() });

    expect(job?.status).toBe('failed');
    expect(job?.error).toMatch(/no video/i);
  });

  it('turns an invalid key into an actionable auth error', async () => {
    const provider = new FalVideoProvider(config);
    stubFetch(() => jsonResponse({ detail: 'Invalid key' }, 401));

    await expect(provider.submit({ prompt: 'x', engine: 'wan' })).rejects.toMatchObject({
      code: 'provider-auth',
    });
  });

  it('turns a 402 into a credit error instead of a crash', async () => {
    const provider = new FalVideoProvider({ ...config, apiKey: 'secret-key-value' });
    stubFetch(() => jsonResponse({ detail: 'Insufficient balance' }, 402));

    await expect(provider.submit({ prompt: 'x', engine: 'wan' })).rejects.toMatchObject({
      code: 'provider-rate-limited',
    });
  });

  it('never leaks the API key in error messages', async () => {
    const provider = new FalVideoProvider({ ...config, apiKey: 'super-secret-key' });
    stubFetch(() => jsonResponse({ detail: 'bad key super-secret-key' }, 401));

    await expect(provider.submit({ prompt: 'x', engine: 'wan' })).rejects.toSatisfy(
      (error: unknown) => error instanceof Error && !error.message.includes('super-secret-key'),
    );
  });
});

/* --------------------------------------------------------------- Replicate */

describe('ReplicateVideoProvider', () => {
  it('creates a prediction for an official model', async () => {
    const fetchMock = stubFetch(() => jsonResponse({ id: 'pred_1', status: 'starting' }));
    const provider = new ReplicateVideoProvider({
      apiToken: 'r8_test',
      model: 'lightricks/ltx-video',
      baseUrl: 'https://api.replicate.com',
    });

    const job = await provider.submit({ prompt: 'a storm over the sea', engine: 'wan' });

    expect(job.providerJobId).toBe('replicate:pred_1');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.replicate.com/v1/models/lightricks/ltx-video/predictions');
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer r8_test');
    expect(JSON.parse(String(init?.body))).toEqual({ input: { prompt: 'a storm over the sea' } });
  });

  it('creates a versioned prediction when the model carries a version', async () => {
    const fetchMock = stubFetch(() => jsonResponse({ id: 'pred_2', status: 'starting' }));
    const provider = new ReplicateVideoProvider({
      apiToken: 'r8_test',
      model: 'acme/video:abc123',
      baseUrl: 'https://api.replicate.com',
    });

    await provider.submit({ prompt: 'x', engine: 'wan' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.replicate.com/v1/predictions');
    expect(JSON.parse(String(init?.body))).toMatchObject({ version: 'acme/video:abc123' });
  });

  it('maps statuses and extracts a video from an array output', async () => {
    const provider = new ReplicateVideoProvider({
      apiToken: 'r8_test',
      model: 'lightricks/ltx-video',
      baseUrl: 'https://api.replicate.com',
    });

    stubFetch(() => jsonResponse({ status: 'starting' }));
    expect((await provider.status('replicate:p1', { submittedAt: Date.now() }))?.status).toBe(
      'queued',
    );

    stubFetch(() => jsonResponse({ status: 'processing' }));
    expect(
      (await provider.status('replicate:p1', { submittedAt: Date.now() - 5000 }))?.status,
    ).toBe('running');

    stubFetch(() =>
      jsonResponse({ status: 'succeeded', output: ['https://replicate.delivery/x/out.mp4'] }),
    );
    const done = await provider.status('replicate:p1', { submittedAt: Date.now() - 10_000 });
    expect(done?.status).toBe('succeeded');
    expect(done?.videoUrl).toBe('https://replicate.delivery/x/out.mp4');
  });

  it('reports failed and cancelled predictions', async () => {
    const provider = new ReplicateVideoProvider({
      apiToken: 'r8_test',
      model: 'lightricks/ltx-video',
      baseUrl: 'https://api.replicate.com',
    });

    stubFetch(() => jsonResponse({ status: 'failed', error: 'CUDA out of memory' }));
    expect((await provider.status('replicate:p2', { submittedAt: Date.now() }))?.error).toContain(
      'CUDA',
    );

    stubFetch(() => jsonResponse({ status: 'canceled' }));
    const cancelled = await provider.status('replicate:p3', { submittedAt: Date.now() });
    expect(cancelled?.status).toBe('failed');
    expect(cancelled?.error).toMatch(/cancelled/i);
  });

  it('maps a 429 to a rate-limit error', async () => {
    const provider = new ReplicateVideoProvider({
      apiToken: 'r8_test',
      model: 'lightricks/ltx-video',
      baseUrl: 'https://api.replicate.com',
    });

    stubFetch(() => jsonResponse({ detail: 'slow down' }, 429));
    await expect(
      provider.status('replicate:p4', { submittedAt: Date.now() }),
    ).rejects.toMatchObject({
      code: 'provider-rate-limited',
      status: 429,
    });
  });
});

/* ------------------------------------------------------------------ router */

class ThrowingProvider implements RenderProvider {
  readonly id = 'fal' as const;
  readonly mode = 'live' as const;
  readonly model = 'exploding-model';

  async submit(): Promise<ProviderJob> {
    throw new RenderProviderError('provider-failed', 'provider is down', 502);
  }

  async status(): Promise<ProviderJob | null> {
    return null;
  }
}

describe('ProviderRouter', () => {
  it('uses the live provider when it accepts the job', async () => {
    const live = new FalVideoProvider({
      apiKey: 'k',
      model: 'fal-ai/x',
      baseUrl: 'https://queue.fal.run',
    });
    stubFetch(() => jsonResponse({ request_id: 'req_live' }));

    const router = new ProviderRouter(live, new DemoRenderProvider());
    const job = await router.submit({ prompt: 'x', engine: 'wan' });

    expect(router.mode).toBe('live');
    expect(job.providerJobId).toBe('fal:req_live');
  });

  it('falls back to the demo renderer when the live provider throws', async () => {
    const router = new ProviderRouter(new ThrowingProvider(), new DemoRenderProvider());
    const job = await router.submit({ prompt: 'a quiet ocean', engine: 'wan' });

    expect(job.providerJobId.startsWith('demo:')).toBe(true);
    expect(job.status).toBe('queued');
  });

  it('routes polling by the id prefix', async () => {
    const demo = new DemoRenderProvider({ durationMs: 10 });
    const router = new ProviderRouter(null, demo);

    const job = await router.submit({ prompt: 'ocean', engine: 'wan' });
    const settled = await router.status(job.providerJobId, { submittedAt: Date.now() - 5000 });

    expect(settled?.status).toBe('succeeded');
    expect(router.mode).toBe('demo');
  });

  it('explains when a job belongs to a provider that is no longer configured', async () => {
    const router = new ProviderRouter(null, new DemoRenderProvider());

    await expect(router.status('fal:abc', { submittedAt: Date.now() })).rejects.toMatchObject({
      code: 'provider-not-configured',
      status: 501,
    });
  });
});
