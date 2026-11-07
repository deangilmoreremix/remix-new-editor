// [remix] CineGen's visual summary, run on OpenAI vision (adapter) and its background indexing hook.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const responsesChat = vi.fn();
vi.mock('../../adapters/llm-responses', () => ({ responsesChat: (...a: unknown[]) => responsesChat(...a) }));
vi.mock('@cinegen/lib/utils/api-key', async (orig) => ({ ...(await orig<typeof import('@cinegen/lib/utils/api-key')>()), getOpenAiApiKey: () => 'byok', getAutoVisualIndexingEnabled: () => true }));

import { analyzeAssetVisualSummary } from '../../adapters/main-process/vision';

beforeEach(() => responsesChat.mockReset());

describe('analyzeAssetVisualSummary (OpenAI vision)', () => {
  it('returns CineGen’s summary shape from the model JSON', async () => {
    responsesChat.mockResolvedValue({ message: '```json\n{"summary":"A man at a car","tone":["tense"],"pacing":"slow","shotTypes":["wide"],"subjects":["man"],"brollIdeas":["street"],"confidence":0.8}\n```', usage: {} });
    const r = await analyzeAssetVisualSummary({ assetId: 'a1', assetName: 'Shot 1', framePaths: ['data:image/jpeg;base64,AAA', 'https://x.test/f.jpg'] });
    expect(r).toMatchObject({ assetId: 'a1', status: 'ready', summary: 'A man at a car', tone: ['tense'], pacing: 'slow', sourceFrameCount: 2 });
    expect(responsesChat.mock.calls[0][0].images).toHaveLength(2);
  });
  it('reports missing when no frame is usable', async () => {
    const r = await analyzeAssetVisualSummary({ assetId: 'a2', assetName: 'x', framePaths: [] });
    expect(r.status).toBe('missing');
    expect(responsesChat).not.toHaveBeenCalled();
  });
  it('reports failed on unreadable output', async () => {
    responsesChat.mockResolvedValue({ message: 'sorry, no json', usage: {} });
    const r = await analyzeAssetVisualSummary({ assetId: 'a3', assetName: 'x', framePaths: ['https://x.test/f.jpg'] });
    expect(r.status).toBe('failed');
  });
});
