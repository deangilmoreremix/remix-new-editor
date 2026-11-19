import { describe, it, expect, vi } from 'vitest';
import {
  NOTIFICATION_GROUPS, DEFAULT_PREFERENCES, PUSHABLE_TYPES, effectivePushTypes, pushGroupState, setPushGroup, setAlertType,
  cleanPreferences, loadPreferences, savePreferences, isMissingPushTypes,
} from '../tabsData.js';

const ALL = DEFAULT_PREFERENCES.enabled_types;

describe('push_types mapping', () => {
  it('never includes daily_digest as pushable', () => {
    expect(PUSHABLE_TYPES).not.toContain('daily_digest');
    expect(PUSHABLE_TYPES).toHaveLength(8);
    expect(effectivePushTypes({ enabled_types: ALL, push_types: null })).not.toContain('daily_digest');
    expect(effectivePushTypes({ enabled_types: ALL, push_types: ['daily_digest', 'new_lead'] })).toEqual(['new_lead']);
  });
  it('null / absent push_types means push every enabled type (legacy)', () => {
    expect(effectivePushTypes({ enabled_types: ['new_lead', 'milestone', 'daily_digest'], push_types: null })).toEqual(['new_lead', 'milestone']);
    expect(effectivePushTypes({ enabled_types: ['new_lead'] })).toEqual(['new_lead']);
    expect(effectivePushTypes(DEFAULT_PREFERENCES)).toEqual(PUSHABLE_TYPES);
  });
  it('an explicit array is intersected with enabled_types', () => {
    expect(effectivePushTypes({ enabled_types: ['new_lead', 'milestone'], push_types: ['milestone', 'pricing_cta'] })).toEqual(['milestone']);
    expect(effectivePushTypes({ enabled_types: ALL, push_types: [] })).toEqual([]);
  });
  it('loadPreferences keeps null when the column is missing or null', async () => {
    const client = (data) => ({ from: () => ({ select: () => ({ maybeSingle: async () => ({ data, error: null }) }) }) });
    expect((await loadPreferences(client({ enabled_types: ['new_lead'], push: true }))).push_types).toBeNull();
    expect((await loadPreferences(client({ enabled_types: ['new_lead'], push_types: null }))).push_types).toBeNull();
    expect((await loadPreferences(client({ push_types: ['new_lead'] }))).push_types).toEqual(['new_lead']);
    expect((await loadPreferences(client(null))).push_types).toBeNull();
  });
  it('cleanPreferences always writes an explicit array', () => {
    expect(cleanPreferences({ ...DEFAULT_PREFERENCES }).push_types).toEqual(PUSHABLE_TYPES);
    expect(cleanPreferences({ ...DEFAULT_PREFERENCES, enabled_types: ['new_lead', 'daily_digest'] }).push_types).toEqual(['new_lead']);
    expect(cleanPreferences({ ...DEFAULT_PREFERENCES, push_types: ['new_lead', 'hack', 'daily_digest'] }).push_types).toEqual(['new_lead']);
    expect(cleanPreferences({ enabled_types: ['new_lead'], push_types: [] }).push_types).toEqual([]);
  });
  it('a type that is not enabled cannot be saved as push', () => {
    expect(cleanPreferences({ enabled_types: ['milestone'], push_types: ['new_lead', 'milestone'] }).push_types).toEqual(['milestone']);
  });
  it('unchecking Alert clears Push; checking it does not turn Push on', () => {
    expect(setAlertType(['new_lead', 'milestone'], ['new_lead', 'milestone'], 'milestone', false)).toEqual({ enabled_types: ['new_lead'], push_types: ['new_lead'] });
    expect(setAlertType(['new_lead'], ['new_lead'], 'milestone', true)).toEqual({ enabled_types: ['new_lead', 'milestone'], push_types: ['new_lead'] });
  });
  it('group Push master: all / some / none over the alert-enabled types, indeterminate when some', () => {
    const retarget = NOTIFICATION_GROUPS.find((g) => g.id === 'retarget').types;
    expect(pushGroupState(ALL, retarget, 'retarget')).toBe('all');
    expect(pushGroupState(ALL, ['high_interest'], 'retarget')).toBe('some');
    expect(pushGroupState(ALL, ['new_lead'], 'retarget')).toBe('none');
    expect(pushGroupState(['high_interest'], ['high_interest'], 'retarget')).toBe('all'); // Alert-off types do not count
    expect(pushGroupState([], [], 'retarget')).toBe('none');
    expect(pushGroupState(ALL, [], 'nope')).toBe('none');
  });
  it('setPushGroup switches only alert-enabled types of that group', () => {
    expect(setPushGroup(['new_lead'], ['new_lead', 'high_interest', 'milestone'], 'retarget', true)).toEqual(['new_lead', 'high_interest']);
    expect(setPushGroup(PUSHABLE_TYPES, ALL, 'retarget', false)).toEqual(['new_lead', 'milestone', 'pricing_cta', 'contact_cta']);
    expect(setPushGroup(undefined, ALL, 'leads', true)).toEqual(['new_lead']);
  });
});

describe('savePreferences fallback', () => {
  const clientWith = (errors) => {
    const upserts = [];
    return { upserts, from: () => ({ upsert: async (row) => { upserts.push(row); return { error: errors[upserts.length - 1] ?? null }; } }) };
  };
  it('detects the missing column by message or code', () => {
    expect(isMissingPushTypes({ message: "Could not find the 'push_types' column" })).toBe(true);
    expect(isMissingPushTypes({ code: 'PGRST204', message: 'x' })).toBe(true);
    expect(isMissingPushTypes({ code: '42703', message: 'column does not exist' })).toBe(true);
    expect(isMissingPushTypes({ message: 'permission denied' })).toBe(false);
    expect(isMissingPushTypes(null)).toBe(false);
  });
  it('saves normally when the column exists', async () => {
    const c = clientWith([]); const cb = vi.fn();
    const row = await savePreferences(c, DEFAULT_PREFERENCES, { onPushTypesMissing: cb });
    expect(c.upserts).toHaveLength(1);
    expect(row.push_types).toEqual(PUSHABLE_TYPES);
    expect(cb).not.toHaveBeenCalled();
  });
  it('retries without push_types when the column is missing and reports it', async () => {
    const c = clientWith([{ code: 'PGRST204', message: "Could not find the 'push_types' column of 'retarget_preferences' in the schema cache" }]); const cb = vi.fn();
    const row = await savePreferences(c, DEFAULT_PREFERENCES, { onPushTypesMissing: cb });
    expect(c.upserts).toHaveLength(2);
    expect('push_types' in c.upserts[0]).toBe(true);
    expect('push_types' in c.upserts[1]).toBe(false);
    expect('push_types' in row).toBe(false);
    expect(cb).toHaveBeenCalledOnce();
  });
  it('throws unrelated errors and a failing retry', async () => {
    await expect(savePreferences(clientWith([{ message: 'permission denied' }]), DEFAULT_PREFERENCES)).rejects.toThrow('permission denied');
    await expect(savePreferences(clientWith([{ code: '42703', message: 'push_types' }, { message: 'boom' }]), DEFAULT_PREFERENCES)).rejects.toThrow('boom');
  });
});
