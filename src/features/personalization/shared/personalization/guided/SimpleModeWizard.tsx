'use client'

import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { StepFindBusiness } from './StepFindBusiness'
import { StepChooseVideo } from './StepChooseVideo'
import { StepPersonalize } from './StepPersonalize'
import { StepPreviewApprove } from './StepPreviewApprove'
import { C, badgeStyle, primaryButtonStyle, secondaryButtonStyle } from './tokens'
import type { DiscoveredAsset } from '../types'

const STEPS = [
  { step: 1 as const, label: 'Find your business' },
  { step: 2 as const, label: 'Your video' },
  { step: 3 as const, label: 'Personalize' },
  { step: 4 as const, label: 'Preview and approve' },
]

/**
 * Simple Mode — the default, customer-facing presentation of the personalization
 * modal: four numbered steps over the same provider state the full Advanced
 * Editing view uses. Switching to Advanced Editing never discards selections,
 * because both presentations read and write the same context.
 *
 * Nothing here gates on a design preset: SmartVideo GO AI applies a compatible
 * layout automatically in step 3, so the only real gates are a business on
 * step 1 and a video on step 2.
 */
export function SimpleModeWizard({
  onEditDiscoveredAsset,
}: {
  /** Opens the AI image editor on a discovered asset; omitted for anonymous sessions. */
  onEditDiscoveredAsset?: (asset: DiscoveredAsset) => void
} = {}): React.JSX.Element {
  const ctx = useDemoPersonalize()
  const {
    guidedStep = 1,
    setGuidedStep,
    clientForm = {},
    source,
    previewVideo,
    previewApproved,
  } = ctx

  const currentStep = Math.min(4, Math.max(1, guidedStep))
  const hasBusiness = Boolean(clientForm.businessName || clientForm.name)
  const hasVideo = Boolean(previewVideo?.url || source?.sourceMedia)

  // The only genuinely missing data: step 1 needs a business, step 2 needs a
  // video. A layout is NEVER required — one is applied automatically.
  const stepHint = (step: number): string | null => {
    if (step === 1 && !hasBusiness) return 'Pick or enter your business to continue.'
    if (step === 2 && !hasVideo) return 'Choose a video to brand.'
    return null
  }

  // Kept here (not inside step 3) so an explicit layout choice survives moving
  // between the Personalize and Preview steps, whose component unmounts.
  const [layoutChosenByUser, setLayoutChosenByUser] = useState(false)

  const stepNumber = (index: number) => STEPS[index].step

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 2px 8px' }}>
      {/* ── Step header ─────────────────────────────────────────────────── */}
      <ol
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, listStyle: 'none', margin: 0, padding: 0 }}
        className="guided-step-header"
      >
        {STEPS.map((entry, index) => {
          const active = entry.step === currentStep
          const complete = entry.step < currentStep
          return (
            <li key={entry.step}>
              <button
                type="button"
                onClick={() => setGuidedStep(entry.step)}
                aria-current={active ? 'step' : undefined}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: `1px solid ${active ? C.cyanBorder : C.border}`,
                  background: active ? C.cyanSoft : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 800,
                    background: complete ? C.green : active ? C.cyan : 'rgba(255,255,255,.06)',
                    color: complete || active ? '#041014' : C.muted,
                  }}
                >
                  {complete ? '✓' : entry.step}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', color: active ? C.cyan : C.text, fontSize: 11, fontWeight: 800 }}>{entry.label}</span>
                  <span style={{ display: 'block', color: C.muted2, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    Step {entry.step}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {/* ── Step body ───────────────────────────────────────────────────── */}
      <div style={{ minHeight: 380 }}>
        {currentStep === 1 && <StepFindBusiness onEditAsset={onEditDiscoveredAsset} />}
        {currentStep === 2 && <StepChooseVideo />}
        {currentStep === 3 && (
          <StepPersonalize layoutChosenByUser={layoutChosenByUser} onChooseLayout={() => setLayoutChosenByUser(true)} />
        )}
        {currentStep === 4 && <StepPreviewApprove />}
      </div>

      {/* ── Step navigation ─────────────────────────────────────────────── */}
      {currentStep < 4 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            borderTop: `1px solid ${C.border}`,
            paddingTop: 14,
          }}
        >
          {currentStep > 1 && (
            <button type="button" onClick={() => setGuidedStep(stepNumber(currentStep - 2))} style={secondaryButtonStyle}>
              <ArrowLeft size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              Back
            </button>
          )}
          <span style={{ color: C.muted, fontSize: 11, marginRight: 'auto' }}>
            {stepHint(currentStep) ||
              (currentStep === 3
                ? previewApproved
                  ? 'Approved — preview it any time.'
                  : 'SmartVideo GO AI applies a layout for you — change it any time or just continue.'
                : '')}
          </span>
          <button
            type="button"
            onClick={() => setGuidedStep(stepNumber(currentStep))}
            style={{ ...primaryButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 7 }}
          >
            Continue
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {currentStep === 4 && (
        <div style={{ display: 'flex', justifyContent: 'flex-start', borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
          <button type="button" onClick={() => setGuidedStep(3)} style={secondaryButtonStyle}>
            <ArrowLeft size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Back to personalization
          </button>
          {previewApproved && <span style={{ ...badgeStyle('green'), marginLeft: 12, alignSelf: 'center' }}>Approved</span>}
        </div>
      )}

      <style>
        {`@media (max-width: 720px) { .guided-step-header { grid-template-columns: repeat(2, minmax(0, 1fr)); } }`}
      </style>
    </div>
  )
}
