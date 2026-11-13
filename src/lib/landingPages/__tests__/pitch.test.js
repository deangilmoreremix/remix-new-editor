import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderLandingPage } from '../render.js';
import {
  getTemplate, defaultConfig, sanitizeConfig, applyTemplate, isCalendarUrl, cleanPhone, ctaHref, parseTranscript, formatTranscript, contrastRatio, readableOn, blend,
} from '../templates.js';

const VIDEO = 'https://x.supabase.co/storage/v1/object/public/uploads/u/clip.mp4';
const page = (config, extra = {}) => ({ id: 'abc12345', title: 'Pitch', video_url: VIDEO, poster_url: null, duration: 92, config, ...extra });
const full = (over = {}) => ({
  ...defaultConfig('pitch', { brand: { name: 'Northbrand Analytics' } }),
  ctas: [
    { label: 'Book a call', kind: 'calendar', value: '', style: 'primary' },
    { label: 'See pricing', kind: 'link', value: 'https://example.com/pricing', style: 'secondary' },
    { label: 'Download one-pager', kind: 'download', value: 'https://example.com/one-pager.pdf', style: 'text' },
    { label: 'Call me', kind: 'phone', value: '+1 (555) 123-4567', style: 'text' },
    { label: 'Text me', kind: 'sms', value: '+1 555 123 4567', style: 'text' },
  ],
  calendar: { url: 'https://calendly.com/dean/intro', title: 'Pick a time with Dean' },
  transcript: { enabled: true, items: [{ t: 0, text: 'Hi Maya, thanks for taking a look.' }, { t: 12, text: 'Here is the idea in one minute.' }, { t: 40, text: 'Let us find a time.' }] },
  ...over,
});
const maya = { firstname: 'Maya', company: 'Brightline' };
const q = (v, s) => v.root.querySelector(s);
const qa = (v, s) => [...v.root.querySelectorAll(s)];

afterEach(() => { vi.useRealTimers(); });

describe('helpers', () => {
  it('only allows https calendars from known booking sites', () => {
    expect(isCalendarUrl('https://calendly.com/dean/intro')).toBe(true);
    expect(isCalendarUrl('https://cal.com/dean')).toBe(true);
    expect(isCalendarUrl('https://meetings.hubspot.com/dean')).toBe(true);
    expect(isCalendarUrl('https://meetings-eu1.hubspot.com/dean')).toBe(true);
    expect(isCalendarUrl('https://team.calendly.com/x')).toBe(true);
    expect(isCalendarUrl('http://calendly.com/dean')).toBe(false);
    expect(isCalendarUrl('https://evil.com/calendly.com')).toBe(false);
    expect(isCalendarUrl('https://calendly.com.evil.com/x')).toBe(false);
    expect(isCalendarUrl('https://notcalendly.com/x')).toBe(false);
    expect(isCalendarUrl('https://user:pw@calendly.com/x')).toBe(false);
    expect(isCalendarUrl('javascript:alert(1)')).toBe(false);
    expect(isCalendarUrl('')).toBe(false);
    expect(isCalendarUrl('https://www.hubspot.com/x')).toBe(false);
  });

  it('cleans phone numbers and builds safe hrefs per button kind', () => {
    expect(cleanPhone('+1 (555) 123-4567')).toBe('+15551234567');
    expect(cleanPhone('555.123.4567')).toBe('5551234567');
    expect(cleanPhone('call me')).toBe('');
    expect(cleanPhone('1234')).toBe('');
    expect(cleanPhone('+1 555; rm -rf')).toBe('');
    expect(ctaHref('phone', '+1 555 123 4567')).toBe('tel:+15551234567');
    expect(ctaHref('sms', '+1 555 123 4567')).toBe('sms:+15551234567');
    expect(ctaHref('link', 'https://example.com/a')).toBe('https://example.com/a');
    expect(ctaHref('link', 'mailto:dean@example.com')).toBe('mailto:dean@example.com');
    expect(ctaHref('link', 'javascript:alert(1)')).toBe('');
    expect(ctaHref('download', 'https://example.com/f.pdf')).toBe('https://example.com/f.pdf');
    expect(ctaHref('download', 'http://example.com/f.pdf')).toBe('');
    expect(ctaHref('download', 'data:text/html,x')).toBe('');
    expect(ctaHref('calendar', 'https://cal.com/x')).toBe('https://cal.com/x');
    expect(ctaHref('calendar', 'ftp://x')).toBe('');
  });

  it('parses and formats a transcript, continuing lines without a time', () => {
    const items = parseTranscript('0:00 Hello there\n0:12 Second point\ncontinues here\n1:05:03 Late\nno time and nothing before');
    expect(items).toEqual([
      { t: 0, text: 'Hello there' },
      { t: 12, text: 'Second point continues here' },
      { t: 3903, text: 'Late no time and nothing before' },
    ]);
    expect(parseTranscript('')).toEqual([]);
    expect(parseTranscript('just words')).toEqual([]);
    expect(formatTranscript([{ t: 0, text: 'a' }, { t: 65, text: 'b' }])).toBe('0:00 a\n1:05 b');
  });
});

describe('sanitizing the new blocks', () => {
  it('keeps at most five buttons, valid kinds and styles, and drops empty ones', () => {
    const c = sanitizeConfig({
      template: 'pitch',
      ctas: [
        ...Array.from({ length: 8 }, (_, i) => ({ label: `B${i}`, kind: 'link', value: 'https://x.io', style: 'primary' })),
        { label: '', value: '' },
      ],
    });
    expect(c.ctas).toHaveLength(5);
    const odd = sanitizeConfig({ ctas: [{ label: 'x', kind: 'teleport', style: 'neon' }] }).ctas[0];
    expect(odd.kind).toBe('link');
    expect(odd.style).toBe('secondary');
  });

  it('drops calendars that are not on an allowed booking site', () => {
    expect(sanitizeConfig({ calendar: { url: 'https://evil.com/x' } }).calendar.url).toBe('');
    expect(sanitizeConfig({ calendar: { url: 'https://calendly.com/a/b', title: 'T' } }).calendar).toEqual({ url: 'https://calendly.com/a/b', title: 'T' });
  });

  it('only enables a countdown with a real date within five years', () => {
    expect(sanitizeConfig({ countdown: { enabled: true, endsAt: 'nope' } }).countdown.enabled).toBe(false);
    expect(sanitizeConfig({ countdown: { enabled: true, endsAt: '2099-01-01T00:00:00Z' } }).countdown.enabled).toBe(false);
    const soon = new Date(Date.now() + 3600_000).toISOString();
    const ok = sanitizeConfig({ countdown: { enabled: true, endsAt: soon, label: 'Ends in' } }).countdown;
    expect(ok.enabled).toBe(true);
    expect(ok.endsAt).toBe(soon);
  });

  it('caps and cleans transcript lines', () => {
    const items = Array.from({ length: 400 }, (_, i) => ({ t: i, text: `line ${i}` }));
    const t = sanitizeConfig({ transcript: { enabled: true, items: [...items, { t: -5, text: '  ' }, { t: 'x', text: 'ok' }] } }).transcript;
    expect(t.items).toHaveLength(300);
    expect(sanitizeConfig({ transcript: { items: [{ t: -5, text: 'neg' }, { t: 9e9, text: 'huge' }] } }).transcript.items.map((i) => i.t)).toEqual([0, 86400]);
  });

  it('the pitch default is a clean starting point: two buttons, likes on, no fake content', () => {
    const c = defaultConfig('pitch');
    expect(c.ctas.map((b) => `${b.kind}/${b.style}`)).toEqual(['calendar/primary', 'link/secondary']);
    expect(c.likes.enabled).toBe(true);
    expect(c.form.enabled).toBe(false);
    expect(c.testimonial).toEqual({ quote: '', by: '' });
    expect(c.transcript.items).toEqual([]);
    expect(c.calendar.url).toBe('');
    expect(c.headline).toContain('{{firstname|there}}');
  });

  it('switching to or from the pitch page keeps the user words', () => {
    const mine = { ...defaultConfig('clean'), headline: 'My own headline', subhead: 'My sub' };
    const next = applyTemplate(mine, 'pitch');
    expect(next.template).toBe('pitch');
    expect(next.headline).toBe('My own headline');
    expect(next.subhead).toBe('My sub');
    expect(applyTemplate(full(), 'clean').ctas).toHaveLength(5); // buttons survive a template switch
  });
});

describe('pitch template: readability', () => {
  const { bg, text, accent } = getTemplate('pitch').theme;
  it('has legible text, button and muted text', () => {
    expect(contrastRatio('#1b1b3a', '#ffffff')).toBeGreaterThanOrEqual(7); // text on the white card
    expect(contrastRatio(blend('#1b1b3a', '#ffffff', 0.65), '#ffffff')).toBeGreaterThanOrEqual(4.5); // muted subhead
    expect(contrastRatio(readableOn(accent), accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(accent, '#ffffff')).toBeGreaterThanOrEqual(3); // button shape on the card
    expect(text).toBe('#1b1b3a');
    expect(bg).toMatch(/^#/);
  });
});

describe('pitch page rendering', () => {
  it('builds the Sendspark-style layout: card, header, headline, player, actions, calendar, transcript', () => {
    const v = renderLandingPage({ page: page(full()), tokens: maya });
    expect(v.root.classList.contains('vp--pitch')).toBe(true);
    expect(q(v, '.vp-card')).not.toBeNull();
    expect(q(v, '.vp-card > .vp-top .vp-brand-name').textContent).toBe('Northbrand Analytics');
    expect(q(v, '.vp-headline').textContent).toBe('Hi Maya, a quick idea for Brightline');
    expect(q(v, '.vp-pitch-grid')).not.toBeNull();
    const left = q(v, '.vp-pitch-main');
    const order = [...left.children].map((n) => n.className.split(' ')[0]);
    expect(order.indexOf('vp-copy')).toBeLessThan(order.indexOf('vp-media'));
    expect(order.indexOf('vp-media')).toBeLessThan(order.indexOf('vp-actions'));
    expect(order.indexOf('vp-actions')).toBeLessThan(order.indexOf('vp-calendar'));
    expect(q(v, '.vp-pitch-grid > .vp-transcript')).not.toBeNull();
    expect(q(v, '.vp-pill')).toBeNull();
    expect(q(v, '.vp-times')).toBeNull(); // the recipient is not co-branded in the header
  });

  it('renders every button kind with a safe href and correct styling', () => {
    const v = renderLandingPage({ page: page(full()), tokens: maya });
    const btns = qa(v, '.vp-actions .vp-btn');
    expect(btns.map((b) => b.textContent)).toEqual(['Book a call', 'See pricing', 'Download one-pager', 'Call me', 'Text me']);
    expect(btns[0].tagName).toBe('BUTTON'); // calendar button scrolls to the embed
    expect(btns[0].className).toContain('vp-btn--primary');
    expect(btns[1].getAttribute('href')).toBe('https://example.com/pricing');
    expect(btns[1].rel).toContain('noopener');
    expect(btns[2].hasAttribute('download')).toBe(true);
    expect(btns[2].className).toContain('vp-btn--text');
    expect(btns[3].getAttribute('href')).toBe('tel:+15551234567');
    expect(btns[4].getAttribute('href')).toBe('sms:+15551234567');
    expect(btns[3].target).toBe(''); // tel/sms open the phone app, not a tab
  });

  it('a calendar button links out when there is no embedded calendar', () => {
    const cfg = full({ calendar: { url: '', title: '' }, ctas: [{ label: 'Book', kind: 'calendar', value: 'https://cal.com/dean', style: 'primary' }] });
    const v = renderLandingPage({ page: page(cfg), tokens: maya });
    const a = q(v, '.vp-actions a.vp-btn');
    expect(a.getAttribute('href')).toBe('https://cal.com/dean');
    expect(q(v, '.vp-calendar')).toBeNull();
  });

  it('embeds the calendar in a sandboxed iframe', () => {
    const v = renderLandingPage({ page: page(full()), tokens: maya });
    const f = q(v, '.vp-calendar iframe');
    expect(f.getAttribute('src')).toBe('https://calendly.com/dean/intro');
    expect(f.getAttribute('sandbox')).toContain('allow-scripts');
    expect(f.getAttribute('sandbox')).not.toContain('allow-top-navigation');
    expect(f.title).toBe('Pick a time with Dean');
    expect(q(v, '.vp-calendar-title').textContent).toBe('Pick a time with Dean');
  });

  it('never renders unsafe targets or non-allowlisted calendars', () => {
    const cfg = full({
      ctas: [
        { label: 'Bad link', kind: 'link', value: 'javascript:alert(1)', style: 'primary' },
        { label: 'Bad dl', kind: 'download', value: 'http://x.io/f', style: 'text' },
        { label: 'Bad tel', kind: 'phone', value: 'not a number', style: 'text' },
        { label: 'Good', kind: 'link', value: 'https://ok.io', style: 'secondary' },
      ],
      calendar: { url: 'https://evil.example/calendar', title: '' },
    });
    const v = renderLandingPage({ page: page(cfg), tokens: maya });
    expect(qa(v, '.vp-actions .vp-btn').map((b) => b.textContent)).toEqual(['Good']);
    expect(q(v, '.vp-calendar')).toBeNull();
    expect(qa(v, 'iframe')).toHaveLength(0);
  });

  it('the Like button toggles once and reports one like event', () => {
    const onLike = vi.fn();
    const v = renderLandingPage({ page: page(full()), tokens: maya, handlers: { onLike } });
    const like = q(v, '.vp-like');
    expect(like.getAttribute('aria-pressed')).toBe('false');
    like.click();
    like.click();
    like.click();
    expect(onLike).toHaveBeenCalledTimes(1);
    expect(like.getAttribute('aria-pressed')).toBe('true');
    expect(like.textContent).toContain('Liked');
    expect(like.classList.contains('is-liked')).toBe(true);
  });

  it('buttons report cta_click, but nothing is sent from the studio preview', () => {
    const onCta = vi.fn();
    const onLike = vi.fn();
    const live = renderLandingPage({ page: page(full()), tokens: maya, handlers: { onCta, onLike } });
    qa(live, '.vp-actions a.vp-btn')[0].addEventListener('click', (e) => e.preventDefault());
    qa(live, '.vp-actions .vp-btn')[1].click();
    expect(onCta).toHaveBeenCalledTimes(1);
    const prev = renderLandingPage({ page: page(full()), tokens: maya, handlers: { onCta, onLike }, preview: true });
    qa(prev, '.vp-actions .vp-btn')[1].click();
    q(prev, '.vp-like').click();
    expect(onCta).toHaveBeenCalledTimes(1);
    expect(onLike).not.toHaveBeenCalled();
  });

  it('transcript lines seek the video, and the current line is highlighted', () => {
    const v = renderLandingPage({ page: page(full()), tokens: maya });
    const lines = qa(v, '.vp-line');
    expect(lines).toHaveLength(3);
    expect(lines[1].querySelector('.vp-line-time').textContent).toBe('0:12');
    lines[1].click();
    expect(v.video.currentTime).toBe(12);
    v.video.currentTime = 45;
    v.video.dispatchEvent(new Event('timeupdate'));
    expect(lines.map((l) => l.classList.contains('is-active'))).toEqual([false, false, true]);
    v.video.currentTime = 13;
    v.video.dispatchEvent(new Event('timeupdate'));
    expect(lines.map((l) => l.classList.contains('is-active'))).toEqual([false, true, false]);
  });

  it('renders transcript text as text, never as markup', () => {
    const cfg = full({ transcript: { enabled: true, items: [{ t: 0, text: '<img src=x onerror=alert(1)> hi' }] } });
    const v = renderLandingPage({ page: page(cfg), tokens: maya });
    expect(q(v, '.vp-line-text').textContent).toBe('<img src=x onerror=alert(1)> hi');
    expect(q(v, '.vp-line img')).toBeNull();
  });

  it('omits the transcript panel and goes single-column when there is none', () => {
    const v = renderLandingPage({ page: page(full({ transcript: { enabled: true, items: [] } })), tokens: maya });
    expect(q(v, '.vp-transcript')).toBeNull();
    expect(q(v, '.vp-pitch-grid').classList.contains('vp-pitch-grid--single')).toBe(true);
  });

  it('counts down, then hides itself when time is up, and stops its timer on destroy', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T10:00:00Z'));
    const cfg = full({ countdown: { enabled: true, endsAt: new Date('2026-06-02T11:00:05Z').toISOString(), label: 'Offer ends in' } });
    const v = renderLandingPage({ page: page(cfg), tokens: maya });
    const cd = q(v, '.vp-countdown');
    expect(cd.textContent).toBe('Offer ends in 1d 01:00:05');
    vi.advanceTimersByTime(1000);
    expect(cd.textContent).toBe('Offer ends in 1d 01:00:04');
    vi.setSystemTime(new Date('2026-06-02T11:00:06Z'));
    vi.advanceTimersByTime(1000);
    expect(cd.hidden).toBe(true);
    v.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fills tokens in the button text and calendar heading', () => {
    const cfg = full({ ctas: [{ label: 'Talk to Dean, {{firstname|friend}}', kind: 'link', value: 'https://x.io', style: 'primary' }], calendar: { url: 'https://cal.com/dean', title: 'A time for {{company|you}}' } });
    const v = renderLandingPage({ page: page(cfg), tokens: maya });
    expect(q(v, '.vp-actions .vp-btn').textContent).toBe('Talk to Dean, Maya');
    expect(q(v, '.vp-calendar-title').textContent).toBe('A time for Brightline');
  });

  it('other templates stay unchanged without these blocks', () => {
    const v = renderLandingPage({ page: page(defaultConfig('clean')), tokens: {} });
    expect(q(v, '.vp-actions')).toBeNull();
    expect(q(v, '.vp-card')).toBeNull();
    expect(q(v, '.vp-pitch-grid')).toBeNull();
  });
});
