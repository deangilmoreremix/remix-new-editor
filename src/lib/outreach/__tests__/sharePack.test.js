import { describe, it, expect } from 'vitest';
import { createZip, crc32, safeFileName } from '../zipStore.js';
import { qrTarget, qrSvg, qrMatrix, drawQr, buildSharePack, buildSharePackZip } from '../qrPack.js';

describe('zip writer', () => {
  it('computes the standard CRC-32', () => { expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xCBF43926); });
  it('writes a valid archive: signatures, entry count and stored sizes', () => {
    const zip = createZip([{ name: 'a.txt', data: 'hello' }, { name: 'b.bin', data: new Uint8Array([1, 2, 3]) }], { now: new Date(2026, 10, 28, 12, 0, 0) });
    const dv = new DataView(zip.buffer);
    expect(dv.getUint32(0, true)).toBe(0x04034B50);
    const eocd = zip.length - 22;
    expect(dv.getUint32(eocd, true)).toBe(0x06054B50);
    expect(dv.getUint16(eocd + 10, true)).toBe(2);
    const text = new TextDecoder().decode(zip);
    expect(text).toContain('a.txt'); expect(text).toContain('hello');
  });
  it('makes names safe and unique', () => {
    const zip = createZip([{ name: '../evil/x.txt', data: '1' }, { name: 'x.txt', data: '2' }, { name: 'x.txt', data: '3' }]);
    const text = new TextDecoder().decode(zip);
    expect(text).not.toContain('../'); expect(text).toContain('x (2).txt');
    expect(safeFileName('a/b\\c:d')).toBe('a-b-c-d');
    expect(safeFileName('')).toBe('file'); expect(safeFileName('...')).toBe('file');
    expect(safeFileName('Zoë Ünal.txt')).toBe('Zoë Ünal.txt');
  });
  it('can be unpacked by a real unzip tool', async () => {
    const { execFileSync } = await import('node:child_process');
    const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
    let tool = ''; try { execFileSync('unzip', ['-v'], { stdio: 'ignore' }); tool = 'unzip'; } catch { return; }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-'));
    const file = path.join(dir, 't.zip');
    fs.writeFileSync(file, createZip([{ name: 'a.txt', data: 'héllo' }, { name: 'dir name.csv', data: 'x,y\r\n1,2\r\n' }]));
    expect(execFileSync(tool, ['-t', file]).toString()).toMatch(/No errors detected/);
    expect(execFileSync(tool, ['-p', file, 'a.txt']).toString()).toBe('héllo');
  });
});

describe('QR codes', () => {
  it('accepts only secure links to a real host, with no credentials', () => {
    expect(qrTarget('https://smartvid.app/watch/abc?c=1')).toBe('https://smartvid.app/watch/abc?c=1');
    for (const bad of ['http://smartvid.app/x', 'javascript:alert(1)', 'https://user:pw@smartvid.app', 'https://localhost/x', 'nope', '']) expect(() => qrTarget(bad)).toThrow();
  });
  it('makes an SVG and a square matrix', async () => {
    const svg = await qrSvg('https://smartvid.app/watch/abc');
    expect(svg).toMatch(/^<svg/); expect(svg).toContain('</svg>');
    const m = qrMatrix('https://smartvid.app/watch/abc');
    expect(m.length).toBeGreaterThanOrEqual(21);
    expect(m.every((row) => row.length === m.length)).toBe(true);
    expect(m[0].slice(0, 7)).toEqual([true, true, true, true, true, true, true]); // finder pattern
  });
  it('draws the matrix: white background, dark modules', () => {
    const calls = [];
    const ctx = { set fillStyle(v) { calls.push(['fill', v]); }, fillRect: (...a) => calls.push(['rect', ...a]) };
    const px = drawQr(ctx, [[true, false], [false, true]], 40, { quiet: 1 });
    expect(px).toBe(40);
    expect(calls[0]).toEqual(['fill', '#ffffff']);
    expect(calls.filter((c) => c[0] === 'rect').length).toBe(3);
  });
});

describe('share pack', () => {
  const rows = [
    { contact: { firstName: 'Mike', lastName: 'Ross', email: 'mike@acme.com', company: 'Acme' }, link: 'https://smartvid.app/watch/a?c=1', subject: 'Hi Mike', text: 'Body A https://smartvid.app/watch/a?c=1', thumbnailUrl: 'https://cdn.x/t.gif' },
    { contact: { firstName: '=cmd', email: 'e@x.com' }, link: 'http://insecure.example/x', subject: 'S', text: 'B' },
  ];
  it('builds the files, skips a bad link with a reason, and escapes formulas in the CSV', async () => {
    const { files, skipped } = await buildSharePack(rows, { png: async () => null });
    const names = files.map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(['links.csv', 'emails.txt', 'Mike-Ross-qr.svg']));
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toMatch(/https/);
    const csv = files.find((f) => f.name === 'links.csv').data;
    expect(csv).toContain("'=cmd");
    expect(csv.split('\r\n')[0]).toBe('First name,Last name,Email,Company,Link,Thumbnail,QR file');
    expect(files.find((f) => f.name === 'emails.txt').data).toContain('Subject: Hi Mike');
  });
  it('includes a PNG when the browser can make one', async () => {
    const png = async () => ({ arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer });
    const { files } = await buildSharePack([rows[0]], { png });
    expect(files.map((f) => f.name)).toContain('Mike-Ross-qr.png');
  });
  it('zips it', async () => {
    const { zip, count } = await buildSharePackZip([rows[0]], { png: async () => null });
    expect(count).toBe(3); expect(zip.length).toBeGreaterThan(100);
  });
});
