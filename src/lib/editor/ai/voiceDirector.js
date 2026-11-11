/* global RTCPeerConnection */
/**
 * Voice Director (CineGen): talk to the editor. The microphone streams to the
 * OpenAI Realtime API over WebRTC; the assistant's replies play back as voice,
 * and when it calls a tool we run it in the editor (the same tools as the AI
 * Agent) and send the result back.
 *
 * /api/timeline-voice mints a short-lived client secret on the user's own
 * OpenAI key, so the key itself never reaches the browser.
 */
import { openaiKeyHeader } from '../../openaiKeyHeader.js';

export const VOICE_ENDPOINT = '/api/timeline-voice';
export const REALTIME_CALLS = 'https://api.openai.com/v1/realtime/calls';

async function authHeader() {
  try {
    const token = await globalThis.window?.Clerk?.session?.getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function createVoiceSession(tools, { voice, fetchImpl = fetch, headers } = {}) {
  const keyHeaders = headers || openaiKeyHeader();
  if (!keyHeaders['X-OpenAI-Key']) throw new Error('Voice uses your own OpenAI key. Add it in Settings → API keys (OpenAI API Key).');
  const res = await fetchImpl(VOICE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()), ...keyHeaders },
    body: JSON.stringify({ voice, tools: tools.definitions }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error?.message || `Voice is unavailable (HTTP ${res.status}).`);
  return data;
}

/** Realtime events → what to do. Pure, so it can be tested without a connection. */
export function interpretEvent(evt) {
  switch (evt?.type) {
    case 'response.output_audio_transcript.done': return { kind: 'said', text: evt.transcript || '' };
    case 'conversation.item.input_audio_transcription.completed': return { kind: 'heard', text: evt.transcript || '' };
    case 'response.function_call_arguments.done': {
      let args = {};
      try { args = JSON.parse(evt.arguments || '{}'); } catch { args = { _invalidJson: true }; }
      return { kind: 'tool', callId: evt.call_id, name: evt.name, args };
    }
    case 'error': return { kind: 'error', message: evt.error?.message || 'Voice error' };
    default: return { kind: 'ignore' };
  }
}

/** The two messages that return a tool result to the model and ask it to continue. */
export function toolResultMessages(callId, content) {
  return [
    { type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: String(content).slice(0, 20_000) } },
    { type: 'response.create' },
  ];
}

/**
 * Start a voice session.
 * @param {{ definitions, run(name, args) }} tools  the editor's agent tools
 * @param {object} opts { onStatus(text), onHeard(text), onSaid(text), onError(err), voice }
 * @returns {Promise<{ stop(): void }>}
 */
export async function startVoiceDirector(tools, { onStatus, onHeard, onSaid, onError, voice, fetchImpl = fetch } = {}) {
  if (!globalThis.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot do live voice. Use Chrome, Edge or Safari.');
  onStatus?.('Starting…');
  const session = await createVoiceSession(tools, { voice, fetchImpl });
  const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
  const pc = new RTCPeerConnection();
  const audio = document.createElement('audio');
  audio.autoplay = true;
  pc.ontrack = (e) => { audio.srcObject = e.streams[0]; };
  mic.getTracks().forEach((t) => pc.addTrack(t, mic));
  const channel = pc.createDataChannel('oai-events');
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try { channel.close(); } catch { /* already closed */ }
    try { pc.close(); } catch { /* already closed */ }
    mic.getTracks().forEach((t) => t.stop());
    audio.srcObject = null;
    onStatus?.('Stopped');
  };

  channel.onmessage = async (m) => {
    let evt;
    try { evt = JSON.parse(m.data); } catch { return; }
    const act = interpretEvent(evt);
    if (act.kind === 'heard') onHeard?.(act.text);
    else if (act.kind === 'said') onSaid?.(act.text);
    else if (act.kind === 'error') onError?.(new Error(act.message));
    else if (act.kind === 'tool') {
      onStatus?.(`Running ${act.name.replace(/_/g, ' ')}…`);
      let out;
      try { out = await tools.run(act.name, act.args); } catch (err) { out = { ok: false, content: `Tool failed: ${err?.message || err}` }; }
      if (!stopped && channel.readyState === 'open') toolResultMessages(act.callId, out.content).forEach((msg) => channel.send(JSON.stringify(msg)));
      onStatus?.('Listening…');
    }
  };
  channel.onopen = () => onStatus?.('Listening… speak to the editor');
  pc.onconnectionstatechange = () => { if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) stop(); };

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const res = await fetchImpl(REALTIME_CALLS, { method: 'POST', body: offer.sdp, headers: { Authorization: `Bearer ${session.secret}`, 'Content-Type': 'application/sdp' } });
    if (!res.ok) throw new Error(`OpenAI rejected the voice connection (HTTP ${res.status}).`);
    await pc.setRemoteDescription({ type: 'answer', sdp: await res.text() });
  } catch (err) {
    stop();
    throw err;
  }
  return { stop };
}
