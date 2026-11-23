import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { InputError } from './catalog.js';
import { sanitizeText, extractOutputs, extractText } from './sanitize.js';
import { NEEDS_CONFIRM, confirmMessage } from './governor.js';

/** Generation tools, one per capability. Registered only when the brand's catalog has models of that kind. */
export const GENERATION_TOOLS = [
  { name: 'image_generate', kinds: ['t2i'], timeoutMs: 120_000, description: 'Generate an image from a text prompt.' },
  { name: 'image_edit', kinds: ['i2i'], timeoutMs: 180_000, description: 'Edit, restyle, upscale or transform existing image(s). Pass source image URL(s) in the model\'s image input.' },
  { name: 'video_generate', kinds: ['t2v'], timeoutMs: 600_000, description: 'Generate a video from a text prompt.' },
  { name: 'video_from_image', kinds: ['i2v'], timeoutMs: 600_000, description: 'Animate an image into a video.' },
  { name: 'video_to_video', kinds: ['v2v'], timeoutMs: 600_000, description: 'Transform, restyle or edit an existing video.' },
  { name: 'lipsync', kinds: ['lipsync'], timeoutMs: 600_000, description: 'Sync lip movement of a portrait image or video to an audio track.' },
  { name: 'audio_generate', kinds: ['audio'], timeoutMs: 300_000, description: 'Generate music, sound effects or speech.' },
  { name: 'video_tool', kinds: ['tools'], timeoutMs: 600_000, description: 'Video utilities: captions, clipping, upscaling, background removal and similar.' },
  { name: 'avatar_generate', kinds: ['avatar'], timeoutMs: 600_000, description: 'Create a talking avatar / presenter video.' },
  { name: 'model_train', kinds: ['training'], timeoutMs: 120_000, description: 'Start training a custom model (e.g. a LoRA) from your images. Returns a request_id; training runs long.' },
  { name: 'vision_describe', kinds: ['vision'], timeoutMs: 120_000, description: 'Describe or analyse an image with a vision model.' },
  { name: 'text_generate', kinds: ['text'], timeoutMs: 120_000, description: 'Generate text with an LLM (scripts, prompts, captions).' },
  { name: 'motion_control', kinds: ['motion'], timeoutMs: 600_000, description: 'Drive an image/character with the motion of a reference video.' },
  { name: 'motion_graphics', kinds: ['graphics'], timeoutMs: 300_000, description: 'Generate or edit an animated motion-graphics clip from a prompt.' },
  { name: 'marketing_ad', kinds: ['ad'], timeoutMs: 900_000, description: 'Create a product ad video from reference images/videos (omni-reference).' },
  { name: 'clip_video', kinds: ['clipping'], timeoutMs: 900_000, description: 'Extract highlight clips from a long video (AI clipping).' },
  { name: 'recast', kinds: ['recast'], timeoutMs: 600_000, description: 'Swap the performer/body in a video.' },
];

const json = (obj, isError = false) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }], ...(isError ? { isError: true } : {}) });

const summarize = (e) => ({ model: e.key, name: e.name, kind: e.kind, studios: e.studios, family: e.family });

/**
 * @param {{ brand: { name: string, slug: string, prefix: string, version?: string, extraTools?: object[] }, catalog: object, client: object }} deps
 */
export function createBrandedServer({ brand, catalog, client }) {
  const p = (n) => `${brand.prefix}_${n}`;
  const server = new McpServer({ name: brand.slug, version: brand.version || '0.1.0' });

  const guard = (fn) => async (args) => {
    try {
      return await fn(args);
    } catch (err) {
      // The gateway refused a destructive/publish call for want of confirm: tell the model what would happen, as a normal answer.
      if (err?.code === 'confirm_required') return json({ status: 'confirmation_required', message: sanitizeText(err.message, brand.name) });
      const msg = err instanceof InputError || err?.code === 'BAD_INPUT' ? err.message : sanitizeText(err?.message || 'Request failed', brand.name);
      return json({ error: msg, ...(err?.status ? { status: err.status } : {}) }, true);
    }
  };

  // ---- discovery
  server.registerTool(p('list_studios'), {
    title: `${brand.name}: list studios`,
    description: `List the ${brand.name} studios available through this server and the kinds of models each offers.`,
    inputSchema: {},
  }, guard(async () => json({ studios: catalog.studios() })));

  server.registerTool(p('search_models'), {
    title: `${brand.name}: search models`,
    description: `Search ${brand.name} models by studio, kind and/or keywords. Kinds: ${catalog.kinds().join(', ')}.`,
    inputSchema: {
      query: z.string().optional().describe('Keywords, e.g. "kling pro"'),
      studio: z.string().optional().describe('Studio name from list_studios'),
      kind: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
  }, guard(async ({ query, studio, kind, limit }) => json({ models: catalog.search({ query, studio, kind, limit }).map(summarize) })));

  server.registerTool(p('get_model'), {
    title: `${brand.name}: get model`,
    description: 'Get the full input contract (fields, types, allowed values, defaults) for a model.',
    inputSchema: { model: z.string() },
  }, guard(async ({ model }) => {
    const e = catalog.get(model);
    if (!e) throw new InputError(`Unknown model "${model}".`);
    return json({ ...summarize(e), hasPrompt: e.hasPrompt, imageField: e.imageField, videoField: e.videoField, inputs: e.inputs });
  }));

  server.registerTool(p('estimate_cost'), {
    title: `${brand.name}: estimate cost`,
    description: 'Estimate the credit cost of a generation before running it.',
    inputSchema: { model: z.string(), inputs: z.record(z.any()).optional() },
  }, guard(async ({ model, inputs }) => {
    const { endpoint, payload } = catalog.buildRequest(model, inputs);
    return json(await client.estimate(endpoint, payload));
  }));

  // ---- generation
  const present = new Set(catalog.kinds());
  for (const tool of [...GENERATION_TOOLS, ...(brand.extraTools || [])]) {
    if (!tool.kinds.some((k) => present.has(k))) continue;
    server.registerTool(p(tool.name), {
      title: `${brand.name}: ${tool.name.replace(/_/g, ' ')}`,
      description: `${tool.description} Pick a model with ${p('search_models')} (kind: ${tool.kinds.join('/')}) and read its fields with ${p('get_model')}.`,
      inputSchema: {
        model: z.string().describe('Model key from search_models'),
        inputs: z.record(z.any()).describe('Model inputs, e.g. { prompt, aspect_ratio }. Media inputs must be public https URLs.'),
        wait: z.boolean().optional().describe('Wait for the result (default true). If false, or on timeout, returns a request_id for get_result.'),
      },
    }, guard(async ({ model, inputs, wait = true }) => {
      const { endpoint, payload } = catalog.buildRequest(model, inputs, tool.kinds);
      const submitted = await client.submit(endpoint, payload);
      const id = submitted.request_id || submitted.id;
      if (!id) { const text = extractText(submitted); return json({ status: 'completed', outputs: extractOutputs(submitted), ...(text !== undefined ? { text } : {}) }); }
      if (!wait) return json({ status: 'processing', request_id: id });
      return json(await client.wait(id, { timeoutMs: tool.timeoutMs }));
    }));
  }

  // ---- brand-defined tools: { name, description, input (zod shape), build(args) -> { endpoint, payload }, timeoutMs }
  // The brand supplies the request builder (so it can reuse the app's own payload code); the core submits and waits.
  for (const tool of brand.customTools || []) {
    const risk = tool.risk || 'write';
    const gated = NEEDS_CONFIRM.has(risk);
    const baseShape = tool.run ? tool.input : { ...tool.input, wait: z.boolean().optional().describe('Wait for the result (default true). If false, or on timeout, returns a request_id for get_result.') };
    server.registerTool(p(tool.name), {
      title: `${brand.name}: ${tool.name.replace(/_/g, ' ')}`,
      description: gated ? `${tool.description} [${risk === 'publish' ? 'Publishes or sends' : 'Deletes or overwrites'}: requires confirm: true.]` : tool.description,
      inputSchema: gated ? { ...baseShape, confirm: z.boolean().optional().describe('Must be true to go ahead. Without it nothing is done and you are told what would happen.') } : baseShape,
      annotations: { readOnlyHint: risk === 'read', destructiveHint: risk === 'destructive' },
    }, guard(async ({ wait = true, confirm, ...args }) => {
      if (gated && confirm !== true) return json({ status: 'confirmation_required', message: confirmMessage(tool.name.replace(/_/g, ' '), risk) });
      const c = client.scoped ? client.scoped({ confirm, tool: tool.name }) : client;
      // `run` tools drive a studio function themselves (several calls, own status protocol).
      if (tool.run) return json(await tool.run({ ...args, wait }, c));
      const { endpoint, payload } = tool.build(args);
      const submitted = await c.submit(endpoint, payload);
      const id = submitted.request_id || submitted.id;
      if (!id) return json({ status: 'completed', outputs: submitted.outputs || [] });
      if (!wait) return json({ status: 'processing', request_id: id });
      return json(await c.wait(id, { timeoutMs: tool.timeoutMs || 600_000 }));
    }));
  }

  // ---- live tabs (studios that only exist in an open browser tab)
  if (client.bridge) {
    server.registerTool(p('studio_sessions'), {
      title: `${brand.name}: open tabs`,
      description: `List the ${brand.name} browser tabs that are open, signed in, and switched on with "Let MCP control this tab", with the tools each offers. Tab tools only work while the tab stays open.`,
      inputSchema: {},
      annotations: { readOnlyHint: true },
    }, guard(async () => json(await client.scoped({ tool: 'studio_sessions' }).bridge('sessions', undefined, { method: 'GET' }))));

    server.registerTool(p('studio_call'), {
      title: `${brand.name}: run a tab tool`,
      description: 'Run one tool in an open tab (get ids from studio_sessions). Reads run silently; changes may ask the user in the tab. If the tab is slow you get a command id: poll it with studio_result. Tools that delete or publish need confirm: true.',
      inputSchema: { session: z.string().min(8).max(64), tool: z.string().min(2).max(64), args: z.record(z.any()).optional(), confirm: z.boolean().optional(), wait_seconds: z.number().int().min(0).max(25).optional() },
    }, guard(async ({ session, tool, args, confirm, wait_seconds }) => json(await client.scoped({ confirm, tool: `tab:${tool}` }).bridge('call', { session, tool, args: args || {}, wait_ms: (wait_seconds ?? 20) * 1000 }))));

    server.registerTool(p('studio_result'), {
      title: `${brand.name}: tab tool result`,
      description: 'Check a tab tool that was still running (use the id from studio_call). Optionally wait a few seconds.',
      inputSchema: { command_id: z.string().min(8).max(64), wait_seconds: z.number().int().min(0).max(25).optional() },
      annotations: { readOnlyHint: true },
    }, guard(async ({ command_id, wait_seconds }) => json(await client.scoped({ tool: 'studio_result' }).bridge(`result/${encodeURIComponent(command_id)}?wait=${(wait_seconds ?? 0) * 1000}`, undefined, { method: 'GET' }))));
  }

  // ---- jobs / account
  server.registerTool(p('get_result'), {
    title: `${brand.name}: get result`,
    description: 'Check or wait for a generation by request_id.',
    inputSchema: { request_id: z.string(), wait: z.boolean().optional(), timeout_seconds: z.number().int().min(1).max(900).optional() },
  }, guard(async ({ request_id, wait = false, timeout_seconds = 120 }) =>
    json(await client.wait(request_id, { timeoutMs: wait ? timeout_seconds * 1000 : 0 }))));

  server.registerTool(p('upload_file'), {
    title: `${brand.name}: upload file`,
    description: 'Upload a local file (path on the machine running this server) or re-host a URL, and get back a public URL usable as a media input.',
    inputSchema: { file_path: z.string().optional(), url: z.string().url().optional() },
  }, guard(async ({ file_path, url }) => {
    if (!file_path && !url) throw new InputError('Provide file_path or url.');
    return json(await client.upload({ filePath: file_path, url }));
  }));

  server.registerTool(p('account_balance'), {
    title: `${brand.name}: account balance`,
    description: `Check your ${brand.name} credit balance.`,
    inputSchema: {},
  }, guard(async () => json(await client.balance())));

  return server;
}
