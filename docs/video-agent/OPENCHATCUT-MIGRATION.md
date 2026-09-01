# SmartVideo Video Agent Studio 2 — OpenChatCut migration

The OpenChatCut codebase is imported into the SmartVideo repository
as a `git subtree` at `apps/video-agent-studio/`. Video Agent
Studio 2 embeds OpenChatCut as an iframe. This document describes
how that import is maintained and how the SmartVideo side keeps
out of OpenChatCut's way.

## Subtree workflow

```bash
# add the remote (one-time)
git remote add openchatcut https://github.com/deangilmoreremix/OpenChatCut.git

# fetch + import (one-time)
git fetch openchatcut
git subtree add --prefix=apps/video-agent-studio openchatcut main --squash

# update (subsequent)
git fetch openchatcut
git subtree pull --prefix=apps/video-agent-studio openchatcut main --squash
```

The `update:video-agent-studio-subtree` script in the SmartVideo
root `package.json` wraps the update command.

## Why a subtree (and not a submodule or a copy)

* Subtrees do not require users of the SmartVideo repo to fetch a
  second repo.
* The subtree is materialized in the working tree like any other
  directory; the OpenChatCut dev server can read it without
  separate clone steps.
* The SmartVideo-side surface (one iframe shell) is intentionally
  tiny, so most upstream changes are transparent to SmartVideo.

## What the SmartVideo side does NOT do

* It does NOT import any file from `apps/video-agent-studio/src/`
  into the root `src/`.
* It does NOT install the OpenChatCut npm dependencies into the
  root `package.json`.
* It does NOT pin or downgrade SmartVideo's React, Vite,
  TypeScript, Node, or Remotion versions to match OpenChatCut.
* It does NOT delete or replace `TimelineEditorPage.jsx`,
  `TimelineFeatureApi`, the original `VideoAgentPage.js`, the
  `video-agent` route, the `timeline` route, OpenMontage, or any
  other protected SmartVideo surface.
* It does NOT pass any timeline, media, project, generation, or
  export command across the iframe boundary.

## What the SmartVideo side DOES

* Owns the iframe shell, the optional readiness handshake, and the
  SmartVideo-branded chrome (`src/components/VideoAgentStudioShell.js`).
* Owns the navigation entry (`src/lib/studioRoutes.js`).
* Owns the route wiring (`src/lib/router.js`).
* Owns the dev/build scripts (root `package.json`).
* Owns the verification script
  (`scripts/verify-video-agent-studio.mjs`).
* Owns the regression test that protects the Timeline Studio +
  Studio 1 invariants
  (`backend/__tests__/video-agent-studio/timelineStudioRegression.test.js`).

## Historical / out-of-scope adapter layer

The earlier integration attempt left a SmartVideo-side adapter
layer at `backend/services/video-agent-studio/*` and
`backend/routes/video-agent-studio/*`. The current Studio 2
integration strategy does NOT use that layer. It is preserved
(not deleted) and is explicitly documented as out-of-scope in
`backend/services/video-agent-studio/README.md` and
`backend/routes/video-agent-studio/README.md`.

## When the upstream message contract changes

The single SmartVideo-side point of contact is
`src/components/VideoAgentStudioShell.js`. The shell only
recognises four optional postMessage types: `studio.ready`,
`studio.error`, `health.ping`, `health.pong`. If OpenChatCut
changes or removes these, the shell simply falls back to the
iframe `load` event as the readiness signal. No other upstream
message contract is observed.

## Capability / migration matrices

* Existing SmartVideo `video-agent` (Studio 1) capabilities are
  tracked in
  `docs/audits/VIDEO-AGENT-CAPABILITIES-MIGRATION-MATRIX.md`.
  Because Studio 2 does not integrate with SmartVideo's backend,
  the migration matrix is now a **status reference** rather
  than an active migration plan.
* OpenMontage features are tracked in
  `docs/audits/VIDEO-AGENT-OPENMONTAGE-MIGRATION-MATRIX.md`.
  None of the OpenMontage source is deleted.
