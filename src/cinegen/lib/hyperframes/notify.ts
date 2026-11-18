// [hyperframes] Customer-visible notices go through the editor's existing toast (AppToastHost in workspace-shell) via a window event,
// the same mechanism the cloud-sync errors use. Only the message text is HyperFrames-specific.
export const HF_NOTICE_EVENT = 'cinegen:hyperframes-notice';
export interface HfNotice { id: string; title: string; message: string }
const PREFIXES = ['[hyperframes:error] ', '[hyperframes:note] '];
export const stripHfPrefix = (m: string): string => PREFIXES.reduce((s, p) => (s.startsWith(p) ? s.slice(p.length) : s), String(m));
export function notifyHyperframes(n: HfNotice): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<HfNotice>(HF_NOTICE_EVENT, { detail: n }));
}
