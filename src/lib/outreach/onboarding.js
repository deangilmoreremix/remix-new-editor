// src/lib/outreach/onboarding.js
//
// The SmartVideo welcome (6 steps), shown the first time someone opens Video Outreach:
//   1 what to do first (personal videos / dynamic videos)   2 team size   3 videos per month
//   4 where you work (company, website, job title)            5 how you heard about SmartVideo
//   6 your Brand Kit (read from the website in step 4; saved only if you press Save; Skip is always there)
// Answers are kept in this browser at once and saved to Supabase (public.user_onboarding, one row per
// signed-in user, readable only by them). When the table is not there yet or the user is offline, the
// browser copy is kept and saved again next time.

export const ONBOARDING_KEY = 'smartvideo-outreach-onboarding-v1';
export const ONBOARDING_STEPS = 6;

export const GOALS = Object.freeze([
  { id: 'personal', title: 'Record personal videos', text: 'Record a quick video of you and your screen. Send it to one prospect, a customer or your team.', tags: ['Camera and screen', 'Upload a video'] },
  { id: 'dynamic', title: 'Dynamic videos', text: 'Record once. SmartVideo makes one version for each prospect, with their name and their website.', tags: ['Dynamic videos', 'Personal landing pages'] },
]);
export const TEAM_SIZES = Object.freeze([
  { id: 'solo', label: 'Just myself', icon: 'user' },
  { id: '2-5', label: '2-5 team members', icon: 'users' },
  { id: '6-25', label: '6-25 team members', icon: 'group' },
  { id: '25+', label: '25+ team members', icon: 'briefcase' },
  { id: 'agency', label: 'My agency clients', icon: 'building' },
]);
export const VOLUMES = Object.freeze([
  { id: 'few', label: 'Just a few' }, { id: '100+', label: '100+' }, { id: '1000+', label: '1,000+' },
  { id: '5000+', label: '5,000+' }, { id: '10000+', label: '10,000+' }, { id: 'unsure', label: 'Not sure' },
]);
export const SOURCES = Object.freeze([
  { id: 'google', label: 'Google' }, { id: 'linkedin', label: 'LinkedIn' }, { id: 'youtube', label: 'YouTube' },
  { id: 'ai', label: 'ChatGPT, Claude or another AI' }, { id: 'got-video', label: 'I got a SmartVideo video' },
  { id: 'friend', label: 'A colleague or a friend' }, { id: 'event', label: 'An event or a webinar' },
  { id: 'podcast', label: 'A podcast' }, { id: 'reviews', label: 'G2 or Capterra' },
  { id: 'crm', label: 'HubSpot, Gong or Salesforce' }, { id: 'newsletter', label: 'A newsletter or a blog' },
]);

const pick = (list, v) => (list.some((o) => o.id === v) ? v : '');
const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function blankOnboarding() {
  return { step: 1, goal: '', team: '', volume: '', company: '', website: '', jobTitle: '', heard: '', heardOther: '', completedAt: null, firstVideo: '' };
}

/** Only known answers, trimmed and capped (it is stored and shown again). */
export function cleanOnboarding(x = {}) {
  const o = x && typeof x === 'object' ? x : {};
  const step = Math.min(ONBOARDING_STEPS, Math.max(1, Math.round(Number(o.step) || 1)));
  return {
    step,
    goal: pick(GOALS, o.goal),
    team: pick(TEAM_SIZES, o.team),
    volume: pick(VOLUMES, o.volume),
    company: text(o.company, 120),
    website: text(o.website, 200),
    jobTitle: text(o.jobTitle, 120),
    heard: o.heard === 'other' ? 'other' : pick(SOURCES, o.heard),
    heardOther: text(o.heardOther, 120),
    completedAt: typeof o.completedAt === 'string' && !Number.isNaN(Date.parse(o.completedAt)) ? o.completedAt : null,
    // "Your first video" after the welcome: '' (not yet), 'made' (the sample was made), 'later' (Do this later).
    firstVideo: ['made', 'later'].includes(o.firstVideo) ? o.firstVideo : '',
  };
}

export const isDone = (o) => !!o?.completedAt;

/** 'https://www.Acme.com/about' -> 'acme.com/about'; '' when it is not a web address. */
export function normalizeWebsite(s) {
  const v = String(s || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(v) ? v.toLowerCase() : '';
}

/** Step 4 is complete when every field is filled and the website is a web address. */
export const workReady = (o) => !!(text(o?.company, 120) && normalizeWebsite(o?.website) && text(o?.jobTitle, 120));

// One browser copy per signed-in user, so two people sharing a browser each get their own welcome.
const localKey = (userId) => `${ONBOARDING_KEY}:${String(userId || 'guest').slice(0, 80)}`;
export function loadLocalOnboarding(userId, storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage?.getItem(localKey(userId)) || 'null'); return v ? cleanOnboarding(v) : null; } catch { return null; }
}
export function saveLocalOnboarding(userId, o, storage = globalThis.localStorage) {
  try { storage?.setItem(localKey(userId), JSON.stringify(cleanOnboarding(o))); } catch { /* storage blocked: the answers stay in memory */ }
}

// ---- Supabase (public.user_onboarding) -------------------------------------------------------
export const toRow = (o) => {
  const c = cleanOnboarding(o);
  return {
    goal: c.goal || null, team_size: c.team || null, videos_per_month: c.volume || null,
    company: c.company || null, website: normalizeWebsite(c.website) || c.website || null, job_title: c.jobTitle || null,
    heard_from: c.heard || null, heard_other: c.heard === 'other' ? c.heardOther || null : null,
    step: c.step, completed_at: c.completedAt, first_video: c.firstVideo || null,
  };
};
export const fromRow = (r) => cleanOnboarding({
  step: r?.step, goal: r?.goal, team: r?.team_size, volume: r?.videos_per_month, company: r?.company, website: r?.website,
  jobTitle: r?.job_title, heard: r?.heard_from, heardOther: r?.heard_other, completedAt: r?.completed_at, firstVideo: r?.first_video,
});

/** The saved answers, or null (none yet, signed out, or the table is not there). */
export async function fetchOnboarding(client) {
  if (!client?.from) return null;
  try {
    const { data, error } = await client.from('user_onboarding').select('*').maybeSingle();
    return error || !data ? null : fromRow(data);
  } catch { return null; }
}

/** Saves the answers for the signed-in user; true when stored. */
export async function saveOnboarding(client, o, userId) {
  if (!client?.from || !userId) return false;
  try {
    const { error } = await client.from('user_onboarding').upsert({ clerk_user_id: userId, ...toRow(o) }, { onConflict: 'clerk_user_id' });
    return !error;
  } catch { return false; }
}

/** The newer of two copies: a finished one wins, else the one further along. */
export function newerOnboarding(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  if (isDone(a) !== isDone(b)) return isDone(a) ? a : b;
  if (!!a.firstVideo !== !!b.firstVideo) return a.firstVideo ? a : b;
  return (b.step || 0) > (a.step || 0) ? b : a;
}

/** Fills empty Video Outreach fields from the answers (never overwrites what you typed). */
export function applyToDraft(draft, o) {
  const c = cleanOnboarding(o);
  if (!draft || typeof draft !== 'object') return draft;
  draft.sender = { ...(draft.sender || {}) };
  if (!draft.sender.company && c.company) draft.sender.company = c.company;
  if (!draft.sender.title && c.jobTitle) draft.sender.title = c.jobTitle;
  const site = normalizeWebsite(c.website);
  if (site && draft.background && !draft.background.fallbackSite) draft.background = { ...draft.background, fallbackSite: site };
  return draft;
}
