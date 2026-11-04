# Architecture

How Supernova Video Studio is put together, and why each choice was made.

```
Browser
  │
  ├── middleware.ts ──────────── auth gate (/studio, /history, /dashboard)
  │                              real 404 for unknown share slugs
  │
  ├── App Router (server components) ── pages read SQLite directly
  │     ├── layout + SiteHeader (session read on the server)
  │     ├── client islands: StudioWorkbench, EngineCard, ShareButton, ClipShowcase
  │     └── SVG charts rendered on the server, zero chart JS
  │
  ├── Route handlers
  │     ├── /api/render, /api/render/:id       create + poll jobs
  │     ├── /api/renders                       recent history for the studio rail
  │     ├── /api/media/:id                     stream an MP4 inline (Range/206)
  │     ├── /api/download/:id                  stream an MP4 with Content-Disposition
  │     ├── /api/share/:id                     mint/reuse a public slug
  │     └── /api/auth/[...nextauth]            Auth.js callbacks
  │
  ├── lib/render/service.ts ─── provider ⇄ database bridge
  │     └── ProviderRouter ─┬─ fal.ai queue API
  │                         ├─ Replicate predictions
  │                         └─ demo renderer (fallback / no key)
  │
  ├── lib/media/store.ts ────── provider URL → data/videos/<id>.mp4
  │
  └── db/ (better-sqlite3) ──── users · renders · events
```

## Layers

| Layer         | Files                                           | Responsibility                                                       |
| ------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| Routing/shell | `app/*`                                         | Pages, metadata, server rendering                                    |
| Interaction   | `components/*`                                  | Client islands (studio, share button, showcase)                      |
| Domain logic  | `lib/*`                                         | Auth, analytics, sharing, formatting, engines                        |
| Rendering     | `lib/render/*`                                  | Provider contract, fal/Replicate/demo backends, router, DB mirroring |
| Persistence   | `db/*`                                          | Schema, migrations, typed queries                                    |
| Media         | `lib/media/*`, `scripts/generate-demo-clips.py` | Download-to-disk, Range streaming, the 24 bundled clips              |

## Request lifecycle: creating a render

1. `POST /api/render` with `{ prompt, engine }`.
2. `isSameOrigin()` rejects cross-site submissions (403).
3. `requireApiUser()` resolves the session JWT and re-reads the user row (401 if
   signed out, so a deleted account cannot keep going).
4. A token bucket keyed by **user id** (falling back to IP) enforces the budget
   (429 + `Retry-After`).
5. Body size (8 KB) and prompt length (400 chars) are checked before parsing;
   then Zod validates shape and the engine allow-list (422, with no job leaked).
6. `startRender()` asks the router for a job, inserts a `renders` row owned by the
   user (recording _which_ provider accepted it), and logs a `render_started`
   event. If the live provider rejects the job, the router submits it to the demo
   renderer and the response carries `fallback: true`.
7. The finished row carries `provider`, `clip`, `video_url`, `poster_url` and
   `duration_ms` — which is what history, the dashboard, the share page and the
   download route all read. A live result is downloaded into `MEDIA_DIR` first, so
   `video_url` points at `/api/media/<id>` rather than an expiring provider link.
8. The client polls `GET /api/render/:id`; each poll asks the provider for status
   and mirrors it into the row. Terminal transitions write `render_succeeded` /
   `render_failed` exactly once.
   The provider owns _job state_; the database owns _ownership, history and
   analytics_. That split is why adding a backend (fal, Replicate, your own GPU)
   touches one file and nothing else.

## Auth design

- **Auth.js v5 (NextAuth)** with two providers: GitHub OAuth (only registered
  when `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET` exist) and a `guest` credentials
  provider that mints an ephemeral account in one click.
- **Split configuration.** `lib/auth.config.ts` is edge-safe (no database import)
  and is what `middleware.ts` uses; `lib/auth.ts` adds the providers and the
  `signIn` callback that writes users to SQLite. Without this split, the
  middleware bundle would try to pull a native module into the edge runtime.
- **JWT sessions** (required for credentials sign-in), 30-day lifetime. The JWT
  carries only `uid`; every request re-reads the user row, so account state is
  authoritative in the database.
- **Guest accounts** are rows with `provider = 'guest'` and no email. They can be
  pruned with `pruneStaleGuests()`.
- **Middleware vs page checks.** Middleware issues a real `307` to `/login?next=…`
  for the account area. Pages still call `requireUser()` because middleware can be
  bypassed by a matcher mistake — two independent checks, one redirect path.

## Data model

```sql
users   (id, name, email, image, provider, created_at, updated_at)
renders (id, user_id → users.id, engine, prompt, status, progress, provider,
         provider_job_id, source_url, clip, video_url, poster_url, error,
         duration_ms, share_slug, shared_at, created_at, updated_at)
events  (id, user_id, type, render_id, metadata, created_at)   -- append-only
```

- **TEXT UUID primary keys** and **INTEGER epoch-ms timestamps** everywhere. No
  SQLite-specific types, no autoincrement counters to migrate.
- `renders.share_slug` is `UNIQUE`; sharing is idempotent because the slug is only
  minted when it is `NULL`.
- `renders.provider` / `provider_job_id` record which backend owns the job
  (`fal:req_x`, `replicate:pred_y`, `demo:uuid`); `source_url` keeps the
  provider's own link as a fallback for playback if the download failed.
- `events` is append-only and drives every analytics figure that is not derived
  from current render state (downloads, shares, sign-ins).
- Foreign keys are enforced (`PRAGMA foreign_keys = ON`) and cascade on user
  deletion.
- WAL journal mode with a 5 s busy timeout: reads never block writers.

### Migrations

`db/migrations.mjs` is plain ESM exporting `{ version, name, sql }[]`, applied in
order and recorded in `schema_migrations` inside a transaction. There are two so
far: `0001_core` (users, renders, events) and `0002_live_video` (adds
`provider`, `provider_job_id`, `source_url` plus their indexes). It is plain JS on
purpose: the TypeScript app (`db/client.ts`) and the plain-Node seed script
(`scripts/seed.mjs`) import the _same_ definitions, so seeding can never drift
from the app schema. Migrations run automatically on first connection.

### Database portability, and why not Prisma

The brief asked for Prisma with SQLite locally and Postgres in production. It is
not used here, and the reason is concrete: **Prisma downloads its query and
schema engines from `binaries.prisma.sh`** during install and `prisma generate`.
That host is not reachable from the build environment used to produce and verify
this release (`npm install prisma@6` succeeds, `prisma generate` fails with a TLS
connection error), and a database layer that cannot generate its client cannot be
tested. Shipping a `schema.prisma` that nobody has run would be worse than
shipping a tested data layer with a documented porting path.

What we have instead is deliberately portable:

- All SQL lives in `db/*.ts`; nothing else in the app issues queries.
- Types are dialect-neutral (UUID text, epoch-ms integers, `REFERENCES … ON DELETE
CASCADE`).
- The only SQLite-flavoured expressions are `date(created_at / 1000, 'unixepoch')`
  in the analytics window query and `LOWER(prompt) LIKE ?` for search.

Porting to Postgres is a contained job:

1. Add `pg` and replace `db/client.ts` with a `pg.Pool` (the module already owns
   the connection singleton).
2. Translate the migration DDL (`TEXT` keys are fine; `INTEGER` timestamps become
   `BIGINT`).
3. Swap `date(created_at / 1000, 'unixepoch')` for
   `to_char(to_timestamp(created_at / 1000), 'YYYY-MM-DD')` and add
   `CREATE EXTENSION pg_trgm` for the search index.
4. Point `DATABASE_PATH` at a `DATABASE_URL` and update the health check.

Every call site outside `db/` is untouched, and the analytics tests already
assert on the shape rather than the dialect.

## Provider seam

```ts
interface RenderProvider {
  readonly id: 'demo' | 'fal' | 'replicate';
  readonly mode: RenderMode; // 'demo' | 'live'
  readonly model?: string;
  submit(input: RenderInput): Promise<ProviderJob>;
  status(providerJobId: string, context: { submittedAt: number }): Promise<ProviderJob | null>;
}
```

Everything volatile — provider URLs, statuses, video links — stays behind this
interface. A job is identified across restarts by a **prefixed id**: `fal:req_123`,
`replicate:pred_abc`. The database only stores that string, so polling never needs
in-memory state and a serverless instance can pick up a job another one started.

`lib/render/providers/` holds one file per backend:

| Provider    | Submit                                                                             | Poll                                          | Notes                                                                     |
| ----------- | ---------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| `fal`       | `POST {base}/{model}` with `Authorization: Key …` → `request_id`                   | `/requests/{id}/status` then `/requests/{id}` | Queue API; cheapest per second; default `fal-ai/ltx-2/text-to-video/fast` |
| `replicate` | `POST /v1/models/{owner}/{name}/predictions` (or `/v1/predictions` with a version) | `GET /v1/predictions/{id}`                    | Official-model routes since 2025-08; `output` walked for a video URL      |
| `demo`      | in-memory record, timestamped                                                      | derived from elapsed time                     | Bundled clip via `pickClip()`; survives as the fallback                   |

`ProviderRouter` sits in front of them. It resolves the live provider from the
environment, forwards `submit()`, and on a submit error (auth, credit, 5xx,
network) records the job against the **demo** provider instead, returning a
`202` with `fallback: true` and a human-readable `notice`. Status calls are
routed by the id prefix, so a fallback job keeps working even after a redeploy.

`lib/render/http.ts` is the only place that talks to the network: JSON in/out,
30 s timeout, provider-specific error mapping (401/403 → `provider-auth`, 402 →
out of credit, 429 → rate limited, 5xx → `provider-failed`) and **secret
redaction** — a key can never appear in a log line, an API error or a page.

Selection precedence (`lib/render/providers/index.ts`): `RENDER_PROVIDER` decides
(`auto` = fal → replicate → demo), and a forced provider without its key is a
startup error, not a silent demo. Resolution is memoised per process; tests reset
it with `resetRenderProvider()`.

If a provider forgets a job (restart, eviction), the service fails the row after
`LOST_JOB_GRACE_MS` (90 s) instead of leaving it spinning forever.

## Media pipeline

Two jobs: the bundled demo library, and the real generated videos.

**Bundled clips.** `scripts/generate-demo-clips.py` renders 24 three-second
960×540 clips plus posters with numpy + Pillow and encodes them with ffmpeg
(`imageio-ffmpeg`). Each scene is vectorised arithmetic — no per-pixel Python
loops — so the whole library renders in minutes. Total weight: ~1.6 MB of video
and ~0.6 MB of posters, all self-hosted (no third-party requests, so the CSP stays
`'self'` only).

**Generated videos.** Provider URLs are temporary — Replicate deletes files after
roughly an hour, fal media expires too — so a finished render is **downloaded
once** into `MEDIA_DIR` (`data/videos/<renderId>.mp4`, written to `.part` then
renamed) and the row's `videoUrl` is rewritten to `/api/media/<id>`. The original
URL is kept in `source_url` and proxied if the download failed, so a storage
problem degrades instead of losing the clip.

- `lib/media/store.ts` — `downloadVideo()` with a 180 s timeout, a
  `VIDEO_MAX_BYTES` ceiling enforced _while streaming_, and `isSafeRemoteUrl()`
  (http(s) only, no link-local/metadata hosts, loopback only when the operator
  pointed a provider at a custom base URL).
- `lib/media/serve.ts` — one function, three sources in order: local file →
  bundled `public/media` clip (demo renders) → provider proxy → `404`. Local files
  answer `Range` with `206` and `Content-Range`, so seeking works and the
  integration suite can prove it.
- `app/api/media/[id]` streams inline, `app/api/download/[id]` streams as an
  attachment. Both are owner-or-shared and return `404` for anything else.

Keeping playback behind our own origin is also why the CSP can stay
`media-src 'self'`: no hot-linking, no CORS, no provider cookies.

## Analytics

`lib/analytics.ts` returns one typed object: personal totals, success rate,
average duration, downloads/shares from `events`, a 14-day per-day series with
missing days filled in, and the engine mix ordered by count. Days are bucketed in
UTC so server and client render identical strings and hydration never mismatches.

The dashboard draws that object as server-rendered SVG (`components/Charts.tsx`) —
no charting dependency, no client JS, and `<title>` elements give native tooltips.

## Frontend

- **Server components by default.** Only four things are client islands: the
  studio workbench (prompt state, polling), the engine card (job state), the share
  button (`navigator.share`) and the clip wall (IntersectionObserver autoplay).
- **Styling** is CSS Modules over design tokens in `app/globals.css` — no runtime
  CSS engine, no utility classes, no PostCSS pipeline.
- **i18n** is a typed dictionary: adding a key breaks the build until all six
  locales provide it. The document `lang`/`dir` follow the active locale.
- **Motion** is CSS only: a `.stagger` utility deriving delay from an `--i` custom
  property, disabled under `prefers-reduced-motion`.
- **Mobile** uses a bottom dock (thumb reach), `env(safe-area-inset-*)` padding on
  every full-width shell, and 44 px minimum touch targets.

## Testing

| Layer             | Tool                           | What it proves                                                                                                                                                                                                                                                                                                              |
| ----------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (99)         | Vitest                         | Clip matcher, registry/file integrity, i18n completeness, validation, demo renderer, fal + Replicate clients against a mocked `fetch` (statuses, auth/credit/rate-limit errors, secret redaction), fallback router, media helpers, render service on in-memory SQLite, rate limiter, analytics, slugs, redirect safety      |
| Integration (150) | `scripts/integration-test.mjs` | Real `next start`: headers, auth gate, guest sign-in with cookies + CSRF, validation, lifecycle, media + Range, downloads, ownership, sharing, OG tags, history, dashboard, 429s, **and the live path against a local stub fal server** (download to disk, `/api/media` streaming, forced 500 + forced 402 → demo fallback) |
| CI                | GitHub Actions                 | typecheck → lint → format → unit → build → integration, plus `npm audit` gates                                                                                                                                                                                                                                              |

## Decisions worth knowing

| Decision                                | Reason                                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| better-sqlite3 over Prisma              | Prisma engines unreachable in this environment; SQLite is prebuilt and offline-capable                                      |
| JWT sessions                            | Required by the credentials (guest) provider                                                                                |
| Middleware for the auth gate            | Real `307`s; a redirect thrown after streaming can only run client-side                                                     |
| Share 404s in middleware                | `notFound()` inside a dynamic segment renders 200 with a client boundary                                                    |
| Server-rendered SVG charts              | Two chart shapes do not justify a charting bundle                                                                           |
| Hand-rolled slug generator              | 50 bits of entropy in 10 characters, no dependency                                                                          |
| fal.ai as the default provider          | Cheapest per second in 2026 (~$0.05/s at 480p) plus $10 of signup credit; Replicate stays as the catalogue-rich alternative |
| Prefixed provider job ids               | Polling survives restarts and serverless instances with no in-memory map                                                    |
| Download to disk instead of hot-linking | Provider URLs expire within an hour; local files also keep the CSP at `media-src 'self'`                                    |
| Demo fallback instead of a hard failure | A paying user should never see a dead render; the row and the API still say `demo`                                          |
| UTC formatting everywhere               | Identical server and client strings, so no hydration mismatch                                                               |
