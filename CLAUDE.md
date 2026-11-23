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
3. **After opening a PR, enable auto-merge on it** (squash) so it merges into `develop` once its checks pass.
4. Checks and deploys are Netlify only. Do not add or rely on GitHub Actions.
