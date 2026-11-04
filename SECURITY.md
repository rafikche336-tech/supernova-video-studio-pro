# Security

## Reporting

Open a **private** security advisory on GitHub
(<https://github.com/rafik336-tech/supernova-video-studio-pro/security/advisories/new>)
or email the maintainer. Please do not open a public issue for a vulnerability.
Expect an acknowledgement within a few days.

## What is in scope

This is a demo deployment in one specific sense — the video model is simulated —
but the security-relevant surface is real: sessions, ownership checks, file
delivery, a database and a public share endpoint.

## Authentication

- **Auth.js v5** with **JWT sessions** (30-day lifetime), signed with `AUTH_SECRET`.
  A missing secret in production logs a warning and makes sign-in fail rather than
  silently using a default.
- **GitHub OAuth** is only registered when both `AUTH_GITHUB_ID` and
  `AUTH_GITHUB_SECRET` are set. A misconfigured deployment degrades to guest-only
  rather than accepting tokens it cannot verify.
- **Guest sign-in** mints a fresh, empty account per click; it grants no privileges
  beyond a normal account.
- The JWT carries only the user id. Every request re-reads the user row from the
  database, so deleting an account invalidates its access immediately.
- Sign-out clears the session cookie; there is no server-side session store to
  revoke, which is the trade-off documented under _Known limitations_.

## Authorisation

- Every query that returns a render is scoped by `user_id`. A job belonging to
  someone else is indistinguishable from a missing one: `404`, never `403`.
- Downloads are permitted for the owner, or for anyone once the render has been
  shared. Everything else is a `404`.
- Sharing can only be initiated by the owner, and only for a finished render.
- Pages under `/studio`, `/history` and `/dashboard` are gated twice: `middleware.ts`
  redirects anonymous visitors, and each page calls `requireUser()` — a matcher
  mistake cannot expose data on its own.

## Request integrity

- State-changing requests (`POST /api/render`, `POST /api/share/:id`) reject a
  mismatched `Origin` header (`403`). Combined with `SameSite=Lax` session cookies,
  this blocks cross-site request forgery without a double-submit token on JSON
  endpoints; Auth.js handles CSRF for its own form posts.
- All redirect targets (`next=…`) are validated by `safeNextPath()`: absolute
  paths only, `//evil.com` and scheme-bearing values are discarded.
- Request bodies are capped at 8 KB and prompts at 400 characters **before**
  parsing; JSON is parsed with `JSON.parse`, then validated by Zod.
- Unknown keys fail validation. Engine ids are checked against an allow-list, so
  `__proto__`, `constructor` and `toString` are rejected rather than resolved
  through the prototype chain.

## Data handling

- **SQL**, not string concatenation: every dynamic value is a bound parameter.
  The only interpolated SQL is a set of fixed column names and a fixed clause
  skeleton.
- The media and download routes never accept a caller-supplied path. They take the
  clip from the database row, match it against a strict `/media/<name>.mp4`
  pattern, and join it onto `public/`, so traversal sequences cannot escape.
- No secrets are rendered to the client. `NEXT_PUBLIC_SITE_URL` is the only
  environment value exposed, and it is public by definition. Provider keys
  (`FAL_KEY`, `REPLICATE_API_TOKEN`) are read only inside `lib/render/*`, are sent
  only to the provider's own origin, and are redacted from every error message and
  log line by `lib/render/http.ts`.
- **Outbound fetches are guarded.** Generated files are downloaded by the server,
  so the URL a provider returns is treated as hostile input: `isSafeRemoteUrl()`
  allows `http(s)` only, refuses link-local and cloud-metadata hosts, refuses
  loopback unless the operator pointed a provider at a custom base URL, and the
  download is size-capped (`VIDEO_MAX_BYTES`) while streaming.
- **Renders cost money once a key is live.** The per-user token bucket is the
  spending guard: keep `RATE_LIMIT_CAPACITY` modest and set a hard cap on the
  provider account.
- Logging is structured and deliberately terse: route, message, ids. Prompts are
  stored in the database (they are the product) but never written to logs.

## Response headers

Set in `next.config.ts` for every route:

| Header                         | Value                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `Content-Security-Policy`      | `default-src 'self'; script-src 'self' 'unsafe-inline'; …; frame-ancestors 'none'; form-action 'self'` |
| `Strict-Transport-Security`    | `max-age=63072000; includeSubDomains; preload`                                                         |
| `X-Content-Type-Options`       | `nosniff`                                                                                              |
| `X-Frame-Options`              | `DENY`                                                                                                 |
| `Referrer-Policy`              | `strict-origin-when-cross-origin`                                                                      |
| `Permissions-Policy`           | camera, microphone, geolocation, payment disabled                                                      |
| `Cross-Origin-Opener-Policy`   | `same-origin`                                                                                          |
| `Cross-Origin-Resource-Policy` | `same-origin`                                                                                          |
| `X-Powered-By`                 | removed                                                                                                |

Media is served with `Cache-Control: public, max-age=31536000, immutable`; API
responses are `no-store`; `/s/` pages are `noindex`.

## Abuse resistance

- Token-bucket rate limiting on rendering, keyed by user id (IP when signed out),
  default 12 burst / 0.2 per second, answering `429` with `Retry-After`.
- Render jobs are cheap in demo mode, but the limiter is wired for the live
  provider, where each job costs real money.
- Share slugs carry ~50 bits of entropy (10 characters, 32-symbol alphabet), so
  links cannot be enumerated.

## Known limitations

1. **No session revocation.** A stolen JWT stays valid until it expires or
   `AUTH_SECRET` is rotated. Fixing this properly means a database session table.
2. **In-process rate limiting.** Per-instance only; a multi-instance deployment
   needs Redis or similar.
3. **SQLite on a single node.** No row-level access control beyond the application.
4. **Guest libraries are disposable** and guest rows are pruned on request.
5. **No email verification** because there is no password provider.
6. **CSP allows `'unsafe-inline'` for scripts** because Next.js inlines its
   hydration bootstrap. A nonce-based policy is the follow-up.
