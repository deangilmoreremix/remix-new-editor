// src/lib/outreach/landingPage.js
//
// Video Outreach on the Video Pages designs (src/lib/landingPages, /p/<slug>): a campaign can be
// published onto any of the landing page designs. The page's video is then the campaign's
// personal player (/watch/<id>?embed=1: each contact's spoken greeting, their website behind
// the presenter) instead of one video file, and each contact's link carries both the page's
// tokens (firstname, company, role…) and the player's.

import { calendarEmbedUrl } from './draft.js';

const WATCH_PATH = /^\/watch\/([A-Za-z0-9_-]{8,32})\/?$/;
// Query keys the page passes on to the player (the personal link's contact id and tokens).
const PASS = /^(c|firstName|lastName|fullName|company|email|website|jobTitle|websiteShotUrl|[A-Za-z]+Url(Focus|Lum)?)$/;

/** The campaign id when a page's video URL is an outreach player on this site, else null. */
export function outreachCampaignId(videoUrl, origin = globalThis.location?.origin || '') {
  try {
    const u = new URL(String(videoUrl || ''));
    if (origin && u.origin !== origin) return null;
    return u.pathname.match(WATCH_PATH)?.[1] || null;
  } catch {
    return null;
  }
}

/** The personal player for this page view: /watch/<id>?embed=1 plus the contact's parameters. */
export function outreachPlayerSrc(videoUrl, search = globalThis.location?.search || '', origin = globalThis.location?.origin || '') {
  const id = outreachCampaignId(videoUrl, origin);
  if (!id) return null;
  const out = new URL(`/watch/${id}`, origin || 'https://invalid.local');
  out.searchParams.set('embed', '1');
  for (const [k, v] of new URLSearchParams(search)) if (PASS.test(k) && v) out.searchParams.set(k, v.slice(0, 2048));
  return origin ? out.toString() : `${out.pathname}${out.search}`;
}

/**
 * A contact's link to the landing page: the player's personal link parameters (contact id,
 * tokens, website screenshot) plus the page's own lowercase tokens.
 */
export function landingLink(pageUrl, watchLink, contact = {}) {
  const url = new URL(pageUrl);
  try { for (const [k, v] of new URL(watchLink).searchParams) url.searchParams.set(k, v); } catch { /* no player params */ }
  const tokens = { firstname: contact.firstName, lastname: contact.lastName, company: contact.company, role: contact.jobTitle };
  for (const [k, v] of Object.entries(tokens)) if (v && String(v).trim()) url.searchParams.set(k, String(v).trim().slice(0, 80));
  return url.toString();
}

/**
 * The page settings from the campaign: header and message (with the page's {{firstname}}-style
 * tokens), the booking button and calendar, Like, and the transcript from the Record step's
 * captions. Designs built from blocks (Puck) keep their own words; these fill the classic and
 * pitch layouts, which read them.
 */
export function pageConfigFromDraft(base, draft) {
  const out = { ...base };
  const header = String(draft.header || '').trim();
  const message = String(draft.message || '').trim();
  if (header) out.headline = header.slice(0, 200);
  if (message) out.subhead = message.slice(0, 300);
  const cta = draft.cta?.enabled && /^https:\/\//i.test(String(draft.cta.url || '')) ? draft.cta : null;
  if (cta) {
    out.cta = { label: String(cta.label || 'Book a call').slice(0, 60), url: cta.url, type: cta.embed ? 'calendar' : 'link' };
    if (cta.embed && calendarEmbedUrl(cta.url)) out.calendar = { url: calendarEmbedUrl(cta.url), title: String(cta.label || '').slice(0, 80) };
  }
  out.likes = { enabled: true };
  const sender = senderOf(draft);
  if (sender.name) out.sender = { name: sender.name, title: sender.title, avatarUrl: sender.photo };
  if (sender.company) out.brand = { ...(out.brand || {}), name: sender.company };
  if (out.puck) out.puck = outreachPuck(out.puck, draft);
  const lines = draft.captions?.lines || [];
  if (lines.length) out.transcript = { enabled: true, items: lines.slice(0, 300).map((l) => ({ t: Math.round(l.startMs / 1000), text: String(l.text).slice(0, 500) })) };
  return out;
}

// Text the sender typed (their name, title, company): never a {{token}}.
const plain = (v, n) => String(v || '').replace(/[{}[\]]/g, '').trim().slice(0, n);
const https = (v) => (/^https:\/\/[^\s"'<>]+$/i.test(String(v || '').trim()) ? String(v).trim() : '');

/** The sender's details from the draft (Customize step, "Your details"). */
export function senderOf(draft = {}) {
  const s = draft.sender || {};
  return { name: plain(s.name, 80), title: plain(s.title, 80), company: plain(s.company, 80), logo: https(s.logo), photo: https(s.photo) };
}

/**
 * A design (Puck page) as a Sendspark-style personal video page: the design's colours, fonts and
 * hero arrangement stay; its sample words, numbers, testimonials, logos and lead forms go. What
 * is left is the sender's brand, the personalized headline and message beside the video, then
 * who sent it, Like, the booking button and the booking calendar, and "Sent by".
 */
export function outreachPuck(puck, draft = {}) {
  const sender = senderOf(draft);
  const hero0 = (puck?.content || []).find((c) => c?.type === 'Hero');
  const variant = ['copy-video-form', 'video-copy-form', 'duo'].includes(hero0?.props?.variant) ? hero0.props.variant : 'copy-video-form';
  const cta = draft.cta?.enabled && https(draft.cta.url) ? draft.cta : null;
  const brand = sender.company || sender.name;
  const content = [];
  if (brand || sender.logo) {
    content.push({ type: 'NavBar', props: { id: 'or-nav', brand, logo: sender.logo, links: [], loginLabel: '', loginUrl: '', ctaLabel: cta ? plain(cta.label, 40) : '' } });
  }
  content.push({
    type: 'Hero',
    props: {
      id: 'or-hero', variant, background: '', eyebrow: '',
      headline: String(draft.header || '').trim().slice(0, 200) || 'Hi {{firstname|there}}, I made this for you',
      subhead: String(draft.message || '').trim().slice(0, 500),
      bullets: [], buttons: [], chip: '', photo: '', showForm: 'no',
      formTitle: '', formSubtitle: '', formFields: [], submitLabel: '', privacy: '',
    },
  });
  content.push({
    type: 'OutreachActions',
    props: {
      id: 'or-actions', senderName: sender.name, senderTitle: [sender.title, sender.company].filter(Boolean).join(', '), senderPhoto: sender.photo, like: 'yes',
      ctaLabel: cta ? plain(cta.label, 40) || 'Book a call' : '', ctaUrl: cta?.url || '',
      calendarUrl: cta?.embed ? calendarEmbedUrl(cta.url) || '' : '', calendarTitle: cta?.embed ? plain(cta.label, 80) : '',
    },
  });
  const by = sender.name || sender.company;
  if (by) content.push({ type: 'Footer', props: { id: 'or-footer', text: `Sent by ${[sender.name, sender.company].filter(Boolean).join(' \u00b7 ')}`, links: [] } });
  return { root: { props: { ...(puck?.root?.props || {}) } }, content, zones: {} };
}
