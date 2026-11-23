import { moderationMessage, type ModerationDetails } from './openaiImageApi';

/**
 * Turns OpenAI's image SSE (partial_image / completed events) into the small stream the thumbnail UI reads:
 *   data: {"type":"partial","index":0,"url":"data:image/png;base64,..."}
 *   data: {"type":"done","urls":["data:..."],"model":"...","usage":{...}}
 *   data: {"type":"error","error":"...","code":"..."}
 */
export interface StreamContext {
  format: string;
  model: string;
  fellBackFrom?: string;
  requestId: string;
}

export type ClientEvent =
  | { type: 'partial'; index: number; url: string }
  | { type: 'done'; urls: string[]; model: string; request_id: string; usage?: unknown; revised_prompt?: string; fallback_from?: string }
  | { type: 'error'; error: string; code?: string; moderation_details?: ModerationDetails };

const dataUrl = (format: string, b64: string) => `data:image/${format};base64,${b64}`;

/** Parses one SSE block ("event: x\ndata: {...}") into its JSON payload, or null. */
export function parseSseBlock(block: string): Record<string, any> | null {
  const data = block
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim())
    .join('');
  if (!data || data === '[DONE]') return null;
  try {
    return JSON.parse(data) as Record<string, any>;
  } catch {
    return null;
  }
}

/** Maps one OpenAI event to a client event (null = ignore). */
export function mapEvent(evt: Record<string, any>, ctx: StreamContext): ClientEvent | null {
  const type = String(evt.type || '');
  const format = evt.output_format || ctx.format;
  if (/partial_image$/.test(type) && evt.b64_json) {
    return { type: 'partial', index: Number(evt.partial_image_index ?? 0), url: dataUrl(format, evt.b64_json) };
  }
  if (/completed$/.test(type) && evt.b64_json) {
    return {
      type: 'done',
      urls: [dataUrl(format, evt.b64_json)],
      model: ctx.model,
      request_id: ctx.requestId,
      ...(evt.usage ? { usage: evt.usage } : {}),
      ...(evt.revised_prompt ? { revised_prompt: evt.revised_prompt } : {}),
      ...(ctx.fellBackFrom ? { fallback_from: ctx.fellBackFrom } : {}),
    };
  }
  if (type === 'error' || evt.error) {
    const err = evt.error || evt;
    if (err.code === 'moderation_blocked') {
      return { type: 'error', error: moderationMessage(err.moderation_details), code: 'moderation_blocked', ...(err.moderation_details ? { moderation_details: err.moderation_details } : {}) };
    }
    return { type: 'error', error: String(err.message || 'The image service reported an error.'), ...(err.code ? { code: String(err.code) } : {}) };
  }
  return null;
}

/** Reads OpenAI's SSE body and writes client events. Always ends with `done` or `error`. */
export function toClientStream(upstream: Response, ctx: StreamContext): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ClientEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      let finished = false;
      try {
        const reader = upstream.body?.getReader();
        if (!reader) throw new Error('The image service sent no stream.');
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let cut = buffer.indexOf('\n\n');
          while (cut !== -1) {
            const evt = parseSseBlock(buffer.slice(0, cut));
            buffer = buffer.slice(cut + 2);
            cut = buffer.indexOf('\n\n');
            const mapped = evt ? mapEvent(evt, ctx) : null;
            if (mapped) {
              send(mapped);
              if (mapped.type !== 'partial') finished = true;
            }
          }
        }
        if (!finished) send({ type: 'error', error: 'The picture stream ended early. Try again.' });
      } catch (err: any) {
        if (!finished) send({ type: 'error', error: err?.message || 'The picture stream failed.' });
      } finally {
        controller.close();
      }
    },
  });
}
