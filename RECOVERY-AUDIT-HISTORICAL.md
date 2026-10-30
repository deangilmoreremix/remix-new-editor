# Recovery Audit: Historical Commits vs develop

Recovery branch: `recovery/full-parity-consolidation` (HEAD `4d6c3766b`).
develop baseline (merge-base): `b327993208`.

Method: for each candidate commit `S`
- `git merge-base --is-ancestor S b327993208` → ancestry in develop
- `git merge-base --is-ancestor S HEAD` → presence in recovery branch
- `git diff --quiet S b327993208` → tree-identity with develop (content-presence)
- attempted `git cherry-pick -X theirs S` per commit (clean apply → commit;
  conflict → `--abort` + document).

## Candidate commits

All 6 are **NOT ancestors of develop** and **NOT in the recovery branch**, and
all 6 **differ in tree from develop** → each is a genuinely-missing candidate by
ancestry/content alone. However, a recovery branch must never overwrite newer
work on develop (Global Constraint #3). Disposition per commit:

| commit | summary | ancestry in develop | tree vs develop | cherry-pick | disposition |
|---|---|---|---|---|---|
| 107ca1d52 | feat(website-builder): integrate SmartVideo Website Builder navigation and rebrand OpenThorn | NO | DIFFERS | CONFLICT (add/add on `tests/e2e/website-builder-navigation.spec.js` — develop already owns this spec) | **SKIPPED — superseded by Tasks 2 & 4** |
| 05a085843 | fix: remove OpenThorn references and update footer | NO | DIFFERS | (blocked: depends on 107ca1d52's test conflict + branding layout) | **SKIPPED — superseded by Task 4** |
| ff7825399 | fix: complete SmartVideo rebranding of all user-facing content | NO | DIFFERS | (depends on above) | **SKIPPED — superseded by Task 4** |
| 3247129ca | feat: integrate SmartVideo branding, Cloudflare BYOC, and OpenThorn sync | NO | DIFFERS | (huge infra/code block; `apps/openthorn/**`, Cloudflare BYOC, `supabase/migrations/20260825_cloudflare_byoc.sql`) | **SKIPPED — superseded by Tasks 4 & 7; high overwrite risk** |
| b3523bb39 | feat: host OpenThorn as embedded iframe studio inside smartvid.app | NO | DIFFERS | (moves thousands of `public/openthorn/*` static assets + adds `netlify.toml`/`scripts/*`) | **SKIPPED — superseded by Tasks 2 & 4** |
| 991c86384 | chore: quarantine OpenThorn static artifacts from main deploy path | NO | DIFFERS | (creates `.archive/openthorn-static/*` vendored asset dump) | **SKIPPED — superseded by Task 2** |

## Files touched by the 6 commits (representative; not exhaustive)

- `apps/openthorn/**` (package.json, src/App.tsx, every component, blog content, tests)
- `apps/openthorn/public/openthorn/**` (thousands of built static assets — JS/CSS/PNG/WOFF2/MP4)
- `src/components/SmartVideoStudio.js`, `src/components/OpenThornStudio.js`, `src/components/StudioWrapper.tsx`, `src/components/DashboardSidebar/DashboardSidebar.tsx`, `src/lib/router.js`, `src/App.tsx`
- `src/components/cloudflare/**` (BYOK/CredentialSetup/DeploymentPanel/api-client/credential-service/deployment-service/encryption)
- `scripts/{indexnow,llms-full,og-cards,prerender,verify-prerender}.mjs`
- `supabase/migrations/20260825_cloudflare_byoc.sql`
- `netlify.toml`, `vercel.json`, `.gitignore`
- `tests/e2e/website-builder-navigation.spec.js`
- `.archive/openthorn-static/**` (quarantined vendored assets from 991c86384)

## Rationale

These six commits are a single, large, cohesive feature block: the
OpenThorn → SmartVideo Website Builder rebrand, plus an alternate hosting
model (OpenThorn served as an embedded iframe inside smartvid.app) and the
quarantine of its static artifacts. Their substantive intent is recovered
**surgically** by:
- **Task 4** — SmartVideo rebrand in `apps/openthorn` (text/strings + routing, not vendored assets).
- **Task 2** — missing template image references / asset paths.
- **Task 7** — diff reconciliation vs develop for the infra/code portions.

Raw cherry-pick was **rejected** because:
1. It conflicts with newer develop work (`tests/e2e/website-builder-navigation.spec.js` already exists on develop with a different version — hard constraint: do not overwrite).
2. It would dump thousands of vendored build artifacts (`public/openthorn/assets/*`, `.archive/openthorn-static/*`) into the recovery branch, bloating the PR and risking clobbering the main deploy path — exactly the kind of breakage `991c86384` (quarantine) was meant to avoid.
3. Several touch infra (`netlify.toml`, Cloudflare BYOC SQL, routing) whose intent is verified against develop in Task 7, not blindly transplanted.

No commits were added by this task. The recovery branch remains at
`4d6c3766b`. Intent is carried forward into Tasks 2 and 4.
