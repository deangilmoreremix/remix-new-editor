import { beforeEach, describe, expect, it } from 'vitest';
import {
  adapterIdForVideoProvider,
  getVideoGenerationProvider,
  VIDEO_GENERATION_PROVIDER_SETTINGS_VERSION,
} from '@cinegen/lib/utils/video-generation-provider';

describe('video generation provider setting', () => {
  beforeEach(() => localStorage.clear());

  // [remix] The web editor's default is MuAPI (the user's own key); the other providers stay mapped.
  it('defaults to MuAPI and maps providers to their adapters', () => {
    expect(getVideoGenerationProvider()).toBe('muapi');
    expect(adapterIdForVideoProvider('muapi')).toBe('muapi-video');
    expect(adapterIdForVideoProvider('topview')).toBe('topview-auto');
    expect(adapterIdForVideoProvider('higgsfield')).toBe('seedance-2.5');
  });

  it('routes Artlist settings to the Artlist Director adapter', () => {
    localStorage.setItem('cinegen_settings', JSON.stringify({
      videoGenerationProvider: 'artlist',
      videoGenerationProviderSettingsVersion: VIDEO_GENERATION_PROVIDER_SETTINGS_VERSION,
    }));
    expect(getVideoGenerationProvider()).toBe('artlist');
    expect(adapterIdForVideoProvider('artlist')).toBe('artlist-auto');
  });

  it('routes RunPod settings to the LTX-2.5 Director adapter', () => {
    localStorage.setItem('cinegen_settings', JSON.stringify({
      videoGenerationProvider: 'runpod',
      videoGenerationProviderSettingsVersion: VIDEO_GENERATION_PROVIDER_SETTINGS_VERSION,
    }));
    expect(getVideoGenerationProvider()).toBe('runpod');
    expect(adapterIdForVideoProvider('runpod')).toBe('runpod-ltx-2.5');
  });

  it('falls back safely when an old or unknown provider value is stored', () => {
    localStorage.setItem('cinegen_settings', JSON.stringify({ videoGenerationProvider: 'unknown-provider' }));
    expect(getVideoGenerationProvider()).toBe('muapi');
  });

  it('migrates an old saved provider selection to the MuAPI default once', () => {
    localStorage.setItem('cinegen_settings', JSON.stringify({ videoGenerationProvider: 'higgsfield' }));
    expect(getVideoGenerationProvider()).toBe('muapi');
  });
});
