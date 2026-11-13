import { describe, expect, it } from 'vitest';
import { muapiVideoRequest } from '@cinegen/adapters/muapi-video';
import { muapiVideoAdapter } from '@cinegen/lib/director/video-adapter';

// [remix] Director clips run on MuAPI Seedance 2.5 (4-30 s); Element stills switch to omni-reference.
describe('muapiVideoRequest', () => {
  it('text-to-video keeps 20 s and 30 s clips (no 10 s cap)', () => {
    expect(muapiVideoRequest({ prompt: 'p', durationSec: 20, params: {} })).toMatchObject({ model: 'seedance-2.5-text-to-video', seconds: 20 });
    expect(muapiVideoRequest({ prompt: 'p', durationSec: 30, params: {} }).inputs.duration).toBe(30);
  });
  it('clamps to the catalog range 4-30', () => {
    expect(muapiVideoRequest({ prompt: 'p', durationSec: 2, params: {} }).seconds).toBe(4);
    expect(muapiVideoRequest({ prompt: 'p', durationSec: 90, params: {} }).seconds).toBe(30);
  });
  it('https stills use omni-reference; local stills fall back to text-to-video', () => {
    const r = muapiVideoRequest({ prompt: 'p', durationSec: 10, params: { aspect_ratio: '9:16', resolution: '1080p' }, medias: [{ value: 'https://x/a.png', role: 'image' }, { value: 'data:image/png;base64,AA', role: 'image' }] });
    expect(r.model).toBe('seedance-2.5-omni-reference');
    expect(r.inputs).toMatchObject({ images_list: ['https://x/a.png'], aspect_ratio: '9:16', resolution: '1080p', omni_reference_task_type: 'reference' });
    expect(muapiVideoRequest({ prompt: 'p', durationSec: 10, params: {}, medias: [{ value: 'data:image/png;base64,AA', role: 'image' }] }).model).toBe('seedance-2.5-text-to-video');
  });
  it('the adapter offers every clip length up to 30 s', () => {
    expect(muapiVideoAdapter.capabilities.maxDurationSec).toBe(30);
  });
});
