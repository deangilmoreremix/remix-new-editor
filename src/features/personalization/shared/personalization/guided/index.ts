/**
 * Guided Simple Mode surfaces for the Personalization Modal.
 *
 * These components are a simplified PRESENTATION over the same provider state
 * the full modal uses — they add no second source of truth and no second modal.
 */

export { SimpleModeWizard } from './SimpleModeWizard'
export { StepFindBusiness } from './StepFindBusiness'
export { StepChooseVideo } from './StepChooseVideo'
export { StepPersonalize } from './StepPersonalize'
export { StepPreviewApprove } from './StepPreviewApprove'
export { OverlayEditor } from './OverlayEditor'
export type { OverlayEditorProps } from './OverlayEditor'
export { TemplateBrowser } from './TemplateBrowser'
export type { TemplateBrowserProps } from './TemplateBrowser'
export { buildPreviewInput } from './buildPreviewInput'
export type { BuildPreviewInputContext } from './buildPreviewInput'
export { GUIDED_DEMO_VIDEOS, demoDurationInFrames } from './curatedDemos'
export { C as guidedTokens } from './tokens'
