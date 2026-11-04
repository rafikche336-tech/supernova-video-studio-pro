# Architecture

> Audience: developers extending the studio. For the API contract see
> [API.md](./API.md); for the security posture see [SECURITY.md](../SECURITY.md).

## 1. Shape of the app

```
Browser
  │
  │  GET /                        → static shell (server component, prerendered)
  │  POST /api/render             → create job      → RenderProvider.create()
  │  GET  /api/render/:id         → poll job        → RenderProvider.get()
  │  GET  /media/*.mp4            → immutable cached clip
  ▼
Next.js 16 (App Router, Node runtime)
  ├── app/page.tsx           server component: metadata, no-JS fallback
  ├── components/StudioApp   the only client island
  └── lib/                   pure logic, fully unit-tested
```

Two rules keep this simple:

1. **The client never decides what a clip is.** Prompt → clip mapping lives in
   `lib/engines/pick-clip.ts` and runs on the server. The UI only renders what
   the job returns.
2. **Everything generated is typed at the boundary.** `lib/render/schema.ts`
   (zod) is the only way a request becomes a job.

## 2. Layers

| Layer            | Files                                                 | Depends on                                |
| ---------------- | ----------------------------------------------------- | ----------------------------------------- |
| Data / catalogue | `lib/engines/registry.ts`                             | nothing                                   |
| Domain logic     | `lib/engines/pick-clip.ts`, `lib/render/job-store.ts` | registry                                  |
| Validation       | `lib/render/schema.ts`                                | registry, zod                             |
| Providers        | `lib/render/mock-provider.ts`, `live-provider.ts`     | domain + types                            |
| Transport        | `app/api/render/**`                                   | validation, providers, rate-limit, logger |
| Presentation     | `app/page.tsx`, `components/*`                        | registry, i18n, hooks                     |
| Platform         | `lib/env.ts`, `lib/config.ts`, `lib/logger.ts`        | nothing                                   |

`lib/` has no React and no Next imports (except `env.ts` reading `process.env`),
which is why it is cheap to test.

## 3. The render job lifecycle

```
POST /api/render
  → rate limit → size checks → zod validation
  → provider.create()  ─────────────►  RenderJob { status: 'queued' }
  ← 202 { job, mode }

GET /api/render/:id  (client polls every 350 ms, 60 s budget)
  → provider.get()  ───────────────►  queued → running → succeeded | failed
  ← 200 { job }        (terminal status ends the poll)
```

The demo provider derives `status`/`progress` from elapsed time, so it needs no
background worker. A real implementation would store the provider-side job id
and map its states onto `JobStatus`.

`TtlStore` (`lib/render/job-store.ts`) bounds memory: 10-minute TTL and 500
entries, evicting oldest-first.

### Scaling

Jobs live in **process memory**. That is fine for a single instance (and for the
demo), but behind a load balancer a poll can land on an instance that never saw
the create call. Before scaling out, replace `TtlStore` with Redis/Postgres in
`MockRenderProvider`/`LiveRenderProvider` — the interface does not change.

## 4. Plugging in a real model

The seam is one interface:

```ts
// lib/render/types.ts
export interface RenderProvider {
  readonly mode: RenderMode;
  create(input: RenderInput): Promise<RenderJob>;
  get(id: string): Promise<RenderJob | null>;
}
```

1. Implement it in `lib/render/live-provider.ts` (a stub is there with a
   checklist). Typical shape:
   - `create()` → POST to Replicate / fal.ai / RunPod / your GPU worker, store
     `{ job.id → providerJobId }` in a durable store, return `status: 'queued'`.
   - `get()` → query the provider, map states, and on success return a signed
     URL in `videoUrl` (+ `posterUrl`).
2. Set `RENDER_PROVIDER=live`, `RENDER_API_URL`, `RENDER_API_KEY`.
3. Nothing else changes: the routes, the polling hook, the progress bar, the
   error and retry states and the download button already handle the contract.
4. Before going public: add auth, a shared rate limiter and cost caps.

Live mode **fails loudly** (`501`) rather than silently falling back to demo
clips — a caller must never mistake demo output for model output.

## 5. Internationalisation

- `lib/i18n.ts` exports a `Dictionary` interface and six complete
  `Record<Locale, Dictionary>` entries. Because the interface is the contract, a
  missing key is a TypeScript error, and `tests/i18n.test.ts` asserts key parity
  across all six locales.
- Arabic sets `dir: 'rtl'`; `StudioApp` writes `document.documentElement.lang`
  and `.dir` whenever the locale changes, so screen readers announce the right
  language and CSS logical properties flip correctly.
- The saved locale is read with `useSyncExternalStore` (server snapshot = the
  default locale), which keeps hydration deterministic with no setState-in-effect.
- Locale switching is client-side, so initial HTML is English. If per-language
  SEO matters, move to `next-intl` with locale-prefixed routes — that also makes
  the document language server-rendered.

## 6. Styling

Plain CSS Modules on top of design tokens in `app/globals.css`.

**Why not Tailwind?** v1 shipped `@tailwind base;` with no `postcss.config.js`,
so the at-rules reached browsers unprocessed and every utility was inert, while
the page styled itself with ~24 inline `style={{…}}` objects. Centralising the
design in custom properties fixed both problems at once (real `:hover` /
`:focus-visible` states became possible) with no build-time dependency.

If you want Tailwind back, add it deliberately:

```bash
npm i -D tailwindcss @tailwindcss/postcss
printf 'export default { plugins: { "@tailwindcss/postcss": {} } };\n' > postcss.config.mjs
# then use `@import "tailwindcss";` in app/globals.css
```

and migrate component styles incrementally.

## 7. Performance notes

- **Canvas**: sized on mount/resize only (never per frame), DPR-aware up to 2×,
  stars batched into three `Path2D` fills, dead meteors filtered (not spliced),
  loop suspended on `visibilitychange` and under `prefers-reduced-motion`
  (single static frame instead).
- **Video**: `preload="none"` + `IntersectionObserver` playback, so clips only
  download and decode while visible.
- **Bundle**: the server component shell keeps static markup out of JS; only the
  studio is a client island. Build output is ~4 kB of page JS plus shared chunks.
- **Caching**: `/media/*` is `immutable` for a year; `GET /api/render` is
  edge-cacheable; `POST` and job polling are `no-store`.

## 8. CSP nonces (optional hardening)

`next.config.ts` ships a CSP with `script-src 'self' 'unsafe-inline'`, which is
required because the page is statically prerendered and Next inlines the
hydration payload. To remove `'unsafe-inline'`:

1. Add `middleware.ts` that generates a per-request nonce and sets a
   `Content-Security-Policy` header containing `'nonce-<value>'`; Next picks the
   nonce up and applies it to its own scripts.
2. Accept that the page becomes dynamically rendered (no static prerender).

For a marketing-first page, keep the static build and the current policy; the
practical attack surface is small because no user input is ever rendered as HTML.
