import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const cinemaStudioPath = path.join(root, 'src/components/CinemaTemplateStudio.js');
const muapiPath = path.join(root, 'src/lib/muapi.js');
const templateMediaPath = path.join(root, 'src/lib/templateMedia.js');

describe('CinemaTemplateStudio image upload + model selection regression', () => {
  const cinemaSrc = fs.readFileSync(cinemaStudioPath, 'utf8');
  const muapiSrc = fs.readFileSync(muapiPath, 'utf8');
  const mediaSrc = fs.readFileSync(templateMediaPath, 'utf8');

  it('uses the shared Video Studio upload picker for media inputs', () => {
    expect(cinemaSrc).toContain("from '../lib/templateMedia.js'");
    expect(mediaSrc).toContain("import { createUploadPicker } from '../components/UploadPicker.js'");
    expect(mediaSrc).toContain('frameMode: isFrame');
  });

  it('renders an image / frame / video upload control in the form field switch', () => {
    expect(cinemaSrc).toContain("case 'image':");
    expect(cinemaSrc).toContain("case 'frame':");
    expect(cinemaSrc).toContain("case 'video':");
    expect(cinemaSrc).toContain('createTemplateMediaField');
    expect(cinemaSrc).toContain('currentInputs[input.name] = value');
  });

  it('uses the user-selected model (routed by attached media) instead of hardcoding it', () => {
    expect(cinemaSrc).toContain('currentMediaRoute(selectedModel)');
    expect(cinemaSrc).toContain('let model = routedModel;');
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
