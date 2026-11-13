/**
 * Phase 32b - AI Assist Source-Level Provider Guard
 *
 * Automated guard ensuring the AI Assist modal (AiAssistantModal.tsx)
 * does not import from MuAPI for image operations.
 *
 * Authoritative routing:
 *   AI Assist image tools → OpenAI (editImage from /api/proxy/openai-image)
 *   NOT → MuAPI (enhanceImage from /lib/muapi)
 *
 * This test prevents accidental re-introduction of MuAPI image routing
 * in the AI Assist modal.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const AI_ASSIST_MODAL_PATH = join(
  process.cwd(),
  'components/AiAssistantModal.tsx'
)

// Patterns that indicate MuAPI usage (forbidden in AI Assist modal)
const FORBIDDEN_MUAPI_IMPORT_PATTERNS = [
  /from\s+['"]@\/lib\/muapi['"]/,
  /from\s+['"]\.\.?\/lib\/muapi['"]/,
  /from\s+['"]@\/packages\/studio\/src\/muapi['"]/,
  /from\s+['"]studio\/src\/muapi['"]/,
]

// Forbidden function names that indicate MuAPI image routing
const FORBIDDEN_IMAGE_FUNCTIONS = [
  'enhanceImage',
  'generateImage',
  'generateI2I',
  'buildImagePayload',
  'pollSocialResult',
]

describe('Phase 32b - AI Assist Source-Level Provider Guard', () => {
  it('AiAssistantModal.tsx does not import from MuAPI for image operations', () => {
    const content = readFileSync(AI_ASSIST_MODAL_PATH, 'utf-8')
    const lines = content.split('\n')
    const violations: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const importsMuapi = FORBIDDEN_MUAPI_IMPORT_PATTERNS.some((p) => p.test(line))
      if (!importsMuapi) continue

      const hasForbiddenImageFn = FORBIDDEN_IMAGE_FUNCTIONS.some((fn) => {
        const regex = new RegExp(`\\b${fn}\\b`)
        return regex.test(line)
      })

      if (hasForbiddenImageFn) {
        violations.push(`Line ${i + 1}: ${line.trim()}`)
      }
    }

    expect(
      violations,
      `AiAssistantModal.tsx must not import MuAPI image functions. Found:\n${violations.join('\n')}`
    ).toEqual([])
  })

  it('AiAssistantModal.tsx imports editImage from OpenAI image client, not enhanceImage from MuAPI', () => {
    const content = readFileSync(AI_ASSIST_MODAL_PATH, 'utf-8')

    // MUST import editImage from openaiImage (OpenAI routing)
    expect(content).toContain("import { editImage } from '@ohb/shared/api/openaiImage'")

    // MUST NOT import enhanceImage from MuAPI
    expect(content).not.toContain('enhanceImage')
    expect(content).not.toContain('from \'@/lib/muapi\'')
    expect(content).not.toContain('from "../lib/muapi"')
    expect(content).not.toContain('from \'@/packages/studio/src/muapi\'')
    expect(content).not.toContain('from \'studio/src/muapi\'')
  })

  it('AiAssistantModal.tsx handleGenerate uses editImage for image mode, not enhanceImage', () => {
    const content = readFileSync(AI_ASSIST_MODAL_PATH, 'utf-8')

    // The handleGenerate function must use editImage for image mode
    const hasEditImageCall = content.includes('await editImage(') ||
      content.includes('editImage({')
    expect(hasEditImageCall).toBe(true)

    // The handleGenerate function must NOT call enhanceImage
    const hasEnhanceImageCall = content.includes('await enhanceImage(') ||
      content.includes('enhanceImage(')
    expect(hasEnhanceImageCall).toBe(false)
  })
})

/* ------------------------------------------------------------------ *
 * Per-tool provider routing — AI Assist image utilities
 *
 * Each image tool must resolve to editImage() from @/shared/api/openaiImage.
 * No tool may silently fall back to MuAPI (enhanceImage, generateImage, etc.).
 * ------------------------------------------------------------------ */

describe('Per-tool provider routing — AI Assist image utilities', () => {
  it('upscale routes to editImage() from @/shared/api/openaiImage — not MuAPI', () => {
    const content = readFileSync(AI_ASSIST_MODAL_PATH, 'utf-8')

    // 1. Tool is registered in IMAGE_TOOLS
    expect(content).toContain("id: 'upscale'")
    expect(content).toContain("label: 'Upscale'")

    // 2. Tool has a unique prompt in handleGenerate that resolves to editImage
    expect(content).toContain('Upscale this image')
    expect(content).toContain('await editImage({ prompt, image: input })')

    // 3. editImage is imported from @/shared/api/openaiImage
    expect(content).toContain("import { editImage } from '@ohb/shared/api/openaiImage'")

    // 4. No MuAPI imports or calls
    expect(content).not.toContain('from \'@/lib/muapi\'')
    expect(content).not.toContain('from "../lib/muapi"')
    expect(content).not.toContain('enhanceImage')
    expect(content).not.toContain('generateImage')
    expect(content).not.toContain('generateI2I')
    expect(content).not.toContain('buildImagePayload')
    expect(content).not.toContain('pollSocialResult')
  })

  it('background-remove routes to editImage() from @/shared/api/openaiImage — not MuAPI', () => {
    const content = readFileSync(AI_ASSIST_MODAL_PATH, 'utf-8')

    // 1. Tool is registered in IMAGE_TOOLS
    expect(content).toContain("id: 'background-remove'")
    expect(content).toContain("label: 'Background remove'")

    // 2. Tool has a unique prompt in handleGenerate that resolves to editImage
    expect(content).toContain('Remove the background from this image')
    expect(content).toContain('await editImage({ prompt, image: input })')

    // 3. editImage is imported from @/shared/api/openaiImage
    expect(content).toContain("import { editImage } from '@ohb/shared/api/openaiImage'")

    // 4. No MuAPI imports or calls
    expect(content).not.toContain('from \'@/lib/muapi\'')
    expect(content).not.toContain('from "../lib/muapi"')
    expect(content).not.toContain('enhanceImage')
    expect(content).not.toContain('generateImage')
    expect(content).not.toContain('generateI2I')
    expect(content).not.toContain('buildImagePayload')
    expect(content).not.toContain('pollSocialResult')
  })

  it('style-transfer routes to editImage() from @/shared/api/openaiImage — not MuAPI', () => {
    const content = readFileSync(AI_ASSIST_MODAL_PATH, 'utf-8')

    // 1. Tool is registered in IMAGE_TOOLS
    expect(content).toContain("id: 'style-transfer'")
    expect(content).toContain("label: 'Style transfer'")

    // 2. Tool has a unique prompt in handleGenerate that resolves to editImage
    expect(content).toContain('Transform this image into a')
    expect(content).toContain('await editImage({ prompt, image: input })')

    // 3. editImage is imported from @/shared/api/openaiImage
    expect(content).toContain("import { editImage } from '@ohb/shared/api/openaiImage'")

    // 4. No MuAPI imports or calls
    expect(content).not.toContain('from \'@/lib/muapi\'')
    expect(content).not.toContain('from "../lib/muapi"')
    expect(content).not.toContain('enhanceImage')
    expect(content).not.toContain('generateImage')
    expect(content).not.toContain('generateI2I')
    expect(content).not.toContain('buildImagePayload')
    expect(content).not.toContain('pollSocialResult')
  })

  it('restore routes to editImage() from @/shared/api/openaiImage — not MuAPI', () => {
    const content = readFileSync(AI_ASSIST_MODAL_PATH, 'utf-8')

    // 1. Tool is registered in IMAGE_TOOLS
    expect(content).toContain("id: 'restore'")
    expect(content).toContain("label: 'Restore'")

    // 2. Tool has a unique prompt in handleGenerate that resolves to editImage
    expect(content).toContain('Restore this image by repairing damage')
    expect(content).toContain('await editImage({ prompt, image: input })')

    // 3. editImage is imported from @/shared/api/openaiImage
    expect(content).toContain("import { editImage } from '@ohb/shared/api/openaiImage'")

    // 4. No MuAPI imports or calls
    expect(content).not.toContain('from \'@/lib/muapi\'')
    expect(content).not.toContain('from "../lib/muapi"')
    expect(content).not.toContain('enhanceImage')
    expect(content).not.toContain('generateImage')
    expect(content).not.toContain('generateI2I')
    expect(content).not.toContain('buildImagePayload')
    expect(content).not.toContain('pollSocialResult')
  })
})
