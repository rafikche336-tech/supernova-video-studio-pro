# Supernova Video Studio 🚀

### Multi-engine AI video studio — by SupernovaSolutionsHQ

A complete, self-hostable video-studio product: real text-to-video generation,
accounts, a workbench, a render history, real downloads, share links and an
analytics dashboard. Eight engine profiles, 24 bundled demo clips, six interface
languages.

**v3.1 — “real video, honest fallback”**: prompts go to fal.ai or Replicate when
you supply a key; with no key — or when the provider fails — the studio renders a
bundled clip and says so.

---

## ⚡ What renders your prompts

| Mode     | When it is used                                                    | What you get                                                          |
| -------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| **Live** | a provider key is configured (`FAL_KEY` or `REPLICATE_API_TOKEN`)  | real model output, downloaded to your own server and streamed from it |
| **Demo** | no key, `RENDER_PROVIDER=demo`, or the live provider rejects a job | one of 24 self-hosted clips, clearly labelled as a demo clip          |

Every render row stores which backend produced it, `GET /api/render` reports the
active provider, and the UI credits it next to the result. Nothing is passed off
as model output when it is not.

| Area                              | Real?            | Where it lives                            |
| --------------------------------- | ---------------- | ----------------------------------------- |
| Video generation (with a key)     | ✅               | `lib/render/providers/{fal,replicate}.ts` |
| Video generation (no key)         | ⚠️ bundled clips | `lib/render/providers/demo.ts`            |
| Accounts (GitHub OAuth + guest)   | ✅               | Auth.js v5, `lib/auth.ts`, `users` table  |
| Render history                    | ✅               | SQLite, `renders` table                   |
| Video storage + streaming         | ✅               | `lib/media/{store,serve}.ts`, `MEDIA_DIR` |
| Downloads (`Content-Disposition`) | ✅               | `app/api/download/[id]`                   |
| Share links + Open Graph cards    | ✅               | `app/api/share/[id]`, `app/s/[slug]`      |
| Analytics                         | ✅               | SQL aggregation in `lib/analytics.ts`     |

## 🔑 Turn on real video generation (≈5 minutes)

### Option A — fal.ai (recommended: cheapest, $10 of free credit)

1. Sign up at <https://fal.ai> — no card required for the credit.
2. Open <https://fal.ai/dashboard/keys> and create a key. It looks like
   `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:0123456789abcdef…`.
3. Put it in `.env.local`:

   ```bash
   RENDER_PROVIDER=auto
   FAL_KEY=your-key-here
   ```

4. Restart the dev server and check it stuck:

   ```bash
   curl -s localhost:3000/api/render | jq '.mode, .provider'
   # "live"
   # { "id": "fal", "model": "fal-ai/ltx-2/text-to-video/fast", "live": true, … }
   ```

5. Render something in `/studio`. The result panel credits **fal.ai**, and the
   MP4 is downloaded into `MEDIA_DIR` before it is served.

**What it costs.** fal bills per second of generated video. At 480p in 2026 that
is roughly **$0.05/second** (LTX-2 Fast, Wan 2.5), i.e. **≈$0.25 for a 5-second
clip**, and Kling-class models start near **$0.029/second**. The $10 signup
credit therefore buys roughly **20–100 clips** depending on model and length.
`VIDEO_DURATION_SECONDS` is the main cost dial — 5 s at 480p is the sane default.

Swap the model with `FAL_VIDEO_MODEL` (any id from
<https://fal.ai/models?categories=text-to-video>), e.g.
`fal-ai/wan/v2.2-a14b/text-to-video` or a Kling route for cheaper short clips.

### Option B — Replicate (pay-as-you-go, no free tier worth planning around)

1. Sign up at <https://replicate.com>.
2. Copy the token from <https://replicate.com/account/api-tokens> (starts `r8_`).
3. Put it in `.env.local`:

   ```bash
   RENDER_PROVIDER=auto        # fal is tried first; leave FAL_KEY empty
   REPLICATE_API_TOKEN=r8_your-token
   REPLICATE_VIDEO_MODEL=lightricks/ltx-video
   ```

Replicate runs at roughly **$0.09/second** at 480p for Wan/LTX-class models, so a
5-second clip is about **$0.45** — dearer than fal, but it has the widest model
catalogue. List models with `curl -s https://api.replicate.com/v1/models?query=video`.

### Option C — stay free (demo mode)

```bash
RENDER_PROVIDER=demo
```

No key, no network, no cost: renders resolve to the bundled clips. This is also
the automatic fallback whenever a live provider errors out — out of credit, 5xx,
expired key — so a demo is never a dead end, and the response says
`"fallback": true` when it happens.

### Option D — your own GPU (free at the margin)

If you already own a card, run Wan 2.x / LTX-Video / SVD behind any HTTP service
and point `FAL_API_BASE_URL` at a gateway that speaks the fal queue contract, or
add a provider in `lib/render/providers/` (one file, ~120 lines — see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#adding-a-provider)).

> **Not recommended in 2026:** Hugging Face Inference Providers no longer grant
> free monthly credits (removed 2026-10-07), and ZeroGPU's ~3.5–5 min/day cannot
> serve a public app. The free tier that actually works is fal's signup credit.

## ✨ What works today

- **Studio** (`/studio`) — 8 engine profiles, live job progress, cancel, download
  and share from the result panel, plus a recent-renders rail that updates as
  jobs finish.
- **Real generation** — fal.ai queue API (submit → poll → fetch) and Replicate
  predictions, behind one `RenderProvider` interface, with the demo renderer as
  an automatic fallback.
- **Accounts** — GitHub OAuth, or one-click guest access. Sessions are JWTs;
  users, renders and events are rows in SQLite.
- **History** (`/history`) — every render with the backend that produced it, plus
  prompt search, engine filter and pagination (all in SQL, all in the URL).
- **Media** — finished videos are downloaded once into `MEDIA_DIR` and streamed
  by `/api/media/:id` with Range support, so provider links expiring (Replicate
  deletes files after about an hour) never break your library. CSP stays
  `media-src 'self'`.
- **Downloads** — `/api/download/:id` streams with a friendly filename; private by
  default, owner or share link only.
- **Share links** — unguessable 10-character slugs, a public page per render and
  per-render Open Graph/Twitter metadata so links unfurl properly.
- **Analytics** (`/dashboard`) — 14-day render volume, engine mix, success rate,
  average render time, downloads and shares, plus deployment-wide totals.
- **Craft** — six languages (including Arabic RTL), a thumb-reachable mobile dock,
  safe-area insets for notches, staggered entrance animations,
  `prefers-reduced-motion`, keyboard-complete interactions and real focus states.
- **Security** — strict CSP, HSTS, nosniff, COOP/CORP, same-origin checks on
  state-changing requests, per-user rate limiting, ownership-scoped queries,
  SSRF-guarded downloads, redacted provider errors.

## 🚀 Quick start

```bash
# Node.js ≥ 20.9 (22 LTS recommended)
git clone https://github.com/rafik336-tech/supernova-video-studio-pro.git
cd supernova-video-studio-pro
npm install

cp .env.example .env.local     # optional — everything has a working default
npm run seed                   # optional: 14 days of demo history to look at

npm run dev                    # http://localhost:3000
```

Open `/studio`, click **Sign in → Continue as guest**. With no key you get demo
renders immediately; add `FAL_KEY` (above) and the same prompts become real video.

### Enable GitHub sign-in (optional)

1. Create an OAuth app at <https://github.com/settings/developers>.
2. Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
3. Put the credentials in `.env.local`:

```bash
AUTH_GITHUB_ID=your_client_id
AUTH_GITHUB_SECRET=your_client_secret
AUTH_SECRET=$(openssl rand -base64 32)
```

Without these two variables the provider is not registered at all — the login
page says so and guest sign-in keeps working. `AUTH_SECRET` is required in
production; in development a throwaway default is used.

## 🧭 Scripts

| Script                            | What it does                                      |
| --------------------------------- | ------------------------------------------------- |
| `npm run dev`                     | Development server                                |
| `npm run build`                   | Production build                                  |
| `npm start`                       | Serve the build (bind `-H 0.0.0.0` in containers) |
| `npm run seed`                    | Seed demo users/renders/events (idempotent)       |
| `npm run seed:reset`              | Wipe and re-seed the demo data                    |
| `npm test`                        | Unit tests (Vitest)                               |
| `npm run test:integration`        | End-to-end suite against a real `next start`      |
| `npm run verify`                  | typecheck → lint → unit tests → build             |
| `npm run media:generate`          | Re-render the 24 demo clips (Python + ffmpeg)     |
| `npm run lint` / `npm run format` | ESLint / Prettier                                 |

## 🏗️ Architecture

```
Browser ──▶ middleware.ts ──▶ App Router (server components)
             │  auth gate        │  pages read SQLite directly
             │  share 404s       │  client islands: studio, share button
             ▼                   ▼
          Auth.js v5 ────────▶ db/ (better-sqlite3) ──▶ data/supernova.db
                                   ▲
              /api/render ─────────┘  (router → provider → job → `renders` row)
                   │
                   ├─ fal.ai queue API ─┐
                   ├─ Replicate API ────┤→ lib/media/store.ts → data/videos/<id>.mp4
                   └─ bundled demo ─────┘                              │
                                                                       ▼
                                            /api/media/:id (inline, Range) ──▶ <video>
                                            /api/download/:id (attachment)
```

- **Server-first.** Pages are server components; only the engine grid, the
  language picker and the share button ship JavaScript.
- **One source of truth per concern.** `lib/engines/registry.ts` holds engines and
  clips, `lib/render/service.ts` bridges provider state and the database,
  `lib/analytics.ts` owns every number the dashboard shows.
- **Provider seam.** `RenderProvider` (`submit` + `status`) is the only thing a new
  model integration has to implement; the router adds live→demo fallback for free.
- **Thin, portable data layer.** Plain SQL behind `db/client.ts`; all ids are
  UUIDs and all timestamps epoch milliseconds.

Full detail — provider contracts, the storage model, why Prisma is not used and
what a Postgres deployment needs — is in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 🔌 API

All render endpoints require a session; see [`docs/API.md`](docs/API.md) for
request/response examples and error semantics.

| Method     | Path                | Auth               | Purpose                                    |
| ---------- | ------------------- | ------------------ | ------------------------------------------ |
| `GET`      | `/api/render`       | –                  | Capabilities, active provider, engine list |
| `POST`     | `/api/render`       | ✅                 | Create a render job                        |
| `GET`      | `/api/render/:id`   | ✅ owner           | Poll a job                                 |
| `GET`      | `/api/renders`      | ✅                 | Your recent renders                        |
| `GET`      | `/api/media/:id`    | ✅ owner or shared | Stream the MP4 inline (Range)              |
| `GET`      | `/api/download/:id` | ✅ owner or shared | Download the MP4                           |
| `POST`     | `/api/share/:id`    | ✅ owner           | Create/reuse a public link                 |
| `GET/POST` | `/api/auth/*`       | –                  | Auth.js (OAuth callbacks, guest sign-in)   |

## ⚙️ Configuration

Every variable is validated in `lib/env.ts`; an invalid value fails fast.

| Variable                                | Default                                     | Notes                                                  |
| --------------------------------------- | ------------------------------------------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`                  | `https://supernova-video-studio.vercel.app` | Canonical origin for metadata, sitemap, share links    |
| `DATABASE_PATH`                         | `data/supernova.db`                         | SQLite file, or `:memory:` in tests                    |
| `AUTH_SECRET`                           | dev-only fallback                           | **Required in production** (`openssl rand -base64 32`) |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | –                                           | Enables GitHub OAuth when both are set                 |
| `RENDER_PROVIDER`                       | `auto`                                      | `auto` \| `demo` \| `fal` \| `replicate`               |
| `FAL_KEY`                               | –                                           | fal.ai key; the cheapest live option                   |
| `FAL_VIDEO_MODEL`                       | `fal-ai/ltx-2/text-to-video/fast`           | Any fal text-to-video model id                         |
| `FAL_API_BASE_URL`                      | `https://queue.fal.run`                     | Override for a proxy/gateway                           |
| `REPLICATE_API_TOKEN`                   | –                                           | Replicate token (`r8_…`)                               |
| `REPLICATE_VIDEO_MODEL`                 | `lightricks/ltx-video`                      | `owner/name` or `owner/name:version`                   |
| `REPLICATE_API_BASE_URL`                | `https://api.replicate.com`                 | Override for a proxy/gateway                           |
| `VIDEO_DURATION_SECONDS`                | `5`                                         | Requested clip length — the main cost dial             |
| `VIDEO_ASPECT_RATIO`                    | `16:9`                                      | `16:9`, `9:16` or `1:1`                                |
| `MEDIA_DIR`                             | `data/videos`                               | Where generated MP4s are stored; must persist          |
| `VIDEO_MAX_BYTES`                       | `67108864`                                  | Refuse larger downloads (64 MB)                        |
| `RATE_LIMIT_CAPACITY`                   | `12`                                        | Token-bucket burst per user                            |
| `RATE_LIMIT_REFILL_PER_SECOND`          | `0.2`                                       | Steady-state rate — tighten it when a paid key is live |

## 🧪 Testing

```bash
npm run typecheck      # TypeScript, strict
npm run lint           # ESLint 9, flat config
npm test               # 99 unit tests
npm run build
npm run test:integration   # 150 end-to-end checks
```

Unit tests cover the clip matcher, registry integrity (every referenced file
exists), i18n completeness, request validation, the demo renderer, the fal and
Replicate clients (against a mocked `fetch`, including auth/credit/rate-limit
errors and secret redaction), the fallback router, media helpers, the render
service against a real in-memory SQLite, rate limiting, the database layer,
analytics aggregation, share slugs and redirect safety.

The integration suite boots production servers and exercises the whole product:
auth gates, validation, job lifecycle, media delivery, downloads, ownership
scoping, share links, OG metadata, history, dashboard and rate limiting. It stays
**completely key-free and offline**: the live path is proved against a local stub
that implements the fal queue contract, including a forced 500 and a forced 402
to verify the automatic demo fallback.

## 🚢 Deployment

- **You need a persistent volume** for `data/` — it holds both the database and
  the generated videos (`MEDIA_DIR`). On a serverless platform with an ephemeral
  filesystem, history and videos disappear between invocations: use a
  container/bare-metal host, or port the data layer to Postgres plus object
  storage first ([details](docs/ARCHITECTURE.md#database-portability)).
- Set `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`, `MEDIA_DIR` and a provider key.
- Put a **spending cap** on the provider account and keep the rate limiter tight —
  accepted render requests cost money.
- `npm run build && npm start`. The SQLite schema migrates itself on first boot.

## ⚠️ Known limitations

- Without a provider key, renders are bundled demo clips (labelled as such).
- Generated clips are 480p-class model output, not studio footage; quality tracks
  what ~$0.05/second buys.
- Queue polling is client-driven (1.5 s): closing the tab mid-render leaves the job
  to finish on the next poll, and a job whose provider forgets it is failed after
  a 90 s grace window.
- Sessions are stateless JWTs — revoking one before it expires requires rotating
  `AUTH_SECRET`.
- Guest accounts are disposable: sign out and you lose that library.
- SQLite is single-node; concurrent writers are serialised (WAL mode).
- Rate limiting is in-process — a multi-instance deployment needs a shared store.
- No email/password provider and no password reset by design.

See [`SECURITY.md`](SECURITY.md) for the security model and reporting process.

## 🤝 Contributing

Issues and pull requests are welcome — start with [`CONTRIBUTING.md`](CONTRIBUTING.md)
and run `npm run verify` before opening a PR.

## 📄 License & credits

MIT — see [`LICENSE`](LICENSE). Demo clips are generated by this repository
(CC0). fal.ai and Replicate are third-party services with their own terms — see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
