// @vitest-environment jsdom
// Edit Studio embed mode: the no-spend live preview shown inside the Edit Studio guide page.
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/muapi.js', () => ({
  muapi: {
    generateI2I: vi.fn(async () => ({ url: 'https://cdn.muapi.ai/result.png' })),
    generateI2V: vi.fn(async () => ({ url: 'https://cdn.muapi.ai/result.mp4' })),
    processV2V: vi.fn(async () => ({ url: 'https://cdn.muapi.ai/swapped.mp4' })),
    calculateDynamicCost: vi.fn(async () => ({ cost: 0.07 })),
  },
}));
vi.mock('../lib/generationHistory.js', () => ({ registerGeneration: vi.fn() }));
vi.mock('../lib/studioChrome.js', () => ({ mountStudioChrome: vi.fn() }));
vi.mock('../components/AuthModal.js', () => ({ AuthModal: vi.fn() }));
vi.mock('../components/personalize/personalizePopover.js', () => ({ replaceTokensInPrompt: (text) => text }));
vi.mock('../lib/attachmentToolbar.js', () => ({ createAttachmentToolbar: vi.fn(() => ({})) }));
vi.mock('../lib/loading.js', () => ({ showToast: vi.fn() }));
vi.mock('../lib/thumbnails.js', () => ({
  getToolThumbnail: (id) => `/thumbnails/tools/${id}.webp`,
  createThumbnailImg: (src, alt) => Object.assign(document.createElement('img'), { src, alt }),
  createStudioHeader: (_id, title, subtitle) => {
    const el = document.createElement('div');
    el.innerHTML = '<h2></h2><p></p>';
    el.querySelector('h2').textContent = title;
    el.querySelector('p').textContent = subtitle;
    return el;
  },
}));
const pickers = [];
vi.mock('../components/UploadPicker.js', () => ({
  createUploadPicker: vi.fn((opts) => {
    const picker = { opts, trigger: document.createElement('button'), panel: document.createElement('div'), reset: vi.fn(), setMaxImages: vi.fn() };
    pickers.push(picker);
    return picker;
  }),
}));
vi.mock('../lib/muapiStudioMedia.js', () => ({
  resolveMuapiMediaRef: vi.fn(async (ref) => ref.url),
  resolveMuapiMediaRefs: vi.fn(async (refs) => refs.map((ref) => ref.url)),
  ingestStudioUpload: vi.fn(),
}));

import { EditStudio } from '../components/EditStudio.js';
import { EDIT_APPS } from '../lib/muapiEditApps.js';
import { muapi } from '../lib/muapi.js';
import { registerGeneration } from '../lib/generationHistory.js';
import { AuthModal } from '../components/AuthModal.js';


const SLUG = EDIT_APPS[0].slug;

function mountEmbed(slug = SLUG) {
  window.history.replaceState(null, '', `/edit-preview?tool=${slug}`);
  const el = EditStudio({ embed: true });
  document.body.innerHTML = '';
  document.body.appendChild(el);
  return el;
}
const button = (el, re) => [...el.querySelectorAll('button')].find((b) => re.test(b.textContent.trim()));

beforeEach(() => {
  localStorage.removeItem('muapi_key');
  for (const fn of [muapi.generateI2I, muapi.generateI2V, muapi.processV2V, muapi.calculateDynamicCost, registerGeneration, AuthModal]) fn.mockClear();
});

describe('Edit Studio embed (guide preview)', () => {
  test('opens the requested app with its real controls and price', () => {
    const el = mountEmbed();
    expect(el.dataset.embed).toBe('true');
    expect(el.querySelector('[data-edit-view="studio"]')?.classList.contains('hidden')).toBe(false);
    expect(button(el, /^Generate/)?.textContent).toMatch(/\$/); // the default price shows on the button
  });

  test('hides the way back to the gallery and the tool switcher', () => {
    const el = mountEmbed();
    expect(button(el, /All tools/).classList.contains('hidden')).toBe(true);
  });

  test('Generate never generates and never asks to sign in', () => {
    const el = mountEmbed();
    button(el, /^Generate/).click();
    expect(muapi.generateI2I).not.toHaveBeenCalled();
    expect(muapi.generateI2V).not.toHaveBeenCalled();
    expect(muapi.processV2V).not.toHaveBeenCalled();
    expect(AuthModal).not.toHaveBeenCalled();
    expect(registerGeneration).not.toHaveBeenCalled();
    expect(el.querySelector('[data-embed-note]').classList.contains('hidden')).toBe(false);
  });

  test('links to the real studio for the open app', () => {
    const el = mountEmbed();
    expect(el.querySelector('[data-embed-open]').getAttribute('href')).toBe(`/?tool=${SLUG}#/edit`);
  });

  test('does not call the pricing proxy', async () => {
    mountEmbed();
    await new Promise((r) => setTimeout(r, 500));
    expect(muapi.calculateDynamicCost).not.toHaveBeenCalled();
  });

  test('the normal studio is unchanged: no note, still asks for a key', () => {
    window.history.replaceState(null, '', `/?tool=${SLUG}#/edit`);
    const el = EditStudio();
    document.body.innerHTML = '';
    document.body.appendChild(el);
    expect(el.dataset.embed).toBeUndefined();
    expect(el.querySelector('[data-embed-note]')).toBeNull();
  });
});
