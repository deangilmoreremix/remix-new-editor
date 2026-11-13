// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getInstructionsSync } from '../lib/instructions.js';
import { STUDIO_LANDING_PAGES } from '../data/studioLandingPages.js';

// Help text must match what the studios really do (these were wrong before).
const text = (o) => JSON.stringify(o, (k, v) => (['gif', 'video', 'thumbnail'].includes(k) ? undefined : v)).replace(/Video Studio/g, '');

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (!['askKb', 'node_modules', 'test', '__tests__'].includes(f.name)) walk(p, out); }
    else if (/\.(js|jsx|ts|tsx)$/.test(f.name)) out.push(p);
  }
  return out;
}

describe('Edit Studio copy describes the real image tools', () => {
  const VIDEO_WORDS = /\b(video|footage|timeline|LUT|stabiliz\w*|inpaint\w*|relight\w*|MP4|WebM)\b/i;
  it('instructions do not claim video editing, inpaint or relight', () => {
    expect(text(getInstructionsSync('edit'))).not.toMatch(VIDEO_WORDS);
    expect(text(getInstructionsSync('edit'))).toContain('16 image tools');
  });
  it('landing page is about image editing', () => {
    const edit = STUDIO_LANDING_PAGES.edit;
    expect(text(edit)).not.toMatch(VIDEO_WORDS);
    expect(edit.heroTitle).toMatch(/Image Editing/);
    expect(edit.valueProp).toContain('Remove Object');
  });
});

describe('Effects Studio count', () => {
  it('says 200+, never 350+', () => {
    const offenders = walk('src').filter((f) => /350\+/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
    expect(text(getInstructionsSync('effects'))).toContain('200+');
    expect(text(getInstructionsSync('effects'))).not.toMatch(/under 30 seconds/);
  });
  it('the Apps hub card agrees', () => {
    const hub = fs.readFileSync('src/components/AppsHub.js', 'utf8');
    expect(hub).toContain("badge: '200+ effects'");
    expect(hub).toContain("badge: '16 tools'"); // Edit Studio has 16 tools, not 9
  });
});

describe('Upscale copy is image-only with the three real methods', () => {
  it('instructions name the real methods and no video / creative upscale / face enhancement', () => {
    const t = text(getInstructionsSync('upscale'));
    expect(t).toMatch(/AI Upscaler/);
    expect(t).toMatch(/Topaz/);
    expect(t).toMatch(/Seed Upscale/);
    expect(t).not.toMatch(/video|creative upscale|face enhancement/i);
  });
  it('the studio no longer asks for video', () => {
    const src = fs.readFileSync('src/components/UpscaleStudio.js', 'utf8');
    expect(src).toContain("'Upload an image to upscale'");
    expect(src).not.toMatch(/Upload (an )?image or video/);
  });
});

describe('Video Tools copy', () => {
  it('names real tools and has no unverifiable length claim', () => {
    const t = text(getInstructionsSync('videotools'));
    expect(t).not.toMatch(/under 30 seconds|interpolation|stabilization|color correction/);
    expect(t).toContain('Topaz Video Upscale');
  });
});

describe('Cinema Studio "Dolly Zoom" label', () => {
  const src = fs.readFileSync('src/components/CinemaStudio.js', 'utf8');
  it('uses the correct key', () => expect(src).toContain("'Dolly Zoom': 'Hitchcock dolly zoom"));
  it('does not keep the typo as a key', () => expect(src).not.toMatch(/'Dolly Zom':/));
  it('maps the old saved name when loading history so old projects keep their camera move', () => {
    expect(src).toMatch(/entry\.settings\.movement === 'Dolly Zom' \? 'Dolly Zoom'/);
  });
});

describe('assistant guides no longer describe the fixed bugs', () => {
  const kb = (n) => fs.readFileSync(`src/data/askKb/${n}.json`, 'utf8');
  it('no guide mentions the old Cinema spelling or the 350+ effects claim', () => {
    for (const f of fs.readdirSync('src/data/askKb')) {
      const t = fs.readFileSync(`src/data/askKb/${f}`, 'utf8');
      expect(t, f).not.toMatch(/Dolly Zom[^a-z]/);
      expect(t, f).not.toMatch(/350\+/);
    }
  });
  it('audio guide says Tone/Emotion/Pitch are not offered, not "stored but not sent"', () => {
    expect(kb('audio')).not.toMatch(/stored but do not|saved in the form but/);
    expect(kb('audio')).toMatch(/Describe the delivery|describe the delivery/);
  });
  it('image guide no longer says the studio selects AI Image Upscaler', () => {
    expect(kb('image')).not.toMatch(/first selects AI Image Upscaler|auto-selected AI Image Upscaler|picks the first image-to-image/);
  });
  it('brand guide no longer lists the fixed router / dropdown / Animate problems as unconfirmed', () => {
    expect(kb('brand')).not.toMatch(/may appear; this was not tested|plain \/animate address/);
  });
});
