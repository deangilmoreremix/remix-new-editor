import { describe, it, expect } from 'vitest';
import { parseCsv, guessMapping, buildContacts, exportLinksCsv, contactLabel, MAX_CONTACTS_PER_IMPORT } from '../csv.js';
import { openVideoPageFor, queueVideoForPage, takeQueuedVideo } from '../handoff.js';

describe('parseCsv', () => {
  it('parses quotes, escaped quotes, embedded commas/newlines and CRLF', () => {
    const { headers, rows } = parseCsv('First Name,Company,Note\r\nAnn,"Acme, Inc.","said ""hi""\nthere"\r\nBob,Initech,\r\n');
    expect(headers).toEqual(['First Name', 'Company', 'Note']);
    expect(rows).toEqual([['Ann', 'Acme, Inc.', 'said "hi"\nthere'], ['Bob', 'Initech', '']]);
  });

  it('handles BOM, semicolons, tabs, blank lines and short rows', () => {
    expect(parseCsv('﻿name;company\nAnn;Acme\n\nBob').rows).toEqual([['Ann', 'Acme'], ['Bob', '']]);
    expect(parseCsv('a\tb\n1\t2').rows).toEqual([['1', '2']]);
    expect(parseCsv('')).toEqual({ headers: [], rows: [] });
  });
});

describe('guessMapping', () => {
  it('recognizes common headers once each and ignores the rest', () => {
    expect(guessMapping(['First Name', 'Last name', 'E-mail', 'Organisation', 'Job Title', 'City', 'Notes', 'Email address']))
      .toEqual(['firstname', 'lastname', 'email', 'company', 'role', 'city', '', '']);
  });
});

describe('buildContacts', () => {
  const map = ['firstname', 'company', 'email'];

  it('builds contacts, validating and deduping emails case-insensitively', () => {
    const { contacts, skipped } = buildContacts([
      ['Ann', 'Acme', 'Ann@Acme.com'],
      ['Ann again', 'Acme', 'ann@acme.com'],
      ['Bob', 'Initech', 'not-an-email'],
      ['Cy', 'X', ''],
      ['', '', ''],
      ['Di', 'Y', 'di@y.io'],
    ], map);
    expect(contacts.map((c) => c.fields.email)).toEqual(['Ann@Acme.com', 'di@y.io']);
    expect(skipped).toEqual([
      { line: 3, reason: 'duplicate' },
      { line: 4, reason: 'invalid email' },
      { line: 5, reason: 'missing email' },
      { line: 6, reason: 'empty' },
    ]);
  });

  it('skips contacts that already exist and ignores unmapped columns', () => {
    const { contacts, skipped } = buildContacts([['Ann', 'ann@acme.com', 'secret']], ['firstname', 'email', ''], { existing: new Set(['ann@acme.com']) });
    expect(contacts).toEqual([]);
    expect(skipped).toEqual([{ line: 2, reason: 'duplicate' }]);
    const ok = buildContacts([['Ann', 'ann@acme.com', 'secret']], ['firstname', 'email', '']);
    expect(ok.contacts[0].fields).toEqual({ firstname: 'Ann', email: 'ann@acme.com' });
  });

  it('works without an email column, deduping on name and company', () => {
    const { contacts, skipped } = buildContacts([['Ann', 'Acme'], ['ann', 'acme'], ['Bob', 'Acme']], ['firstname', 'company']);
    expect(contacts).toHaveLength(2);
    expect(skipped[0].reason).toBe('duplicate');
  });

  it('enforces the per-import limit and trims long values', () => {
    const rows = Array.from({ length: MAX_CONTACTS_PER_IMPORT + 5 }, (_, i) => [`n${i}`]);
    const { contacts, skipped } = buildContacts(rows, ['firstname']);
    expect(contacts).toHaveLength(MAX_CONTACTS_PER_IMPORT);
    expect(skipped.filter((s) => s.reason === 'over limit')).toHaveLength(1);
    expect(buildContacts([['x'.repeat(500)]], ['firstname']).contacts[0].fields.firstname).toHaveLength(200);
  });
});

describe('exportLinksCsv', () => {
  it('writes personal links and defuses spreadsheet formulas', () => {
    const csv = exportLinksCsv([
      { id: 'contact_01', fields: { firstname: '=HYPERLINK("http://evil")', company: 'Acme, Inc.', email: 'a@b.co' } },
      { id: 'contact_02', fields: { firstname: '+1 555', lastname: '@x' } },
    ], 'abc12345', 'https://s.io');
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('firstname,lastname,company,email,link');
    expect(lines[1]).toBe(`"'=HYPERLINK(""http://evil"")",,"Acme, Inc.",a@b.co,https://s.io/p/abc12345?c=contact_01`);
    expect(lines[2]).toBe(`'+1 555,'@x,,,https://s.io/p/abc12345?c=contact_02`);
  });

  it('labels contacts sensibly', () => {
    expect(contactLabel({ fields: { firstname: 'Ann', lastname: 'Lee' } })).toBe('Ann Lee');
    expect(contactLabel({ fields: { email: 'a@b.co' } })).toBe('a@b.co');
    expect(contactLabel({})).toBe('Contact');
  });
});

describe('handoff', () => {
  const mem = () => { const m = new Map(); return { setItem: (k, v) => m.set(k, v), getItem: (k) => m.get(k) ?? null, removeItem: (k) => m.delete(k) }; };

  it('queues an https video once and clears it when taken', () => {
    const storage = mem();
    expect(queueVideoForPage({ id: 'g1', url: 'https://cdn/x.mp4', prompt: 'A fox', studio: 'cinema' }, { storage })).toBe(true);
    expect(takeQueuedVideo({ storage })).toMatchObject({ url: 'https://cdn/x.mp4', title: 'A fox', source: { kind: 'generation', studio: 'cinema' } });
    expect(takeQueuedVideo({ storage })).toBeNull();
  });

  it('refuses non-video, non-https and missing items', async () => {
    const storage = mem();
    expect(queueVideoForPage({ url: 'https://cdn/x.png', type: 'image' }, { storage })).toBe(false);
    expect(queueVideoForPage({ url: 'http://cdn/x.mp4' }, { storage })).toBe(false);
    expect(queueVideoForPage(null, { storage })).toBe(false);
    expect(await openVideoPageFor({ url: 'blob:x' }, { storage })).toBe(false);
  });

  it('ignores tampered storage', () => {
    const storage = mem();
    storage.setItem('video_pages_queued_video', JSON.stringify({ url: 'javascript:alert(1)' }));
    expect(takeQueuedVideo({ storage })).toBeNull();
    storage.setItem('video_pages_queued_video', '{not json');
    expect(takeQueuedVideo({ storage })).toBeNull();
  });
});
