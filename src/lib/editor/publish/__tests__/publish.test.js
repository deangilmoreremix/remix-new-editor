import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeSlug, preparePublishProject, cleanLanding, uploadLocalMedia, localSources, publishVideo, fetchPublishedVideo, submitViewerLead, profileFromQuery, embedCode, watchUrl,
} from '../publishClient.js';
import { createInteractivePlayer, stripUnresolvedTokens, profileWithAnswers } from '../interactivePlayer.js';
import { showLeadForm, ctaElement, linkBoxElement, personalize } from '../viewerOverlays.js';
import { renderSharePanel } from '../sharePanel.js';
import { mountWatchPage } from '../../../../pages/WatchPage.jsx';

const T = 20;
const pct = (sec) => (sec / T) * 100;
const clipAt = (start, end, extra) => ({ left: pct(start), width: pct(end - start), ...extra });

function project() {
  return {
    version: 1, title: 'Demo', timelineSeconds: T,
    tracks: [
      { id: 'v', type: 'video', items: [clipAt(0, 20, { id: 'vid', type: 'video', src: 'https://cdn/x.mp4' })] },
      { id: 't', type: 'text', items: [
        clipAt(2, 3, { id: 'p1', type: 'addon-pause', addon: { duration: 0, continueText: 'Go on' } }),
        clipAt(5, 6, { id: 'lf', type: 'lead-form', heading: 'Hi {{firstname}}', fields: [{ id: 'email', type: 'email', label: 'Email', required: true }], ctaText: 'Send', skipButtonEnabled: true }),
        clipAt(8, 12, { id: 'cta', type: 'click-to-call', linkUrl: 'https://example.com/buy', buttonText: 'Buy', style: {} }),
        clipAt(9, 10, { id: 'sk', type: 'addon-skip', addon: {} }),
        clipAt(1, 15, { id: 'txt', type: 'overlay-text', addon: { text: 'Hello {{firstname}}{{company}}', linkUrl: 'https://example.com/site', geometry: { left: 10, top: 10, width: 30, height: 10 } } }),
      ] },
    ],
    listBuilder: null,
  };
}

function fakeEngine() {
  const e = { frame: 0, playing: false, model: null, onFrame: null };
  const create = (host, o) => {
    e.model = o.model;
    e.onFrame = o.onFrame;
    e.onEnded = o.onEnded;
    return {
      play: () => { e.playing = true; },
      pause: () => { e.playing = false; },
      seekToFrame: (f) => { e.frame = f; },
      update: (m) => { e.model = m; },
      destroy: vi.fn(),
    };
  };
  // Simulate playback reaching `sec`.
  e.advance = (sec) => { if (e.playing) { e.frame = Math.round(sec * 30); e.onFrame(e.frame); } };
  return { e, create };
}

describe('viewer-safe lead errors', () => {
  it('returns the server message as `fix` only for a 400', async () => {
    const mk = (status, body) => vi.fn(async () => ({ ok: status < 300, status, json: async () => body }));
    const cfg = { url: 'https://x.supabase.co', key: 'k' };
    const bad = await submitViewerLead({ publishedId: 'Abc123XyZ9', clipId: 'a', kind: 'list-builder', data: { EMAIL: 'x@mailinator.com' } }, { ...cfg, fetchImpl: mk(400, { ok: false, error: 'Please use a permanent email address.' }) });
    expect(bad).toMatchObject({ stored: false, fix: 'Please use a permanent email address.' });
    const down = await submitViewerLead({ publishedId: 'Abc123XyZ9', clipId: 'a', kind: 'list-builder', data: { EMAIL: 'a@b.co' } }, { ...cfg, fetchImpl: mk(500, { ok: false, error: 'Boom' }) });
    expect(down.fix).toBeNull();
  });
  it('sends the bot signals next to the answers, not inside them', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, stored: true }) }));
    await submitViewerLead({ publishedId: 'Abc123XyZ9', clipId: 'a', kind: 'list-builder', data: { EMAIL: 'a@b.co' }, signals: { hp: '', ms: 4200 } }, { url: 'https://x.supabase.co', key: 'k', fetchImpl });
    const sent = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(sent.data).toEqual({ EMAIL: 'a@b.co' });
    expect(sent.signals).toEqual({ hp: '', ms: 4200 });
    await submitViewerLead({ publishedId: 'Abc123XyZ9', clipId: 'a', kind: 'list-builder', data: { EMAIL: 'a@b.co' }, signals: { hp: '' } }, { url: 'https://x.supabase.co', key: 'k', fetchImpl });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).signals).toEqual({ hp: '' }); // prefilled: no timing
  });
});

describe('viewer lead: A/B version', () => {
  it('sends the version inside source, only when it is A or B', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, stored: true }) }));
    const base = { publishedId: 'Abc123XyZ9', clipId: 'a', kind: 'list-builder', data: { EMAIL: 'a@b.co' } };
    const env = { url: 'https://x.supabase.co', key: 'k', fetchImpl };
    await submitViewerLead({ ...base, variant: 'B' }, env);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).source.variant).toBe('B');
    await submitViewerLead({ ...base, variant: '' }, env);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).source).not.toHaveProperty('variant');
    await submitViewerLead({ ...base, variant: 'Z' }, env);
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body).source).not.toHaveProperty('variant');
  });
});

describe('viewer lead: viewing session', () => {
  it('sends the session id inside source only when it is well formed', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, stored: true }) }));
    const base = { publishedId: 'Abc123XyZ9', clipId: 'a', kind: 'list-builder', data: { EMAIL: 'a@b.co' } };
    const env = { url: 'https://x.supabase.co', key: 'k', fetchImpl };
    await submitViewerLead({ ...base, session: 'abcDEF1234567890abcd' }, env);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).source.session).toBe('abcDEF1234567890abcd');
    for (const [i, bad] of [null, '', 'short', 'bad session id!!!!!!!!'].entries()) {
      await submitViewerLead({ ...base, session: bad }, env);
      expect(JSON.parse(fetchImpl.mock.calls[i + 1][1].body).source).not.toHaveProperty('session');
    }
  });
});

describe('publish client', () => {
  it('makes unguessable slugs and share links', () => {
    const s = makeSlug();
    expect(s).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(makeSlug()).not.toBe(s);
    expect(watchUrl('abc12345XY', 'https://app.test')).toBe('https://app.test/watch/abc12345XY');
    expect(embedCode('abc12345XY', 'https://app.test')).toContain('src="https://app.test/watch/abc12345XY?embed=1"');
  });

  it('prepares a clean snapshot and refuses local media', () => {
    const state = { projectTitle: 'P', timelineSeconds: 30, tracks: [{ id: 'v', name: 'Main', type: 'video', items: [{ id: 1, type: 'lead-form', _submitted: true, _gating: true, lastError: 'x', fields: [] }] }], listBuilder: { enabled: true, _submitted: true, kind: 'list-builder' } };
    const p = preparePublishProject(state, { title: 'My video' });
    expect(p).toMatchObject({ version: 1, title: 'My video', timelineSeconds: 30, listBuilder: { enabled: true, kind: 'list-builder' } });
    expect(p.tracks[0].items[0]).toEqual({ id: 1, type: 'lead-form', fields: [] });
    expect(p.listBuilder._submitted).toBeUndefined();
    state.tracks[0].items.push({ id: 2, type: 'video', src: 'blob:http://x/1', addon: { src: 'blob:http://x/2' } });
    expect(localSources(state.tracks)).toEqual(['blob:http://x/1', 'blob:http://x/2']);
    expect(() => preparePublishProject(state)).toThrow(/only on this computer/);
  });

  it('passes Video Outreach landing text through, cleaned', () => {
    const p = preparePublishProject({
      tracks: [], timelineSeconds: 10, kind: 'outreach', campaign: { name: '  Cold   outreach ', contacts: '12', extra: 1 },
      landing: { header: 'Hi {{firstname}}'.padEnd(300, '!'), message: 'Hello', fallbacks: { firstname: 'there', 'bad key': 'x' }, cta: { label: 'Book', url: 'https://cal.com/x' } },
    }, { title: 'Campaign' });
    expect(p.kind).toBe('outreach');
    expect(p.campaign).toEqual({ name: 'Cold outreach', contacts: 12 });
    expect(p.landing.header).toHaveLength(200);
    expect(p.landing.fallbacks).toEqual({ firstname: 'there' });
    expect(p.landing.cta).toEqual({ label: 'Book', url: 'https://cal.com/x' });
    expect(cleanLanding({ cta: { label: 'Go', url: 'http://cal.com/x' } }).cta).toBeNull();
    expect(cleanLanding({ cta: { label: 'Go', url: 'javascript:alert(1)' } }).cta).toBeNull();
    expect(cleanLanding({ cta: { label: 'Go', url: 'https://cal.com/x', embed: true } }).cta).toEqual({ label: 'Go', url: 'https://cal.com/x', embed: true });
    expect(cleanLanding({ cta: { label: 'Go', url: 'https://cal.com/x', embed: 'yes' } }).cta).toEqual({ label: 'Go', url: 'https://cal.com/x' });
    // Ordinary videos are unchanged.
    const plain = preparePublishProject({ tracks: [], kind: 'something' });
    expect(plain).not.toHaveProperty('kind');
    expect(plain).not.toHaveProperty('landing');
  });

  it('uploads local media and swaps the URLs in the timeline', async () => {
    const state = { tracks: [{ items: [{ id: 2, type: 'video', src: 'blob:http://x/1', addon: { src: 'blob:http://x/1' } }] }] };
    const upload = vi.fn(async () => 'https://storage/x.webm');
    const n = await uploadLocalMedia(state, { getBlob: () => new Blob(['x'], { type: 'video/webm' }), upload });
    expect(n).toBe(1);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(state.tracks[0].items[0]).toMatchObject({ src: 'https://storage/x.webm', addon: { src: 'https://storage/x.webm' } });
    await expect(uploadLocalMedia({ tracks: [{ items: [{ src: 'blob:z' }] }] }, { getBlob: () => new Blob(['x']), upload: async () => null })).rejects.toThrow(/Upload failed/);
  });

  it('publishes via upsert and reads/submits via REST', async () => {
    const single = vi.fn(async () => ({ data: { id: 'abcdefgh12' }, error: null }));
    const upsert = vi.fn(() => ({ select: () => ({ single }) }));
    const client = { from: vi.fn(() => ({ upsert })) };
    await publishVideo(client, { id: 'abcdefgh12', project: { title: 'T' } });
    expect(client.from).toHaveBeenCalledWith('published_videos');
    expect(upsert.mock.calls[0][0]).toMatchObject({ id: 'abcdefgh12', title: 'T', published: true });

    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'abcdefgh12', project: { tracks: [] } }) }));
    const v = await fetchPublishedVideo('abcdefgh12', { url: 'https://sb', key: 'anon', fetchImpl });
    expect(v.id).toBe('abcdefgh12');
    // Public read goes through the sanitizing RPC, never the table.
    expect(fetchImpl.mock.calls[0][0]).toBe('https://sb/rest/v1/rpc/get_published_video');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ p_id: 'abcdefgh12' });
    expect(await fetchPublishedVideo('../etc', { url: 'https://sb', key: 'k', fetchImpl })).toBeNull();
    // Readable links resolve by business + slug; invalid ones never hit the network.
    await fetchPublishedVideo({ business: 'acme-roofing', slug: 'spring-promo' }, { url: 'https://sb', key: 'anon', fetchImpl });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({ p_business: 'acme-roofing', p_slug: 'spring-promo' });
    expect(await fetchPublishedVideo({ business: 'admin', slug: 'x' }, { url: 'https://sb', key: 'k', fetchImpl })).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const post = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, stored: true }) }));
    expect(await submitViewerLead({ publishedId: 'abcdefgh12', clipId: 5, kind: 'lead-form', data: { EMAIL: 'a@b.c' } }, { url: 'https://sb', key: 'anon', fetchImpl: post })).toEqual({ stored: true, error: null });
    const body = JSON.parse(post.mock.calls[0][1].body);
    expect(body).toMatchObject({ publishedId: 'abcdefgh12', clipId: '5', kind: 'lead-form', data: { EMAIL: 'a@b.c' } });
    expect(body.webhooks).toBeUndefined();
  });

  it('reads personalization from the link', () => {
    expect(profileFromQuery('?firstname=Ann&embed=1&company=Acme')).toEqual({ variables: { firstname: 'Ann', company: 'Acme' } });
    expect(profileFromQuery('?embed=1')).toBeNull();
    expect(profileFromQuery('?src=mp4')).toBeNull();
    expect(personalize('Hi {{firstname}}!', null)).toBe('Hi !');
    expect(stripUnresolvedTokens({ text: 'A {{x}} B', src: '{{keep}}' })).toEqual({ text: 'A B', src: '{{keep}}' });
    expect(profileWithAnswers(null, { 'FIRST NAME': 'Zoe' }).variables.firstname).toBe('Zoe');
  });
});

describe('interactive player', () => {
  let frame;
  beforeEach(() => {
    document.body.innerHTML = '';
    frame = document.createElement('div');
    document.body.appendChild(frame);
  });

  it('pauses, gates on the lead form, shows CTA/links, skips, and personalizes', async () => {
    const { e, create } = fakeEngine();
    const onLead = vi.fn(async () => ({ stored: true, error: null }));
    const player = createInteractivePlayer({ project: project(), stage: frame, frame, createEngine: create, profile: { variables: { firstname: 'Ann' } }, onLead });
    const textLayer = e.model.layers.find((l) => l.id === 'txt');
    expect(textLayer.options.text).toBe('Hello Ann'); // {{company}} unresolved → removed
    expect(frame.querySelector('.wf-linkbox')).toBeNull();

    player.play();
    e.advance(1.5);
    expect(frame.querySelector('.wf-linkbox').getAttribute('href')).toBe('https://example.com/site');
    e.advance(2.2);
    expect(player.playing).toBe(false);
    expect(frame.textContent).toContain('Go on');
    player.play(); // continue
    expect(player.playing).toBe(true);
    e.advance(5.2);
    expect(player.playing).toBe(false);
    const form = frame.querySelector('.addon-overlay--optin form');
    expect(frame.querySelector('.retarget-caption').textContent).toBe('Hi Ann');
    player.play();
    expect(player.playing).toBe(false); // gated until submit/skip
    form.querySelector('input').value = 'ann@example.com';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(onLead).toHaveBeenCalledWith({ clipId: 'lf', kind: 'lead-form', data: { EMAIL: 'ann@example.com' }, signals: expect.objectContaining({ hp: '' }) });
    expect(player.playing).toBe(true);
    expect(frame.querySelector('.addon-overlay--optin')).toBeNull();
    e.advance(8.5);
    const cta = frame.querySelector('.wf-cta');
    expect(cta.getAttribute('href')).toBe('https://example.com/buy');
    expect(cta.target).toBe('_blank');
    e.advance(9.2); // inside the skip clip → jumps to 10s
    expect(player.time).toBeCloseTo(10, 1);
    e.advance(12.5);
    expect(frame.querySelector('.wf-cta')).toBeNull();
    // Seeking back re-arms the pause but not the submitted form.
    player.seek(0);
    player.play();
    e.advance(2.3);
    expect(player.playing).toBe(false);
    player.play();
    e.advance(5.5);
    expect(frame.querySelector('.addon-overlay--optin')).toBeNull();
    player.destroy();
  });

  it('List Builder gates at the start; Personalizer answers personalize the video', async () => {
    const { e, create } = fakeEngine();
    const p = project();
    p.listBuilder = { enabled: true, kind: 'personalizer', elements: [{ id: 'firstname', type: 'singleline', label: 'First name' }], caption: 'Tell us your name' };
    const onLead = vi.fn(async () => ({ stored: true }));
    const player = createInteractivePlayer({ project: p, stage: frame, frame, createEngine: create, onLead });
    player.play();
    expect(player.playing).toBe(false);
    const form = frame.querySelector('form');
    expect(form).not.toBeNull();
    const input = form.querySelector('input');
    input.value = 'Zoe';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(onLead.mock.calls[0][0]).toMatchObject({ clipId: 'list-builder', kind: 'personalizer' });
    expect(e.model.layers.find((l) => l.id === 'txt').options.text).toBe('Hello Zoe');
    expect(player.playing).toBe(true);
  });
});

describe('form answers go into the video', () => {
  let frame;
  beforeEach(() => {
    document.body.innerHTML = '';
    frame = document.createElement('div');
    document.body.appendChild(frame);
  });
  const submit = async (value) => {
    const form = frame.querySelector('form');
    form.querySelector('input').value = value;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
  };

  it('List Builder (not just Personalizer) fills {{tokens}} with what the viewer typed', async () => {
    const { e, create } = fakeEngine();
    const p = project();
    p.listBuilder = { enabled: true, kind: 'list-builder', elements: [{ id: 'firstname', type: 'singleline', label: 'First name' }], caption: 'Join the list' };
    const player = createInteractivePlayer({ project: p, stage: frame, frame, createEngine: create, onLead: async () => ({ stored: true }) });
    // Registration wall: the video isn't even loaded until the form is submitted.
    expect(e.model).toBeNull();
    expect(frame.querySelector('.addon-overlay--optin')).not.toBeNull();
    player.play();
    player.seek(5); // no scrubbing past the form
    expect(e.model).toBeNull();
    expect(player.time).toBe(0);
    await submit('Zoe');
    expect(e.model.layers.find((l) => l.id === 'txt').options.text).toBe('Hello Zoe');
    expect(e.playing).toBe(true);
  });

  it('List Builder: a lead that was not saved keeps the form open for a retry (no redirect, not remembered)', async () => {
    const store = new Map();
    vi.stubGlobal('localStorage', { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
    try {
      const { e, create } = fakeEngine();
      const p = project();
      p.listBuilder = { enabled: true, kind: 'list-builder', elements: [{ id: 'email', type: 'email', label: 'Email' }], afterSubmitAction: 'redirect', afterSubmitUrl: 'https://a.test/thanks' };
      let ok = false;
      const onLead = vi.fn(async () => (ok ? { stored: true, error: null } : { stored: false, error: 'offline' }));
      createInteractivePlayer({ project: p, stage: frame, frame, createEngine: create, rememberKey: 'vid9', onLead });
      await submit('a@b.co');
      expect(frame.querySelector('.addon-overlay--optin')).not.toBeNull(); // still there
      expect(frame.querySelector('.addon-optin__status').textContent).toMatch(/try again/i);
      expect(frame.querySelector('[data-overlay="thanks"]')).toBeNull();
      expect(store.size).toBe(0); // not marked as done, so it asks again on return
      expect(e.model).toBeNull(); // the video is still behind the wall
      ok = true;
      await submit('a@b.co'); // retry succeeds
      expect(frame.querySelector('.addon-overlay--optin')).toBeNull();
      expect(store.size).toBe(1);
      expect(e.model).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('a submission that finishes after the player was destroyed shows no thank-you card or redirect', async () => {
    const { create } = fakeEngine();
    const p = project();
    p.listBuilder = { enabled: true, kind: 'list-builder', elements: [{ id: 'email', type: 'email', label: 'Email' }], afterSubmitAction: 'redirect', afterSubmitUrl: 'https://a.test/thanks' };
    let finish;
    const onLead = vi.fn(() => new Promise((resolve) => { finish = () => resolve({ stored: true, error: null }); }));
    const player = createInteractivePlayer({ project: p, stage: frame, frame, createEngine: create, onLead });
    const layer = frame.querySelector('.addon-overlay-layer');
    const form = frame.querySelector('form');
    form.querySelector('input').value = 'a@b.co';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 0)); // submit is now in flight
    player.destroy(); // the viewer left the page
    finish();
    await new Promise((r) => setTimeout(r, 0));
    expect(layer.querySelector('[data-overlay="thanks"]')).toBeNull();
  });

  it('a viewer who already filled the List Builder in is not asked again (unless askEveryVisit)', () => {
    const store = new Map();
    const ls = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    vi.stubGlobal('localStorage', ls);
    try {
      const mk = (extra = {}) => {
        const { e, create } = fakeEngine();
        const p = project();
        p.listBuilder = { enabled: true, kind: 'list-builder', elements: [{ id: 'email', type: 'email', label: 'Email' }], ...extra };
        const player = createInteractivePlayer({ project: p, stage: frame, frame, createEngine: create, rememberKey: 'vid1', onLead: async () => ({ stored: true }) });
        return { e, player };
      };
      const first = mk();
      expect(first.e.model).toBeNull();
      first.player.destroy();
      store.set('remix-optin:vid1', '1');
      expect(mk().e.model).not.toBeNull(); // remembered: straight to the video
      expect(mk({ askEveryVisit: true }).e.model).toBeNull(); // asked every visit
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('Lead Generator form answers fill tokens too, by name, company or any canonical token', async () => {
    const { e, create } = fakeEngine();
    const p = project();
    const clips = p.tracks.flatMap((t) => t.items);
    clips.find((c) => c.id === 'lf').fields = [{ id: 'name', type: 'singleline', label: 'Name' }];
    clips.find((c) => c.id === 'txt').addon.text = 'Welcome {{fullName}}';
    const player = createInteractivePlayer({ project: p, stage: frame, frame, createEngine: create, onLead: async () => ({ stored: true }) });
    player.play();
    e.advance(2.2); // the Pause clip
    player.play();
    e.advance(5.2); // the lead form gates here
    await submit('Ann Lee');
    expect(e.model.layers.find((l) => l.id === 'txt').options.text).toBe('Welcome Ann Lee');
    expect(player.playing).toBe(true);
  });

  it('reports when a form is gating playback (so the page can hide the big play button)', async () => {
    const { create } = fakeEngine();
    const p = project();
    p.listBuilder = { enabled: true, kind: 'list-builder', elements: [{ id: 'email', type: 'email', label: 'Email' }], caption: 'Join' };
    const seen = [];
    const player = createInteractivePlayer({ project: p, stage: frame, frame, createEngine: create, onChange: (c) => seen.push(c.gating), onLead: async () => ({ stored: true }) });
    player.play();
    expect(seen.at(-1)).toBe(true);
    await submit('a@b.co');
    expect(seen.at(-1)).toBe(false);
  });

  it('answers are also stored under the studio\'s canonical token', () => {
    const v = profileWithAnswers({ variables: { firstName: 'Old' } }, { 'FIRST NAME': 'Zoe', NAME: 'Zoe Q', COMPANY: 'Acme', EMPTY: '' }).variables;
    expect(v).toMatchObject({ firstName: 'Zoe', fullName: 'Zoe Q', company: 'Acme' });
    expect('empty' in v).toBe(false);
  });
});

describe('viewer overlays', () => {
  it('only renders safe CTA and link targets', () => {
    expect(ctaElement({ id: 1, phoneNumber: '+1 555 123 4567' }).getAttribute('href')).toBe('tel:+15551234567');
    expect(ctaElement({ id: 1, linkUrl: 'javascript:alert(1)' })).toBeNull();
    expect(linkBoxElement({ id: 1, type: 'overlay-text', addon: { linkUrl: 'javascript:x' } })).toBeNull();
  });

  it('lead form validates required fields and shows errors', async () => {
    const layer = document.createElement('div');
    const onSubmit = vi.fn(async () => ({ ok: false, message: 'Nope' }));
    showLeadForm(layer, { id: 'x', fields: [{ id: 'email', type: 'email', label: 'Email', required: true }] }, { onSubmit });
    const form = layer.querySelector('form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(onSubmit).not.toHaveBeenCalled(); // required + empty
    form.querySelector('input').value = 'a@b.co';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(layer.querySelector('.addon-optin__status').textContent).toBe('Nope');
    expect(layer.querySelector('.addon-overlay--optin')).not.toBeNull();
  });
});

describe('share panel and watch page', () => {
  it('publishes and shows link, embed and stats', async () => {
    const box = document.createElement('div');
    const publish = vi.fn(async ({ title }) => ({ id: 'abcdefgh12', title, published: true, view_count: 3 }));
    renderSharePanel(box, { getInfo: async () => null, publish, countLeads: async () => 2, copy: vi.fn(async () => {}), setPublished: vi.fn(), defaultTitle: 'Promo' });
    await new Promise((r) => setTimeout(r, 0));
    box.querySelector('[data-share-publish]').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(publish).toHaveBeenCalledWith({ title: 'Promo' });
    expect(box.querySelector('[data-share-link]').value).toMatch(/\/watch\/abcdefgh12$/);
    expect(box.querySelector('[data-share-embed]').value).toContain('?embed=1');
    expect(box.textContent).toContain('3 views');
    expect(box.textContent).toContain('2 leads');
  });

  it('watch page loads a video and plays it', async () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    const { e, create } = fakeEngine();
    const analytics = { track: vi.fn(), onPlayerChange: vi.fn(), destroy: vi.fn() };
    const player = await mountWatchPage(box, 'abcdefgh12', { fetchVideo: async () => ({ id: 'abcdefgh12', title: 'Demo', project: project() }), createEngine: create, analytics, onLead: vi.fn() });
    expect(box.querySelector('h1').textContent).toBe('Demo');
    box.querySelector('[data-bigplay]').click();
    expect(e.playing).toBe(true);
    e.advance(1);
    expect(box.querySelector('[data-time]').textContent).toBe('0:01');
    expect(box.querySelector('[data-play]').getAttribute('aria-label')).toBe('Pause');
    player.destroy();
    const missing = document.createElement('div');
    expect(await mountWatchPage(missing, 'nope12345', { fetchVideo: async () => null })).toBeNull();
    expect(missing.textContent).toContain('Video not found');
  });

  it('watch page shows a Video Outreach landing: personalized header, message and booking button', async () => {
    const landing = {
      header: 'Hi {{firstname}}, I made this for you',
      message: 'Excited to help {{company}} <b>grow</b>.',
      fallbacks: { firstname: 'there', company: 'your company' },
      cta: { label: 'Book a call', url: 'https://cal.com/me/intro' },
    };
    const mount = async (search) => {
      window.history.replaceState(null, '', `/watch/abcdefgh12${search}`);
      const box = document.createElement('div');
      document.body.appendChild(box);
      const analytics = { track: vi.fn(), onPlayerChange: vi.fn(), destroy: vi.fn() };
      const player = await mountWatchPage(box, 'abcdefgh12', { fetchVideo: async () => ({ id: 'abcdefgh12', title: 'Campaign', project: { ...project(), kind: 'outreach', landing } }), createEngine: fakeEngine().create, analytics, onLead: vi.fn() });
      return { box, analytics, player };
    };
    const a = await mount('?c=c1&firstName=Mike&company=Acme');
    expect(a.box.querySelector('h1').textContent).toBe('Hi Mike, I made this for you');
    // Escaped: viewer-controlled values and owner text never become markup.
    expect(a.box.querySelector('.watch-landing-msg').textContent).toBe('Excited to help Acme <b>grow</b>.');
    expect(a.box.querySelector('.watch-landing-msg b')).toBeNull();
    const cta = a.box.querySelector('[data-landing-cta]');
    expect(cta.getAttribute('href')).toBe('https://cal.com/me/intro');
    expect(cta.getAttribute('rel')).toContain('noopener');
    cta.addEventListener('click', (ev) => ev.preventDefault());
    cta.click();
    expect(a.analytics.track).toHaveBeenCalledWith('cta_click', expect.objectContaining({ props: { label: 'Book a call' } }));
    a.player.destroy();
    // No personal link: fallbacks fill in.
    const b = await mount('');
    expect(b.box.querySelector('h1').textContent).toBe('Hi there, I made this for you');
    expect(b.box.querySelector('.watch-landing-msg').textContent).toBe('Excited to help your company <b>grow</b>.');
    b.player.destroy();
    // A non-https booking link is never rendered.
    landing.cta = { label: 'Book', url: 'javascript:alert(1)' };
    const c = await mount('');
    expect(c.box.querySelector('[data-landing-cta]')).toBeNull();
    c.player.destroy();
    window.history.replaceState(null, '', '/');
  });
});

describe('watch page transcript (Video Outreach captions)', () => {
  const transcript = { lang: 'en', lines: [{ startMs: 0, endMs: 2000, text: 'Hi there.' }, { startMs: 2000, endMs: 5000, text: 'I made this for you.' }], translations: { es: [{ startMs: 0, endMs: 2000, text: 'Hola.' }, { startMs: 2000, endMs: 5000, text: 'Lo hice para ti.' }] } };
  const mount = async (search, extra = {}) => {
    window.history.replaceState(null, '', `/watch/abcdefgh12${search}`);
    const box = document.createElement('div');
    document.body.appendChild(box);
    const engine = fakeEngine();
    const analytics = { track: vi.fn(), onPlayerChange: vi.fn(), destroy: vi.fn() };
    const player = await mountWatchPage(box, 'abcdefgh12', { fetchVideo: async () => ({ id: 'abcdefgh12', title: 'Campaign', project: { ...project(), kind: 'outreach', ...extra } }), createEngine: engine.create, analytics, onLead: vi.fn() });
    return { box, player };
  };
  it('lists every line with its time, switches language, and a line jumps the video there', async () => {
    const { box, player } = await mount('', { transcript });
    const rows = [...box.querySelectorAll('.watch-transcript-line')];
    expect(rows.map((r) => r.textContent)).toEqual(['0:00Hi there.', '0:02I made this for you.']);
    const sel = box.querySelector('[data-transcript-lang]');
    sel.value = 'es'; sel.dispatchEvent(new Event('change'));
    expect(box.querySelector('[data-transcript-lines]').textContent).toContain('Lo hice para ti.');
    const seek = vi.spyOn(player, 'seek');
    box.querySelectorAll('.watch-transcript-line')[1].click();
    expect(seek).toHaveBeenCalledWith(2);
  });
  it('no transcript without captions, and none in the embedded player', async () => {
    expect((await mount('')).box.querySelector('[data-transcript]')).toBeNull();
    expect((await mount('?embed=1', { transcript })).box.querySelector('[data-transcript]')).toBeNull();
  });
});

describe('watch page button text test (Video Outreach)', () => {
  const landing = { header: 'Hi', message: '', fallbacks: {}, cta: { label: 'Book a call', labelB: 'Get my demo', url: 'https://cal.com/me/intro' } };
  const mount = async (search, lan = landing) => {
    window.history.replaceState(null, '', `/watch/abcdefgh12${search}`);
    const box = document.createElement('div');
    document.body.appendChild(box);
    const analytics = { track: vi.fn(), onPlayerChange: vi.fn(), destroy: vi.fn() };
    const player = await mountWatchPage(box, 'abcdefgh12', { fetchVideo: async () => ({ id: 'abcdefgh12', title: 'Campaign', project: { ...project(), kind: 'outreach', landing: lan } }), createEngine: fakeEngine().create, analytics, onLead: vi.fn() });
    return { box, analytics, player };
  };
  const withRandom = async (value, fn) => { const spy = vi.spyOn(Math, 'random').mockReturnValue(value); try { return await fn(); } finally { spy.mockRestore(); } };

  it('shows one of the two texts and records the text that was clicked', async () => {
    localStorage.clear();
    const a = await withRandom(0.2, () => mount(''));
    expect(a.box.querySelector('[data-landing-cta]').textContent).toBe('Book a call');
    a.player.destroy(); localStorage.clear();
    const b = await withRandom(0.9, () => mount(''));
    const cta = b.box.querySelector('[data-landing-cta]');
    expect(cta.textContent).toBe('Get my demo');
    cta.addEventListener('click', (ev) => ev.preventDefault());
    cta.click();
    expect(b.analytics.track).toHaveBeenCalledWith('cta_click', expect.objectContaining({ props: { label: 'Get my demo' } }));
    b.player.destroy();
  });

  it('a returning viewer sees the same text (full tracking), and nothing is stored in anonymous mode', async () => {
    localStorage.clear();
    const first = await withRandom(0.9, () => mount(''));
    first.player.destroy();
    const again = await withRandom(0.1, () => mount(''));
    expect(again.box.querySelector('[data-landing-cta]').textContent).toBe('Get my demo');
    again.player.destroy(); localStorage.clear();
    const anon = await withRandom(0.9, () => mount('?consent=anonymous'));
    expect(anon.box.querySelector('[data-landing-cta]').textContent).toBe('Get my demo');
    expect(localStorage.getItem('remix-ab:cta:abcdefgh12')).toBeNull();
    anon.player.destroy();
    window.history.replaceState(null, '', '/');
  });

  it('without a second text the page is unchanged', async () => {
    const one = await withRandom(0.9, () => mount('', { ...landing, cta: { label: 'Book a call', url: 'https://cal.com/me/intro' } }));
    expect(one.box.querySelector('[data-landing-cta]').textContent).toBe('Book a call');
    one.player.destroy();
    window.history.replaceState(null, '', '/');
  });
});

describe('the second button text survives publishing', () => {
  it('cleanLanding keeps a different second text, trimmed and limited, and drops one that adds nothing', () => {
    const cta = { label: 'Book a call', url: 'https://cal.com/x' };
    expect(cleanLanding({ cta: { ...cta, labelB: '  Get my demo ' } }).cta).toEqual({ ...cta, labelB: 'Get my demo' });
    expect(cleanLanding({ cta: { ...cta, labelB: 'x'.repeat(100) } }).cta.labelB).toHaveLength(60);
    expect(cleanLanding({ cta: { ...cta, labelB: 'BOOK A CALL' } }).cta).not.toHaveProperty('labelB');
    expect(cleanLanding({ cta: { ...cta, labelB: '   ' } }).cta).not.toHaveProperty('labelB');
    expect(cleanLanding({ cta: { ...cta, labelB: 42 } }).cta).not.toHaveProperty('labelB');
    expect(cleanLanding({ cta: { label: 'Go', url: 'http://insecure.example/x', labelB: 'Other' } }).cta).toBeNull();
  });
});

describe('watch page with blocked site storage and a button text test', () => {
  it('still plays: reading localStorage throws, so the pick is simply not remembered', async () => {
    const landing = { header: 'Hi', message: '', fallbacks: {}, cta: { label: 'Book a call', labelB: 'Get my demo', url: 'https://cal.com/me/intro' } };
    window.history.replaceState(null, '', '/watch/abcdefgh12');
    const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw Object.assign(new Error('blocked'), { name: 'SecurityError' }); });
    const box = document.createElement('div');
    document.body.appendChild(box);
    try {
      const player = await mountWatchPage(box, 'abcdefgh12', { fetchVideo: async () => ({ id: 'abcdefgh12', title: 'Campaign', project: { ...project(), kind: 'outreach', landing } }), createEngine: fakeEngine().create, analytics: { track: vi.fn(), onPlayerChange: vi.fn(), destroy: vi.fn() }, onLead: vi.fn() });
      expect(['Book a call', 'Get my demo']).toContain(box.querySelector('[data-landing-cta]').textContent);
      player.destroy();
    } finally { spy.mockRestore(); window.history.replaceState(null, '', '/'); }
  });
});
