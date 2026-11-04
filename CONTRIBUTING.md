# Contributing

Thanks for helping. This project optimises for two things: **honest behaviour**
(no pretending a demo is a model) and **passing checks** (nothing lands red).

## Setup

```bash
git clone https://github.com/rafikche336-tech/supernova-video-studio-pro.git
cd supernova-video-studio-pro
npm ci          # use `ci`, not `install` — keep the lockfile honest
npm run dev
```

Requirements: Node ≥ 20.9 (22 LTS recommended).

## Before you open a PR

```bash
npm run verify                # typecheck → lint → test → build
npm run build && npm run test:integration
npm run format:check          # or `npm run format`
```

CI runs exactly these, plus a dependency audit. A PR that fails them will not be
merged.

## Conventions

### TypeScript

- `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals` are on. Do not escape
  them with `any` — ESLint errors on `@typescript-eslint/no-explicit-any`.
- Use `import type` for type-only imports (`verbatimModuleSyntax` is enabled).
- Prefer `readonly` on interface fields and `as const` for literal tables.

### Structure

| If you are…                  | Put it in                                          |
| ---------------------------- | -------------------------------------------------- |
| Adding an engine or clip     | `lib/engines/registry.ts` — **the only** catalogue |
| Changing prompt → clip rules | `lib/engines/pick-clip.ts` (+ a test)              |
| Adding an API field          | `lib/render/schema.ts`, then docs/API.md           |
| Adding a config/env value    | `lib/env.ts`, `.env.example`, README table         |
| Adding UI text               | all six locales in `lib/i18n.ts`                   |
| Adding a colour/spacing      | a token in `app/globals.css`, not a literal        |

Never duplicate the engine table: v1 had three copies that silently drifted.

### UI

- Components that need state/interactivity get `'use client'`; everything else
  stays a server component.
- Style with CSS Modules + tokens. No inline `style={{…}}`.
- Every interactive element needs a keyboard path and an accessible name.
  Cards are `<button aria-expanded aria-controls>`, not clickable `<div>`s.
- Respect `prefers-reduced-motion` for anything that moves.

### i18n

Adding a key to `Dictionary` breaks the build until all six locales provide it —
that is intentional. `tests/i18n.test.ts` also checks parity and non-empty
strings. Arabic must stay `dir: 'rtl'`.

### Tests

- Pure logic (pickers, validation, stores, rate limiting) → `tests/*.test.ts`
  with Vitest. Use fake timers for anything time-based.
- Anything observable over HTTP → add a check to
  `scripts/integration-test.mjs`.
- Bug fixes come with a regression test that fails before the fix.

### Commits & PRs

- Conventional-ish prefixes: `feat:`, `fix:`, `docs:`, `test:`, `chore:`,
  `perf:`, `refactor:`.
- One logical change per PR; include _why_ in the description.
- Update `CHANGELOG.md` under `## [Unreleased]` for user-visible changes.
- If you change the API, update `docs/API.md` in the same PR.

## Regenerating demo media

Only needed if the visual style changes:

```bash
python3 -m venv .venv-clips
.venv-clips/bin/pip install numpy pillow imageio-ffmpeg
.venv-clips/bin/python scripts/generate-demo-clips.py          # all clips
.venv-clips/bin/python scripts/generate-demo-clips.py ocean    # just one
.venv-clips/bin/python scripts/generate-og-image.py            # social card
```

Keep the total media payload under ~1 MB and every clip at 3 s / 960×540 /
H.264 `yuv420p` so mobile browsers play them inline.

## Tooling notes

- **ESLint stays on 9.x for now.** `eslint-config-next` 16 pulls
  `eslint-plugin-react`, `eslint-plugin-jsx-a11y` and `eslint-plugin-import`,
  none of which declare ESLint 10 support yet — installing 10 leaves an invalid
  peer tree. npm prints a deprecation notice for 9.39.5; that is expected until
  the plugin ecosystem catches up. Track it with Dependabot.
- **`overrides.tinypool`** pins 2.2.0 to clear a critical advisory
  (GHSA-5gmw-xhrv-c9v3) in Vitest's worker pool. Remove the override once
  Vitest ships a compatible release. Vitest itself is pinned to 3.x because
  npm's resolver crashes on Vitest 5's peer graph, and installing 5 with
  `--legacy-peer-deps` produces a lockfile that `npm ci` rejects.
- **`npm ci` is the only supported install path** in CI. If you add a dependency,
  run `npm install` locally and commit the resulting `package-lock.json`.

## Code of conduct

Be decent. Critique code, not people. Assume good faith.
