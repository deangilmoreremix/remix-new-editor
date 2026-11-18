// [remix] OpenChatCut's own `*.verify.ts` suites (plain node:assert scripts) run under vitest unchanged.
import { describe, it } from 'vitest';

describe('OpenChatCut GL engine (upstream verify suites)', () => {
  it('.cube parser + LUT pass mounting', async () => { await import('../gl/fx/cube.verify'); });
  it('fx uniforms / passes', async () => { await import('../gl/fx/fx.verify'); });
  it('chroma-key shader contract', async () => { await import('../gl/fx/chroma-key.verify'); });
  it('color scopes', async () => { await import('../color/scopes.verify'); });
  it('loudness', async () => { await import('../audio/loudness.verify'); });
  it('beats', async () => { await import('../audio/beats.verify'); });
  it('silence core', async () => { await import('../audio/silence.verify'); });
  it('multicam audio align', async () => { await import('../multicam/align.verify'); });
  it('rate stretch 0.1–8×', async () => { await import('../editor/rateStretch.verify'); });
  it('export QA rules', async () => { await import('../export/quality.verify'); });
  it('FCPXML export', async () => { await import('../export/fcpxml.verify'); });
  it('caption motion', async () => { await import('../captions/captionMotion.verify'); });
  it('caption styles', async () => { await import('../captions/styles.verify'); });
  it('silero VAD logic', async () => { await import('../audio/silero-vad.verify'); });
  it('VAD evidence', async () => { await import('../audio/vad.verify'); });
});
