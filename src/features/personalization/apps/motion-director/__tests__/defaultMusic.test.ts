import { describe, expect, it } from 'vitest';
import { defaultTrackFor } from '../lib/defaultMusic';
import { BGM_LIB } from '../mediaManifest';

describe('default music', () => {
  it('only uses tracks the library ships, never the one with the untraced licence', () => {
    for (const voice of ['trust', 'premium', 'bold', 'playful', 'calm', 'friendly'] as const) {
      const t = defaultTrackFor(voice);
      expect(BGM_LIB.some((b) => b.file === t.file), voice).toBe(true);
      expect(t.file).not.toMatch(/tech-house/);
    }
  });
});
