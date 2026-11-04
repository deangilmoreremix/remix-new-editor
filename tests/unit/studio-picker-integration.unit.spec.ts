import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/dom';
import { ImageStudio } from '../../src/components/ImageStudio.js';
import { VideoStudio } from '../../src/components/VideoStudio.js';

// The studios mount upstream Open-Generative-AI's own ModelDropdown (React,
// copied into src/components/upstream-picker) inside a fixed host.

function mount(factory) {
  const ret = factory();
  const p = ret && typeof ret.then === 'function' ? ret : Promise.resolve(ret);
  return p.then((container) => { document.body.appendChild(container); });
}

const tabLabels = (host) =>
  [...host.querySelectorAll('button')]
    .filter((b) => /rounded-lg px-2\.5/.test(b.className))
    .map((b) => b.textContent.trim());

const modelRows = (host) =>
  [...host.querySelectorAll('.cursor-pointer')].filter((r) => r.querySelector('span.tracking-tight'));

function expectPicker() {
  const host = document.querySelector('.upstream-model-picker');
  expect(host, 'upstream model picker not rendered').not.toBeNull();
  expect(host.textContent, 'MODEL header').toContain('Model');
  expect(host.querySelector('[title="All Providers"]'), 'All Providers rail item').not.toBeNull();
  expect(host.querySelector('input[type="text"]'), 'search box').not.toBeNull();
  expect(modelRows(host).length, 'model entries').toBeGreaterThan(1);
  return host;
}

async function pickRowAndExpectClosed(host, labelId) {
  const row = modelRows(host)[1];
  await fireEvent.click(row);
  const label = document.getElementById(labelId);
  expect(label.textContent.trim()).not.toBe('');
  // The host unmounts on the next tick after the pick.
  await new Promise((r) => setTimeout(r, 50));
  expect(document.querySelector('.upstream-model-picker')).toBeNull();
}

beforeEach(() => {
  document.body.innerHTML = '';
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {};
});
afterEach(() => { document.body.innerHTML = ''; });

describe('ImageStudio upstream model picker', () => {
  it('opens the split-pane picker with upstream tabs, and selects a model', async () => {
    await mount(ImageStudio);
    const btn = document.getElementById('model-btn');
    expect(btn).not.toBeNull();
    await fireEvent.click(btn);

    const host = expectPicker();
    expect(tabLabels(host)).toEqual(['All', 'Text to Image', 'Image to Image']);
    await pickRowAndExpectClosed(host, 'model-btn-label');
  }, 30000);
});

describe('VideoStudio upstream model picker', () => {
  it('opens the split-pane picker with upstream T2V/I2V/Video Tools tabs, and selects a model', async () => {
    await mount(VideoStudio);
    const btn = document.getElementById('v-model-btn');
    expect(btn).not.toBeNull();
    await fireEvent.click(btn);

    const host = expectPicker();
    expect(tabLabels(host)).toEqual(['All', 'Text to Video', 'Image to Video', 'Video Tools']);
    await pickRowAndExpectClosed(host, 'v-model-btn-label');
  }, 30000);
});
