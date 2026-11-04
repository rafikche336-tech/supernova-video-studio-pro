# API reference

Base URL: your deployment origin (e.g. `https://studio.example.com`).
All endpoints speak JSON. There is **no authentication** in this repository —
add it before exposing a paid backend.

> v1 exposed `POST /api/v14/render`. That path now returns a `308` redirect to
> `/api/render` for backwards compatibility.

## `GET /api/render`

Capability discovery / health check. Cacheable.

```bash
curl -s https://studio.example.com/api/render | jq
```

```json
{
  "status": "ok",
  "mode": "demo",
  "maxPromptLength": 400,
  "engines": ["wan", "mochi", "svd", "shorts", "ai", "edge", "ultra", "ent"]
}
```

| Status | Meaning                        |
| ------ | ------------------------------ |
| `200`  | Always, when the service is up |

`Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`

## `POST /api/render`

Creates a render job.

### Request

```http
POST /api/render
Content-Type: application/json

{
  "prompt": "a cinematic ocean at sunset",
  "engine": "wan"
}
```

| Field    | Type   | Required | Rules                                            |
| -------- | ------ | -------- | ------------------------------------------------ |
| `prompt` | string | yes      | trimmed, 1–400 characters, no control characters |
| `engine` | string | yes      | one of the 8 ids from `GET /api/render`          |

Unknown top-level fields are rejected (`strictObject`).

### Responses

**`202 Accepted`**

```json
{
  "job": {
    "id": "8f1c2b0e-5c4a-4d2b-9f7e-0a1b2c3d4e5f",
    "engine": "wan",
    "prompt": "a cinematic ocean at sunset",
    "status": "queued",
    "progress": 0,
    "createdAt": "2026-11-04T10:00:00.000Z",
    "updatedAt": "2026-11-04T10:00:00.000Z"
  },
  "mode": "demo"
}
```

| Status | Body                  | When                                                  |
| ------ | --------------------- | ----------------------------------------------------- |
| `202`  | `{ job, mode }`       | Job accepted                                          |
| `400`  | `{ error }`           | Body is not valid JSON                                |
| `413`  | `{ error }`           | Body > 8 KB, or prompt > 400 characters               |
| `422`  | `{ error, issues[] }` | Schema validation failed (see below)                  |
| `429`  | `{ error }`           | Rate limited — honour `Retry-After`                   |
| `501`  | `{ error, code }`     | `RENDER_PROVIDER=live` but not implemented/configured |
| `500`  | `{ error }`           | Unexpected server error                               |

**`422` example**

```json
{
  "error": "Invalid request.",
  "issues": [
    { "path": "engine", "message": "Invalid option: expected one of \"wan\"|…" },
    { "path": "prompt", "message": "Prompt must be at most 400 characters" }
  ]
}
```

**Rate limiting** — token bucket per client (first `X-Forwarded-For` hop, then
`X-Real-IP`). Defaults: burst 12, refill 0.2/s (12 per minute). Override with
`RATE_LIMIT_CAPACITY` / `RATE_LIMIT_REFILL_PER_SECOND`.

## `GET /api/render/:id`

Polls a job. `id` must be a UUID.

```bash
curl -s https://studio.example.com/api/render/$JOB_ID | jq '.job.status, .job.progress'
```

**`200 OK`**

```json
{
  "job": {
    "id": "8f1c2b0e-5c4a-4d2b-9f7e-0a1b2c3d4e5f",
    "engine": "wan",
    "prompt": "a cinematic ocean at sunset",
    "status": "succeeded",
    "progress": 100,
    "videoUrl": "/media/ocean.mp4",
    "posterUrl": "/media/posters/ocean.jpg",
    "videoAlt": "Moonlit sea with soft rolling swells",
    "createdAt": "2026-11-04T10:00:00.000Z",
    "updatedAt": "2026-11-04T10:00:02.100Z"
  }
}
```

| Status | When                                        |
| ------ | ------------------------------------------- |
| `200`  | Job exists and has not expired (10 min TTL) |
| `404`  | Unknown id, expired job, or a malformed id  |
| `500`  | Provider lookup failed                      |

`status` values: `queued` → `running` → `succeeded` **or** `failed`
(`failed` jobs carry an `error` string).

### Client behaviour

The bundled UI polls every 350 ms with a 60 s budget, and cancels cleanly on
unmount or when the user presses Cancel. See `hooks/useRenderJob.ts`.

## `GET /media/:file`

Static demo clips (self-hosted, MP4 / H.264, 960×540, 3 s each).

`Cache-Control: public, max-age=31536000, immutable`.

| File         | Engine default |
| ------------ | -------------- |
| `space.mp4`  | `wan`          |
| `silk.mp4`   | `mochi`, `ent` |
| `ocean.mp4`  | `svd`          |
| `city.mp4`   | `shorts`       |
| `gold.mp4`   | `ai`, `ultra`  |
| `forest.mp4` | `edge`         |

Posters live in `/media/posters/<name>.jpg`.

## Error model

Errors always use `{ "error": string }`, plus `issues[]` for validation failures
and `code` for provider errors. No error response ever contains a stack trace or
echoes unbounded user input.
