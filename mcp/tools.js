// Timeline AI tools. Request building is the app's own code (src/lib/muapi/frameModels.js, the same builders
// netlify/functions/timeline-ai.js uses), so these tools cannot drift from what the editor sends.
import { z } from '../packages/studio-mcp-core/src/index.js';
import {
  FIRST_LAST_FRAME_MODELS, VIDEO_EXTEND_MODELS, MUSIC_MODELS, LAYER_MODELS, WATERMARK_MODELS,
  buildFirstLastFramePayload, buildVideoExtendPayload, buildExtendBeforePayload, buildMusicPayload, buildLayerPayload, buildWatermarkPayload,
} from '../src/lib/muapi/frameModels.js';

const keys = (t) => Object.keys(t);
const oneOf = (t) => z.enum(keys(t)).optional().describe(`One of: ${keys(t).join(', ')}`);
const url = (what) => z.string().url().describe(`${what} (public https URL; use upload_file for local files)`);

export const customTools = [
  {
    name: 'video_fill_gap', timeoutMs: 600_000,
    description: 'Generate a clip that bridges two frames (first + last frame to video). With only one frame, it is used for both ends.',
    input: { first_frame_url: url('First frame').optional(), last_frame_url: url('Last frame').optional(), prompt: z.string().optional(), duration: z.number().optional().describe('Seconds (clamped to the model range)'), resolution: z.string().optional(), model: oneOf(FIRST_LAST_FRAME_MODELS) },
    build: (a) => buildFirstLastFramePayload({ model: a.model, firstFrameUrl: a.first_frame_url, lastFrameUrl: a.last_frame_url, prompt: a.prompt, duration: a.duration, resolution: a.resolution }),
  },
  {
    name: 'video_extend', timeoutMs: 600_000,
    description: 'Extend a clip: direction "after" continues it from its own video; "before" animates a lead-in that ends on its first frame.',
    input: { direction: z.enum(['after', 'before']).describe('Extend after or before the clip'), video_url: url('Clip video (direction=after)').optional(), first_frame_url: url('Clip first frame (direction=before)').optional(), prompt: z.string().optional(), duration: z.number().optional(), model: z.string().optional().describe(`after: ${keys(VIDEO_EXTEND_MODELS).join(', ')}; before: ${keys(FIRST_LAST_FRAME_MODELS).join(', ')}`) },
    build: (a) => (a.direction === 'before'
      ? buildExtendBeforePayload({ model: a.model, firstFrameUrl: a.first_frame_url, prompt: a.prompt, duration: a.duration })
      : buildVideoExtendPayload({ model: a.model, videoUrl: a.video_url, prompt: a.prompt, duration: a.duration })),
  },
  {
    name: 'video_remove_watermark', timeoutMs: 600_000,
    description: 'Remove a watermark from a video.',
    input: { video_url: url('Video'), model: oneOf(WATERMARK_MODELS) },
    build: (a) => buildWatermarkPayload({ model: a.model, videoUrl: a.video_url }),
  },
  {
    name: 'image_layers', timeoutMs: 300_000,
    description: 'Split an image into separate transparent layers (foreground, mid-ground, background).',
    input: { image_url: url('Image'), prompt: z.string().optional(), model: oneOf(LAYER_MODELS) },
    build: (a) => buildLayerPayload({ model: a.model, imageUrl: a.image_url, prompt: a.prompt }),
  },
  {
    name: 'music_create', timeoutMs: 300_000,
    description: 'Create a music track. Instrumental from a description, or with vocals when lyrics are given (then style tags are used).',
    input: { prompt: z.string().optional().describe('Describe the music (instrumental)'), lyrics: z.string().optional(), style: z.string().optional().describe('Style tags, e.g. "cinematic orchestral"'), title: z.string().optional(), duration: z.number().optional().describe('Seconds, 10-180'), model: oneOf(MUSIC_MODELS) },
    build: (a) => buildMusicPayload({ model: a.model, prompt: a.prompt, lyrics: a.lyrics, style: a.style, title: a.title, duration: a.duration, instrumental: !a.lyrics }),
  },
];
