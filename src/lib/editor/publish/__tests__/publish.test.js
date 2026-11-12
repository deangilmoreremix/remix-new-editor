import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeSlug, preparePublishProject, uploadLocalMedia, localSources, publishVideo, fetchPublishedVideo, submitViewerLead, profileFromQuery, embedCode, watchUrl,
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
    expect(fetchImpl.mock.calls[0][0]).toBe('https://sb/rest/v1/rpc/get_published_video'); // the database strips private keys; legacy table read is only a fallback
    expect(await fetchPublishedVideo('../etc', { url: 'https://sb', key: 'k', fetchImpl })).toBeNull();

    const post = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, stored: true }) }));
    expect(await submitViewerLead({ publishedId: 'abcdefgh12', clipId: 5, kind: 'lead-form', data: { EMAIL: 'a@b.c' } }, { url: 'https://sb', key: 'anon', fetchImpl: post })).toEqual({ stored: true, error: null });
    const body = JSON.parse(post.mock.calls[0][1].body);
    expect(body).toMatchObject({ publishedId: 'abcdefgh12', clipId: '5', kind: 'lead-form', data: { EMAIL: 'a@b.c' } });
    expect(body.webhooks).toBeUndefined();
  });

  it('reads personalization from the link', () => {
    expect(profileFromQuery('?firstname=Ann&embed=1&company=Acme')).toEqual({ variables: { firstname: 'Ann', company: 'Acme' } });
    expect(profileFromQuery('?embed=1')).toBeNull();
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
    expect(onLead).toHaveBeenCalledWith({ clipId: 'lf', kind: 'lead-form', data: { EMAIL: 'ann@example.com' } });
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

  it('watch page loads a video, plays it and counts a view', async () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    const { e, create } = fakeEngine();
    const countView = vi.fn();
    const player = await mountWatchPage(box, 'abcdefgh12', { fetchVideo: async () => ({ id: 'abcdefgh12', title: 'Demo', project: project() }), createEngine: create, countView, onLead: vi.fn() });
    expect(box.querySelector('h1').textContent).toBe('Demo');
    expect(countView).toHaveBeenCalledWith('abcdefgh12');
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
});
