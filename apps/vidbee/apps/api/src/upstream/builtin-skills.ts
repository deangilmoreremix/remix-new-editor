import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'

/**
 * [host adaptation] Upstream (apps/desktop/src/shared/builtin-skills.ts) loads these with Vite's
 * `import.meta.glob('../../../../skills/*\/SKILL.md')`, which only exists in the desktop renderer build.
 * The API reads the same SKILL.md files from disk; the parsing below is upstream's, unchanged.
 */
const skillsDir = path.resolve(process.env.VIDBEE_SKILLS_DIR || 'skills')

/** Repository skill files are the only authored source for built-in names, descriptions and instructions. */
export const BUILTIN_SKILLS = readdirSync(skillsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .map((name) => readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf8'))
  .map((document) => {
    const match = document.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
    if (!match?.[1]) {
      throw new Error('Built-in SKILL.md requires YAML frontmatter')
    }
    const metadata = parse(match[1]) as { name: string; description: string }
    return {
      name: metadata.name,
      description: metadata.description,
      content: document.slice(match[0].length).trim(),
      document
    }
  })
