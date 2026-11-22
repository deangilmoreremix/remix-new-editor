import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureModelConsent } from '../transcribe.js';

describe('classic editor Whisper download consent', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
  it('asks before the first download and rejects like a cancel when declined', async () => {
    const confirm = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    await expect(ensureModelConsent('onnx-community/whisper-tiny_timestamped')).rejects.toMatchObject({ name: 'AbortError' });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toMatch(/huggingface\.co/);
  });
  it('remembers an accepted model and does not ask again', async () => {
    const confirm = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    await ensureModelConsent('m1'); await ensureModelConsent('m1');
    expect(confirm).toHaveBeenCalledTimes(1);
    await ensureModelConsent('m2');
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
