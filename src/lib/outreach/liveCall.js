// src/lib/outreach/liveCall.js
//
// "Talk live" on a Video Outreach landing page (WebRTC). A prospect watching their video can call you
// while you have the studio open and are available.
//
// Signalling goes over Supabase Realtime (public broadcast channels, the anon key):
//   lobby  `live:<videoId>`            you announce yourself with Presence; a prospect rings with only a
//                                      random call id and their contact id (no names: other prospects of the
//                                      same campaign can join the lobby); you look the name up in your list.
//   call   `live:<videoId>:<callId>`   the two of you, for accept/decline, offer/answer, ICE candidates, bye.
// Media goes peer to peer (a public STUN server finds the route; there is no TURN relay, so a strict
// company network can stop a call from connecting: the page then offers the booking button).

export const RING_TIMEOUT_MS = 30000;
export const MAX_RINGS = 3; // per page load
export const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
export const lobbyName = (videoId) => `live:${videoId}`;
export const callName = (videoId, callId) => `live:${videoId}:${callId}`;
const randomId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, '');
const SAFE = /^[A-Za-z0-9_-]{8,64}$/;

export const liveCallSupported = (g = globalThis) => !!(g.RTCPeerConnection && g.navigator?.mediaDevices?.getUserMedia);

/** Camera and mic, or the mic alone when there is no camera. */
export async function getCallMedia(md = globalThis.navigator?.mediaDevices) {
  try { return await md.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 360 } }, audio: true }); } catch (err) {
    if (err?.name === 'NotAllowedError') throw err;
    return md.getUserMedia({ video: false, audio: true });
  }
}

// ---- Transport: Supabase Realtime -------------------------------------------------------------

let realtime = null;
async function realtimeClient() {
  if (realtime) return realtime;
  const { RealtimeClient } = await import('@supabase/realtime-js');
  const env = import.meta.env || {};
  const url = String(env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Live calls are not set up on this site.');
  realtime = new RealtimeClient(`${url.replace(/^http/, 'ws')}/realtime/v1`, { params: { apikey: key } });
  return realtime;
}

/**
 * Join a channel. `onSignal(msg)` gets broadcasts from others; `onPresence(list)` the people present.
 * `presence` (optional) announces this tab. Resolves { send, leave } once joined.
 */
export async function joinChannel(name, { onSignal = () => {}, onPresence, presence } = {}) {
  const rt = await realtimeClient();
  // The client keeps one channel per topic: a channel left over from an earlier call is dropped first.
  for (const old of rt.getChannels?.() || []) if (old.topic === `realtime:${name}`) { try { rt.removeChannel(old); } catch { /* gone */ } }
  const ch = rt.channel(name, { config: { broadcast: { self: false }, presence: { key: randomId() } } });
  ch.on('broadcast', { event: 'sig' }, ({ payload }) => onSignal(payload || {}));
  if (onPresence) ch.on('presence', { event: 'sync' }, () => onPresence(Object.values(ch.presenceState()).flat()));
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Could not reach the live call service.')), 10000);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') { clearTimeout(t); if (presence) ch.track(presence); resolve(); }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(t); reject(new Error('Could not reach the live call service.')); }
    });
  });
  return {
    send: (msg) => ch.send({ type: 'broadcast', event: 'sig', payload: msg }),
    leave: () => { try { ch.untrack?.(); } catch { /* gone */ } try { rt.removeChannel(ch); } catch { /* gone */ } },
  };
}

// ---- One call: the WebRTC peer connection ------------------------------------------------------

/**
 * `role` 'guest' makes the offer, 'host' answers. `send` posts to the call channel.
 * Returns { offer, handle(msg), close }. onState: 'connecting' | 'live' | 'failed' | 'ended'.
 */
export function createPeerSession({ role, send, localStream, makePeer = () => new RTCPeerConnection({ iceServers: ICE_SERVERS }), onRemoteStream = () => {}, onState = () => {} }) {
  const pc = makePeer();
  const queued = []; // candidates that arrive before the other side's description
  let closed = false;
  for (const track of localStream?.getTracks?.() || []) pc.addTrack(track, localStream);
  pc.onicecandidate = (e) => { if (e.candidate && !closed) send({ type: 'ice', from: role, candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
  pc.ontrack = (e) => onRemoteStream(e.streams?.[0] || null);
  pc.onconnectionstatechange = () => {
    if (closed) return;
    const s = pc.connectionState;
    if (s === 'connected') onState('live');
    else if (s === 'failed') onState('failed');
    else if (s === 'disconnected' || s === 'closed') onState('ended');
  };
  const flush = async () => { while (queued.length) { try { await pc.addIceCandidate(queued.shift()); } catch { /* a stale candidate */ } } };
  return {
    async offer() {
      onState('connecting');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ type: 'offer', sdp: pc.localDescription?.sdp ?? offer.sdp });
    },
    async handle(msg) {
      if (closed) return;
      if (msg.type === 'offer' && role === 'host') {
        onState('connecting');
        await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
        await flush();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ type: 'answer', sdp: pc.localDescription?.sdp ?? answer.sdp });
      } else if (msg.type === 'answer' && role === 'guest') {
        await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
        await flush();
      } else if (msg.type === 'ice' && msg.from !== role && msg.candidate) {
        if (pc.remoteDescription) { try { await pc.addIceCandidate(msg.candidate); } catch { /* stale */ } } else queued.push(msg.candidate);
      }
    },
    close() { if (closed) return; closed = true; try { pc.close(); } catch { /* gone */ } },
  };
}

const stopStream = (s) => { for (const t of s?.getTracks?.() || []) { try { t.stop(); } catch { /* gone */ } } };

// ---- The prospect's side -------------------------------------------------------------------------

/**
 * On the landing page. onUpdate(state) with { hostOnline, hostName, phase, local, remote, error }.
 * phase: 'idle' | 'ringing' | 'connecting' | 'live' | 'missed' | 'declined' | 'ended' | 'failed'.
 */
export function createGuestLine({ videoId, contactId = null, join = joinChannel, getMedia = getCallMedia, makePeer, onUpdate = () => {}, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const state = { hostOnline: false, hostName: '', phase: 'idle', local: null, remote: null, error: '' };
  let lobby = null; let call = null; let session = null; let callId = null; let timer = null; let rings = 0;
  const update = (patch) => { Object.assign(state, patch); onUpdate({ ...state }); };
  const cleanup = (phase) => {
    clearTimer(timer); timer = null;
    session?.close(); session = null;
    call?.leave(); call = null;
    stopStream(state.local);
    callId = null;
    update({ phase, local: null, remote: null });
  };
  const onCall = async (msg) => {
    if (msg.type === 'accept') {
      clearTimer(timer); timer = null;
      session = createPeerSession({ role: 'guest', send: (m) => call?.send(m), localStream: state.local, makePeer, onRemoteStream: (remote) => update({ remote }), onState: (phase) => { if (phase === 'failed' || phase === 'ended') cleanup(phase); else update({ phase }); } });
      try { await session.offer(); } catch { cleanup('failed'); }
    } else if (msg.type === 'decline' || msg.type === 'busy') cleanup('declined');
    else if (msg.type === 'bye') cleanup('ended');
    else session?.handle(msg).catch(() => cleanup('failed'));
  };
  const ready = join(lobbyName(videoId), {
    onPresence: (list) => {
      const host = list.find((p) => p?.role === 'host');
      update({ hostOnline: !!host, hostName: host?.name || '' });
    },
  }).then((ch) => { lobby = ch; return ch; }).catch(() => null);

  return {
    state: () => ({ ...state }),
    ready,
    async call() {
      if (!state.hostOnline || callId || rings >= MAX_RINGS) return;
      rings += 1;
      let local;
      try { local = await getMedia(); } catch (err) { update({ phase: 'idle', error: err?.name === 'NotAllowedError' ? 'Allow your camera and microphone to talk live.' : 'Your camera or microphone isn’t available.' }); return; }
      callId = randomId();
      update({ phase: 'ringing', local, error: '' });
      try {
        call = await join(callName(videoId, callId), { onSignal: onCall });
        await (lobby || (await ready))?.send({ type: 'ring', callId, contactId: SAFE.test(String(contactId || '')) ? contactId : null });
      } catch { cleanup('failed'); return; }
      timer = setTimer(() => { if (state.phase === 'ringing') { lobby?.send({ type: 'cancel', callId }); cleanup('missed'); } }, RING_TIMEOUT_MS);
    },
    hangup() {
      if (!callId) return;
      if (state.phase === 'ringing') lobby?.send({ type: 'cancel', callId });
      else call?.send({ type: 'bye' });
      cleanup('ended');
    },
    destroy() { if (callId) this.hangup(); lobby?.leave(); lobby = null; },
  };
}

// ---- Your side (the studio) ----------------------------------------------------------------------

/**
 * While you're available. `campaigns`: [{ videoId, contacts: [{ id, firstName, lastName, email }] }].
 * onUpdate(state) with { incoming: { videoId, callId, name } | null, phase, local, remote, error }.
 */
export function createHostLine({ campaigns = [], hostName = '', join = joinChannel, getMedia = getCallMedia, makePeer, onUpdate = () => {}, now = () => Date.now() }) {
  const state = { incoming: null, phase: 'idle', local: null, remote: null, error: '' };
  const lobbies = new Map(); // videoId -> channel
  let call = null; let session = null; let active = null; // { videoId, callId }
  const recent = []; // ring times, to ignore a flood
  const update = (patch) => { Object.assign(state, patch); onUpdate({ ...state }); };
  const nameFor = (videoId, contactId) => {
    const c = campaigns.find((x) => x.videoId === videoId)?.contacts?.find((p) => p.id === contactId);
    return (c && ([c.firstName, c.lastName].filter(Boolean).join(' ') || c.email)) || 'A prospect';
  };
  const end = (phase) => {
    session?.close(); session = null;
    call?.leave(); call = null;
    stopStream(state.local);
    active = null;
    update({ phase, local: null, remote: null });
  };
  const onLobby = (videoId) => (msg) => {
    if (!SAFE.test(String(msg.callId || ''))) return;
    if (msg.type === 'ring') {
      const t = now();
      while (recent.length && t - recent[0] > 60000) recent.shift();
      if (recent.length >= 6) return; // more than 6 rings a minute: ignore
      recent.push(t);
      if (active || state.incoming) { join(callName(videoId, msg.callId)).then((ch) => { ch.send({ type: 'busy' }); setTimeout(() => ch.leave(), 1000); }).catch(() => {}); return; }
      update({ incoming: { videoId, callId: msg.callId, contactId: msg.contactId || null, name: nameFor(videoId, msg.contactId) } });
    } else if ((msg.type === 'cancel' || msg.type === 'taken') && state.incoming?.callId === msg.callId) {
      update({ incoming: null }); // they hung up, or you answered in another tab
    }
  };
  const ready = Promise.all(campaigns.filter((c) => SAFE.test(String(c.videoId || ''))).map((c) =>
    join(lobbyName(c.videoId), { onSignal: onLobby(c.videoId), presence: { role: 'host', name: hostName } })
      .then((ch) => lobbies.set(c.videoId, ch)).catch(() => null)));

  return {
    state: () => ({ ...state }),
    ready,
    async accept() {
      const inc = state.incoming;
      if (!inc || active) return;
      let local;
      try { local = await getMedia(); } catch (err) { update({ error: err?.name === 'NotAllowedError' ? 'Allow your camera and microphone to take the call.' : 'Your camera or microphone isn’t available.' }); return; }
      active = { videoId: inc.videoId, callId: inc.callId };
      update({ incoming: null, phase: 'connecting', local, error: '' });
      try {
        call = await join(callName(inc.videoId, inc.callId), {
          onSignal: (msg) => { if (msg.type === 'bye') end('ended'); else session?.handle(msg).catch(() => end('failed')); },
        });
        session = createPeerSession({ role: 'host', send: (m) => call?.send(m), localStream: local, makePeer, onRemoteStream: (remote) => update({ remote }), onState: (phase) => { if (phase === 'failed' || phase === 'ended') end(phase); else update({ phase }); } });
        lobbies.get(inc.videoId)?.send({ type: 'taken', callId: inc.callId });
        await call.send({ type: 'accept' });
      } catch { end('failed'); }
    },
    async decline() {
      const inc = state.incoming;
      if (!inc) return;
      update({ incoming: null });
      try { const ch = await join(callName(inc.videoId, inc.callId)); await ch.send({ type: 'decline' }); setTimeout(() => ch.leave(), 1000); } catch { /* they'll time out */ }
    },
    hangup() { if (!active) return; call?.send({ type: 'bye' }); end('ended'); },
    destroy() { if (active) this.hangup(); for (const ch of lobbies.values()) ch.leave(); lobbies.clear(); },
  };
}
