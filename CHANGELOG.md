# Changelog

All notable changes to this project. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[SemVer](https://semver.org/).

## [3.1.0] — 2026-11-04

**Real video, honest fallback.** Prompts are now sent to a real text-to-video model
when a provider key is configured, and demo mode survives as the automatic
fallback instead of being the only mode. The `MockRenderProvider` /
`LiveRenderProvider` pair is gone, replaced by a provider layer with three
backends behind one interface.

### Added

- **fal.ai provider** (`lib/render/providers/fal.ts`) — the queue API
  (`POST /{model}` → `request_id`, poll `/requests/{id}/status`, fetch
  `/requests/{id}`). Default model `fal-ai/ltx-2/text-to-video/fast`; roughly
  $0.05/second of 480p video in 2026 and $10 of signup credit.
- **Replicate provider** (`lib/render/providers/replicate.ts`) — official-model and
  versioned prediction routes, `output` walked for a video URL.
- **`ProviderRouter`** — resolves the live provider from the environment and
  falls back to the demo renderer for any job the live provider rejects, marking
  the response `fallback: true` with a readable `notice`.
- **`/api/media/:id`** — inline, Range-capable (206) video streaming, owner or
  shared only. `MEDIA_DIR` keeps generated MP4s on disk so expiring provider URLs
  (Replicate deletes after ~an hour) never break a library.
- **Download-on-success** (`lib/media/store.ts`) — size-capped, `.part` + rename,
  SSRF-guarded URL check, provider URL kept in `source_url` as a proxy fallback.
- **Migration `0002_live_video`** — `renders.provider`, `renders.provider_job_id`,
  `renders.source_url` plus indexes.
- **Provider transparency in the UI** — the result panel says *what* produced the
  clip ("Generated with fal.ai…" / "Demo clip — no paid model was called"), the
  history card shows the backend, and share pages credit it too.
- **`GET /api/render`** now reports `provider` (id, model, live, requested, notice,
  configured booleans). Keys are never echoed.
- **Tests** — 25 new unit tests (fal/Replicate against a mocked `fetch`, router
  fallback, media helpers, render service on in-memory SQLite) and 38 new
  integration checks, including the live path against a **local stub fal server**
  (download to disk, `/api/media` streaming, Range 206, forced 500 and forced 402
  → demo fallback). The suite still needs no key and no network.

### Changed

- `RENDER_PROVIDER` now accepts `auto` (default) | `demo` | `fal` | `replicate`;
  `live` is accepted as an alias for `auto`.
- `RENDER_API_URL` / `RENDER_API_KEY` are **removed** in favour of provider-specific
  variables (`FAL_KEY`, `REPLICATE_API_TOKEN`, …).
- Polling is faster (`POLL_INTERVAL_MS` 1500) with a 10-minute client timeout, and a
  job abandoned by its provider is failed after a 90 s grace window.
- Downloads serve bundled demo clips as well as generated files, so the button
  works in both modes.
- Copy that claimed "the video model is mocked" is now mode-aware in all six
  locales.

### Fixed

- Provider failures (401/402/403/429/5xx, timeouts) are mapped to human-readable
  errors instead of surfacing a stack trace, and secrets are redacted everywhere.

### Upgrade notes

1. Nothing to do if you are happy with demo mode.
2. To generate real video: set `FAL_KEY` (or `REPLICATE_API_TOKEN`) and keep
   `RENDER_PROVIDER=auto`. See the README's *Turn on real video generation*.
3. The schema migrates itself on first boot; existing rows get `provider = NULL`
   and keep working (they render as demo clips).
4. Put `MEDIA_DIR` on persistent storage in production.

## [3.0.0] — 2026-11-04

**The demo becomes a product.** The video model is still mocked; accounts,
persistence, downloads, sharing and analytics are now real. Breaking: rendering
requires a session, and the studio moved from `/` to `/studio`.

### Added

- **Accounts** — Auth.js v5 with GitHub OAuth and one-click guest sign-in.
  Users, sessions and ownership are enforced end to end; the login page reports
  when OAuth is not configured instead of failing silently.
- **Database** — SQLite via `better-sqlite3` with hand-written, auto-applied
  migrations (`db/migrations.mjs`) shared by the app and the seed script. Tables:
  `users`, `renders`, `events`.
- **History** (`/history`) — prompt search, engine filter and pagination, all in
  SQL and all reflected in the URL.
- **Downloads** — `/api/download/:id` streams the MP4 with
  `Content-Disposition` and owner/shared-only access.
- **Sharing** — `POST /api/share/:id` mints an unguessable 10-character slug
  (idempotent), plus a public page at `/s/:slug` with per-render Open Graph and
  Twitter metadata.
- **Analytics** (`/dashboard`) — 14-day volume chart, engine mix, success rate,
  average render duration, downloads/shares and deployment totals, rendered as
  server-side SVG with no chart dependency.
- **Media library** — 18 new procedurally generated clips (24 total), each with a
  poster, plus keyword rules in six languages.
- **Mobile** — thumb-reachable bottom dock, `env(safe-area-inset-*)` padding and
  44 px touch targets.
- **Motion** — staggered entrance animations via a `.stagger`/`--i` utility,
  fully disabled under `prefers-reduced-motion`.
- **Tooling** — `npm run seed` / `npm run seed:reset`; account-area and share
  routing in `middleware.ts` (Node runtime).
- **Tests** — 74 unit tests (database layer, analytics, slugs, redirect safety)
  and 112 integration checks (auth flow with cookies + CSRF, ownership, downloads,
  sharing, OG tags, dashboard, rate limiting).

### Changed

- `/` is now a public landing page; the workbench lives at `/studio` behind auth.
- The render API requires a session and persists every job; `GET /api/render`
  advertises `requiresAuth`.
- Rate limiting is keyed by user id when signed in.
- The demo banner now reads "the video model is mocked; accounts, history and
  downloads are real".
- `robots.txt` disallows the account area; share pages are `noindex`.
- Version 3.0.0; `next-auth` and `better-sqlite3` added to the runtime tree.

### Fixed

- Unknown share slugs return a real `404` (a `notFound()` inside a dynamic
  segment renders `200` with a client-side boundary).
- Anonymous visits to `/studio`, `/history` and `/dashboard` return a real `307`
  to the login page instead of a client-applied redirect.
- Share URLs use the configured public origin instead of the internal request
  host.

### Security

- Owner-scoped queries: another account's ids are a `404`, never `403`.
- Same-origin enforcement on state-changing requests (`403` on mismatched
  `Origin`).
- `safeNextPath()` blocks open-redirect payloads on the login redirect.
- Download route resolves files only under `public/media`, never from user input.
- `AUTH_SECRET` is required in production and warns loudly when missing.

### Not done (and why)

- **Prisma** — its engine binaries are downloaded from `binaries.prisma.sh`,
  which is unreachable in the environment this release was built and verified in;
  `prisma generate` fails there. The data layer is plain SQL behind `db/client.ts`
  with a documented Postgres port path (see `docs/ARCHITECTURE.md`).

## [2.0.0] — 2026-11-04

Full remediation of the project audit (see `AUDIT_REPORT.md`). This release is
**breaking** for anyone calling `POST /api/v14/render` or relying on the old
fake-success behaviour — both are documented below.

### Security

- **Dependencies** — Next.js 14.2.35 → **16.4.5**, React 18 → **19.3.1**,
  TypeScript 5.9, ESLint 9. Clears 25 advisories, including critical
  unauthenticated RCE, SSRF and DoS entries. Production tree audits clean.
- **Lockfile committed**; CI installs with `npm ci` instead of resolving
  floating `^` ranges on every deploy.
- **Prototype-pollution class fixed** — `{"engine":"__proto__"}` used to leak
  `Object.prototype` into the response. `engine` is now a zod enum over the
  registry allow-list.
- **Bounded input** — 8 KB request cap and 400-character prompt cap (`413`);
  prompts are no longer echoed back unbounded.
- **Correct error semantics** — malformed JSON is `400`, validation is `422`,
  unknown jobs are `404`, failures are `500` with a generic message. v1 returned
  `200` with a stock video for *any* malformed request.
- **Security headers** added: CSP, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS, COOP/CORP. `X-Powered-By`
  removed.
- **Rate limiting** — token bucket per client, `429` + `Retry-After`.
- **Third-party media removed** — six original clips are now self-hosted, which
  eliminates the CORS/availability dependency and the CC-BY attribution gap.
- Fixed reverse-tabnabbing in the download fallback (popup is gone entirely).

### Added

- Real job pipeline: `POST /api/render` → `202` + job id, `GET /api/render/:id`
  polling, cancel/retry/timeout handling, progress reporting.
- `RenderProvider` interface with a demo implementation and a documented live
  stub that returns `501` instead of faking output.
- 41 unit tests (Vitest) and a 57-check integration suite that boots `next build`
  output and probes it.
- CI workflow (typecheck, lint, format, unit, build, integration, audit) and
  Dependabot.
- Documentation: `docs/ARCHITECTURE.md`, `docs/API.md`, `SECURITY.md`,
  `CONTRIBUTING.md`, `THIRD_PARTY_NOTICES.md`, `README.ar.md`, `.env.example`.
- App Router conventions: `error.tsx`, `loading.tsx`, `not-found.tsx`,
  `robots.ts`, `sitemap.ts`, `icon.svg`, Open Graph image, full metadata.

### Changed

- **API path** `/api/v14/render` → `/api/render` (`308` redirect kept).
- **`next lint` → `eslint`** with a flat config that runs unattended.
- **One engine registry** (`lib/engines/registry.ts`). The page, the API and the
  unused `lib/engines/router.ts` had three divergent copies; the dead file is
  gone and engine ids/names/versions now agree everywhere.
- **Styling** moved from ~24 inline style objects to CSS Modules over design
  tokens. Tailwind was removed: it was configured but never compiled (no
  PostCSS config) and no utility class was ever used.
- **Page is a server component** with a single client island; metadata, OG tags
  and a no-JS fallback are server-rendered.
- **Back-compat preserved** for old clients via redirect; behaviour is otherwise
  stricter.

### Fixed

- **Honesty** — the UI no longer pretends to run a model: visible demo banner,
  `mode: "demo"` in every API response, and README/OG clearly marked.
- **Accessibility** — cards are real buttons with `aria-expanded`/`aria-controls`
  (the whole UI was previously mouse-only), labelled prompt fields, `aria-live`
  status, `role="progressbar"`, visible `:focus-visible` rings, skip link,
  decorative canvas hidden from AT.
- **RTL / language** — `<html lang>`/`dir` follow the selected locale; Arabic now
  renders right-to-left.
- **Canvas** — no per-frame buffer reallocation, DPR-aware (sharp on retina),
  stars re-sampled on resize, dead meteors filtered instead of spliced, loop
  paused when hidden or under `prefers-reduced-motion`.
- **Video** — clips use `preload="none"` + visibility-based playback instead of
  eight simultaneous autoplaying streams.
- **Download** — plain same-origin anchor with `download` (no `fetch`→blob, no
  revoked-before-write object URL, no popup-blocked fallback).
- Colour mismatch between `globals.css` and the page (load flash) resolved via a
  single token.
- Complete translations for all six locales, including previously truncated
  footers.

### Removed

- `lib/engines/router.ts` (dead code), `tailwind.config.js`, the `/api/v14`
  route file (redirect instead), fake `setTimeout` generation logic.

## [1.0.0] — 2026-10-27

Initial public version: single-page UI, eight engine cards, six languages,
keyword-matched sample clips, `/api/v14/render` endpoint.
