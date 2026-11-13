# Remotion Recorder inside this repo

This folder is an unmodified copy of https://github.com/remotion-dev/recorder (see its README and
Remotion's license terms: https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
It runs as its own app and is linked from the timeline editor's Screen Recorder drawer.

The editor also has the Recorder built in (capture in the Screen Recorder drawer, post-production in **Recorder Studio**): see `src/features/recorder-studio/README.md`. This standalone copy is kept as the upstream reference and for the full Recorder workflow.

```bash
npm run install:remotion-recorder   # once (needs Node 20.19+/22.13+ and Bun >= 1.1.11)
npm run dev:remotion-recorder       # Recorder UI on http://localhost:4000
```

Workflow: record + edit + render in the Recorder, then in the editor open the Screen Recorder
drawer and use **Import recording** to place the rendered file on the timeline.

To point the editor's "Open Remotion Recorder" link elsewhere, set `VITE_REMOTION_RECORDER_URL`.
