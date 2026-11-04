#!/usr/bin/env node
/**
 * End-to-end checks against a real `next start` process.
 *
 * This is the regression net for the whole product surface: HTTP status codes,
 * security headers, the auth gate, input validation, the job lifecycle, media
 * delivery, downloads, share links, the dashboard and rate limiting. It talks to
 * the app exactly like a browser does — cookies, CSRF token, form posts.
 *
 *   npm run build && npm run test:integration
 */
import { spawn } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import process from 'node:process';

const PRIMARY_PORT = 4311;
const LIMITER_PORT = 4312;
const STUB_PORT = 4313;
const LIVE_PORT = 4314;
const PRIMARY_BASE = `http://127.0.0.1:${PRIMARY_PORT}`;
const LIMITER_BASE = `http://127.0.0.1:${LIMITER_PORT}`;
const NEXT_BIN = 'node_modules/next/dist/bin/next';
const TEST_DB = 'data/integration-test.db';
const LIVE_MEDIA_DIR = 'data/integration-media';
const STUB_MODEL = 'fal-ai/ltx-2/text-to-video/fast';
const AUTH_SECRET = 'integration-secret-value-0123456789abcdef';

let passed = 0;
let failed = 0;
const children = [];
let stubServer = null;

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
    env: {
      ...process.env,
      NODE_ENV: 'production',
      AUTH_SECRET,
      DATABASE_PATH: TEST_DB,
      NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
      ...extraEnv,
    },
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
  if (stubServer) stubServer.close();
}

/**
 * A miniature fal.ai queue API, so the live provider can be exercised without a
 * key, network access or money.
 *
 * It implements exactly the three calls `FalVideoProvider` makes and serves a
 * real MP4 (a bundled demo clip) as the "generated" file. Two prompts trigger
 * failures on purpose so the demo fallback can be tested for real:
 *
 *   prompt contains "boom"  → 500 (provider outage)
 *   prompt contains "broke" → 402 (out of credit)
 */
async function startStubFal() {
  const video = readFileSync('public/media/neon.mp4');
  const requests = new Map();
  let counter = 0;

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${STUB_PORT}`);
    const send = (status, payload) => {
      const body = JSON.stringify(payload);
      response.writeHead(status, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      });
      response.end(body);
    };

    // The generated artefact the provider hands back.
    const videoMatch = /^\/video\/([\w-]+)\.mp4$/.exec(url.pathname);
    if (videoMatch) {
      response.writeHead(200, {
        'content-type': 'video/mp4',
        'content-length': video.length,
      });
      response.end(video);
      return;
    }

    if (url.pathname.startsWith('/video/missing.mp4')) {
      send(404, { detail: 'gone' });
      return;
    }

    const statusMatch = new RegExp(`^/${STUB_MODEL}/requests/([\\w-]+)/status$`).exec(url.pathname);
    if (statusMatch) {
      const record = requests.get(statusMatch[1]);
      if (!record) {
        send(404, { detail: 'unknown request' });
        return;
      }

      record.polls += 1;
      const state = record.polls >= 2 ? 'COMPLETED' : 'IN_PROGRESS';
      send(200, { status: state, request_id: statusMatch[1] });
      return;
    }

    const resultMatch = new RegExp(`^/${STUB_MODEL}/requests/([\\w-]+)$`).exec(url.pathname);
    if (resultMatch) {
      send(200, { video: { url: `http://127.0.0.1:${STUB_PORT}/video/${resultMatch[1]}.mp4` } });
      return;
    }

    if (request.method === 'POST' && url.pathname === `/${STUB_MODEL}`) {
      let body = '';
      request.on('data', (chunk) => {
        body += chunk;
      });
      request.on('end', () => {
        let prompt = '';
        try {
          prompt = String(JSON.parse(body).prompt ?? '');
        } catch {
          send(400, { detail: 'bad json' });
          return;
        }

        if (prompt.includes('boom')) {
          send(500, { detail: 'model crashed' });
          return;
        }
        if (prompt.includes('broke')) {
          send(402, { detail: 'Exhausted balance' });
          return;
        }

        counter += 1;
        const id = `stub-${counter}`;
        requests.set(id, { polls: 0 });
        send(200, {
          request_id: id,
          status: 'IN_QUEUE',
          status_url: `http://127.0.0.1:${STUB_PORT}/${STUB_MODEL}/requests/${id}/status`,
          response_url: `http://127.0.0.1:${STUB_PORT}/${STUB_MODEL}/requests/${id}`,
        });
      });
      return;
    }

    send(404, { detail: 'not found' });
  });

  await new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', resolve));
  stubServer = server;

  return { baseUrl: `http://127.0.0.1:${STUB_PORT}`, video };
}

/**
 * Signs in through the real Auth.js credentials endpoint: fetch the CSRF token,
 * post it with the callback, keep every `set-cookie` we are handed.
 */
async function createGuestSession(baseUrl) {
  const jar = new Map();

  const storeCookies = (response) => {
    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(';')[0] ?? '';
      const separator = pair.indexOf('=');
      if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  };

  const cookieHeader = () =>
    [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');

  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  storeCookies(csrfResponse);
  const { csrfToken } = await csrfResponse.json();

  const callbackResponse = await fetch(`${baseUrl}/api/auth/callback/guest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: cookieHeader(),
    },
    body: new URLSearchParams({ csrfToken, callbackUrl: `${baseUrl}/studio` }),
    redirect: 'manual',
  });
  storeCookies(callbackResponse);

  const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
    headers: { cookie: cookieHeader() },
  });
  const session = await sessionResponse.json();

  const request = async (path, init = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), cookie: cookieHeader() },
      redirect: init.redirect ?? 'manual',
    });
    storeCookies(response);
    return response;
  };

  return { cookie: cookieHeader(), session, request, signedIn: callbackResponse.status === 302 };
}

async function postJson(session, path, body, headers = {}) {
  return session.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function main() {
  // Fresh database per run so history assertions are deterministic.
  rmSync(TEST_DB, { force: true });
  rmSync(`${TEST_DB}-wal`, { force: true });
  rmSync(`${TEST_DB}-shm`, { force: true });
  rmSync(LIVE_MEDIA_DIR, { recursive: true, force: true });

  startServer(PRIMARY_PORT, { RATE_LIMIT_CAPACITY: '1000', RATE_LIMIT_REFILL_PER_SECOND: '1000' });
  await waitForServer(PRIMARY_BASE);

  /* ------------------------------------------------------- public surface */

  section('Public landing page and security headers');
  const page = await fetch(`${PRIMARY_BASE}/`);
  const html = await page.text();
  const headers = page.headers;

  check('GET / returns 200', page.status === 200, `status ${page.status}`);
  check('page renders the brand', html.includes('SUPERNOVA'));
  check('page shows the demo notice', /demo mode/i.test(html));
  check('page ships the clip showcase', html.includes('/media/posters/'));
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

  section('GET /api/render (capabilities)');
  const capabilities = await fetch(`${PRIMARY_BASE}/api/render`);
  const capabilitiesBody = await capabilities.json();
  check('returns 200', capabilities.status === 200);
  check('reports demo mode', capabilitiesBody.mode === 'demo', capabilitiesBody.mode);
  check(
    'advertises 8 engines',
    Array.isArray(capabilitiesBody.engines) && capabilitiesBody.engines.length === 8,
  );
  check('advertises the prompt cap', capabilitiesBody.maxPromptLength === 400);
  check('declares that rendering needs auth', capabilitiesBody.requiresAuth === true);
  check(
    'reports the demo provider when no key is set',
    capabilitiesBody.provider?.id === 'demo' && capabilitiesBody.provider?.live === false,
    JSON.stringify(capabilitiesBody.provider),
  );
  check(
    'reports which providers are configured',
    capabilitiesBody.provider?.configured?.fal === false &&
      capabilitiesBody.provider?.configured?.replicate === false,
  );
  check(
    'always advertises the demo fallback',
    capabilitiesBody.provider?.fallback === 'demo',
    capabilitiesBody.provider?.fallback,
  );

  /* --------------------------------------------------------------- auth gate */

  section('Auth gate');
  for (const path of ['/studio', '/history', '/dashboard']) {
    const response = await fetch(`${PRIMARY_BASE}${path}`, { redirect: 'manual' });
    const location = response.headers.get('location') ?? '';
    check(`${path} anonymous → 307`, response.status === 307, `status ${response.status}`);
    check(`${path} redirects to /login`, location.includes('/login'), location);
  }

  const anonymousRender = await fetch(`${PRIMARY_BASE}/api/render`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'a shot', engine: 'wan' }),
  });
  check(
    'anonymous POST /api/render → 401',
    anonymousRender.status === 401,
    `status ${anonymousRender.status}`,
  );

  const anonymousList = await fetch(`${PRIMARY_BASE}/api/renders`);
  check(
    'anonymous GET /api/renders → 401',
    anonymousList.status === 401,
    `status ${anonymousList.status}`,
  );

  const loginPage = await fetch(`${PRIMARY_BASE}/login?next=/history`);
  const loginHtml = await loginPage.text();
  check('login page renders', loginPage.status === 200, `status ${loginPage.status}`);
  check('login offers guest access', loginHtml.includes('Continue as guest'));
  check('login remembers the destination', loginHtml.includes('value="/history"'));
  check(
    'login page is noindex',
    (loginHtml.match(/name="robots" content="([^"]+)"/) ?? [])[1]?.includes('noindex') ?? false,
  );

  section('Guest sign-in');
  const guest = await createGuestSession(PRIMARY_BASE);
  check('credentials callback redirects', guest.signedIn, 'expected 302');
  check(
    'session carries a user id',
    typeof guest.session?.user?.id === 'string',
    JSON.stringify(guest.session),
  );
  check('session carries a display name', typeof guest.session?.user?.name === 'string');

  const studio = await guest.request('/studio');
  const studioHtml = await studio.text();
  check('signed-in /studio → 200', studio.status === 200, `status ${studio.status}`);
  check(
    'studio lists every engine',
    studioHtml.includes('WAN 2.2') && studioHtml.includes('MOCHI 1'),
  );
  check('studio shows the demo notice', /demo mode/i.test(studioHtml));
  check('studio renders the history rail', studioHtml.includes('Recent renders'));

  /* ------------------------------------------------------------ validation */

  section('Request validation (authenticated)');
  const malformed = await postJson(guest, '/api/render', '{not json');
  check('malformed JSON → 400', malformed.status === 400, `status ${malformed.status}`);

  const empty = await postJson(guest, '/api/render', {});
  check('empty body → 422', empty.status === 422, `status ${empty.status}`);

  const noPrompt = await postJson(guest, '/api/render', { engine: 'wan' });
  check('missing prompt → 422', noPrompt.status === 422, `status ${noPrompt.status}`);

  const longPrompt = await postJson(guest, '/api/render', {
    prompt: 'a'.repeat(5000),
    engine: 'wan',
  });
  check('oversized prompt → 413', longPrompt.status === 413, `status ${longPrompt.status}`);

  const hugeBody = await postJson(guest, '/api/render', {
    prompt: 'x'.repeat(9000),
    engine: 'wan',
  });
  check('oversized body → 413', hugeBody.status === 413, `status ${hugeBody.status}`);

  for (const engine of ['__proto__', 'constructor', 'toString', 'wan2.2']) {
    const response = await postJson(guest, '/api/render', { prompt: 'a shot', engine });
    const body = await response.json();
    check(`engine "${engine}" → 422`, response.status === 422, `status ${response.status}`);
    check(`engine "${engine}" leaks no job`, body.job === undefined);
  }

  const extraKey = await postJson(guest, '/api/render', {
    prompt: 'a shot',
    engine: 'wan',
    evil: 1,
  });
  check('unknown keys → 422', extraKey.status === 422, `status ${extraKey.status}`);

  const crossOrigin = await postJson(
    guest,
    '/api/render',
    { prompt: 'a shot', engine: 'wan' },
    {
      origin: 'https://evil.example',
    },
  );
  check('cross-origin POST → 403', crossOrigin.status === 403, `status ${crossOrigin.status}`);

  /* -------------------------------------------------------- job lifecycle */

  section('Render job lifecycle');
  const created = await postJson(guest, '/api/render', {
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
    const polled = await guest.request(`/api/render/${jobId}`);
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

  section('Job ownership');
  const otherGuest = await createGuestSession(PRIMARY_BASE);
  const foreignPoll = await otherGuest.request(`/api/render/${jobId}`);
  check(
    'another account cannot read your job',
    foreignPoll.status === 404,
    `status ${foreignPoll.status}`,
  );

  const unknownJob = await guest.request('/api/render/7f3f1c62-0000-4000-8000-000000000000');
  check('unknown job → 404', unknownJob.status === 404, `status ${unknownJob.status}`);

  const badId = await guest.request('/api/render/not-a-uuid');
  check('malformed id → 404', badId.status === 404, `status ${badId.status}`);

  /* ----------------------------------------------------------- media + download */

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

  section('Download route');
  const download = await guest.request(`/api/download/${jobId}`);
  const downloadBuffer = Buffer.from(await download.arrayBuffer());
  const disposition = download.headers.get('content-disposition') ?? '';
  check('download → 200', download.status === 200, `status ${download.status}`);
  check('download is an attachment', disposition.startsWith('attachment;'), disposition);
  check(
    'download has a friendly filename',
    /supernova-wan-[0-9a-f]{8}\.mp4/.test(disposition),
    disposition,
  );
  check(
    'download is video/mp4',
    (download.headers.get('content-type') ?? '').includes('video/mp4'),
  );
  check(
    'download is private/no-store',
    (download.headers.get('cache-control') ?? '').includes('private'),
  );
  check(
    'download matches the source clip',
    downloadBuffer.subarray(4, 8).toString('ascii') === 'ftyp',
  );

  const foreignDownload = await otherGuest.request(`/api/download/${jobId}`);
  check(
    'another account cannot download your private clip',
    foreignDownload.status === 404,
    `status ${foreignDownload.status}`,
  );

  /* ----------------------------------------------------------------- share */

  section('Share links');
  const shareResponse = await guest.request(`/api/share/${jobId}`, { method: 'POST' });
  const share = await shareResponse.json();
  check('share → 200', shareResponse.status === 200, `status ${shareResponse.status}`);
  check('share returns a 10-character slug', /^[0-9a-z]{10}$/.test(share.slug ?? ''), share.slug);
  check(
    'share url uses the configured origin',
    typeof share.url === 'string' && share.url.includes(`/s/${share.slug}`),
    share.url,
  );

  const secondShare = await guest.request(`/api/share/${jobId}`, { method: 'POST' });
  const secondBody = await secondShare.json();
  check(
    'sharing twice is idempotent',
    secondBody.slug === share.slug,
    `${secondBody.slug} vs ${share.slug}`,
  );

  const foreignShare = await otherGuest.request(`/api/share/${jobId}`, { method: 'POST' });
  check(
    'another account cannot share your clip',
    foreignShare.status === 404,
    `status ${foreignShare.status}`,
  );

  const publicPage = await fetch(`${PRIMARY_BASE}/s/${share.slug}`);
  const publicHtml = await publicPage.text();
  check('share page is public', publicPage.status === 200, `status ${publicPage.status}`);
  check('share page shows the prompt', publicHtml.includes('a cinematic ocean at sunset'));
  check('share page has an og:title', /<meta property="og:title" content="[^"]+"/.test(publicHtml));
  check(
    'share page has a per-render og:image',
    /<meta property="og:image" content="[^"]*\/media\/posters\/ocean\.jpg"/.test(publicHtml),
  );
  check(
    'share page is not indexed',
    (publicHtml.match(/name="robots" content="([^"]+)"/) ?? [])[1]?.includes('noindex') ?? false,
  );

  const publicDownload = await fetch(`${PRIMARY_BASE}/api/download/${jobId}`);
  check(
    'shared clip downloads without a session',
    publicDownload.status === 200,
    `status ${publicDownload.status}`,
  );

  const unknownShare = await fetch(`${PRIMARY_BASE}/s/zzzzzzzzzz`);
  check('unknown share slug → 404', unknownShare.status === 404, `status ${unknownShare.status}`);

  /* ---------------------------------------------------------------- history */

  section('History and analytics');
  const history = await guest.request('/history');
  const historyHtml = await history.text();
  check('history → 200', history.status === 200, `status ${history.status}`);
  check('history lists the new render', historyHtml.includes('a cinematic ocean at sunset'));
  check('history offers the download', historyHtml.includes(`/api/download/${jobId}`));
  check('history links to the public page', historyHtml.includes(`/s/${share.slug}`));

  const filtered = await guest.request('/history?engine=svd');
  check('history filters by engine → 200', filtered.status === 200, `status ${filtered.status}`);
  check(
    'engine filter returns no ocean render',
    !(await filtered.text()).includes('a cinematic ocean at sunset'),
  );

  const search = await guest.request('/history?q=ocean');
  check('history searches prompts', (await search.text()).includes('a cinematic ocean at sunset'));

  const pageTwo = await guest.request('/history?page=99');
  check('out-of-range page still renders', pageTwo.status === 200, `status ${pageTwo.status}`);

  const dashboard = await guest.request('/dashboard');
  const dashboardHtml = await dashboard.text();
  check('dashboard → 200', dashboard.status === 200, `status ${dashboard.status}`);
  check(
    'dashboard renders the volume chart',
    dashboardHtml.includes('Render volume') && dashboardHtml.includes('<svg'),
  );
  check('dashboard renders the engine mix', dashboardHtml.includes('Engine mix'));
  check('dashboard reports platform numbers', dashboardHtml.includes('This deployment'));

  /* -------------------------------------------------------------- misc */

  section('Redirects, 404s and crawler rules');
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
  const robotsBody = await robots.text();
  check('robots.txt is served', robots.status === 200);
  check('robots.txt disallows the API', robotsBody.includes('/api/'));
  check('robots.txt disallows the account area', robotsBody.includes('/dashboard'));

  const sitemap = await fetch(`${PRIMARY_BASE}/sitemap.xml`);
  check('sitemap.xml is served', sitemap.status === 200, `status ${sitemap.status}`);

  /* --------------------------------------------------------- rate limiting */

  section('Rate limiting (dedicated instance, capacity 2)');
  startServer(LIMITER_PORT, { RATE_LIMIT_CAPACITY: '2', RATE_LIMIT_REFILL_PER_SECOND: '0.001' });
  await waitForServer(LIMITER_BASE);

  const limiterGuest = await createGuestSession(LIMITER_BASE);
  const statuses = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await postJson(limiterGuest, '/api/render', {
      prompt: 'ocean',
      engine: 'wan',
    });
    statuses.push(response.status);
  }

  check('burst is throttled with 429', statuses.includes(429), statuses.join(','));
  const limited = await postJson(limiterGuest, '/api/render', { prompt: 'ocean', engine: 'wan' });
  check(
    '429 carries Retry-After',
    limited.status === 429 && Boolean(limited.headers.get('retry-after')),
  );
  check(
    '429 carries X-RateLimit-Remaining',
    limited.headers.get('x-ratelimit-remaining') === '0',
    limited.headers.get('x-ratelimit-remaining') ?? '',
  );

  /* ------------------------------------------- live provider (stub fal.ai) */

  section('Live render path (fal.ai contract, local stub)');
  const stub = await startStubFal();
  const LIVE_BASE = `http://127.0.0.1:${LIVE_PORT}`;

  startServer(LIVE_PORT, {
    RENDER_PROVIDER: 'auto',
    FAL_KEY: 'stub-fal-key',
    FAL_API_BASE_URL: stub.baseUrl,
    FAL_VIDEO_MODEL: STUB_MODEL,
    MEDIA_DIR: LIVE_MEDIA_DIR,
    RATE_LIMIT_CAPACITY: '1000',
    RATE_LIMIT_REFILL_PER_SECOND: '1000',
  });
  await waitForServer(LIVE_BASE);

  const liveCapabilities = await (await fetch(`${LIVE_BASE}/api/render`)).json();
  check(
    'a configured provider is reported as live',
    liveCapabilities.mode === 'live' && liveCapabilities.provider?.live === true,
    JSON.stringify(liveCapabilities.provider),
  );
  check(
    'capabilities name the active provider',
    liveCapabilities.provider?.id === 'fal',
    liveCapabilities.provider?.id,
  );
  check(
    'capabilities expose the model id',
    liveCapabilities.provider?.model === STUB_MODEL,
    liveCapabilities.provider?.model,
  );
  check(
    'capabilities advertise the demo fallback',
    liveCapabilities.provider?.fallback === 'demo',
    liveCapabilities.provider?.fallback,
  );
  check(
    'capabilities never expose the key itself',
    JSON.stringify(liveCapabilities).includes('stub-fal-key') === false,
  );

  const liveGuest = await createGuestSession(LIVE_BASE);
  const liveCreated = await postJson(liveGuest, '/api/render', {
    prompt: 'a slow dolly through a neon market',
    engine: 'wan',
  });
  const liveBody = await liveCreated.json();
  check('live render → 202', liveCreated.status === 202, `status ${liveCreated.status}`);
  check('live job records its provider', liveBody.job?.provider === 'fal', liveBody.job?.provider);
  check('live response mode is live', liveBody.mode === 'live', liveBody.mode);
  check('live job offers no demo clip name', liveBody.job?.clip === undefined);

  let liveJob = liveBody.job;
  const liveStarted = Date.now();
  while (
    liveJob?.status !== 'succeeded' &&
    liveJob?.status !== 'failed' &&
    Date.now() - liveStarted < 60_000
  ) {
    await sleep(300);
    const polled = await liveGuest.request(`/api/render/${liveJob.id}`);
    if (polled.status !== 200) break;
    liveJob = (await polled.json()).job;
  }

  check(
    'live job reaches succeeded',
    liveJob?.status === 'succeeded',
    `${liveJob?.status} ${liveJob?.error ?? ''}`,
  );
  check('live progress ends at 100', liveJob?.progress === 100, String(liveJob?.progress));
  check(
    'generated video is served from our own origin',
    liveJob?.videoUrl === `/api/media/${liveJob?.id}`,
    liveJob?.videoUrl,
  );

  const generatedVideo = await liveGuest.request(liveJob.videoUrl);
  const generatedBytes = Buffer.from(await generatedVideo.arrayBuffer());
  check(
    'generated video streams → 200',
    generatedVideo.status === 200,
    `status ${generatedVideo.status}`,
  );
  check(
    'generated video is video/mp4',
    (generatedVideo.headers.get('content-type') ?? '').includes('video/mp4'),
    generatedVideo.headers.get('content-type') ?? '',
  );
  check(
    'generated video was downloaded to disk, not hot-linked',
    generatedBytes.length === stub.video.length,
    `${generatedBytes.length} vs ${stub.video.length}`,
  );
  check(
    'generated video has an mp4 signature',
    generatedBytes.subarray(4, 8).toString('ascii') === 'ftyp',
  );

  const rangeRequest = await liveGuest.request(liveJob.videoUrl, {
    headers: { range: 'bytes=0-1023' },
  });
  check('range request → 206', rangeRequest.status === 206, `status ${rangeRequest.status}`);
  check(
    'range response advertises content-range',
    (rangeRequest.headers.get('content-range') ?? '').startsWith('bytes 0-1023/'),
    rangeRequest.headers.get('content-range') ?? '',
  );

  const anonymousMedia = await fetch(`${LIVE_BASE}${liveJob.videoUrl}`);
  check(
    'a private generated video is not public',
    anonymousMedia.status === 401 || anonymousMedia.status === 404,
    `status ${anonymousMedia.status}`,
  );

  const liveDownload = await liveGuest.request(`/api/download/${liveJob.id}`);
  const liveDisposition = liveDownload.headers.get('content-disposition') ?? '';
  check(
    'generated video downloads → 200',
    liveDownload.status === 200,
    `status ${liveDownload.status}`,
  );
  check(
    'generated download is an attachment',
    liveDisposition.startsWith('attachment;'),
    liveDisposition,
  );
  check(
    'generated download has a friendly filename',
    /supernova-wan-[0-9a-f]{8}\.mp4/.test(liveDisposition),
    liveDisposition,
  );

  const liveShare = await liveGuest.request(`/api/share/${liveJob.id}`, { method: 'POST' });
  const liveShareBody = await liveShare.json();
  const liveSharePage = await fetch(`${LIVE_BASE}/s/${liveShareBody.slug}`);
  const liveShareHtml = await liveSharePage.text();
  check('shared live render → 200', liveSharePage.status === 200, `status ${liveSharePage.status}`);
  check('share page credits the provider', liveShareHtml.includes('Generated with fal.ai'));

  const liveHistory = await liveGuest.request('/history');
  check(
    'history shows which backend rendered the clip',
    (await liveHistory.text()).includes('fal.ai'),
  );

  section('Demo fallback when the provider fails');
  const failing = await postJson(liveGuest, '/api/render', {
    prompt: 'boom — a provider outage on purpose',
    engine: 'wan',
  });
  const failingBody = await failing.json();
  check(
    'a provider outage still returns a job',
    failing.status === 202,
    `status ${failing.status}`,
  );
  check(
    'outage falls back to the demo renderer',
    failingBody.job?.provider === 'demo',
    failingBody.job?.provider,
  );
  check('fallback is reported in the response', failingBody.fallback === true);
  check(
    'fallback explains itself',
    typeof failingBody.notice === 'string' && failingBody.notice.length > 0,
  );
  check('fallback mode is demo', failingBody.mode === 'demo', failingBody.mode);

  let fallbackJob = failingBody.job;
  const fallbackStarted = Date.now();
  while (
    fallbackJob?.status !== 'succeeded' &&
    fallbackJob?.status !== 'failed' &&
    Date.now() - fallbackStarted < 20_000
  ) {
    await sleep(200);
    const polled = await liveGuest.request(`/api/render/${fallbackJob.id}`);
    if (polled.status !== 200) break;
    fallbackJob = (await polled.json()).job;
  }

  check('fallback render completes', fallbackJob?.status === 'succeeded', fallbackJob?.status);
  check(
    'fallback render plays a bundled clip',
    String(fallbackJob?.videoUrl ?? '').startsWith('/media/'),
    fallbackJob?.videoUrl,
  );
  check('fallback render keeps the demo provider on the row', fallbackJob?.provider === 'demo');

  const brokeResponse = await postJson(liveGuest, '/api/render', {
    prompt: 'broke — the account is out of credit',
    engine: 'wan',
  });
  const brokeBody = await brokeResponse.json();
  check(
    'an out-of-credit provider also falls back',
    brokeResponse.status === 202 && brokeBody.job?.provider === 'demo',
    `${brokeResponse.status} ${brokeBody.job?.provider}`,
  );
  check('out-of-credit fallback is flagged', brokeBody.fallback === true);
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
