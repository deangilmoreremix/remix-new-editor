# OpenMontage

**MANDATORY: Read [`AGENT_GUIDE.md`](AGENT_GUIDE.md) before responding to ANY user message.**

Do not act on the user's request until you have read AGENT_GUIDE.md.
It contains routing rules that determine your first action based on what the user asked.
Skipping it WILL cause you to take the wrong action.

Operating instructions live in AGENT_GUIDE.md. The pull request rules below are the only exception.

## Pull request rules (production deploys from `develop` on Netlify)

Netlify project `smartvideo2` (smartvid.app) builds production from the `develop` branch. A PR only gets a Deploy Preview until it is merged into `develop`, and a PR that targets any other branch (such as `main`) never reaches production.

1. **Always open pull requests against `develop`, never `main`.** Check the base branch before and after creating a PR.
2. **Run lint and build before opening a PR, and fix any failures.** Do not open a PR with a failing lint or build.
3. Checks and deploys are Netlify only. Do not add or rely on GitHub Actions.

## Keep the docs in step (studios, pages, apps and features)

4. **Every new or changed studio, page, feature or `apps/` folder must be recorded in the same PR.**
   - Studio or feature: add or update its guide in `src/data/askKb/<route>.json`, then run `npm run docs:studios`. That rewrites the studio catalog in `README.md`, `docs/STUDIOS_AND_PAGES.md` and `docs/STUDIO_FEATURE_CATALOG.md`.
   - New route in `src/lib/router.js` that is not a studio (alias, redirect, marketing page): add a row under "Other app routes" in `docs/STUDIOS_AND_PAGES.md`.
   - New folder under `apps/`: add a row to the "Bundled apps" table in `README.md`.
   - `npm run check:docs` (also part of `npm run lint`) fails if any of this is missing. Run it before opening a PR and do not open one while it fails.
