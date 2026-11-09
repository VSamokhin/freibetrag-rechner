# Freibetrag-Rechner: notes for Claude and contributors

Offline PWA (TypeScript, no framework). See README.md for features, layout and scripts.

## Before every commit

The Husky pre-commit hook runs `npm run verify` (Prettier, ESLint, tsc, Vitest with coverage thresholds,
secretlint, npm audit, build). CI runs the same command on pull requests to `main` and pushes to `main`.
Never skip or weaken a gate to get green; fix the cause.

## Version

- The version is `major.minor.build`, derived from the git history by `scripts/version.mjs`:
  the base `version` in `package.json` plus the first-parent commits since the commit that last changed that line.
- Never bump the build part by hand, and never use `npm version patch`.
- Raise the **minor** (`npm version minor --no-git-tag-version`) in the change that brings new functionality,
  and add a CHANGELOG section for it.
- Only **propose** a major bump; raise it only with the owner's agreement.
- Builds need the full history: keep `fetch-depth: 0` on every `actions/checkout` that builds or tests.

## Code

- Domain rules live in `src/model.ts` (pure, fully unit-tested). UI lives in `src/app.ts`.
- Every UI text lives in `src/i18n.ts`, in both English and German. Static page text is marked in
  `public/index.html` with `data-i18n` (text), `data-i18n-label` (aria-label), `data-i18n-placeholder`
  and `data-i18n-title`. Check new German text at 320 px width: it is often longer than the English.
- No `innerHTML` or `eval`; the page ships a strict Content Security Policy.
