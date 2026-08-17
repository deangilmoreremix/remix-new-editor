import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const cinemaStudioPath = path.join(root, 'src/components/CinemaTemplateStudio.js');
const muapiPath = path.join(root, 'src/lib/muapi.js');

describe('CinemaTemplateStudio image upload + model selection regression', () => {
  const cinemaSrc = fs.readFileSync(cinemaStudioPath, 'utf8');
  const muapiSrc = fs.readFileSync(muapiPath, 'utf8');

  it('imports createUploadPicker for image uploads', () => {
    expect(cinemaSrc).toContain("import { createUploadPicker } from './UploadPicker.js'");
  });

  it('renders an image upload control in the form field switch', () => {
    expect(cinemaSrc).toContain("case 'image':");
    expect(cinemaSrc).toContain('createUploadPicker');
    expect(cinemaSrc).toContain('currentInputs[input.name] = url');
  });

  it('uses the user-selected model instead of hardcoding it', () => {
    expect(cinemaSrc).toContain('let model = selectedModel;');
    expect(cinemaSrc).toContain("model = 'kling-v2.6-pro-i2v';");
    expect(cinemaSrc).toContain("model = 'kling-v2.6-pro-t2v';");
    expect(cinemaSrc).toContain("model = 'flux-dev';");
  });

  it('falls back to defaults only when selectedModel is empty', () => {
    expect(cinemaSrc).toContain('if (!model) {');
  });

  it('muapi.generateI2V maps image_url to images_list when required by model', () => {
    expect(muapiSrc).toContain('const imageField = modelInfo?.imageField || \'image_url\';');
    expect(muapiSrc).toContain("if (imageField === 'images_list') {");
    expect(muapiSrc).toContain('finalPayload.images_list = [p.image_url];');
  });

  it('muapi.generateI2V sends single image_url for non-list models', () => {
    expect(muapiSrc).toContain('finalPayload[imageField] = p.image_url;');
  });
});
