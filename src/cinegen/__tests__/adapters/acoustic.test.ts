// [remix] CineGen's acoustic analysis, browser transports.
import { describe, it, expect, vi } from 'vitest';

const responsesChat = vi.fn();
vi.mock('../../adapters/llm-responses', () => ({ responsesChat: (...a: unknown[]) => responsesChat(...a) }));
vi.mock('../../../lib/editor/ml/localAI.js', () => ({ detectSilences: async () => [{ start: 1, end: 2.5 }] }));
vi.mock('../../../lib/editor/ml/frameGrab.js', () => ({ grabFrame: async () => { throw new Error('no frame'); }, canvasToBlob: async () => new Blob() }));

import { analyzeAssetAcoustics } from '../../adapters/main-process/acoustic';

describe('acoustic analysis', () => {
  it('measures silences on-device and parses the model segments with CineGen’s normalizer', async () => {
    responsesChat.mockResolvedValue({ message: JSON.stringify({ segments: [{ start: 0, end: 4, content: 'Wide street', shotType: 'wide', cutawayCandidate: true, confidence: 0.8 }] }) });
    const r = await analyzeAssetAcoustics({ assetId: 'a', assetName: 'clip', mediaPath: 'blob:x', isVideo: false, transcript: [] });
    expect(r.status).toBe('ready');
    expect(r.silenceMap).toEqual([{ start: 1, end: 2.5 }]);
    expect(r.segments[0]).toMatchObject({ content: 'Wide street' });
  });
  it('reports a failure instead of throwing', async () => {
    responsesChat.mockRejectedValue(new Error('no key'));
    const r = await analyzeAssetAcoustics({ assetId: 'a', assetName: 'clip', mediaPath: 'blob:x', isVideo: false, transcript: [] });
    expect(r).toMatchObject({ status: 'failed', error: 'no key' });
  });
});
