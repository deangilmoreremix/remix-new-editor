'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Player } from '@remotion/player'
import type { PlayerRef } from '@remotion/player'
import { AlertTriangle, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { PersonalizationComposition } from './PersonalizationComposition'
import { previewPlayerRef } from './PreviewControls'
import {
  isFailureForVideo,
  previewMediaLabel,
  subscribePreviewMediaFailure,
} from './previewMediaEvents'
import type { PreviewMediaFailure } from './previewMediaEvents'
import type { PreviewInputProps } from './types'

export interface PersonalizationPlayerProps {
  inputProps: PreviewInputProps
  /** CSS width of the player element. Defaults to '100%'. */
  width?: number | string
  /** CSS height of the player element. Defaults to '100%'. */
  height?: number | string
  autoPlay?: boolean
  loop?: boolean
  className?: string
  ariaLabel?: string
  /** When true, render only the Player (used for side-by-side followers). */
  hideTransport?: boolean
  /** When provided, drive this ref instead of the shared previewPlayerRef. */
  playerRefOverride?: React.RefObject<PlayerRef | null>
  onFrameChange?: (frame: number) => void
  onPlayingChange?: (playing: boolean) => void
  /** Controlled mute state; uncontrolled internal state when undefined. */
  muted?: boolean
  onMutedChange?: (muted: boolean) => void
}

function formatTimecode(frame: number, fps: number): string {
  const safeFps = fps > 0 ? fps : 30
  const safeFrame = Number.isFinite(frame) ? Math.max(0, Math.floor(frame)) : 0
  const totalSeconds = safeFrame / safeFps
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
}

/**
 * Personalization preview player: a free, browser-based Remotion Player that
 * renders the customer's selected video with their branding overlays.
 */
export function PersonalizationPlayer(
  props: PersonalizationPlayerProps,
): React.JSX.Element {
  const {
    inputProps,
    width = '100%',
    height = '100%',
    autoPlay = false,
    loop = true,
    className,
    ariaLabel = 'Personalized video preview',
    hideTransport = false,
    playerRefOverride,
    onFrameChange,
    onPlayingChange,
    muted,
    onMutedChange,
  } = props

  const settings = inputProps.settings
  const durationInFrames = Math.max(1, Math.round(settings.durationInFrames))
  const compositionWidth = settings.width
  const compositionHeight = settings.height
  const fps = settings.fps
  const videoUrl = inputProps.videoUrl

  const ref = playerRefOverride ?? previewPlayerRef
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [internalMuted, setInternalMuted] = useState(muted ?? true)
  const [mediaFailure, setMediaFailure] = useState<PreviewMediaFailure | null>(null)
  const didMountRef = useRef(false)

  // Latest callbacks without re-subscribing the emitter listeners on every
  // render: inline arrow props from the parent (e.g. the Before/After sync
  // handlers) would otherwise remove and re-add the listeners each render.
  const onFrameChangeRef = useRef(onFrameChange)
  const onPlayingChangeRef = useRef(onPlayingChange)
  onFrameChangeRef.current = onFrameChange
  onPlayingChangeRef.current = onPlayingChange

  useEffect(() => {
    const player = ref.current
    if (!player || typeof player.addEventListener !== 'function') return
    const onFrameUpdate = (event: { detail: { frame: number } }) => {
      const next = typeof event?.detail?.frame === 'number' ? event.detail.frame : 0
      setFrame(next)
      onFrameChangeRef.current?.(next)
    }
    const onPlay = () => {
      setPlaying(true)
      onPlayingChangeRef.current?.(true)
    }
    const onPause = () => {
      setPlaying(false)
      onPlayingChangeRef.current?.(false)
    }
    player.addEventListener('frameupdate', onFrameUpdate)
    player.addEventListener('play', onPlay)
    player.addEventListener('pause', onPause)
    return () => {
      player.removeEventListener('frameupdate', onFrameUpdate)
      player.removeEventListener('play', onPlay)
      player.removeEventListener('pause', onPause)
    }
  }, [ref])

  // Media failures are reported by the composition on a module-level channel
  // (the Player instantiates the composition, so props cannot bubble up).
  // Failures belonging to a different source are ignored: in Before/After
  // split mode two compositions share the channel.
  useEffect(
    () =>
      subscribePreviewMediaFailure((failure) => {
        setMediaFailure(isFailureForVideo(failure, videoUrl) ? failure : null)
      }),
    [videoUrl],
  );

  // `initiallyMuted` is only applied on mount; controlled toggling after mount
  // is driven imperatively through the ref.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    if (muted === undefined) return
    const player = ref.current
    if (!player) return
    try {
      if (muted) player.mute()
      else player.unmute()
    } catch {
      // A player without an attached media element cannot (un)mute yet.
    }
  }, [muted, ref])

  const isMuted = muted ?? internalMuted

  const handleTogglePlay = () => {
    const player = ref.current
    if (!player) return
    let currentlyPlaying = false
    try {
      currentlyPlaying = player.isPlaying()
    } catch {
      currentlyPlaying = playing
    }
    try {
      if (currentlyPlaying) player.pause()
      else player.play()
    } catch {
      // Autoplay policies can reject play(); the transport stays usable.
    }
  }

  const handleSeek = (value: number) => {
    const player = ref.current
    if (!player) return
    const target = Number.isFinite(value) ? Math.round(value) : 0
    player.seekTo(Math.max(0, Math.min(durationInFrames - 1, target)))
  }

  const handleReplay = () => {
    const player = ref.current
    if (!player) return
    player.seekTo(0)
    try {
      player.play()
    } catch {
      // Autoplay policies can reject play(); the seek still applied.
    }
  }

  const handleToggleMute = () => {
    const nextMuted = !isMuted
    if (muted === undefined) setInternalMuted(nextMuted)
    const player = ref.current
    if (player) {
      try {
        if (nextMuted) player.mute()
        else player.unmute()
      } catch {
        // A player without an attached media element cannot (un)mute yet.
      }
    }
    onMutedChange?.(nextMuted)
  }

  // `Player` infers loose component/inputProps types; the composition's props
  // are an interface (no implicit index signature), so both are widened here.
  const PreviewComposition = PersonalizationComposition as unknown as React.ComponentType<
    Record<string, unknown>
  >
  const playerInputProps = inputProps as unknown as Record<string, unknown>

  const errorBanner = mediaFailure ? (
    <div
      role="alert"
      data-testid="preview-media-error"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '8px 10px',
        background: 'rgba(69, 10, 10, 0.92)',
        borderTop: '1px solid rgba(248, 113, 113, 0.45)',
        color: '#fee2e2',
        fontSize: 12,
        lineHeight: 1.35,
      }}
    >
      <AlertTriangle size={14} style={{ flex: '0 0 auto', marginTop: 1 }} aria-hidden="true" />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontWeight: 700 }}>This video could not be played in your browser</span>
        <span data-testid="preview-media-error-source">
          Source: {mediaFailure.videoUrl || mediaFailure.label || previewMediaLabel(videoUrl)}
        </span>
        <span style={{ color: 'rgba(254, 226, 226, 0.75)' }}>
          {mediaFailure.posterUrl
            ? 'Its poster image is shown instead. Try another video, or re-encode it as MP4/H.264.'
            : 'No poster is available for this source. Try another video, or re-encode it as MP4/H.264.'}
        </span>
      </span>
    </div>
  ) : null

  const transportBar = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        background: 'rgba(5, 7, 10, 0.9)',
        borderTop: '1px solid rgba(148, 163, 184, 0.25)',
      }}
    >
      <button
        type="button"
        onClick={handleTogglePlay}
        aria-label={playing ? 'Pause preview' : 'Play preview'}
        title={playing ? 'Pause' : 'Play'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 999,
          border: '1px solid rgba(148, 163, 184, 0.35)',
          background: 'rgba(15, 23, 42, 0.8)',
          color: '#e2e8f0',
          cursor: 'pointer',
        }}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <span
        style={{
          fontSize: 12,
          fontVariantNumeric: 'tabular-nums',
          color: '#cbd5e1',
          minWidth: 78,
          textAlign: 'center',
        }}
      >
        {formatTimecode(frame, fps)} / {formatTimecode(durationInFrames, fps)}
      </span>
      <input
        type="range"
        min={0}
        max={Math.max(0, durationInFrames - 1)}
        value={Math.min(frame, Math.max(0, durationInFrames - 1))}
        onChange={(event) => handleSeek(Number(event.target.value))}
        aria-label="Seek preview"
        style={{ flex: '1 1 auto', minWidth: 80, accentColor: '#29d3f2' }}
      />
      <button
        type="button"
        onClick={handleToggleMute}
        aria-label={isMuted ? 'Unmute preview' : 'Mute preview'}
        title={isMuted ? 'Unmute' : 'Mute'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 999,
          border: '1px solid rgba(148, 163, 184, 0.35)',
          background: 'rgba(15, 23, 42, 0.8)',
          color: '#e2e8f0',
          cursor: 'pointer',
        }}
      >
        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
      <button
        type="button"
        onClick={handleReplay}
        aria-label="Replay preview"
        title="Replay"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 999,
          border: '1px solid rgba(148, 163, 184, 0.35)',
          background: 'rgba(15, 23, 42, 0.8)',
          color: '#e2e8f0',
          cursor: 'pointer',
        }}
      >
        <RotateCcw size={16} />
      </button>
    </div>
  )

  return (
    <div
      className={className}
      role="region"
      aria-label={ariaLabel}
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0 }}>
        <Player
          ref={ref}
          component={PreviewComposition}
          inputProps={playerInputProps}
          durationInFrames={durationInFrames}
          compositionWidth={compositionWidth}
          compositionHeight={compositionHeight}
          fps={fps}
          loop={loop}
          controls={false}
          clickToPlay
          numberOfSharedAudioTags={8}
          acknowledgeRemotionLicense
          autoPlay={autoPlay}
          style={{ width: '100%', height: '100%' }}
          initiallyMuted={muted ?? true}
        />
        {/* Follower players have no transport bar; keep the error visible as an
            overlay pinned to the bottom of the stage instead. */}
        {hideTransport && mediaFailure ? (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>{errorBanner}</div>
        ) : null}
      </div>
      {hideTransport ? null : (
        <>
          {errorBanner}
          {transportBar}
        </>
      )}
    </div>
  )
}
