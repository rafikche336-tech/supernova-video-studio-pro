# Changelog

All notable changes to this project. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[SemVer](https://semver.org/).

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
