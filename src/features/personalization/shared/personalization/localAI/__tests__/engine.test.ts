import { describe, it, expect } from 'vitest';
import { modelInfo } from '../engine';

describe('modelInfo', () => {
  it('reports a known model', async () => {
    const info = await modelInfo('detr');
    expect(info).toMatchObject({ key: 'detr' });
    expect(info.label).toBeTruthy();
  });
  it('says which model is unknown instead of throwing a TypeError', async () => {
    await expect(modelInfo('nope' as never)).rejects.toThrow('Unknown local model: nope');
  });
});
