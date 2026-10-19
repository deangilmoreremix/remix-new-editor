# REMIX-NEW-EDITOR — Unified Upload Pipeline Repair

Branch: fix/unified-media-upload-pipeline
Base commit: b8d0b697c

## GLOBAL CONSTRAINTS (bind every task)

- PROTECTED, DO NOT MODIFY (code, routes, handlers, state, UI, config, or tests):
  Timeline Studio / Timeline Editor; CineGen and all CineGen-related components;
  Chat including Chat attachments and upload functionality.
- If a shared upload service is used by a protected application, preserve its
  existing API contract and behavior. Add a compatible adapter or separate entry
  point rather than introducing breaking changes.
- MuAPI /upload_file is the PRIMARY destination for TEMPORARY AI-generation inputs.
- Supabase fallback ONLY for approved retryable network/5xx failures.
- NEVER silently bypass MuAPI 402, 403, 413, or 422 errors.
- Supabase REMAINS the store for durable template assets, saved projects, and
  persistent media. Do NOT replace permanent project assets with expiring
  MuAPI URLs.
- Preserve upload progress, previews, retries, and error handling.
- Enforce user authentication, ownership, and isolation.
- Commit to the repair branch only. Do NOT merge, deploy, or push without
  authorization.

## ARCHITECTURE DECISION (duality by durability, resolved)

The plan mandates both "MuAPI as primary" and "Supabase remains available for
durable template assets, saved projects, and persistent media." These are not in
conflict: routing is decided by the durability of the asset, not by the studio.

| Asset class | Destination |
|---|---|
| Temporary input for a one-shot generation (reference image/video/audio, first/last frame) | MuAPI /upload_file |
| Durable/persisted asset (saved template config, project media, media library, template thumbnails) | Supabase (durable) |

MuAPI's presigned URLs expire in 1 hour, so they must never be persisted as the
canonical reference for durable assets.

## Task 1 — Establish protected-application safety baseline

Goal: prove the protected apps are untouched and keep them that way.

1. Enumerate every shared upload service/entry point and its importers:
   src/lib/muapi.js (uploadFile), src/lib/uploadService.js
   (uploadFileToSupabase, uploadFileToStorage, validateUploadFile,
   resolveSupabaseBucket, UploadError), src/lib/editor/upload.js
   (uploadMediaFile), src/lib/editor/uploadPipeline.js (processFileUpload,
   fetchUrlAsFile), src/lib/supabase.js (uploadFileToStorage),
   src/lib/hybrid-supabase.js (uploadFileToStorage),
   src/lib/editor/uploadLimits.js.
2. For each, record the exact exported signature(s) and which protected apps
   import them (Timeline Studio, CineGen, Chat).
3. Verify no signature drift is required by Tasks 2-5. If a breaking change
   would be needed, STOP and report — an adapter must be added instead.
4. Write a baseline test file that fails if any protected application changes:
   snapshot-based guard asserting the protected files' contents/behaviour.

Deliverable: report listing shared contracts + protected importer map + the
guard test.

## Task 2 — Route the 7 attachment-toolbar studios to the canonical pipeline

Studios: ImageStudio, EffectsStudio, UpscaleStudio, VideoToolsStudio,
StoryboardStudio, AudioStudio, EditStudio.

Root cause to fix: these import `uploadFileToStorage` from
src/lib/uploadService.js and upload straight to Supabase Storage, bypassing
MuAPI /upload_file. Introduced by commit c187131ad ("feat(attachments): ...
Wire attachment uploads through existing hybrid-supabase upload path").

For each studio:
1. Locate the attachment upload call site(s) and the drag-and-drop / paste /
   file-input handlers.
2. Replace the Supabase-direct call with the canonical temporary-asset path:
   processFileUpload(file, { ... }) or uploadMediaFile(file, ...) — whichever
   matches the existing in-studio convention. Keep the SAME resulting variable
   shape so downstream generation payload code is unchanged.
3. Do NOT change what the URL is used for: if the studio persists it as a
   durable asset, use the dual-path decision (MuAPI for the generation request,
   Supabase for persistence) and say so explicitly in the report.
4. Preserve onProgress, previews, abort/signal, retries, and error toasts.
5. Confirm MuAPI 402/403/413/422 now surface instead of being swallowed.

Deliverable: per-studio before/after routing + tests.

## Task 3 — Cinema Templates (REQUIRED deliverable)

Files (discover; do not assume): src/components/CinemaTemplateStudio.js and any
CinemaTemplate-related components/routes.

Audit and repair, end to end:
- Template browsing and selection
- Template preview images and videos
- User image uploads; user video uploads; supported audio uploads
- Template personalization and asset replacement
- First-frame and last-frame uploads where supported
- Template-specific image/video generation
- Generation request payloads and provider URLs
- Generated results and download/export
- Persistence of saved template configurations
- Error handling for invalid files and provider failures

Acceptance: selecting a template, uploading media, generating the result, and
reopening saved work all function end to end.

Deliverable: root cause per problem, files changed, test results.

## Task 4 — Template Studio (REQUIRED deliverable)

Files (discover; do not assume): src/components/TemplateStudio.js and related.

"Do not assume Cinema Templates and Template Studio use the same upload
implementation."

Audit and repair:
- Template creation; existing template editing
- Template thumbnails
- Image/video uploads
- Logo and branding uploads where supported
- Template media replacement
- Template preview rendering
- Asset validation
- Template saving and reopening
- Asset persistence
- Provider integration for generation
- Error states and retry functionality

Acceptance: upload, save, and reopen work; assets stay associated with the
owning user and template; no clobbering of shared templates or other users'
assets.

Deliverable: root cause per problem, files changed, test results.

## Task 5 — Supabase retention, dry-run only

Audit the `uploads` bucket: classify temporary vs persistent media.
Implement safe retention for CLEARLY IDENTIFIED TEMPORARY uploads ONLY.
Must NOT delete: Cinema Template assets, Template Studio assets, user-saved
templates, user media-library assets, existing project media, files referenced
by active generation jobs.
Require dry-run evidence before any cleanup is enabled. Default: DISABLED.
Must not change storage policies in a way that breaks Timeline, CineGen, or Chat.

Deliverable: dry-run report/script (disabled by default) + evidence.

## Task 6 — Verification

- Unit + integration tests for every included studio; emphasis on Cinema
  Templates and Template Studio. Cover image, video, supported audio,
  drag-and-drop, generation, saved assets, MuAPI responses, fallback behaviour,
  and authentication.
- Real browser-based upload tests (Playwright) — do not rely only on mocks.
- Non-modifying regression tests for Timeline Studio, CineGen, Chat.
- Production build passes.
- Final git diff certified free of unauthorized changes to protected apps.

Deliverable: full verification report.
