// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ENGINES, shapeForLabel, promptForField, dataUrlToFile, persistImage, makeImages, openAiImageModal } from '../aiImageModal.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const flush = () => new Promise((r) => setTimeout(r, 0));
beforeEach(() => { document.body.innerHTML = ''; document.body.style.overflow = ''; });

describe('Images 2.6 for landing page pictures', () => {
  it('offers the two 2.6 engines, labelled like the personalization editor', () => {
    expect(ENGINES.draft).toEqual({ model: 'gpt-image-2.6-flare', label: 'Fast draft (2.6 Flare)' });
    expect(ENGINES.detail).toEqual({ model: 'gpt-image-2.6-sunburst', label: 'Detailed render (2.6 Sunburst)' });
  });

  it('picks a shape for the kind of picture', () => {
    expect(shapeForLabel('Screen-reader description of the face')).toBe('1:1');
    expect(shapeForLabel('Footer logo (https link)')).toBe('1:1');
    expect(shapeForLabel('Background photo (https link)')).toBe('16:9');
    expect(shapeForLabel('Phone story picture')).toBe('9:16');
  });

  it('starts from a prompt built from the field, the page and the business line', () => {
    const p = promptForField({ label: 'Portrait (https link)', pageTitle: 'Reno Plumbing', brief: 'family plumber' });
    expect(p).toContain('portrait'); expect(p).toContain('Reno Plumbing — family plumber'); expect(p).toMatch(/No text/);
    expect(promptForField({ label: 'Placeholder image before the video plays' })).toMatch(/press play/);
    expect(promptForField({ label: 'Logo' })).not.toContain(' for: ');
  });

  it('turns a data URL into a file, and refuses anything else', () => {
    const f = dataUrlToFile(PNG, 'x');
    expect(f.name).toBe('x.png'); expect(f.type).toBe('image/png'); expect(f.size).toBeGreaterThan(0);
    expect(dataUrlToFile('https://x.test/a.png')).toBeNull();
    expect(dataUrlToFile('javascript:alert(1)')).toBeNull();
  });

  it('saves a data URL to storage and returns the permanent https link; also keeps a library copy', async () => {
    const upload = vi.fn(async () => ({ url: 'https://cdn.test/u/ai.png' }));
    const save = vi.fn();
    const url = await persistImage({ url: PNG, prompt: 'A fox', model: 'gpt-image-2.6-flare' }, { upload, save });
    expect(url).toBe('https://cdn.test/u/ai.png');
    expect(upload.mock.calls[0][0]).toBeInstanceOf(File);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ url, type: 'image', prompt: 'A fox' }));
  });

  it('uses an already-hosted picture as is, and explains when it cannot save', async () => {
    expect(await persistImage({ url: 'https://cdn.test/a.png' }, {})).toBe('https://cdn.test/a.png');
    await expect(persistImage({ url: PNG }, {})).rejects.toThrow(/Sign in/);
    await expect(persistImage({ url: PNG }, { upload: async () => ({ url: 'http://x.test/a.png' }) })).rejects.toThrow(/could not be saved/);
    await expect(persistImage({ url: 'nonsense' }, { upload: vi.fn() })).rejects.toThrow(/could not be read/);
  });

  it('asks for Flare by default and Sunburst for the detailed engine', async () => {
    const generate = vi.fn(async () => ({ ok: true, assets: [{ url: PNG, model: 'gpt-image-2.6-sunburst' }] }));
    await makeImages({ prompt: 'x', engine: 'draft', shape: '1:1' }, { generate });
    expect(generate).toHaveBeenLastCalledWith(expect.objectContaining({ prompt: 'x', aspectRatio: '1:1', n: 2, model: undefined }));
    await makeImages({ prompt: 'x', engine: 'detail' }, { generate });
    expect(generate).toHaveBeenLastCalledWith(expect.objectContaining({ model: 'gpt-image-2.6-sunburst' }));
  });

  it('says so when the account fell back to GPT Image 2, and surfaces failures', async () => {
    const fell = await makeImages({ prompt: 'x' }, { generate: async () => ({ ok: true, assets: [{ url: PNG, model: 'gpt-image-2' }] }) });
    expect(fell.note).toMatch(/does not have Images 2\.6/);
    const fine = await makeImages({ prompt: 'x' }, { generate: async () => ({ ok: true, assets: [{ url: PNG, model: 'gpt-image-2.6-flare' }] }) });
    expect(fine.note).toBe('');
    await expect(makeImages({ prompt: 'x' }, { generate: async () => ({ ok: false, error: 'Images use your own OpenAI key.' }) })).rejects.toThrow(/own OpenAI key/);
    await expect(makeImages({ prompt: 'x' }, { generate: async () => ({ ok: true, assets: [] }) })).rejects.toThrow(/No picture/);
  });

  it('the modal: create, pick a result, get the https link back, and close', async () => {
    const generate = vi.fn(async () => ({ ok: true, assets: [{ url: PNG, model: 'gpt-image-2.6-flare' }, { url: PNG, model: 'gpt-image-2.6-flare' }] }));
    const upload = vi.fn(async () => ({ url: 'https://cdn.test/u/pick.png' }));
    const onUse = vi.fn(); const onClose = vi.fn();
    openAiImageModal({ label: 'Portrait (https link)', pageTitle: 'Reno Plumbing', brief: 'family plumber', onUse, onClose, deps: { generate, upload, save: vi.fn() } });
    const q = (s) => document.body.querySelector(s);
    expect(q('[data-ai-prompt]').value).toContain('Reno Plumbing — family plumber');
    expect(q('[data-ai-shape]').value).toBe('1:1');
    expect([...q('[data-ai-engine]').options].map((o) => o.textContent)).toEqual(['Fast draft (2.6 Flare)', 'Detailed render (2.6 Sunburst)']);
    q('[data-ai-go]').click(); await flush();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(document.body.querySelectorAll('[data-ai-use]')).toHaveLength(2);
    q('[data-ai-use]').click(); await flush(); await flush();
    expect(onUse).toHaveBeenCalledWith('https://cdn.test/u/pick.png', expect.objectContaining({ model: 'gpt-image-2.6-flare' }));
    expect(onClose).toHaveBeenCalled();
    expect(q('[data-ai-image-modal]')).toBeNull();
  });

  it('the modal shows a readable message and keeps the field alone when generation fails', async () => {
    const onUse = vi.fn();
    openAiImageModal({ label: 'Photo', onUse, deps: { generate: async () => ({ ok: false, error: 'Images use your own OpenAI key. Add it in Settings → API keys (OpenAI API Key).' }) } });
    document.body.querySelector('[data-ai-go]').click(); await flush();
    expect(document.body.querySelector('[data-ai-status]').textContent).toMatch(/own OpenAI key/);
    expect(onUse).not.toHaveBeenCalled();
  });

  it('Escape closes it and gives the page scrolling back', () => {
    document.body.style.overflow = 'auto';
    openAiImageModal({ label: 'Photo', deps: { generate: vi.fn() } });
    expect(document.body.style.overflow).toBe('hidden');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.body.querySelector('[data-ai-image-modal]')).toBeNull();
    expect(document.body.style.overflow).toBe('auto');
  });
});
