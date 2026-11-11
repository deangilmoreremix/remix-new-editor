/** Motion transfer needs a character image and a motion video together. */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const src = fs.readFileSync('src/components/VideoStudio.js', 'utf8');

describe('Video Studio Motion transfer wiring', () => {
  it('keeps the motion video when a character image is added', () => {
    expect(src).toContain('const v2vNeedsImage');
    expect(src).toMatch(/if \(v2vNeedsImage\(\)\) return; \/\/ keep the motion video/);
  });
  it('keeps an existing image when the workflow needs one', () => {
    expect(src).toContain("const keepImage = w.kind === 'v2v' && !!model.inputs?.image_url;");
  });
  it('asks for the image and sends it with the request', () => {
    expect(src).toContain('Please add the character image to animate.');
    expect(src).toContain('v2vParams.image_url = uploadedImageUrl');
  });
});
