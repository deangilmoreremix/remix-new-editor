import { describe, it, expect } from 'vitest';
import { rememberPictureLabel, fillAlts, withAltFill } from '../editor/altFill.js';

describe('alt text from the picture', () => {
  it('fills an empty alt for a chosen picture', () => {
    rememberPictureLabel('https://x.test/a.png', 'A red bicycle on a beach');
    expect(fillAlts({ image: 'https://x.test/a.png', alt: '' }).alt).toBe('A red bicycle on a beach');
    expect(fillAlts({ logo: 'https://x.test/a.png' }).logoAlt).toBe('A red bicycle on a beach');
  });
  it('never overwrites an alt you typed', () => {
    rememberPictureLabel('https://x.test/b.png', 'Prompt');
    const p = { image: 'https://x.test/b.png', alt: 'Mine' };
    expect(fillAlts(p)).toBe(p);
  });
  it('does nothing without a remembered label', () => {
    const p = { image: 'https://x.test/unknown.png', alt: '' };
    expect(fillAlts(p)).toBe(p);
  });
  it('fills inside list items', () => {
    rememberPictureLabel('https://x.test/c.png', 'Face of Sam');
    const out = fillAlts({ quotes: [{ avatar: 'https://x.test/c.png', avatarAlt: '' }, { name: 'n' }] });
    expect(out.quotes[0].avatarAlt).toBe('Face of Sam');
  });
  it('wires resolveData on every component', async () => {
    rememberPictureLabel('https://x.test/d.png', 'Team photo');
    const comps = { A: {}, B: { resolveData: (d) => d } };
    withAltFill(comps);
    const r = await comps.B.resolveData({ props: { src: 'https://x.test/d.png', alt: '' } }, {});
    expect(r.props.alt).toBe('Team photo');
  });
});
