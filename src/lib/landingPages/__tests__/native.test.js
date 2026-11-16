import { describe, it, expect, vi } from 'vitest';
import { renderLandingPage } from '../render.js';
import { defaultConfig, sanitizeConfig, prefillFor, moveItem, ctaHref, CTA_KINDS } from '../templates.js';

const VIDEO = 'https://x.supabase.co/storage/v1/object/public/uploads/u/clip.mp4';
const page = (config) => ({ id: 'abc12345', title: 'P', video_url: VIDEO, poster_url: null, duration: 60, config });
const q = (v, s) => v.root.querySelector(s);

describe('form prefill (names only, never email)', () => {
  it('builds a full name and passes company/role/city through', () => {
    expect(prefillFor('name', { firstname: 'Maya', lastname: 'Lee' })).toBe('Maya Lee');
    expect(prefillFor('name', { firstname: 'Maya' })).toBe('Maya');
    expect(prefillFor('name', {})).toBe('');
    expect(prefillFor('firstname', { firstname: ' Maya ' })).toBe('Maya');
    expect(prefillFor('company', { company: 'Brightline' })).toBe('Brightline');
  });

  it('never returns an email, or anything for unknown fields', () => {
    expect(prefillFor('email', { email: 'maya@brightline.com', firstname: 'Maya' })).toBe('');
    expect(prefillFor('phone', { phone: '555' })).toBe('');
    expect(prefillFor('message', { custom1: 'x' })).toBe('');
  });

  it('prefills the rendered form from the contact, leaving email and message empty', () => {
    const v = renderLandingPage({ page: page(defaultConfig('personal')), tokens: { firstname: 'Maya', lastname: 'Lee', company: 'Brightline', email: 'maya@brightline.com' } });
    expect(q(v, '[name=name]').value).toBe('Maya Lee');
    expect(q(v, '[name=email]').value).toBe('');
    expect(q(v, '[name=message]').value).toBe('');
    expect(v.root.innerHTML).not.toContain('maya@brightline.com');
  });

  it('shows empty fields when there is no contact', () => {
    const v = renderLandingPage({ page: page(defaultConfig('personal')), tokens: {} });
    expect(q(v, '[name=name]').value).toBe('');
  });
});

describe('"scroll to the lead form" button', () => {
  const cfg = (extra) => ({ ...defaultConfig('pitch'), form: { ...defaultConfig('sales').form, enabled: true }, ctas: [{ label: 'Talk to us', kind: 'form', value: '', style: 'primary' }], ...extra });

  it('is a known kind with no link', () => {
    expect(CTA_KINDS).toContain('form');
    expect(ctaHref('form', 'https://evil.com')).toBe('');
  });

  it('renders a button that scrolls to and focuses the form, and reports a click', () => {
    const onCta = vi.fn();
    const v = renderLandingPage({ page: page(cfg()), tokens: {}, handlers: { onCta } });
    const btn = q(v, '.vp-actions .vp-btn');
    expect(btn.tagName).toBe('BUTTON');
    const form = q(v, '.vp-form');
    form.scrollIntoView = vi.fn();
    btn.click();
    expect(form.scrollIntoView).toHaveBeenCalled();
    expect(onCta).toHaveBeenCalledTimes(1);
  });

  it('does not report clicks from the studio preview', () => {
    const onCta = vi.fn();
    const v = renderLandingPage({ page: page(cfg()), tokens: {}, handlers: { onCta }, preview: true });
    q(v, '.vp-actions .vp-btn').click();
    expect(onCta).not.toHaveBeenCalled();
  });

  it('is hidden when the page has no lead form (no dead button)', () => {
    const v = renderLandingPage({ page: page(cfg({ form: { ...defaultConfig('sales').form, enabled: false } })), tokens: {} });
    expect(q(v, '.vp-actions .vp-btn')).toBeNull(); // the Like button may stay; the dead "Talk to us" button must not render
  });
});

describe('sections: add, remove, reorder', () => {
  it('moves items and ignores impossible moves', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
    const same = ['a', 'b'];
    expect(moveItem(same, 0, 0)).toBe(same);
    expect(moveItem(same, -1, 1)).toBe(same);
    expect(moveItem(same, 0, 5)).toBe(same);
    expect(moveItem(null, 0, 1)).toBe(null);
    const orig = ['a', 'b', 'c'];
    moveItem(orig, 0, 2);
    expect(orig).toEqual(['a', 'b', 'c']); // never mutates
  });

  it('renders sections in the configured order, capped at six, empties dropped', () => {
    const sections = [{ heading: 'One', body: 'a' }, { heading: 'Two', body: 'b' }, { heading: '', body: '' }, { heading: 'Three', body: 'c' }];
    const v = renderLandingPage({ page: page({ ...defaultConfig('clean'), sections }), tokens: {} });
    expect([...v.root.querySelectorAll('.vp-section-title')].map((n) => n.textContent)).toEqual(['One', 'Two', 'Three']);
    const reordered = renderLandingPage({ page: page({ ...defaultConfig('clean'), sections: moveItem(sections, 0, 3) }), tokens: {} });
    expect([...reordered.root.querySelectorAll('.vp-section-title')].map((n) => n.textContent)).toEqual(['Two', 'Three', 'One']);
    expect(sanitizeConfig({ sections: Array.from({ length: 10 }, (_, i) => ({ heading: `s${i}`, body: '' })) }).sections).toHaveLength(6);
  });

  it('section text is rendered as text and tokens fill', () => {
    const v = renderLandingPage({ page: page({ ...defaultConfig('clean'), sections: [{ heading: '<b>x</b> for {{company|you}}', body: '<img src=x onerror=alert(1)>' }] }), tokens: { company: 'Acme' } });
    expect(q(v, '.vp-section-title').textContent).toBe('<b>x</b> for Acme');
    expect(q(v, '.vp-section img')).toBeNull();
  });
});
