/**
 * Personalization Import Guard
 *
 * Source-level guard that keeps the Personalization generation/editing paths
 * routed to OpenAI. Personalization image generation and editing must NOT pull
 * the MuAPI image helpers `generateImage` / `enhanceImage` from
 * `studio/src/muapi` or `@/lib/muapi`.
 *
 * Note: video routing legitimately imports from `@/packages/studio/src/muapi`
 * (see generationRouter.ts / postProcessor.ts), and the asset upload helper
 * dynamically imports `studio/src/muapi` for `uploadFile` only. Those are NOT
 * flagged because they never bind a forbidden image helper from a forbidden
 * module specifier. This guard matches the exact module specifier, so
 * `@/packages/studio/src/muapi` (which merely *contains* the substring
 * `studio/src/muapi`) is not a false positive.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join, relative } from 'path'

const PERSONALIZATION_DIR = join(process.cwd(), 'src/features/personalization/shared/personalization')

function collectSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // Never scan the test directory or test/spec files.
    if (entry.name === '__tests__') continue
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath))
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)
    ) {
      files.push(fullPath)
    }
  }
  return files
}

// Forbidden module specifiers that must not provide these image helpers.
const FORBIDDEN_GENERATE_IMAGE_MODULES = new Set(['@ohb/packages/studio/src/muapi', '@ohb/lib/muapi'])
const FORBIDDEN_ENHANCE_IMAGE_MODULES = new Set(['@ohb/lib/muapi'])

// Matches static import declarations (non-greedy, spans multi-line imports).
const STATIC_IMPORT_SOURCE = /import\s+[\s\S]*?from\s+(['"])([^'"]+)\1/.source

function findForbiddenImports(
  files: string[],
  fnName: string,
  forbiddenModules: Set<string>,
): string[] {
  const fnRegex = new RegExp(`\\b${fnName}\\b`)
  const violations: string[] = []

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    const importRe = new RegExp(STATIC_IMPORT_SOURCE, 'g')
    let match: RegExpExecArray | null
    while ((match = importRe.exec(content)) !== null) {
      const statement = match[0]
      const moduleSpecifier = match[2]
      if (!forbiddenModules.has(moduleSpecifier)) continue
      if (fnRegex.test(statement)) {
        const line = content.slice(0, match.index).split('\n').length
        violations.push(
          `${relative(process.cwd(), file)}:${line} imports "${fnName}" from "${moduleSpecifier}"`,
        )
      }
    }
  }

  return violations
}

describe('Personalization provider import guard', () => {
  const sourceFiles = collectSourceFiles(PERSONALIZATION_DIR)

  it('personalization files do not import MuAPI generateImage', () => {
    const violations = findForbiddenImports(
      sourceFiles,
      'generateImage',
      FORBIDDEN_GENERATE_IMAGE_MODULES,
    )
    expect(
      violations,
      `Personalization files must not import generateImage from '@ohb/packages/studio/src/muapi' or '@ohb/lib/muapi'. Found:\n${violations.join('\n')}`,
    ).toEqual([])
  })

  it('personalization files do not import MuAPI enhanceImage', () => {
    const violations = findForbiddenImports(
      sourceFiles,
      'enhanceImage',
      FORBIDDEN_ENHANCE_IMAGE_MODULES,
    )
    expect(
      violations,
      `Personalization files must not import enhanceImage from '@ohb/lib/muapi'. Found:\n${violations.join('\n')}`,
    ).toEqual([])
  })
})
