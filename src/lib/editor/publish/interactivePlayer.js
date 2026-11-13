/**
 * Interactive playback for published videos.
 *
 * Plays a published timeline with the Remotion preview engine and runs the
 * same AddonRuntime as the editor: pause (with "click to continue"), loop,
 * skip, Lead Generator gates, List Builder / Personalizer, plus clickable
 * CTA buttons and overlay links. The engine is injected so this can be
 * tested without a browser video stack.
 */
import '../addons/index.js'; // registers the addon descriptors the runtime reads
import { AddonRuntime } from '../addons/runtime.js';
import { clipTimeRange } from '../addons/registry.js';
import { ensureOverlayLayer, clearOverlay, showPauseOverlay, showOptinOverlay } from '../addons/addonOverlay.js';
import { normalizeListBuilder } from '../addons/listBuilder.js';
import { addonOptions } from '../addons/registry.js';
import { timelineToComposition } from '../remotion/timelineToComposition.js';
import { showLeadForm, ctaElement, linkBoxElement, personalizeCta } from './viewerOverlays.js';
import { ctaTarget } from '../addons/ctaLink.js';
import { profileWithAnswers } from '../personalize/perContact.js';

const TEXT_KEYS = new Set(['text', 'name', 'title', 'heading', 'body']);

/** Remove {{tokens}} a viewer's link didn't fill in. */
export function stripUnresolvedTokens(value, key = '') {
  if (typeof value === 'string') return TEXT_KEYS.has(key) ? value.replace(/\{\{[^}]*\}\}/g, '').replace(/[ \t]{2,}/g, ' ').trim() : value;
  if (Array.isArray(value)) return value.map((v) => stripUnresolvedTokens(v));
  if (value && typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([k, v]) => { out[k] = k === 'lottie' || k === 'code' ? v : stripUnresolvedTokens(v, k); });
    return out;
  }
  return value;
}

export function buildViewerModel(project, profile, { fps = 30, quality = '1080p' } = {}) {
  const model = timelineToComposition(project, { fps, quality, profile });
  return { ...model, layers: stripUnresolvedTokens(model.layers) };
}

export { profileWithAnswers };

/**
 * @param {object} o
 *   project        published project { tracks, timelineSeconds, listBuilder }
 *   stage          element the engine renders into
 *   frame          element the interactive layer covers (same box as the picture)
 *   createEngine   (host, { model, onFrame, onEnded, onReady, onError }) → engine
 *   profile        token profile from the link (?firstname=…)
 *   onLead({ clipId, kind, data }) → Promise<{ stored, error }>
 *   onChange({ playing, time, duration })
 *   voiceFor(clip, profile) → Promise<url|null>   personalized Smart Speech audio
 *   rememberKey    id used to remember (in this browser) that the viewer already
 *                  filled in the List Builder, so they aren't asked again
 *   fps
 */
export function createInteractivePlayer({ project, stage, frame, createEngine, profile = null, onLead, onChange, voiceFor, rememberKey = null, fps = 30 }) {
  const T = Number(project.timelineSeconds) || 60;
  const clips = (project.tracks || []).flatMap((t) => t.items || t.clips || []);
  const listBuilder = project.listBuilder ? normalizeListBuilder({ ...project.listBuilder }) : null;
  // A returning viewer who already filled the form in doesn't get the wall again.
  const storeKey = rememberKey ? `remix-optin:${rememberKey}` : null;
  if (listBuilder?.enabled && storeKey && !listBuilder.askEveryVisit) {
    try { if (globalThis.localStorage?.getItem(storeKey) === '1') listBuilder._submitted = true; } catch { /* storage blocked */ }
  }
  // The List Builder is a registration wall: until it is submitted the video
  // engine isn't even created, so nothing can load or play behind the form.
  const wallUp = () => !!(listBuilder?.enabled && !listBuilder._submitted);
  const runtime = new AddonRuntime();
  const layer = ensureOverlayLayer(frame);
  layer.classList.add('wf-layer');
  let currentProfile = profile;
  const voices = new Map(); // clip id → personalized audio URL
  // The project with personalized Smart Speech audio swapped in.
  const voicedProject = () => (voices.size ? {
    ...project,
    tracks: (project.tracks || []).map((t) => ({
      ...t,
      ...(t.items ? { items: t.items.map((c) => (voices.has(String(c.id)) ? { ...c, src: voices.get(String(c.id)) } : c)) } : {}),
      ...(t.clips ? { clips: t.clips.map((c) => (voices.has(String(c.id)) ? { ...c, src: voices.get(String(c.id)) } : c)) } : {}),
    })),
  } : project);
  let model = buildViewerModel(voicedProject(), currentProfile, { fps });
  let playing = false;
  let time = 0;
  let gateOpen = false;
  let resumeTimer = null;
  let destroyed = false;

  const emit = () => onChange?.({ playing, time, duration: model.durationInFrames / fps, gating: gateOpen });

  // Candidates are decided on the raw clip (a destination may be a {{token}}); each is resolved per viewer when it appears.
  const hasDestination = (o) => !!(String(o?.linkUrl || '').trim() || String(o?.phoneNumber || '').trim());
  const interactiveClips = clips.filter((c) => c.type === 'click-to-call' || ctaTarget(addonOptions(c)) || hasDestination(addonOptions(c)));
  const onCall = ({ clip, phone }) => {
    // Upstream "Email to notify about call attempt": recorded as a lead for the owner.
    onLead?.({ clipId: clip.id, kind: 'call-attempt', data: { PHONE: phone, CALLED_AT: new Date().toISOString() } });
  };
  const live = new Map(); // clip id → element
  function updateInteractive(sec) {
    interactiveClips.forEach((clip) => {
      const { start, end } = clipTimeRange(clip, T);
      const on = sec >= start && sec < end;
      const id = String(clip.id);
      if (on && !live.has(id)) {
        const mine = personalizeCta(clip, currentProfile);   // this viewer's own number / link; unresolved destinations show nothing
        const el = clip.type === 'click-to-call' ? ctaElement(mine, { onCall, frameAspect: model.width / model.height }) : linkBoxElement(mine, { onCall });
        if (el) { layer.appendChild(el); live.set(id, el); }
      } else if (!on && live.has(id)) {
        live.get(id).remove();
        live.delete(id);
      }
    });
  }

  let engine = null;
  const makeEngine = () => createEngine(stage, {
    model,
    onFrame: (f) => {
      if (destroyed) return;
      const now = f / fps;
      if (playing) {
        const prev = time;
        time = now;
        if (apply(runtime.tick(prev, now, { clips, timelineSeconds: T, listBuilder }))) return;
      } else {
        time = now;
      }
      updateInteractive(time);
      emit();
    },
    onEnded: () => { playing = false; emit(); },
    onReady: () => engine?.seekToFrame?.(Math.round(time * fps)),
    onError: (err) => console.warn('[watch] playback error', err),
  });
  const ensureEngine = () => { if (!engine) engine = makeEngine(); return engine; };
  if (!wallUp()) ensureEngine();

  function seekEngine(sec) {
    time = Math.max(0, Math.min(T, sec));
    engine?.seekToFrame(Math.round(time * fps));
    updateInteractive(time);
  }

  function pauseInternal() {
    playing = false;
    engine?.pause();
    emit();
  }

  /** Apply runtime actions. Returns true when playback was interrupted. */
  function apply(actions) {
    let interrupted = false;
    for (const action of actions) {
      if (action.type === 'seek') {
        seekEngine(action.time);
        runtime.lastTime = time;
      } else if (action.type === 'pause') {
        interrupted = true;
        pauseInternal();
        if (action.resumeAfter) {
          clearTimeout(resumeTimer);
          resumeTimer = setTimeout(() => play(), action.resumeAfter * 1000);
        }
      } else if (action.type === 'show') {
        interrupted = true;
        if (action.overlay === 'pause-continue') {
          showPauseOverlay(layer, { text: addonOptions(action.clip).continueText || 'Click to continue', onContinue: () => play() });
        } else if (action.overlay === 'lead-form') {
          openLeadForm(action.clip);
        } else if (action.overlay === 'list-builder') {
          openListBuilder();
        }
      }
    }
    if (actions.length) emit();
    return interrupted;
  }

  /** Put what the viewer typed into the video: {{tokens}} fill in at once. */
  function applyAnswers(data) {
    currentProfile = profileWithAnswers(currentProfile, data);
    model = buildViewerModel(voicedProject(), currentProfile, { fps });
    engine?.update(model);
    loadVoices();
  }

  function openLeadForm(clip) {
    gateOpen = true;
    showLeadForm(layer, clip, {
      profile: currentProfile,
      onSubmit: async (data) => {
        const res = await onLead?.({ clipId: clip.id, kind: 'lead-form', data });
        if (res?.error && !res.stored) return { ok: false, message: 'Sorry, that didn’t go through — please try again.' };
        clip._submitted = true;
        runtime.markSubmitted(clip.id);
        applyAnswers(data);
        gateOpen = false;
        play();
        return { ok: true };
      },
      onSkip: () => { gateOpen = false; play(); },
    });
  }

  function openListBuilder() {
    gateOpen = true;
    emit(); // tells the page a form is up (hides the big play button)
    const prefill = currentProfile?.variables || {};
    showOptinOverlay(layer, listBuilder, {
      prefill,
      onSkip: () => { gateOpen = false; ensureEngine(); play(); },
      onSubmit: async (data) => {
        await onLead?.({ clipId: 'list-builder', kind: listBuilder.kind === 'personalizer' ? 'personalizer' : 'list-builder', data });
        listBuilder._submitted = true;
        if (storeKey) { try { globalThis.localStorage?.setItem(storeKey, '1'); } catch { /* storage blocked */ } }
        applyAnswers(data);
        gateOpen = false;
        play(); // creates the engine now that the viewer is through the wall
        return '';
      },
    });
  }

  function play() {
    if (destroyed) return;
    if (gateOpen) { emit(); return; }
    clearTimeout(resumeTimer);
    clearOverlay(layer, 'pause-continue');
    if (time >= T - 0.05) seek(0);
    playing = true;
    // A List Builder at the very start gates before the first frame.
    if (apply(runtime.tick(time, time, { clips, timelineSeconds: T, listBuilder }))) return;
    ensureEngine().play();
    emit();
  }

  function seek(sec) {
    if (gateOpen) return; // no scrubbing past an open form
    clearTimeout(resumeTimer);
    seekEngine(sec);
    runtime.handleSeek(time, clips, T);
    emit();
  }

  // Personalized Smart Speech: fetch each line for this viewer; until it
  // arrives (or if it fails) the clip plays its fallback audio.
  const requested = new Set();
  function loadVoices() {
    if (!voiceFor) return;
    // Clips already voiced for this contact (personal links) need no request.
    clips.filter((c) => c.tts?.personalized && !c.tts?.variants?.[String(currentProfile?.id)]).forEach((clip) => {
      const key = `${clip.id}|${JSON.stringify(currentProfile?.variables || {})}`;
      if (requested.has(key)) return;
      requested.add(key);
      Promise.resolve(voiceFor(clip, currentProfile)).then((url) => {
        if (!url || destroyed) return;
        voices.set(String(clip.id), url);
        model = buildViewerModel(voicedProject(), currentProfile, { fps });
        engine?.update(model);
      }).catch(() => {});
    });
  }
  loadVoices();

  updateInteractive(0);
  if (wallUp()) {
    runtime.listBuilderShown = true;
    runtime.lastTime = 0;
    openListBuilder();
  }
  return {
    play,
    pause: () => { clearTimeout(resumeTimer); pauseInternal(); },
    toggle: () => (playing ? (clearTimeout(resumeTimer), pauseInternal()) : play()),
    seek,
    get playing() { return playing; },
    get time() { return time; },
    get duration() { return model.durationInFrames / fps; },
    get model() { return model; },
    get layer() { return layer; },
    destroy() {
      destroyed = true;
      clearTimeout(resumeTimer);
      engine?.destroy?.();
      layer.remove();
    },
  };
}
