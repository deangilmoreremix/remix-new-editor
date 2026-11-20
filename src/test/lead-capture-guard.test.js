import { describe, it, expect } from 'vitest';
import { isGuestOwner, needsHumanCheck } from '../../supabase/functions/lead-capture/logic.ts';

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
