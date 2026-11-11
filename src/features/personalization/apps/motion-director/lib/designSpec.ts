/**
 * The film's design spec (upstream: the co-creation outputs saved with the film): what the film
 * was asked to be, the visual tokens, the storyboard rows and the data rules. It rides on the
 * project so the final review has a baseline and the person can download it.
 */
import { resolveMotionTemplate } from '../../../data/motionRecipeCatalog';
import type { DesignSpec, ProjectData } from '../types';
import type { DirectorPlan } from './directorPlan';
import { isBrandScene } from './directorPlan';
import { sceneLine } from './coCreate';
import type { ReviewItem } from './filmReview';
import type { SiteCapture } from './directorClient';
import { pickMotionPreset, presetText } from './motionPreset';

export const DATA_RULES = [
  'Words on screen come from the site or the brief; nothing is invented (no made-up numbers, handles or domains).',
  'Pictures of named customers or staff are avoided unless the brief confirms them.',
  'Text drawn inside a captured page is kept as the site shows it.',
];

export function buildDesignSpec(plan: DirectorPlan, capture: SiteCapture | null, prompt = ''): DesignSpec {
  let at = 0;
  const scenes = plan.scenes.map((scene, i) => {
    const row = { n: i + 1, start: Number(at.toFixed(2)), durationSec: scene.durationSec, kind: scene.kind, recipeId: scene.recipeId, line: sceneLine(scene, at) };
    at += scene.durationSec;
    return row;
  });
  return {
    version: 1,
    brief: prompt.trim().slice(0, 400),
    product: plan.title,
    url: capture?.url ?? null,
    sampleOnly: !capture || Boolean(capture.partial) || !capture.page?.url,
    tokens: {
      background: plan.palette.background,
      text: plan.palette.text,
      accent: plan.palette.accent,
      font: capture?.brand?.fontFamily ?? null,
      motion: (({ id, label, mainFrames, easing, overshoot, squash }) => ({ id, label, mainFrames, easing, overshoot, squash }))(pickMotionPreset({ text: presetText(capture ?? { title: plan.title }), accent: plan.palette.accent })),
    },
    scenes,
    dataRules: DATA_RULES,
  };
}

/** Markdown for the download: the storyboard table plus the tokens and data rules. */
export function specMarkdown(spec: DesignSpec): string {
  const rows = spec.scenes.map((s) => `| ${s.n} | ${s.line.replace(/\|/g, '/')} |`);
  return [
    `# Design spec — ${spec.product}`,
    '',
    spec.brief ? `**Brief:** ${spec.brief}` : undefined,
    spec.url ? `**Site:** ${spec.url}` : '**Site:** none (sample pages)',
    `**Tokens:** background ${spec.tokens.background}, text ${spec.tokens.text}, accent ${spec.tokens.accent}${spec.tokens.font ? `, font ${spec.tokens.font}` : ''}`,
    spec.direction ? `**Visual direction:** ${spec.direction}` : undefined,
    spec.tokens.motion ? `**Motion voice:** ${spec.tokens.motion.label} (main move ${spec.tokens.motion.mainFrames} f, ${spec.tokens.motion.easing}, overshoot ${spec.tokens.motion.overshoot}, squash ${spec.tokens.motion.squash})` : undefined,
    '',
    '## Storyboard',
    '',
    '| # | Scene |',
    '|---|---|',
    ...rows,
    '',
    ...(spec.mapping?.length
      ? ['## Feature → shot map', '', '| Feature | First choice | Fallback | Expresses | Page state |', '|---|---|---|---|---|', ...spec.mapping.map((m) => `| ${[m.feature, m.firstShot, m.altShot || '—', m.expresses, m.pageState].map((c) => c.replace(/\|/g, '/')).join(' | ')} |`), '']
      : []),
    ...(spec.release?.length ? ['## Release check', '', ...spec.release.map((r) => `- ${r.ok ? '✓' : '✗'} ${r.code}: ${r.text}`), ''] : []),
    '## Data rules',
    '',
    ...spec.dataRules.map((r) => `- ${r}`),
    '',
  ]
    .filter((l) => typeof l === 'string')
    .join('\n');
}

/** Review items comparing the built film with its spec (the baseline the checklist asks for). */
export function reviewAgainstSpec(project: ProjectData): ReviewItem[] {
  const spec = project.spec;
  if (!spec) return [];
  const have = new Set(project.tracks.flatMap((t) => t.clips).map((c) => c.cardId));
  const missing = spec.scenes
    .filter((s) => s.kind === 'shot' && s.recipeId && !isBrandScene(s.recipeId))
    .filter((s) => {
      const t = resolveMotionTemplate(s.recipeId);
      return t && !have.has(`demo:${t.componentName}`);
    });
  const items: ReviewItem[] = [
    {
      code: 'V1',
      ok: missing.length === 0,
      text: missing.length ? `Scene${missing.length === 1 ? '' : 's'} ${missing.map((m) => m.n).join(', ')} of the design spec no longer appear in the film.` : 'Every recipe in the design spec is in the film.',
    },
  ];
  const accent = spec.tokens.accent.toLowerCase();
  const captions = project.tracks.flatMap((t) => t.clips).filter((c) => c.cardId === 'inkpress-caption');
  if (captions.length) {
    const off = captions.filter((c) => typeof c.props.accent === 'string' && c.props.accent.toLowerCase() !== accent).length;
    items.push({ code: 'V3', ok: off === 0, text: off ? `${off} caption${off === 1 ? '' : 's'} use an accent colour that is not in the design spec.` : 'Captions use the spec\'s accent colour.' });
  }
  return items;
}
