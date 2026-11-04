# 🔍 Supernova Video Studio — Full Project Audit

**Repository:** `rafikche336-tech/supernova-video-studio-pro`
**Commit audited:** `bfe659a` (`main`) · branch `arena/e2b57753-supernova-video-studio-pro`
**Date:** 2026-11-04
**Scope:** all 11 tracked files (`app/`, `lib/`, configs, docs)
**Method:** static reading + `npm install` → `tsc --noEmit` → `next build` → `next start` → live HTTP probing of the API and headers → `npm audit`

---

> ## ✅ Remediation status — all 74 findings addressed in v2.0.0
>
> This report is preserved as the record of the *initial* audit (commit `bfe659a`).
> Everything below was fixed in the v2.0.0 rewrite; the file/line references
> point at the **old** code and no longer exist. See [CHANGELOG.md](./CHANGELOG.md)
> for the full list and [README.md](./README.md) for the current state.
>
> | Severity group | Findings | Status |
> |---|---|---|
> | Critical (S1, S2, B1) | 3 | ✅ Lockfile committed · Next.js 16.4.5 (prod audit clean) · demo mode made explicit in UI, API and docs |
> | High (S3, S4, S5, B2, B3, B4, B5) | 7 | ✅ Allow-list + zod validation · 8 KB/400-char caps · correct 400/413/422/500 · single engine registry · Tailwind removed (CSS Modules) · unattended ESLint · anchor-based download |
> | Medium (18) | 18 | ✅ CSP + hardening headers · self-hosted media · rate limiting · typed job states · canvas rewrite · RTL/lang · keyboard a11y · App Router conventions |
> | Low (19) | 19 | ✅ Version/engine naming unified · dead code deleted · colour tokens · complete translations · tests + CI |
> | Best practices (17) | 17 | ✅ `next.config.ts`, lint/format, CI, env validation, logging, tests, metadata |
> | Documentation (10) | 10 | ✅ README rewrite · docs/ARCHITECTURE.md · docs/API.md · SECURITY.md · CONTRIBUTING.md · THIRD_PARTY_NOTICES.md · README.ar.md · `.env.example` |
>
> **Verification:** `npm run verify` (typecheck · lint · 41 unit tests · build) and
> `npm run test:integration` (57 end-to-end checks against `next start`) both pass.
> `npm audit --omit=dev` reports **0 vulnerabilities**.


---

## 0. Executive summary

The project is a **Next.js 14 App Router single-page demo** (~210 lines of application code; 486 lines committed incl. configs/docs) with a good-looking gold-on-black UI, 6-language labels, 8 "engine" cards, and one API route. It builds and typechecks cleanly, which is genuinely positive. Beneath the surface, however, there are **structural gaps that are more serious than any individual bug**:

| | Rating | Notes |
|---|---|---|
| Build / typecheck | 🟢 Good | `tsc --noEmit` and `next build` both pass |
| Security | 🔴 Poor | 25 known advisories in `next`, no headers, unvalidated open endpoint, no lockfile |
| Functional correctness | 🔴 Poor | **No video generation exists** — canned clips + `setTimeout` |
| Code quality | 🟡 Fair | Works, but one 137-line component, heavy `any`, no reuse |
| Performance | 🟡 Fair | Canvas redraw bug at 60 fps; 8 autoplaying videos; dead Tailwind |
| Accessibility / i18n | 🔴 Poor | Keyboard-inaccessible UI, no RTL, static `lang="en"` |
| Testing / CI | 🔴 None | No tests, no CI, `npm run lint` is interactive-only |
| Documentation | 🟡 Fair | Attractive README, but it documents features that do not exist |

**Exposure: 74 findings** — 47 code findings (**3 critical, 7 high, 18 medium, 19 low**), plus 17 best-practice gaps and 10 documentation gaps.

### The three things that matter most

1. **The product does not do what it claims (B1, D1, S9).** `generate()` (`app/page.tsx:74-83`) waits 1 s and returns a **hard-coded stock MP4** based on keyword matching. No Wan 2.2, Mochi 1, SVD, or OpenShorts code, model, API client, or GPU backend exists anywhere in the repo. The README advertises these as integrated engines. Anyone who inspects the network tab sees this immediately — and shipping it publicly as "AI video generation" is a **consumer-protection / app-store rejection risk**, not just a code smell.
2. **The dependency chain is actively vulnerable (S2).** `next@14.2.35` is flagged by `npm audit` for **25 advisories including unauthenticated RCE, SSRF and DoS**, severity *critical*; 14.x is end-of-life. There is **no lockfile** (S1), so every deploy resolves fresh floating versions.
3. **Two rendering paths that never meet (B2).** The UI never calls `/api/v14/render`; the API never drives the UI. The same "prompt → clip" logic is duplicated in two files that have **already drifted**. `lib/engines/router.ts` is 100% dead code with a *third* engine taxonomy.

> **What I verified live:** Tailwind ships literal `@tailwind base;` to the browser (B3), `npm run lint` blocks on an interactive prompt (B4), malformed JSON returns **HTTP 200** (S5), `{"engine":"__proto__"}` returns `{"video":{}}` — a leaked `Object.prototype` (S3), a 1 MB prompt is accepted and echoed back (S4), and zero security headers are emitted (S6).

---

## 1. Security vulnerabilities

### 🟥 S1 — Critical: no lockfile, floating dependency ranges
**`package.json:15-25`** · `.gitignore` (lockfile absent from `git ls-files`)

`"next": "^14.2.0"`, `"react": "^18.3.0"`, `"typescript": "^5.0.0"`, `"tailwindcss": "^3.4.0"` … Every `npm install` resolves differently. A compromised or broken patch release reaches production with no review, and builds are not reproducible (the build I ran resolved `next@14.2.35`, `postcss@8.5.32` — versions the repo does not record).

**Fix:**
```bash
npm install            # generates package-lock.json
git add package-lock.json   # commit it
```
Then switch installs to `npm ci` in CI and pin exact versions for `next`/`react` if you want deliberate upgrade review.

---

### 🟥 S2 — Critical: 25 known vulnerabilities (incl. unauthenticated RCE)
**`package.json:15`** · verified with `npm audit`

```
next  9.3.4-canary.0 - 16.3.0-preview.10   Severity: critical
  • Unauthenticated RCE on Windows-hosted servers        GHSA-p293-qw3h-jr36
  • Unauthenticated RCE in Image Optimization (AVIF)     GHSA-2xp9-vwfh-vxw4
  • Unauthenticated RCE in Image Optimization (SVG)      GHSA-2464-fhr4-w9xw
  • SSRF in rewrites via attacker-controlled hostname    GHSA-p9j2-gv94-2wf4
  • SSRF via WebSocket upgrades                          GHSA-c4j6-fc7j-m34r
  • DoS with Server Components (x3), request smuggling,
    cache poisoning (x4), XSS with CSP nonces, …         (25 advisories)
next → depends on vulnerable postcss (GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, …)
```
`next@14` no longer receives security fixes. `npm audit fix --force` wants `next@16.4.5`, which is a **breaking** upgrade (React 19, async request APIs, Turbopack default).

**Fix (staged):**
1. Short term: bump to the newest patched line you can test (`next@15.x`), review the [15 upgrade guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15) — `next/image`, `cookies()/headers()` async, and `fetch` caching defaults change.
2. Target: `next@16` + `react@19`. For this codebase the risk is low (one client page, one route handler).
3. Gate it: add `npm audit --audit-level=high` to CI so this never silently regresses.

---

### 🟥 S3 — High: unauthenticated endpoint with no allowlist → prototype access
**`app/api/v14/render/route.ts:30`** (consumer: `:37`)

```ts
const engine = body.engine || 'wan';          // :37  unvalidated, any string
...
return byEngine[engine] || FREE_LIBRARY.bbb;  // :30  arbitrary key lookup
```
`byEngine` is a plain object literal, so **inherited keys resolve**. Live proof against `next start`:

```console
$ curl -X POST …/api/v14/render -d '{"prompt":"x","engine":"__proto__"}'
{"video":{},"mode":"free-unlimited","engine":"__proto__","prompt":"x"}
$ curl -X POST …/api/v14/render -d '{"prompt":"x","engine":"constructor"}'
{"mode":"free-unlimited","engine":"constructor","prompt":"x"}   ← video silently missing
```
The `__proto__` case **serialises `Object.prototype` into the HTTP response** — a prototype-chain disclosure, and the same shape of bug that becomes prototype pollution the moment this pattern is used to merge objects. `constructor` returns a *function* that vanishes in JSON, breaking the documented response contract.

Combined with **no authentication and no rate limiting**, this is an open endpoint anyone can hammer (each call is cheap today, but a real GPU backend behind it would be a free-compute faucet).

**Fix:**
```ts
// app/api/v14/render/route.ts
const ENGINE_IDS = ['wan', 'mochi', 'svd', 'shorts', 'ai', 'edge', 'ultra', 'ent'] as const;
type EngineId = (typeof ENGINE_IDS)[number];

// null-prototype map — no inherited keys
const byEngine = Object.assign(Object.create(null), {
  wan: FREE_LIBRARY.bbb, mochi: FREE_LIBRARY.bear, svd: FREE_LIBRARY.bunny1080,
  shorts: FREE_LIBRARY.jelly, ai: FREE_LIBRARY.sintel, edge: FREE_LIBRARY.bbb,
  ultra: FREE_LIBRARY.bunny720, ent: FREE_LIBRARY.sintel,
}) as Record<EngineId, string>;

function pickVideoByPrompt(prompt: string, engine: string): string {
  ...
  return byEngine[engine as EngineId] ?? FREE_LIBRARY.bbb;
}
```
…and validate the body (see S4) so `engine` can only ever be one of `ENGINE_IDS`.

---

### 🟧 S4 — High: unbounded request body + unsanitised reflection (DoS / amplification)
**`app/api/v14/render/route.ts:35-40`**

There is no length cap on `prompt` and the prompt is echoed straight back:

```console
$ # 1,000,000-character prompt
HTTP 200   response length: 1,000,105 bytes   ← full echo
```
A single request can force megabytes of JSON parse + allocation + egress; a few thousand concurrent requests exhaust memory/bandwidth. The echo also means the endpoint is a **reflection primitive**: whoever renders `response.prompt` into HTML later inherits an XSS sink.

**Fix:**
```ts
const MAX_PROMPT = 500;
const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
if (prompt.length > MAX_PROMPT)
  return NextResponse.json({ error: `Prompt too long (max ${MAX_PROMPT})` }, { status: 413 });
// don't echo the prompt back — return { video, engine, mode } only
```
A schema validator (zod, see BP6) gives you this plus type safety in one place.

---

### 🟧 S5 — High: `catch {}` swallows every error and returns HTTP 200
**`app/api/v14/render/route.ts:41-43`**

```ts
} catch {
  return NextResponse.json({ video: FREE_LIBRARY.bbb, mode: 'free-unlimited' }, { status: 200 });
}
```
Live proof — a client sending broken JSON is told everything is fine:

```console
$ curl -X POST …/api/v14/render -d '{not json'
{"video":"https://www.w3schools.com/html/mov_bbb.mp4","mode":"free-unlimited"}   [HTTP 200]
$ curl -X POST …/api/v14/render        # no body at all
{"video":"…mov_bbb.mp4","mode":"free-unlimited"}                                  [HTTP 200]
```
Consequences: the `Prompt required` 400 at `:38` is **unreachable** for any malformed client (the parse throws first), bugs are invisible in logs and monitoring, and callers cannot distinguish success from failure. Silently returning a *wrong* video is worse than erroring.

**Fix:**
```ts
export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const parsed = RenderRequest.safeParse(body);           // zod
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 422 });

  try {
    return NextResponse.json({ video: pickVideoByPrompt(parsed.data.prompt, parsed.data.engine) });
  } catch (err) {
    console.error('[render] failed', err);               // structured logging
    return NextResponse.json({ error: 'Render failed' }, { status: 500 });
  }
}
```

---

### 🟧 S6 — Medium: no security headers at all (no `next.config.js`)
Verified response headers from `next start`:

```
HTTP/1.1 200 OK
X-Powered-By: Next.js          ← version/framework disclosure
(sets and nothing else — no CSP, no X-Frame-Options, no Referrer-Policy,
 no HSTS, no X-Content-Type-Options, no Permissions-Policy)
```
No `next.config.js` exists, so there is no headers hook, no `poweredByHeader: false`, and no image/remote-pattern policy. Your page also embeds third-party video from two external domains (S8), which a CSP must allow. Without `X-Frame-Options`/`frame-ancestors`, any site can iframe your studio (clickjacking on the download buttons).

**Fix — create `next.config.mjs`:**
```js
/** @type {import('next').NextConfig} */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",           // tighten with nonces later
  "style-src 'self' 'unsafe-inline'",            // inline styles (see Q2) need this
  "img-src 'self' data: blob:",
  "media-src 'self' blob: https://test-videos.co.uk https://www.w3schools.com",
  "connect-src 'self' https://test-videos.co.uk https://www.w3schools.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      ],
    }];
  },
};
export default nextConfig;
```

---

### 🟧 S7 — Medium: reverse tabnabbing in the download fallback
**`app/page.tsx:87`**

```ts
catch { window.open(url,'_blank'); }
```
The opened page gets `window.opener` and can redirect your tab (`location = phishing`). Same class of issue for any `target="_blank"` added later.

**Fix:** `window.open(url, '_blank', 'noopener,noreferrer');`

---

### 🟧 S8 — Medium: hotlinking third-party media with no integrity or availability guarantees
**`app/page.tsx:57-69`**, **`app/api/v14/render/route.ts:6-11`**

Six unique sample clips, written out as **18 URL literals**, hard-coded against `www.w3schools.com` and `test-videos.co.uk`:
- **Uptime:** if either host 404s, throttles, or blocks hotlinking (w3schools is a tutorial site, not a CDN), every card breaks with no error UI (`:124` has no `onError`). Neither host was reachable from this audit sandbox, so this dependency is also **unverified in practice**.
- **Privacy/trust:** every visitor's IP and referrer go to two unrelated third parties.
- **No SRI / no CSP allowlist** (fixed together with S6).
- **No caching headers of your own** — you cannot set `Cache-Control` on a resource you do not serve.

**Fix:** vendor the sample clips into `public/media/` (≈6 MB total) and reference `/media/jellyfish.mp4`. Self-hosting removes CORS problems (B5), gives you cache control, and makes the app work offline/in previews.

---

### 🟧 S9 — Medium (legal): CC-BY assets shipped without attribution
**`route.ts:8-11`**, **`page.tsx:59-60`**, **`README.md:41-43`**

*Sintel* and *Big Buck Bunny* are **CC-BY 3.0** (Blender Foundation) and require credit. *Jellyfish* has unclear provenance on test-videos.co.uk. The README's blanket "MIT License — Free for commercial use" misrepresents the media licensing and could expose you to a takedown.

**Fix:** add a `## Credits` / `THIRD_PARTY_NOTICES.md` section naming Blender Foundation + links to the licences, and state explicitly which licence covers code vs. media.

---

### 🟨 S10 — Low: framework/version disclosure in responses
**`app/api/v14/render/route.ts:40,47`** — `mode: 'free-unlimited'`, `engine`, and echoed `prompt` expose internal marketing state and confirm the "no real backend" architecture to anyone with devtools. Set `poweredByHeader: false` (S6) and return only `{ video }`.

### 🟨 S11 — Low: no rate limiting / abuse plan
**`app/api/v14/render/route.ts:33`** — nothing throttles callers. Today it is harmless (static strings); the moment a paid model API or GPU sits behind this route, it is a cost-explosion vector. Add `@upstash/ratelimit` or a per-IP token bucket **before** wiring real inference.

---

## 2. Bugs and errors

### 🟥 B1 — Critical: the core feature is simulated, not implemented
**`app/page.tsx:74-83`** (and mirrored in `route.ts:14-31`)

```ts
const generate = (id: string) => {
  ...
  setGen(s => ({ ...s, [id]: true }));
  setTimeout(() => {                       // :78  fake 1-second "render"
    const url = getVideo(p, id);           // :79  keyword → canned MP4
    setVideos(s => ({ ...s, [id]: { url } }));
    setGen(s => ({ ...s, [id]: false }));
  }, 1000);
};
```
`getVideo()` (`:55-72`) matches `ocean|sea|بحر`, `space|star|فضاء`, `forest|غابة`, `city|مدينة` and otherwise returns a per-engine canned file. There is **no model, no inference call, no upload, no job queue, no WebSocket/polling** in the repo. README (`:12-26`) and `package.json:4` claim four integrated engines.

This is bug #1 because every downstream expectation (progress, cancellation, quality, durations, cost) is built on an illusion. The fixed `1000` ms is also a dark pattern: it manufactures the appearance of computation.

**Fix — pick one:**
- **(a) Ship it as a demo, honestly.** Rename to "Demo mode", add a visible banner, swap `setTimeout` for an explicit `MOCK_MODE` flag, and document it (D2).
- **(b) Implement it for real.** `POST /api/render` → enqueue job (Replicate/fal.ai/RunPod) → return `{ jobId }`; UI polls `GET /api/render/:jobId` or subscribes to SSE; store status in a KV/DB. Then replace `setTimeout` with real progress. Recommended shape:
```ts
type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';
type Job = { id: string; status: JobStatus; progress: number; url?: string; error?: string };
```

---

### 🟥 B2 — High: duplicated logic in two files that already disagree, and the API is unreachable
**`app/page.tsx:55-72`** vs **`app/api/v14/render/route.ts:14-31`**; **`lib/engines/router.ts`** (third copy)

`grep` confirms the UI **never calls the API route** — the only `fetch` in `app/` is inside `download()` (`page.tsx:86`). So `/api/v14/render` is dead code from the product's perspective, and the mapping exists three times:

| Concern | `page.tsx` | `route.ts` | `router.ts` |
|---|---|---|---|
| Engine IDs | `wan, mochi, svd, shorts, ai, edge, ultra, ent` | same 8 | **`wan2.2, mochi1, svd, openshorts`** |
| "space" keywords | `space, star, نجم, فضاء` | `space, star, نجم` (no فضاء) | — |
| Water keywords | `ocean, sea, بحر` | `ocean, sea, water, بحر` | — |
| Name shown | `WAN 2.1` (`:22`) | — | `Wan 2.2` |

They have **already diverged** on `فضاء`, `water`, and engine identity. Every future change must be made twice, and the two copies will keep drifting.

**Fix:** one source of truth, imported by both:
```ts
// lib/engines/registry.ts
export const ENGINES = [
  { id: 'wan',    icon: '🎬', tag: 'CINEMATIC', name: 'WAN 2.1', clip: 'bbb' },
  // …
] as const;
export type EngineId = (typeof ENGINES)[number]['id'];
export function pickClip(prompt: string, engine: EngineId): string { /* one implementation */ }
```
Have the UI call the API (single code path), or keep picking client-side but import the same function — never re-implement it.

---

### 🟥 B3 — High: Tailwind is never compiled; invalid CSS ships to every browser
**`app/globals.css:1-3`**, **`package.json:23-25`** — **no `postcss.config.js` exists**

Empirically confirmed: the built stylesheet is **124 bytes** and contains the raw at-rules:

```css
@tailwind base;@tailwind components;@tailwind utilities;body{background:#0a0a0a;color:#fff;font-family:system-ui,sans-serif}
```
Browsers **discard unknown at-rules**, so `@tailwind` does nothing. Also note `tailwind.config.js:3` points `content` at `./components/**/*` (that directory does not exist) and `./app/**` — but the page uses **only inline styles**, so there is nothing to scan anyway. The result: the entire Tailwind toolchain (3 dev-deps) is installed, configured, and completely inert, while the CSS entrypoint ships garbage. It "works" only because nothing depends on Tailwind — which is why the bug went unnoticed.

**Fix (option A — commit to Tailwind):** add `postcss.config.js` and start using classes:
```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
```
**Fix (option B — drop it):** remove `tailwindcss`/`autoprefixer`/`postcss` from `package.json:23-25`, delete `tailwind.config.js`, and reduce `globals.css` to plain CSS. Given Q2 (inline styles everywhere), option B is the smaller, honest change — but option A pays off the moment the UI grows.

---

### 🟥 B4 — High: `npm run lint` blocks on an interactive prompt (unusable in CI)
**`package.json:12`** — no `.eslintrc*` / `eslint.config.js` in the repo

```console
$ npx next lint
? How would you like to configure ESLint? https://nextjs.org/docs/basic-features/eslint
❯  Strict (recommended)
   Base
   Cancel
```
It hangs forever with no TTY (CI, Docker, `npm run lint && npm run build`), and exits non-zero. A `lint` script that cannot run unattended is worse than no lint script, because it hides that linting has never been applied.

**Fix:** add `.eslintrc.json` and the missing packages:
```json
{ "extends": ["next/core-web-vitals", "next/typescript"] }
```
```bash
npm i -D eslint eslint-config-next
npx next lint --max-warnings=0    # verify it now runs non-interactively
```

---

### 🟧 B5 — High: the download button is broken on its primary path
**`app/page.tsx:85-88`** — five defects on one line (`:86`):

```ts
try { const r = await fetch(url); const b = await r.blob(); const u = URL.createObjectURL(b);
      const a = document.createElement('a'); a.href=u; a.download=`supernova-${id}.mp4`;
      a.click(); URL.revokeObjectURL(u); }
catch { window.open(url,'_blank'); }
```
1. **CORS**: cross-origin `fetch` to `w3schools.com`/`test-videos.co.uk` needs `Access-Control-Allow-Origin`; these are not APIs and are not guaranteed to send it. If absent, **every** download falls into `catch`.
2. **Popup blocker**: in `catch`, `window.open` runs *after an `await`*, so it is no longer a user gesture — Chrome/Safari block it. The user clicks "DOWNLOAD" and **nothing happens**.
3. **Premature revoke**: `URL.revokeObjectURL(u)` executes immediately after `a.click()`. In Safari/Firefox the download can start after the revoke → "Failed – no file".
4. **No DOM attachment**: the `<a>` is never appended; Apple WebKit historically requires it.
5. **Memory**: buffering a whole video as a `Blob` is fine for 1 MB, fatal for a real 200 MB render on mobile Safari.

**Fix:**
```ts
const download = (url: string, id: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = `supernova-${id}.mp4`;
  a.rel = 'noopener';
  document.body.appendChild(a);          // Safari
  a.click();
  a.remove();
  // No blob, no fetch, no revoke → no CORS, no popup, no memory spike.
  // (Same-origin `download` only works if the file is self-hosted — see S8.)
};
```

---

### 🟧 B6 — Medium: `getVideo()` can return `undefined`, typed as `string`
**`app/page.tsx:9`** (`Record<string,{url:string}>`), **`:61`** (`const map: any`), **`:71`**, **`:124`**

`map` is typed `any`, so `map[eng]` is `any` and `setVideos({ [id]: { url } })` accepts `undefined`. Today all 8 ids exist, so it works — but the first added engine (or a typo) renders `<video src={undefined}>` and fails silently. `strict: true` (`tsconfig.json:7`) is defeated by this single `any`.

**Fix:**
```ts
const CLIPS: Record<string, string> = { /* … */ };
function getVideo(prompt: string, eng: EngineId): string {
  ...
  return CLIPS[eng] ?? CLIPS.wan;   // total function, never undefined
}
```
Add `"noUncheckedIndexedAccess": true` to `tsconfig.json` so TS catches this class of bug automatically.

---

### 🟧 B7 — Medium: array spliced during `forEach` → skipped meteors (visual glitch)
**`app/page.tsx:48`**

```ts
meteors.forEach((m, i) => { ...; if (m.life<=0) { meteors.splice(i,1); return; } ... });
```
Mutating the array while iterating shifts indices: the element after a removed one is **skipped this frame** (it doesn't move, doesn't age, doesn't draw), causing stutter and occasional double-removal when two meteors die in the same frame.

**Fix:**
```ts
meteors = meteors.filter(m => {
  m.x += m.vx; m.y += m.vy; m.life -= 0.01;
  if (m.life <= 0) return false;
  /* draw */
  return true;
});
```

---

### 🟧 B8 — Medium: starfield breaks on resize / rotation / HiDPI
**`app/page.tsx:39`** (positions sampled once) + **`:44`** (size forced every frame)

```ts
const stars = Array.from({ length: 120 }, () => ({ x: Math.random()*window.innerWidth, … })); // :39
...
c.width = window.innerWidth; c.height = window.innerHeight;   // :44 every frame
```
- Star coordinates are frozen at mount; resize the window or rotate a phone and all 120 stars stay bunched in the **top-left rectangle** of the new viewport.
- Backing-store size ignores `devicePixelRatio`, so on any Retina/AMOLED phone the stars and meteors are **blurry** (bitmap is 1 CSS px per pixel).
- Writing `width`/`height` **resets the entire 2D context state** (transform, fillStyle, line caps) 60×/s — see P1.

**Fix:** size once + on `resize`, and rescale:
```ts
const dpr = Math.min(window.devicePixelRatio || 1, 2);
c.width = Math.floor(innerWidth * dpr);
c.height = Math.floor(innerHeight * dpr);
c.style.width = `${innerWidth}px`;
c.style.height = `${innerHeight}px`;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
// re-sample star positions inside the resize handler
```

---

### 🟧 B9 — Medium: Arabic is rendered left-to-right; `lang` is frozen to `"en"`
**`app/layout.tsx:8`** (`<html lang="en">`), **`app/page.tsx:5,12-19,95-97`**

The UI offers `AR` with genuine RTL content, but nothing ever sets `dir="rtl"` or updates `<html lang>`. Consequences: Arabic headlines render LTR (misaligned punctuation, wrong word-order feel), screen readers pronounce Arabic with an English voice, and the document declares the wrong language to search engines (SEO/i18n penalty).

**Fix:**
```ts
useEffect(() => {
  const dir = lang === 'AR' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang.toLowerCase();
  document.documentElement.dir = dir;
}, [lang]);
```
Better long-term: `next-intl` with locale-prefixed routes (`/en`, `/ar`, `/fr`) and server-rendered `lang`/`dir` (helps SEO too).

---

### 🟧 B10 — Medium: dangling `setTimeout` → state update after unmount, no cancel/error path
**`app/page.tsx:78-82`** — the timer id is never stored, so:
- navigating away mid-"generation" calls `setGen`/`setVideos` on an unmounted component;
- clicking Generate twice on different cards is fine, but there is **no way to cancel** an in-flight render;
- no `error` state exists at all: if `getVideo` throws or the video 404s, the UI stays on "VIDEO READY" with a black box.

**Fix:** keep the id in a ref and clear it in the effect cleanup; add `status: 'idle'|'loading'|'done'|'error'` and render an error branch; add `onError` to the `<video>` at `:124`.

---

### 🟧 B11 — Medium: the entire UI is unusable by keyboard
**`app/page.tsx:108`** (card), **`:114`** (toggle), **`:118`** (textarea)

```tsx
<div onClick={() => { if (!isGen) setOpen(open===e.id?null:e.id); }} style={{ … cursor:'pointer' }}>
```
A `<div>` with `onClick` is **not focusable, not activatable** by Enter/Space, and announces nothing. Since the prompt textarea and Generate button live *inside* the collapsed card, a keyboard or screen-reader user **cannot generate anything at all** — WCAG 2.1.1 (Keyboard) failure. The `+`/`−` at `:114` is a glyph with no `aria-expanded`/`aria-controls`, and the `<textarea>` at `:118` has only a `placeholder` (no `<label>`, WCAG 1.3.1/4.1.2).

**Fix:**
```tsx
<button
  type="button"
  aria-expanded={open === e.id}
  aria-controls={`panel-${e.id}`}
  onClick={() => !isGen && setOpen(open === e.id ? null : e.id)}
  style={{ all: 'unset', display: 'block', cursor: 'pointer', width: '100%' }}
>
  …
</button>
<div id={`panel-${e.id}`} role="region" aria-label={`${e.name} prompt`}>
  <label htmlFor={`p-${e.id}`} className="sr-only">Prompt for {e.name}</label>
  <textarea id={`p-${e.id}`} … />
</div>
```
Also add `aria-hidden="true"` to the decorative emoji (`:111`) and `aria-hidden` on the canvas (`:92`).

---

### 🟨 B12 — Low: translations are incomplete and inconsistent
**`app/page.tsx:13-18`** — the `foot` string is truncated for AR (`'سوبرنوفا V14 - 8 محركات - مجاني'` drops the "works in Algeria" claim), and ES/DE/ZH reduce it to just `'Supernova V14'`. `sub`/`title` are identical Latin strings in FR/ES/DE/ZH, so those languages only translate the buttons. Users get the impression of 6 locales with 1.5 real locales.

### 🟨 B13 — Low: version/engine naming contradicts itself across the repo
| Where | Claim |
|---|---|
| `app/page.tsx:13` | "Supernova V14 - 8 Engines" |
| `app/page.tsx:22` | "WAN 2.1" |
| `package.json:3` | `"version": "1.0.0"` |
| `package.json:4`, `README.md:16` | "Wan 2.2" |
| `README.md:16-19` | **4** engines |
| `README.md:22-24` | 4 engines |
| `lib/engines/router.ts:3-8` | 4 engines, ids `wan2.2/mochi1/openshorts` |
| `app/api/v14/render/route.ts` | 8 engines, ids `wan/mochi/shorts/…` |

Pick one taxonomy + one major version. The `v14` in the route path most likely refers to the old marketing string, not API versioning.

### 🟨 B14 — Low: `lib/engines/router.ts` is 100 % dead code
**`lib/engines/router.ts:1-12`** — `grep` for `routePrompt`/`ENGINES`/`engines/router` outside the file returns **zero** results. Worse, its `Engine` union doesn't match anything else in the app, so anyone who imports it will get type errors against real usage. Either delete it or make it *the* registry (B2).

### 🟨 B15 — Low: background colour mismatch causes a visible flash
**`app/globals.css:6`** sets `#0a0a0a`; **`app/page.tsx:91`** sets `#050507`. Before the inline style applies you get a lighter frame — a small flash on every load, worse on slow devices.

### 🟨 B16 — Low: no App Router error/loading conventions
No `app/error.tsx`, `app/loading.tsx`, `app/not-found.tsx`, `app/sitemap.ts`, `app/robots.ts`, `app/icon.png`, or `opengraph-image`. Any runtime error shows Next's default error screen; social shares have no preview card.

---

## 3. Code quality issues

### 🟧 Q1 — One 137-line component does everything
**`app/page.tsx:1-137`** holds i18n dictionary, engine metadata, state (5 pieces), a canvas animation engine, a business rule (prompt→clip), a fake async pipeline, a file-download helper, and the whole JSX tree. There is no `components/`, no `hooks/`, no `lib/i18n.ts`. Any change risks the canvas, the UI, or the API logic.

**Fix:** split along the seams that already exist —
```
components/EngineCard.tsx      components/StarfieldCanvas.tsx
components/LanguagePicker.tsx  hooks/useStarfield.ts
lib/i18n.ts (typed)            lib/engines/registry.ts
types/render.ts
```

### 🟧 Q2 — `any` in five places defeats `strict: true`
**`app/page.tsx:12`** `const T: any`, **`:40`** `let meteors: any[]`, **`:61`** `const map: any`, **`:46/48`** `(s:any)`/`(m:any)`. Because `tsconfig.json:7` sets `"strict": true`, this is not laziness-by-accident — it is actively opting out of the safety you paid for, and it is exactly what hides B6.

**Fix:**
```ts
type Lang = 'EN' | 'AR' | 'FR' | 'ES' | 'DE' | 'ZH';
type Dict = { title: string; sub: string; ph: string; gen: string; dl: string; wait: string; ok: string; foot: string };
const T: Record<Lang, Dict> = { … };   // missing keys become compile errors
type Meteor = { x: number; y: number; vx: number; vy: number; life: number };
```

### 🟧 Q3 — 24 inline style objects; the design system lives in `#D4AF37` string literals
**`app/page.tsx:91-135`** (24 `style={{…}}` blocks) — the gold `#D4AF37` appears **7 times** (plus 7 `rgba(212,175,55,…)` variants), `rgba(255,255,255,0.06)` 4 times, etc. Inline styles cost a new object allocation per render, defeat CSS caching/pseudo-classes (`:hover`, `:focus-visible` are impossible — see B11), and make theming/localisation of layout (RTL) manual. Meanwhile Tailwind is installed and inert (B3).

### 🟨 Q4 — Domain vocabulary duplicated as raw URL strings (client *and* server)
**`page.tsx:57-69`** + **`route.ts:6-11`** repeat the same 6 URLs as literals 15+ times. Renaming a clip means a global find/replace with no compiler help (see B2).

### 🟨 Q5 — Misleading identifiers
`FREE_LIBRARY` (`route.ts:5`) and `MapT` (`:3`) imply a media library and a map type; neither exists. `getVideo` (`page.tsx:55`) implies fetching, but only maps a keyword. `routePrompt` (`router.ts:10`) returns metadata and routes nothing.

### 🟨 Q6 — `tsconfig.json` is dated and under-strict
**`tsconfig.json:3`** `"target": "es5"` — downlevels modern syntax for browsers Next 14 doesn't support anyway, adds helper bloat, and blocks top-level await. **`:5`** `allowJs: true` with zero `.js` sources. Missing: `forceConsistentCasingInFileNames` (case-sensitivity bugs on Linux CI vs macOS), `noUncheckedIndexedAccess` (would have caught B6), `noUnusedLocals`/`noUnusedParameters` (would have flagged dead `router.ts`), `verbatimModuleSyntax`.

**Fix:** `"target": "ES2022"`, drop `allowJs`, add the four flags above.

### 🟨 Q7 — Semantic HTML absent
**`app/page.tsx:90-136`** — everything is `<div>`: no `<header>`, `<main>`, `<section>`, no `<h2>` for the 8 engine names (they are `<div style={{fontSize:16}}>` at `:112`), no `<ul>/<li>` for the card grid. Hurts SEO, screen-reader navigation, and readability of the JSX itself.

### 🟨 Q8 — No tests, no CI, no formatter, no `typecheck` script
`package.json:8-13` has only `dev/build/start/lint`. There is no `.github/`, no `.prettierrc`, no `vitest`/`playwright`, no `npm test`. Every check is manual.

### 🟨 Q9 — `"private": false` on an application
**`package.json:7`** — an unversioned app published under a public name is one `npm publish` away from becoming someone else's dependency. Set `"private": true` unless you actually intend to ship a library.

### 🟨 Q10 — Readability: chained ternaries in style props
**`page.tsx:96, 114, 120`** are single-line ternaries nested three deep (`isGen?'#888':prompts[e.id]?.trim()?'#000':'#555'`). Extract to `const btnColor = isGen ? … : …` or to CSS classes/`clsx`.

---

## 4. Performance problems

### 🟧 P1 — Canvas backing store reallocated 60×/second
**`app/page.tsx:44`** `c.width = window.innerWidth; c.height = window.innerHeight;` *inside the rAF loop*

Assigning `canvas.width` **reallocates the bitmap and resets all 2D state**, even when the value is unchanged. Plus reading `window.innerWidth` each frame forces style/layout flush. That is a full buffer reallocation + layout read at 60–120 Hz, permanently, on every page — for a decorative starfield. This is the single biggest perf defect in the project.

**Fix:** set size once and in a debounced `resize` handler (see B8); never inside the loop.

### 🟧 P2 — Per-frame allocation churn
**`app/page.tsx:46-48`** — per star, per frame: a template-literal CSS string + `beginPath()` + `arc()` + `fill()`. Per meteor, per frame: `createLinearGradient()` (a new GPU/CPU gradient object) + `addColorStop` ×2. At 120 stars × 60 fps = 7,200 string allocations + 7,200 path builds per second; gradient creation is markedly more expensive than the rest.

**Fix:** batch all stars into a **single** path with one `fillStyle` and per-star alpha via `globalAlpha`, and reuse one pre-built gradient (or replace gradients with `lineCap: 'round'` strokes). Optionally draw the static starfield once to an offscreen canvas and `drawImage` it.

### 🟧 P3 — Animation never pauses; ignores reduced-motion
**`app/page.tsx:34-53`** — the loop runs from mount until unmount, regardless of tab visibility (rAF pauses on hidden tabs, but this loop resumes the instant you return), scroll position (canvas is `position:fixed`, always visible, so offscreen optimisations don't apply), or user preference. No `matchMedia('(prefers-reduced-motion: reduce)')` check — a vestibular-trigger risk (WCAG 2.3.3) *and* a battery drain on mobile.

**Fix:**
```ts
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  drawStatic();           // one frame, no loop
  return;
}
const onVis = () => document.hidden ? cancelAnimationFrame(id) : loop();
document.addEventListener('visibilitychange', onVis);
```

### 🟧 P4 — Up to 8 videos auto-play simultaneously, forever
**`app/page.tsx:124`** `<video src={v.url} controls autoPlay muted loop />`

Every generated card keeps streaming and looping. With 8 cards open (the default behaviour invites it — cards stay open after generating) that is **8 concurrent media streams, ~8 MB per loop cycle, decoded in parallel**, repeatedly. On mobile data this is expensive, and on low-end devices concurrent decoding causes jank.

**Fix:** `<video preload="none" poster={…} />`, play only the card in view (`IntersectionObserver`), pause others, and drop `loop` or limit to one loop.

### 🟧 P5 — API route is dynamic (`ƒ`) but stateless → uncacheable
**`app/api/v14/render/route.ts:33,46`** — build output marks the route `ƒ (Dynamic)` with `Cache-Control: no-store` semantics. Yet the handler has no request-dependent side effects besides reading the body. The `GET` at `:46` returns a constant and could be statically cached at the CDN, and `POST` responses could carry `s-maxage` if the clip set is static.

**Fix:** `export const revalidate = 3600` and/or `export const dynamic = 'force-static'` for GET; add explicit `Cache-Control` headers to the JSON response.

### 🟨 P6 — Dead Tailwind pipeline costs install and build time
**`package.json:23-25`** — `tailwindcss`, `postcss`, `autoprefixer` are installed and invoked in the build pipeline while producing **zero** utilities (B3). Either wire it up or remove ~30 MB of tooling from every cold install.

### 🟨 P7 — Whole page is a client component → no SSR content, 90.5 kB first-load JS
**`app/page.tsx:1`** `'use client'`. Build reports `First Load JS: 90.5 kB` for a page whose only content is static text, emoji, and a canvas. Nothing is server-rendered except the shell, so crawlers see little content (SEO) and the JS bundle is paid before first paint.

**Fix:** keep the page a **server component** (title, copy, engine grid as static markup), and isolate client behaviour in small islands: `<StarfieldCanvas />`, `<EngineCard />`, `<LanguagePicker />`. Static text stays out of the bundle.

### 🟨 P8 — Data structures rebuilt every render
**`app/page.tsx:12-19`** (the 6×8 string dictionary) and **`:21-30`** (`engines` array) are re-created on every state change — i.e. on every keystroke in the textarea (`:118` → `setPrompts`). Move both to **module scope** (const outside the component); zero cost, no `useMemo` needed.

### 🟨 P9 — `fetch → blob` download buffers the entire video in RAM
**`app/page.tsx:86`** — see B5. For real renders (100 MB+) this reliably crashes mobile Safari. Anchor-based download (or a signed URL with `Content-Disposition: attachment`) avoids the memory spike entirely. Also: `URL.createObjectURL` is revoked before the download commits.

### 🟨 P10 — No caching, lazy-loading, or poster strategy for media
**`app/page.tsx:124`** — no `preload="none"`, no `poster`, no `loading` strategy; videos from third-party hosts carry whatever cache headers those hosts choose (S8).

---

## 5. Best-practice suggestions

| ID | Practice gap | Where | Recommendation |
|---|---|---|---|
| **BP1** | No `next.config.js` at all | repo root | Add `next.config.mjs` — security headers (S6), `poweredByHeader: false`, image domains, `experimental.optimizePackageImports` |
| **BP2** | No committed lockfile | `package.json` | Commit `package-lock.json`; use `npm ci` everywhere |
| **BP3** | No lint/format guardrails | `package.json:12` | `.eslintrc.json` + `prettier` + `eslint-config-prettier`; `lint --max-warnings=0` (fixes B4) |
| **BP4** | No CI | — | `.github/workflows/ci.yml`: `npm ci` → `tsc --noEmit` → `lint` → `build` → `npm audit --audit-level=high` |
| **BP5** | No env/secret handling | — | `.env.example` (already whitelisted by `.gitignore:71`!) + validated env module (`@t3-oss/env-nextjs` or zod). Needed the moment real models are wired (B1) |
| **BP6** | No input validation at the trust boundary | `route.ts:35-37` | zod schema for `{ prompt, engine }`; also gives you S3/S4 fixes for free |
| **BP7** | Silent error handling, no logging | `route.ts:41` | Structured logger (`pino`/`console.error` with context) + Sentry; never `catch {}` |
| **BP8** | `any` despite `strict: true` | `page.tsx:12,40,61` | Ban `any` via `@typescript-eslint/no-explicit-any: error` |
| **BP9** | Zero tests | — | `vitest` for `pickClip`/`pickVideoByPrompt` (pure, trivial to test) + one Playwright smoke test (open card → generate → video element appears) |
| **BP10** | No runtime pinning | `package.json` | Add `"engines": { "node": ">=18.17 <23" }` and `"packageManager": "npm@10.9.8"` |
| **BP11** | Public API path leaks internal versioning | `app/api/v14/render` | Rename to `/api/render` (or `/api/v1/render`) — `v14` is a marketing version, not an API version (B13) |
| **BP12** | Claims vs. reality | README, UI | Add a "Demo mode" banner + honest capability matrix (B1/D2/S11) |
| **BP13** | Missing App Router conventions | `app/` | `error.tsx`, `loading.tsx`, `not-found.tsx`, `robots.ts`, `sitemap.ts`, `opengraph-image.tsx`, `icon.png` |
| **BP14** | Ad-hoc i18n | `page.tsx:12-19` | `next-intl` with locale routes; remove hardcoded Arabic keyword lists from business logic (`page.tsx:57-60`, `route.ts:16-19`) — keyword matching by translating the prompt is inherently brittle |
| **BP15** | No rate limiting / abuse policy | `route.ts:33` | Add before connecting any paid inference backend (S11) |
| **BP16** | Metadata is minimal | `layout.tsx:3-6` | Add `metadataBase`, `openGraph`, `twitter`, `icons`, `robots`, `alternates.languages` (6 locales!), and a `viewport/themeColor` export |
| **BP17** | Dependency hygiene | `package.json` | `next` is EOL (S2); budget a quarterly upgrade window; consider `npm-check-updates` + a Dependabot config |

---

## 6. Documentation improvements

### 🟥 D1 — README documents features that don't exist
**`README.md:12-26`** — the "Engines Integrated" table and "Features" list present Wan 2.2, Mochi 1, SVD and OpenShorts as shipped. There is no integration code, no model weights, no backend, no API keys, no GPU requirement mentioned anywhere. A developer who clones this expecting a video model gets 25 lines of keyword matching.

**Fix:** add a prominent **Status** block at the top:
```md
> **Status: UI demo / mock mode.** The interface and API shape are real; video
> "generation" currently returns public-domain sample clips. No model is bundled.
> See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the planned backend.
```
…and split the engines table into `✅ Implemented` vs `🧪 Planned`.

### 🟥 D2 — No API documentation
**`app/api/v14/render/route.ts:33-48`** — two undocumented endpoints, no schema, no status codes (and the current behaviour contradicts any sane contract: 200 on malformed body, S5).

**Fix — add `docs/API.md`:**
```md
## POST /api/render
Content-Type: application/json
{ "prompt": string (1–500), "engine": "wan"|"mochi"|"svd"|"shorts"|"ai"|"edge"|"ultra"|"ent" }

200 → { "video": "https://…/clip.mp4", "engine": "wan", "mode": "free-unlimited" }
400 → { "error": "Invalid JSON body" }
413 → { "error": "Prompt too long (max 500)" }
422 → { "error": "Invalid request", "issues": [...] }
429 → { "error": "Rate limit exceeded" }   (once S11 is implemented)
500 → { "error": "Render failed" }

## GET /api/render
200 → { "status": string, "mode": string }
```

### 🟧 D3 — `README.md:28-36` "Quick Start" is materially incomplete
It says `npm install && npm run dev` only. Missing: Node ≥ 18.17, the fact that `npm run lint` currently **hangs** (B4), how to run production (`build` + `start`), the port, env vars, and the Tailwind-is-not-configured gotcha (B3). Someone following it will hit at least two surprises.

### 🟧 D4 — No project-structure / architecture section
A 6-file tree with one paragraph per file would take 10 minutes and save every contributor an hour — especially to explain *why* there are three engine registries (B2/B14) so nobody adds a fourth.

### 🟧 D5 — No doc comments on exported or non-obvious code
**`lib/engines/router.ts:10`** (`routePrompt` — what does it actually route?), **`app/api/v14/render/route.ts:14`** (`pickVideoByPrompt` — the keyword heuristic is a contract users will rely on), **`app/page.tsx:74`** (`generate` — the 1000 ms fake delay deserves an explicit `// MOCK:` marker so no one mistakes it for real work).

**Fix:** TSDoc on every export:
```ts
/**
 * Maps a free-text prompt + engine id to a sample clip.
 * NOTE: temporary mock for v1 — replaced by job-based inference (see docs/ARCHITECTURE.md).
 * @param prompt user text, 1–500 chars, matched case-insensitively
 */
```

### 🟨 D6 — No credits/attribution section
**`README.md:41-43`** — see S9. Add `## Credits` listing Blender Foundation (Sintel, Big Buck Bunny, CC-BY 3.0) and the source of the jellyfish clip.

### 🟨 D7 — `package.json` metadata incomplete
**`package.json:1-28`** — no `repository`, `homepage`, `bugs.url`, `engines`, or `packageManager`. `author: "SupernovaSolutionsHQ"` should be an object with a URL. This is the metadata npm/GitHub surface; it currently links nowhere.

### 🟨 D8 — No governance/ops docs
Missing: `CONTRIBUTING.md`, `SECURITY.md` (how to report a vuln — ironic given S2), `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `docs/DEPLOYMENT.md` (Vercel? self-host? which env vars?).

### 🟨 D9 — Single-language docs for a 6-language app
`README.md` is English-only, yet the product targets DZ/AR/FR (and the UI ships AR, FR). Add at least an Arabic and French README section or `README.ar.md`/`README.fr.md` with language switcher links — it's also a cheap trust signal for your stated audience (`README.md:39`).

### 🟨 D10 — No screenshots or demo link
`README.md` has badges but no visual. One screenshot or animated GIF of the studio, plus the deployed URL, would do more for adoption than the entire current feature table.

---

## 7. Prioritized remediation roadmap

### 🔴 P0 — this week (security + honesty)
1. **S2** → bump `next` to the newest patched release; run `npm audit` in CI.
2. **S1** → commit `package-lock.json`, use `npm ci`.
3. **S3 + S4 + S5** → validate the request body with zod, allowlist `engine`, cap prompt length, stop echoing the prompt, return proper 400/413/422/500 (one afternoon, deletes three findings).
4. **B1 + D1** → label the app "Demo mode" in UI **and** README until a real backend exists (protects you legally and reputationally).
5. **B3 / B4** → either commit `postcss.config.js` or drop Tailwind; add `.eslintrc.json`.

### 🟡 P1 — next 2 weeks (correctness + safety net)
6. **S6** → `next.config.mjs` with CSP + security headers + `poweredByHeader: false`.
7. **B2 / B14** → one `lib/engines/registry.ts`; delete or adopt `lib/engines/router.ts`; make the UI call the API.
8. **B5 / B8 / B7** → fix download, canvas sizing, meteor splice.
9. **B11 + B9** → keyboard-accessible cards, RTL/lang handling.
10. **BP4/BP9** → CI (typecheck + lint + build + audit) and a handful of unit tests for the picker functions.
11. **P1/P2/P3** → canvas loop rewrite (size once, batch paths, honour reduced-motion).

### 🟢 P2 — next month (quality + growth)
12. **Q1/Q2/Q3** → component split, typed i18n, design tokens/CSS modules, remove `any`.
13. **P4/P7** → media playback strategy + server/client component split for SEO and bundle size.
14. **B16, BP13, BP16, D2-D10** → App Router conventions, metadata/OG, API docs, architecture doc, credits, multi-language README.
15. **S8/S9** → self-host sample media (`public/media/`) and add attribution.
16. Consider `next@16` + `react@19` migration once CI is green.

---

## 8. What's already good — keep it

- **The visual design is genuinely strong.** The gold `#D4AF37` on near-black with a subtle starfield reads as a premium product; the card/grid layout is clean and responsive (`gridTemplateColumns: repeat(auto-fill, minmax(340px, 1fr))`, `page.tsx:103`).
- **The build is clean.** `tsc --noEmit` passes with `strict: true`, `next build` succeeds with no warnings, and first-load JS is a lean 90.5 kB.
- **No secrets, no hardcoded keys, no `eval`, no `dangerouslySetInnerHTML` anywhere.** The attack surface is small and easy to harden.
- **`'use client'` is applied to exactly one file** — the boundary is drawn in the right place (just too coarsely; see P7).
- **`.gitignore` is thorough** (a standard Next.js template) and already anticipates `.env` files (line 71).
- **Multi-language intent from day one** (6 locales) is a real differentiator for your market — worth finishing properly with `next-intl`.
- **`/api/v14/render` has a sane shape** (`{ prompt, engine } → { video }`) and a health-check `GET`. Once validated and documented, it's a fine public contract.

---

## Appendix A — Verification log

| Claim | How verified | Result |
|---|---|---|
| Typecheck passes | `npx tsc --noEmit` | exit 0 |
| Production build passes | `npm run build` (`next@14.2.35`) | ✅ compiled, 5/5 static pages |
| Tailwind not compiled | inspect `.next/static/css/*.css` | 124 B, literal `@tailwind` at-rules |
| `npm run lint` unusable | `npx next lint < /dev/null` | interactive ESLint prompt |
| Vulnerable deps | `npm audit` | next: **critical**, 25 advisories; postcss: **high** |
| No lockfile | `git ls-files` | `package-lock.json` absent (generated only by my `npm install`, then removed) |
| Malformed JSON → 200 | `curl -d '{not json'` | `200` + default video (S5) |
| No body → 200 | `curl -X POST` (no `-d`) | `200` + default video (S5) |
| Prototype leak | `{"engine":"__proto__"}` | `{"video":{},"mode":…}` (S3) |
| `constructor` breaks contract | `{"engine":"constructor"}` | `video` key missing (S3) |
| Unbounded body + echo | 1 MB prompt | `200`, 1,000,105-byte response (S4) |
| No security headers | `curl -D -` on `/` | only `X-Powered-By`, `ETag`, `Cache-Control` (S6) |
| API unreachable from UI | `grep "api/v14\|fetch(" app/` | only `download()` uses `fetch` (B2) |
| `router.ts` dead | `grep routePrompt\|ENGINES` | 0 external references (B14) |
| Third-party media unreachable from sandbox | `curl -I` on both hosts | blocked by sandbox egress — external dependency unverifiable (S8) |

## Appendix B — Full issue index

**Security:** S1 (crit) lockfile · S2 (crit) vulnerable deps · S3 (high) no allowlist/proto leak · S4 (high) unbounded body+reflection · S5 (high) catch-all 200 · S6 (med) no headers · S7 (med) reverse tabnabbing · S8 (med) hotlinked media · S9 (med/legal) CC-BY attribution · S10 (low) version disclosure · S11 (low) no rate limit

**Bugs:** B1 (crit) fake generation · B2 (high) duplicated/drifted logic, API unreachable · B3 (high) Tailwind never compiles · B4 (high) lint unusable · B5 (high) broken download · B6 (med) `undefined` video src · B7 (med) splice-during-forEach · B8 (med) canvas resize/HiDPI · B9 (med) no RTL/lang · B10 (med) dangling timeout · B11 (med) keyboard-inaccessible · B12 (low) incomplete translations · B13 (low) version/engine drift · B14 (low) dead `router.ts` · B15 (low) colour flash · B16 (low) missing error/loading pages

**Quality:** Q1 god component · Q2 `any` vs strict · Q3 inline-style design system · Q4 duplicated URL literals · Q5 misleading names · Q6 tsconfig · Q7 no semantics · Q8 no tests/CI · Q9 `private:false` · Q10 nested ternaries

**Performance:** P1 canvas realloc 60 fps · P2 per-frame allocations · P3 never pauses/no reduced-motion · P4 8 autoplaying videos · P5 uncacheable API · P6 dead Tailwind tooling · P7 100 % client page · P8 per-render literals · P9 blob-buffered download · P10 no media caching/poster

**Best practices:** BP1-BP17 (see §5)
**Documentation:** D1-D10 (see §6)
