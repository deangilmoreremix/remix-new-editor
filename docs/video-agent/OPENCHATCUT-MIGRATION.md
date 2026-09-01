# OpenChatCut Migration

The OpenChatCut codebase is imported into the SmartVideo repository
as a `git subtree` at `apps/video-agent-studio/`. This document
describes how that import is maintained, how the SmartVideo side
adapts to the upstream app, and how the migration of capabilities is
tracked.

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
* The SmartVideo-side adapter layer (see `ARCHITECTURE.md`) talks
  to OpenChatCut through a stable HTTP surface, not through direct
  imports, so most upstream changes will be transparent to
  SmartVideo.

## What the SmartVideo side does NOT do

* It does NOT import any file from `apps/video-agent-studio/src/`
  into the root `src/`.
* It does NOT install the OpenChatCut npm dependencies into the
  root `package.json`.
* It does NOT pin or downgrade SmartVideo's React, Vite,
  TypeScript, Node, or Remotion versions to match OpenChatCut.
* It does NOT delete or replace `TimelineEditorPage.jsx`,
  `TimelineFeatureApi`, or any other protected SmartVideo surface.

## What the SmartVideo side DOES

* Owns the iframe shell, the postMessage handshake, and the
  SmartVideo-branded chrome (`src/components/VideoAgentStudioShell.js`).
* Owns the auth bridge (`src/lib/videoAgentAuth.js`).
* Owns the adapter contracts and the in-memory implementations
  (`backend/services/video-agent-studio/*`).
* Owns the HTTP surface mounted at `/api/video-agent-studio`
  (`backend/routes/video-agent-studio/index.js`).
* Owns the regression test that protects the Timeline Studio
  (`backend/__tests__/video-agent-studio/timelineStudioRegression.test.js`).
* Owns the migration matrices
  (`docs/audits/VIDEO-AGENT-CAPABILITIES-MIGRATION-MATRIX.md`,
  `docs/audits/VIDEO-AGENT-OPENMONTAGE-MIGRATION-MATRIX.md`).

## When the upstream message contract changes

The single SmartVideo-side point of contact is
`src/components/VideoAgentStudioShell.js` and the
`BRIDGE_MESSAGE_TYPES` constants. If OpenChatCut renames or
re-shapes its bridge messages, the shell is the only place that
needs to adapt.

## Capability migration

* Existing SmartVideo `video-agent` capabilities are tracked in
  `docs/audits/VIDEO-AGENT-CAPABILITIES-MIGRATION-MATRIX.md`.
  Each row has a status: `KEEP`, `MIGRATE`, `REPLACE`,
  `PARITY`, or `PARITY-PENDING`. A row only moves to `PARITY` when
  a parity test passes (see `docs/video-agent/TESTING.md`).
* OpenMontage features are tracked in
  `docs/audits/VIDEO-AGENT-OPENMONTAGE-MIGRATION-MATRIX.md`. None
  of the OpenMontage source is deleted.
