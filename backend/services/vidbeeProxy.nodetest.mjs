import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowed } from './vidbeeProxy.js';

describe('vidbee gate allowlist', () => {
  it('denies everyone outside development when unset', () => {
    assert.equal(isAllowed({ id: 'u1' }, { NODE_ENV: 'production' }), false);
    assert.equal(isAllowed({ id: 'u1' }, { NODE_ENV: 'development' }), true);
  });
  it('matches user id or email case-insensitively', () => {
    const env = { NODE_ENV: 'production', VIDBEE_ALLOWED_USERS: 'U1, Admin@X.com' };
    assert.equal(isAllowed({ id: 'u1' }, env), true);
    assert.equal(isAllowed({ id: 'z', email: 'admin@x.com' }, env), true);
    assert.equal(isAllowed({ id: 'other', email: 'o@x.com' }, env), false);
    assert.equal(isAllowed(undefined, env), false);
  });
});
