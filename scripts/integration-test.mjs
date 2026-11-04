#!/usr/bin/env node
/**
 * End-to-end checks against a real `next start` process.
 *
 * This is the regression net for the audit findings: HTTP status codes,
 * security headers, input validation, the job lifecycle, media delivery and
 * rate limiting. Run `npm run build` first.
 *
 *   npm run build && npm run test:integration
 */
import { spawn } from 'node:child_process';
import process from 'node:process';

const PRIMARY_PORT = 4311;
const LIMITER_PORT = 4312;
const PRIMARY_BASE = `http://127.0.0.1:${PRIMARY_PORT}`;
const LIMITER_BASE = `http://127.0.0.1:${LIMITER_PORT}`;
const NEXT_BIN = 'node_modules/next/dist/bin/next';

let passed = 0;
let failed = 0;
const children = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(baseUrl, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/render`, { redirect: 'manual' });
      if (response.status < 500) return true;
    } catch {
      // Not listening yet.
    }
    await sleep(250);
  }

  throw new Error(`Server at ${baseUrl} did not become ready in ${timeoutMs}ms`);
}

function startServer(port, extraEnv = {}) {
  const child = spawn(process.execPath, [NEXT_BIN, 'start', '-p', String(port)], {
    env: { ...process.env, NODE_ENV: 'production', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    if (process.env.VERBOSE) process.stdout.write(`[${port}] ${chunk}`);
  });
  child.stderr.on('data', (chunk) => {
    if (process.env.VERBOSE) process.stderr.write(`[${port}] ${chunk}`);
  });

  children.push(child);
  return child;
}

function stopServers() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
}

async function postJson(baseUrl, body, headers = {}) {
  return fetch(`${baseUrl}/api/render`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function main() {
  startServer(PRIMARY_PORT, { RATE_LIMIT_CAPACITY: '1000', RATE_LIMIT_REFILL_PER_SECOND: '1000' });
  await waitForServer(PRIMARY_BASE);

  // ---------------------------------------------------------------- page + headers
  section('Page and security headers');
  const page = await fetch(`${PRIMARY_BASE}/`);
  const html = await page.text();
  const headers = page.headers;

  check('GET / returns 200', page.status === 200, `status ${page.status}`);
  check('page renders the brand', html.includes('SUPERNOVA'));
  check('page lists every engine', html.includes('WAN 2.2') && html.includes('MOCHI 1'));
  check('demo banner is present', /demo/i.test(html));
  check('Content-Security-Policy is set', Boolean(headers.get('content-security-policy')));
  check(
    'CSP blocks framing',
    (headers.get('content-security-policy') ?? '').includes("frame-ancestors 'none'"),
  );
  check(
    'CSP restricts media to self',
    (headers.get('content-security-policy') ?? '').includes("media-src 'self'"),
  );
  check('X-Content-Type-Options: nosniff', headers.get('x-content-type-options') === 'nosniff');
  check('X-Frame-Options: DENY', headers.get('x-frame-options') === 'DENY');
  check('Referrer-Policy is set', Boolean(headers.get('referrer-policy')));
  check('Permissions-Policy is set', Boolean(headers.get('permissions-policy')));
  check('HSTS is set', Boolean(headers.get('strict-transport-security')));
  check('no X-Powered-By disclosure', headers.get('x-powered-by') === null);

  // ---------------------------------------------------------------- capability endpoint
  section('GET /api/render');
  const capabilities = await fetch(`${PRIMARY_BASE}/api/render`);
  const capabilitiesBody = await capabilities.json();
  check('returns 200', capabilities.status === 200);
  check(
    'reports demo mode',
    capabilitiesBody.mode === 'demo',
    JSON.stringify(capabilitiesBody.mode),
  );
  check(
    'advertises 8 engines',
    Array.isArray(capabilitiesBody.engines) && capabilitiesBody.engines.length === 8,
  );
  check('advertises the prompt cap', capabilitiesBody.maxPromptLength === 400);

  // ---------------------------------------------------------------- validation
  section('Request validation');
  const malformed = await postJson(PRIMARY_BASE, '{not json');
  check(
    'malformed JSON → 400 (was 200 in v1)',
    malformed.status === 400,
    `status ${malformed.status}`,
  );

  const empty = await postJson(PRIMARY_BASE, {});
  check('empty body → 422', empty.status === 422, `status ${empty.status}`);

  const noPrompt = await postJson(PRIMARY_BASE, { engine: 'wan' });
  check('missing prompt → 422', noPrompt.status === 422, `status ${noPrompt.status}`);

  const longPrompt = await postJson(PRIMARY_BASE, { prompt: 'a'.repeat(5000), engine: 'wan' });
  check('oversized prompt → 413', longPrompt.status === 413, `status ${longPrompt.status}`);

  const hugeBody = await postJson(PRIMARY_BASE, { prompt: 'x'.repeat(9000), engine: 'wan' });
  check('oversized body → 413', hugeBody.status === 413, `status ${hugeBody.status}`);

  for (const engine of ['__proto__', 'constructor', 'toString', 'wan2.2']) {
    const response = await postJson(PRIMARY_BASE, { prompt: 'a shot', engine });
    const body = await response.json();
    check(`engine "${engine}" → 422`, response.status === 422, `status ${response.status}`);
    check(
      `engine "${engine}" leaks no video`,
      body.video === undefined,
      JSON.stringify(body.video),
    );
  }

  const extraKey = await postJson(PRIMARY_BASE, { prompt: 'a shot', engine: 'wan', evil: 1 });
  check('unknown keys → 422', extraKey.status === 422, `status ${extraKey.status}`);

  // ---------------------------------------------------------------- job lifecycle
  section('Render job lifecycle');
  const created = await postJson(PRIMARY_BASE, {
    prompt: 'a cinematic ocean at sunset',
    engine: 'wan',
  });
  const createdBody = await created.json();
  check('valid request → 202', created.status === 202, `status ${created.status}`);
  check('response carries a job', Boolean(createdBody.job?.id));
  check('job starts queued', createdBody.job?.status === 'queued', createdBody.job?.status);
  check('mode is echoed as demo', createdBody.mode === 'demo');

  const jobId = createdBody.job?.id;
  const startedAt = Date.now();
  let job = createdBody.job;
  let pollCount = 0;

  while (
    job?.status !== 'succeeded' &&
    job?.status !== 'failed' &&
    Date.now() - startedAt < 20_000
  ) {
    await sleep(200);
    pollCount += 1;
    const polled = await fetch(`${PRIMARY_BASE}/api/render/${jobId}`);
    if (polled.status !== 200) break;
    job = (await polled.json()).job;
  }

  check('job reaches succeeded', job?.status === 'succeeded', job?.status);
  check('progress ends at 100', job?.progress === 100, String(job?.progress));
  check('polling took more than one request', pollCount > 1, `${pollCount} polls`);
  check(
    'result is a same-origin clip',
    typeof job?.videoUrl === 'string' && job.videoUrl.startsWith('/media/'),
    job?.videoUrl,
  );
  check(
    'result includes a poster',
    typeof job?.posterUrl === 'string' && job.posterUrl.startsWith('/media/posters/'),
  );
  check(
    'prompt keyword selects the matching clip',
    job?.videoUrl === '/media/ocean.mp4',
    job?.videoUrl,
  );

  section('Media delivery');
  const media = await fetch(`${PRIMARY_BASE}${job?.videoUrl}`);
  const mediaBuffer = Buffer.from(await media.arrayBuffer());
  check('clip returns 200', media.status === 200, `status ${media.status}`);
  check('clip is video/mp4', (media.headers.get('content-type') ?? '').includes('video/mp4'));
  check(
    'clip is cached immutably',
    (media.headers.get('cache-control') ?? '').includes('immutable'),
  );
  check('clip is non-empty', mediaBuffer.length > 10_000, `${mediaBuffer.length} bytes`);
  check('clip has an mp4 signature', mediaBuffer.subarray(4, 8).toString('ascii') === 'ftyp');

  const poster = await fetch(`${PRIMARY_BASE}${job?.posterUrl}`);
  check('poster returns 200', poster.status === 200, `status ${poster.status}`);

  section('Job lookup errors');
  const unknownJob = await fetch(`${PRIMARY_BASE}/api/render/7f3f1c62-0000-4000-8000-000000000000`);
  check('unknown job → 404', unknownJob.status === 404, `status ${unknownJob.status}`);

  const badId = await fetch(`${PRIMARY_BASE}/api/render/not-a-uuid`);
  check('malformed id → 404', badId.status === 404, `status ${badId.status}`);

  section('Legacy path and 404s');
  const legacy = await fetch(`${PRIMARY_BASE}/api/v14/render`, { redirect: 'manual' });
  check(
    'legacy /api/v14/render redirects',
    legacy.status === 307 || legacy.status === 308,
    `status ${legacy.status}`,
  );
  check(
    'legacy redirect points at /api/render',
    (legacy.headers.get('location') ?? '').endsWith('/api/render'),
    legacy.headers.get('location') ?? '',
  );

  const missing = await fetch(`${PRIMARY_BASE}/definitely-not-a-page`);
  check('unknown route → 404', missing.status === 404, `status ${missing.status}`);

  const robots = await fetch(`${PRIMARY_BASE}/robots.txt`);
  check('robots.txt is served', robots.status === 200);
  check('robots.txt disallows the API', (await robots.text()).includes('/api/'));

  const sitemap = await fetch(`${PRIMARY_BASE}/sitemap.xml`);
  check('sitemap.xml is served', sitemap.status === 200, `status ${sitemap.status}`);

  // ---------------------------------------------------------------- rate limiting
  section('Rate limiting (dedicated instance, capacity 2)');
  startServer(LIMITER_PORT, {
    RATE_LIMIT_CAPACITY: '2',
    RATE_LIMIT_REFILL_PER_SECOND: '0.001',
  });
  await waitForServer(LIMITER_BASE);

  const statuses = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await postJson(LIMITER_BASE, { prompt: 'ocean', engine: 'wan' });
    statuses.push(response.status);
  }

  check('burst is throttled with 429', statuses.includes(429), statuses.join(','));
  const limited = await postJson(LIMITER_BASE, { prompt: 'ocean', engine: 'wan' });
  check(
    '429 carries Retry-After',
    limited.status === 429 && Boolean(limited.headers.get('retry-after')),
  );
}

try {
  await main();
} catch (error) {
  failed += 1;
  console.error('\n✗ Integration run crashed:', error instanceof Error ? error.message : error);
} finally {
  stopServers();
}

console.log(`\n${failed === 0 ? '✅' : '❌'} integration: ${passed} passed, ${failed} failed`);

// Give the child processes a moment to exit before the parent does.
setTimeout(() => process.exit(failed === 0 ? 0 : 1), 500);
