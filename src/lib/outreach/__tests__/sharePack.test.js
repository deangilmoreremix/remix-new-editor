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

describe('long file names', () => {
  it('shortens the name but never the extension', () => {
    const name = `${'A'.repeat(100)}-qr.svg`;
    const safe = safeFileName(name);
    expect(safe.length).toBeLessThanOrEqual(80);
    expect(safe.endsWith('.svg')).toBe(true);
    expect(safeFileName(`${'B'.repeat(120)}.png`).endsWith('.png')).toBe(true);
    expect(safeFileName('short.svg')).toBe('short.svg');
  });
  it('a very long prospect name still gives a CSV reference that matches the zip entry', async () => {
    const rows = [
      { contact: { firstName: 'A'.repeat(75), lastName: 'Lee', email: 'a@x.com' }, link: 'https://smartvid.app/watch/a?c=1' },
      { contact: { firstName: 'A'.repeat(75), lastName: 'Lee', email: 'b@y.com' }, link: 'https://smartvid.app/watch/a?c=2' },
    ];
    const { files } = await buildSharePack(rows, { png: async () => null });
    const svgs = files.filter((f) => f.name.endsWith('.svg')).map((f) => f.name);
    expect(svgs).toHaveLength(2);
    for (const n of svgs) { expect(n.length).toBeLessThanOrEqual(80); expect(safeFileName(n)).toBe(n); } // the zip would not rename them
    expect(new Set(svgs).size).toBe(2);
    const csv = files.find((f) => f.name === 'links.csv').data.split('\r\n');
    expect(csv[1].endsWith(svgs[0])).toBe(true);
    expect(csv[2].endsWith(svgs[1])).toBe(true);
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
  it('gives two prospects with the same name different files, and the CSV points at the right one', async () => {
    const two = [
      { contact: { firstName: 'Alex', lastName: 'Lee', email: 'a@x.com' }, link: 'https://smartvid.app/watch/a?c=1' },
      { contact: { firstName: 'Alex', lastName: 'Lee', email: 'b@y.com' }, link: 'https://smartvid.app/watch/a?c=2' },
    ];
    const { files } = await buildSharePack(two, { png: async () => null });
    const names = files.map((f) => f.name).filter((n) => n.endsWith('.svg'));
    expect(names).toEqual(['Alex-Lee-qr.svg', 'Alex-Lee (2)-qr.svg']);
    const rows = files.find((f) => f.name === 'links.csv').data.split('\r\n');
    expect(rows[1]).toMatch(/,Alex-Lee-qr\.svg$/);
    expect(rows[2]).toMatch(/,Alex-Lee \(2\)-qr\.svg$/);
    // the zip keeps those exact names (it must not rename them again)
    const { zip } = await buildSharePackZip(two, { png: async () => null });
    const text = new TextDecoder().decode(zip);
    expect(text).toContain('Alex-Lee (2)-qr.svg');
    expect(text).not.toContain('(3)');
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

describe('names that collide with names already handed out', () => {
  const row = (firstName, n) => ({ contact: { firstName, email: `${n}@x.com` }, link: `https://smartvid.app/watch/${n}`, subject: 's', text: 't' });
  it('gives "Alex", "Alex" and "Alex (2)" three different files, each named by its CSV row', async () => {
    const { files } = await buildSharePack([row('Alex', 1), row('Alex', 2), row('Alex (2)', 3)], { png: async () => null });
    const svgs = files.filter((f) => f.name.endsWith('.svg')).map((f) => f.name);
    expect(new Set(svgs.map((n) => n.toLowerCase())).size).toBe(3);
    const csv = files.find((f) => f.name === 'links.csv').data.split('\r\n');
    expect(new Set(csv.slice(1, 4).map((l) => l.split(',').pop())).size).toBe(3);
  });
  it('a name cut in the middle of an emoji still matches the zip entry', async () => {
    const { files } = await buildSharePack([row(`${'a'.repeat(59)}😀`, 1)], { png: async () => null });
    const svg = files.find((f) => f.name.endsWith('.svg')).name;
    expect(safeFileName(svg)).toBe(svg);
    const csv = files.find((f) => f.name === 'links.csv').data.split('\r\n')[1];
    expect(csv.endsWith(svg)).toBe(true);
  });
  it('the zip never repeats a name, even when a later file already has a numbered one', () => {
    const zip = createZip([{ name: 'a.txt', data: 'x' }, { name: 'a.txt', data: 'y' }, { name: 'a (2).txt', data: 'z' }]);
    const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const names = [];
    for (let at = 0; v.getUint32(at, true) === 0x04034b50;) { // each local header: sizes at 18, name length at 26, extra length at 28
      const size = v.getUint32(at + 18, true); const n = v.getUint16(at + 26, true); const x = v.getUint16(at + 28, true);
      names.push(new TextDecoder().decode(zip.subarray(at + 30, at + 30 + n)));
      at += 30 + n + x + size;
    }
    expect(names).toHaveLength(3);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(3);
  });
});
