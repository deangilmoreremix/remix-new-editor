# Producer Workflows

> OpenMontage was the original inspiration for "Producer mode"
> inside SmartVideo. With the new Video Agent Studio 2 strategy
> (iframe embed of the complete OpenChatCut application), Producer
> workflows are **not part of this integration work**. They may be
> revisited as a future feature inside the OpenChatCut
> application or as a separate SmartVideo surface; in either case
> they will not be implemented by mutating Timeline Studio state or
> by building a parallel scene editor.

If a future strategy brings Producer mode back into SmartVideo, it
must:

* Operate on its own `ProjectDoc` (the OpenChatCut
  `ProjectDoc` is the canonical choice).
* Not share a mutable timeline store with Timeline Studio.
* Not reuse OpenMontage source or skill text unless the
  licensing strategy explicitly allows it.
* Live as a separate surface under the SmartVideo
  `src/components/` tree or as its own application, not as a
  modification of the existing SmartVideo studios.

See:

* `docs/audits/VIDEO-AGENT-OPENMONTAGE-MIGRATION-MATRIX.md` for
  the OpenMontage feature matrix.
* `docs/video-agent/ARCHITECTURE.md` for the three-editor model.
