import { describe, it, expect, vi } from 'vitest';
import { renderLandingPage } from '../render.js';
import { LAYOUT_NAMES } from '../layouts.js';
import { wireframeSvg, WIREFRAME_LAYOUTS } from '../wireframes.js';
import { STRUCTURE_TEMPLATES, TEMPLATES, defaultConfig, contrastRatio, readableOn, blend } from '../templates.js';

const VIDEO = 'https://x.supabase.co/storage/v1/object/public/uploads/u/clip.mp4';
const full = (id) => ({
  ...defaultConfig(id, { brand: { name: 'Northbrand Analytics' } }),
  ctas: [
    { label: 'Book a call', kind: 'calendar', value: '', style: 'primary' },
    { label: 'See pricing', kind: 'link', value: 'https://example.com/pricing', style: 'secondary' },
    { label: 'Download one-pager', kind: 'download', value: 'https://example.com/one-pager.pdf', style: 'text' },
  ],
  calendar: { url: 'https://calendly.com/dean/intro', title: 'Pick a time with Dean' },
  transcript: { enabled: true, items: [{ t: 0, text: 'Hi Maya.' }, { t: 12, text: 'Here is the idea.' }, { t: 31, text: 'Let us talk.' }, { t: 58, text: 'Thanks.' }] },
  countdown: { enabled: true, endsAt: new Date(Date.now() + 3 * 864e5).toISOString(), label: 'Offer ends in' },
  sender: { name: 'Dean Gilmore', title: 'Founder, Remix Studio', avatarUrl: '' },
  sections: [{ heading: 'What you get', body: 'A walkthrough and a template.' }],
  testimonial: { quote: 'One video a week became one for every customer.', by: 'Jordan Lee' },
  logos: [{ name: 'NORTHWIND' }, { name: 'Globex' }],
  footer: { text: 'Sent by {{sender}} · {{brand}}', optOutUrl: 'mailto:dean@example.com' },
});
const page = (config, extra = {}) => ({ id: 'abc12345', title: 'Pitch', video_url: VIDEO, poster_url: null, duration: 92, config, ...extra });
const maya = { firstname: 'Maya', company: 'Brightline' };
const IDS = STRUCTURE_TEMPLATES.map((t) => t.id);
const render = (id, o = {}) => renderLandingPage({ page: page(full(id)), tokens: maya, ...o });

describe('the structural layouts', () => {
  it('are four, each with its own composer, wireframe and a unique layout name', () => {
    expect(IDS).toEqual(['cinema-hero', 'split-screen', 'conversation', 'app-window']);
    expect([...LAYOUT_NAMES].sort()).toEqual([...IDS].sort());
    IDS.forEach((id) => expect(WIREFRAME_LAYOUTS).toContain(id));
    expect(new Set(IDS.map((id) => wireframeSvg(id))).size).toBe(4);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });

  it('wireframes are static, scriptless markup', () => {
    [...WIREFRAME_LAYOUTS, 'unknown'].forEach((l) => {
      const svg = wireframeSvg(l);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).not.toMatch(/<script|on\w+=|javascript:|href=/i);
    });
  });
});

describe.each(IDS)('%s: every block appears exactly once', (id) => {
  const v = render(id);
  const n = (s) => v.root.querySelectorAll(s).length;
  it('nothing is dropped or duplicated by the arrangement', () => {
    expect(n('video')).toBe(1);
    expect(n('.vp-headline')).toBe(1);
    expect(n('.vp-form')).toBe(1);
    expect(n('.vp-calendar iframe')).toBe(1);
    expect(n('.vp-line')).toBe(4);
    expect(n('.vp-section')).toBe(1);
    expect(n('.vp-quote')).toBe(1);
    expect(n('.vp-logos')).toBe(1);
    expect(n('.vp-foot')).toBe(1);
    expect(n('.vp-byline')).toBe(1);
    expect(n('.vp-like')).toBe(1);
    expect(n('.vp-btn')).toBe(3);
    expect(n('.vp-countdown')).toBe(1);
  });
  it('keeps tokens, the safe calendar frame and the opt-out link', () => {
    expect(v.root.querySelector('.vp-headline').textContent).toBe('Hi Maya, a quick idea for Brightline');
    expect(v.root.querySelector('.vp-calendar iframe').getAttribute('sandbox')).toContain('allow-scripts');
    expect(v.root.querySelector('.vp-optout').getAttribute('href')).toBe('mailto:dean@example.com');
    expect(v.root.querySelector('[name=name]').value).toBe('Maya');
  });
  it('carries its own class, radius and colour variables', () => {
    expect(v.root.classList.contains(`vp--${id}`)).toBe(true);
    const t = STRUCTURE_TEMPLATES.find((x) => x.id === id);
    Object.entries(t.vars).forEach(([k, val]) => expect(v.root.style.getPropertyValue(k)).toBe(val));
  });
});

describe('cinema hero', () => {
  it('puts the headline, buttons and header over the video, and the details below', () => {
    const v = render('cinema-hero');
    const hero = v.root.querySelector('.vp-hero');
    expect(hero.querySelector('.vp-stage video')).not.toBeNull();
    expect(hero.querySelector('.vp-hero-overlay .vp-headline')).not.toBeNull();
    expect(hero.querySelector('.vp-hero-overlay .vp-actions')).not.toBeNull();
    expect(hero.querySelector('.vp-top')).not.toBeNull();
    const sheet = v.root.querySelector('.vp-sheet');
    expect(sheet.querySelector('.vp-form')).not.toBeNull();
    expect(sheet.querySelector('.vp-calendar')).not.toBeNull();
    expect(hero.querySelector('.vp-form')).toBeNull();
    expect([...v.root.children].map((n) => n.className.split(' ')[0])).toEqual(['vp-hero', 'vp-sheet', 'vp-foot']);
  });
  it('steps the words aside while the video plays and brings them back on pause', () => {
    const v = render('cinema-hero');
    expect(v.root.classList.contains('is-playing')).toBe(false);
    Object.defineProperty(v.video, 'paused', { value: false, configurable: true });
    v.video.dispatchEvent(new Event('play'));
    expect(v.root.classList.contains('is-playing')).toBe(true);
    Object.defineProperty(v.video, 'paused', { value: true, configurable: true });
    v.video.dispatchEvent(new Event('pause'));
    expect(v.root.classList.contains('is-playing')).toBe(false);
  });
  it('the Details button scrolls to the sheet', () => {
    const v = render('cinema-hero');
    const sheet = v.root.querySelector('.vp-sheet');
    sheet.scrollIntoView = vi.fn();
    v.root.querySelector('.vp-hero-hint').click();
    expect(sheet.scrollIntoView).toHaveBeenCalled();
  });
  it('has no Details button when there is nothing below', () => {
    const cfg = { ...defaultConfig('cinema-hero'), story: { heading: '', body: [] }, form: { ...defaultConfig('cinema-hero').form, enabled: false }, ctas: [], likes: { enabled: false }, footer: { text: '', optOutUrl: '' } };
    const v = renderLandingPage({ page: page(cfg), tokens: {} });
    expect(v.root.querySelector('.vp-hero-hint')).toBeNull();
  });
});

describe('split screen', () => {
  it('keeps video, headline and buttons in the left panel and the content in the right', () => {
    const v = render('split-screen');
    const left = v.root.querySelector('.vp-split-left');
    const right = v.root.querySelector('.vp-split-right');
    ['video', '.vp-headline', '.vp-actions', '.vp-top'].forEach((s) => expect(left.querySelector(s)).not.toBeNull());
    ['.vp-form', '.vp-story', '.vp-calendar', '.vp-transcript', '.vp-quote', '.vp-logos', '.vp-foot'].forEach((s) => expect(right.querySelector(s)).not.toBeNull());
    expect(left.querySelector('.vp-form')).toBeNull();
    expect(right.querySelector('video')).toBeNull();
    expect(right.querySelector('.vp-cols')).toBeNull(); // stacked, not the intro page's side-by-side
  });
});

describe('conversation', () => {
  const v = render('conversation');
  const q = (s) => v.root.querySelector(s);
  it('opens with a message header and presents the headline and subhead as messages', () => {
    expect(q('.vp-chat-head .vp-chat-name').textContent).toBe('Dean Gilmore');
    expect(q('.vp-msg--text .vp-headline').textContent).toContain('Maya');
    expect(q('.vp-msg--text .vp-subhead')).not.toBeNull();
  });
  it('delivers the video as a message with Like as a reaction and the buttons as quick replies', () => {
    expect(q('.vp-msg--media video')).not.toBeNull();
    expect(q('.vp-msg--media .vp-like')).not.toBeNull();
    expect([...v.root.querySelectorAll('.vp-quick .vp-btn')].map((b) => b.textContent)).toEqual(['Book a call', 'See pricing', 'Download one-pager']);
    expect(q('.vp-quick .vp-like')).toBeNull();
  });
  it('turns the lead form into the reply box and the transcript into a fold-out', () => {
    expect(q('.vp-composer .vp-form')).not.toBeNull();
    expect(q('.vp-composer-label').textContent).toBe('Reply to Dean Gilmore');
    expect(q('details.vp-transcript-fold .vp-line')).not.toBeNull();
    expect(q('details.vp-transcript-fold .vp-transcript-title')).toBeNull();
  });
  it('staggers the messages in', () => {
    const delays = [...v.root.querySelectorAll('.vp-msg')].map((m) => Number.parseInt(m.style.getPropertyValue('--d'), 10));
    expect(delays[0]).toBe(0);
    expect(delays.every((d, i) => i === 0 || d > delays[i - 1])).toBe(true);
  });
  it('falls back to the brand name without a sender', () => {
    const cfg = { ...full('conversation'), sender: { name: '', title: '', avatarUrl: '' } };
    expect(renderLandingPage({ page: page(cfg), tokens: maya }).root.querySelector('.vp-chat-name').textContent).toBe('Northbrand Analytics');
  });
});

describe('app window', () => {
  const v = render('app-window');
  const q = (s) => v.root.querySelector(s);
  it('draws window chrome with a title, three dots and a sidebar', () => {
    expect(v.root.querySelectorAll('.vp-windots i')).toHaveLength(3);
    expect(q('.vp-wintitle').textContent).toBe('Northbrand Analytics');
    expect(q('nav.vp-sidebar')).not.toBeNull();
  });
  it('lists the sections that exist, main column first then the rail', () => {
    expect([...v.root.querySelectorAll('.vp-sidelink')].map((b) => b.textContent)).toEqual(['Overview', 'Video', 'Book a time', 'About', 'Get in touch', 'Transcript', 'What you get']);
  });
  it('sidebar links scroll to their section and move the highlight', () => {
    const links = [...v.root.querySelectorAll('.vp-sidelink')];
    expect(links[0].classList.contains('is-active')).toBe(true);
    const target = q('.vp-form');
    target.scrollIntoView = vi.fn();
    links[4].click();
    expect(target.scrollIntoView).toHaveBeenCalled();
    expect(links.map((l) => l.classList.contains('is-active'))).toEqual([false, false, false, false, true, false, false]);
  });
  it('omits sidebar entries for blocks the page does not have', () => {
    const cfg = { ...full('app-window'), transcript: { enabled: false, items: [] }, calendar: { url: '', title: '' }, sections: [] };
    const w = renderLandingPage({ page: page(cfg), tokens: maya });
    expect([...w.root.querySelectorAll('.vp-sidelink')].map((b) => b.textContent)).toEqual(['Overview', 'Video', 'About', 'Get in touch']);
  });
});

describe('adaptive video frame', () => {
  const shape = (id, w, h) => {
    const v = render(id);
    Object.defineProperty(v.video, 'videoWidth', { value: w, configurable: true });
    Object.defineProperty(v.video, 'videoHeight', { value: h, configurable: true });
    v.video.dispatchEvent(new Event('loadedmetadata'));
    const f = v.root.querySelector('.vp-frame');
    return { ar: f.style.getPropertyValue('--ar'), shape: f.dataset.shape, adaptive: f.classList.contains('is-adaptive') };
  };
  it.each(IDS)('%s follows the real video shape', (id) => {
    expect(shape(id, 1920, 1080)).toEqual({ ar: '1.778', shape: 'wide', adaptive: true });
    expect(shape(id, 1080, 1920)).toEqual({ ar: '0.563', shape: 'tall', adaptive: true });
    expect(shape(id, 1000, 1000)).toEqual({ ar: '1', shape: 'square', adaptive: true });
  });
  it('starts as wide, and ignores videos that report no size', () => {
    expect(shape('split-screen', 0, 0)).toEqual({ ar: '', shape: 'wide', adaptive: true });
  });
  it('is not applied to the older templates (their output is unchanged)', () => {
    const v = renderLandingPage({ page: page(defaultConfig('pitch')), tokens: {} });
    expect(v.root.querySelector('.vp-frame').classList.contains('is-adaptive')).toBe(false);
  });
});

describe('safety in every arrangement', () => {
  it.each(IDS)('%s never renders hostile content as markup or unsafe links', (id) => {
    const cfg = {
      ...full(id),
      headline: '<img src=x onerror=alert(1)> {{firstname}}',
      story: { heading: '<b>x</b>', body: ['<script>alert(1)</script>'] },
      ctas: [{ label: 'Bad', kind: 'link', value: 'javascript:alert(1)', style: 'primary' }, { label: 'Good', kind: 'link', value: 'https://ok.io', style: 'secondary' }],
      calendar: { url: 'https://evil.example/c', title: '<i>x</i>' },
      transcript: { enabled: true, items: [{ t: 0, text: '<img src=x onerror=alert(2)>' }] },
      footer: { text: '<i>x</i>', optOutUrl: 'javascript:alert(1)' },
    };
    const v = renderLandingPage({ page: page(cfg), tokens: { firstname: '<svg onload=alert(1)>' } });
    expect(v.root.querySelector('img[src="x"], script, b, i:not(.vp-windots i)')).toBeNull();
    expect([...v.root.querySelectorAll('.vp-btn')].map((b) => b.textContent)).toEqual(['Good']);
    expect(v.root.querySelector('iframe')).toBeNull();
    expect(v.root.querySelector('.vp-optout')).toBeNull();
    expect(v.root.querySelectorAll('svg')).toHaveLength(1); // only the player's own play icon
  });
});

describe.each(STRUCTURE_TEMPLATES.map((t) => [t.name, t]))('%s: readability', (_n, t) => {
  const surface = t.vars['--vp-surface'];
  it('text is legible on the surfaces it sits on', () => {
    expect(contrastRatio(t.theme.text, t.theme.bg === '#000000' ? '#000000' : t.theme.bg)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(t.theme.text, surface)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(blend(t.theme.text, surface, 0.65), surface)).toBeGreaterThanOrEqual(4.5);
  });
  it('button text is readable on the accent and the button shape stands out', () => {
    expect(contrastRatio(readableOn(t.theme.accent), t.theme.accent)).toBeGreaterThanOrEqual(4.5);
    // On the dark split panel the primary button is white (see CSS), so check that instead of the accent.
    const fill = t.id === 'split-screen' ? '#ffffff' : t.theme.accent;
    const behind = t.id === 'cinema-hero' ? '#000000' : t.id === 'split-screen' ? t.vars['--vp-panel'] : surface;
    expect(contrastRatio(fill, behind)).toBeGreaterThanOrEqual(3);
  });
});
