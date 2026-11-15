import { describe, it, expect } from 'vitest';
import {
  defaultDraft, loadDraft, saveDraft, DRAFT_KEY, tokensIn, fillTemplate, stepErrors,
  speakRequest, buildCampaignProject, campaignLinks, isHttpsUrl,
  parseCsv, guessMapping, contactsFromRows, makeContact, mergeContacts, contactProfile,
} from '../draft.js';
import { personalLink, resolveLineFor } from '../../editor/personalize/perContact.js';
import { encodeWav, encodeWavBuffer, mixToMono } from '../voiceSample.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

function readyDraft(overrides = {}) {
  const d = defaultDraft();
  d.video = { url: 'https://store/rec.webm', duration: 42, hasAudio: true, type: 'both' };
  d.voice = { ...d.voice, mode: 'clone', cloneVoiceId: 'voice_abc123', consent: { at: '2026-11-15T00:00:00Z', userId: 'user_1' }, fallbackUrl: 'https://store/greeting.mp3', fallbackDuration: 1.8 };
  d.cta = { enabled: true, label: 'Book a call', url: 'https://cal.com/me/intro' };
  d.contacts = [
    { id: 'c1', firstName: 'Mike', lastName: 'Markovic', email: 'mike@acme.com', company: 'Acme', website: 'https://acme.com' },
    { id: 'c2', firstName: '', lastName: '', email: 'info@stay.ai', company: 'Stay', website: '' },
  ];
  return Object.assign(d, overrides);
}

describe('outreach draft', () => {
  it('round-trips through storage and fills missing fields from defaults', () => {
    const store = memory();
    expect(loadDraft(store)).toEqual(defaultDraft());
    store.setItem(DRAFT_KEY, JSON.stringify({ header: 'Yo {{firstname}}', cta: { label: 'Call me' } }));
    const d = loadDraft(store);
    expect(d.header).toBe('Yo {{firstname}}');
    expect(d.cta).toEqual({ enabled: true, label: 'Call me', url: '' });
    expect(d.voice.mode).toBe('clone');
    saveDraft({ ...d, header: 'Saved' }, store);
    expect(loadDraft(store).header).toBe('Saved');
    store.setItem(DRAFT_KEY, '{not json');
    expect(loadDraft(store)).toEqual(defaultDraft());
  });

  it('fills tokens from the contact, then the fallbacks', () => {
    expect(tokensIn('Hi {{firstName}} at {{ company }} {{firstname}}')).toEqual(['firstname', 'company']);
    expect(fillTemplate('Hi {{firstname}}!', { firstName: 'Mike' }, { firstname: 'there' })).toBe('Hi Mike!');
    expect(fillTemplate('Hi {{firstname}}!', { firstname: '  ' }, { firstname: 'there' })).toBe('Hi there!');
    expect(fillTemplate('Hi {{firstname}} from {{unknown}}', {}, { firstname: 'friend' })).toBe('Hi friend from');
  });

  it('blocks each step until it is complete', () => {
    const d = defaultDraft();
    expect(stepErrors(d, 1)[0]).toMatch(/Record or upload/);
    expect(stepErrors({ ...d, video: { url: 'blob:x' } }, 1)[0]).toMatch(/uploading/);
    expect(stepErrors(d, 2).join(' ')).toMatch(/Clone your voice/);
    expect(stepErrors(d, 2).join(' ')).toMatch(/own before/);
    expect(stepErrors({ ...readyDraft(), greeting: 'x'.repeat(71) }, 2)[0]).toMatch(/70 characters/);
    expect(stepErrors(readyDraft({ cta: { enabled: true, label: 'Go', url: 'http://cal.com/x' } }), 3)[0]).toMatch(/https/);
    expect(stepErrors(readyDraft({ cta: { enabled: false, label: '', url: '' } }), 3)).toEqual([]);
    for (const s of [1, 2, 3]) expect(stepErrors(readyDraft(), s)).toEqual([]);
    // A stock voice needs no clone or consent.
    const stock = readyDraft();
    stock.voice = { ...stock.voice, mode: 'stock', stockVoice: 'Calm_Woman', cloneVoiceId: '', consent: null };
    expect(stepErrors(stock, 2)).toEqual([]);
  });

  it('only accepts https booking links with a real host', () => {
    expect(isHttpsUrl('https://cal.com/me')).toBe(true);
    for (const bad of ['http://cal.com', 'javascript:alert(1)', 'https://localhost/x', 'cal.com/me', '']) expect(isHttpsUrl(bad)).toBe(false);
  });

  it('speaks with the cloned voice, or the stock one', () => {
    expect(speakRequest(readyDraft(), 'Hi Mike')).toEqual({ provider: 'minimax', text: 'Hi Mike', voice: 'voice_abc123', speed: 1, cloneVoiceId: 'voice_abc123' });
    const stock = readyDraft(); stock.voice.mode = 'stock'; stock.voice.stockVoice = 'Calm_Woman';
    expect(speakRequest(stock, 'Hi')).toEqual({ provider: 'minimax', text: 'Hi', voice: 'Calm_Woman', speed: 1 });
  });

  it('builds the campaign project: recording, voiced greeting per contact, landing text', () => {
    const variants = { c1: { url: 'https://store/mike.mp3', duration: 1.2, text: 'Hi Mike!', name: 'Mike' } };
    const p = buildCampaignProject(readyDraft({ name: 'Cold outreach' }), { variants, now: 1000 });
    expect(p).toMatchObject({ title: 'Cold outreach', timelineSeconds: 42, kind: 'outreach', campaign: { name: 'Cold outreach', contacts: 2 } });
    const [video, voice] = p.tracks;
    expect(video.items[0]).toMatchObject({ type: 'video', src: 'https://store/rec.webm', left: 0, width: 100 });
    expect(voice.items[0]).toMatchObject({
      type: 'audio', role: 'voiceover', src: 'https://store/greeting.mp3', start: 0, end: 1.8,
      tts: { voice: 'voice_abc123', cloneVoiceId: 'voice_abc123', text: 'Hi {{firstname}}!', fallback: 'Hi there!', personalized: true, variants },
    });
    expect(p.landing).toEqual({
      header: 'Hi {{firstname}}, I made this for you', message: 'Excited to show how we can help {{company}}.',
      fallbacks: { firstname: 'there', company: 'your company' }, cta: { label: 'Book a call', url: 'https://cal.com/me/intro' },
    });
    // No CTA when it is off; no contacts means no campaign.
    expect(buildCampaignProject(readyDraft({ cta: { enabled: false, label: '', url: '' } })).landing.cta).toBeNull();
    expect(() => buildCampaignProject(readyDraft({ contacts: [] }))).toThrow(/at least one contact/);
    expect(() => buildCampaignProject(defaultDraft())).toThrow(/Record or upload/);
  });

  it('gives each contact a personal link that carries their details and id', () => {
    const links = campaignLinks(readyDraft(), 'https://app.test/watch/abcdefgh12', personalLink, { c1: { url: 'https://store/mike.mp3' } });
    expect(links).toHaveLength(2);
    const mike = new URL(links[0].link);
    expect(mike.pathname).toBe('/watch/abcdefgh12');
    expect(mike.searchParams.get('c')).toBe('c1');
    expect(mike.searchParams.get('firstName')).toBe('Mike');
    expect(mike.searchParams.get('company')).toBe('Acme');
    expect(links[0]).toMatchObject({ name: 'Mike Markovic', email: 'mike@acme.com', voiced: true });
    expect(links[1]).toMatchObject({ name: 'info@stay.ai', voiced: false });
    expect(new URL(links[1].link).searchParams.has('firstName')).toBe(false);
  });

  it('makes contact profiles the shared personalization helpers can read', () => {
    const [mike, noName] = readyDraft().contacts.map(contactProfile);
    expect(resolveLineFor('Hi {{firstname}}!', mike)).toBe('Hi Mike!');
    expect(resolveLineFor('Hi {{firstname}}!', noName)).toBeNull(); // the fallback greeting plays
  });
});

describe('contact import', () => {
  it('parses CSV with quotes, commas, CRLF and a BOM', () => {
    const { headers, rows } = parseCsv('﻿First Name,Email,Company\r\n"Ann ""A""",ann@x.com,"Acme, Inc"\r\n\r\nBo,bo@y.com,\r\n');
    expect(headers).toEqual(['First Name', 'Email', 'Company']);
    expect(rows).toEqual([
      { 'First Name': 'Ann "A"', Email: 'ann@x.com', Company: 'Acme, Inc' },
      { 'First Name': 'Bo', Email: 'bo@y.com', Company: '' },
    ]);
  });

  it('guesses which columns hold which field', () => {
    expect(guessMapping(['First_Name', 'Surname', 'E-mail', 'Organization', 'Domain', 'Notes']))
      .toEqual({ firstName: 'First_Name', lastName: 'Surname', email: 'E-mail', company: 'Organization', website: 'Domain' });
    expect(guessMapping(['Name', 'Email'])).toEqual({ firstName: 'Name', email: 'Email' });
  });

  it('turns rows into contacts, splitting a single Name column and skipping empty rows', () => {
    const rows = [{ Name: 'Mike Markovic', Email: 'mike@acme.com' }, { Name: '', Email: '' }, { Name: 'Luca', Email: '' }];
    let n = 0;
    const { contacts, skipped } = contactsFromRows(rows, { firstName: 'Name', email: 'Email' }, { rand: () => (n += 0.1) });
    expect(skipped).toBe(1);
    expect(contacts.map((c) => [c.firstName, c.lastName, c.email])).toEqual([['Mike', 'Markovic', 'mike@acme.com'], ['Luca', '', '']]);
    expect(contacts.every((c) => /^[A-Za-z0-9_-]{1,80}$/.test(c.id))).toBe(true);
  });

  it('normalizes a contact and drops repeated emails', () => {
    expect(makeContact({ firstName: '  Ann ', website: 'acme.com', id: '../bad' }, { rand: () => 0.5 })).toMatchObject({ firstName: 'Ann', website: 'https://acme.com' });
    expect(makeContact({ firstName: '  Ann ', id: '../bad' }, { rand: () => 0.5 }).id).not.toBe('../bad');
    expect(makeContact({ company: 'Acme' })).toBeNull();
    const a = makeContact({ email: 'A@x.com', id: 'a' });
    const b = makeContact({ email: 'a@X.com', id: 'b' });
    const c = makeContact({ firstName: 'C', id: 'c' });
    expect(mergeContacts([a], [b, c]).map((x) => x.id)).toEqual(['a', 'c']);
  });
});

describe('voice sample encoding', () => {
  it('writes a valid mono 16-bit WAV', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 0.5]), 24000);
    const bytes = new DataView(encodeWavBuffer(new Float32Array([0, 1, -1, 0.5]), 24000));
    const tag = (o) => String.fromCharCode(...[0, 1, 2, 3].map((i) => bytes.getUint8(o + i)));
    expect(wav.type).toBe('audio/wav');
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(bytes.getUint16(22, true)).toBe(1); // mono
    expect(bytes.getUint32(24, true)).toBe(24000);
    expect(bytes.getUint32(40, true)).toBe(8); // 4 samples × 2 bytes
    expect(bytes.getInt16(46, true)).toBe(32767);
    expect(bytes.getInt16(48, true)).toBe(-32768);
  });

  it('mixes channels to mono and trims to the limit', () => {
    const buffer = { length: 4, numberOfChannels: 2, getChannelData: (c) => (c === 0 ? new Float32Array([1, 1, 1, 1]) : new Float32Array([0, 0, 0, 0])) };
    expect(Array.from(mixToMono(buffer, 3))).toEqual([0.5, 0.5, 0.5]);
  });
});
