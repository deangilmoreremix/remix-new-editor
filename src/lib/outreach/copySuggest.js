// src/lib/outreach/copySuggest.js
//
// Free, deterministic copy suggestions (requirements 19 and 20). No model, no network, no paid call.
// They only reshape your own words and the {{tokens}} you already use; they never invent facts about a prospect.
// (The paid writer in aiWriter.js is untouched and stays opt-in.)

const T = { first: '{{firstname}}', company: '{{company}}', link: '{{link}}' };

export const HEADERS = Object.freeze([
  `Hi ${T.first}, I made this for you`,
  `A quick idea for ${T.company}, ${T.first}`,
  `${T.first}, 60 seconds for ${T.company}`,
  `Hi ${T.first}, here is a short video for ${T.company}`,
]);

export const MESSAGES = Object.freeze({
  intro: [
    `I recorded a short video to introduce myself and show how I can help ${T.company}.`,
    `Watch the video below, then tell me what you think.`,
  ],
  demo: [
    `Here is a quick look at how this could work for ${T.company}.`,
    `If it makes sense, pick a time below and we will go through it together.`,
  ],
  followup: [
    `Following up on my earlier note: here is the short video again.`,
    `If now is not a good time, tell me and I will check back later.`,
  ],
});

export const CTAS = Object.freeze(['Book a call', 'Pick a time', 'See how it works', 'Reply to me', 'Get in touch']);

/** Subject + body for an outreach email, using the same tokens the email step fills. */
export function suggestEmail(goal = 'intro') {
  const sets = {
    intro: { subject: `${T.first}, a short video for ${T.company}`, body: `Hi ${T.first},\n\nI made a short video for ${T.company}. It takes about a minute.\n\n${T.link}\n\nIf it is useful, reply and we can talk.` },
    demo: { subject: `A quick look at ${T.company}`, body: `Hi ${T.first},\n\nHere is a short walkthrough I recorded for ${T.company}:\n\n${T.link}\n\nIf it helps, you can pick a time on the page.` },
    followup: { subject: `Following up, ${T.first}`, body: `Hi ${T.first},\n\nIn case it got buried, here is the video again:\n\n${T.link}\n\nA short reply is enough if now is not the right time.` },
  };
  return sets[goal] || sets.intro;
}

export const suggestHeaders = () => [...HEADERS];
export const suggestMessages = (goal = 'intro') => (MESSAGES[goal] || MESSAGES.intro).map((m) => m);
export const suggestCtas = () => [...CTAS];

// ---- Script tools: they only remove words you wrote or add a plain closing line you can discard.
const FILLERS = [
  /\b(just|basically|actually|literally|really|kind of|sort of|you know)\b[,]?\s*/gi,
  /\bI (just )?wanted to (reach out and )?(say|let you know|introduce myself)( that)?\b[,]?\s*/gi,
  /\bI hope (this finds you well|you are (doing )?well)[.!]?\s*/gi,
];
const words = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
// A sentence ends at . ! or ? followed by a space or the end, so "1.5 hours" and "example.com" stay in one piece.
// A period after a title or similar ("Dr.", "Mr.", "vs.", "e.g.") never ends one. A company suffix ("Inc.", "Ltd.", "Co.")
// ends one only when a capitalised word follows ("Acme Inc. Book a time."), not mid-sentence ("Acme Inc. today").
const TITLES = 'Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|vs|e\\.g|i\\.e';
const COMPANY = 'Inc|Ltd|Co';
const SENTENCE = new RegExp(`.+?(?:(?:(?<!\\b(?:${TITLES}|${COMPANY}))\\.|(?<=\\b(?:${COMPANY}))\\.(?=\\s+[A-Z]|\\s*$)|[!?])[.!?]*(?=\\s|$)|$)\\s*`, 'gs');
const sentences = (t) => String(t || '').match(SENTENCE)?.map((s) => s.trim()).filter(Boolean) || [];
const WPM = 150;

/** Spoken length in seconds at a normal pace. */
export const speakSeconds = (text, wpm = WPM) => Math.round((words(text) / Math.max(60, wpm)) * 60);

/**
 * A tighter version of a script: filler words out, then the last sentences dropped (never the first) until it fits
 * `maxSeconds`. Returns what changed so the user can compare and accept or discard.
 */
export function tightenScript(text, { maxSeconds = 0 } = {}) {
  let out = String(text || '');
  const removed = [];
  for (const re of FILLERS) out = out.replace(re, (m) => { removed.push(m.trim()); return ''; });
  out = out.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
  const list = sentences(out);
  if (maxSeconds > 0) {
    while (list.length > 1 && speakSeconds(list.join(' ')) > maxSeconds) removed.push(list.pop());
  }
  const result = list.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
  return { text: result, removed, seconds: speakSeconds(result), before: speakSeconds(text) };
}

/** Add a plain closing call to action when the script has none. */
export function withClosingCta(text, cta = 'If it sounds useful, pick a time on the page and we will talk.') {
  const s = String(text || '').trim();
  if (!s) return s;
  if (/\b(book|pick a time|schedule|reply|get in touch|call me|click)\b/i.test(sentences(s).slice(-2).join(' '))) return s;
  return `${s}${/[.!?]$/.test(s) ? '' : '.'} ${cta}`;
}

/** The opening line alone, shortened to its first sentence (for a stronger, shorter start). */
export const shortOpening = (text, maxWords = 14) => {
  const first = sentences(text)[0] || '';
  const w = first.split(/\s+/);
  return w.length <= maxWords ? first : `${w.slice(0, maxWords).join(' ').replace(/[,;:]$/, '')}.`;
};

/** A line-by-line comparison: [{ type: 'same'|'removed'|'added', text }]. */
export function diffSentences(before, after) {
  const a = sentences(before);
  const b = sentences(after);
  const out = [];
  const inB = new Set(b.map((s) => s.toLowerCase()));
  const inA = new Set(a.map((s) => s.toLowerCase()));
  a.forEach((s) => out.push({ type: inB.has(s.toLowerCase()) ? 'same' : 'removed', text: s }));
  b.forEach((s) => { if (!inA.has(s.toLowerCase())) out.push({ type: 'added', text: s }); });
  return out;
}
