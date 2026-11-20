import { describe, it, expect } from 'vitest';
import { isGuestOwner, needsHumanCheck, insertLeadRow } from '../../supabase/functions/lead-capture/logic.ts';

describe('insertLeadRow (repeat sign-ups are stored once)', () => {
  const recorder = (results) => { const calls = []; return { calls, insert: async (r) => { calls.push(r); return { error: results.shift() ?? null }; } }; };
  it('adds the email_key when the lead has an email, and not otherwise', async () => {
    const a = recorder([null]);
    expect(await insertLeadRow(a.insert, { kind: 'lead-form' }, 'ann@x.io')).toEqual({ error: null, duplicate: false });
    expect(a.calls[0]).toEqual({ kind: 'lead-form', email_key: 'ann@x.io' });
    const b = recorder([null]);
    await insertLeadRow(b.insert, { kind: 'lead-form' }, '');
    expect(b.calls[0]).toEqual({ kind: 'lead-form' });
  });
  it('the unique index rejecting the row (23505) is reported as a duplicate', async () => {
    const a = recorder([{ code: '23505' }]);
    expect(await insertLeadRow(a.insert, { kind: 'lead-form' }, 'ann@x.io')).toEqual({ error: { code: '23505' }, duplicate: true });
    expect(a.calls).toHaveLength(1);                     // no second attempt
  });
  it('while the migration is not applied (missing column) it retries without email_key and stores the lead', async () => {
    for (const code of ['42703', 'PGRST204']) {
      const a = recorder([{ code }, null]);
      expect(await insertLeadRow(a.insert, { kind: 'lead-form' }, 'ann@x.io')).toEqual({ error: null, duplicate: false });
      expect(a.calls).toEqual([{ kind: 'lead-form', email_key: 'ann@x.io' }, { kind: 'lead-form' }]);
    }
  });
  it('if the retry without email_key fails too, that error is returned (and a duplicate on the retry is still a duplicate)', async () => {
    const failed = recorder([{ code: '42703' }, { code: '500' }]);
    expect(await insertLeadRow(failed.insert, { kind: 'lead-form' }, 'ann@x.io')).toEqual({ error: { code: '500' }, duplicate: false });
    expect(failed.calls).toHaveLength(2);
    const dup = recorder([{ code: 'PGRST204' }, { code: '23505' }]);
    expect(await insertLeadRow(dup.insert, { kind: 'lead-form' }, 'ann@x.io')).toEqual({ error: { code: '23505' }, duplicate: true });
  });
  it('any other error is returned as is (not a duplicate)', async () => {
    const a = recorder([{ code: '500' }]);
    expect(await insertLeadRow(a.insert, {}, 'ann@x.io')).toEqual({ error: { code: '500' }, duplicate: false });
  });
});

describe('lead-capture guards', () => {
  it('a call-attempt is not asked for a Turnstile token, every other kind is', () => {
    expect(needsHumanCheck('call-attempt')).toBe(false);
    ['lead-form', 'list-builder', 'personalizer', undefined, null, '', 'anything'].forEach((k) => expect(needsHumanCheck(k)).toBe(true));
  });
  it('only ids that start with guest_ are guest owners', () => {
    expect(isGuestOwner('guest_abc123')).toBe(true);
    ['user_2abc', 'abc_guest_', '', null, undefined, 42].forEach((id) => expect(isGuestOwner(id)).toBe(false));
  });
});
