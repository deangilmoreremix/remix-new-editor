import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { planSync, createSyncedTemplateStore, createSupabaseRemote, SYNC_STATUS } from '../components/modals/template-generator/sync.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const rec = (id, name, updatedAt, extra = {}) => ({ id, name, updatedAt, createdAt: 1, uses: 0, clips: [], ...extra });

/** An in-memory stand-in for the table, shared by every "device". */
const fakeRemote = () => {
  const rows = new Map(); // `${uid}|${id}` -> row
  return {
    rows,
    async list(uid) { return [...rows.entries()].filter(([k]) => k.startsWith(`${uid}|`)).map(([, v]) => v); },
    async upsert(uid, pushes) {
      for (const p of pushes) rows.set(`${uid}|${p.id}`, { id: p.id, record: p.record || {}, updated_at: new Date(p.ts).toISOString(), deleted_at: p.record ? null : new Date(p.ts).toISOString() });
    },
  };
};
const device = (remote, uid = () => 'user_1') => createSyncedTemplateStore({ storage: memory(), remote, getUserId: uid, schedule: () => 0 });

describe('planSync', () => {
  const row = (id, ms, extra = {}) => ({ id, record: rec(id, `R-${id}`, ms), updated_at: new Date(ms).toISOString(), deleted_at: null, ...extra });
  it('pushes new local, pulls new remote', () => {
    const p = planSync([rec('a', 'A', 100)], {}, [row('b', 200)]);
    expect(p.push.map((x) => x.id)).toEqual(['a']);
    expect(p.put.map((x) => x.id)).toEqual(['b']);
  });
  it('newest edit wins either way, ties change nothing', () => {
    expect(planSync([rec('a', 'A', 100)], {}, [row('a', 200)]).put[0].name).toBe('R-a');
    expect(planSync([rec('a', 'A', 300)], {}, [row('a', 200)]).push.map((x) => x.id)).toEqual(['a']);
    const tie = planSync([rec('a', 'A', 200)], {}, [row('a', 200)]);
    expect([tie.put, tie.push, tie.forget].every((x) => x.length === 0)).toBe(true);
    const delTie = planSync([rec('a', 'A', 200)], {}, [row('a', 200, { deleted_at: new Date(200).toISOString() })]);
    expect(delTie.forget).toEqual(['a']);
  });
  it('propagates deletes both ways and never resurrects', () => {
    const dead = row('a', 500, { deleted_at: new Date(500).toISOString() });
    expect(planSync([rec('a', 'A', 100)], {}, [dead]).forget).toEqual(['a']);       // deleted elsewhere
    expect(planSync([], { a: 600 }, [row('a', 500)]).push[0]).toMatchObject({ id: 'a', record: null }); // deleted here
    expect(planSync([], {}, [dead]).put).toEqual([]);                               // new device ignores tombstones
    expect(planSync([rec('a', 'A', 900)], {}, [dead]).push[0].record.name).toBe('A'); // re-saved after delete wins
  });
});

describe('synced store (two devices, one account)', () => {
  it('a template saved on one device appears on the other, and edits and deletes follow', async () => {
    const remote = fakeRemote();
    const phone = device(remote); const laptop = device(remote);
    const a = phone.save({ name: 'Weekend promo', clips: [] });
    expect(await phone.sync()).toBe(SYNC_STATUS.SYNCED);
    expect(remote.rows.size).toBe(1);

    await laptop.sync();
    expect(laptop.list().map((t) => t.name)).toEqual(['Weekend promo']);

    await new Promise((r) => setTimeout(r, 5));
    laptop.save({ name: 'Weekend promo v2' }, { id: a.id });
    await laptop.sync(); await phone.sync();
    expect(phone.get(a.id).name).toBe('Weekend promo v2');

    laptop.remove(a.id);
    await laptop.sync(); await phone.sync();
    expect(phone.list()).toEqual([]);
    expect([...remote.rows.values()][0].deleted_at).toBeTruthy();
    await laptop.sync();                       // nothing comes back
    expect(laptop.list()).toEqual([]);
  });

  it('works offline / signed out and adopts those templates on sign-in', async () => {
    const remote = fakeRemote(); let uid = null;
    const dev = device(remote, () => uid);
    dev.save({ name: 'Made signed out' });
    expect(await dev.sync()).toBe(SYNC_STATUS.LOCAL);
    expect(remote.rows.size).toBe(0);
    uid = 'user_1';
    expect(dev.list()).toEqual([]);            // the account's own copy starts empty…
    await dev.sync();                          // …and adopts the signed-out templates
    expect(dev.list().map((t) => t.name)).toEqual(['Made signed out']);
    expect(remote.rows.size).toBe(1);
  });

  it('keeps accounts apart on a shared browser', async () => {
    const remote = fakeRemote(); let uid = 'user_1'; const storage = memory();
    const dev = createSyncedTemplateStore({ storage, remote, getUserId: () => uid, schedule: () => 0 });
    dev.save({ name: 'Alice template' }); await dev.sync();
    uid = 'user_2';
    expect(dev.list()).toEqual([]);
    await dev.sync();
    expect(dev.list()).toEqual([]);
    expect([...remote.rows.keys()].every((k) => k.startsWith('user_1|'))).toBe(true);
  });

  it('a sync failure never loses local work and reports the error', async () => {
    const remote = { list: async () => { throw new Error('boom'); }, upsert: async () => {} };
    const dev = device(remote); const seen = [];
    dev.subscribe((s) => seen.push(s));
    dev.save({ name: 'Local only' });
    expect(await dev.sync()).toBe(SYNC_STATUS.ERROR);
    expect(dev.list().length).toBe(1);
    expect(seen).toContain(SYNC_STATUS.SYNCING); expect(seen.at(-1)).toBe(SYNC_STATUS.ERROR);
  });

  it('explains a missing table or an expired session in plain words', async () => {
    const mk = (error) => createSupabaseRemote(async () => ({ from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: null, error }) }) }) }) }));
    await expect(mk({ code: 'PGRST205', message: 'x' }).list('u')).rejects.toThrow(/not set up on the server/);
    await expect(mk({ message: 'JWT expired' }).list('u')).rejects.toThrow(/Sign in again/);
  });
});

describe('migration', () => {
  const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261112120000_create_template_generator_templates.sql'), 'utf8');
  it('is owner-only with RLS, no anon access and no TRUNCATE', () => {
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/revoke all on public\.template_generator_templates from anon/);
    expect(sql).toMatch(/grant select, insert, update, delete on public\.template_generator_templates to authenticated/);
    expect(sql).not.toMatch(/to anon/);
    for (const op of ['select', 'insert', 'update', 'delete']) expect(sql).toMatch(new RegExp(`for ${op}\\s+to authenticated`));
    expect(sql).toMatch(/primary key \(clerk_user_id, id\)/);
  });
});
