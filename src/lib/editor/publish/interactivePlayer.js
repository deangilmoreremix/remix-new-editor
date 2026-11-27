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
import { normalizeListBuilder, leadFormToOptin } from '../addons/listBuilder.js';
import { pickVariant, applyVariant, hasVariantB } from '../addons/abTest.js';
import { addonOptions } from '../addons/registry.js';
import { timelineToComposition } from '../remotion/timelineToComposition.js';
import { showLeadForm, ctaElement, linkBoxElement, hotspotElement, pathChoiceElement } from './viewerOverlays.js';
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
  const model = timelineToComposition(project, { fps, quality, profile, ...(project?.aspect ? { aspect: project.aspect } : {}) });
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
 *   onHotspot({ clip, action, label, time })   a viewer clicked a hotspot (for analytics)
 *   voiceFor(clip, profile) → Promise<url|null>   personalized Smart Speech audio
 *   rememberKey    id used to remember (in this browser) that the viewer already
 *                  filled in the List Builder, so they aren't asked again
 *   fps
 */
export function createInteractivePlayer({ project, stage, frame, createEngine, profile = null, onLead, onChange, onHotspot, voiceFor, rememberKey = null, fps = 30 }) {
  const T = Number(project.timelineSeconds) || 60;
  const clips = (project.tracks || []).flatMap((t) => t.items || t.clips || []);
  const listBuilder = project.listBuilder ? normalizeListBuilder({ ...project.listBuilder }) : null;
  // A/B test: this viewer's version of any form that has one (kept in this browser, sent with the lead).
  // Assigned only when a form actually has a version B (so nothing is stored for untested forms).
  let assigned = null;
  const variantFor = (config) => (hasVariantB(config) ? (assigned ??= pickVariant(rememberKey)) : '');
  const versionOf = (config) => { const v = variantFor(config); return v ? { variant: v } : {}; };
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
  let pathCard = null; // "Choose your path" card on screen; it goes when the viewer picks or leaves the decision point
  let route = null; // "Choose your path": { until, then } of the route being played
  let resumeTimer = null;
  let destroyed = false;

  const emit = () => onChange?.({ playing, time, duration: model.durationInFrames / fps, gating: gateOpen || !!pathCard }); // an open card, like a form, hides the big play button so it cannot cover the choices

  const interactiveClips = clips.filter((c) => c.type === 'click-to-call' || c.type === 'addon-hotspot' || ctaTarget(addonOptions(c)));
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
        const el = clip.type === 'click-to-call' ? ctaElement(clip, { onCall, frameAspect: model.width / model.height })
          : clip.type === 'addon-hotspot' ? hotspotElement(clip, { onCall, onSeek: jumpTo, onClick: (h) => onHotspot?.({ ...h, time }) })
            : linkBoxElement(clip, { onCall });
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
        if (route && prev < route.until && route.until <= now) {
          const to = route.then;
          route = null;
          seekEngine(to);
          runtime.handleSeek(time, clips, T); // events ahead of the destination fire again
          updateInteractive(time);
          emit();
          return;
        }
        if (apply(runtime.tick(prev, now, { clips, timelineSeconds: T, listBuilder }))) return;
      } else {
        time = now;
      }
      updateInteractive(time);
      emit();
    },
    onEnded: () => {
      // A route that runs to the very end of the video still continues where it was told to (the last frame is never `>= until`).
      if (route && route.then < T - 0.05) {
        const to = route.then;
        route = null;
        seekEngine(to);
        runtime.handleSeek(time, clips, T);
        play();
        return;
      }
      route = null;
      playing = false;
      emit();
    },
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

  // A hotspot's "jump to" action: go there and keep playing (a form that is open blocks it, as scrubbing does).
  function jumpTo(sec) {
    if (gateOpen) return;
    seek(sec);
    play();
  }

  // "Choose your path": the card pauses the video; a pick jumps to that route and, if the route has an end,
  // playback hops on to the clip's "continue at" time when it gets there.
  const closePathCard = () => { pathCard?.remove(); pathCard = null; };
  function openPathChoice(clip) {
    closePathCard();
    const el = pathChoiceElement(clip, {
      onPick: ({ choice, label }) => {
        closePathCard();
        onHotspot?.({ clip, action: 'path', label: `Path: ${label}`, time });
        const then = Number(addonOptions(clip).thenTime) || 0;
        route = choice.until ? { until: choice.until, then } : null;
        seekEngine(choice.from);
        runtime.handleSeek(time, clips, T);
        play();
      },
    });
    if (el) { layer.appendChild(el); pathCard = el; }
    else play(); // fewer than two usable choices: nothing to ask
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
        } else if (action.overlay === 'path-choice') {
          openPathChoice(action.clip);
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
      allowRedirect: true,
      isActive: () => !destroyed,
      profile: currentProfile,
      variant: variantFor(leadFormToOptin(clip)) || 'A',
      onSubmit: async (data, signals) => {
        const res = await onLead?.({ clipId: clip.id, kind: 'lead-form', data, signals, ...versionOf(leadFormToOptin(clip)) });
        if (res?.error && !res.stored) return { ok: false, message: res.fix || 'Sorry, that didn’t go through — please try again.' };
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

  // Lead Generators whose trigger is an event instead of a place on the timeline: 'pause' (the viewer pauses the video) and
  // 'exit' (the pointer leaves through the top of the window, desktop only). Each shows once, and never over another form.
  const firedTriggers = new Set();
  function openTriggered(kind) {
    if (destroyed || gateOpen || wallUp()) return false;
    const clip = clips.find((c) => c.type === 'lead-form' && c.trigger === kind && !c._submitted && !firedTriggers.has(String(c.id)));
    if (!clip) return false;
    firedTriggers.add(String(clip.id));
    if (playing) { clearTimeout(resumeTimer); pauseInternal(); }
    openLeadForm(clip);
    emit();
    return true;
  }
  const onExitIntent = (e) => { if (e.clientY <= 0 && !e.relatedTarget && time > 0) openTriggered('exit'); };
  const canHover = typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia('(pointer: fine)').matches : true;
  if (canHover && clips.some((c) => c.type === 'lead-form' && c.trigger === 'exit')) globalThis.document?.addEventListener('mouseout', onExitIntent);

  function openListBuilder() {
    gateOpen = true;
    emit(); // tells the page a form is up (hides the big play button)
    const prefill = currentProfile?.variables || {};
    showOptinOverlay(layer, applyVariant(listBuilder, variantFor(listBuilder) || 'A'), {
      allowRedirect: true,
      isActive: () => !destroyed,
      prefill,
      onSkip: () => { gateOpen = false; ensureEngine(); play(); },
      onSubmit: async (data, signals) => {
        const res = await onLead?.({ clipId: 'list-builder', kind: listBuilder.kind === 'personalizer' ? 'personalizer' : 'list-builder', data, signals, ...versionOf(listBuilder) });
        // Like the Lead Generator: if the lead was not saved, keep the form open for a retry instead of
        // marking it done (which would also suppress it on return and send the viewer away on a redirect).
        if (res?.error && !res.stored) throw new Error(res.fix || 'Sorry, that didn\u2019t go through \u2014 please try again.');
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
    if (gateOpen) return;
    route = null; // a scrub cancels the route being followed
    closePathCard(); // ...and leaves the decision point
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
    pause: () => { const was = playing; clearTimeout(resumeTimer); pauseInternal(); if (was) openTriggered('pause'); },
    toggle: () => {
      if (!playing) { play(); return; }
      clearTimeout(resumeTimer); pauseInternal(); openTriggered('pause');
    },
    seek,
    get playing() { return playing; },
    get time() { return time; },
    get duration() { return model.durationInFrames / fps; },
    get model() { return model; },
    get layer() { return layer; },
    destroy() {
      destroyed = true;
      clearTimeout(resumeTimer);
      globalThis.document?.removeEventListener('mouseout', onExitIntent);
      engine?.destroy?.();
      layer.remove();
    },
  };
}
