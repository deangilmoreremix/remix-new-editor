import { describe, it, expect, vi } from 'vitest';
import { emailFor, mailtoUrl, mailMergeCsv, csvCell, DEFAULT_EMAIL } from '../email.js';
import { thumbnailText, thumbnailKey, wrapLines, drawThumbnail, thumbSettings, frameTimes, encodeGif, GIF_SECONDS, GIF_FPS } from '../thumbnail.js';
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
    expect(csv.split('\r\n')[0]).toBe('Email,First Name,Last Name,Company,Subject,Body,HTML,Link,Thumbnail,GIF URL,Outlook still URL');
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
    expect(thumbnailKey('Hi Mike', '', 'https://a/logo.png')).not.toBe(thumbnailKey('Hi Mike', ''));
    expect(thumbnailText('Hi {{firstname}}, {{jobtitle}}', { firstName: 'Mike', jobTitle: 'CEO' })).toBe('Hi Mike, CEO');
  });

  it('settings default to an animated GIF with a solid play button, and clean bad values', () => {
    expect(thumbSettings()).toMatchObject({ type: 'gif', start: 0, background: 'auto', image: '', logo: true, logoMode: 'prospect', play: { show: true, style: 'solid', color: '#4f46e5', opacity: 1 } });
    expect(thumbSettings({ type: 'static', start: -2, logo: false, play: { show: false, style: 'neon', color: 'red', opacity: 5 } }))
      .toMatchObject({ type: 'static', start: 0, background: 'auto', image: '', logo: false, logoMode: 'none', play: { show: false, style: 'solid', color: '#4f46e5', opacity: 1 } });
  });

  it('a GIF is 3 seconds of frames from the chosen start, kept inside the video; a still is one frame', () => {
    const gif = frameTimes({ type: 'gif', start: 2 }, 10);
    expect(gif).toHaveLength(GIF_SECONDS * GIF_FPS);
    expect(gif[0]).toBe(2);
    expect(gif.at(-1)).toBeCloseTo(2 + (GIF_SECONDS * GIF_FPS - 1) / GIF_FPS);
    expect(frameTimes({ type: 'gif', start: 9 }, 10)[0]).toBe(7);
    expect(frameTimes({ type: 'static', start: 4.5 }, 10)).toEqual([4.5]);
    expect(frameTimes({ type: 'static', start: 40 }, 10)).toEqual([9.95]);
  });

  it('encodes frames as an animated GIF', async () => {
    const frame = (v) => new Uint8ClampedArray(4 * 4 * 4).fill(v);
    const blob = await encodeGif([frame(0), frame(255)], 4, 4);
    expect(blob.type).toBe('image/gif');
    const bytes = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(new Uint8Array(r.result)); r.readAsArrayBuffer(blob); });
    expect(String.fromCharCode(...bytes.slice(0, 6))).toBe('GIF89a');
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
    // Logo top-right; no play button when hidden.
    calls.length = 0;
    const logo = { naturalWidth: 200, naturalHeight: 100 };
    drawThumbnail(ctx, { frame, logo, text: 'Hi', play: { show: false } });
    const logoDraw = calls.find(([k, img]) => k === 'drawImage' && img === logo);
    expect(logoDraw[1 + 1]).toBeGreaterThan(960 / 2);
    expect(calls.filter(([k]) => k === 'arc')).toHaveLength(0);
    // Outline and glass styles draw a ring.
    for (const style of ['outline', 'glass']) {
      calls.length = 0;
      drawThumbnail(ctx, { frame, play: { show: true, style, color: '#ff0000', opacity: 0.5 } });
      expect(calls.some(([k]) => k === 'stroke')).toBe(true);
    }
  });
});

describe('thumbnail share snippets', () => {
  it('Copy GIF and Embed link the thumbnail to the page, escaped and https/http only', async () => {
    const { thumbnailHtml, embedSnippet } = await import('../email.js');
    const html = thumbnailHtml({ link, thumbnailUrl: 'https://cdn.x/t.gif' });
    expect(html).toBe('<a href="https://smartvid.app/watch/abc12345?c=c1&amp;firstName=Mike"><img src="https://cdn.x/t.gif" alt="Play the video" width="480" style="display:block;max-width:100%;border-radius:12px;border:0"></a>');
    expect(thumbnailHtml({ link: 'javascript:x', thumbnailUrl: 'https://cdn.x/t.gif' })).toBe('');
    const embed = embedSnippet({ link, thumbnailUrl: 'https://cdn.x/t.gif', name: 'Mike <M>' });
    expect(embed).toContain('Watch the video for Mike &lt;M&gt;');
    expect(embed).toContain('<img src="https://cdn.x/t.gif"');
  });

  it('Embed plays a muted video where the inbox allows it, with the GIF as poster and fallback', async () => {
    const { embedSnippet, outlookUrl } = await import('../email.js');
    const embed = embedSnippet({ link, thumbnailUrl: 'https://cdn.x/t.gif', videoUrl: 'https://cdn.x/v.mp4' });
    expect(embed).toMatch(/<a href="https:\/\/smartvid\.app[^"]*"><video src="https:\/\/cdn\.x\/v\.mp4" poster="https:\/\/cdn\.x\/t\.gif"[^>]*muted[^>]*playsinline[^>]*><img src="https:\/\/cdn\.x\/t\.gif"/);
    expect(embedSnippet({ link, thumbnailUrl: 'https://cdn.x/t.gif', videoUrl: 'javascript:x' })).not.toContain('<video');
    const o = new URL(outlookUrl({ to: 'mike@x.co', subject: 'Hi Mike', text: `Watch: ${link}` }));
    expect(o.origin + o.pathname).toBe('https://outlook.office.com/mail/deeplink/compose');
    expect(Object.fromEntries(o.searchParams)).toEqual({ to: 'mike@x.co', subject: 'Hi Mike', body: `Watch: ${link}` });
  });
});

describe('csvCell (spreadsheet-safe cells)', () => {
  it('prefixes values that a spreadsheet would run as formulas', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+SUM(A1)')).toBe("'+SUM(A1)");
    expect(csvCell('-2+3')).toBe("'-2+3");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });
  it('leaves ordinary values alone and keeps quote escaping', () => {
    expect(csvCell('Mike')).toBe('Mike');
    expect(csvCell(null)).toBe('');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('a,b')).toBe('"a,b"');
  });
});
