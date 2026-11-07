// [remix] CineGen's background visual indexing effect, in the web provider.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@cinegen/lib/utils/api-key', async (orig) => ({ ...(await orig<typeof import('@cinegen/lib/utils/api-key')>()), getOpenAiApiKey: () => 'byok', getAutoVisualIndexingEnabled: () => true }));
import { useVisualIndexing } from '@cinegen/components/workspace/use-visual-indexing';

describe('useVisualIndexing', () => {
  it('analyzes a queued asset and stores the summary', async () => {
    const indexAsset = vi.fn(async () => ({ assetId: 'v1', status: 'ready', summary: 'ok', model: 'm', updatedAt: 'now' }));
    (window as unknown as { electronAPI: unknown }).electronAPI = { vision: { indexAsset } };
    const dispatch = vi.fn();
    const assets = [{ id: 'v1', name: 'Shot', type: 'video', url: 'u', thumbnailUrl: 'data:image/jpeg;base64,AA', createdAt: '', metadata: { llmVisualSummaryStatus: 'queued' } }] as never;
    renderHook(() => useVisualIndexing(assets, dispatch));
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(2));
    expect(dispatch.mock.calls[0][0].asset.metadata.llmVisualSummaryStatus).toBe('analyzing');
    expect(dispatch.mock.calls[1][0].asset.metadata).toMatchObject({ llmVisualSummaryStatus: 'ready', llmVisualSummary: { summary: 'ok' } });
    expect(indexAsset).toHaveBeenCalledWith(expect.objectContaining({ assetId: 'v1', framePaths: ['data:image/jpeg;base64,AA'] }));
  });
});
