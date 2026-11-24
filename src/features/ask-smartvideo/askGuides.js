// Studio feature guides inside Ask SmartVideo.
//
// The guides (/studios/<slug>) are built from the same knowledge files as the AI answers.
// Here they back two things that need no OpenAI key:
//   - the panel shows the active studio's features (definition, why, needs, limits, screenshot)
//   - a local keyword search over every feature of every guide
// The guide data is a lazy chunk, loaded the first time the panel needs it.

let guidesPromise = null;

/** All guides (same objects the /studios pages render). */
export function loadGuides() {
  if (!guidesPromise) {
    guidesPromise = import('../../data/studioGuides.js')
      .then((m) => m.ALL_GUIDES)
      .catch((e) => { guidesPromise = null; throw e; });
  }
  return guidesPromise;
}

/** The guide for a studio id (askKb file name / app route), or null. */
export async function guideForStudio(studioId) {
  if (!studioId) return null;
  const guides = await loadGuides();
  return guides.find((g) => g.route === studioId) || null;
}

export const guideUrl = (g, f) => `/studios/${g.slug}/${f ? `#feature-${f.id}` : ''}`;

const STOP = new Set(('the and for with how can what does that this from into your you are use using about which when where why who '
  + 'there their them then than its it my me our out get make do does did have has not but all any one way want need help tell show '
  + 'studio studios smartvideo app page')
  .split(' '));
const tokens = (s) => (String(s || '').toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => (t.length > 2 || /\d/.test(t)) && !STOP.has(t));

/**
 * Keyword search over every feature of every guide.
 * @returns {Promise<Array<{ guide: object, feature: object, score: number }>>}
 */
export async function searchGuides(query, { studioId = null, limit = 5 } = {}) {
  const q = [...new Set(tokens(query))];
  if (!q.length) return [];
  const guides = await loadGuides();
  const hits = [];
  for (const g of guides) {
    const studioName = String(g.name).toLowerCase();
    for (const f of g.features) {
      const name = String(f.name).toLowerCase();
      const body = `${f.definition} ${f.whyToUse} ${f.inputRequired} ${f.restrictions}`.toLowerCase();
      let score = 0;
      let matched = 0;
      for (const t of q) {
        if (name.includes(t)) { score += 3; matched++; } else if (studioName.includes(t)) { score += 1.5; matched++; } else if (body.includes(t)) { score += 1; matched++; }
      }
      if (!score) continue;
      score *= 0.5 + 0.5 * (matched / q.length);
      if (studioId && g.route === studioId) score *= 2;
      hits.push({ guide: g, feature: f, score });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}
