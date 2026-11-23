import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
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
  const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261112212041_create_template_generator_templates.sql'), 'utf8');
  it('is owner-only with RLS, no anon access and no TRUNCATE', () => {
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/revoke all on public\.template_generator_templates from anon/);
    expect(sql).toMatch(/grant select, insert, update, delete on public\.template_generator_templates to authenticated/);
    expect(sql).not.toMatch(/to anon/);
    for (const op of ['select', 'insert', 'update', 'delete']) expect(sql).toMatch(new RegExp(`for ${op}\\s+to authenticated`));
    expect(sql).toMatch(/primary key \(clerk_user_id, id\)/);
  });
});

describe('remote adapter robustness (review follow-ups)', () => {
  const clientWith = (impl) => ({ from: () => ({ upsert: impl, select: () => ({ eq: () => ({ limit: impl }) }) }) });
  it('keeps pushing the other batches when one fails, then reports the failure', async () => {
    const calls = [];
    const remote = createSupabaseRemote(async () => clientWith(async (rows) => { calls.push(rows.length); return { error: calls.length === 1 ? { message: 'boom' } : null }; }));
    const pushes = Array.from({ length: 120 }, (_, i) => ({ id: `tpl-${i}-xxxx`, record: { name: `T${i}` }, ts: 1 }));
    await expect(remote.upsert('u', pushes)).rejects.toThrow('boom');
    expect(calls).toEqual([50, 50, 20]);                       // all three batches were attempted
  });
  it('only calls a missing TABLE "not set up" — other "does not exist" errors keep their own message', async () => {
    const fail = (error) => createSupabaseRemote(async () => clientWith(async () => ({ data: null, error }))).list('u');
    await expect(fail({ code: '42P01', message: 'relation "public.template_generator_templates" does not exist' })).rejects.toThrow(/not set up on the server/);
    await expect(fail({ code: 'PGRST205', message: "Could not find the table 'public.x' in the schema cache" })).rejects.toThrow(/not set up on the server/);
    await expect(fail({ code: '42703', message: 'column "foo" does not exist' })).rejects.toThrow('column "foo" does not exist');
    await expect(fail({ code: '42883', message: 'function bar() does not exist' })).rejects.toThrow('function bar() does not exist');
  });
});

describe('database labelling (the Supabase project is shared by several apps)', () => {
  const dir = resolve(process.cwd(), 'supabase/migrations');
  const files = readdirSync(dir).filter((f) => /template_generator/.test(f));
  const sql = Object.fromEntries(files.map((f) => [f, readFileSync(resolve(dir, f), 'utf8')]));
  const labels = sql[files.find((f) => /_labels\.sql$/.test(f))];

  it('every object name starts with template_generator_', () => {
    const all = Object.values(sql).join('\n');
    const names = [...all.matchAll(/(?:create (?:unique )?index (?:if not exists )?|create or replace function public\.|create trigger |create table if not exists public\.)([a-z_]+)/gi)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(3);
    for (const n of names) expect(n.startsWith('template_generator_'), n).toBe(true);
  });
  it('the policies are renamed to app-prefixed names', () => {
    for (const v of ['read', 'insert', 'update', 'delete']) expect(labels).toContain(`template_generator_owners_${v}_own`);
  });
  it('the table, all 8 columns, index, function, trigger and policies carry an [app: template-generator] comment', () => {
    expect(labels).toMatch(/comment on table public\.template_generator_templates is\s+'\[app: template-generator\]/);
    for (const c of ['clerk_user_id', 'id', 'name', 'niche', 'record', 'deleted_at', 'created_at', 'updated_at']) expect(labels, c).toMatch(new RegExp(`comment on column public\\.template_generator_templates\\.${c}\\s+is '\\[app: template-generator\\]`));
    expect(labels).toMatch(/comment on index public\.template_generator_templates_owner_updated_idx is '\[app: template-generator\]/);
    expect(labels).toMatch(/comment on function public\.template_generator_templates_guard\(\) is\s+'\[app: template-generator\]/);
    expect(labels).toMatch(/comment on trigger template_generator_templates_guard on public\.template_generator_templates is\s+'\[app: template-generator\]/);
    expect(labels).toMatch(/comment on policy %I on public\.template_generator_templates/);
  });
  it('the labels migration changes no data, grants or access rules', () => {
    expect(labels).not.toMatch(/\b(grant|revoke|insert into|update public|delete from|drop table|alter table)\b/i);
  });
});
