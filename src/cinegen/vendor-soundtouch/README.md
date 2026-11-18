# SoundTouch JS (vendored, LGPL-2.1-or-later)

`time-stretch.ts` is an **unmodified, byte-identical copy** of `src/infrastructure/audio/time-stretch.ts` from FreeCut
(https://github.com/walterlow/freecut, commit `5ceeeb388eef5423640b7db157706274bf1b8165`), which is SoundTouch JS v0.2.3:

- Copyright (c) Olli Parviainen, Ryan Berdeen, Jakub Fiala, Steve 'Cutter' Blades
- Licence: GNU Lesser General Public License, version 2.1 or (at your option) any later version. Full text: `LICENSE-LGPL-2.1.txt`
  (copy of FreeCut's `src/infrastructure/audio/THIRD_PARTY_LICENSE`). The original licence header is kept at the top of the source file.

The rest of the repository is AGPL-3.0, which is compatible (LGPL-2.1+ code may be combined under the GPL family).

## Why this is its own folder (LGPL replaceability)

The SoundTouch code is kept in this one file and used only through its public exports
(`TimeStretchProcessor`, `TimeStretchFilter`), imported from exactly two places:

- `src/cinegen/lib/audio/pitch-dsp.ts` (offline render for the export bake and the tests),
- `src/cinegen/lib/audio/pitch-worklet.processor.js` (the preview AudioWorklet; Vite bundles it as a separate same-origin asset).

To use a modified or different build of SoundTouch, replace `time-stretch.ts` with a file exporting the same two names and rebuild.
No other file contains SoundTouch code. If you distribute a build, keep this folder (notice + licence text) with it and make the
corresponding source of this file available (this repository is its source).
