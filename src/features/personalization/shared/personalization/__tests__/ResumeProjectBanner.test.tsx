// @vitest-environment jsdom
/**
 * The personalizer opens with an empty form; the banner offers the last saved
 * project back instead of loading it unasked.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const ctx: Record<string, unknown> = {}
vi.mock('../DemoPersonalizeProvider', () => ({ useDemoPersonalize: () => ctx }))

import { ResumeProjectBanner } from '../ResumeProjectBanner'

let root: Root | null = null
let container: HTMLDivElement | null = null

async function render(overrides: Record<string, unknown>) {
  Object.assign(ctx, { resumableProject: null, resumeLastProject: vi.fn(async () => {}), dismissResumableProject: vi.fn(), restoring: false, ...overrides })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root!.render(<ResumeProjectBanner />))
  return container
}

const button = (view: HTMLElement, text: string) =>
  Array.from(view.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) as HTMLButtonElement

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('ResumeProjectBanner', () => {
  it('renders nothing when there is no saved project', async () => {
    const view = await render({})
    expect(view.textContent).toBe('')
  })

  it('offers the saved business and continues with it', async () => {
    const view = await render({ resumableProject: { label: 'Kreindler & Kreindler' } })

    expect(view.textContent).toContain('Starting fresh')
    await act(async () => button(view, 'Continue with Kreindler & Kreindler').click())

    expect(ctx.resumeLastProject).toHaveBeenCalledTimes(1)
  })

  it('"Start new" dismisses the offer without loading anything', async () => {
    const view = await render({ resumableProject: { label: 'Kreindler & Kreindler' } })

    await act(async () => button(view, 'Start new').click())

    expect(ctx.dismissResumableProject).toHaveBeenCalledTimes(1)
    expect(ctx.resumeLastProject).not.toHaveBeenCalled()
  })
})
