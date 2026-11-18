import { describe, it, expect } from 'vitest'
import { describeUsage } from '../imageUsage'
import { isSafeSvg, svgTextFromDataUrl } from '../../../lib/svgSafety'
import { parseImageOptions } from '../../../lib/openaiImageOptions'

describe('usage summary', () => {
  it('estimates the output cost only for Images 2.6', () => {
    const u = describeUsage({ output_tokens: 1000, input_tokens: 200 }, 'gpt-image-2.6-flare')!
    expect(u.estimatedOutputUsd).toBeCloseTo(0.03)
    expect(u.text).toContain('1,000 output tokens')
    expect(u.text).toContain('$0.03')
    expect(describeUsage({ output_tokens: 1000 }, 'gpt-image-2')!.estimatedOutputUsd).toBeUndefined()
  })
  it('returns null without usage', () => {
    expect(describeUsage(undefined)).toBeNull()
    expect(describeUsage({})).toBeNull()
  })
})

describe('SVG safety', () => {
  const ok = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"/></defs><rect fill="url(#g)" width="10" height="10"/></svg>'
  it('accepts plain vector art with internal references', () => {
    expect(isSafeSvg(ok)).toBe(true)
  })
  it.each([
    ['script', '<svg xmlns="x"><script>1</script></svg>'],
    ['event handler', '<svg xmlns="x"><rect onclick="a()"/></svg>'],
    ['foreignObject', '<svg xmlns="x"><foreignObject/></svg>'],
    ['embedded image', '<svg xmlns="x"><image href="data:image/png;base64,AA"/></svg>'],
    ['external link', '<svg xmlns="x"><use href="https://evil.example/a.svg#x"/></svg>'],
    ['external url()', '<svg xmlns="x"><rect fill="url(https://evil.example/a)"/></svg>'],
    ['javascript url', '<svg xmlns="x"><a xlink:href="javascript:alert(1)"/></svg>'],
    ['not svg', '<html></html>'],
  ])('refuses %s', (_name, svg) => {
    expect(isSafeSvg(svg)).toBe(false)
  })
  it('decodes a data URL', () => {
    expect(svgTextFromDataUrl(`data:image/svg+xml;base64,${btoa(ok)}`)).toBe(ok)
    expect(svgTextFromDataUrl('data:image/png;base64,AA')).toBeNull()
  })
})

describe('SVG and GIF options', () => {
  it('accepts svg and gif and rounds GIF timing', () => {
    expect(parseImageOptions({ output_format: 'svg' }).options.outputFormat).toBe('svg')
    const g = parseImageOptions({ output_format: 'gif', frame_count: 5, frame_duration_ms: 205, size: '512x512' })
    expect(g.error).toBeUndefined()
    expect(g.options).toMatchObject({ outputFormat: 'gif', frameCount: 5, frameDurationMs: 210, size: '512x512' })
  })
  it('rejects bad GIF settings and compression on svg/gif', () => {
    expect(parseImageOptions({ output_format: 'gif', frame_count: 17 }).error).toBeTruthy()
    expect(parseImageOptions({ output_format: 'gif', frame_duration_ms: 10 }).error).toBeTruthy()
    expect(parseImageOptions({ output_format: 'png', frame_count: 4 }).error).toBeTruthy()
    expect(parseImageOptions({ output_format: 'svg', output_compression: 50 }).error).toBeTruthy()
    expect(parseImageOptions({ output_format: 'gif', size: '500x500' }).error).toBeTruthy()
  })
})
