import { describe, it, expect } from 'vitest';
import {
  defaultDraft, loadDraft, saveDraft, DRAFT_KEY, tokensIn, fillTemplate, stepErrors,
  speakRequest, buildCampaignProject, campaignLinks, isHttpsUrl,
  parseCsv, guessMapping, contactsFromRows, makeContact, mergeContacts, contactProfile, siteKey, sitesToCapture,
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

describe('website background', () => {
  const withSites = () => {
    const d = readyDraft({ background: { mode: 'website', fallbackSite: 'mycompany.com' } });
    d.siteShots = { 'https://acme.com/': 'https://cdn/acme.jpg', 'https://mycompany.com/': 'https://cdn/mine.jpg' };
    return d;
  };

  it('needs a fallback website and lists each site once', () => {
    expect(stepErrors(readyDraft({ background: { mode: 'website', fallbackSite: '' } }), 3)[0]).toMatch(/fallback website/);
    const d = withSites();
    d.contacts.push({ id: 'c3', firstName: 'Ann', lastName: '', email: 'ann@acme.com', company: 'Acme', website: 'https://ACME.com/about' });
    expect(sitesToCapture(d)).toEqual(['https://acme.com/', 'https://mycompany.com/']);
    expect(siteKey('localhost')).toBeNull();
  });

  it('puts each contact\'s site behind a round camera bubble', () => {
    const p = buildCampaignProject(withSites(), { now: 1000 });
    const [bg, cam] = p.tracks;
    expect(bg.items[0]).toMatchObject({ type: 'image', src: '{{websiteShotUrl}}', fallbackSrc: 'https://cdn/mine.jpg', fit: 'cover', scroll: true });
    expect(cam.items[0]).toMatchObject({ type: 'video', src: 'https://store/rec.webm' });
    expect(p.multiCam).toEqual({ mode: 'pip', mainTrackId: bg.id, secondTrackId: cam.id, pip: { corner: 'bottom-left', size: 26, shape: 'circle' } });
    const noShot = withSites(); noShot.siteShots = {};
    expect(() => buildCampaignProject(noShot)).toThrow(/fallback website/);
  });

  it('carries each contact\'s screenshot in their link, or nothing so the fallback shows', () => {
    const links = campaignLinks(withSites(), 'https://app.test/watch/abcdefgh12', personalLink);
    expect(new URL(links[0].link).searchParams.get('websiteShotUrl')).toBe('https://cdn/acme.jpg');
    expect(links[0].site).toBe('own');
    expect(new URL(links[1].link).searchParams.has('websiteShotUrl')).toBe(false);
    expect(links[1].site).toBe('fallback');
    // Recording background: no screenshot token in links.
    expect(new URL(campaignLinks(readyDraft(), 'https://app.test/watch/x', personalLink)[0].link).searchParams.has('websiteShotUrl')).toBe(false);
  });
});

describe('embedded booking calendar', () => {
  it('known booking hosts get their embed view; others are not embedded', async () => {
    const { calendarEmbedUrl } = await import('../draft.js');
    expect(calendarEmbedUrl('https://calendly.com/ann/30min')).toBe('https://calendly.com/ann/30min?embed_type=Inline&hide_gdpr_banner=1');
    expect(calendarEmbedUrl('https://cal.com/ann/intro')).toBe('https://cal.com/ann/intro?embed=true');
    expect(calendarEmbedUrl('https://calendar.google.com/calendar/appointments/schedules/AcZ')).toContain('gv=true');
    expect(calendarEmbedUrl('https://calendar.google.com/calendar/u/0/r')).toBeNull();
    expect(calendarEmbedUrl('https://evil.example/calendly.com/x')).toBeNull();
    expect(calendarEmbedUrl('http://calendly.com/ann')).toBeNull();
    expect(calendarEmbedUrl('https://calendly.com/')).toBeNull();
  });

  it('the campaign carries embed only for an embeddable link, and Customize explains a bad one', async () => {
    const ok = readyDraft({ cta: { enabled: true, label: 'Book', url: 'https://cal.com/ann', embed: true } });
    expect(buildCampaignProject(ok).landing.cta).toEqual({ label: 'Book', url: 'https://cal.com/ann', embed: true });
    const bad = readyDraft({ cta: { enabled: true, label: 'Book', url: 'https://example.com/book', embed: true } });
    expect(stepErrors(bad, 3).join(' ')).toMatch(/can be shown on the page/);
    const off = readyDraft({ cta: { enabled: true, label: 'Book', url: 'https://example.com/book' } });
    expect(buildCampaignProject(off).landing.cta.embed).toBeUndefined();
  });
});

describe('contacts from Lead Finder', () => {
  it('turns saved leads with an email into contacts and skips the rest', async () => {
    const { contactsFromLeads } = await import('../draft.js');
    const { contacts, skipped } = contactsFromLeads([
      { id: 'l1', business: { name: 'Acme Plumbing', email: 'hi@acme.test', website: 'acme.test' } },
      { id: 'l2', business: { name: 'No Mail Co' } },
      { id: 'l3', business: { name: 'Bad', email: 'not-an-email' } },
    ]);
    expect(skipped).toBe(2);
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ email: 'hi@acme.test', company: 'Acme Plumbing', website: 'https://acme.test', firstName: '' });
  });
});

describe('image and map backgrounds', () => {
  it('each contact gets their own picture, or the fallback image', async () => {
    const { backgroundShotFor, fallbackShotFor, buildCampaignProject, stepErrors, addressesToCapture, mapKey, makeContact } = await import('../draft.js');
    const contacts = [
      { id: 'c1', firstName: 'Mike', lastName: '', email: 'm@x.co', company: '', website: '', address: '1 Market St', backgroundImage: 'https://cdn/mike.jpg' },
      { id: 'c2', firstName: 'Ann', lastName: '', email: 'a@x.co', company: '', website: '', address: '', backgroundImage: '' },
    ];
    const img = readyDraft({ contacts, background: { mode: 'image', image: 'https://cdn/fallback.jpg' } });
    expect(backgroundShotFor(img, contacts[0])).toBe('https://cdn/mike.jpg');
    expect(fallbackShotFor(img)).toBe('https://cdn/fallback.jpg');
    const bg = buildCampaignProject(img).tracks[0].items[0];
    expect(bg).toMatchObject({ src: '{{websiteShotUrl}}', fallbackSrc: 'https://cdn/fallback.jpg' });
    expect(bg.scroll).toBeUndefined();
    const map = readyDraft({ contacts, background: { mode: 'map', image: '' }, mapShots: { [mapKey('1 Market St')]: 'https://cdn/map.jpg' } });
    expect(stepErrors(map, 3).join(' ')).toMatch(/fallback image/);
    expect(backgroundShotFor(map, contacts[0])).toBe('https://cdn/map.jpg');
    expect(addressesToCapture(map)).toEqual(['1 market st']);
    expect(makeContact({ email: 'x@y.co', backgroundImage: 'javascript:alert(1)' }).backgroundImage).toBe('');
  });

  it('a website background gets the moving pointer unless turned off', async () => {
    const { buildCampaignProject } = await import('../draft.js');
    const d = readyDraft({ background: { mode: 'website', fallbackSite: 'me.com' }, siteShots: { 'https://me.com/': 'https://cdn/me.jpg' } });
    expect(buildCampaignProject(d).tracks[0].items[0]).toMatchObject({ scroll: true, cursor: true });
    expect(buildCampaignProject({ ...d, background: { ...d.background, cursor: false } }).tracks[0].items[0].cursor).toBe(false);
  });
});

describe('the landing page belongs to the dynamic video (like Sendspark)', async () => {
  const { loadDraft, newDynamicVideo, cleanPage, defaultDraft } = await import('../draft.js');
  const mem = (d) => ({ getItem: () => JSON.stringify(d) });

  it('starts on the plain video page', () => {
    expect(defaultDraft().page).toBeNull();
  });
  it('keeps your edited page with the video, and drops anything that is not a design', () => {
    const puck = { content: [{ type: 'Hero', props: { id: 'h', headline: 'Hi {{firstname}}' } }], root: { props: {} } };
    expect(loadDraft(mem({ page: { template: 'puck-enterprise', puck } })).page).toEqual({ template: 'puck-enterprise', puck });
    expect(loadDraft(mem({ page: { template: 'clean', puck } })).page).toBeNull();
    expect(cleanPage({ template: '<script>' })).toBeNull();
  });
  it('carries older drafts over: a chosen design becomes that design as it comes', () => {
    const d = loadDraft(mem({ pageId: 'design:puck-leadiq' }));
    expect(d.page).toEqual({ template: 'puck-leadiq', puck: null });
    expect(d.pageId).toBeUndefined();
    const saved = loadDraft(mem({ pageId: 'abc123xyz' }));
    expect(saved.page).toBeNull();
    expect(saved.pageId).toBe('abc123xyz'); // the studio loads that page's content
  });
  it('a new dynamic video keeps the page (its own copy)', () => {
    const page = { template: 'puck-spark', puck: { content: [], root: { props: {} } } };
    const d = newDynamicVideo({ page });
    expect(d.page).toEqual(page);
    d.page.puck.content.push({ type: 'X', props: {} });
    expect(page.puck.content).toHaveLength(0);
  });
});

describe('kinds of dynamic video (Create Dynamic Videos)', async () => {
  const { DYNAMIC_KINDS, stepErrors: errs, newDynamicVideo: fresh } = await import('../draft.js');
  it('offers multiple variables, AI greeting and same audio', () => {
    expect(DYNAMIC_KINDS.map((k) => k.id)).toEqual(['variables', 'greeting', 'same']);
    expect(DYNAMIC_KINDS[0].greeting).toContain('{{company}}');
  });
  it('same audio needs no voice and publishes without a greeting track', () => {
    const d = readyDraft({ kind: 'same', voice: { mode: 'stock', stockVoice: 'Wise_Woman', fallbackUrl: '' }, greeting: '' });
    expect(errs(d, 2)).toEqual([]);
    const p = buildCampaignProject(d);
    expect(JSON.stringify(p)).not.toContain('"role":"voiceover"');
  });
  it('a new dynamic video keeps its kind', () => {
    expect(fresh({ kind: 'same' }).kind).toBe('same');
    expect(fresh({ kind: 'nope' }).kind).toBe('greeting');
  });
});
