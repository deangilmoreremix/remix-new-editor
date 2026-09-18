import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock muapi before importing TemplateStudio
vi.mock('../../src/lib/muapi.js', () => {
  const generateI2V = vi.fn(async (params) => {
    return { url: 'https://cdn.muapi.ai/results/i2v-' + Date.now() + '.mp4', model: params.model };
  });
  const generateImage = vi.fn(async (params) => {
    return { url: 'https://cdn.muapi.ai/results/img-' + Date.now() + '.png', model: params.model };
  });
  return {
    muapi: {
      generateI2V,
      generateImage,
    },
  };
});

import { TemplateStudio } from '../../src/components/TemplateStudio.js';

describe('TemplateStudio real-component generation tests', () => {
  let container;
  let localStorageMock;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);
    
    // Create a functional localStorage mock
    const store = { 'muapi_key': 'test-key' };
    localStorageMock = {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, value) => { store[key] = value; }),
      removeItem: vi.fn((key) => { delete store[key]; }),
      clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    };
    global.localStorage = localStorageMock;
  });

  afterEach(() => {
    if (container.parentNode) container.parentNode.removeChild(container);
  });

  function mountTemplateStudio(templateId) {
    const element = TemplateStudio(templateId);
    container.innerHTML = '';
    container.appendChild(element);
    return element;
  }

  it('Matrix I2V: validates required image before generation', async () => {
    mountTemplateStudio('restaurant-brand-film');

    await new Promise(resolve => setTimeout(resolve, 100));

    // Find prompt input (first textarea or input)
    const promptInput = container.querySelector('textarea, input[type="text"]');
    expect(promptInput).not.toBeNull();
    promptInput.value = 'Cinematic restaurant brand film';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Find generate button (the one with 'Generate' text)
    const genBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Generate'));
    expect(genBtn).not.toBeNull();
    
    // Click generate without upload - should block
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    genBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(alertMock).toHaveBeenCalledWith('Please upload an image before generating.');
    alertMock.mockRestore();
  });

  it('Niche T2V: prompt-only template renders without image upload', async () => {
    mountTemplateStudio('midnight_table_film');

    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify prompt input exists
    const promptInput = container.querySelector('textarea, input[type="text"]');
    expect(promptInput).not.toBeNull();

    // Verify no image upload input
    const imageUpload = container.querySelector('input[type="file"]');
    expect(imageUpload).toBeNull();
  });

  it('Standard T2I: prompt-only template renders without image upload', async () => {
    mountTemplateStudio('youtube-thumbnail');

    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify prompt input exists
    const promptInput = container.querySelector('textarea, input[type="text"]');
    expect(promptInput).not.toBeNull();

    // Verify no image upload input
    const imageUpload = container.querySelector('input[type="file"]');
    expect(imageUpload).toBeNull();
  });

  it('Movie Poster T2I: text-only template renders without image upload', async () => {
    mountTemplateStudio('movie-poster');

    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify prompt input exists (movie poster uses text inputs, not textarea)
    const promptInput = container.querySelector('input[type="text"]');
    expect(promptInput).not.toBeNull();

    // Verify no image upload input
    const imageUpload = container.querySelector('input[type="file"]');
    expect(imageUpload).toBeNull();
  });

  it('component includes model picker button', async () => {
    mountTemplateStudio('restaurant-brand-film');
    await new Promise(resolve => setTimeout(resolve, 100));

    // The model picker button should exist
    const modelBtn = container.querySelector('#templateModelTrigger');
    expect(modelBtn).not.toBeNull();
  });
});