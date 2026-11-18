// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { encodeGif, thumbSettings, thumbLogo, durationLabel, GIF_W, GIF_H, GIF_FPS, GIF_SECONDS } from '../thumbnail.js';
import { mailMergeCsv } from '../email.js';

const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());
const frame = (w, h, fill) => { const a = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) { const [r, g, b] = fill(i % w, Math.floor(i / w)); a[i * 4] = r; a[i * 4 + 1] = g; a[i * 4 + 2] = b; a[i * 4 + 3] = 255; } return a; };
const count = (bytes, seq) => { let n = 0; for (let i = 0; i < bytes.length - seq.length; i++) if (seq.every((v, j) => bytes[i + j] === v)) n++; return n; };

describe('GIF thumbnails like Sendspark', () => {
  it('600x338, 3 seconds at 12 frames a second, looping forever', async () => {
    expect([GIF_W, GIF_H]).toEqual([600, 338]);
    const w = 60; const h = 34;
    const frames = Array.from({ length: GIF_SECONDS * GIF_FPS }, (_, k) => frame(w, h, (x, y) => [(x * 4 + k) % 255, y * 7 % 255, 128]));
    const b = await bytesOf(await encodeGif(frames, w, h));
    expect(String.fromCharCode(...b.slice(0, 6))).toBe('GIF89a');
    expect(b[6] | (b[7] << 8)).toBe(w);
    expect(b[8] | (b[9] << 8)).toBe(h);
    // NETSCAPE2.0 application block with loop count 0 = forever.
    const net = [...'NETSCAPE2.0'].map((c) => c.charCodeAt(0));
    const i = b.findIndex((_, k) => net.every((v, j) => b[k + j] === v));
    expect(i).toBeGreaterThan(0);
    expect(b[i + 11]).toBe(3); expect(b[i + 12]).toBe(1);
    expect(b[i + 13] | (b[i + 14] << 8)).toBe(0);
    // One graphic control block per frame (0x21 0xF9 0x04).
    expect(count(b, [0x21, 0xf9, 0x04])).toBe(36);
  });

  it('a GIF over the size cap is made again with fewer frames (the first frame always kept)', async () => {
    const w = 200; const h = 112;
    let seed = 1; const noise = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % 256; };
    const frames = Array.from({ length: 36 }, () => frame(w, h, () => [noise(), noise(), noise()]));
    const full = await encodeGif(frames, w, h, 12, { maxBytes: Infinity });
    const capped = await encodeGif(frames, w, h, 12, { maxBytes: full.size / 2 });
    const b = await bytesOf(capped);
    expect(capped.size).toBeLessThan(full.size);
    expect(count(b, [0x21, 0xf9, 0x04])).toBe(24);
  });

  it('settings: colours, the duration badge and the logo choice, with the old on/off logo still working', () => {
    const d = thumbSettings();
    expect(d).toMatchObject({ textColor: '#ffffff', bannerColor: '#000000', duration: { show: true, opacity: 0.75 }, logoMode: 'prospect', logo: true });
    expect(thumbSettings({ logo: false })).toMatchObject({ logoMode: 'none', logo: false });
    expect(thumbSettings({ logoMode: 'one' }).logoMode).toBe('prospect'); // no logo chosen yet
    const one = thumbSettings({ logoMode: 'one', logoUrl: 'https://x.test/l.png', textColor: 'red' });
    expect(one).toMatchObject({ logoMode: 'one', textColor: '#ffffff' });
    expect(thumbLogo(one, 'https://theirs.test/l.png')).toBe('https://x.test/l.png');
    expect(thumbLogo(d, 'https://theirs.test/l.png')).toBe('https://theirs.test/l.png');
    expect(thumbLogo(thumbSettings({ logoMode: 'none' }), 'https://theirs.test/l.png')).toBe('');
    expect(durationLabel(26.5)).toBe('0:27');
    expect(durationLabel(125)).toBe('2:05');
  });

  it('the mail-merge .csv has GIF URL and Outlook still URL columns', () => {
    const csv = mailMergeCsv([{ to: 'm@x.test', contact: { firstName: 'Mike' }, subject: 's', text: 't', html: 'h', link: 'https://l.test', thumbnailUrl: 'https://c.test/a.gif', stillUrl: 'https://c.test/a-still.jpg' }]);
    const [head, row] = csv.trim().split('\r\n');
    expect(head.endsWith('Thumbnail,GIF URL,Outlook still URL')).toBe(true);
    expect(row.endsWith('https://c.test/a.gif,https://c.test/a.gif,https://c.test/a-still.jpg')).toBe(true);
  });
});
