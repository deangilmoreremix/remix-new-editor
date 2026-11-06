import { describe, expect, it } from 'vitest';
import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';
import { ACCEPT_RE, YOU_DECIDE_RE, briefMessage, directionMessage, mappingMessage, pickDirection, sceneDetail, sceneLine } from '../lib/coCreate';
import { validateBrief, validateDirections, validateMapping } from '../lib/directorPlan';
import { planToProject } from '../lib/buildFilm';

const deck = MOTION_TEMPLATES.find((t) => t.componentName === 'DeckDealFlyin')!;
const row = MOTION_TEMPLATES.find((t) => t.componentName === 'RowEmbed')!;

describe('co-creation steps', () => {
  it('trims a brief to rows and at most three questions, and refuses an empty one', () => {
    const brief = validateBrief({ rows: [{ item: 'Positioning', judgment: 'A', evidence: 'B' }, { item: '', judgment: 'x' }], questions: ['1', '2', '3', '4'] });
    expect(brief.rows).toHaveLength(1);
    expect(brief.questions).toHaveLength(3);
    expect(() => validateBrief({ rows: [] })).toThrow();
    expect(briefMessage(brief, false)).toContain('Positioning: A (B)');
  });

  it('keeps at most three directions and points the recommendation at one of them', () => {
    const d = { name: 'N', claim: 'C', keywords: ['a'], look: '', motion: '', why: '', tradeoff: '' };
    const options = validateDirections({ directions: [d, d, d, d], recommended: 9 });
    expect(options.directions).toHaveLength(3);
    expect(options.recommended).toBe(0);
    expect(pickDirection('b', options)).toBe(1);
    expect(pickDirection('go with C', options)).toBe(2);
    expect(pickDirection('D', options)).toBe(-1);
    expect(directionMessage(options)).toContain('I’d recommend A');
  });

  it('maps features to catalog shots only, one lead per technique', () => {
    const rows = validateMapping({
      rows: [
        { feature: 'Speed', firstShot: deck.id, altShot: 'nope/none/Fake', expresses: 'x', pageState: 'hero' },
        { feature: 'Again', firstShot: deck.id, altShot: '', expresses: '', pageState: '' },
        { feature: 'Invented', firstShot: 'nope/none/Fake', altShot: '', expresses: '', pageState: '' },
        { feature: 'Rows', firstShot: row.id, altShot: deck.id, expresses: '', pageState: '' },
      ],
    });
    expect(rows.map((r) => r.firstShot)).toEqual([deck.id, row.id]);
    expect(rows[0].altShot).toBe('');
    expect(rows[1].altShot).toBe(deck.id);
    expect(mappingMessage(rows)).toContain('Speed →');
    expect(() => validateMapping({ rows: [] })).toThrow();
  });

  it('reads yes and "you decide"', () => {
    expect(ACCEPT_RE.test('Looks right!')).toBe(true);
    expect(ACCEPT_RE.test('make it longer')).toBe(false);
    expect(YOU_DECIDE_RE.test('honestly you decide')).toBe(true);
  });

  it('writes a storyboard row with time, shot, message, motion, picture and sound', () => {
    const scene = { kind: 'shot' as const, recipeId: deck.id, durationSec: 4, headline: 'Ship faster', caption: '', transition: 'flash' as const, feature: 'Speed', action: 'cards deal in', asset: 'hero of your page', sfx: 'impact' };
    expect(sceneLine(scene, 65)).toBe('1:05–1:09 · Deck Deal Flyin · message: Speed · on screen: “Ship faster” · motion: cards deal in · shows: hero of your page · sound: impact · flash cut');
    expect(sceneDetail(scene, 65).startsWith('1:05–1:09 · message: Speed')).toBe(true);
  });
});

describe('site insets', () => {
  it('show one section of the page per scene when the page has sections', () => {
    const plan = {
      title: 't', summary: '', palette: { background: '#fff', text: '#000', accent: '#f00' },
      scenes: ['Spotlight', 'Hit'].map((n, i) => ({ kind: 'shot' as const, recipeId: MOTION_TEMPLATES.filter((t) => !/Real$/.test(t.componentName))[i + 3].id, durationSec: 3, headline: '', caption: '', transition: 'cut' as const })),
    };
    const project = planToProject(plan, { aspectRatio: '16:9', capture: { screens: ['page.jpg'], crops: [], title: 'Acme', sections: [100, 1500, 3000], pageH: 4000, sectionNames: ['Hero', 'Features', 'Pricing'] } });
    const insets = project.tracks.find((t) => t.name === 'Site')?.clips ?? [];
    expect(insets.length).toBeGreaterThan(0);
    expect(insets.every((c) => c.props.file === 'page.jpg')).toBe(true);
    expect(insets[0].props.label).toBe('Hero');
    expect(Number(insets[1]?.props.focusY ?? 100)).toBeGreaterThan(Number(insets[0].props.focusY));
  });
});
