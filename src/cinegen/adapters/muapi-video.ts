// [remix] Director video generation on MuAPI (replaces Topview / Higgsfield / Artlist / RunPod submit paths).
import { runTimelineMuapi } from '../../lib/editor/ai/timelineMuapi.js';

interface Req {
  prompt: string;
  durationSec: number;
  params: Record<string, unknown>;
  medias?: Array<{ value: string; role: string }>;
}

/** Image-to-video when a reference still is attached (identity lock), otherwise text-to-video. */
export async function generateMuapiVideo(req: Req): Promise<{ url: string; durationSec: number; model?: string }> {
  const image = req.medias?.find((m) => (m.role === 'image' || m.role === 'start_image') && /^https:\/\//i.test(m.value))?.value;
  const aspect = String(req.params.aspect_ratio ?? '16:9');
  const seconds = Math.min(10, Math.max(1, Math.round(req.durationSec))); // MuAPI clips are short; the Director clip is split by the user
  if (image) {
    const { url, model } = await runTimelineMuapi('shot_video', { imageUrl: image, prompt: req.prompt, duration: seconds });
    return { url, durationSec: seconds, model };
  }
  const { url, model } = await runTimelineMuapi('generate', {
    model: 'seedance-lite-t2v',
    inputs: { prompt: req.prompt, duration: seconds, aspect_ratio: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'].includes(aspect) ? aspect : '16:9', resolution: String(req.params.resolution ?? '720p') },
  });
  return { url, durationSec: seconds, model };
}
