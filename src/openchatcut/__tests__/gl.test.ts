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
  it('FCPXML export', async () => { await import('../export/fcpxml.verify'); });
});
