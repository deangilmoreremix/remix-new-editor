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
