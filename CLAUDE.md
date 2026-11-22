# Freibetrag-Rechner: notes for Claude and contributors

Offline PWA (TypeScript, no framework). See README.md for features, layout and scripts.

## Before every commit

The Husky pre-commit hook runs `npm run verify` (Prettier, ESLint, tsc, Vitest with coverage thresholds,
secretlint, npm audit, build). CI runs the same command on pull requests to `main` and pushes to `main`.
Never skip or weaken a gate to get green; fix the cause.

When adding a GitHub Action to a workflow, look up its latest release on GitHub first and use that version; keep the existing actions on their
latest releases too (Dependabot proposes the updates weekly).

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

## Branches, pull requests and shipping (Viktor, 2026-11-22)

- One work package = one work branch = one pull request; never reuse a branch for a second package.
- Iterate on the work branch: commit and push as often as useful, with the local checks before each push.
- Open the pull request into `main` only when Viktor asks to ship the package: never earlier, never as a draft and
  never "for review". Opening it is the ship request, and CI then runs every check.
- Before opening it, bring `origin/main` into the branch. Merge only when every CI check is green on a head that
  contains `origin/main`; Viktor's ship request is the approval, so merge it without asking again. Never merge red or
  pending; a fix pushed to the branch runs the checks again.
- Never write the skip-CI marker in a commit message, not even in its body.
