# Stage 1 real-render check

Renders the real `PersonalizationComposition` with Remotion's web renderer in headless Chromium and asserts on the
pixels (rotation pivot, custom-field substitution, source-footage zoom). It exists because jsdom tests mock Remotion
and cannot see real-renderer problems (it found `Internals.SequenceManager` crashing the composition in Remotion 4.0.540,
and a rotation pivot bug on text layers).

```bash
node scripts/stage1-render-check/run.mjs            # writes PNGs to scripts/stage1-render-check/out/
CHROMIUM_PATH=/path/to/chrome node scripts/stage1-render-check/run.mjs /tmp/out
```
Not part of the app build or the vitest run. `out/` is ignored by git.
