// OpenAI image-editing preservation regression.
//
// The OpenAI Responses API image-editing flow (openaiService.editImageResponses
// → POST https://api.openai.com/v1/responses with the image_generation tool,
// and openaiService.editImage routed through the MuAPI proxy with the user's
// OpenAI key) MUST keep working unchanged. This test reads the real source
// files with readFileSync (no mocks) so it fails if anyone routes OpenAI
// image editing through the MuAPI upload adapter, or changes the configured
// image-editing model.

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (relPath) => readFileSync(path.resolve(here, '../', relPath), 'utf8');

// Files that own the OpenAI image-editing path.
const OPENAI_FILES = [
  'lib/openaiService.js',
  'lib/config/openaiConfig.js',
  'lib/thumbnailService.js',
  'lib/openaiResponses.js',
  'components/ImageStudio.js',
];

// Files that legitimately reference the upload adapter / studio media bridge /
// permanent asset library. Anything else that touches those modules is a
// wiring regression for the OpenAI path.
const ADAPTER_SYMBOLS = [
  'muapiUpload',
  'muapiStudioMedia',
  'assetLibrary',
  'validateMuAPIUpload',
  'uploadImageToMuAPI',
  'uploadVideoToMuAPI',
  'uploadFileToMuapi',
  'resolveMuAPIMediaInput',
  'handleMuAPIUploadError',
];

describe('OpenAI image-editing preservation', () => {
  test('the OpenAI editing modules never import or call the MuAPI upload adapter', () => {
    OPENAI_FILES.forEach((file) => {
      const code = src(file);
      ADAPTER_SYMBOLS.forEach((symbol) => {
        expect(
          code.includes(symbol),
          `${file} must not reference the MuAPI upload adapter (${symbol})`,
        ).toBe(false);
      });
    });
  });

  test('the Responses API model config is unchanged', () => {
    const config = src('lib/config/openaiConfig.js');

    // Currently configured models.
    expect(config).toContain("imageModel: 'gpt-image-2'");
    expect(config).toContain("responsesModel: 'gpt-5.6'");
    expect(config).toContain("thumbnailModel: 'gpt-image-2'");
    expect(config).toContain("thumbnailResponsesModel: 'gpt-5.6'");
    // The supported Responses model list must keep gpt-5.6 available.
    expect(config).toContain("thumbnailResponsesModelOptions: ['gpt-5.6'");

    // ...and the resolvers still read the stored config values.
    expect(config).toContain('getResponsesModel() {');
    expect(config).toContain('getImageModel() {');
  });

  test('editImageResponses still posts to the OpenAI Responses API with the image editing model', () => {
    const service = src('lib/openaiService.js');

    // The Responses endpoint is hard-coded and must stay the OpenAI one.
    expect(service).toContain("'https://api.openai.com/v1/responses'");
    expect(service).toContain("'Authorization': `Bearer ${openaiKey}`");

    // The configured editing model is still resolved (never a MuAPI model id).
    expect(service).toContain("model || this.config.getResponsesModel?.() || 'gpt-5.6'");
    expect(service).toContain('tools: [tool]');
    expect(service).toContain("const tool = { type: 'image_generation', action };");
  });

  test('editImage still sends the OpenAI key to the MuAPI proxy unchanged', () => {
    const service = src('lib/openaiService.js');
    expect(service).toContain('const response = await fetch(MUAPI_PROXY_URL, {');
    expect(service).toContain('params: this._withOpenAIKey({');
    expect(service).toContain('_withOpenAIKey(params = {}) {');
    expect(service).toContain("endpoint: 'i2i'");
    expect(service).toContain('image_url: primaryImage');
  });

  test('OpenAI image models are still resolved through openaiConfig', () => {
    const thumbnail = src('lib/thumbnailService.js');
    expect(thumbnail).toContain('openaiConfig.defaultConfig.thumbnailModel');
    expect(thumbnail).toContain('openaiConfig.isOpenAIImageModel(modelId)');
  });

  test('ImageStudio still generates through the MuAPI client (no adapter interception)', () => {
    const studio = src('components/ImageStudio.js');

    // The studio keeps its own MuAPI generation call and its own model list;
    // the OpenAI-provider models in that list keep flowing through `muapi`
    // with the user's OpenAI key.
    expect(studio).toContain('res = await muapi.generateI2I(genParams);');
    expect(studio).toContain('model: selectedModel,');
    expect(studio).toContain('images_list: uploadedImageUrls,');
    expect(studio).toContain('image_url: uploadedImageUrls[0]');

    // ...and it never delegates a file upload to the upload adapter.
    expect(studio).not.toContain('ingestStudioUpload');
    expect(studio).not.toContain('uploadImageToMuAPI');
    expect(studio).not.toContain('saveAsset');
  });

  test('modules outside the owned call-site list never pull the upload adapter', () => {
    // Guards against a future refactor wiring OpenAI (or any unknown) module
    // through the adapter and silently changing its upload semantics.
    const files = [
      'components/ImageToVideoPage.js',
      'components/ImageToImagePage.js',
      'components/TimelineEditorPage.jsx',
      'components/modals/PersonalizeModal.jsx',
      'components/PersonalizePage.js',
      'components/elements/element-generate.jsx',
      'lib/uploadService.js',
    ];
    files.forEach((file) => {
      const code = src(file);
      ADAPTER_SYMBOLS.forEach((symbol) => {
        expect(
          code.includes(symbol),
          `${file} is not an owned adapter call site (${symbol})`,
        ).toBe(false);
      });
    });
  });
});
