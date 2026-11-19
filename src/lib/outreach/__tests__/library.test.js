import { describe, it, expect } from 'vitest';
import { saveToLibrary, listLibrary, libraryDraft, newDynamicVideo, defaultDraft, linkedinProfile, makeContact, guessMapping, LIBRARY_LIMIT } from '../draft.js';
import { gmailUrl, linkedinMessage } from '../email.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };
const campaign = (id, extra = {}) => ({ ...defaultDraft(), name: `C ${id}`, contacts: [{ id: 'c1', firstName: 'Mike' }], video: { url: 'https://cdn.test/v.mp4' }, campaign: { id, url: `https://x/watch/${id}`, links: [{ contactId: 'c1', thumbnailUrl: `https://cdn.test/${id}.gif` }] }, ...extra });

describe('Videos library', () => {
  it('keeps generated campaigns newest first and opens them again', () => {
    const s = mem();
    expect(saveToLibrary(defaultDraft(), s)).toBe(false);
    saveToLibrary(campaign('aaa11111'), s, 1);
    saveToLibrary(campaign('bbb22222'), s, 2);
    saveToLibrary(campaign('aaa11111', { name: 'Renamed' }), s, 3);
    const list = listLibrary(s);
    expect(list.map((e) => e.id)).toEqual(['aaa11111', 'bbb22222']);
    expect(list[0]).toMatchObject({ name: 'Renamed', contacts: 1, thumbnailUrl: 'https://cdn.test/aaa11111.gif' });
    const d = libraryDraft('bbb22222', s);
    expect(d.campaign.id).toBe('bbb22222');
    expect(d.sender).toEqual(defaultDraft().sender);
    expect(libraryDraft('nope', s)).toBeNull();
  });

  it('keeps at most the limit, dropping the oldest', () => {
    const s = mem();
    for (let i = 0; i < LIBRARY_LIMIT + 3; i += 1) saveToLibrary(campaign(`id${String(i).padStart(6, '0')}`), s, i);
    const list = listLibrary(s);
    expect(list).toHaveLength(LIBRARY_LIMIT);
    expect(list.at(-1).id).toBe('id000003');
  });

  it('a new dynamic video keeps the voice, sender and button, and optionally the recording', () => {
    const from = campaign('aaa11111', { voice: { ...defaultDraft().voice, mode: 'clone', cloneVoiceId: 'Voice_abc123', fallbackUrl: 'https://cdn.test/g.mp3' }, sender: { name: 'Alex', title: '', company: 'Remix', logo: '', photo: '' }, greeting: 'Yo {{firstname}}' });
    const fresh = newDynamicVideo(from);
    expect(fresh).toMatchObject({ video: null, contacts: [], campaign: null, sender: { name: 'Alex' }, voice: { cloneVoiceId: 'Voice_abc123', fallbackUrl: '' } });
    const again = newDynamicVideo(from, { keepVideo: true });
    expect(again).toMatchObject({ video: { url: 'https://cdn.test/v.mp4' }, greeting: 'Yo {{firstname}}', contacts: [], campaign: null, voice: { fallbackUrl: 'https://cdn.test/g.mp3' } });
  });
});

describe('sharing', () => {
  it('reads LinkedIn profile links only', () => {
    expect(linkedinProfile('linkedin.com/in/mike-ross/')).toBe('https://www.linkedin.com/in/mike-ross');
    expect(linkedinProfile('https://uk.linkedin.com/in/priya?trk=x')).toBe('https://www.linkedin.com/in/priya');
    expect(linkedinProfile('https://evil.test/linkedin.com/in/x')).toBe('');
    expect(linkedinProfile('javascript:alert(1)')).toBe('');
    expect(makeContact({ firstName: 'M', linkedin: 'www.linkedin.com/in/mike' }).linkedin).toBe('https://www.linkedin.com/in/mike');
    expect(guessMapping(['First Name', 'LinkedIn Profile URL']).linkedin).toBe('LinkedIn Profile URL');
  });

  it('builds a Gmail draft and a LinkedIn message', () => {
    const u = new URL(gmailUrl({ to: 'mike@x.com', subject: 'Hi & bye', text: 'line1\nline2' }));
    expect(u.origin).toBe('https://mail.google.com');
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ view: 'cm', to: 'mike@x.com', su: 'Hi & bye', body: 'line1\nline2' });
    expect(linkedinMessage({ contact: { firstName: 'Mike', company: 'Linear' }, link: 'https://x/p/1' })).toBe('Hi Mike, I recorded a quick video for Linear: https://x/p/1');
    expect(linkedinMessage({ contact: {}, link: 'L', fallbacks: { firstname: 'there' } })).toBe('Hi there, I recorded a quick video for you: L');
  });
});
