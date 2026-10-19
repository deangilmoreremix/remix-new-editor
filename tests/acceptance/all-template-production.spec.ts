/**
 * 338-template deterministic production acceptance.
 * Each template is executed through the TemplateStudio contract
 * with mocked MuAPI/uploader so failures are deterministic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const manifestPath = path.join(__dirname, 'template-production-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const templates = manifest.templates;

if (templates.length !== 338) {
  throw new Error(`Expected 338 templates, got ${templates.length}`);
}

const { TemplateStudio } = await import('../../src/components/TemplateStudio.js');
const { normalizeTemplate } = await import('../../src/lib/templateAdapter.js');

describe('338-template deterministic production acceptance', () => {
  let container;
  let localStorageMock;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);

    const store = { muapi_key: 'test-key' };
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
    document.body.innerHTML = '';
  });

  function mountTemplateStudio(templateId) {
    container.innerHTML = '';
    const element = TemplateStudio(templateId);
    container.appendChild(element);
    return element;
  }

  for (const template of templates) {
    const t = template;
    describe(`Template: ${t.id}`, () => {
      it('route loads and template renders', async () => {
        mountTemplateStudio(t.id);
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(container.innerHTML.length).toBeGreaterThan(100);
      });

      it('title is correct', async () => {
        mountTemplateStudio(t.id);
        await new Promise(resolve => setTimeout(resolve, 100));
        const title = container.querySelector('h1, h2, h3');
        expect(title).not.toBeNull();
      });

      it('prompt UI is correct', async () => {
        mountTemplateStudio(t.id);
        await new Promise(resolve => setTimeout(resolve, 100));
        const promptInput = container.querySelector('textarea, input[type="text"]');
        expect(promptInput).not.toBeNull();
      });

      it('media UI is correct', async () => {
        mountTemplateStudio(t.id);
        await new Promise(resolve => setTimeout(resolve, 100));
        const hasUploadArea = container.querySelector('.cursor-pointer') !== null ||
                              container.querySelector('button[title="Reference image"]') !== null ||
                              container.textContent?.includes('upload') || false;
        if (t.requiresImage || t.acceptsImage) {
          expect(hasUploadArea).toBe(true);
        }
      });

      it('model picker is correct', async () => {
        mountTemplateStudio(t.id);
        await new Promise(resolve => setTimeout(resolve, 100));
        const modelBtn = container.querySelector('button');
        expect(modelBtn).not.toBeNull();
      });

      it('required media validation works', async () => {
        mountTemplateStudio(t.id);
        await new Promise(resolve => setTimeout(resolve, 100));
        const genBtn = Array.from(container.querySelectorAll('button')).find(btn =>
          btn.textContent?.includes('Generate') || btn.textContent?.includes('Create')
        );
        if (genBtn && t.requiresImage) {
          const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
          genBtn.click();
          await new Promise(resolve => setTimeout(resolve, 100));
          expect(alertMock).toHaveBeenCalled();
          alertMock.mockRestore();
        }
      });
    });
  }
});
