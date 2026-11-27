import { describe, it, expect, vi } from 'vitest';
import { renderLandingPage } from '../render.js';
import {
  defaultConfig, sanitizeConfig, applyTemplate, splitAccent, formatDuration, tokensUsed, tokensFromQuery, PUBLIC_TOKEN_KEYS,
} from '../templates.js';
import { guessMapping, buildContacts } from '../csv.js';

const VIDEO = 'https://x.supabase.co/storage/v1/object/public/uploads/u/clip.mp4';
const filled = () => ({
  ...defaultConfig('personal'),
  brand: { name: 'Remix Studio', tagline: 'A personal video from {{sender}}' },
  theme: { ...defaultConfig('personal').theme, logoUrl: '' },
  sender: { name: 'Dean Gilmore', title: 'Founder, Remix Studio', avatarUrl: '' },
  testimonial: { quote: 'We went from one video a week to one for every customer.', by: 'Jordan Lee, Head of Marketing, Northwind' },
  logos: [{ name: 'NORTHWIND' }, { name: 'Globex' }],
  footer: { text: 'Sent by {{sender}} · {{brand}}', optOutUrl: 'mailto:dean@example.com?subject=Opt%20out' },
});
const page = (config, extra = {}) => ({ id: 'abc12345', title: 'Intro', video_url: VIDEO, poster_url: null, duration: 92, config, ...extra });
const ann = { firstname: 'Ann', company: 'Acme' };
const q = (v, sel) => v.root.querySelector(sel);
const text = (v, sel) => q(v, sel)?.textContent;

describe('Personal intro: rendered design', () => {
  const v = renderLandingPage({ page: page(filled()), tokens: ann });

  it('shows the co-branded header with sender, recipient and tagline', () => {
    expect([...v.root.querySelectorAll('.vp-brand-name')].map((n) => n.textContent)).toEqual(['Remix Studio', 'Acme']);
    expect(text(v, '.vp-times')).toBe('×');
    expect(text(v, '.vp-tagline')).toBe('A personal video from Dean Gilmore');
    expect(text(v, '.vp-mark--recipient')).toBe('A'); // letter tile when there is no logo
  });

  it('uses the recipient logo only when it is an https image', () => {
    const withLogo = renderLandingPage({ page: page(filled()), tokens: { ...ann, companylogo: 'https://cdn.test/acme.png' } });
    expect(q(withLogo, 'img.vp-mark--recipient').getAttribute('src')).toBe('https://cdn.test/acme.png');
    const bad = renderLandingPage({ page: page(filled()), tokens: { ...ann, companylogo: 'javascript:alert(1)' } });
    expect(q(bad, 'img.vp-mark--recipient')).toBeNull();
    expect(text(bad, '.vp-mark--recipient')).toBe('A');
  });

  it('renders the pill, and the company in the headline as a highlighted span', () => {
    expect(text(v, '.vp-pill')).toBe('Made for Ann at Acme');
    expect(text(v, '.vp-headline')).toBe("Hi Ann, here's a quick video for Acme");
    expect(text(v, '.vp-headline .vp-accent')).toBe('Acme');
  });

  it('has a Watch-your-video button that starts playback instead of linking', () => {
    const cta = q(v, '.vp-cta--play');
    expect(cta.tagName).toBe('BUTTON');
    expect(cta.textContent).toContain('Watch your video');
    const play = vi.spyOn(v.video, 'play').mockResolvedValue();
    cta.click();
    expect(play).toHaveBeenCalled();
  });

  it('uses a custom player: big play button, personalized caption, duration, control bar', () => {
    expect(v.video.controls).toBe(false);
    expect(q(v, '.vp-bigplay')).not.toBeNull();
    expect(text(v, '.vp-caption-title')).toBe('Ann, welcome to Acme');
    expect(text(v, '.vp-caption-sub')).toBe('Personalized for you · 1:32');
    expect(text(v, '.vp-dur')).toBe('1:32');
    expect(q(v, '.vp-bar .vp-seek')).not.toBeNull();
    expect(q(v, '.vp-bar').textContent).toContain('1:32');
  });

  it('hides the caption and big button once playback starts, and shows them again only before', () => {
    const p = renderLandingPage({ page: page(filled()), tokens: ann });
    expect(p.root.querySelector('.vp-bigplay').hidden).toBe(false);
    Object.defineProperty(p.video, 'paused', { value: false, configurable: true });
    p.video.dispatchEvent(new Event('play'));
    expect(p.root.querySelector('.vp-bigplay').hidden).toBe(true);
    expect(p.root.querySelector('.vp-caption').hidden).toBe(true);
    expect(p.root.querySelector('.vp-bar-btn').textContent).toBe('❚❚');
  });

  it('lays out the story with the sender byline beside the form card', () => {
    const cols = q(v, '.vp-cols');
    expect(cols.children[0].className).toContain('vp-story');
    expect(cols.children[1].className).toContain('vp-form');
    expect(text(v, '.vp-story-title')).toBe("What I'd like to show you");
    expect(text(v, '.vp-byline-name')).toBe('Dean Gilmore');
    expect(text(v, '.vp-byline-title')).toBe('Founder, Remix Studio');
    expect(text(v, '.vp-mark--avatar')).toBe('D');
    expect(text(v, '.vp-form-title')).toBe('Want to talk it through?');
    expect(text(v, '.vp-form-sub')).toContain('Leave your details');
    expect([...v.root.querySelectorAll('.vp-input')].map((i) => i.placeholder)).toEqual(['Your name', 'you@company.com', 'Anything you would like me to know']);
    expect(q(v, 'textarea[name=message]').required).toBe(false);
    expect(text(v, '.vp-privacy')).toBe('Your details go only to Dean Gilmore. No spam.');
  });

  it('shows the testimonial, logo strip and a footer with a real opt-out link', () => {
    expect(text(v, '.vp-quote-text')).toBe('“We went from one video a week to one for every customer.”');
    expect(text(v, '.vp-quote-by')).toContain('Northwind');
    expect([...v.root.querySelectorAll('.vp-logos-name')].map((n) => n.textContent)).toEqual(['NORTHWIND', 'Globex']);
    expect(text(v, '.vp-foot-text')).toBe('Sent by Dean Gilmore · Remix Studio');
    expect(q(v, '.vp-optout').getAttribute('href')).toBe('mailto:dean@example.com?subject=Opt%20out');
  });

  it('omits blocks that are empty rather than rendering placeholders or fake content', () => {
    const bare = renderLandingPage({ page: page(defaultConfig('personal')), tokens: ann });
    expect(q(bare, '.vp-quote')).toBeNull();
    expect(q(bare, '.vp-logos')).toBeNull();
    expect(q(bare, '.vp-optout')).toBeNull(); // no destination, no dead link
    expect(q(bare, '.vp-byline')).toBeNull();
    expect(text(bare, '.vp-foot-text')).toBe('Sent by me'); // separator removed when the brand is empty
  });

  it('page-owned tokens cannot be spoofed by a contact or the URL', () => {
    const spoof = renderLandingPage({ page: page(filled()), tokens: { ...ann, sender: 'Mallory', brand: 'Evil Inc', duration: '9:99' } });
    expect(text(spoof, '.vp-tagline')).toBe('A personal video from Dean Gilmore');
    expect(text(spoof, '.vp-dur')).toBe('1:32');
  });

  it('never renders markup from config, accent markers or tokens', () => {
    const cfg = { ...filled(), headline: '[[<img src=x onerror=alert(1)>]] {{firstname}}', logos: [{ name: '<b>x</b>', imageUrl: 'javascript:alert(1)' }], footer: { text: '<i>x</i>', optOutUrl: 'javascript:alert(1)' } };
    const x = renderLandingPage({ page: page(cfg), tokens: { firstname: '<svg onload=alert(1)>' } });
    expect(x.root.querySelector('img[src="x"], i, b')).toBeNull();
    expect(x.root.querySelectorAll('svg')).toHaveLength(1); // only the player's own play icon, none from the token
    expect(q(x, '.vp-optout')).toBeNull();
  });

  it('other templates keep native controls and no new blocks', () => {
    const c = renderLandingPage({ page: page(defaultConfig('clean')), tokens: {} });
    expect(c.video.controls).toBe(true);
    expect(q(c, '.vp-bigplay')).toBeNull();
    expect(q(c, '.vp-top')).toBeNull();
  });

  it('learns the duration from the video when the page has none', () => {
    const p = renderLandingPage({ page: page(filled(), { duration: null }), tokens: ann });
    expect(q(p, '.vp-dur').hidden).toBe(true);
    Object.defineProperty(p.video, 'duration', { value: 75, configurable: true });
    p.video.dispatchEvent(new Event('loadedmetadata'));
    expect(text(p, '.vp-caption-sub')).toBe('Personalized for you · 1:15');
    expect(text(p, '.vp-dur')).toBe('1:15');
  });
});

describe('Personal intro: config', () => {
  it('ships no fabricated testimonial, customers or sender', () => {
    const c = defaultConfig('personal');
    expect(c.testimonial).toEqual({ quote: '', by: '' });
    expect(c.logos).toEqual([]);
    expect(c.sender.name).toBe('');
    expect(c.footer.optOutUrl).toBe('');
    expect(c.cta.type).toBe('play');
    expect(c.theme.highlight).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('sanitizes the new blocks', () => {
    const c = sanitizeConfig({
      template: 'personal', badge: 'x'.repeat(300),
      cta: { label: 'Go', type: 'play' },
      sender: { name: 'D', avatarUrl: 'http://insecure/a.png' },
      story: { heading: 'h', body: ['a', '', '  ', 'b', 'c', 'd', 'e', 'f'] },
      logos: Array.from({ length: 12 }, (_, i) => ({ name: `L${i}`, imageUrl: 'data:image/png;base64,AAA' })),
      footer: { text: 'f', optOutUrl: 'javascript:alert(1)' },
      theme: { highlight: 'blue' },
      form: { enabled: true, fields: [{ key: 'm', label: 'M', type: 'textarea', placeholder: 'p'.repeat(200) }] },
    });
    expect(c.badge).toHaveLength(100);
    expect(c.sender.avatarUrl).toBe('');
    expect(c.story.body).toEqual(['a', 'b', 'c', 'd']);
    expect(c.logos).toHaveLength(6);
    expect(c.logos.every((l) => l.imageUrl === '')).toBe(true);
    expect(c.footer.optOutUrl).toBe('');
    expect(c.theme.highlight).toBe('#6366f1');
    expect(c.form.fields[0].placeholder).toHaveLength(80);
    expect(c.cta.type).toBe('play');
  });

  it('splits [[accent]] markers and formats durations', () => {
    expect(splitAccent('Hi [[Acme]] team')).toEqual([{ text: 'Hi ', accent: false }, { text: 'Acme', accent: true }, { text: ' team', accent: false }]);
    expect(splitAccent('plain')).toEqual([{ text: 'plain', accent: false }]);
    expect(splitAccent('[[unclosed')).toEqual([{ text: '[[unclosed', accent: false }]);
    expect(formatDuration(92)).toBe('1:32');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(0)).toBe('');
    expect(formatDuration('nope')).toBe('');
  });

  it('keeps the recipient logo out of URL tokens and out of "tokens in use"', () => {
    expect(PUBLIC_TOKEN_KEYS).toContain('companylogo');
    expect(tokensFromQuery('?firstname=Ann&companylogo=https://evil/x.png')).toEqual({ firstname: 'Ann' });
    expect(tokensUsed(defaultConfig('personal')).sort()).toEqual(['company', 'firstname']);
  });

  it('switching template keeps the user\'s words and fills only empty blocks', () => {
    const mine = { ...defaultConfig('clean', { title: 'My headline' }), headline: 'My headline', subhead: 'My sub' };
    const next = applyTemplate(mine, 'personal', { title: 'ignored' });
    expect(next.template).toBe('personal');
    expect(next.headline).toBe('My headline');
    expect(next.subhead).toBe('My sub');
    expect(next.badge).toContain('Made for');
    expect(next.form.enabled).toBe(true);
    const custom = { ...defaultConfig('personal'), sender: { name: 'Dean', title: '', avatarUrl: '' }, badge: 'Just for you' };
    const back = applyTemplate(custom, 'personal');
    expect(back.sender.name).toBe('Dean');
    expect(back.badge).toBe('Just for you');
  });
});

describe('Personal intro: recipient logo in CSV', () => {
  it('maps a logo column and drops non-https logos without dropping the contact', () => {
    expect(guessMapping(['Email', 'Company', 'Company Logo'])).toEqual(['email', 'company', 'companylogo']);
    const { contacts } = buildContacts([
      ['a@acme.com', 'Acme', 'https://cdn.test/acme.png'],
      ['b@x.io', 'X', 'http://insecure/x.png'],
    ], ['email', 'company', 'companylogo']);
    expect(contacts[0].fields.companylogo).toBe('https://cdn.test/acme.png');
    expect(contacts[1].fields).toEqual({ email: 'b@x.io', company: 'X' });
  });
});
