# Security policy

## Supported versions

| Version       | Supported                                                    |
| ------------- | ------------------------------------------------------------ |
| 2.x (current) | ✅                                                           |
| 1.x           | ❌ (unmaintained — it shipped known-vulnerable dependencies) |

## Reporting a vulnerability

Please **do not** open a public issue. Use GitHub's private
[security advisory](https://github.com/rafikche336-tech/supernova-video-studio-pro/security/advisories/new)
form, or email the maintainer listed in `package.json`.

Include: affected version, reproduction steps, impact, and any suggested fix.
We aim to acknowledge within 72 hours and to ship a patch or mitigation within
30 days for confirmed issues.

---

## Controls implemented in 2.0.0

### Transport & headers (`next.config.ts`)

| Header                         | Value                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`      | `default-src 'self'`, explicit `media-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'` |
| `X-Content-Type-Options`       | `nosniff`                                                                                                           |
| `X-Frame-Options`              | `DENY` (clickjacking)                                                                                               |
| `Referrer-Policy`              | `strict-origin-when-cross-origin`                                                                                   |
| `Permissions-Policy`           | camera/mic/geolocation/payment disabled                                                                             |
| `Cross-Origin-Opener-Policy`   | `same-origin`                                                                                                       |
| `Cross-Origin-Resource-Policy` | `same-origin`                                                                                                       |
| `Strict-Transport-Security`    | 2 years, `includeSubDomains`, `preload`                                                                             |
| `X-Powered-By`                 | **removed** (`poweredByHeader: false`)                                                                              |

See [docs/ARCHITECTURE.md § CSP nonces](docs/ARCHITECTURE.md#8-csp-nonces-optional-hardening)
to drop `'unsafe-inline'` at the cost of static rendering.

### Input handling (`lib/render/schema.ts`, `app/api/render/route.ts`)

- **Allow-list, not lookups**: `engine` is a zod enum over the registry ids. A
  plain object lookup (v1) let `{"engine":"__proto__"}` reach
  `Object.prototype` and leak it into the response.
- **Bounded input**: 8 KB body cap (checked against `Content-Length` _and_ the
  actual text) and a 400-character prompt cap → `413`.
- **Rejected surprises**: unknown keys, control characters, non-string prompts.
- **No echo amplification**: responses only ever contain a validated,
  bounded job.
- **Typed errors**: validation → `422`, bad JSON → `400`, unknown job → `404`,
  unexpected → `500` with a generic message. No internal detail leaks.

### Abuse resistance (`lib/rate-limit.ts`)

Token bucket per client: 12 burst, 12/minute sustained, `429` + `Retry-After`.
Bounded memory (10 000 tracked clients).

### Data handling

- **No secrets in the client bundle.** `lib/env.ts` is server-only; only
  `NEXT_PUBLIC_SITE_URL` is public by naming convention.
- **No third-party requests at runtime.** Media is self-hosted; there are no
  analytics, fonts or CDN calls. Visitors' IPs are not shared with anyone.
- **Structured logs** never include the API key; they log job id, engine and mode.

### Dependencies

- **Lockfile committed**, CI installs with `npm ci`. Floating `^` ranges were a
  supply-chain risk in v1.
- **Production tree is clean**: `npm audit --omit=dev` → 0 vulnerabilities
  (Next.js 16.4.5, React 19.3.1, zod 4).
- **Full tree**: no `high`/`critical`. Two `moderate` advisories remain in
  _development-only_ tooling — `minimatch` (via ESLint) and `@vitest/mocker`
  (via Vitest 3). Both only execute at build/test time with local, trusted input,
  and are tracked for upgrade; CI fails on `high`+ automatically.
- `overrides.tinypool` pins 2.2.0 to clear
  [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3)
  (critical RCE in the test worker pool).
- Dependabot runs weekly with Next/React grouped into one reviewable PR.

## Known limitations

1. **No authentication or authorisation.** Every endpoint is public. Add auth
   before attaching paid inference.
2. **Rate limiting is per process.** With N instances a client effectively gets
   N × capacity. Use Redis/Upstash or your platform's WAF in front.
3. **Job state is in memory** — not shared between instances and lost on restart.
4. **`script-src 'unsafe-inline'`** is required by the static rendering strategy
   (see the nonce note above).
5. **No CSRF tokens.** The API is stateless and unauthenticated, so there is no
   session to forge; revisit this the moment you add cookies or auth.

## Pre-launch checklist

- [ ] `NEXT_PUBLIC_SITE_URL` set to the real HTTPS origin
- [ ] `RENDER_PROVIDER` still `demo` unless a backend is wired up
- [ ] Authentication added if the endpoint is not meant to be public
- [ ] Shared rate limiting configured behind the load balancer
- [ ] Error tracking (Sentry/Bugsnag) connected to `app/error.tsx` and `lib/logger.ts`
- [ ] `npm audit --omit=dev` clean in CI
- [ ] Demo banner intentionally removed only after real inference is live
