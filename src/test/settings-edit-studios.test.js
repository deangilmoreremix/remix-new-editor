// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsModal } from '../components/SettingsModal.js';
import { getFavorites } from '../lib/onboarding/store.js';

describe('Settings: Edit your studios', () => {
  beforeEach(() => { localStorage.clear(); document.body.innerHTML = ''; });

  it('lists every studio as a checkbox and writes ticks and unticks to the favorites', async () => {
    localStorage.setItem('smartvideo-app-onboarding-v1:guest', JSON.stringify({ step: 6, tools: ['image'], primaryTool: 'image' }));
    document.body.appendChild(SettingsModal());
    const box = document.querySelector('[data-edit-studios]');
    expect(box).not.toBeNull();
    box.open = true;
    box.dispatchEvent(new Event('toggle'));
    await new Promise((r) => setTimeout(r, 50));
    expect(box.querySelectorAll('input[data-edit-studio]')).toHaveLength(38);
    expect(box.querySelector('[data-edit-studio="image"]').checked).toBe(true);
    const video = box.querySelector('[data-edit-studio="video"]');
    video.checked = true; video.dispatchEvent(new Event('change'));
    expect(getFavorites('')).toEqual(['image', 'video']);
    const image = box.querySelector('[data-edit-studio="image"]');
    image.checked = false; image.dispatchEvent(new Event('change'));
    expect(getFavorites('')).toEqual(['video']);
  });
});
