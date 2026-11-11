export interface OptinOverlayOptions {
  onSubmit?: (data: Record<string, string>) => Promise<string | void> | string | void;
  onSkip?: () => void;
  prefill?: Record<string, string>;
  /** Editor preview: the backdrop stays see-through. */
  preview?: boolean;
  name?: string;
}
export function ensureOverlayLayer(frame: HTMLElement): HTMLElement;
export function clearOverlay(layer: HTMLElement, name?: string): void;
export function showOptinOverlay(layer: HTMLElement, config: Record<string, unknown>, opts?: OptinOverlayOptions): HTMLElement;
export function showListBuilderOverlay(layer: HTMLElement, config: Record<string, unknown>, opts?: OptinOverlayOptions): HTMLElement;
export function buildOptinForm(config: Record<string, unknown>, opts?: { prefill?: Record<string, string>; compact?: boolean }): HTMLFormElement;
export function buildArrowHint(config: Record<string, unknown>): HTMLElement | null;
export function backdropStyle(config: Record<string, unknown>, opts?: { preview?: boolean }): string;
export function formBackground(config: Record<string, unknown>): string;
export function ensureFormFont(family: string): void;
export function startPointer(hint: HTMLElement, form: HTMLElement, config: Record<string, unknown>): () => void;
