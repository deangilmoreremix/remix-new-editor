# Integration architecture

```
#/timeline → src/cinegen/mount.tsx → CineGen WorkspaceShell (unchanged)
                 │ window.electronAPI  ← src/cinegen/adapters/electron-shim.ts
                 ├─ web-api.ts        projects, elements, export (Remotion web renderer in a sandboxed iframe)
                 ├─ web-media.ts      import, trim, proxy, persistGeneratedAsset (blob/IndexedDB)
                 ├─ web-store.ts      ProjectStore (IndexedDB), saves state.timelines whole
                 ├─ web-elevenlabs.ts audio via MuAPI
                 └─ main-process/*    ported electron/ipc handlers, HTTP transports swapped to MuAPI / OpenAI Responses
```
- Providers: MuAPI (video, music, audio, 787-model live catalog) and OpenAI (chat, Images 2.6). Keys are user-supplied at runtime, never stored in files.
- Export: `timelineToComposition.js` → Remotion web renderer; shared geometry in `lib/occ/frame-geometry.ts` (legacy projects default to Cover, new timelines to Contain).
- Overlay lane and OpenChatCut effects/captions are hosted on the CineGen Timeline/Clip model through reducer actions persisted with the project.
- Classic editor `#/timeline-classic` is not modified.
