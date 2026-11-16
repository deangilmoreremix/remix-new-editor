'use client'

import { useMemo, useState } from 'react'
import { isRemotionDesignTemplateSupported } from '../templates'
import { DESIGN_GOALS, recommendDesigns, type DesignGoalId, type GoalSuggestion, type RecommendContext } from '../templates/recommendations'
import type { RemotionDesignTemplate } from '../templates/types'
import type { PreviewAspectRatio } from '../preview/types'
import { PersonalizationTemplateBrowser } from './PersonalizationTemplateBrowser'
import { C, chipStyle, hintStyle, labelStyle, secondaryButtonStyle, softPanelStyle } from './tokens'

/**
 * Designs for the Preview step: pick a GOAL, see about six designs that suit it, or open the full searchable
 * library. This replaces a wall of one button per design. The selection is the provider's single
 * `activeRemotionDesignId` — the same state Step 3's template browser uses — so there is ONE selector.
 */
export function DesignRecommendations({
  designs,
  aspectRatio,
  activeDesignId,
  available,
  context,
  onSelectDesign,
  onAddDesign,
  onSelectLayout,
  addCheck,
  suggestion,
}: {
  designs: readonly RemotionDesignTemplate[]
  aspectRatio: PreviewAspectRatio
  activeDesignId: string | null
  available: { logo: boolean; product: boolean; service: boolean }
  /** Project facts that tune the ranking and the "why this one" line. */
  context?: RecommendContext
  onSelectDesign: (designId: string | null) => void
  /** Adds a design on top of the current layout (keeps the customer's layers). When omitted, only Replace is offered. */
  onAddDesign?: (designId: string) => void
  onSelectLayout: (layoutId: PreviewLayoutId) => void
  /** Says whether a design may be added on top right now; refused designs are disabled with the reason. */
  addCheck?: (design: RemotionDesignTemplate) => { ok: boolean; reason?: string }
  /** Preselects the goal and says why (only from facts we actually have). */
  suggestion?: GoalSuggestion
}): React.JSX.Element {
  // Follows the suggestion until the customer picks a goal themselves.
  const [pickedGoal, setPickedGoal] = useState<DesignGoalId | null>(null)
  const goal: DesignGoalId = pickedGoal ?? suggestion?.goal ?? 'introduce'
  const setGoal = (id: DesignGoalId) => setPickedGoal(id)
  const [browseAll, setBrowseAll] = useState(false)
  // Replace swaps the whole layout for the design; Add keeps the layout and puts the design on top.
  const [how, setHow] = useState<'replace' | 'add'>('add')
  // Add mode never removes: an added design comes off through its Remove button, which keeps the rest.
  const choose = (id: string, active: boolean) => {
    if (how === 'add' && onAddDesign) { if (!active) onAddDesign(id); return }
    onSelectDesign(active ? null : id)
  }
  const recommended = useMemo(
    () => recommendDesigns({
      designs, aspectRatio, goal, available, context,
      isSupported: (d) => isRemotionDesignTemplateSupported(d.id, aspectRatio).supported,
    }),
    [designs, aspectRatio, goal, available, context?.textLength, context?.hasLogo, context?.imageCount],
  )
  return (
    <div data-testid="design-recommendations" style={{ marginBottom: 12 }}>
      <p style={{ ...hintStyle, marginTop: 0 }}>Designs add animation to your video; your layout stays.</p>
      <div style={{ ...labelStyle, marginBottom: 6 }}>What is this video for?</div>
      <div role="group" aria-label="Goal" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {DESIGN_GOALS.map((g) => (
          <button key={g.id} type="button" data-testid={`design-goal-${g.id}`} aria-pressed={goal === g.id} title={g.description} onClick={() => setGoal(g.id)} style={chipStyle(goal === g.id)}>
            {g.label}
          </button>
        ))}
      </div>
      {suggestion && pickedGoal === null && (
        <p data-testid="design-goal-reason" style={{ ...hintStyle, margin: '0 0 8px' }}>Suggested: {suggestion.reason}</p>
      )}
      {onAddDesign && (
        <div role="group" aria-label="When I pick a design" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ ...hintStyle, margin: 0 }}>When I pick a design:</span>
          <button type="button" data-testid="design-how-replace" aria-pressed={how === 'replace'} onClick={() => setHow('replace')} style={chipStyle(how === 'replace')}>Replace my layout (starts over)</button>
          <button type="button" data-testid="design-how-add" aria-pressed={how === 'add'} onClick={() => setHow('add')} style={chipStyle(how === 'add')}>Add on top (keeps my layout and edits)</button>
        </div>
      )}
      <div style={{ ...labelStyle, marginBottom: 6 }}>Recommended designs</div>
      <div data-testid="design-recommended" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
        {recommended.map(({ design, reasons }) => {
          const active = activeDesignId === design.id
          const refusal = how === 'add' && !active && addCheck ? addCheck(design) : { ok: true }
          return (
            <button
              key={design.id}
              type="button"
              data-testid={`design-rec-${design.id}`}
              aria-pressed={active}
              disabled={!refusal.ok}
              title={refusal.ok ? design.description : refusal.reason}
              onClick={() => choose(design.id, active)}
              style={{ ...softPanelStyle, textAlign: 'left', cursor: refusal.ok ? 'pointer' : 'not-allowed', opacity: refusal.ok ? 1 : 0.55, border: `1px solid ${active ? C.cyanBorder : C.border}`, background: active ? 'transparent' : undefined }}
            >
              <div style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{design.name}</div>
              <div style={{ ...hintStyle, margin: '2px 0 0' }}>{refusal.ok ? design.description : refusal.reason}</div>
              {reasons.length > 1 && <div data-testid={`design-why-${design.id}`} style={{ ...hintStyle, margin: '4px 0 0', color: C.cyan }}>Why: {reasons.slice(1).join(' · ')}</div>}
            </button>
          )
        })}
        {recommended.length === 0 && <p style={{ ...hintStyle, margin: 0 }}>No designs fit this goal and video shape — browse the full library.</p>}
      </div>
      <button type="button" data-testid="design-browse-all" aria-expanded={browseAll} onClick={() => setBrowseAll((v) => !v)} style={{ ...secondaryButtonStyle, marginTop: 10, minHeight: 30, fontSize: 11 }}>
        {browseAll ? 'Hide the full library' : `Browse all ${designs.length} designs`}
      </button>
      {browseAll && (
        <div style={{ marginTop: 10 }}>
          <PersonalizationTemplateBrowser onSelect={onSelectLayout} onSelectDesign={(id) => choose(id, activeDesignId === id)} />
        </div>
      )}
    </div>
  )
}
