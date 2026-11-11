# Unresolved dependencies

| Item | Why | Status |
|---|---|---|
| MuAPI/OpenAI generation (all model nodes, Storyboarder, Director LLM/video, chat, Fill Gap, Extend, Music, voice) | needs user API keys | Blocked: needs keys |
| Supabase / Clerk publishing, tenant isolation | no credentials; see `docs/publishing-requirements.md` | Blocked |
| Topview, Higgsfield, Artlist, RunPod, fal | removed by design (replaced by MuAPI/OpenAI) | Not applicable |
| Ollama / CLI chat, local Python models, local SAM3 server | desktop-only | Not applicable |
| Voice design | no MuAPI text-to-voice model | Missing |
| FFmpeg / SQLite / Electron IPC | replaced by browser adapters (Remotion web renderer, IndexedDB) | Adapted |
| Edit-tool certification (slip/slide/roll/ripple), 4K/60fps export matrix, keyframe/transition MP4 frames | tests not yet run | Not completed |
