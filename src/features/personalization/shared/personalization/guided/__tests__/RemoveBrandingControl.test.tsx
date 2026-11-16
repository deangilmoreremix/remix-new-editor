// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { createRoot } from 'react-dom/client'
import { RemoveBrandingControl } from '../RemoveBrandingControl'
import type { RemovalDeps } from '../brandingRemoval'

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })
const mounted: { root: ReturnType<typeof createRoot>; el: HTMLElement }[] = []
afterEach(() => { for (const { root, el } of mounted.splice(0)) { act(() => root.unmount()); el.remove() } })

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
const click = (n: Element | null) => act(() => { (n as HTMLElement).click() })

function mount(props: Partial<React.ComponentProps<typeof RemoveBrandingControl>> = {}, over: Partial<RemovalDeps> = {}) {
  const deps: RemovalDeps = {
    processV2V: vi.fn(async () => ({ url: 'https://cdn.test/clean.mp4' })),
    estimateV2VCost: vi.fn(async () => ({ cost: 0.25, currency: 'USD' })),
    getUserBalance: vi.fn(async () => ({ balance: 12 })),
    ...over,
  }
  const onApply = vi.fn()
  const onRestore = vi.fn()
  const el = document.createElement('div'); document.body.appendChild(el)
  const root = createRoot(el); mounted.push({ root, el })
  act(() => {
    root.render(<RemoveBrandingControl apiKey="k" videoUrl="https://v/a.mp4" canRestore={false} onApply={onApply} onRestore={onRestore} deps={deps} {...props} />)
  })
  return { el, deps, onApply, onRestore }
}

describe('RemoveBrandingControl', () => {
  it('opens a confirmation that states the cost, the balance and that the original is kept, without running anything', async () => {
    const { el, deps } = mount()
    click(q(el, 'remove-branding-open')); await flush()
    const dialog = q(el, 'remove-branding-confirm')!
    expect(dialog).toBeTruthy()
    expect(dialog.textContent).toContain('This is not free')
    expect(q(el, 'remove-branding-cost')!.textContent).toContain('about 0.25 USD')
    expect(q(el, 'remove-branding-cost')!.textContent).toContain('12')
    expect(dialog.textContent).toContain('original video is kept')
    expect(deps.processV2V).not.toHaveBeenCalled()
  })

  it('needs the rights checkbox before the job can start', async () => {
    const { el, deps } = mount()
    click(q(el, 'remove-branding-open')); await flush()
    const go = q(el, 'remove-branding-confirm-button') as HTMLButtonElement
    expect(go.disabled).toBe(true)
    click(go)
    expect(deps.processV2V).not.toHaveBeenCalled()
    click(q(el, 'remove-branding-rights'))
    expect(go.disabled).toBe(false)
  })

  it('runs the job on confirm and hands the cleaned video to onApply', async () => {
    const { el, deps, onApply } = mount()
    click(q(el, 'remove-branding-open')); await flush()
    click(q(el, 'remove-branding-rights'))
    click(q(el, 'remove-branding-confirm-button')); await flush(); await flush()
    expect(deps.processV2V).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledWith('https://cdn.test/clean.mp4')
    expect(q(el, 'remove-branding-done')).toBeTruthy()
  })

  it('cancel closes the confirmation and starts nothing', async () => {
    const { el, deps } = mount()
    click(q(el, 'remove-branding-open')); await flush()
    click(q(el, 'remove-branding-cancel'))
    expect(q(el, 'remove-branding-confirm')).toBeNull()
    expect(deps.processV2V).not.toHaveBeenCalled()
  })

  it('an empty balance blocks the job and says why', async () => {
    const { el, deps } = mount({}, { getUserBalance: vi.fn(async () => ({ balance: 0 })) })
    click(q(el, 'remove-branding-open')); await flush()
    click(q(el, 'remove-branding-rights'))
    expect((q(el, 'remove-branding-confirm-button') as HTMLButtonElement).disabled).toBe(true)
    expect(q(el, 'remove-branding-afford')!.textContent).toContain('balance is empty')
    expect(deps.processV2V).not.toHaveBeenCalled()
  })

  it('shows a failure plainly and applies nothing', async () => {
    const { el, onApply } = mount({}, { processV2V: vi.fn(async () => { throw new Error('402 payment required') }) })
    click(q(el, 'remove-branding-open')); await flush()
    click(q(el, 'remove-branding-rights'))
    click(q(el, 'remove-branding-confirm-button')); await flush(); await flush()
    expect(q(el, 'remove-branding-error')!.textContent).toContain('402')
    expect(onApply).not.toHaveBeenCalled()
  })

  it('is disabled with no video or while the clip rights are unconfirmed', () => {
    const none = mount({ videoUrl: null })
    expect((q(none.el, 'remove-branding-open') as HTMLButtonElement).disabled).toBe(true)
    const blocked = mount({ blocked: true })
    expect((q(blocked.el, 'remove-branding-open') as HTMLButtonElement).disabled).toBe(true)
  })

  it('offers the original video back when a cleaned one is showing', () => {
    const { el, onRestore } = mount({ canRestore: true })
    click(q(el, 'remove-branding-restore'))
    expect(onRestore).toHaveBeenCalledTimes(1)
    expect(q(mount({ canRestore: false }).el, 'remove-branding-restore')).toBeNull()
  })
})
