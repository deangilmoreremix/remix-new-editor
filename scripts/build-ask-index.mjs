#!/usr/bin/env node
// Builds src/data/askIndex.json, the knowledge index behind Ask SmartVideo.
//
//   npm run build:ask-index            write the index
//   npm run build:ask-index -- --check fail (exit 1) if the committed index is stale
//
// Sources (all in this repo):
//   src/data/askKb/<studio>.json   deep per-studio guides (+ _app.json app facts)
//   src/data/askIntents.js         plain-language intents + synonym groups
//   src/data/askAcademyMap.js      studio -> Academy lessons
//   src/content/academy/**/*.md    Academy lessons and templates
//   public/api/model-catalog.json  models (+ modelComparisonData / modelDescriptions)
// The output is deterministic (no timestamps) so --check is a plain comparison.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/data/askIndex.json');
const MAX_CHARS = 1400;
const MIN_CHARS = 40;
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

const SECRET_RE = /\b(sk-[A-Za-z0-9_-]{16,}|sk_(?:live|test)_[A-Za-z0-9]{10,}|rk_(?:live|test)_[A-Za-z0-9]{10,}|whsec_[A-Za-z0-9]{10,}|ghp_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,})/;

// ── text helpers ─────────────────────────────────────────────────────────────
const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
function render(v) {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.filter((x) => !isEmpty(x)).map((x) => `- ${typeof x === 'object' ? renderObj(x) : x}`).join('\n');
  return renderObj(v);
}
function renderObj(o) {
  return Object.entries(o).filter(([, x]) => !isEmpty(x)).map(([k, x]) => `${k}: ${Array.isArray(x) ? x.map((y) => (typeof y === 'object' ? renderObj(y) : y)).join('; ') : typeof x === 'object' ? renderObj(x) : x}`).join(' | ');
}
/** Split on paragraph/line boundaries into pieces of at most MAX_CHARS. */
function split(text) {
  const out = [];
  let cur = '';
  const push = () => { if (cur.trim()) out.push(cur.trim()); cur = ''; };
  for (const line of String(text).split('\n')) {
    if (line.length > MAX_CHARS) {
      push();
      for (let i = 0; i < line.length; i += MAX_CHARS) out.push(line.slice(i, i + MAX_CHARS));
      continue;
    }
    if ((cur + '\n' + line).length > MAX_CHARS) push();
    cur += (cur ? '\n' : '') + line;
  }
  push();
  return out;
}
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const chunks = [];
const seen = new Set();
function add({ id, kind, studioId = null, title, url, guideUrl, phrases, studios, text }) {
  const parts = split(text);
  parts.forEach((p, i) => {
    if (p.length < MIN_CHARS) return;
    const cid = parts.length > 1 ? `${id}-${i + 1}` : id;
    if (seen.has(cid)) throw new Error(`duplicate chunk id: ${cid}`);
    seen.add(cid);
    const c = { id: cid, kind, studioId, title, url, ...(guideUrl ? { guideUrl } : {}), ...(phrases?.length ? { phrases } : {}), ...(studios?.length ? { studios } : {}), text: p };
    if (SECRET_RE.test(`${title}\n${p}`)) throw new Error(`secret-like text in chunk ${cid}`);
    chunks.push(c);
  });
}

// ── studio guides ────────────────────────────────────────────────────────────
const GROUPS = [
  ['Overview', ['description', 'shortDescription', 'fullDescription', 'bestFor', 'whenToUse', 'whenToUseAnother']],
  ['How to use', ['howToUse', 'howToSteps', 'gettingStarted', 'tips', 'bestPractices']],
  ['Features', ['keyFeatures', 'featureExplanations', 'generationModes', 'modeExplanations', 'modelCapabilities']],
  ['Inputs and outputs', ['inputs', 'requiredInputs', 'optionalInputs', 'inputDetails', 'outputs']],
  ['Problems and limits', ['troubleshooting', 'troubleshootingSteps', 'commonProblems', 'limitations', 'limitationDetails', 'faqs']],
  ['Workflows and use cases', ['exampleWorkflows', 'useCases', 'relatedStudioGuidance']],
];
const LABELS = {
  description: 'Description', shortDescription: 'Summary', fullDescription: 'About', bestFor: 'Best for', whenToUse: 'When to use it', whenToUseAnother: 'When to use another studio',
  howToUse: 'How to use', howToSteps: 'Steps', gettingStarted: 'Getting started', tips: 'Tips', bestPractices: 'Best practices',
  keyFeatures: 'Key features', featureExplanations: 'Feature details', generationModes: 'Modes', modeExplanations: 'Mode details', modelCapabilities: 'Models',
  inputs: 'Inputs', requiredInputs: 'Required inputs', optionalInputs: 'Optional inputs', inputDetails: 'Input details', outputs: 'Outputs',
  troubleshooting: 'Troubleshooting', troubleshootingSteps: 'Troubleshooting steps', commonProblems: 'Common problems', limitations: 'Limitations', limitationDetails: 'Limit details', faqs: 'FAQs',
  exampleWorkflows: 'Example workflows', useCases: 'Use cases', relatedStudioGuidance: 'Related studios',
};

const kbDir = path.join(ROOT, 'src/data/askKb');
const kbFiles = fs.existsSync(kbDir) ? fs.readdirSync(kbDir).filter((f) => f.endsWith('.json')).sort() : [];
const studios = [];
for (const f of kbFiles) {
  if (f.startsWith('_')) continue;
  const kb = JSON.parse(fs.readFileSync(path.join(kbDir, f), 'utf8'));
  if (!kb.id || !kb.name) throw new Error(`${f}: missing id/name`);
  studios.push(kb);
}

const { STUDIO_INTENTS = {}, TRACK_INTENTS = {} } = fs.existsSync(path.join(ROOT, 'src/data/askIntents.js')) ? await imp('src/data/askIntents.js') : {};
const { STUDIO_ACADEMY = {}, TRACK_TITLES = {}, academyTrackUrl, academyLessonUrl } = await imp('src/data/askAcademyMap.js');
// Verified Academy hash form: #/academy/track/<track>[/lesson/<id>] (see AcademyPage.jsx parseAcademyHash).
const academyUrl = (track, lesson) => (lesson ? academyLessonUrl(track, lesson) : academyTrackUrl(track));

for (const kb of studios) {
  const url = kb.route || `#/${kb.id}`;
  for (const [group, fields] of GROUPS) {
    const body = fields.filter((f) => !isEmpty(kb[f])).map((f) => `${LABELS[f]}:\n${render(kb[f])}`).join('\n');
    if (!body) continue;
    add({ id: `studio:${kb.id}:${slug(group)}`, kind: 'studio', studioId: kb.id, title: `${kb.name} — ${group}`, url, text: `${kb.name} (${url}). ${group}.\n${body}` });
  }
  if (!isEmpty(kb.glossary)) add({ id: `studio:${kb.id}:glossary`, kind: 'studio', studioId: kb.id, title: `${kb.name} — Glossary`, url, text: `Glossary: ${Object.entries(kb.glossary).map(([k, v]) => `${k}: ${v}`).join(' | ')}` });
  const intents = STUDIO_INTENTS[kb.id] || [];
  if (intents.length) add({ id: `studio:${kb.id}:ask`, kind: 'studio', studioId: kb.id, title: `${kb.name} — What you can ask or do here`, url, phrases: intents, text: `${kb.name} (${url}). People use this when they want to: ${intents.join('; ')}. ${kb.shortDescription || kb.description || ''}` });
  const ac = STUDIO_ACADEMY[kb.id];
  if (ac?.lessons?.length) {
    add({
      id: `studio:${kb.id}:academy-guide`, kind: 'studio', studioId: kb.id, title: `${kb.name} — Academy lessons`, url,
      text: `Academy lessons that teach skills used in ${kb.name}:\n${ac.lessons.map((l) => `- ${l.lesson.replace(/^\d+-/, '').replace(/-/g, ' ')} (${TRACK_TITLES[l.track] || l.track}): ${l.why} → ${academyUrl(l.track, l.lesson)}`).join('\n')}`,
    });
  }
}

// One chunk listing every studio, so "what studios are there" is answerable.
add({
  id: 'studio:directory', kind: 'studio', title: 'All studios in SmartVideo', url: '#/apps',
  phrases: ['list all studios', 'what studios are there', 'what can this app do', 'all tools'],
  text: studios.map((s) => `- ${s.name}: ${s.route || `#/${s.id}`} — ${s.shortDescription || s.description || ''}`).join('\n'),
});

// ── app-level facts ──────────────────────────────────────────────────────────
const appPath = path.join(kbDir, '_app.json');
if (fs.existsSync(appPath)) {
  for (const f of JSON.parse(fs.readFileSync(appPath, 'utf8')).facts || []) {
    add({ id: `app:${f.id}`, kind: 'app', title: f.title, url: f.route ? `#/${f.route.replace(/^#?\/?/, '')}` : '#/apps', phrases: f.intents, text: `${f.title}.\n${f.text}` });
  }
}

// ── journeys (end-to-end walkthroughs across studios) ───────────────────────
const jdir = path.join(ROOT, 'src/data/askJourneys');
const journeys = fs.existsSync(jdir)
  ? fs.readdirSync(jdir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(jdir, f), 'utf8')))
  : [];
const studioName = Object.fromEntries(studios.map((k) => [k.id, k.name]));
const studioRef = (id) => `${studioName[id] || id} (#/${id})`;
for (const j of journeys) {
  if (!j.id || !j.title || !j.steps?.length || !j.studios?.length) throw new Error(`journey ${j.id}: missing id/title/steps/studios`);
  const url = `#/${j.studios[0]}`;
  const guide = j.academy?.track ? academyUrl(j.academy.track, j.academy.lesson || '') : undefined;
  const base = { kind: 'journey', studioId: j.studios[0], url, studios: j.studios, ...(guide ? { guideUrl: guide } : {}) };
  const phrases = [j.title, `walk me through ${j.title}`, `step by step ${j.title}`, ...(j.intents || [])];
  add({
    ...base, id: `journey:${j.id}:overview`, title: `Walkthrough: ${j.title}`, phrases,
    text: `Walkthrough: ${j.title}. Goal: ${j.goal}\nBest for: ${j.bestFor}\nWhat you need:\n${j.whatYouNeed.map((x) => `- ${x}`).join('\n')}\nPath: ${j.studios.map(studioRef).join(' -> ')}`,
  });
  add({
    ...base, id: `journey:${j.id}:steps`, title: `Walkthrough: ${j.title} — Steps`,
    text: `Walkthrough: ${j.title} (steps).\n${j.steps.map((st) => `Step ${st.n}: ${studioRef(st.studio)} - ${st.action}\n${st.details}${st.buttons?.length ? `\nButtons: ${st.buttons.join('; ')}` : ''}\nResult: ${st.result}\nNext: ${st.handoff}`).join('\n\n')}`,
  });
  const extra = [
    j.checkpoints?.length ? `Checkpoints:\n${j.checkpoints.map((x) => `- ${x}`).join('\n')}` : '',
    j.troubleshooting?.length ? `Troubleshooting:\n${j.troubleshooting.map((x) => `- ${x.problem}: ${x.fix}`).join('\n')}` : '',
    j.tips?.length ? `Tips:\n${j.tips.map((x) => `- ${x}`).join('\n')}` : '',
    j.relatedJourneys?.length ? `Related walkthroughs: ${j.relatedJourneys.join(', ')}` : '',
  ].filter(Boolean).join('\n');
  if (extra) add({ ...base, id: `journey:${j.id}:help`, title: `Walkthrough: ${j.title} — Checkpoints and troubleshooting`, text: `Walkthrough: ${j.title} (help).\n${extra}` });
}
// Small list for the panel's "Make a video" group (the panel can't import the whole index).
const journeyList = `${JSON.stringify(journeys.map((j) => ({ id: j.id, title: j.title, studios: j.studios })), null, 1)}\n`;
const JOURNEY_LIST_OUT = path.join(ROOT, 'src/data/askJourneyList.json');

// ── models ───────────────────────────────────────────────────────────────────
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/api/model-catalog.json'), 'utf8'));
const { MODEL_COMPARISON = {} } = await imp('src/lib/modelComparisonData.js');
const MODEL_TYPES = {
  t2i: ['Text-to-image models', 'image', 'Image Studio'],
  i2i: ['Image-to-image and editing models', 'image', 'Image Studio, Edit Studio and Upscale Suite'],
  t2v: ['Text-to-video models', 'video', 'Video Studio'],
  i2v: ['Image-to-video models', 'video', 'Video Studio and Animate Studio'],
  v2v: ['Video-to-video models', 'videotools', 'Video Studio and Video Tools'],
  audio: ['Audio, speech and music models', 'audio', 'Audio Studio'],
  lipsync: ['Lip sync models', 'lipsync', 'Lip Sync Studio'],
};
for (const [type, [label, studio, where]] of Object.entries(MODEL_TYPES)) {
  const list = catalog[type] || [];
  if (!list.length) continue;
  const lines = list.map((m) => {
    const c = MODEL_COMPARISON[m.id];
    const meta = c ? ` [price ${c.price}, speed ${c.speed}, quality ${c.quality}/5]` : '';
    return `- ${m.name} (${m.provider_name || m.provider})${m.description ? `: ${m.description}` : ''}${meta}`;
  });
  add({
    id: `models:${type}`, kind: 'model', studioId: studio, title: `Models — ${label} (${where})`, url: `#/${studio}`,
    phrases: ['which model should I use', 'best model', 'cheapest model', 'fastest model', 'compare models', 'model prices and quality', `which ${label.toLowerCase()} are available`],
    text: `${label} available in ${where} (${list.length} models). Price is a relative unit, speed is estimated generation time, quality is 1-5 where shown.\n${lines.join('\n')}`,
  });
}

// ── Academy markdown ─────────────────────────────────────────────────────────
function cleanMd(s) {
  return s.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[>*_`]/g, '').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}
const acRoot = path.join(ROOT, 'src/content/academy');
for (const track of fs.existsSync(acRoot) ? fs.readdirSync(acRoot).sort() : []) {
  const tdir = path.join(acRoot, track);
  if (!fs.statSync(tdir).isDirectory()) continue;
  const trackTitle = TRACK_TITLES[track] || track;
  const ti = TRACK_INTENTS[track] || [];
  if (ti.length) add({ id: `academy:${track}:ask`, kind: 'academy', title: `Academy — ${trackTitle}`, url: academyUrl(track), phrases: ti, text: `Academy course "${trackTitle}". People take it when they want to: ${ti.join('; ')}.` });
  for (const kind of ['lessons', 'templates']) {
    const kdir = path.join(tdir, kind);
    if (!fs.existsSync(kdir)) continue;
    for (const file of fs.readdirSync(kdir).filter((f) => f.endsWith('.md')).sort()) {
      const base = file.replace(/\.md$/, '');
      const raw = fs.readFileSync(path.join(kdir, file), 'utf8');
      const h1 = (raw.match(/^#\s+(.+)$/m) || [, base])[1].trim();
      const sections = raw.split(/^##\s+/m);
      const intro = cleanMd(sections.shift().replace(/^#\s+.+$/m, ''));
      // lessons/README.md is the track overview, not a catalog lesson: link to the track page.
      const isOverview = kind === 'lessons' && base === 'README';
      const url = kind === 'lessons' && !isOverview ? academyUrl(track, base) : academyUrl(track);
      const label = isOverview ? 'Academy course overview' : kind === 'lessons' ? 'Academy lesson' : 'Academy template';
      if (intro) add({ id: `academy:${track}:${kind}:${base}:0`, kind: 'academy', title: h1, url, text: `${label}: ${h1} (${trackTitle}).\n${intro}` });
      sections.forEach((sec, si) => {
        const [head, ...rest] = sec.split('\n');
        const body = cleanMd(rest.join('\n'));
        if (body) add({ id: `academy:${track}:${kind}:${base}:${si + 1}`, kind: 'academy', title: `${h1} — ${cleanMd(head)}`, url, text: `${label}: ${h1} / ${cleanMd(head)} (${trackTitle}).\n${body}` });
      });
    }
  }
}

// ── write / check ────────────────────────────────────────────────────────────
const byKind = {};
chunks.forEach((c) => { byKind[c.kind] = (byKind[c.kind] || 0) + 1; });
const json = `${JSON.stringify({ meta: { generatedBy: 'scripts/build-ask-index.mjs', chunkCount: chunks.length, byKind }, chunks })}\n`;

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  const curList = fs.existsSync(JOURNEY_LIST_OUT) ? fs.readFileSync(JOURNEY_LIST_OUT, 'utf8') : '';
  if (cur !== json || curList !== journeyList) {
    console.error('src/data/askIndex.json or askJourneyList.json is stale. Run: npm run build:ask-index');
    process.exit(1);
  }
  console.log(`askIndex.json is up to date (${chunks.length} chunks)`);
} else {
  fs.writeFileSync(OUT, json);
  fs.writeFileSync(JOURNEY_LIST_OUT, journeyList);
  console.log(`Wrote ${path.relative(ROOT, OUT)}: ${chunks.length} chunks`, byKind, `${(json.length / 1024).toFixed(0)} KB`, `+ ${journeys.length} journeys`);
}
