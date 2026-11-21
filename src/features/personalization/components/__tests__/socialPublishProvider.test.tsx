// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import React, { act, useContext } from 'react'
import { createRoot } from 'react-dom/client'
import { SocialPublishProvider, SocialPublishContext } from '../SocialPublishProvider'

beforeAll(() => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
})

// DemoPersonalizeProvider.publish() hands a finished video to this context exactly like the probe below.
function Probe() {
  const ctx = useContext(SocialPublishContext)
  return (
    <button
      onClick={() =>
        ctx?.openPublish({ mediaUrl: 'https://cdn.example.com/result.mp4', mediaType: 'video', title: 'Personalized content', caption: 'caption' })
      }
    >
      open
    </button>
  )
}

function mount(apiKey: string | null, onRequestApiKey = vi.fn()) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => {
    root.render(
      <SocialPublishProvider apiKey={apiKey} onRequestApiKey={onRequestApiKey}>
        <Probe />
      </SocialPublishProvider>,
    )
  })
  return { host, root, onRequestApiKey }
}

describe('SocialPublishProvider as wired into the personalization modal', () => {
  it('opens the multi-step publisher listing all eight networks for a finished video', () => {
    const { host } = mount('key')
    act(() => host.querySelector('button')!.click())
    const text = document.body.textContent || ''
    expect(text).toContain('Publish to social')
    for (const n of ['YouTube', 'Instagram', 'TikTok', 'Facebook', 'LinkedIn', 'Pinterest', 'Threads', 'X']) {
      expect(text).toContain(n)
    }
    for (const step of ['Write', 'Thumbnail', 'Destinations', 'Review & Publish']) expect(text).toContain(step)
    expect(text).toContain('https://cdn.example.com/result.mp4')
  })

  it('still opens without an API key (publishing itself is blocked later in Review)', () => {
    const { host } = mount(null)
    act(() => host.querySelector('button')!.click())
    expect(document.body.textContent).toContain('Publish to social')
  })
})
