/**
 * Pure edits to `settings.presenter` for the presenter panel (Stage 3). Each returns a NEW settings object and runs
 * the result through normalizePresenter, so whatever the panel does, the stored value is always valid.
 */
import type { PersonalizationPreviewSettings } from '../preview/types'
import {
  defaultPresenter,
  normalizePresenter,
  presenterRect,
  presetById,
  suggestFraming,
  type PresenterBackgroundMode,
  type PresenterMatte,
  type PresenterSettings,
} from '../preview/presenter'

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

const merge = (base: PresenterSettings, patch: DeepPartial<PresenterSettings>): PresenterSettings => ({
  ...base,
  ...(patch as object),
  box: { ...base.box, ...(patch.box ?? {}) },
  focus: { ...base.focus, ...(patch.focus ?? {}) },
  background: { ...base.background, ...(patch.background ?? {}) },
}) as PresenterSettings

export function patchPresenter(prev: PersonalizationPreviewSettings, patch: DeepPartial<PresenterSettings>): PersonalizationPreviewSettings {
  const base = prev.presenter ?? defaultPresenter('bubble')
  const next = normalizePresenter(merge(base, patch))
  return next ? { ...prev, presenter: next } : prev
}

export function removePresenter(prev: PersonalizationPreviewSettings): PersonalizationPreviewSettings {
  if (!prev.presenter) return prev
  const { presenter: _drop, ...rest } = prev
  return rest as PersonalizationPreviewSettings
}

/** Applies a preset's geometry/look. Processed footage and its settings are kept: a preset never throws away a bake. */
export function applyPresenterPreset(prev: PersonalizationPreviewSettings, id: string): PersonalizationPreviewSettings {
  const preset = presetById(id)
  if (!preset) return prev
  const built = preset.build()
  const next = normalizePresenter({ ...built, matte: prev.presenter?.matte, videoAspect: prev.presenter?.videoAspect })
  if (!next) return prev
  const applied = { ...prev, presenter: next }
  // A bubble / box only makes sense on the person: frame them when we already know where they are.
  return next.layout !== 'full' && next.matte?.bounds ? applyAutoFraming(applied) : applied
}

export function setVideoAspect(prev: PersonalizationPreviewSettings, aspect: number | undefined): PersonalizationPreviewSettings {
  if (!prev.presenter || !aspect || prev.presenter.videoAspect === aspect) return prev
  return patchPresenter(prev, { videoAspect: aspect })
}

export function setMatte(prev: PersonalizationPreviewSettings, matte: PresenterMatte | undefined): PersonalizationPreviewSettings {
  const base = prev.presenter ?? defaultPresenter('bubble')
  const next = normalizePresenter({ ...base, matte })
  return next ? { ...prev, presenter: next } : prev
}

/** Frames the person's head and shoulders in the current box, using the processed footage's measured bounds. */
export function applyAutoFraming(prev: PersonalizationPreviewSettings): PersonalizationPreviewSettings {
  const p = prev.presenter
  const m = p?.matte
  if (!p || !m?.bounds) return prev
  const rect = presenterRect(p, Math.max(1, prev.width), Math.max(1, prev.height))
  const f = suggestFraming(m.bounds, p.videoAspect ?? m.videoAspect ?? 16 / 9, rect.width / rect.height)
  return patchPresenter(prev, { focus: f })
}

/** A background mode that needs processed footage, and whether the project has usable footage for it. */
export function modeNeedsMatte(mode: PresenterBackgroundMode): boolean {
  return mode === 'blur' || mode === 'color' || mode === 'image' || mode === 'remove'
}
