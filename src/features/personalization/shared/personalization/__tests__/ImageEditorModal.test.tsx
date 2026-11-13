// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import ImageEditorModal from '../image-editor/ImageEditorModal'

// jsdom cannot decode images; the PNG re-encode is covered in normalizeImage.test.ts.
vi.mock('../image-editor/normalizeImage', () => ({
  normalizeImageDataUrl: async (dataUrl: string) => dataUrl,
  ensureModelSupportedImage: async (dataUrl: string) => dataUrl,
}))

vi.mock('@ohb/shared/api/openaiImage', () => ({
  editImage: vi.fn(),
}))

vi.mock('../image-editor/responsesVisionApi', () => ({
  responsesSmartEditStream: vi.fn(async (_params: any, _onPartial: any) => ({
    imageDataUrl: 'data:image/png;base64,RklOQUw=',
    responseId: 'resp_1',
    imageGenerationCallId: 'ig_1',
    revisedPrompt: 'Revised',
    model: _params.imageModel,
    outputFormat: _params.outputFormat,
    outputCompression: _params.outputCompression ?? null,
  })),
}))

describe('ImageEditorModal', () => {
  afterEach(() => cleanup())

  it('renders the SmartVideo editor with contextual quick actions for a logo', () => {
    render(
      <ImageEditorModal
        open
        asset={{
          id: 'logo-1',
          name: 'Acme Logo',
          imageUrl: 'data:image/png;base64,AA==',
          originalImageUrl: 'data:image/png;base64,AA==',
          category: 'logo',
          source: 'discovered',
          businessName: 'Acme Roofing',
          industry: 'Roofing',
        }}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    )

    expect(screen.getByText('SmartVideo GO Image Editor')).toBeTruthy()
    expect(screen.getAllByText('Make Video Ready').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Transparent Logo').length).toBeGreaterThan(0)
    expect(screen.getByText('Ask SmartVideo GO AI')).toBeTruthy()
    expect(screen.getByText('Advanced Edit')).toBeTruthy()
    expect(screen.getByText('SmartVideo GO recommends')).toBeTruthy()
    expect(screen.getByText('Use Edited Asset')).toBeTruthy()
    // Plain quick actions and a reason while there is nothing to apply yet.
    expect(screen.getByText('Remove Background')).toBeTruthy()
    expect(screen.getByText('Crop / Rotate')).toBeTruthy()
    expect(screen.getByTestId('image-editor-apply-hint').textContent).toMatch(/Make an edit first/)
  })

  it('does not render while closed', () => {
    const { container } = render(
      <ImageEditorModal
        open={false}
        asset={null}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    )

    expect(container.innerHTML).toBe('')
  })

  it('Smart Edit uses the current outputFormat and outputCompression settings', async () => {
    const { responsesSmartEditStream } = await import('../image-editor/responsesVisionApi')
    const mockedStream = responsesSmartEditStream as unknown as ReturnType<typeof vi.fn>
    mockedStream.mockClear()

    render(
      <ImageEditorModal
        open
        asset={{
          id: 'logo-1',
          name: 'Acme Logo',
          imageUrl: 'data:image/png;base64,AA==',
          originalImageUrl: 'data:image/png;base64,AA==',
          category: 'logo',
          source: 'discovered',
          businessName: 'Acme Roofing',
          industry: 'Roofing',
        }}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    )

    const [textarea] = screen.getAllByPlaceholderText(/Remove the truck behind the contractor/)
    const [smartEditButton] = screen.getAllByText('Smart Edit')

    await act(async () => {
      textarea.textContent = 'Make it blue'
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await act(async () => {
      smartEditButton.click()
    })

    await waitFor(() => {
      expect(mockedStream).toHaveBeenCalledTimes(1)
    })

    const firstCall = mockedStream.mock.calls[0][0]
    expect(firstCall.outputFormat).toBe('png')
    expect(firstCall.outputCompression).toBeUndefined()
  })

  const logoAsset = {
    id: 'logo-1',
    name: 'Acme Logo',
    imageUrl: 'data:image/png;base64,AA==',
    originalImageUrl: 'data:image/png;base64,AA==',
    category: 'logo' as const,
    source: 'discovered' as const,
    businessName: 'Acme Roofing',
    industry: 'Roofing',
  }

  async function makeSmartEdit() {
    const [textarea] = screen.getAllByPlaceholderText(/Remove the truck behind the contractor/)
    await act(async () => {
      textarea.textContent = 'Make it blue'
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => { screen.getAllByText('Smart Edit')[0].click() })
    await waitFor(() => expect(screen.queryByTestId('image-editor-apply-hint')).toBeNull())
  }

  it('Use Edited Asset stays open when the edit check cannot run, then Use Anyway applies it', async () => {
    // The vision check is not mocked here, so it fails the way a missing key would.
    const onClose = vi.fn()
    const onApply = vi.fn()
    render(<ImageEditorModal open asset={logoAsset} onClose={onClose} onApply={onApply} />)
    await makeSmartEdit()

    await act(async () => { screen.getByText('Use Edited Asset').click() })
    await waitFor(() => expect(screen.getByText(/couldn't check this edit/i)).toBeTruthy())
    expect(onClose).not.toHaveBeenCalled()
    expect(onApply).not.toHaveBeenCalled()

    await act(async () => { screen.getByText('Use Anyway').click() })
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Analyze Image shows why it failed', async () => {
    render(<ImageEditorModal open asset={logoAsset} onClose={vi.fn()} onApply={vi.fn()} />)
    await act(async () => { screen.getByText('Analyze Image').click() })
    await waitFor(() => expect(document.body.textContent).toMatch(/analyzePersonalizationImages|analysis failed/i))
  })

  it('the Text Overlay panel has its own Apply button', async () => {
    render(<ImageEditorModal open asset={logoAsset} onClose={vi.fn()} onApply={vi.fn()} />)
    await act(async () => { screen.getByText('Advanced Edit').click() })
    const apply = screen.getByTestId('image-editor-apply-text') as HTMLButtonElement
    expect(apply.disabled).toBe(true)
    const input = screen.getByPlaceholderText('Optional overlay text') as HTMLInputElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, 'Grand opening')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(apply.disabled).toBe(false)
  })
})
