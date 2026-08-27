/**
 * Humanize Cut Service — Suggests natural cut points based on silence/breaths
 * Part of the @smartvideo/ai-timeline-editor package
 */

export interface HumanizeCutRequest {
  clipId: string;
  silenceBoundaries: Array<{ time: number; duration: number; type: string }>;
  roomToneHandle?: number;
}

export interface HumanizeCutResult {
  clipId: string;
  suggestedCuts: Array<{
    time: number;
    type: 'cut' | 'j-cut' | 'l-cut';
    confidence: number;
  }>;
  roomToneHandles: Array<{
    cutPoint: number;
    audioBefore: number;
    audioAfter: number;
  }>;
}

export class HumanizeCutService {
  async getHumanizedCuts(request: HumanizeCutRequest): Promise<HumanizeCutResult> {
    const handleDuration = request.roomToneHandle || 0.15;

    const suggestedCuts = request.silenceBoundaries
      .filter(s => s.duration >= 0.2)
      .map(s => ({
        time: s.time + s.duration,
        type: s.type === 'pause' && s.duration > 0.4 ? 'j-cut' as const : 'cut' as const,
        confidence: Math.min(0.95, s.duration * 2)
      }));

    const roomToneHandles = suggestedCuts.map(cut => ({
      cutPoint: cut.time,
      audioBefore: cut.time - handleDuration,
      audioAfter: cut.time + handleDuration
    }));

    return {
      clipId: request.clipId,
      suggestedCuts,
      roomToneHandles
    };
  }
}

export default HumanizeCutService;
