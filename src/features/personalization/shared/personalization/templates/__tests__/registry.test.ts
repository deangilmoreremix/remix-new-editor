import { describe, it, expect, beforeEach } from 'vitest'
import {
  __resetRemotionDesignRegistry,
  getRemotionDesignTemplate,
  isRemotionDesignTemplateSupported,
  listRemotionDesignTemplates,
  listRemotionDesignTemplatesByCategory,
  registerRemotionDesignTemplate,
  registerRemotionDesignTemplates,
  subscribeRemotionDesignRegistry,
} from '../registry'
import type { RemotionDesignComponent, RemotionDesignTemplate } from '../types'

const Design: RemotionDesignComponent = () => null

function makeTemplate(overrides: Partial<RemotionDesignTemplate> = {}): RemotionDesignTemplate {
  return {
    id: 'demo-design',
    name: 'Demo design',
    description: 'A design used by the registry tests.',
    category: 'animated-headline',
    source: {
      repository: 'example/repo',
      repositoryUrl: 'https://example.com/example/repo',
      sourcePath: 'src/Design.tsx',
      license: 'MIT',
      attribution: 'Example attribution',
    },
    component: Design,
    defaultProps: {},
    textSlots: [
      { key: 'headline', field: 'headline', label: 'Headline', primary: true },
    ],
    colors: [{ role: 'primary', label: 'Primary' }],
    media: [{ role: 'logo', label: 'Logo', required: false }],
    animation: { durationInFrames: 30, delayInFrames: 0, easing: 'ease-out cubic' },
    placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1 },
    aspectRatios: ['16:9', '1:1'],
    requiredMedia: [],
    capabilities: { preview: true, browserExport: true },
    previewCompatible: true,
    ...overrides,
  }
}

describe('Remotion design registry', () => {
  beforeEach(() => {
    __resetRemotionDesignRegistry()
  })

  it('registers a template and finds it by id', () => {
    const template = makeTemplate()
    registerRemotionDesignTemplate(template)

    expect(getRemotionDesignTemplate('demo-design')).toBe(template)
    expect(getRemotionDesignTemplate('nope')).toBeUndefined()
    expect(listRemotionDesignTemplates()).toHaveLength(1)
  })

  it('registers a list of templates and keeps a stable order', () => {
    const first = makeTemplate({ id: 'a-design', name: 'A' })
    const second = makeTemplate({ id: 'b-design', name: 'B' })
    registerRemotionDesignTemplates([first, second])

    expect(listRemotionDesignTemplates().map((template) => template.id)).toEqual([
      'a-design',
      'b-design',
    ])
  })

  it('rejects a duplicate id instead of overwriting the first template', () => {
    registerRemotionDesignTemplate(makeTemplate({ name: 'First' }))
    expect(() => registerRemotionDesignTemplate(makeTemplate({ name: 'Second' }))).toThrow(
      /duplicate design template id "demo-design"/,
    )
    expect(getRemotionDesignTemplate('demo-design')?.name).toBe('First')
    expect(listRemotionDesignTemplates()).toHaveLength(1)
  })

  it('rejects a list with a duplicate id without registering anything', () => {
    expect(() =>
      registerRemotionDesignTemplates([
        makeTemplate({ id: 'a-design' }),
        makeTemplate({ id: 'a-design' }),
      ]),
    ).toThrow(/duplicate design template id "a-design"/)
    expect(listRemotionDesignTemplates()).toHaveLength(0)
  })

  it('rejects a template without an id', () => {
    expect(() => registerRemotionDesignTemplate(makeTemplate({ id: '  ' }))).toThrow(
      /non-empty id/,
    )
  })

  it('lists the templates of one category', () => {
    registerRemotionDesignTemplates([
      makeTemplate({ id: 'headline-design', category: 'animated-headline' }),
      makeTemplate({ id: 'logo-design', category: 'logo-reveal' }),
      makeTemplate({ id: 'other-design', category: 'animated-headline' }),
    ])

    expect(listRemotionDesignTemplatesByCategory('animated-headline').map((t) => t.id)).toEqual([
      'headline-design',
      'other-design',
    ])
    expect(listRemotionDesignTemplatesByCategory('lower-third')).toEqual([])
  })

  it('reports an unknown design as unsupported', () => {
    const result = isRemotionDesignTemplateSupported('missing', '16:9')
    expect(result.supported).toBe(false)
    expect(result.reason).toContain('missing')
  })

  it('checks the aspect ratio a design supports', () => {
    registerRemotionDesignTemplate(makeTemplate({ aspectRatios: ['16:9', '1:1'] }))

    expect(isRemotionDesignTemplateSupported('demo-design', '16:9').supported).toBe(true)
    expect(isRemotionDesignTemplateSupported('demo-design', '1:1').supported).toBe(true)

    const unsupported = isRemotionDesignTemplateSupported('demo-design', '9:16')
    expect(unsupported.supported).toBe(false)
    expect(unsupported.reason).toContain('9:16')
  })

  it('checks the browser export capability of a design', () => {
    registerRemotionDesignTemplate(
      makeTemplate({
        capabilities: {
          preview: true,
          browserExport: false,
          notes: 'Needs a server-side renderer.',
        },
      }),
    )

    const result = isRemotionDesignTemplateSupported('demo-design', '16:9')
    expect(result.supported).toBe(false)
    expect(result.reason).toContain('Needs a server-side renderer.')
  })

  it('reports a design that cannot be previewed', () => {
    registerRemotionDesignTemplate(
      makeTemplate({
        previewCompatible: false,
        previewCompatibleReason: 'Uses a browser-only API.',
      }),
    )

    const result = isRemotionDesignTemplateSupported('demo-design', '16:9')
    expect(result.supported).toBe(false)
    expect(result.reason).toContain('browser-only API')
  })

  it('notifies subscribers when the registry changes', () => {
    let notifications = 0
    const unsubscribe = subscribeRemotionDesignRegistry(() => {
      notifications += 1
    })

    registerRemotionDesignTemplate(makeTemplate())
    expect(notifications).toBe(1)

    unsubscribe()
    registerRemotionDesignTemplate(makeTemplate({ id: 'second-design' }))
    expect(notifications).toBe(1)
  })

  it('empties the registry with the test-only reset helper', () => {
    registerRemotionDesignTemplates([makeTemplate(), makeTemplate({ id: 'second-design' })])
    expect(listRemotionDesignTemplates()).toHaveLength(2)

    __resetRemotionDesignRegistry()

    expect(listRemotionDesignTemplates()).toHaveLength(0)
    expect(getRemotionDesignTemplate('demo-design')).toBeUndefined()
  })
})
