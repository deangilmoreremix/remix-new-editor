'use client'

import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { FullBodyRecastSection } from '../advanced/FullBodyRecastPanel'
import { C, badgeStyle, hintStyle, panelStyle } from './tokens'

/**
 * Optional Full Body Recast inside Simple Mode, right after a video is chosen. It is the SAME recast
 * pipeline and state the Advanced Editing tab uses (`FullBodyRecastSection` + the provider's recast job),
 * so likeness consent, the credit notice, cancel/retry, "Use original video" and a completed result are shared
 * across both presentations. Skipping it is the default: the original video stays selected and everything
 * after (template, overlays, preview, browser render) is free.
 */
export function RecastOption(): React.JSX.Element | null {
  const { source, previewVideo, recastJob } = useDemoPersonalize()
  if (!source) return null
  const usingRecast = previewVideo?.kind === 'recast'
  const running = recastJob?.status === 'running'
  return (
    <div data-testid="guided-recast-option" style={{ ...panelStyle }}>
      <details open={usingRecast || running || undefined}>
        <summary style={{ cursor: 'pointer', color: C.text, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Replace the person in this video <span style={{ color: C.muted2, fontWeight: 600, textTransform: 'none' }}>(optional)</span>
        </summary>
        <p data-testid="guided-recast-credit-note" style={{ ...hintStyle, margin: '8px 0 0' }}>
          This is an AI step: it uses credits, needs a photo of the person, and needs permission to use their likeness.
          You can skip it — your original video is kept and the rest of the flow is free.
        </p>
        <FullBodyRecastSection source={source} />
      </details>
      <div data-testid="guided-recast-status" style={{ marginTop: 8 }}>
        {usingRecast ? (
          <span style={badgeStyle('green')}>Using the recast video</span>
        ) : running ? (
          <span style={badgeStyle()}>Recast in progress — you can keep editing</span>
        ) : (
          <span style={badgeStyle()}>Keeping your original video</span>
        )}
      </div>
    </div>
  )
}
