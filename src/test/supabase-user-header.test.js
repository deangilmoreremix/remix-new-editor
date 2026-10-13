// The shared Supabase client must attach the caller identity (`x-user-key`)
// to every request: the media RLS policies and the owner-scoped storage
// policies derive the row/object owner from that header, and the identity
// changes at runtime when the user signs in or out.

import { describe, test, expect, vi } from 'vitest';

const identity = { value: 'user-test-1' };

vi.mock('../lib/userKey.js', () => ({
  getUserKey: () => identity.value,
}));

describe('shared Supabase client identity header', () => {
  test('attaches x-user-key to PostgREST and storage clients', async () => {
    const { supabase } = await import('../lib/supabase.js');
    supabase.from('media');
    supabase.storage.from('uploads');
    expect(supabase.rest.headers['x-user-key']).toBe('user-test-1');
    expect(supabase.storage.headers['x-user-key']).toBe('user-test-1');
  });

  test('refreshSupabaseUserHeader picks up an identity change', async () => {
    const { supabase, refreshSupabaseUserHeader } = await import('../lib/supabase.js');
    identity.value = 'user-test-2';
    refreshSupabaseUserHeader();
    expect(supabase.rest.headers['x-user-key']).toBe('user-test-2');
  });
});
