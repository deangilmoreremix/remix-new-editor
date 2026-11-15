import { describe, it, expect, vi } from 'vitest';
import { emailFor, mailtoUrl, mailMergeCsv, DEFAULT_EMAIL } from '../email.js';
import { thumbnailText, thumbnailKey, wrapLines, drawThumbnail } from '../thumbnail.js';
import { loadDraft } from '../draft.js';

const mike = { firstName: 'Mike', lastName: 'Markovic', email: 'mike@acme.com', company: 'Acme' };
const link = 'https://smartvid.app/watch/abc12345?c=c1&firstName=Mike';

describe('outreach email', () => {
  it('fills the subject and body per contact, keeping paragraphs and the link', () => {
    const e = emailFor({ contact: mike, link, fallbacks: { firstname: 'there' } });
    expect(e.to).toBe('mike@acme.com');
    expect(e.subject).toBe('A quick video for Mike');
    expect(e.text).toBe(`Hi Mike,\n\nI recorded a short video for Acme. It takes two minutes:\n\n${link}\n\nThanks!`);
  });

  it('uses fallbacks for missing details', () => {
    const e = emailFor({ contact: { email: 'x@y.co' }, link, fallbacks: { firstname: 'there', company: 'your company' } });
    expect(e.subject).toBe('A quick video for there');
    expect(e.text).toContain('for your company.');
  });

  it('HTML puts the thumbnail where {{link}} stands, linked to the page, and escapes text', () => {
    const e = emailFor({ email: { ...DEFAULT_EMAIL, body: 'Hi <b>{{firstname}}</b>\n\n{{link}}' }, contact: mike, link, thumbnailUrl: 'https://cdn.x/t.jpg' });
    expect(e.html).toContain('Hi &lt;b&gt;Mike&lt;/b&gt;');
    expect(e.html).toMatch(/<a href="https:\/\/smartvid\.app\/watch\/abc12345\?c=c1&amp;firstName=Mike"><img src="https:\/\/cdn\.x\/t\.jpg"/);
  });

  it('without {{link}} on its own line the thumbnail goes first; unsafe URLs are dropped', () => {
    const e = emailFor({ email: { subject: 's', body: 'Watch: {{link}}' }, contact: mike, link, thumbnailUrl: 'https://cdn.x/t.jpg' });
    expect(e.html.indexOf('<img')).toBeLessThan(e.html.indexOf('Watch:'));
    const bad = emailFor({ email: { subject: 's', body: '{{link}}' }, contact: mike, link: 'javascript:alert(1)' });
    expect(bad.html).not.toContain('javascript');
  });

  it('mailto and mail-merge CSV', () => {
    const e = emailFor({ contact: mike, link });
    const m = mailtoUrl(e);
    expect(m.startsWith('mailto:mike%40acme.com?subject=A%20quick%20video%20for%20Mike&body=Hi%20Mike')).toBe(true);
    const csv = mailMergeCsv([{ ...e, contact: { ...mike, company: '=HYPERLINK("x")' }, link, thumbnailUrl: '' }]);
    expect(csv.split('\r\n')[0]).toBe('Email,First Name,Last Name,Company,Subject,Body,HTML,Link,Thumbnail');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('old drafts get the default email', () => {
    const storage = { getItem: () => JSON.stringify({ header: 'x' }) };
    expect(loadDraft(storage).email).toEqual(DEFAULT_EMAIL);
  });
});

describe('email thumbnails', () => {
  it('personalized line, shared images for the same picture', () => {
    expect(thumbnailText('Hi {{firstname}}, this is for you', mike)).toBe('Hi Mike, this is for you');
    expect(thumbnailText('Hi {{firstname}}', {}, { firstname: 'there' })).toBe('Hi there');
    expect(thumbnailKey('Hi Mike', '')).toBe(thumbnailKey('Hi Mike', ''));
    expect(thumbnailKey('Hi Mike', 'https://a/x.jpg')).not.toBe(thumbnailKey('Hi Mike', ''));
  });

  it('wraps text to two lines with an ellipsis', () => {
    const measure = (t) => t.length * 10;
    expect(wrapLines(measure, 'one two three', 200)).toEqual(['one two three']);
    const lines = wrapLines(measure, 'aaaa bbbb cccc dddd eeee ffff', 100, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
  });

  it('draws the frame, the text and a play button; with a website, a round camera bubble', () => {
    const calls = [];
    const ctx = new Proxy({}, {
      get: (t, k) => (k in t ? t[k] : k === 'measureText' ? (s) => ({ width: s.length * 20 }) : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (...a) => calls.push([k, ...a])),
      set: (t, k, v) => { t[k] = v; return true; },
    });
    const frame = { videoWidth: 1280, videoHeight: 720 };
    drawThumbnail(ctx, { frame, text: 'Hi Mike' });
    expect(calls.some(([k, img]) => k === 'drawImage' && img === frame)).toBe(true);
    expect(calls.some(([k, txt]) => k === 'fillText' && txt === 'Hi Mike')).toBe(true);
    expect(calls.filter(([k]) => k === 'arc').length).toBe(1);
    calls.length = 0;
    const site = { naturalWidth: 1280, naturalHeight: 3000 };
    drawThumbnail(ctx, { frame, site, text: '' });
    expect(calls.some(([k, img]) => k === 'drawImage' && img === site)).toBe(true);
    expect(calls.some(([k]) => k === 'clip')).toBe(true);
  });
});
