import { describe, expect, it } from 'vitest';
import { getCinemaStudioAsset } from '../lib/personalizerAdapters.js';

describe('Cinema Studio personalizer adapter', () => {
  it('captures prompt, first/last frames, and multimodal references', () => {
    const asset = getCinemaStudioAsset({
      textarea: { value: 'A polished contractor commercial' },
      settings: {
        model: 'seedance-2.5-first-last-frame',
        aspect_ratio: '16:9',
        referenceUrl: 'https://cdn/first.png',
        endFrameUrl: 'https://cdn/last.png',
        referenceUrls: [
          { type: 'image', url: 'https://cdn/ref.png' },
          { type: 'video', url: 'https://cdn/ref.mp4' },
          { type: 'audio', url: 'https://cdn/ref.mp3' },
        ],
        camera: 'Wide',
        lens: '35mm',
      },
    });

    expect(asset.type).toBe('video');
    expect(asset.fields.find((field) => field.id === 'firstFrameUrl').value).toBe('https://cdn/first.png');
    expect(asset.fields.find((field) => field.id === 'lastFrameUrl').value).toBe('https://cdn/last.png');
    expect(asset.fields.find((field) => field.id === 'referenceImages').value).toEqual(['https://cdn/ref.png']);
    expect(asset.metadata.studio).toBe('CinemaStudio');
  });
});
