import { describe, it, expect, vi } from 'vitest';
import { pageStyleHint, describeStyle } from '../editor/styleHint.js';
import { EDITABLE_TEMPLATES } from '../editor/designs.js';
import { kindOfField, shapeForKind, shapeForLabel, promptForField, makeImages } from '../aiImageModal.js';

describe('the page\'s look for the AI buttons', () => {
  it('reads accent, background and text, and whether the page is dark', () => {
    expect(pageStyleHint({ props: { accent: '#22d3ee', background: '#05070d', text: '#f8fafc', design: 'neon' } })).toEqual({ accent: '#22d3ee', background: '#05070d', text: '#f8fafc', dark: true, design: 'neon' });
    expect(pageStyleHint({ accent: '#2563eb', background: '#ffffff' }).dark).toBe(false);
  });
  it('falls back safely on missing or bad values', () => {
    expect(pageStyleHint(undefined)).toMatchObject({ accent: '#2563eb', background: '#ffffff', text: '#0f172a', dark: false, design: 'clean' });
    expect(pageStyleHint({ props: { accent: 'red', background: 'url(x)', design: '"><script>' } })).toMatchObject({ accent: '#2563eb', background: '#ffffff', design: 'script' });
  });
  it('describes it in plain words for a prompt', () => {
    expect(describeStyle(pageStyleHint({ props: { accent: '#d9ff00', background: '#0a0a0a', text: '#ffffff' } }))).toBe('dark page (background #0a0a0a, text #ffffff) with accent colour #d9ff00');
    expect(describeStyle(null)).toBe('');
  });
  it('the real designs include both dark and light pages, each with a valid palette', () => {
    const looks = EDITABLE_TEMPLATES.map((t) => pageStyleHint(t.editorData?.root));
    expect(looks.length).toBeGreaterThan(50);
    expect(looks.some((l) => l.dark)).toBe(true);
    expect(looks.some((l) => !l.dark)).toBe(true);
    looks.forEach((l) => { expect(l.accent).toMatch(/^#[0-9a-f]{6}$/); expect(l.background).toMatch(/^#[0-9a-f]{6}$/); });
  });
});

describe('pictures that suit their slot', () => {
  it('knows what kind of picture a field takes', () => {
    expect(kindOfField('Portrait (https link or /landing-art path)')).toBe('face');
    expect(kindOfField('Footer logo (https link)')).toBe('logo');
    expect(kindOfField('Placeholder image before the video plays')).toBe('poster');
    expect(kindOfField('Section background photo (https link)')).toBe('background');
    expect(kindOfField('Chart image link')).toBe('screen');
    expect(kindOfField('Photo (https link)')).toBe('photo');
  });
  it('faces and logos are square, the rest wide, unless the field says tall', () => {
    expect(shapeForKind('face')).toBe('1:1'); expect(shapeForKind('logo')).toBe('1:1'); expect(shapeForKind('poster')).toBe('16:9');
    expect(shapeForLabel('Phone story picture')).toBe('9:16');
  });
  it('the prompt carries the slot\'s guidance and the page\'s palette and mood', () => {
    const style = pageStyleHint({ props: { accent: '#d9ff00', background: '#0a0a0a', text: '#ffffff' } });
    const face = promptForField({ label: 'Portrait', pageTitle: 'Reno Plumbing', brief: 'family plumber', style });
    expect(face).toMatch(/centred.*small circle/); expect(face).toContain('Match this page: dark page'); expect(face).toContain('#d9ff00'); expect(face).toContain('Reno Plumbing — family plumber');
    expect(promptForField({ label: 'Footer logo' })).toMatch(/simple, bold logo mark/);
    expect(promptForField({ label: 'Placeholder image before the video plays' })).toMatch(/play button/);
    expect(promptForField({ label: 'Section background photo' })).toMatch(/text placed on top stays easy to read/);
    expect(promptForField({ label: 'Photo' })).not.toContain('Match this page');
    expect(promptForField({ label: 'Photo' })).not.toMatch(/\s{2,}| \./);
  });
  it('logos ask for a transparent background; others do not', async () => {
    const generate = vi.fn(async () => ({ ok: true, assets: [{ url: 'data:image/png;base64,AAAA', model: 'gpt-image-2.6-flare' }] }));
    await makeImages({ prompt: 'x', transparent: true }, { generate });
    expect(generate).toHaveBeenLastCalledWith(expect.objectContaining({ background: 'transparent' }));
    await makeImages({ prompt: 'x' }, { generate });
    expect(generate.mock.calls.at(-1)[0].background).toBeUndefined();
  });
});
