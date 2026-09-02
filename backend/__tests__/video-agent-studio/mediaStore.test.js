import { describe, it, expect, beforeEach } from '@jest/globals';
import { InMemoryVideoAgentMediaStore } from '../../services/video-agent-studio/mediaStore.js';

describe('VideoAgentMediaStore', () => {
  let store;
  beforeEach(() => {
    store = new InMemoryVideoAgentMediaStore();
  });

  it('accepts a valid video upload and returns a read URL', async () => {
    const { asset, readUrl } = await store.putAsset('user-1', 'proj-1', {
      filename: 'a.mp4',
      mimeType: 'video/mp4',
      byteSize: 1024,
      data: new Uint8Array([1, 2, 3]),
    });
    expect(asset.id).toBeTruthy();
    expect(readUrl).toContain(asset.id);
  });

  it('rejects unsupported mime types', async () => {
    await expect(
      store.putAsset('user-1', 'proj-1', {
        filename: 'a.exe',
        mimeType: 'application/octet-stream',
        byteSize: 1,
        data: new Uint8Array([1]),
      }),
    ).rejects.toThrow();
  });

  it('rejects oversize uploads', async () => {
    await expect(
      store.putAsset('user-1', 'proj-1', {
        filename: 'big.mp4',
        mimeType: 'video/mp4',
        byteSize: 6 * 1024 * 1024 * 1024,
        data: new Uint8Array([1]),
      }),
    ).rejects.toThrow();
  });

  it('only lists assets for the requesting user', async () => {
    await store.putAsset('user-1', 'proj-1', {
      filename: 'a.mp4',
      mimeType: 'video/mp4',
      byteSize: 1,
      data: new Uint8Array([1]),
    });
    await store.putAsset('user-2', 'proj-1', {
      filename: 'b.mp4',
      mimeType: 'video/mp4',
      byteSize: 1,
      data: new Uint8Array([1]),
    });
    const list = await store.listAssets('user-1', 'proj-1');
    expect(list).toHaveLength(1);
  });

  it('refuses to give a read URL for someone else\'s asset', async () => {
    const { asset } = await store.putAsset('user-1', 'proj-1', {
      filename: 'a.mp4',
      mimeType: 'video/mp4',
      byteSize: 1,
      data: new Uint8Array([1]),
    });
    expect(await store.getReadUrl('user-2', asset.id)).toBeNull();
  });
});
