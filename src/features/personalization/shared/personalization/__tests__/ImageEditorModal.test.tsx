// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
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
})

