# Producer Workflows — Foundation

> Phase 14. Producer mode is a future-facing workflow layer that
> operates on the **same Video Agent `ProjectDoc`** as the editor.
> It does not create a separate scene editor state. The OpenMontage
> source is treated as architectural reference only; no AGPL
> OpenMontage code or skill text is copied unless explicitly
> authorised.

## Top-level

```
VIDEO AGENT STUDIO
│
├── EDIT
│
├── AI CHAT
│
└── PRODUCER
        │
        ├── IDEA
        ├── RESEARCH
        ├── CONCEPT
        ├── SCRIPT
        ├── SCENE PLAN
        ├── STORYBOARD
        ├── GENERATE
        ├── EDIT
        ├── REVIEW
        └── PUBLISH
```

Each stage is a SmartVideo-authored workflow definition. A workflow
is a small declarative object that:

* lists the agent tools it needs
* lists the stages it produces (each stage is a `ProjectDoc` patch
  applied atomically through the editor command system)
* lists the events it emits to the SSE stream

## Workflow authoring location

Workflows live under `apps/video-agent-studio/src/agent/workflows/`
once the upstream OpenChatCut agent gains a workflow hook. The
SmartVideo side adds workflow metadata under
`src/lib/video-agent-studio/workflows/` and ships them as SmartVideo
"Producer packs" through the same ProjectDoc persistence path as
projects.

## State ownership

* Producer mode writes the **same `ProjectDoc`** the editor writes.
* A stage transition is a single atomic edit (Phase 6: draft →
  proposal → approval → atomic apply → undoable). The producer mode
  is just a higher-level authoring surface over that system.
* Undo/redo spans the full history regardless of which mode created
  the edit.

## Reference video workflow (Phase 15)

* "Make something inspired by this video" runs the following
  pipeline, each stage producing a `ProjectDoc` patch:
  1. Transcription (`video.transcribe`)
  2. Scene detection
  3. Frame sampling
  4. Pacing analysis
  5. Hook analysis
  6. Camera-language analysis
  7. Transition analysis
  8. Caption analysis
  9. Visual-style analysis
  10. CTA analysis
  11. Music/rhythm analysis
* The output is a *proposal*, not a direct copy. The user can
  approve, reject, or modify any stage.

## Status

Producer mode is currently a foundation only. The structural
elements (atomic edit / undo, ProjectDoc ownership, event stream)
are in place. The actual stage implementations will be added as
follow-up work after the editor surface is reachable from the
iframe.
