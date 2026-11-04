# API reference

Base URL: wherever the app runs (`http://localhost:3000` in development).
All responses are JSON unless noted. All render endpoints are **owner-scoped**:
another account's job id returns `404`, never `403`, so ids cannot be probed.

## Authentication

Sessions come from Auth.js and are carried in the `authjs.session-token` cookie.

```http
GET /api/auth/csrf                       → { "csrfToken": "…" }
POST /api/auth/callback/guest            (form: csrfToken, callbackUrl)
POST /api/auth/signin/github             (redirects to GitHub)
GET  /api/auth/session                   → { "user": { "id", "name" }, "expires" }
POST /api/auth/signout                   (form: csrfToken)
```

Browsers normally reach these through the login page; the integration suite drives
them directly to prove the flow works.

---

## `GET /api/render`

Public capability document: what this deployment can do _right now_. Cached for
60 seconds (a changed key must not stay invisible for an hour).

```json
{
  "status": "ok",
  "mode": "live",
  "maxPromptLength": 400,
  "engines": ["wan", "mochi", "svd", "shorts", "ai", "edge", "ultra", "ent"],
  "requiresAuth": true,
  "provider": {
    "id": "fal",
    "model": "fal-ai/ltx-2/text-to-video/fast",
    "live": true,
    "requested": "auto",
    "notice": null,
    "fallback": "demo",
    "configured": { "fal": true, "replicate": false }
  }
}
```

- `mode` is `live` when a provider is configured, `demo` otherwise.
- `provider.id` is the backend that will actually be used (`demo` when none is).
- `provider.requested` echoes `RENDER_PROVIDER`; `provider.notice` explains a
  downgrade (for example a forced provider without its key).
- Keys themselves are never echoed — only booleans in `configured`.

## `POST /api/render`

Requires a session. Creates a job owned by the caller.

```http
POST /api/render
Content-Type: application/json

{ "prompt": "a cinematic ocean at sunset", "engine": "wan" }
```

```json
202 Accepted
{
  "job": {
    "id": "0f0c1f6a-…",
    "engine": "wan",
    "prompt": "a cinematic ocean at sunset",
    "status": "queued",
    "progress": 5,
    "provider": "fal",
    "createdAt": "2026-11-04T02:09:38.064Z",
    "updatedAt": "2026-11-04T02:09:38.065Z"
  },
  "mode": "live",
  "provider": "fal"
}
```

If the live provider rejects the job (auth, out of credit, 5xx, timeout), the
job is still created — against the demo renderer — and the response says so:

```json
202 Accepted
{
  "job": { "id": "…", "status": "queued", "provider": "demo" },
  "mode": "demo",
  "provider": "demo",
  "fallback": true,
  "notice": "The live provider rejected this job, so it was rendered as a demo clip. Check the server logs for the provider error."
}
```

`provider` is the backend that owns the job and never changes afterwards; read it
off the finished job to know exactly what produced the clip.

| Status | When                                                                 |
| ------ | -------------------------------------------------------------------- |
| `202`  | Job created                                                          |
| `400`  | Body is not valid JSON                                               |
| `401`  | No session                                                           |
| `403`  | Cross-origin `Origin` header on a state-changing request             |
| `413`  | Body > 8 KB or prompt > 400 characters                               |
| `422`  | Schema failure, unknown key, or an engine outside the allow-list     |
| `429`  | Rate limited — includes `Retry-After` and `X-RateLimit-Remaining: 0` |
| `500`  | Unexpected database failure                                          |

Field notes:

- `prompt` — 1–400 characters, trimmed, whitespace-collapsed, control characters
  rejected.
- `engine` — one of the eight ids; anything else (including `__proto__`,
  `constructor`, `toString`) is a `422` and no job is created.
- Unknown keys are rejected instead of ignored.

## `GET /api/render/:id`

Polls one of your jobs. Each call mirrors provider progress into the database and,
on completion, records the clip and duration.

```json
200 OK
{
  "job": {
    "id": "0f0c1f6a-…",
    "engine": "wan",
    "prompt": "a cinematic ocean at sunset",
    "status": "succeeded",
    "progress": 100,
    "provider": "fal",
    "videoUrl": "/api/media/0f0c1f6a-…",
    "createdAt": "…",
    "updatedAt": "…"
  }
}
```

Demo and fallback jobs look the same except that `provider` is `demo` and
`videoUrl` is a bundled `/media/<clip>.mp4`:

```json
{
  "provider": "demo",
  "clip": "ocean",
  "videoUrl": "/media/ocean.mp4",
  "posterUrl": "/media/posters/ocean.jpg"
}
```

`404` for unknown ids, malformed ids, or jobs owned by someone else. A job whose
provider has forgotten it is failed after a 90-second grace window, with an
`error` explaining that the job expired.

`501` only when the stored job belongs to a provider that is no longer configured
(e.g. `RENDER_PROVIDER=demo` while a `fal:` job is still polling) — the message
says which provider is missing.

## `GET /api/renders?limit=6`

The signed-in user's most recent renders (max 24), used by the studio's history
rail.

```json
{ "renders": [{ "id": "…", "status": "succeeded", "videoUrl": "/media/neon.mp4" }] }
```

## `GET /api/media/:id`

Streams a finished MP4 **inline** — this is what the `<video>` elements use.

```http
200 OK
Content-Type: video/mp4
Accept-Ranges: bytes
Cache-Control: private, max-age=3600
```

```http
GET /api/media/:id
Range: bytes=0-1023

206 Partial Content
Content-Range: bytes 0-1023/1834211
```

- Owner or shared — anything else is a `404`.
- Source order: local copy in `MEDIA_DIR` → bundled `/media/<clip>.mp4` for demo
  renders → the provider's URL proxied server-side → `404`.
- Only `video/mp4` is ever served, never a caller-supplied path.

## `GET /api/download/:id`

Streams the finished MP4 from disk as an attachment.

```http
200 OK
Content-Type: video/mp4
Content-Disposition: attachment; filename="supernova-wan-0f0c1f6a.mp4"
Cache-Control: private, max-age=0, must-revalidate
```

- Owner only — **or** anyone if the render has been shared.
- Anything else is a `404` (identical to "does not exist").
- Same source order as `/api/media/:id`, including the bundled demo clips, so the
  download button works in demo mode too.
- The route resolves the render id to a file name itself; no path from the request
  reaches the filesystem.

## `POST /api/share/:id`

Publishes a finished render. Idempotent: calling it twice returns the same slug.

```json
{ "slug": "qhd3tq34mc", "url": "https://example.com/s/qhd3tq34mc" }
```

| Status | When                          |
| ------ | ----------------------------- |
| `200`  | Shared (new or existing slug) |
| `401`  | No session                    |
| `403`  | Cross-origin                  |
| `404`  | Not your render / unknown id  |
| `409`  | Render has not finished yet   |

## `GET /s/:slug`

Public HTML page (not JSON) with per-render Open Graph and Twitter metadata, a
player, a public download link and `noindex`. Unknown or unfinished slugs return a
real `404` from `middleware.ts`.

---

## Errors

```json
{ "error": "Invalid request.", "issues": [{ "path": "engine", "message": "…" }] }
```

`error` is always safe to show to a user; `issues` appears only for validation
failures. Internal details are logged server-side, never returned.

## Rate limiting

Token bucket per user id (IP for unauthenticated calls), default 12 burst tokens
and 0.2 tokens/second. Applies to `POST /api/render`.

## Headers on every response

`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options:
DENY`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`,
`Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`. `X-Powered-By` is
disabled.

## Provider errors

Provider failures never surface as a raw exception. `POST /api/render` falls back
to the demo renderer (see above); a poll that hits an unrecoverable provider error
fails the job with a readable `error`, and the message is redacted so an API key
can never appear in a response or a log line.

## Compatibility

`/api/v14/render` permanently redirects (`308`) to `/api/render`.
