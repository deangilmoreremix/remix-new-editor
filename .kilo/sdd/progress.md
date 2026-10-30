# SDD Progress Ledger — upload-release (session 2, 2026-10-21)

Plan: .kilo/worktrees/upload-functionality/.kilo/plans/upload-release-plan.md
Branch: fix/upload-repair · PR #30 · Worktree .kilo/worktrees/upload-functionality
Base: origin/main 6f0274f5 · HEAD at plan time: fe1fbd1ce

## Corrected record (prior ledger claims disproven by fresh-server runs)
- "upload-matrix 14/14 PASS" was measured against a STALE Vite server serving pre-fe1fbd1ce code → actually 7/14.
- "image-upload-matrix 25/27" → suite has 13 tests; real result 13/13 (fresh server).
- PR #30 was NEVER merged (OPEN, mergeStateStatus UNSTABLE, CI 10× FAILURE with 0 steps = infra, not code).

## Verified this session (pre-plan)
- Phase 1 root cause: stale dev server (reuseExistingServer:true) — proven via served-module curl + instrumented probe.
- playwright-matrix.config.ts → reuseExistingServer:false (uncommitted).
- upload-matrix.spec.js → goto domcontentloaded/120s (uncommitted).
- Fixtures replaced with real media via scripts/generate-e2e-fixtures.py (uncommitted): PNG 320×240, MP4 real H.264 256KB, WAV 44KB; stub mp3 deleted.
- image-picker = Supabase-Storage picker (UploadPicker muapiStudio:false default; ImageStudio not in PR #29 rewiring) → 402-credit contract inapplicable to it.
- Rollback deploy: 6ad38a977484340b3a517869 (ready, 078d97744). Live prod: 6ad668c2b26cf1b391713074 (unmerged-branch deploy, to be replaced).
- SUPABASE_JWT_SECRET presence in prod UNCONFIRMED (CLI shows 9/22 keys; per-var API denied).

## Task Status

| Task | Scope | Status | Evidence |
|------|-------|--------|----------|
| R1 | Phases 1+2 finish: 14/14 matrix + fixtures + hygiene | pending | |
| R2 | Phase 3: studio upload coverage + real probe | pending | |
| R3 | Phase 4: regression gate + classification | pending | |
| R4 | Whole-branch review | pending | |
| R5 | Phase 5: merge + deploy + smoke + rollback doc | pending | |
