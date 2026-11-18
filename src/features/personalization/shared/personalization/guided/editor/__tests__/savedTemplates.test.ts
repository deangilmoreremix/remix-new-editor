import { describe, it, expect } from 'vitest'
import {
  MAX_SAVED_TEMPLATES, SAVED_TEMPLATES_KEY, captureTemplate, deleteTemplate, loadTemplates, normalizeTemplateName, planTemplateApplication, saveTemplate,
  type TemplateStorage,
} from '../savedTemplates'
import { createDefaultPreviewSettings, createLayer } from '../../../preview/presets'

const memory = (): TemplateStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v) } }
}
const settings = () => {
  const s = createDefaultPreviewSettings()
  s.layers = [
    createLayer('headline', { text: 'Secret client words', x: 0.1, y: 0.2, scale: 0.6, color: '#ff0000' }),
    createLayer('logo', { imageUrl: 'https://client.example/logo.png' }),
    createLayer('design', { id: 'design-1', designId: 'x' }),
  ]
  return s
}

describe('captureTemplate', () => {
  it('keeps the look but never the words, pictures or design layers', () => {
    const t = captureTemplate(settings(), '  My   look ')
    expect(t.name).toBe('My look')
    expect(JSON.stringify(t)).not.toContain('Secret client words')
    expect(JSON.stringify(t)).not.toContain('client.example')
    expect(t.layers.map((l) => l.kind)).toEqual(['headline', 'logo'])
    expect(t.layers[0]).toMatchObject({ id: 'headline', x: 0.1, y: 0.2, scale: 0.6, color: '#ff0000' })
  })
})

describe('storage', () => {
  it('round-trips and puts the newest first', () => {
    const st = memory()
    saveTemplate(captureTemplate(settings(), 'A'), st)
    saveTemplate(captureTemplate(settings(), 'B'), st)
    expect(loadTemplates(st).map((t) => t.name)).toEqual(['B', 'A'])
  })
  it('replaces a template with the same name (case-insensitive) instead of duplicating it', () => {
    const st = memory()
    saveTemplate(captureTemplate(settings(), 'Look'), st)
    saveTemplate(captureTemplate(settings(), 'look'), st)
    expect(loadTemplates(st)).toHaveLength(1)
  })
  it('caps the list and drops the oldest', () => {
    const st = memory()
    for (let i = 0; i < MAX_SAVED_TEMPLATES + 3; i++) saveTemplate(captureTemplate(settings(), `T${i}`), st)
    const names = loadTemplates(st).map((t) => t.name)
    expect(names).toHaveLength(MAX_SAVED_TEMPLATES)
    expect(names[0]).toBe(`T${MAX_SAVED_TEMPLATES + 2}`)
    expect(names).not.toContain('T0')
  })
  it('refuses an empty name', () => {
    expect(saveTemplate(captureTemplate(settings(), '   ', new Date(), 'x'), memory())).toBeDefined()
    expect(saveTemplate({ ...captureTemplate(settings(), 'ok'), name: '   ' }, memory())).toEqual({ ok: false, reason: 'name-empty' })
  })
  it('survives corrupt data, missing storage and a storage that throws', () => {
    const st = memory(); st.data.set(SAVED_TEMPLATES_KEY, '{not json')
    expect(loadTemplates(st)).toEqual([])
    st.data.set(SAVED_TEMPLATES_KEY, JSON.stringify([{ id: 1 }, null, 'x']))
    expect(loadTemplates(st)).toEqual([])
    expect(loadTemplates(null)).toEqual([])
    expect(saveTemplate(captureTemplate(settings(), 'A'), null)).toEqual({ ok: false, reason: 'unavailable' })
    const full: TemplateStorage = { getItem: () => null, setItem: () => { throw new Error('quota') } }
    expect(saveTemplate(captureTemplate(settings(), 'A'), full)).toEqual({ ok: false, reason: 'unavailable' })
  })
  it('deletes by id', () => {
    const st = memory()
    const r = saveTemplate(captureTemplate(settings(), 'A'), st)
    expect(r.ok && deleteTemplate(r.templates[0].id, st)).toEqual({ ok: true, templates: [] })
  })
  it('keeps the template and says so when the deletion cannot be saved', () => {
    const st = memory()
    const r = saveTemplate(captureTemplate(settings(), 'A'), st)
    if (!r.ok) throw new Error('setup')
    const blocked: TemplateStorage = { getItem: (k) => st.getItem(k), setItem: () => { throw new Error('quota') } }
    const out = deleteTemplate(r.templates[0].id, blocked)
    expect(out.ok).toBe(false)
    expect(out.templates).toHaveLength(1)
  })
  it('drops stored entries without a creation date and malformed layer entries', () => {
    const st = memory()
    const good = captureTemplate(settings(), 'Good')
    st.data.set(SAVED_TEMPLATES_KEY, JSON.stringify([
      { ...good, createdAt: undefined, id: 'nodate' },
      { ...good, layers: [...good.layers, null, { id: 5 }, 'x'] },
    ]))
    const loaded = loadTemplates(st)
    expect(loaded).toHaveLength(1)
    expect(loaded[0].layers).toHaveLength(good.layers.length)
  })
  it('normalises names', () => { expect(normalizeTemplateName('x'.repeat(100))).toHaveLength(40) })
})

describe('planTemplateApplication', () => {
  it('patches matching layers, marks them manual, and leaves text and pictures alone', () => {
    const t = captureTemplate(settings(), 'A')
    const target = createDefaultPreviewSettings()
    target.layers = [createLayer('headline', { text: 'New client', x: 0.5 }), createLayer('logo', { imageUrl: 'https://other/logo.png' })]
    const plan = planTemplateApplication(t, target)
    const headline = plan.layerPatches.find((p) => p.layerId === 'headline')!
    expect(headline.patch).toMatchObject({ x: 0.1, y: 0.2, scale: 0.6, color: '#ff0000', placementSource: 'manual' })
    expect(headline.patch).not.toHaveProperty('text')
    expect(plan.layerPatches.find((p) => p.layerId === 'logo')!.patch).not.toHaveProperty('imageUrl')
  })
  it('resets colour, rotation, end time, font and image style the saved look does not set', () => {
    const plain = settings(); plain.layers = [createLayer('headline', { text: 'x', x: 0.1 })]
    const t = captureTemplate(plain, 'Plain')
    const target = createDefaultPreviewSettings()
    target.layers = [createLayer('headline', { color: '#ff0000', rotation: 20, endFrame: 40, fontFamily: 'Georgia' })]
    const patch = planTemplateApplication(t, target).layerPatches[0].patch
    for (const f of ['color', 'rotation', 'endFrame', 'fontFamily', 'imageStyle']) {
      expect(patch, f).toHaveProperty(f, undefined)
    }
    expect(patch.x).toBe(0.1)
  })
  it('skips layers the project lacks and never touches locked layers', () => {
    const t = captureTemplate(settings(), 'A')
    const target = createDefaultPreviewSettings()
    target.layers = [createLayer('headline', { locked: true })]
    const plan = planTemplateApplication(t, target)
    expect(plan.layerPatches).toEqual([])
    expect(plan.skipped).toBe(1)
  })
})
