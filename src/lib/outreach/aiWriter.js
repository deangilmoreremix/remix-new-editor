// src/lib/outreach/aiWriter.js
//
// AI script writer (Sendspark "Scripts & Teleprompter"): from who you're writing to and what
// you want to say, drafts the recording script, the email, or the landing page text. One small
// text request on the user's MuAPI key, made only when they click Write. Prompts and parsing
// are plain functions; the request itself is passed in (`generate`).

export const WRITER_LANGUAGES = [
  ['English', 'en'], ['Spanish', 'es'], ['French', 'fr'], ['German', 'de'], ['Portuguese', 'pt'],
  ['Italian', 'it'], ['Dutch', 'nl'], ['Japanese', 'ja'], ['Korean', 'ko'], ['Chinese', 'zh'],
  ['Hindi', 'hi'], ['Arabic', 'ar'],
];

export const WRITER_KINDS = ['script', 'email', 'page'];

const clean = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** The request for one kind of text. */
export function buildWriterPrompt(kind, { audience = '', message = '', language = 'English', useName = true, seconds = 60 } = {}) {
  const who = clean(audience, 400) || 'a prospect';
  const what = clean(message, 1200) || 'introduce what we do and ask for a short call';
  const lang = WRITER_LANGUAGES.some(([l]) => l === language) ? language : 'English';
  const name = useName
    ? 'Where the prospect\'s first name belongs, write {{firstname}} exactly; you may use {{company}} for their company.'
    : 'Do not address the prospect by name.';
  const base = `Audience: ${who}\nMessage: ${what}\nWrite in ${lang}. ${name} Be warm, specific and brief. No hashtags, no emojis, no placeholders other than those tokens.`;
  if (kind === 'email') {
    return {
      prompt: `${base}\n\nWrite a short sales email that introduces a personal video. Put {{link}} on its own line where the video goes. Reply with JSON only: {"subject": "...", "body": "..."} where body uses \\n for line breaks and is under 90 words.`,
      maxWords: 120,
    };
  }
  if (kind === 'page') {
    return {
      prompt: `${base}\n\nWrite the text for the landing page under a personal video. Reply with JSON only: {"header": "... (under 80 characters)", "message": "... (one or two sentences)", "cta": "... (button label, 2 to 4 words)"}`,
      maxWords: 80,
    };
  }
  const words = Math.max(30, Math.min(400, Math.round((Number(seconds) || 60) * 2.3)));
  // One recording is sent to everyone: only the greeting at [pause] changes per contact, so the
  // script itself must not contain tokens.
  const scriptBase = `Audience: ${who}\nMessage: ${what}\nWrite in ${lang}. Be warm, specific and brief. No hashtags, no emojis. Do not use any {{tokens}} or names: the same recording goes to everyone${useName ? ', and a personalized greeting with their name is added at [pause]' : ''}.`;
  return {
    prompt: `${scriptBase}\n\nWrite a script to read aloud on camera, about ${words} words (${Math.round(words / 2.3)} seconds). Start with "[pause]" on its own line: the greeting with their name is added there. Short sentences, one per line. Reply with the script only.`,
    maxWords: words + 60,
  };
}

const jsonIn = (text) => {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
};

/** The reply → what the studio fills in. Throws when the reply is unusable. */
export function parseWriterReply(kind, text) {
  if (kind === 'email') {
    const j = jsonIn(text);
    if (!j?.subject || !j?.body) throw new Error('The AI reply was not a usable email. Try again.');
    let body = String(j.body).replace(/\\n/g, '\n').trim().slice(0, 2000);
    if (!/\{\{\s*link\s*\}\}/i.test(body)) body += '\n\n{{link}}';
    return { subject: clean(j.subject, 150), body };
  }
  if (kind === 'page') {
    const j = jsonIn(text);
    if (!j?.header) throw new Error('The AI reply was not usable landing page text. Try again.');
    return { header: clean(j.header, 120), message: String(j.message ?? '').trim().slice(0, 1000), cta: clean(j.cta, 40) };
  }
  const script = String(text || '').replace(/^```\w*\n?|```$/g, '').trim().slice(0, 6000);
  if (!script) throw new Error('The AI reply was empty. Try again.');
  return { script };
}

/**
 * Write one kind of text. `generate(prompt, signal)` → reply text (the MuAPI call).
 */
export async function writeWithAI(kind, input, { generate, signal } = {}) {
  if (!WRITER_KINDS.includes(kind)) throw new Error(`Unknown kind: ${kind}`);
  const { prompt } = buildWriterPrompt(kind, input);
  return parseWriterReply(kind, await generate(prompt, signal));
}

/** The MuAPI text call the studio uses (the user's key; small model). */
export async function muapiGenerate(prompt, signal) {
  const { muapi } = await import('../muapi.js');
  return muapi.text(prompt, 'gpt-6-luna', signal);
}

/**
 * Translate the campaign's texts into `language`, keeping {{tokens}} as they are.
 * texts: { greeting, header, message, ctaLabel, subject, body, thumbText } → the same keys.
 */
export function buildTranslatePrompt(texts, language) {
  return `Translate each value of this JSON into ${language}. Keep every {{token}} exactly as written (do not translate inside the braces) and keep line breaks. Reply with the same JSON keys only.\n${JSON.stringify(texts)}`;
}

export function parseTranslateReply(text, keys) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  let j = null;
  try { j = m ? JSON.parse(m[0]) : null; } catch { j = null; }
  if (!j) throw new Error('The translation came back unusable. Try again.');
  const out = {};
  const tokens = (s) => (String(s).match(/\{\{\s*[A-Za-z0-9_]+\s*\}\}/g) || []).map((t) => t.replace(/\s/g, '').toLowerCase()).sort().join();
  for (const k of keys) if (typeof j[k] === 'string') out[k] = j[k];
  return { out, tokens };
}

/** Translate texts, refusing a result that lost or invented a {{token}}. */
export async function translateTexts(texts, language, { generate, signal } = {}) {
  const keys = Object.keys(texts).filter((k) => String(texts[k] || '').trim());
  const subset = Object.fromEntries(keys.map((k) => [k, texts[k]]));
  const { out, tokens } = parseTranslateReply(await generate(buildTranslatePrompt(subset, language), signal), keys);
  for (const k of keys) {
    if (out[k] == null) throw new Error('The translation missed some of the text. Try again.');
    if (tokens(out[k]) !== tokens(subset[k])) throw new Error('The translation changed a {{token}}. Try again.');
  }
  return out;
}
