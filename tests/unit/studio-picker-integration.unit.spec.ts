import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/dom';
import { ImageStudio } from '../../src/components/ImageStudio.js';
import { VideoStudio } from '../../src/components/VideoStudio.js';

function mount(factory) {
  const ret = factory();
  const p = ret && typeof ret.then === 'function' ? ret : Promise.resolve(ret);
  return p.then((container) => { document.body.appendChild(container); });
}

function expectPicker(root = document.body) {
  const panel = root.querySelector('.model-picker-dropdown');
  expect(panel, 'model-picker-dropdown not rendered').not.toBeNull();
  expect(panel.querySelector('[data-provider="all"]'), 'All Providers sidebar item').not.toBeNull();
  expect(panel.querySelectorAll('[data-provider]').length).toBeGreaterThan(1);
  expect(panel.querySelector('input[type="text"]'), 'search box').not.toBeNull();
  expect(panel.querySelector('[data-category]'), 'category tab').not.toBeNull();
  expect(panel.querySelector('[data-entry-id]'), 'model entry').not.toBeNull();
  return panel;
}

describe('ImageStudio upstream model picker', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('opens split-pane picker with sidebar/search/categories/entries, and selects a model', async () => {
    await mount(ImageStudio);
    const btn = document.getElementById('model-btn');
    expect(btn).not.toBeNull();
    await fireEvent.click(btn);

    const panel = expectPicker();
    const firstEntry = panel.querySelector('[data-entry-id]');
    const name = (firstEntry.textContent || '').trim();
    expect(name).not.toBe('');

    await fireEvent.click(firstEntry);
    const label = document.getElementById('model-btn-label');
    expect(label.textContent).not.toBe('');
    // Rich picker removes its portal after its 200ms close animation.
    await new Promise((r) => setTimeout(r, 260));
    expect(document.querySelector('.model-picker-dropdown')).toBeNull();
  }, 30000);
});

describe('VideoStudio upstream model picker', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('opens split-pane picker with T2V/I2V/V2V categories; selecting updates label', async () => {
    await mount(VideoStudio);
    const btn = document.getElementById('v-model-btn');
    expect(btn).not.toBeNull();
    await fireEvent.click(btn);

    expectPicker();
    const cats = [...document.body.querySelectorAll('[data-category]')].map((c) => c.getAttribute('data-category'));
    expect(cats).toEqual(expect.arrayContaining(['t2v', 'i2v', 'v2v']));

    const panel = document.body.querySelector('.model-picker-dropdown');
    const firstEntry = panel.querySelector('[data-entry-id]');
    const name = (firstEntry.textContent || '').trim();
    await fireEvent.click(firstEntry);
    const label = document.getElementById('v-model-btn-label');
    expect(label.textContent).not.toBe('');
    await new Promise((r) => setTimeout(r, 260));
    expect(document.querySelector('.model-picker-dropdown')).toBeNull();
  }, 30000);
});
