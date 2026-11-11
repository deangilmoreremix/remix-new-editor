import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// The builder shares SmartVideo's Supabase project. A bare `projects`,
// `profiles`, `templates`, ... there is the MAIN APP's table, with a different
// shape and different owners, so every builder query must go through the wb_*
// names in lib/tables.ts. Upstream OpenThorn uses the bare names, so a sync
// from upstream can silently reintroduce them. This test fails when it does.
const SRC = join(__dirname, '..', '..')

const TABLES = [
  'projects', 'profiles', 'provider_keys', 'default_models', 'project_collaborators',
  'project_backends', 'templates', 'blog_posts', 'notifications', 'app_config',
  'community_posts', 'community_likes',
]
const RPCS = ['admin_list_users', 'delete_user', 'find_account_by_email']

const BARE_NAME = new RegExp(
  [
    `\\.from\\(\\s*['"\`](?:${TABLES.join('|')})['"\`]\\s*\\)`,
    `\\.rpc\\(\\s*['"\`](?:${RPCS.join('|')})['"\`]`,
    `table:\\s*['"\`](?:${TABLES.join('|')})['"\`]`,
    `storage\\s*\\.from\\(\\s*['"\`]deployments['"\`]`,
  ].join('|'),
  'g',
)

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sourceFiles(full)
    return /\.(ts|tsx)$/.test(name) && name !== 'tables.ts' ? [full] : []
  })
}

describe('builder database names', () => {
  it('scans the source tree', () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(50)
  })

  it('never uses a bare table, rpc or bucket name (use lib/tables.ts)', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8')
      for (const match of text.matchAll(BARE_NAME)) {
        const line = text.slice(0, match.index).split('\n').length
        offenders.push(`${relative(SRC, file)}:${line}  ${match[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('the guard itself catches the known bad forms', () => {
    for (const bad of [
      "supabase.from('projects')",
      'supabase.from("profiles")',
      'supabase.from(\n  `templates`\n)',
      "supabase.rpc('delete_user')",
      "table: 'provider_keys'",
      "supabase.storage.from('deployments')",
    ]) {
      expect(bad.match(BARE_NAME), bad).not.toBeNull()
    }
    for (const good of ["supabase.from(T.projects)", "supabase.rpc(RPC.delete_user)", "supabase.from('wb_projects')"]) {
      expect(good.match(BARE_NAME), good).toBeNull()
    }
  })
})
