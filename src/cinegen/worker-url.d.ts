// [remix] Stage 11: Vite's `?worker&url` import (the pitch AudioWorklet module, see lib/audio/pitch-worklet.ts) resolves to the bundled asset URL.
declare module '*?worker&url' { const url: string; export default url; }
