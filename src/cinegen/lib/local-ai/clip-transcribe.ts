// [remix] Port I1: the one entry point CineGen's caption flows use. Runs the locally installed Whisper model (Media tools > Local AI) and returns
// Remotion-shaped captions (ms) exactly like the previous `transcribeInBrowser`, so caption styles and Stage 2 text-motion presets work unchanged.
import { localAi } from './runtime';
import { transcribeLocal, type TranscribeOptions, type TranscribeResult } from './transcribe';

export async function transcribeAsset(src: string, o: Omit<TranscribeOptions, 'decode'> = {}): Promise<TranscribeResult> {
  const { manager, client } = localAi();
  await manager.refresh();
  return transcribeLocal(src, manager, client, o);
}
