// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestFrameReview } from '../lib/directorClient';
import { reviewFramesWithModel } from '../lib/filmPipeline';
import type { ProjectData } from '../types';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
afterEach(() => vi.unstubAllGlobals());

describe('frame review', () => {
  it('posts the frames and spec to the review mode and returns the findings', async () => {
    const fetchMock = vi.fn(async () => json(200, { findings: [{ second: 4.2, severity: 'fix', text: 'Caption is cut off' }], summary: 'Motion not judged.' }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await requestFrameReview({ frames: [{ second: 4.2, image: 'data:image/jpeg;base64,AAAA' }], spec: { product: 'Acme' } });
    const sent = JSON.parse(String((fetchMock.mock.calls[0] as unknown[])[1] && ((fetchMock.mock.calls[0] as unknown[])[1] as RequestInit).body));
    expect(sent.mode).toBe('review');
    expect(sent.frames).toHaveLength(1);
    expect(out.findings[0]).toMatchObject({ second: 4.2, severity: 'fix' });
    expect(out.summary).toBe('Motion not judged.');
  });

  it('does nothing for a film with no design spec', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(reviewFramesWithModel({ name: 'x', fps: 30, width: 1, height: 1, tracks: [] } as ProjectData)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
