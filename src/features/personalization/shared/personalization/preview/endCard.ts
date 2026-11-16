/** The branded end card's timing, shared by the composition and the quality checks. */
export function endCardFrames(durationInFrames: number): { start: number; length: number } {
  const length = Math.min(90, Math.max(45, Math.round(durationInFrames * 0.2)))
  return { start: Math.max(0, durationInFrames - length), length }
}
