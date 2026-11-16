// Stand-in for `remotion` inside vendored RemotionUI source: everything is re-exported unchanged except useVideoConfig, which reports
// the CLIP's length (RemotionUI scenes plan their whole life across durationInFrames) instead of the whole timeline's.
import { createContext, useContext } from 'react';
import { useVideoConfig as useRealVideoConfig } from 'remotion';

export * from 'remotion';
export const ClipDurationContext = createContext<number | null>(null);
export function useVideoConfig() {
  const cfg = useRealVideoConfig();
  const d = useContext(ClipDurationContext);
  return d == null ? cfg : { ...cfg, durationInFrames: d };
}
