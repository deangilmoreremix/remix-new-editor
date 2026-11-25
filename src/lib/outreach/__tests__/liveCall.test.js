import { describe, it, expect, vi } from 'vitest';
import { createGuestLine, createHostLine, createPeerSession, lobbyName, callName, MAX_RINGS } from '../liveCall.js';

const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 0)); };

// Realtime stand-in: channels by name; a broadcast reaches everyone else on the channel.
function fakeBus() {
  const channels = new Map();
  const log = [];
  const join = vi.fn(async (name, { onSignal = () => {}, onPresence, presence } = {}) => {
    if (!channels.has(name)) channels.set(name, new Set());
    const members = channels.get(name);
    const me = { onSignal, onPresence, presence };
    members.add(me);
    const sync = () => { const list = [...members].map((m) => m.presence).filter(Boolean); members.forEach((m) => m.onPresence?.(list)); };
    sync();
    return {
      send: async (msg) => { log.push({ name, msg }); members.forEach((m) => { if (m !== me) m.onSignal(msg); }); },
      leave: () => { members.delete(me); sync(); },
    };
  });
  return { join, log, channels };
}

function fakePeer(name, peers) {
  const pc = {
    name, tracks: [], candidates: [], remoteDescription: null, localDescription: null, connectionState: 'new', closed: false,
    addTrack(t) { this.tracks.push(t); },
    async createOffer() { return { type: 'offer', sdp: `offer-from-${name}` }; },
    async createAnswer() { return { type: 'answer', sdp: `answer-from-${name}` }; },
    async setLocalDescription(d) { this.localDescription = d; setTimeout(() => this.onicecandidate?.({ candidate: { candidate: `cand-${name}` } }), 0); },
    async setRemoteDescription(d) { this.remoteDescription = d; },
    async addIceCandidate(c) { this.candidates.push(c); },
    close() { this.closed = true; },
    connect() { this.connectionState = 'connected'; this.onconnectionstatechange?.(); this.ontrack?.({ streams: [{ id: `stream-${name === 'host' ? 'guest' : 'host'}` }] }); },
  };
  peers.push(pc);
  return pc;
}

const media = () => { const t = { stop: vi.fn() }; return { getTracks: () => [t], t }; };
const campaign = { videoId: 'vid12345', contacts: [{ id: 'c_mike01', firstName: 'Mike', lastName: 'Ross' }] };

async function setup() {
  const bus = fakeBus();
  const peers = [];
  const hostStates = []; const guestStates = [];
  const host = createHostLine({ campaigns: [campaign], hostName: 'Sam', join: bus.join, getMedia: async () => media(), makePeer: () => fakePeer('host', peers), onUpdate: (s) => hostStates.push(s) });
  await host.ready;
  const guest = createGuestLine({ videoId: 'vid12345', contactId: 'c_mike01', join: bus.join, getMedia: async () => media(), makePeer: () => fakePeer('guest', peers), onUpdate: (s) => guestStates.push(s) });
  await guest.ready;
  return { bus, peers, host, guest, hostStates, guestStates };
}

describe('Talk live', () => {
  it('shows the button only while the host is present', async () => {
    const { host, guest } = await setup();
    expect(guest.state()).toMatchObject({ hostOnline: true, hostName: 'Sam' });
    host.destroy();
    expect(guest.state().hostOnline).toBe(false);
  });

  it('rings without names in the lobby, connects on accept, and hangs up', async () => {
    const { bus, peers, host, guest } = await setup();
    await guest.call();
    const ring = bus.log.find((e) => e.msg.type === 'ring');
    expect(ring.name).toBe(lobbyName('vid12345'));
    expect(ring.msg).toEqual({ type: 'ring', callId: expect.any(String), contactId: 'c_mike01' }); // no name, no SDP
    expect(guest.state().phase).toBe('ringing');
    expect(host.state().incoming).toMatchObject({ name: 'Mike Ross', videoId: 'vid12345' });

    await host.accept();
    await flush();
    const callId = ring.msg.callId;
    const onCall = bus.log.filter((e) => e.name === callName('vid12345', callId)).map((e) => e.msg.type);
    expect(onCall).toEqual(expect.arrayContaining(['accept', 'offer', 'answer', 'ice']));
    const [hostPc] = peers.filter((p) => p.name === 'host');
    const [guestPc] = peers.filter((p) => p.name === 'guest');
    expect(hostPc.remoteDescription).toEqual({ type: 'offer', sdp: 'offer-from-guest' });
    expect(guestPc.remoteDescription).toEqual({ type: 'answer', sdp: 'answer-from-host' });
    expect(hostPc.candidates).toContainEqual({ candidate: 'cand-guest' });
    expect(guestPc.candidates).toContainEqual({ candidate: 'cand-host' });
    // The lobby only ever carried ring/taken: offers and candidates went to the private call channel.
    expect(bus.log.filter((e) => e.name === lobbyName('vid12345')).map((e) => e.msg.type)).toEqual(['ring', 'taken']);

    guestPc.connect(); hostPc.connect();
    expect(guest.state()).toMatchObject({ phase: 'live', remote: { id: 'stream-host' } });
    expect(host.state()).toMatchObject({ phase: 'live', remote: { id: 'stream-guest' } });

    guest.hangup();
    await flush();
    expect(guest.state().phase).toBe('ended');
    expect(host.state().phase).toBe('ended');
    expect(guestPc.closed && hostPc.closed).toBe(true);
  });

  it('a decline or no answer offers the booking button instead', async () => {
    const { host, guest } = await setup();
    await guest.call();
    await host.decline();
    await flush();
    expect(guest.state().phase).toBe('declined');

    let fire = null;
    const bus = fakeBus();
    const h2 = createHostLine({ campaigns: [campaign], join: bus.join });
    await h2.ready;
    const g2 = createGuestLine({ videoId: 'vid12345', join: bus.join, getMedia: async () => media(), setTimer: (fn) => { fire = fn; return 1; }, clearTimer: () => {} });
    await g2.ready;
    await g2.call();
    expect(h2.state().incoming).toBeTruthy();
    fire(); // 30 seconds, nobody answered
    expect(g2.state().phase).toBe('missed');
    expect(h2.state().incoming).toBeNull(); // the ring was cancelled
  });

  it('a second caller hears busy, and rings are limited per page', async () => {
    const { bus, host, guest } = await setup();
    await guest.call();
    const other = createGuestLine({ videoId: 'vid12345', join: bus.join, getMedia: async () => media() });
    await other.ready;
    await other.call();
    await flush();
    expect(other.state().phase).toBe('declined');
    expect(host.state().incoming.name).toBe('Mike Ross');

    const limited = createGuestLine({ videoId: 'vid12345', join: bus.join, getMedia: async () => media(), setTimer: () => 1, clearTimer: () => {} });
    await limited.ready;
    for (let i = 0; i < MAX_RINGS + 2; i++) { await limited.call(); limited.hangup(); }
    expect(bus.log.filter((e) => e.msg.type === 'ring').length).toBe(2 + MAX_RINGS);
  });

  it('asks for camera access and says so when refused', async () => {
    const bus = fakeBus();
    const host = createHostLine({ campaigns: [campaign], join: bus.join });
    await host.ready;
    const guest = createGuestLine({ videoId: 'vid12345', join: bus.join, getMedia: async () => { throw Object.assign(new Error('no'), { name: 'NotAllowedError' }); } });
    await guest.ready;
    await guest.call();
    expect(guest.state()).toMatchObject({ phase: 'idle', error: expect.stringMatching(/Allow your camera/) });
    expect(host.state().incoming).toBeNull();
  });

  it('queues candidates that arrive before the description', async () => {
    const peers = [];
    const s = createPeerSession({ role: 'guest', send: () => {}, makePeer: () => fakePeer('g', peers) });
    await s.handle({ type: 'ice', from: 'host', candidate: { candidate: 'early' } });
    expect(peers[0].candidates).toEqual([]);
    await s.handle({ type: 'answer', sdp: 'a' });
    expect(peers[0].candidates).toEqual([{ candidate: 'early' }]);
    await s.handle({ type: 'ice', from: 'guest', candidate: { candidate: 'mine' } }); // our own: ignored
    expect(peers[0].candidates).toHaveLength(1);
  });
});

describe('Talk live settings', async () => {
  const { buildCampaignProject, defaultDraft, liveCampaigns } = await import('../draft.js');
  const base = () => ({
    ...defaultDraft(),
    video: { url: 'https://cdn.x/rec.mp4', duration: 20, hasAudio: true, type: 'camera' },
    voice: { mode: 'stock', stockVoice: 'Wise_Woman', cloneVoiceId: '', consent: null, fallbackUrl: 'https://cdn.x/fb.mp3', fallbackDuration: 1.2 },
    contacts: [{ id: 'c1', firstName: 'Mike', email: 'm@x.co' }],
    sender: { ...defaultDraft().sender, name: 'Sam Lee' },
    cta: { ...defaultDraft().cta, url: 'https://cal.com/sam/intro' },
  });

  it('puts the host\'s first name on the page only when Talk live is on', () => {
    expect(buildCampaignProject(base(), { now: 1 }).landing.live).toBeUndefined();
    const on = buildCampaignProject({ ...base(), cta: { ...base().cta, live: true } }, { now: 1 });
    expect(on.landing.live).toEqual({ host: 'Sam' });
  });

  it('lists generated campaigns that allow live calls', () => {
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
    storage.setItem('outreach-library-v1', JSON.stringify({
      a: { savedAt: 1, draft: { name: 'Q4', cta: { live: true }, campaign: { id: 'vidAAAA1' }, contacts: [{ id: 'c1', firstName: 'Mike', lastName: 'Ross', email: 'm@x', company: 'secret' }] } },
      b: { savedAt: 2, draft: { name: 'Off', cta: { live: false }, campaign: { id: 'vidBBBB1' }, contacts: [] } },
      c: { savedAt: 3, draft: { name: 'Draft', cta: { live: true }, campaign: null, contacts: [] } },
    }));
    expect(liveCampaigns(storage)).toEqual([{ videoId: 'vidAAAA1', name: 'Q4', contacts: [{ id: 'c1', firstName: 'Mike', lastName: 'Ross', email: 'm@x' }] }]);
    expect(liveCampaigns(storage, { name: 'Now', cta: { live: true }, campaign: { id: 'vidCCCC1' }, contacts: [] }).map((c) => c.videoId)).toEqual(['vidAAAA1', 'vidCCCC1']);
  });
});
