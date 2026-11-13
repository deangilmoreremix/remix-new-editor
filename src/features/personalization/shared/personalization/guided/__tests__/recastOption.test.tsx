// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

const ctx: Record<string, unknown> = {}
vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: () => ctx }))
vi.mock('../../advanced/FullBodyRecastPanel', () => ({ FullBodyRecastSection: () => <div data-testid="recast-section" /> }))
import { RecastOption } from '../RecastOption'

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })
afterEach(() => { document.body.innerHTML = ''; for (const k of Object.keys(ctx)) delete ctx[k] })

function mount() {
  const el = document.createElement('div'); document.body.appendChild(el)
  act(() => { createRoot(el).render(<RecastOption />) })
  return el
}
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null

describe('Simple Mode recast option', () => {
  it('renders nothing without a source', () => { expect(mount().querySelector('[data-testid="guided-recast-option"]')).toBeNull() })
  it('defaults to keeping the original video and says recast uses credits and needs permission', () => {
    ctx.source = { id: 's', mediaType: 'video' }
    const el = mount()
    expect(q(el, 'guided-recast-status')!.textContent).toMatch(/Keeping your original video/)
    expect(q(el, 'guided-recast-credit-note')!.textContent).toMatch(/credits/i)
    expect(q(el, 'guided-recast-credit-note')!.textContent).toMatch(/permission/i)
    expect(q(el, 'recast-section')).not.toBeNull() // the same pipeline as Advanced Editing
  })
  it('shows when a recast video is in use and while one is running', () => {
    ctx.source = { id: 's', mediaType: 'video' }
    ctx.previewVideo = { kind: 'recast', url: 'u' }
    expect(q(mount(), 'guided-recast-status')!.textContent).toMatch(/Using the recast video/)
    document.body.innerHTML = ''
    ctx.previewVideo = null; ctx.recastJob = { status: 'running' }
    expect(q(mount(), 'guided-recast-status')!.textContent).toMatch(/in progress/)
  })
})
