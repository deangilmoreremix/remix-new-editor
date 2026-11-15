// [remix] Director video generation on MuAPI (replaces Topview / Higgsfield / Artlist / RunPod submit paths).
// Seedance 2.5 from MuAPI's live catalog: 4-30 s clips; omni-reference when the clip carries Element stills.
import { runTimelineMuapi } from '../../lib/editor/ai/timelineMuapi.js';

interface Req {
  prompt: string;
  durationSec: number;
  params: Record<string, unknown>;
  medias?: Array<{ value: string; role: string }>;
}

const ASPECTS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
const RESOLUTIONS = ['480p', '720p', '1080p'];

/** The MuAPI request for a Director clip. Exported for tests. */
export function muapiVideoRequest(req: Req): { model: string; inputs: Record<string, unknown>; seconds: number } {
  // MuAPI fetches reference stills itself, so only public https URLs can be attached (local picks stay as the text prompt).
  const refs = [...new Set((req.medias ?? []).filter((m) => m.role === 'image' || m.role === 'start_image').map((m) => m.value).filter((v) => /^https:\/\//i.test(v)))];
  const seconds = Math.min(30, Math.max(4, Math.round(req.durationSec)));
  const aspect = String(req.params.aspect_ratio ?? '16:9');
  const resolution = String(req.params.resolution ?? '720p');
  const inputs: Record<string, unknown> = {
    prompt: req.prompt,
    duration: seconds,
    aspect_ratio: ASPECTS.includes(aspect) ? aspect : '16:9',
    resolution: RESOLUTIONS.includes(resolution) ? resolution : '720p',
  };
  if (refs.length) {
    inputs.images_list = refs.slice(0, 9);
    inputs.omni_reference_task_type = 'reference';
    return { model: 'seedance-2.5-omni-reference', inputs, seconds };
  }
  return { model: 'seedance-2.5-text-to-video', inputs, seconds };
}

export async function generateMuapiVideo(req: Req): Promise<{ url: string; durationSec: number; model?: string }> {
  const { model, inputs, seconds } = muapiVideoRequest(req);
  const { url, model: used } = await runTimelineMuapi('generate', { model, inputs });
  return { url, durationSec: seconds, model: used ?? model };
}
