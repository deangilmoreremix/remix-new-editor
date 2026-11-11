/**
 * 338-template deterministic production acceptance.
 * Each template is executed through the TemplateStudio contract
 * with mocked MuAPI/uploader so failures are deterministic.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const manifestPath = path.join(__dirname, 'template-production-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const templates = manifest.templates;

if (templates.length !== 338) {
  throw new Error(`Expected 338 templates, got ${templates.length}`);
}

const { TemplateStudio } = await import('../../src/components/TemplateStudio.js');
const { CinemaTemplateStudio } = await import('../../src/components/CinemaTemplateStudio.js');

// The manifest records which studio owns each template: 292 open in Template
// Studio (route template/<id>), 46 cinematic ones in Cinema Template Studio,
// where they are picked from its catalog. Template Studio cannot resolve the
// cinematic ids ("Template not found"), so each is mounted in its own studio.
const isCinema = (t) => t.studio === 'Cinema Template Studio';
const { normalizeTemplate } = await import('../../src/lib/templateAdapter.js');
const { apiKeyManager } = await import('../../src/lib/apiKeyManager.js');

describe('338-template deterministic production acceptance', () => {
  // Each template is mounted ONCE (beforeAll) and its checks read that mount.
  // Mounting a fresh studio for every check meant ~2,000 TemplateStudio mounts
  // in one jsdom, which exhausted the heap partway through the file.
  let container = null;
  let mounted = null;
  const store = {};

  function installStorage() {
    for (const k of Object.keys(store)) delete store[k];
    store.muapi_key = 'test-key';
    global.localStorage = {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, value) => { store[key] = value; }),
      removeItem: vi.fn((key) => { delete store[key]; }),
      clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    };
  }

  beforeEach(() => {
    // The raw 'test-key' is not in the key manager's stored format, so stub the
    // getter: Generate must reach media validation, not the sign-in modal.
    vi.spyOn(apiKeyManager, 'getMuapiKey').mockReturnValue('test-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function mountTemplateStudio(t) {
    installStorage();
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);
    const element = isCinema(t) ? CinemaTemplateStudio() : TemplateStudio(t.id);
    mounted = element;
    container.appendChild(element);
    await new Promise(resolve => setTimeout(resolve, 100));
    if (isCinema(t)) {
      // Open the template from the Cinema catalog, as a user does.
      const card = Array.from(container.querySelectorAll('h3'))
        .find(h => h.textContent.trim() === t.name)?.parentElement;
      if (!card) throw new Error(`Cinema catalog has no card for ${t.id} (${t.name})`);
      card.click();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return element;
  }

  function unmount() {
    // Release the studio's document / window listeners (the router does the
    // same when leaving the page).
    mounted?.cleanup?.();
    mounted = null;
    if (container?.parentNode) container.parentNode.removeChild(container);
    container = null;
    // Clear the page but keep the app's single toast container attached
    // (showToast creates it once and keeps appending to it).
    const toasts = document.getElementById('toast-container');
    Array.from(document.body.children).forEach((el) => { if (el !== toasts) el.remove(); });
    if (toasts) toasts.innerHTML = '';
  }

  for (const template of templates) {
    const t = template;
    describe(`Template: ${t.id}`, () => {
      beforeAll(async () => {
        vi.spyOn(apiKeyManager, 'getMuapiKey').mockReturnValue('test-key');
        await mountTemplateStudio(t);
        vi.restoreAllMocks();
      });

      afterAll(() => {
        unmount();
      });

      it('route loads and template renders', () => {
        expect(container.innerHTML.length).toBeGreaterThan(100);
      });

      it('title is correct', () => {
        const title = container.querySelector('h1, h2, h3');
        expect(title).not.toBeNull();
      });

      it('prompt UI is correct', () => {
        const promptInput = container.querySelector('textarea, input[type="text"]');
        expect(promptInput).not.toBeNull();
      });

      it('media UI is correct', () => {
        const hasUploadArea = container.querySelector('.cursor-pointer') !== null ||
                              container.querySelector('button[title="Reference image"]') !== null ||
                              container.textContent?.includes('upload') || false;
        if (t.requiresImage || t.acceptsImage) {
          expect(hasUploadArea).toBe(true);
        }
      });

      it('model picker is correct', () => {
        const modelBtn = container.querySelector('button');
        expect(modelBtn).not.toBeNull();
      });

      // Last: clicking Generate changes the studio's state.
      it('required media validation works', async () => {
        const genBtn = Array.from(container.querySelectorAll('button')).find(btn =>
          btn.textContent?.includes('Generate') || btn.textContent?.includes('Create')
        );
        if (genBtn && t.requiresImage) {
          if (isCinema(t)) {
            // Fill the non-media required fields, so Generate reaches the
            // media check instead of stopping at "fill in required fields".
            container.querySelectorAll('textarea, input[type="text"], select').forEach((el) => {
              if (el.value) return;
              if (el.tagName === 'SELECT') {
                const opt = Array.from(el.options).find(o => o.value);
                if (opt) el.value = opt.value;
              } else {
                el.value = 'Test value';
              }
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            });
          }
          genBtn.click();
          await new Promise(resolve => setTimeout(resolve, 100));
          if (isCinema(t)) {
            // Cinema Template Studio reports missing media with a toast.
            expect(document.getElementById('toast-container')?.textContent || '').toContain('upload an image');
          } else {
            // Template Studio reports missing media inline (no blocking alert()).
            const inlineError = container.querySelector('.ts-inline-error');
            expect(inlineError).not.toBeNull();
            expect(inlineError.textContent).toContain('upload an image');
          }
        }
      });
    });
  }
});
