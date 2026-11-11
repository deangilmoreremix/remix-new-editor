'use client'

import { useDemoPersonalize } from './DemoPersonalizeProvider'
import { C, primaryButtonStyle, secondaryButtonStyle, softPanelStyle } from './guided/tokens'

/**
 * The personalizer opens with an empty form. When the user has a saved project
 * for this source, this offers it back instead of loading it unasked.
 */
export function ResumeProjectBanner() {
  const { resumableProject, resumeLastProject, dismissResumableProject, restoring } = useDemoPersonalize()
  if (!resumableProject) return null

  return (
    <div
      role="status"
      style={{ ...softPanelStyle, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}
    >
      <span style={{ flex: '1 1 200px', fontSize: 12, color: C.text }}>
        Starting fresh. Want to pick up where you left off with <strong>{resumableProject.label}</strong>?
      </span>
      <button type="button" style={primaryButtonStyle} disabled={restoring} onClick={() => { void resumeLastProject() }}>
        Continue with {resumableProject.label}
      </button>
      <button type="button" style={secondaryButtonStyle} onClick={dismissResumableProject}>
        Start new
      </button>
    </div>
  )
}
