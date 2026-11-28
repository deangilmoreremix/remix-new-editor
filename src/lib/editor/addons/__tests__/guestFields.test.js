// Someone publishing without an account is not offered webhooks, email alerts, thank-you emails or email-list connections.
import { describe, it, expect, afterEach } from 'vitest';
import '../index.js';
import { listBuilderFields } from '../listBuilder.js';
import { ACCOUNT_ONLY_FIELDS } from '../accountGate.js';

const keys = (config) => listBuilderFields(config).map((f) => f.key);
afterEach(() => { delete globalThis.window.Clerk; });

describe('Integrations fields for guests', () => {
  it('hides every account-only setting and says why, but keeps pixels and the throwaway-email block', () => {
    delete globalThis.window.Clerk;
    const k = keys({ kind: 'list-builder' });
    for (const key of ACCOUNT_ONLY_FIELDS) expect(k).not.toContain(key);
    expect(k).toContain('fbPixelId');
    expect(k).toContain('gaMeasurementId');
    expect(k).toContain('blockDisposableEmails');
    const note = listBuilderFields({ kind: 'list-builder' }).find((f) => f.key === '_accountOnlyNote');
    expect(note).toMatchObject({ type: 'note', tab: 'Integrations' });
    expect(note.text).toMatch(/need an account/i);
  });

  it('shows all of them, and no note, once signed in', () => {
    globalThis.window.Clerk = { user: { id: 'user_1' } };
    const k = keys({ kind: 'list-builder' });
    for (const key of ACCOUNT_ONLY_FIELDS) expect(k).toContain(key);
    expect(k).not.toContain('_accountOnlyNote');
  });

  it('the Lead Generator shares the same rule', () => {
    delete globalThis.window.Clerk;
    expect(keys({ kind: 'lead-generator' })).not.toContain('webhookEnabled');
    globalThis.window.Clerk = { user: { id: 'u' } };
    expect(keys({ kind: 'lead-generator' })).toContain('webhookEnabled');
  });

  it('the Personalizer has no integrations at all, so nothing changes for it', () => {
    delete globalThis.window.Clerk;
    expect(keys({ kind: 'personalizer' })).not.toContain('_accountOnlyNote');
  });
});
