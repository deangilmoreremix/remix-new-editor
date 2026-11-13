'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import type { PlayerRef } from '@remotion/player'
import { PersonalizationPlayer } from './PersonalizationPlayer'
import type { PreviewInputProps } from './types'

export type BeforeAfterMode = 'toggle' | 'split'

export interface BeforeAfterPreviewProps {
  inputProps: PreviewInputProps
  defaultMode?: BeforeAfterMode
  /** Which side the single-view (toggle) mode opens on. Defaults to before. */
  initialSide?: 'before' | 'after'
  /**
   * The original video for BEFORE when the AFTER video itself was changed
   * (a Full Body Recast swaps the person, so BEFORE must show who was there).
   * Omitted, both panes render the same video and differ only by overlays.
   */
  beforeVideoUrl?: string | null
}

/**
 * Frame difference below which the two players are considered aligned. A
 * one- or two-frame drift is normal playback jitter; seeking on every such
 * event would visibly stutter the follower and fight the user's scrub.
 */
export const PREVIEW_SYNC_FRAME_THRESHOLD = 2

/** Minimal Player surface the sync logic needs (satisfied by `PlayerRef`). */
export interface PreviewSyncPlayer {
  getCurrentFrame(): number
  seekTo(frame: number): void
  isPlaying(): boolean
  play(): void
  pause(): void
}

export interface PreviewSyncPlayerRefs {
  before: React.RefObject<PreviewSyncPlayer | null>
  after: React.RefObject<PreviewSyncPlayer | null>
}

/**
 * Per-player record of the last frame this component pushed into that player.
 * The follower's own `frameupdate` echoes a frame equal to the last one we
 * sought it to; without this record that echo would be mirrored straight back
 * and the two players would ping-pong seeks forever.
 */
export interface PreviewSyncState {
  before: number | null
  after: number | null
}

export function createPreviewSyncState(): PreviewSyncState {
  return { before: null, after: null }
}

/** True when a frame echo should NOT be mirrored back to its origin. */
export function isPreviewSyncEcho(
  frame: number,
  lastSeekedIntoOrigin: number | null,
  threshold: number = PREVIEW_SYNC_FRAME_THRESHOLD,
): boolean {
  if (lastSeekedIntoOrigin === null) return false
  return Math.abs(frame - lastSeekedIntoOrigin) <= threshold
}

/** Mirrors one player's frame into the other, echo-guarded. */
export function syncPreviewFrame(
  from: 'before' | 'after',
  frame: number,
  players: PreviewSyncPlayerRefs,
  state: PreviewSyncState,
  threshold: number = PREVIEW_SYNC_FRAME_THRESHOLD,
): PreviewSyncState {
  if (!Number.isFinite(frame)) return state
  const echo = isPreviewSyncEcho(frame, state[from], threshold)
  if (echo) return state

  const targetKey = from === 'before' ? 'after' : 'before'
  const target = players[targetKey].current
  if (!target) return state

  let current = frame
  try {
    current = target.getCurrentFrame()
  } catch {
    current = frame
  }
  if (Math.abs(current - frame) <= threshold) return state
  try {
    target.seekTo(frame)
  } catch {
    return state
  }
  return { ...state, [targetKey]: frame }
}

/** Mirrors one player's play/pause state into the other. */
export function syncPreviewPlaying(
  from: 'before' | 'after',
  playing: boolean,
  players: PreviewSyncPlayerRefs,
): void {
  const target = players[from === 'before' ? 'after' : 'before'].current
  if (!target) return
  let targetPlaying = false
  try {
    targetPlaying = target.isPlaying()
  } catch {
    targetPlaying = false
  }
  try {
    if (playing && !targetPlaying) target.play()
    else if (!playing && targetPlaying) target.pause()
  } catch {
    // Autoplay policies can reject play(); the mirror stays best-effort.
  }
}

/**
 * Builds the BEFORE input props from the AFTER input props. Both views MUST
 * render the exact same `videoUrl` — only overlay visibility and the end card
 * differ — so that switching Before/After is a pure overlay change on the very
 * same source media and never a different (or missing) video.
 */
export function buildBeforeInputProps(inputProps: PreviewInputProps, beforeVideoUrl?: string | null): PreviewInputProps {
  const beforeInputProps: PreviewInputProps = {
    ...inputProps,
    settings: {
      ...inputProps.settings,
      layers: inputProps.settings.layers.map((layer) => ({ ...layer, visible: false })),
      showEndCard: false,
    },
  }
  // Guard: the comparison is only honest when both panes show one source —
  // unless the caller says the AFTER video replaced the original (a recast).
  beforeInputProps.videoUrl = beforeVideoUrl || inputProps.videoUrl
  return beforeInputProps
}

function resolveInitialMode(defaultMode?: BeforeAfterMode): BeforeAfterMode {
  if (defaultMode) return defaultMode
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(min-width: 900px)').matches ? 'split' : 'toggle'
  }
  return 'toggle'
}

/**
 * Before/after comparison for the personalization preview. The BEFORE player
 * renders the plain original video (all overlays hidden); the AFTER player
 * renders the personalized scene.
 */
export function BeforeAfterPreview(props: BeforeAfterPreviewProps): React.JSX.Element {
  const { inputProps, defaultMode, initialSide = 'before', beforeVideoUrl } = props
  const [mode, setMode] = useState<BeforeAfterMode>(() => resolveInitialMode(defaultMode))
  const [showingBefore, setShowingBefore] = useState(initialSide === 'before')
  const beforeRef = useRef<PlayerRef | null>(null)
  const afterRef = useRef<PlayerRef | null>(null)
  const syncStateRef = useRef<PreviewSyncState>(createPreviewSyncState())

  const beforeInputProps = useMemo<PreviewInputProps>(
    () => buildBeforeInputProps(inputProps, beforeVideoUrl),
    [inputProps, beforeVideoUrl],
  )

  // Both panes render the same source media; only overlays and the end card
  // differ, so `videoUrl` must never diverge between them.
  const players = useMemo<PreviewSyncPlayerRefs>(
    () => ({ before: beforeRef, after: afterRef }),
    [],
  )

  const handleBeforeFrame = useCallback(
    (frame: number) => {
      syncStateRef.current = syncPreviewFrame('before', frame, players, syncStateRef.current)
    },
    [players],
  )

  const handleAfterFrame = useCallback(
    (frame: number) => {
      syncStateRef.current = syncPreviewFrame('after', frame, players, syncStateRef.current)
    },
    [players],
  )

  const handleBeforePlaying = useCallback(
    (playing: boolean) => syncPreviewPlaying('before', playing, players),
    [players],
  )

  const handleAfterPlaying = useCallback(
    (playing: boolean) => syncPreviewPlaying('after', playing, players),
    [players],
  )

  const aspectRatio = inputProps.settings.aspectRatio.replace(':', ' / ')

  const modeButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    borderRadius: 999,
    border: `1px solid ${active ? '#d9ff00' : 'rgba(161,161,170, 0.35)'}`,
    background: active ? 'rgba(217,255,0, 0.15)' : 'rgba(10,10,10, 0.8)',
    color: active ? '#f7ffd6' : '#d4d4d8',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  })

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#d4d4d8',
  }

  // The stage is aspect-ratio driven and never wider than its parent, so the
  // composition (whose width/height come from settings) scales down instead of
  // overflowing on narrow/mobile viewports.
  const stageStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 960,
    margin: '0 auto',
  }

  const frameStyle: React.CSSProperties = {
    width: '100%',
    aspectRatio,
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid rgba(161,161,170, 0.25)',
  }

  const modeSwitch = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={() => setMode('split')}
        aria-pressed={mode === 'split'}
        style={modeButtonStyle(mode === 'split')}
      >
        Compare
      </button>
      <button
        type="button"
        onClick={() => setMode('toggle')}
        aria-pressed={mode === 'toggle'}
        style={modeButtonStyle(mode === 'toggle')}
      >
        Switch
      </button>
    </div>
  )

  if (mode === 'toggle') {
    return (
      <div style={{ ...stageStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {modeSwitch}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 12px',
              borderRadius: 999,
              background: showingBefore ? 'rgba(161,161,170, 0.25)' : 'rgba(34,197,94, 0.2)',
              border: `1px solid ${showingBefore ? 'rgba(161,161,170, 0.45)' : 'rgba(34,197,94, 0.5)'}`,
              color: '#e4e4e7',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
            role="button"
            tabIndex={0}
            onClick={() => setShowingBefore((previous) => !previous)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setShowingBefore((previous) => !previous)
              }
            }}
          >
            {showingBefore ? 'Before' : 'After'}
          </span>
          <span style={{ fontSize: 12, color: '#a1a1aa' }}>
            {showingBefore ? 'Original video' : 'Personalized preview'}
          </span>
        </div>
        <div style={frameStyle}>
          {/* Constant key keeps the same player instance across Before/After switches. */}
          <PersonalizationPlayer
            key="personalization-before-after"
            inputProps={showingBefore ? beforeInputProps : inputProps}
            ariaLabel={showingBefore ? 'Before: original video' : 'After: personalized preview'}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...stageStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {modeSwitch}
      <div
        style={{
          display: 'grid',
          // Side by side whenever the stage fits both panes, stacked otherwise.
          // `min(100%, 340px)` lets the single column still shrink on phones
          // without a media query (and without overflowing the parent).
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span style={labelStyle}>Before — original</span>
          <div style={frameStyle}>
            <PersonalizationPlayer
              inputProps={beforeInputProps}
              playerRefOverride={beforeRef}
              hideTransport
              ariaLabel="Before: original video"
              onFrameChange={handleBeforeFrame}
              onPlayingChange={handleBeforePlaying}
            />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span style={labelStyle}>After — personalized</span>
          <div style={frameStyle}>
            <PersonalizationPlayer
              inputProps={inputProps}
              playerRefOverride={afterRef}
              ariaLabel="After: personalized preview"
              onFrameChange={handleAfterFrame}
              onPlayingChange={handleAfterPlaying}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
