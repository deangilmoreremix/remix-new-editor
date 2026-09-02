// Generates src/data/academy/catalog.ts from the cloned upstream repo.
// Run: node scripts/gen-academy-catalog.mjs
// The upstream repo is used ONLY as an import/source (read once, never at runtime).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = process.env.ACADEMY_SRC || '/tmp/ai-creator-academy';
const OUT = new URL('../src/data/academy/catalog.ts', import.meta.url).pathname;

const MEDIA_EXT = {
  jpg: 'image', jpeg: 'image', png: 'image', svg: 'image',
  gif: 'gif',
  mp3: 'audio',
  mp4: 'video', webm: 'video', mov: 'video',
};
const TRACK01_SLUG = '01-ai-video-ads-ugc';
const T01_TEMPLATE_KIND = {
  'ugc-script-template.md': { id: 'ugc-script', kind: 'ugc-script', recipeId: 'create-ugc-ad', ctaLabel: 'Create With Smart Video' },
  'ad-brief-checklist.md': { id: 'ad-brief', kind: 'ad-brief', recipeId: 'ai-campaign-planner', ctaLabel: 'Create With Smart Video' },
  'character-consistency-checklist.md': { id: 'character-consistency-checklist', kind: 'character-consistency-checklist', recipeId: 'create-consistent-character', ctaLabel: 'Use Template' },
  'batch-matrix-template.md': { id: 'batch-matrix', kind: 'batch-matrix', recipeId: 'create-ugc-campaign', ctaLabel: 'Create With Smart Video' },
  'teardown-worksheet.md': { id: 'teardown', kind: 'teardown', recipeId: 'ai-campaign-planner', ctaLabel: 'Use Template' },
  'outreach-template.md': { id: 'outreach', kind: 'outreach', recipeId: undefined, ctaLabel: 'Use Template' },
  'retainer-proposal-template.md': { id: 'retainer', kind: 'retainer', recipeId: undefined, ctaLabel: 'Use Template' },
};

function read(p) { try { return readFileSync(p, 'utf8'); } catch { return ''; } }
function exists(p) { try { return statSync(p).isFile(); } catch { return false; } }
function isDir(p) { try { return statSync(p).isDirectory(); } catch { return false; } }
function walk(dir, out = []) {
  if (!isDir(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (isDir(p)) walk(p, out);
    else out.push(p);
  }
  return out;
}
function humanize(s) { return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
function stripLink(md) { return md.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'); }
function firstPara(text, pred) {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  for (const p of paras) {
    if (p.startsWith('#')) continue;
    if (pred && !pred(p)) continue;
    return stripLink(p).replace(/\*+/g, '').trim();
  }
  return '';
}
function baseNoExt(f) { return f.replace(/\.[^.]+$/, ''); }

const tracksDir = join(SRC, 'tracks');
const trackDirs = readdirSync(tracksDir).filter((d) => statSync(join(tracksDir, d)).isDirectory()).sort();

const TRACKS = [];
const LESSONS = [];
const TEMPLATES = [];
const ASSETS = [];

for (const slug of trackDirs) {
  const tdir = join(tracksDir, slug);
  const readme = read(join(tdir, 'README.md'));
  const readmeTitle = (readme.match(/^#\s*Track\s+\d+:\s*(.+)$/m) || [])[1] || humanize(slug);
  const readmeSummary = firstPara(readme, (p) => !p.startsWith('|') && !p.startsWith('**')) || '';

  // lessons (md files directly in track root, excluding README)
  const lessonFiles = readdirSync(tdir).filter((f) => f.endsWith('.md') && f !== 'README.md' && exists(join(tdir, f)));
  const fileToLessonId = {};
  const trackLessonIds = [];
  for (const f of lessonFiles.sort()) {
    const txt = read(join(tdir, f));
    const title = (txt.match(/^#\s+(.+)$/m) || [])[1] || baseNoExt(f);
    const time = (txt.match(/\*\*Time:\*\*\s*([^\n]+)/) || [])[1]?.trim() || '';
    const prereq = (txt.match(/\*\*Prerequisites:\*\*\s*([^\n]+)/) || [])[1]?.trim() || '';
    const summary = (txt.match(/^>\s*(.+)$/m) || [])[1] || firstPara(txt, (p) => !p.startsWith('**')) || '';
    const order = parseInt(f.match(/^(\d+)-/) ? f.match(/^(\d+)-/)[1] : '99', 10);
    const id = slug === TRACK01_SLUG ? baseNoExt(f).replace(/^\d+-/, '') : `${slug}::${baseNoExt(f)}`;
    fileToLessonId[f] = id;
    trackLessonIds.push(id);
    LESSONS.push({
      id, trackSlug: slug, order, title: title.trim(), summary: summary.trim(),
      time, prerequisites: prereq, rawPath: `/academy/${slug}/raw/lessons/${f}`,
      relatedTemplateIds: [], relatedAssetIds: [],
    });
  }

  // templates
  const tplDir = join(tdir, 'templates');
  const tplFiles = isDir(tplDir) ? readdirSync(tplDir).filter((f) => f.endsWith('.md')) : [];
  const trackTemplateIds = [];
  for (const f of tplFiles.sort()) {
    const txt = read(join(tplDir, f));
    const title = (txt.match(/^#\s+(.+)$/m) || [])[1] || baseNoExt(f);
    const fromMatch = txt.match(/\[Module[^\]]*\]\(([^)]+)\)/);
    let lessonId;
    if (fromMatch) {
      const linked = fromMatch[1].split('/').pop();
      lessonId = fileToLessonId[linked] || undefined;
    }
    const description = firstPara(txt, (p) => !p.startsWith('From [') && !p.startsWith('**')) || '';
    let meta;
    if (slug === TRACK01_SLUG && T01_TEMPLATE_KIND[f]) {
      meta = T01_TEMPLATE_KIND[f];
    } else {
      meta = { id: `${slug}::${baseNoExt(f)}`, kind: 'generic', recipeId: undefined, ctaLabel: 'Use Template' };
    }
    trackTemplateIds.push(meta.id);
    if (lessonId) {
      const L = LESSONS.find((l) => l.id === lessonId);
      if (L) L.relatedTemplateIds.push(meta.id);
    }
    TEMPLATES.push({
      id: meta.id, trackSlug: slug, kind: meta.kind, title: title.trim(),
      description: description.trim(), lessonId, recipeId: meta.recipeId,
      assetIds: [], ctaLabel: meta.ctaLabel, rawPath: `/academy/${slug}/raw/templates/${f}`,
    });
  }

  // media (recursive walk of the whole track dir)
  const allFiles = walk(tdir);
  const mediaFiles = allFiles
    .filter((p) => MEDIA_EXT[p.split('.').pop()?.toLowerCase()])
    .map((p) => p.slice(tdir.length + 1)); // relative to track dir
  // group by base
  const byBase = {};
  for (const rel of mediaFiles) {
    const base = baseNoExt(rel.split('/').pop());
    byBase[base] = byBase[base] || [];
    byBase[base].push(rel);
  }
  const trackAssetIds = [];
  for (const [base, rels] of Object.entries(byBase)) {
    const has = (e) => rels.some((r) => r.endsWith('.' + e));
    const isGif = has('gif');
    const isMp4 = has('mp4') || has('webm') || has('mov');
    const img = rels.find((r) => /\.(jpg|jpeg|png|svg)$/i.test(r));
    const gif = rels.find((r) => r.endsWith('.gif'));
    const vid = rels.find((r) => /\.(mp4|webm|mov)$/i.test(r));
    let type, srcPath, gifSrc, videoSrc, thumb;
    const fname = (vid || gif || img).split('/').pop();
    if (isMp4 || isGif) {
      type = 'video';
      videoSrc = vid ? `/academy/${slug}/videos/${vid.split('/').pop()}` : undefined;
      gifSrc = gif ? `/academy/${slug}/gifs/${gif.split('/').pop()}` : undefined;
      srcPath = gifSrc || videoSrc;
      thumb = gifSrc || videoSrc;
    } else {
      type = 'image';
      srcPath = `/academy/${slug}/images/${img.split('/').pop()}`;
      thumb = srcPath;
    }
    const id = slug === TRACK01_SLUG ? base : `${slug}::${base}`;
    // link to lesson/template by filename mention
    let lesson, template;
    const mention = (txt) => txt.includes(fname) || txt.includes(base);
    for (const tf of tplFiles) {
      if (mention(read(join(tplDir, tf)))) { template = `${slug === TRACK01_SLUG ? T01_TEMPLATE_KIND[tf]?.id : `${slug}::${baseNoExt(tf)}`}`; break; }
    }
    if (!template) {
      for (const lf of lessonFiles) {
        if (mention(read(join(tdir, lf)))) { lesson = fileToLessonId[lf]; break; }
      }
    }
    trackAssetIds.push(id);
    if (template) { const T = TEMPLATES.find((t) => t.id === template); if (T) T.assetIds.push(id); }
    if (lesson) { const L = LESSONS.find((l) => l.id === lesson); if (L) L.relatedAssetIds.push(id); }
    ASSETS.push({
      id, title: humanize(base), type, category: slug, src: srcPath, thumbnail: thumb,
      lesson, template, description: humanize(base), tags: [slug],
      videoSrc, gifSrc,
    });
  }

  TRACKS.push({
    slug, title: readmeTitle.trim(), summary: readmeSummary.trim(),
    order: parseInt(slug.match(/^(\d+)/)?.[1] || '99', 10),
    lessonIds: trackLessonIds, templateIds: trackTemplateIds, assetIds: trackAssetIds,
  });
}

const out = `// AUTO-GENERATED by scripts/gen-academy-catalog.mjs — do not edit by hand.
// Source of truth: the cloned upstream academy repo (imported once, never at runtime).
export type AcademyAssetType = 'image' | 'video' | 'gif';

export interface AcademyAsset {
  id: string;
  title: string;
  type: AcademyAssetType;
  category: string;
  src: string;
  thumbnail: string;
  lesson?: string;
  template?: string;
  description: string;
  tags: string[];
  videoSrc?: string;
  gifSrc?: string;
}

export interface AcademyLesson {
  id: string;
  trackSlug: string;
  order: number;
  title: string;
  summary: string;
  time?: string;
  prerequisites?: string;
  rawPath: string;
  relatedTemplateIds: string[];
  relatedAssetIds: string[];
}

export interface AcademyTemplateMeta {
  id: string;
  trackSlug: string;
  kind: string;
  title: string;
  description: string;
  lessonId?: string;
  recipeId?: string;
  assetIds: string[];
  ctaLabel: string;
  rawPath: string;
}

export interface AcademyTrack {
  slug: string;
  title: string;
  summary: string;
  order: number;
  lessonIds: string[];
  templateIds: string[];
  assetIds: string[];
}

export const ACADEMY_TRACKS: AcademyTrack[] = ${JSON.stringify(TRACKS, null, 2)};

export const ACADEMY_LESSONS: AcademyLesson[] = ${JSON.stringify(LESSONS, null, 2)};

export const ACADEMY_TEMPLATE_META: AcademyTemplateMeta[] = ${JSON.stringify(TEMPLATES, null, 2)};

export const ACADEMY_ASSETS: AcademyAsset[] = ${JSON.stringify(ASSETS, null, 2)};

export function getTrack(slug: string): AcademyTrack | undefined {
  return ACADEMY_TRACKS.find((t) => t.slug === slug);
}
export function getLessonById(id: string): AcademyLesson | undefined {
  return ACADEMY_LESSONS.find((l) => l.id === id);
}
export function getTemplateMeta(id: string): AcademyTemplateMeta | undefined {
  return ACADEMY_TEMPLATE_META.find((t) => t.id === id);
}
export function getAssetById(id: string): AcademyAsset | undefined {
  return ACADEMY_ASSETS.find((a) => a.id === id);
}
export function getAssetsForLesson(lessonId: string): AcademyAsset[] {
  return ACADEMY_ASSETS.filter((a) => a.lesson === lessonId || a.tags.includes(lessonId));
}
export function getAssetsForTemplate(templateId: string): AcademyAsset[] {
  return ACADEMY_ASSETS.filter((a) => a.template === templateId);
}
`;

writeFileSync(OUT, out);
console.log(`Wrote ${OUT}`);
console.log(`tracks=${TRACKS.length} lessons=${LESSONS.length} templates=${TEMPLATES.length} assets=${ASSETS.length}`);
