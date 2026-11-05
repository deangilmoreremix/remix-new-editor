import { describe, it, expect, vi } from 'vitest';
import '../../addons/index.js';
import {
  contactName, listContactProfiles, resolveLineFor, projectTokens, personalLink, linksCsv, voiceSrcFor, voiceForContacts, contactIdFromQuery,
} from '../perContact.js';
import { timelineToComposition } from '../../remotion/timelineToComposition.js';
import { profileFromQuery } from '../../publish/publishClient.js';
import { openSmartSpeechModal } from '../../agent/smartSpeechModal.js';

// Shapes as the Personalize window stores them (contact + variables + Find a Business details).
const ann = { id: 'c-ann', contact: { name: 'Ann Lee', firstName: 'Ann', email: 'ann@acme.test', company: 'Acme' }, variables: { firstName: 'Ann', company: 'Acme' },
  personalization: { business: { businessName: 'Acme Plumbing', phone: '555 0100' } } };
const bob = { id: 'c-bob', contact: { name: 'Bob Ray', firstName: 'Bob' }, variables: { firstName: 'Bob' } };
const nobody = { id: 'c-x', contact: { name: 'No Name' }, variables: {} };
const store = { listProfiles: () => [ann, bob, nobody, { id: '../bad' }] };

describe('per-contact personalization (Personalization Studio contacts)', () => {
  it('lists studio contacts and resolves lines with the studio resolver, incl. business details', () => {
    expect(listContactProfiles(store).map((p) => p.id)).toEqual(['c-ann', 'c-bob', 'c-x']);
    expect(contactName(ann)).toBe('Ann Lee');
    expect(resolveLineFor('Hi {{firstName}} from {{businessName}}', ann)).toBe('Hi Ann from Acme Plumbing');
    expect(resolveLineFor('Hi {{first name}}!', bob)).toBe('Hi Bob!');
    expect(resolveLineFor('Hi {{firstName}}', nobody)).toBeNull();
    expect(resolveLineFor('Hi {{d firstName "there"}}', nobody)).toBe('Hi there');
  });

  it('voices each contact once per distinct line and skips contacts missing a value', async () => {
    const generate = vi.fn(async (line) => ({ url: `https://a/${encodeURIComponent(line)}.mp3`, duration: line.length / 10 }));
    const twin = { ...bob, id: 'c-bob2' };
    const progress = [];
    const { variants, skipped } = await voiceForContacts({ text: 'Hi {{firstName}}', contacts: [ann, bob, twin, nobody], generate, onProgress: (p) => progress.push(p.done) });
    expect(generate).toHaveBeenCalledTimes(2); // Bob and his twin share one recording
    expect(variants['c-ann']).toMatchObject({ text: 'Hi Ann', url: 'https://a/Hi%20Ann.mp3' });
    expect(variants['c-bob2'].url).toBe(variants['c-bob'].url);
    expect(skipped).toEqual([{ id: 'c-x', name: 'No Name' }]);
    expect(progress).toEqual([1, 2, 3, 4]);
  });

  it('the composition plays the rendered contact\'s own voice, else the fallback', () => {
    const clip = { id: 's1', type: 'audio', src: 'https://a/fallback.mp3', left: 0, width: 20, tts: { personalized: true, variants: { 'c-ann': { url: 'https://a/ann.mp3' } } } };
    const project = { timelineSeconds: 10, tracks: [{ id: 'vo', type: 'audio', name: 'Voiceover', items: [clip] }] };
    const srcFor = (profile) => JSON.stringify(timelineToComposition(project, { quality: '720p', profile })).match(/https:\/\/a\/\w+\.mp3/)[0];
    expect(srcFor(ann)).toBe('https://a/ann.mp3');
    expect(srcFor(bob)).toBe('https://a/fallback.mp3');
    expect(srcFor(null)).toBe('https://a/fallback.mp3');
    expect(voiceSrcFor(clip, { id: 'c-ann' })).toBe('https://a/ann.mp3');
  });

  it('personal links carry the contact id and the values the video uses; ?c= selects the voice on /watch', () => {
    const tracks = [{ items: [{ type: 'overlay-text', addon: { text: 'Hello {{ first name }} at {{businessName}}' } }, { type: 'audio', tts: { text: 'Hi {{d firstName "there"}}' } }] }];
    const tokens = projectTokens(tracks);
    expect(tokens.sort()).toEqual(['businessName', 'firstName']);
    const link = personalLink('https://smartvid.app/watch/abcd1234', ann, tokens);
    const u = new URL(link);
    expect(Object.fromEntries(u.searchParams)).toEqual({ c: 'c-ann', firstName: 'Ann', businessName: 'Acme Plumbing' });
    expect(profileFromQuery(u.search)).toEqual({ id: 'c-ann', variables: { firstName: 'Ann', businessName: 'Acme Plumbing' } });
    expect(contactIdFromQuery('?c=../x')).toBeNull();
    expect(linksCsv([{ name: 'Lee, Ann', email: 'a@x', company: 'Acme', link }])).toBe(`Name,Email,Company,Link\r\n"Lee, Ann",a@x,Acme,${link}`);
  });

  it('Smart Speech: Add on a personalized line voices each chosen contact onto one Voiceover clip', async () => {
    const generate = vi.fn(async (req) => ({ url: `https://a/${encodeURIComponent(req.text)}.mp3`, duration: req.text.length / 10 }));
    const add = vi.fn();
    const mem = new Map();
    const m = openSmartSpeechModal({ generate, add, listContacts: () => [ann, bob, nobody], storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) } });
    const el = m.el;
    const set = (k, v) => { const t = el.querySelector(`[data-k="${k}"]`); t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); };
    set('text', 'Hi {{firstName}}, thanks!');
    set('fallback', 'Hi there, thanks!');
    el.querySelector('[data-act="add"]').click();
    // Contacts step: Ann and Bob are ready, the contact without a first name hears the fallback.
    const rows = [...el.querySelectorAll('.speech-modal__contact')];
    expect(rows.map((r) => r.querySelector('span').textContent)).toEqual(['“Hi Ann, thanks!”', '“Hi Bob, thanks!”', 'Missing a detail this line uses: hears the fallback']);
    expect(el.querySelector('[data-act="voice-all"]').textContent).toMatch(/Voice 2 contacts/);
    el.querySelector('[data-contact="c-bob"]').click(); // untick Bob
    el.querySelector('[data-act="voice-all"]').click();
    await vi.waitFor(() => expect(add).toHaveBeenCalled());
    expect(generate.mock.calls.map((c) => c[0].text)).toEqual(['Hi there, thanks!', 'Hi Ann, thanks!']);
    const added = add.mock.calls[0][0];
    expect(added.url).toBe('https://a/Hi%20there%2C%20thanks!.mp3');
    expect(Object.keys(added.tts.variants)).toEqual(['c-ann']);
    expect(added.tts).toMatchObject({ personalized: true, text: 'Hi {{firstName}}, thanks!', fallback: 'Hi there, thanks!' });
    expect(added.duration).toBeCloseTo(1.7);
  });
});
