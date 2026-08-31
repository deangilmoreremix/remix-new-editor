// Tests for DOM Personalization Studio canvas behavior.
//
// These focus on the bug-shape that made the whole canvas unusable:
// selection/drag/resize must not destroy and recreate live DOM nodes,
// and the studio must still render the core layout even if personalization
// dependencies are unavailable.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map();
const localStorageStub = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub });

const toastCalls = [];
vi.mock('../lib/studioChrome.js', () => ({
  mountStudioChrome: (container) => {
    const el = document.createElement('div');
    el.innerHTML = '<div class="studio-chrome">chrome</div>';
    container.appendChild(el);
  },
}));
vi.mock('../lib/loading.js', () => ({
  showToast: (...args) => {
    toastCalls.push(args);
  },
}));

vi.mock('./personalize/personalizePopover.js', () => ({
  mountPersonalizeTrigger: vi.fn(),
  replaceTokensInPrompt: (text) => text,
  inspectPromptTokens: () => ({ resolved: [], unresolved: [] }),
  getSelectedContactId: () => null,
  setSelectedContactId: () => {},
}));
vi.mock('./personalize/tokenSchema.js', () => ({
  TOKEN_KEYS: ['firstName', 'lastName', 'company'],
  TOKEN_LABELS: { firstName: 'First Name', lastName: 'Last Name', company: 'Company' },
  buildVariables: () => ({}),
}));
vi.mock('../lib/contactStore.js', () => ({
  getActiveProfile: () => null,
  listProfiles: () => [],
}));

const { Personalizer } = await import('../components/Personalizer.js');

function mountStudio() {
  const container = document.createElement('div');
  container.appendChild(Personalizer());
  document.body.appendChild(container);
  return container;
}

function findPaletteButton(container, type) {
  return Array.from(container.querySelectorAll('button')).find((btn) => btn.dataset.type === type);
}

describe('Personalizer', () => {
  beforeEach(() => {
    localStorageStub.clear();
    toastCalls.length = 0;
    document.body.innerHTML = '';
  });

  it('renders the studio shell, sidebar, canvas and properties panel', () => {
    const container = mountStudio();
    expect(container.querySelector('.personalizer-studio')).toBeTruthy();
    expect(container.querySelector('.dom-sidebar')).toBeTruthy();
    expect(container.querySelector('.dom-canvas')).toBeTruthy();
    expect(container.querySelector('.dom-properties-panel')).toBeTruthy();
  });

  it('adds an element to the canvas without tearing down existing nodes', () => {
    const container = mountStudio();
    const textBtn = findPaletteButton(container, 'text');
    expect(textBtn, 'text palette button should exist').toBeTruthy();

    textBtn.click();
    const wrapper = container.querySelector('.dom-element-wrapper');
    expect(wrapper).toBeTruthy();
    expect(wrapper.style.left).toBe('20%');
    expect(wrapper.style.top).toBe('20%');
  });

  it('updates the properties panel when an element is selected', () => {
    const container = mountStudio();
    const textBtn = findPaletteButton(container, 'text');
    textBtn.click();

    const wrapper = container.querySelector('.dom-element-wrapper');
    expect(wrapper, 'canvas wrapper should exist after adding text').toBeTruthy();
    wrapper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    const props = container.querySelector('.dom-properties-panel');
    expect(props, 'properties panel should exist').toBeTruthy();
    const inputs = Array.from(props.querySelectorAll('input'));
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.some((input) => input.type === 'number')).toBe(true);
  });

  it('keeps canvas nodes alive while properties change', () => {
    const container = mountStudio();
    const textBtn = findPaletteButton(container, 'text');
    textBtn.click();

    const wrapperBefore = container.querySelector('.dom-element-wrapper');
    expect(wrapperBefore, 'canvas wrapper should exist after adding text').toBeTruthy();
    wrapperBefore.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    const textInput = Array.from(container.querySelectorAll('input')).find((input) => input.value === 'Double-click to edit text. Use {{token}} for personalization.');
    expect(textInput, 'text input should exist in properties panel').toBeTruthy();

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(textInput, 'Hello World');
    textInput.dispatchEvent(new Event('input', { bubbles: true }));

    const wrapperAfter = container.querySelector('.dom-element-wrapper');
    expect(wrapperAfter, 'canvas wrapper should still exist after property change').toBeTruthy();
    expect(wrapperAfter).toBe(wrapperBefore);
  });

  it('persists and restores canvas state from localStorage', () => {
    const container = mountStudio();
    const textBtn = findPaletteButton(container, 'text');
    textBtn.click();

    const saveBtn = Array.from(container.querySelectorAll('button')).find((btn) => (btn.innerText || '').includes('Save Canvas'));
    expect(saveBtn).toBeTruthy();
    saveBtn.click();

    expect(localStorage.getItem('personalizer-canvas')).toBeTruthy();

    const freshContainer = mountStudio();
    const loadBtn = Array.from(freshContainer.querySelectorAll('button')).find((btn) => (btn.innerText || '').includes('Load Canvas'));
    expect(loadBtn).toBeTruthy();
    loadBtn.click();

    const wrapper = freshContainer.querySelector('.dom-element-wrapper');
    expect(wrapper).toBeTruthy();
  });

  it('marks palette buttons draggable for canvas drop', () => {
    const container = mountStudio();
    const textBtn = findPaletteButton(container, 'text');
    expect(textBtn).toBeTruthy();
    expect(textBtn.getAttribute('draggable')).toBe('true');
  });

  it('applies font family, font weight, and font size changes to text elements', () => {
    const container = mountStudio();
    const textBtn = findPaletteButton(container, 'text');
    textBtn.click();

    const wrapper = container.querySelector('.dom-element-wrapper');
    wrapper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    const props = container.querySelector('.dom-properties-panel');
    const inputs = Array.from(props.querySelectorAll('input'));

    const fontFamilyInput = inputs.find((input) => input.value === 'Inter, sans-serif');
    expect(fontFamilyInput, 'font family input should exist').toBeTruthy();

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(fontFamilyInput, 'Arial, sans-serif');
    fontFamilyInput.dispatchEvent(new Event('input', { bubbles: true }));

    const contentEl = wrapper.firstElementChild;
    expect(contentEl, 'text element should exist on canvas').toBeTruthy();
    expect(contentEl.style.fontFamily).toBe('Arial, sans-serif');
  });

  it('inserts text token without breaking spacing', () => {
    const container = mountStudio();
    const textBtn = findPaletteButton(container, 'text');
    textBtn.click();

    const wrapper = container.querySelector('.dom-element-wrapper');
    wrapper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    const tokenBtn = Array.from(container.querySelectorAll('button')).find((btn) => btn.innerText === '{{firstName}}');
    expect(tokenBtn).toBeTruthy();
    tokenBtn.click();

    const expectedText = 'Double-click to edit text. Use {{token}} for personalization. {{firstName}}';
    const textInput = Array.from(container.querySelectorAll('input')).find((input) => input.value === expectedText);
    expect(textInput, 'text input should contain token with spacing').toBeTruthy();
  });

  it('inserts image src token without leading whitespace', () => {
    const container = mountStudio();
    const imageBtn = findPaletteButton(container, 'image');
    imageBtn.click();

    const wrapper = container.querySelector('.dom-element-wrapper');
    wrapper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    const tokenBtn = Array.from(container.querySelectorAll('button')).find((btn) => btn.innerText === '{{logoUrl}}');
    expect(tokenBtn).toBeTruthy();
    tokenBtn.click();

    const srcInput = Array.from(container.querySelectorAll('input')).find((input) => input.value === '{{logoUrl}}');
    expect(srcInput, 'source url input should contain token without leading whitespace').toBeTruthy();
    expect(srcInput.value.startsWith(' ')).toBe(false);
  });

  it('keeps preview non-destructive for text tokens', () => {
    const container = mountStudio();
    const textBtn = findPaletteButton(container, 'text');
    textBtn.click();

    const wrapper = container.querySelector('.dom-element-wrapper');
    const contentEl = wrapper.firstElementChild;
    expect(contentEl, 'text element should exist on canvas before preview').toBeTruthy();
    const originalText = contentEl.innerText;

    const previewBtn = Array.from(container.querySelectorAll('button')).find((btn) => btn.innerText === 'Preview Personalized');
    previewBtn.click();

    expect(contentEl.contentEditable).toBe('false');

    wrapper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(contentEl.contentEditable).toBe('true');
    expect(contentEl.innerText).toBe(originalText);
  });
});
