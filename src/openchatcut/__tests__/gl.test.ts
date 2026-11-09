// [remix] OpenChatCut's own `*.verify.ts` suites (plain node:assert scripts) run under vitest unchanged.
import { describe, it } from 'vitest';

describe('OpenChatCut GL engine (upstream verify suites)', () => {
  it('.cube parser + LUT pass mounting', async () => { await import('../gl/fx/cube.verify'); });
  it('fx uniforms / passes', async () => { await import('../gl/fx/fx.verify'); });
  it('chroma-key shader contract', async () => { await import('../gl/fx/chroma-key.verify'); });
});
