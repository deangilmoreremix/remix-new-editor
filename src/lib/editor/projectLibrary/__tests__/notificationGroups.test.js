import { describe, it, expect } from 'vitest';
import { NOTIFICATION_GROUPS, NOTIFICATION_TYPES, groupState, setGroup, cleanPreferences, DEFAULT_PREFERENCES } from '../tabsData.js';

describe('notification groups', () => {
  it('cover every alert type exactly once except daily_digest', () => {
    const grouped = NOTIFICATION_GROUPS.flatMap((g) => g.types);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(NOTIFICATION_TYPES.map(([k]) => k).filter((k) => !grouped.includes(k))).toEqual(['daily_digest']);
    expect(NOTIFICATION_GROUPS.find((g) => g.id === 'leads').types).toEqual(['new_lead']);
  });
  it('reports all / some / none', () => {
    expect(groupState(DEFAULT_PREFERENCES.enabled_types, 'retarget')).toBe('all');
    expect(groupState(['high_interest'], 'retarget')).toBe('some');
    expect(groupState(['new_lead'], 'retarget')).toBe('none');
    expect(groupState([], 'nope')).toBe('none');
  });
  it('turning a group off removes only its types and keeps daily_digest', () => {
    const next = setGroup(DEFAULT_PREFERENCES.enabled_types, 'retarget', false);
    expect(next).toContain('daily_digest');
    expect(next).toContain('new_lead');
    for (const t of ['high_interest', 'followup_opportunity', 'interest_surge', 'returning_engagement']) expect(next).not.toContain(t);
  });
  it('turning a group on adds its types once and keeps the rest', () => {
    const next = setGroup(['daily_digest', 'milestone'], 'activity', true);
    expect(next.filter((t) => t === 'milestone')).toHaveLength(1);
    expect(next).toEqual(expect.arrayContaining(['daily_digest', 'milestone', 'pricing_cta', 'contact_cta']));
    expect(setGroup(undefined, 'leads', true)).toEqual(['new_lead']);
  });
  it('the push opt-in defaults off and is kept by cleanPreferences', () => {
    expect(DEFAULT_PREFERENCES.push).toBe(false);
    expect(cleanPreferences({ ...DEFAULT_PREFERENCES, push: true }).push).toBe(true);
    expect(cleanPreferences({ ...DEFAULT_PREFERENCES, push: 'yes please' }).push).toBe(true);
    expect(cleanPreferences({ enabled_types: [] }).push).toBe(false);
  });
});
