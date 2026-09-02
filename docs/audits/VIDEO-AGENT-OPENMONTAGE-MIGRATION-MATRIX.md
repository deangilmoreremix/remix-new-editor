# OpenMontage → Video Agent Studio Migration Matrix

> Phase 24. The existing `OpenMontagePage.js` / `backend/services/openmontageProxy.js` /
> `vendor/openmontage/` sources are kept as **architectural reference** for
> the future Producer mode (Phase 14). They are not the editor engine.
>
> This document enumerates every OpenMontage feature, decides whether
> it stays in SmartVideo, moves into the new Video Agent Studio, or
> needs a fresh implementation, and tracks the current status.

Status legend:
* **KEEP** — keep the OpenMontage implementation in place; do not move
  it into the new Video Agent Studio. The legacy route (`/openmontage`)
  continues to work.
* **MIGRATE** — move the feature into the new Video Agent Studio. The
  OpenMontage reference stays for context but is not user-facing.
* **NEW** — needs a fresh implementation in the new Video Agent Studio.
* **DEFER** — keep on the OpenMontage side for now, revisit after
  Phase 14 ships.

| OpenMontage feature | OpenMontage source | OpenChatCut equivalent | Migration action | Status |
| --- | --- | --- | --- | --- |
| Stage rail (IDEA → RESEARCH → … → PUBLISH) | `OpenMontagePage.js` (UI) | Producer mode scaffolding (see Phase 14 in `docs/video-agent/PRODUCER-WORKFLOWS.md`) | MIGRATE → Video Agent Studio Producer mode | NEW (foundation; not yet wired) |
| Production activity feed | `OpenMontagePage.js` (UI) | `src/agent/changeLog.ts`, `src/agent/agent-session.ts` | MIGRATE | NEW |
| Storyboard surface | `OpenMontagePage.js` (UI) | `src/script/`, `src/components/storyboard` | MIGRATE | PARITY-PENDING |
| Decision log | `OpenMontagePage.js` (UI) | agent changeLog + `agent.turn.*` events | MIGRATE | NEW |
| Cost meter (credits remaining) | `OpenMontagePage.js` (UI) | SmartVideo existing billing UI + new `creditLedger` | MIGRATE → existing SmartVideo credits | PARITY-PENDING |
| Approvals (manual gate) | `OpenMontagePage.js` (UI) | `requiresApproval()` in `creditLedger.js` | MIGRATE | DONE (Phase 12) |
| Reference video analysis (pacing, hook, camera, transitions, caption, CTA, music/rhythm) | `OpenMontagePage.js` (UI) | partial: `src/agent/tools/script-*`, transcript/captions | NEW (largest gap) | DEFER |
| Production brief | `OpenMontagePage.js` (UI) | script tools | MIGRATE | DEFER |
| Pipeline system (multi-stage generator) | `OpenMontagePage.js` (UI) | `src/generate/`, agent | MIGRATE | DEFER |
| Provider explanation (which model was chosen and why) | `OpenMontagePage.js` (UI) | `SmartVideoGenerationEstimate.reason`, `alternatives` | MIGRATE | DONE (Phase 10/12) |
| Scene-level generation status | `OpenMontagePage.js` (UI) | `video_agent_events` (asset.created, generation.*) | MIGRATE | DONE (Phase 20/21, foundation only) |
| Asset pool | `OpenMontagePage.js` (UI) | `mediaStore.js` + `/api/video-agent-studio/projects/:id/assets` | MIGRATE | DONE (Phase 9) |
| Project persistence (legacy JSON) | `OpenMontagePage.js` (UI) | `projectRepository.js` (JSONB ProjectDoc) | MIGRATE | DONE (Phase 8) |
| Generation jobs | `OpenMontagePage.js` (UI) | `generationAdapter.js` (job lifecycle) | MIGRATE | DONE (Phase 20) |
| Realtime event stream | `OpenMontagePage.js` (UI) | `eventBus.js` + SSE endpoint | MIGRATE | DONE (Phase 21) |

## Verification rules

* A feature only moves from DEFER / NEW / PARITY-PENDING to MIGRATE-DONE
  when the equivalent SmartVideo adapter has tests (see
  `docs/video-agent/TESTING.md`).
* OpenMontage code is never deleted in this work. The reference sources
  remain available for the Producer-mode authoring team to consult.

## Files preserved

* `src/components/OpenMontagePage.js` (1 389 lines, UI reference)
* `backend/services/openmontageProxy.js`
* `vendor/openmontage/`

The legacy `/openmontage` HTTP route and any UI surface that links to
it must continue to function. The migration matrix above describes the
long-term destination of each feature, not the deletion of any
existing file.
