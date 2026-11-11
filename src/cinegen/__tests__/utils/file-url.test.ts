import { describe, expect, it } from 'vitest';
import { toFileUrl } from '@cinegen/lib/utils/file-url';

describe('toFileUrl', () => {
  it('preserves browser-owned media references', () => {
    expect(toFileUrl('/media/projects/project-1/generated/result.mp4'))
      .toBe('/media/projects/project-1/generated/result.mp4');
  });

  // [remix] Web: there is no local-media:// protocol, so root-relative paths stay ordinary site URLs.
  it('keeps root-relative paths as site URLs', () => {
    expect(toFileUrl('/Users/editor/My Clip #1.mov')).toBe('/Users/editor/My Clip #1.mov');
  });

  it('passes through existing URLs', () => {
    expect(toFileUrl('https://cdn.example.com/clip.mp4'))
      .toBe('https://cdn.example.com/clip.mp4');
  });
});
