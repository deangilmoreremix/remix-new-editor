---
name: Supabase Edge Functions
area: platform
status: live
added: 2026-03-14
pr: TBD
route: `supabase/functions/`
code:
  - supabase/functions/muapi-proxy
  - supabase/functions/muapi-webhook
  - supabase/functions/generation-history
  - supabase/functions/process-upload
  - supabase/functions/create-share
  - supabase/functions/lead-capture
  - supabase/functions/frame-agent
  - supabase/functions/videoagent
  - supabase/functions/ai-cinematic-prompt-generator
  - supabase/functions/ai-thumbnail-generator
---

## What it does
Server functions backing the app: muapi-proxy, muapi-webhook, generation-history, process-upload, create-share, lead-capture, frame-agent, videoagent, ai-cinematic-prompt-generator and ai-thumbnail-generator. TBD: one line per function; only muapi-proxy and generation-history have their own pages so far.

## Where in the app
No UI.

## Depends on
Supabase project; see `docs/DEPLOYMENT_RUNBOOK.md`.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
