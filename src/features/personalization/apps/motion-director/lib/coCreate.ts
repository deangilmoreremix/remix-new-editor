/**
 * Co-creation, the way video-shotcraft's guided flow runs it: the director proposes and the person
 * confirms, one step at a time — product brief → visual direction → feature-to-shot mapping →
 * the storyboard. Pure text helpers: what each step says in the chat, and how an answer is read.
 */
import { MOTION_TEMPLATES, motionTemplateTitle, resolveMotionTemplate } from '../../../data/motionRecipeCatalog';
import type { DirectionOptions, DirectorBrief, DirectorScene, MappingRow, VisualDirection } from './directorPlan';
import { BRAND_SCENES, isBrandScene } from './directorPlan';

/** "You decide", "surprise me": the person hands the remaining choices to the director. */
export const YOU_DECIDE_RE = /\b(?:you (?:decide|choose|pick)|your call|decide for me|surprise me|skip (?:the )?(?:questions|confirmations?)|just (?:make|build) it|go ahead and decide)\b/i;
/** A plain yes to the step on the table. */
export const ACCEPT_RE = /^\W*(?:y|yes|yep|yeah|ok|okay|sure|looks? (?:right|good)|that'?s right|good|great|perfect|accept(?:ed)?|approve[d]?|confirm(?:ed)?|go|go ahead|continue|next|fine|done)\W*$/i;

const shotTitle = (id: string): string => {
  if (isBrandScene(id)) return BRAND_SCENES[id].title;
  const t = id ? resolveMotionTemplate(id) : undefined;
  return t && MOTION_TEMPLATES.includes(t) ? motionTemplateTitle(t) : id;
};

export function briefMessage(brief: DirectorBrief, sampleOnly: boolean): string {
  const rows = brief.rows.map((r) => `• ${r.item}: ${r.judgment}${r.evidence ? ` (${r.evidence})` : ''}`);
  const ask = brief.questions.length ? `\n\nTo confirm:\n${brief.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}` : '';
  return [
    `Product check${sampleOnly ? ' (no site pages captured, so this rests on your message)' : ''}:`,
    rows.join('\n') + ask,
    'Answer in your own words, or say “looks right” and I’ll propose visual directions. Say “you decide” and I’ll choose the rest and show you the storyboard.',
  ].join('\n');
}

const LETTERS = 'ABC';

export function directionMessage(options: DirectionOptions): string {
  const lines = options.directions.map(
    (d, i) =>
      `${LETTERS[i]}. ${d.name} — ${d.claim}\n   ${[d.keywords.length ? d.keywords.join(', ') : '', d.look && `look: ${d.look}`, d.motion && `motion: ${d.motion}`, d.why && `why: ${d.why}`, d.tradeoff && `trade-off: ${d.tradeoff}`].filter(Boolean).join(' · ')}`,
  );
  return `Visual directions grown from your product:\n${lines.join('\n')}\n\nI’d recommend ${LETTERS[options.recommended]}. Pick a letter, describe your own, or say “you decide”.`;
}

export function mappingMessage(rows: MappingRow[]): string {
  const lines = rows.map(
    (r, i) => `${i + 1}. ${r.feature} → ${shotTitle(r.firstShot)}${r.altShot ? ` (or ${shotTitle(r.altShot)})` : ''}${r.expresses ? ` — ${r.expresses}` : ''}${r.pageState ? ` · needs: ${r.pageState}` : ''}`,
  );
  return `Features mapped to shots (one main motion each):\n${lines.join('\n')}\n\nSay “looks right” and I’ll write the storyboard, or tell me what to change.`;
}

/** Which direction an answer picks: its letter, its name, or none. */
export function pickDirection(text: string, options: DirectionOptions): number {
  const t = text.trim();
  const letter = t.match(/^\W*(?:option |direction |go with |use |pick )?([abc])\b\W*$/i)?.[1];
  if (letter) {
    const i = LETTERS.indexOf(letter.toUpperCase());
    if (i >= 0 && i < options.directions.length) return i;
  }
  const lower = t.toLowerCase();
  return options.directions.findIndex((d) => lower.includes(d.name.toLowerCase()));
}

export const directionText = (d: VisualDirection): string =>
  `${d.name}: ${d.claim} Look: ${d.look}. Motion: ${d.motion}.`;

export const briefText = (brief: DirectorBrief): string => brief.rows.map((r) => `${r.item}: ${r.judgment}`).join('\n');

export const mappingText = (rows: MappingRow[]): string =>
  rows.map((r, i) => `${i + 1}. ${r.feature} → ${shotTitle(r.firstShot)}${r.expresses ? ` (${r.expresses})` : ''}${r.pageState ? ` [${r.pageState}]` : ''}`).join('\n');

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** The parts of one storyboard row: when, which shot, what it says, its motion, the site picture it shows, caption and sound. */
function sceneParts(scene: DirectorScene, startSec: number): string[] {
  const title = scene.kind === 'title' ? 'Title card' : shotTitle(scene.recipeId);
  return [
    `${clock(startSec)}–${clock(startSec + scene.durationSec)}`,
    title,
    scene.feature && `message: ${scene.feature}`,
    scene.headline && `on screen: “${scene.headline.replace(/\*/g, '')}”`,
    scene.action && `motion: ${scene.action}`,
    scene.asset && `shows: ${scene.asset}`,
    scene.caption && `caption: ${scene.caption}`,
    scene.sfx && `sound: ${scene.sfx}`,
    scene.transition !== 'cut' && scene.transition && ({ flash: 'flash cut', wipe: 'wipe cut', barn: 'barn-door cut', dip: 'dip cut', whip: 'whip-pan', ink: 'ink-bleed cut', leak: 'light-leak cut', portal: 'portal cut', iris: 'iris cut', line: 'line-carry cut', glitch: 'glitch cut', window: 'through-the-window cut', push: 'bottom-push cut' } as const)[scene.transition],
  ].filter((p): p is string => Boolean(p));
}

export const sceneLine = (scene: DirectorScene, startSec: number): string => sceneParts(scene, startSec).join(' · ');

/** A storyboard row's detail in the plan card (the shot is the card's label): time first, then the rest. */
export function sceneDetail(scene: DirectorScene, startSec: number): string {
  const [when, , ...rest] = sceneParts(scene, startSec);
  return [when, ...rest].join(' · ');
}
