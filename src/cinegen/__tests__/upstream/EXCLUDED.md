# CineGen upstream renderer tests: what is excluded and why

Ported from `christopherjohnogden/CineGen@769f148` `tests/` (`@/` → `@cinegen/`). Excluded or `it.skip`ped tests are listed with the category; each is a deliberate difference of this browser app, not a hidden failure.

## web adaptation: browser URLs instead of local-media://, no desktop/cloud auth token

- `lib/assistant/canvas-visual-context.test.ts` — handles local inputs, generated results and audio without inventing images
- `lib/assistant/canvas-visual-context.test.ts` — resolves missing type, file URLs and the active generated take
- `lib/studio/canvas-import.test.ts` — sends desktop media as a saved Studio reference and distinguishes files with the same name
- `lib/studio/rewrite-client.test.ts` — uses authenticated direct cloud requests even when the browser compatibility bridge is installed
- `lib/studio/rewrite-client.test.ts` — uses the native bridge on Mac
- `components/create/studio-reference-preview.test.tsx` — plays video inline, reports duration and dimensions, and stops on close
- `components/director/director-generate-viewer.test.tsx` — plays the persisted project copy before the temporary provider URL
- `components/director/director-storyboard-media.test.tsx` — turns a generated frame filesystem path into a browser-safe local-media URL
- `components/director/director-storyboard-media.test.tsx` — uses an asset fileRef for a persisted generated frame before its temporary provider URL

## provider registry differs (fal/Topview/Higgsfield/RunPod/Codex models replaced by the MuAPI + OpenAI catalog)

- `lib/llm/prompt-elements.test.ts` — wires tagged stills into the image model media ports
- `lib/llm/prompt-elements.test.ts` — stacks repeated picker selections in one element node wired once to medias
- `lib/llm/prompt-elements.test.ts` — wires Qwen mentions to its required Image socket and keeps multiple picks stacked
- `lib/llm/prompt-elements.test.ts` — connects the shared element node when the model is wired after the mention
- `lib/llm/skill-actions.test.ts` — creates per-clip video rows instead of one multi prompt node
- `lib/llm/skill-actions.test.ts` — creates a kling multi-prompt row for combined clip groups
- `lib/workflows/config-only-generation.test.ts` — whole file
- `lib/workflows/element-media-input.test.ts` — whole file
- `lib/workflows/gpt-image-25.test.ts` — whole file
- `lib/workflows/runpod-ltx25-session.test.ts` — is the first RunPod video node and stays distinct from the serverless model
- `lib/workflows/runpod-ltx25-session.test.ts` — executes through the session client and publishes the returned video
- `lib/workflows/runpod-ltx25-session.test.ts` — retains a timed-out remote job so the next click resumes instead of resubmitting
- `lib/workflows/runpod-session-image.test.ts` — registers distinct session nodes while preserving labeled Serverless nodes
- `lib/workflows/runpod-session-image.test.ts` — special-routes an SDXL node and publishes its image URL
- `lib/workflows/runpod-session-image.test.ts` — passes every selected Element to Qwen through one required Image connection
- `lib/workflows/runpod-session-image.test.ts` — retains a timed-out image job and resumes it without resubmitting
- `lib/workflows/studio-attached-references.test.ts` — whole file
- `lib/workflows/topview-video-task.test.ts` — shows when CineGen prepared an undersized reference before submission
- `lib/workflows/topview-video-task.test.ts` — persists the submitted task and publishes its eventual URL to the node
- `lib/workflows/topview-video-task.test.ts` — carries explicit Clip Edit mode and typed media through Canvas execution
- `lib/workflows/topview-video-task.test.ts` — resumes a persisted task after a polling error without submitting again
- `lib/workflows/topview-video-task.test.ts` — automatically restarts a restored running task once without submitting a duplicate
- `lib/workflows/topview-video-task.test.ts` — recovers a legacy completed render by its exact settings without submitting again
- `lib/workflows/topview-video-task.test.ts` — matches every image from a connected Element reference node during legacy recovery
- `lib/workflows/trim-node.test.ts` — whole file
- `components/create/model-node.test.tsx` — renders late-loaded GPT Image 2.5 variants as complete model cards
- `components/create/model-node.test.tsx` — uses a visible default size while React Flow reports zero initial dimensions
- `components/create/model-node.test.tsx` — preserves dimensions after the user resizes the node
- `components/create/model-node.test.tsx` — shows elapsed time instead of a synthetic percentage for an active LTX session render
- `components/create/model-node.test.tsx` — shows every generated video as a directly selectable version tab
- `components/create/space-studio.test.tsx` — uploads images, videos, and audio from the References picker into generation
- `components/create/space-studio.test.tsx` — shows the Topview credit reset in the provider card instead of a project tally
- `components/create/space-studio.test.tsx` — switches provider from the card without a trip through Settings
- `components/director/director-llm-picker.test.tsx` — whole file
- `components/director/director-setup-resolution.test.tsx` — offers every Director duration when Topview publishes model-specific limits at runtime
- `components/director/director-shotlist-provider-switch.test.tsx` — whole file

## product name shown as Timeline Studio Editor

- `lib/llm/skills.test.ts` — lists skill names and descriptions for Copilot context

## desktop MCP bridge / launcher (not part of the web app)

- `lib/mcp/catalog.test.ts` — whole file
- `lib/mcp/display.test.ts` — whole file
- `lib/mcp/project-control.test.tsx` — whole file
- `lib/mcp/stdio.test.ts` — whole file
- `lib/mcp/viewer-startup.test.ts` — whole file
- `lib/mcp/workspace-results.test.ts` — whole file

## test-harness: CSS alias resolved by the app bundler, not vitest

- `components/assistant/assistant-drawer.test.tsx` — whole file

- `components/create/model-node.test.tsx`, `lib/workflows/topview-video-task.test.ts` — whole file (provider registry differs: Higgsfield/Topview/LTX session models)

## remix feature: OpenChatCut clip speed range is 0.1–8×, CineGen's is 0.25–4×

- `lib/editor/timeline-operations.test.ts` — clamps speed to 0.25-4 range (`updateClipProperties` clamps to `MIN_RATE`/`MAX_RATE` from `openchatcut/editor/rateStretch`, which the Alt-drag rate stretch also uses)

## source not ported: desktop (Electron), cloud sync/auth, MCP, and the Topview / Higgsfield / RunPod / Artlist providers

- `components/settings/claude-mcp-connect.test.tsx` — whole file
- `electron/browser-session.test.ts` — whole file
- `electron/ipc/assistant-image-attachments.test.ts` — whole file
- `electron/ipc/canvas-image-preview.test.ts` — whole file
- `electron/ipc/claude-code-vision.test.ts` — whole file
- `electron/ipc/claude-mcp-config.test.ts` — whole file
- `electron/ipc/claude-mcp.test.ts` — whole file
- `electron/ipc/cli-auth.test.ts` — whole file
- `electron/ipc/codex-cli.test.ts` — whole file
- `electron/ipc/gemini-cli-vision.test.ts` — whole file
- `electron/workers/audio-sync.test.ts` — whole file
- `lib/artlist/client.test.ts` — whole file
- `lib/cloud/firebase-auth.test.ts` — whole file
- `lib/higgsfield/client.test.ts` — whole file
- `lib/higgsfield/clip-reference.test.ts` — whole file
- `lib/higgsfield/quick-edit-drawn-frame.test.ts` — whole file
- `lib/runpod/ltx25-service.test.ts` — whole file
- `lib/runpod/site-media-reference.test.ts` — whole file
- `lib/topview/canvas-audio.test.ts` — whole file
- `lib/topview/client.test.ts` — whole file
- `lib/topview/clip-edit.test.ts` — whole file
- `lib/topview/media-tools.test.ts` — whole file

## behaviour differs by design (individual tests skipped)

- `components/settings/settings-runpod-gpu-profile.test.tsx` — defaults to both image models and sends the persisted next-session choices (RunPod provider and settings UI are not part of this app)
- `components/settings/settings-runpod-gpu-profile.test.tsx` — locks the choice while a Pod exists without changing or restarting it (RunPod provider and settings UI are not part of this app)
- `components/settings/settings-runpod-gpu-profile.test.tsx` — normalizes invalid and duplicate saved image-model values (RunPod provider and settings UI are not part of this app)
- `components/settings/settings-runpod-status.test.tsx` — ignores a pending status response after the session is ended (RunPod provider and settings UI are not part of this app)
- `components/settings/settings-runpod-status.test.tsx` — keeps automatic checks single-flight and shows successful check feedback (RunPod provider and settings UI are not part of this app)
- `components/settings/settings-runpod-status.test.tsx` — keeps polling after a transient check failure and later transitions to ready (RunPod provider and settings UI are not part of this app)
- `components/settings/settings-runpod-status.test.tsx` — runs a manual status check with visible progress and shows the provider message (RunPod provider and settings UI are not part of this app)
- `lib/director/prompts.test.ts` — keeps the full Director duration for live Topview model validation and every unique element reference (provider registry differs: MuAPI default instead of Topview, OpenAI/MuAPI instead of fal/Topview/CLI vision)
- `lib/director/run-llm.test.ts` — keeps an installed pick and otherwise takes the first installed CLI (provider registry differs: MuAPI default instead of Topview, OpenAI/MuAPI instead of fal/Topview/CLI vision)
- `lib/director/run-llm.test.ts` — passes mood-board stills to OpenAI and CLI look-bible jobs (provider registry differs: MuAPI default instead of Topview, OpenAI/MuAPI instead of fal/Topview/CLI vision)
- `lib/director/run-llm.test.ts` — sends image data to hosted OpenAI and fal vision (provider registry differs: MuAPI default instead of Topview, OpenAI/MuAPI instead of fal/Topview/CLI vision)
- `lib/director/snapshot.test.ts` — assigns the take asset to the variant folder (our editor has extra tabs (Leads/Publish/Analytics) and MuAPI is the default video provider)
- `lib/director/snapshot.test.ts` — places Director between Spaces and Edit (our editor has extra tabs (Leads/Publish/Analytics) and MuAPI is the default video provider)
- `lib/director/snapshot.test.ts` — round-trips a show through snapshot and workflow extras (our editor has extra tabs (Leads/Publish/Analytics) and MuAPI is the default video provider)
- `lib/runpod/qwen-prompt.test.ts` — replaces CineGen tags with numbered natural-language roles without exposing tags (RunPod provider and settings UI are not part of this app)
- `lib/utils/file-url.test.ts` — keeps Electron local path conversion intact (desktop adaptation: browser URLs instead of Electron local-media:// paths)
- `lib/utils/media-file.test.ts` — turns a Finder file path into an encoded Electron media URL (desktop adaptation: browser URLs instead of Electron local-media:// paths)
- `lib/utils/media-file.test.ts` — uploads a phone video when the browser bridge supplies only a blob preview (desktop adaptation: browser URLs instead of Electron local-media:// paths)
- `lib/utils/video-generation-provider.test.ts` — defaults to Topview and maps it to the live MCP adapter (provider registry differs: MuAPI default instead of Topview, OpenAI/MuAPI instead of fal/Topview/CLI vision)
- `lib/utils/video-generation-provider.test.ts` — falls back safely when an old or unknown provider value is stored (provider registry differs: MuAPI default instead of Topview, OpenAI/MuAPI instead of fal/Topview/CLI vision)
- `lib/utils/video-generation-provider.test.ts` — migrates an old saved provider selection to the new Topview default once (provider registry differs: MuAPI default instead of Topview, OpenAI/MuAPI instead of fal/Topview/CLI vision)
