// src/lib/onboarding/samplePrompt.js
//
// A first prompt for the studio the person picked, written from what they told the onboarding (company, video type),
// so the studio opens with something worth pressing Generate on. It only fills an EMPTY prompt box and never
// auto-generates (generation costs credits and needs full access). Hand-off survives the page reload that follows
// the onboarding: image and video use the shared studio prefill, the others a one-shot browser note applied when the
// studio is on screen (app:route-ready).
import { stageStudioPrefill } from '../studioPrefill.js';

const NOTE_KEY = 'smartvideo-onboarding-sample';
const NOTE_TTL_MS = 10 * 60 * 1000;
const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);

const BUILDERS = {
  image: (c) => `A clean, bright product shot for ${c}, soft studio light, shallow depth of field, modern and premium`,
  video: (c) => `A 5 second teaser for ${c}: slow camera push-in on the product, soft natural light, subtle motion, cinematic`,
  cinema: (c) => `A cinematic opening shot for ${c}, slow dolly forward at golden hour, warm light, shallow depth of field`,
  effects: (c) => `A bold motion intro for ${c} with glowing light trails and a smooth zoom`,
  avatar: (c) => `Hi, I am glad you are here. Here is a quick look at what ${c} can do for you.`,
  character: (c) => `A friendly brand mascot for ${c}, flat illustration style, simple shapes, bright colors`,
  influencer: (c) => `A relaxed lifestyle portrait of a creator holding a product from ${c}, natural window light`,
  audio: (c) => `Welcome to ${c}. Let us show you what we do in under a minute.`,
  lipsync: (c) => `Speak warmly and confidently about ${c}`,
};

export const samplePromptRoutes = () => Object.keys(BUILDERS);

/** The sample prompt for a studio route, or '' when that studio has no prompt box. company is optional. */
export function samplePromptFor(route, { company = '' } = {}) {
  const build = BUILDERS[route];
  if (!build) return '';
  return build(clean(company) || 'your business');
}

/** Stages the prompt for the studio that opens next. Returns true when something was staged. */
export function stageSamplePrompt(route, answers = {}, storage = globalThis.localStorage) {
  const prompt = samplePromptFor(route, answers);
  if (!prompt) return false;
  if (route === 'image' || route === 'video') {
    stageStudioPrefill({ route, prompt, ref: 'onboarding' });
    return true;
  }
  try { storage?.setItem(NOTE_KEY, JSON.stringify({ route, prompt, at: Date.now() })); } catch { return false; }
  return true;
}

/** Fills the staged prompt into the studio's empty prompt box once, then forgets it. Returns a cancel function. */
export function applyStagedSample(page, { storage = globalThis.localStorage, doc = globalThis.document, attempts = 40, interval = 100 } = {}) {
  let note = null;
  try { note = JSON.parse(storage?.getItem(NOTE_KEY) || 'null'); } catch { note = null; }
  if (!note || note.route !== page) return () => {};
  if (!note.at || Date.now() - note.at > NOTE_TTL_MS) { try { storage.removeItem(NOTE_KEY); } catch { /* ignore */ } return () => {}; }
  let tries = 0;
  let timer = null;
  const tick = () => {
    const field = doc.querySelector('[data-studio-prompt]');
    if (field) {
      try { storage.removeItem(NOTE_KEY); } catch { /* ignore */ }
      if (!field.value) {
        field.value = note.prompt;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
    tries += 1;
    if (tries < attempts) timer = setTimeout(tick, interval);
  };
  tick();
  return () => clearTimeout(timer);
}

let installed = false;
/** Applies a staged sample prompt whenever a studio comes on screen (called once from main.js). */
export function installSampleHandoff(win = globalThis.window) {
  if (installed || !win) return;
  installed = true;
  let cancel = () => {};
  win.addEventListener('app:route-ready', (e) => { cancel(); cancel = applyStagedSample(e?.detail?.page); });
}
