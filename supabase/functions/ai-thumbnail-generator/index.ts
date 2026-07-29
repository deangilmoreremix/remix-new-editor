import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const IMG_GEN_MAINLINE_MODEL = Deno.env.get("IMG_GEN_MAINLINE_MODEL") || "gpt-4.1";
const MODEL_FALLBACK_CHAIN = [IMG_GEN_MAINLINE_MODEL, "gpt-4.1-mini", "gpt-4o"].filter(
  (m, i, arr) => arr.indexOf(m) === i
);

const PRESET_MODIFIERS: Record<string, string> = {
  cinematic: 'widescreen cinematic composition, shallow depth of field, anamorphic lens, color graded, 24fps, editorial framing',
  productCutout: 'isolated product on plain background, centered, crisp silhouette, no halos, label legible, soft contact shadow',
  lifestyle: 'lifestyle photography, warm natural light, candid moment, real-people feel, gentle color palette, inviting atmosphere',
  boldText: 'high-contrast composition, single dominant subject, large negative space for headline overlay, punchy colors, thumbnail-readable from arm\'s length',
  minimal: 'minimal composition, generous negative space, restrained palette, single subtle subject, professional restraint',
  vertical: 'vertical 9:16 framing, top-of-frame subject, lower-third space for caption, mobile-readable',
};

const PLATFORM_SPECS: Record<string, { aspectRatio: string; size: string; textOverlay: boolean; quality: string }> = {
  youtube:        { aspectRatio: '16:9',  size: '1792x1024', textOverlay: true,  quality: 'high' },
  'instagram-post': { aspectRatio: '1:1',  size: '1024x1024', textOverlay: false, quality: 'high' },
  'instagram-reel': { aspectRatio: '9:16', size: '1024x1792', textOverlay: false, quality: 'high' },
  tiktok:         { aspectRatio: '9:16',  size: '1024x1792', textOverlay: true,  quality: 'high' },
  twitter:        { aspectRatio: '16:9',  size: '1792x1024', textOverlay: true,  quality: 'medium' },
  linkedin:       { aspectRatio: '16:9',  size: '1792x1024', textOverlay: true,  quality: 'high' },
  'youtube-shorts': { aspectRatio: '9:16', size: '1024x1792', textOverlay: true,  quality: 'high' },
  pinterest:      { aspectRatio: '2:3',   size: '1024x1536', textOverlay: false, quality: 'high' },
  'tiktok-square': { aspectRatio: '1:1',  size: '1024x1024', textOverlay: true,  quality: 'high' },
};

const VIDEO_THUMBNAIL_PROMPT = 'video thumbnail sequence, cinematic frames, consistent scene progression, motion implied, broadcast quality, each frame a key moment';

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Action = "prompts" | "generate" | "refine" | "inpaint" | "save" | "brand-kit" | "platform" | "video-thumbnail";

interface BrandKit {
  brandName: string;
  primaryColor: string;
  secondaryColor: string;
  font: string;
  logoUrl?: string;
}

interface BrandKitRequest {
  action: "brand-kit";
  brandName: string;
  primaryColor: string;
  secondaryColor: string;
  font: string;
  logoUrl?: string;
}

interface PlatformRequest {
  action: "platform";
  platformKey: string;
}

interface VideoThumbnailRequest {
  action: "video-thumbnail";
  prompt: string;
  aspectRatio: string;
  duration: number;
  frames: number;
}

interface AnalyticsData {
  templateId: string;
  userId: string;
  presetKey?: string;
  platform?: string;
  brandKitUsed: boolean;
  generationTimeMs: number;
  modelUsed: string;
}

interface PromptsRequest {
  action: "prompts";
  templateId: string;
  brief?: string;
  template?: {
    name: string;
    aspectRatio?: string;
    outputType?: string;
    visualStyle?: string;
    cinematography?: string;
    niche?: string;
  };
  presetKey?: string;
  presetModifier?: string;
  brandKit?: BrandKit;
  platform?: string;
}

interface GenerateRequest {
  action: "generate";
  prompt: string;
  aspectRatio: string;
  n?: number;
  quality?: "low" | "medium" | "high" | "auto";
  style?: "vivid" | "natural";
  background?: "transparent" | "opaque" | "auto";
  outputFormat?: "png" | "webp" | "jpeg";
  outputCompression?: number;
  brandKit?: BrandKit;
  platform?: string;
}

interface RefineRequest {
  action: "refine";
  prompt: string;
  previousResponseId: string;
  size?: string;
  quality?: "low" | "medium" | "high" | "auto";
  background?: "transparent" | "opaque" | "auto";
  outputFormat?: "png" | "webp" | "jpeg";
  outputCompression?: number;
  partialImages?: number;
  store?: boolean;
  include?: string[];
  stream?: boolean;
  // Force the image_generation tool to generate, edit, or auto-decide.
  imageAction?: "generate" | "edit" | "auto";
  // Reference images — supply up to several of each kind.
  referenceImageB64?: string | string[];
  referenceImageUrl?: string | string[];
  referenceImageFileId?: string | string[];
  // Mask for in-context editing via the Responses API tool config.
  inputImageMaskB64?: string;
  inputImageMaskFileId?: string;
  imageDetail?: "low" | "high" | "original" | "auto";
  brandKit?: BrandKit;
  platform?: string;
}

interface InpaintRequest {
  action: "inpaint";
  prompt: string;
  imageB64: string;
  maskB64: string;
  aspectRatio?: string;
  quality?: "low" | "medium" | "high" | "auto";
  style?: "vivid" | "natural";
  background?: "transparent" | "opaque" | "auto";
  outputFormat?: "png" | "webp" | "jpeg";
}

interface SaveRequest {
  action: "save";
  templateId: string;
  imageB64: string;
  altText: string;
  userId: string;
  promptUsed: string;
  presetKey?: string;
  controls?: {
    quality?: string;
    style?: string;
    background?: string;
    outputFormat?: string;
    outputCompression?: number;
    aspectRatio?: string;
  };
  brandKit?: BrandKit;
  platform?: string;
  generationTimeMs?: number;
  modelUsed?: string;
}

type RequestBody = PromptsRequest | GenerateRequest | RefineRequest | InpaintRequest | SaveRequest | BrandKitRequest | PlatformRequest | VideoThumbnailRequest;

function validateBody(body: unknown): RequestBody {
  if (!body || typeof body !== "object") throw new Error("Invalid body");
  const b = body as Record<string, unknown>;
  const action = b.action as Action;
  if (!action || !["prompts", "generate", "refine", "inpaint", "save", "brand-kit", "platform", "video-thumbnail"].includes(action)) {
    throw new Error("Missing or invalid action");
  }
  return body as RequestBody;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapAspectToSize(ratio: string): string {
  const map: Record<string, string> = {
    "16:9": "1792x1024",
    "9:16": "1024x1792",
    "1:1": "1024x1024",
    "4:5": "1024x1280",
    "3:2": "1536x1024",
    "2:3": "1024x1536",
    "2:1": "2048x1024",
    "21:9": "2048x882",
    "auto": "auto",
  };
  return map[ratio] || "1024x1024";
}

function buildPromptBrief(
  name: string,
  opts?: { visualStyle?: string; cinematography?: string; niche?: string; aspectRatio?: string; outputType?: string }
): string {
  const lines: string[] = [
    `Template: ${name}`,
    opts?.visualStyle ? `Visual style: ${opts.visualStyle}` : null,
    opts?.cinematography ? `Cinematography: ${opts.cinematography}` : null,
    opts?.niche ? `Niche: ${opts.niche}` : null,
    `Aspect ratio: ${opts?.aspectRatio || "16:9"}`,
    `Output type: ${opts?.outputType || "video"}`,
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

function BRAND_KIT_PROMPT_INJECTION(brandKit?: BrandKit): string {
  if (!brandKit) return "";
  const lines: string[] = [
    "BRAND GUIDELINES:",
    `- Brand: ${brandKit.brandName}`,
    `- Primary color: ${brandKit.primaryColor}`,
    `- Secondary color: ${brandKit.secondaryColor}`,
    `- Font: ${brandKit.font}`,
  ];
  if (brandKit.logoUrl) {
    lines.push(`- Logo: ${brandKit.logoUrl} (incorporate brand identity subtly)`);
  }
  return lines.join("\n");
}

function PLATFORM_INJECTION(platformKey?: string): string {
  if (!platformKey || !PLATFORM_SPECS[platformKey]) return "";
  const spec = PLATFORM_SPECS[platformKey];
  return `PLATFORM: ${platformKey} (${spec.aspectRatio}${spec.textOverlay ? ", text overlay required" : ""})`;
}

async function uploadBufferToStorage(
  buffer: Uint8Array,
  path: string,
  contentType = "image/webp"
): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error: uploadErr } = await supabase.storage
    .from("template-thumbnails")
    .upload(path, buffer, { contentType, upsert: true });

  if (uploadErr) throw uploadErr;

  const { data } = supabase.storage.from("template-thumbnails").getPublicUrl(path);
  return data.publicUrl;
}

async function persistThumbnailRow(params: {
  templateId: string;
  imagePath: string;
  promptUsed: string;
  altText: string;
  userId: string;
}): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("thumbnails")
    .upsert(
      {
        target_type: "template",
        target_id: params.templateId,
        image_path: params.imagePath,
        prompt_used: params.promptUsed,
        alt_text: params.altText,
        user_id: params.userId,
        is_custom: true,
      },
      { onConflict: "user_id, target_id" }
    );
  if (error) console.error("[ai-thumbnail-generator] persist error", error);
}

async function persistJob(params: {
  templateId: string;
  userId: string;
  presetKey?: string;
  promptUsed: string;
  imageUrl: string;
  imagePath: string;
  status: "draft" | "completed" | "archived";
}): Promise<void> {
  if (!supabase) return;
  const row: Record<string, unknown> = {
    template_id: params.templateId,
    user_id: params.userId,
    preset_key: params.presetKey || null,
    prompt_used: params.promptUsed,
    image_url: params.imageUrl,
    image_path: params.imagePath,
    status: params.status,
  };
  if (params.status === "completed") row.completed_at = new Date().toISOString();
  const { error } = await supabase.from("template_thumbnail_jobs").insert(row);
  if (error) console.error("[ai-thumbnail-generator] job persist error", error);
}

async function insertAnalytics(data: AnalyticsData): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("thumbnail_analytics").insert({
    template_id: data.templateId,
    user_id: data.userId,
    preset_key: data.presetKey || null,
    platform: data.platform || null,
    brand_kit_used: data.brandKitUsed,
    generation_time_ms: data.generationTimeMs,
    model_used: data.modelUsed,
  });
  if (error) console.error("[ai-thumbnail-generator] analytics error", error);
}

async function base64ToUint8Array(b64: string): Promise<Uint8Array> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Extract a user-facing hint from a moderation-blocked error, following
 * OpenAI's recommended pattern. Returns null if the error is not a
 * moderation block so callers can fall back to their generic message.
 */
function moderationHint(error: unknown): string | null {
  const code = (error as { code?: string })?.code;
  if (code !== "moderation_blocked") return null;

  const details = (error as { moderation_details?: { categories?: string[]; moderation_stage?: string } })
    .moderation_details;
  const categories = details?.categories ?? [];
  const stage = details?.moderation_stage;

  let hint =
    "This request could not be completed because it did not meet safety requirements.";

  if (categories.includes("harassment")) {
    hint =
      "Try removing abusive or targeting language and focus on neutral visual details instead.";
  } else if (stage === "input") {
    hint =
      "Try revising the prompt or input images and submit the request again.";
  } else if (stage === "output") {
    hint =
      "The generated result was blocked by a safety check. Try changing the prompt and generating again.";
  }

  return hint;
}

async function executeWithModelFallback<T>(
  makeRequest: (model: string) => Promise<T>,
  models = MODEL_FALLBACK_CHAIN
): Promise<T> {
  let lastError: Error | undefined;
  for (const model of models) {
    try {
      console.log(`[ai-thumbnail-generator] Trying model: ${model}`);
      return await makeRequest(model);
    } catch (error) {
      const status = (error as { status?: number })?.status;
      const isRetryable = status === 429 || status === 503;
      console.warn(`[ai-thumbnail-generator] Model ${model} failed with status ${status || 'unknown'}`);
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!isRetryable) break;
    }
  }
  throw lastError ?? new Error("All models failed");
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function handlePrompts(body: PromptsRequest) {
  if (!openai) return jsonResponse({ error: "Server not configured" }, 500);

  let aspectRatio = body.template?.aspectRatio || "16:9";
  if (body.platform && PLATFORM_SPECS[body.platform]) {
    aspectRatio = PLATFORM_SPECS[body.platform].aspectRatio;
  }

  const baseBrief =
    body.brief ||
    buildPromptBrief(body.template?.name || body.templateId, {
      visualStyle: body.template?.visualStyle,
      cinematography: body.template?.cinematography,
      niche: body.template?.niche,
      aspectRatio,
      outputType: body.template?.outputType || "video",
    });

  const modifier = body.presetKey && PRESET_MODIFIERS[body.presetKey]
    ? body.presetModifier || PRESET_MODIFIERS[body.presetKey]
    : "";

  const brief = modifier ? `${baseBrief}\n\nStyle direction: ${modifier}` : baseBrief;

  const brandInjection = BRAND_KIT_PROMPT_INJECTION(body.brandKit);
  const platformInjection = PLATFORM_INJECTION(body.platform);

  let systemInstruction = `You are a thumbnail prompt engineer for gpt-image-2.
Using the template context below, write 3 DISTINCT thumbnail prompts.
Each prompt must:
- Lead with a single hero subject/scene
- Include 3-5 cinematic modifiers (lighting, lens, palette, mood)
- End with quality/style tokens (e.g. "editorial, 4K, high contrast")
- AVOID text, logos, watermarks, UI elements`;

  if (brandInjection) {
    systemInstruction += `\n\n${brandInjection}\n\nIf brand logo is provided, incorporate it subtly. Otherwise, continue to avoid logos.`;
  }

  if (platformInjection) {
    systemInstruction += `\n\n${platformInjection}`;
  }

  systemInstruction += `\n\nReturn JSON matching the provided schema.`;

  const userInstruction = `TEMPLATE CONTEXT:\n${brief}`;

  const promptVariantsSchema = {
    type: "object",
    properties: {
      prompts: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "string", minLength: 20 },
      },
    },
    required: ["prompts"],
    additionalProperties: false,
  };

  try {
    const completion = await executeWithModelFallback(async (model) => {
      return await openai!.responses.create({
        model,
        instructions: systemInstruction,
        input: userInstruction,
        store: true,
        text: {
          format: {
            type: "json_schema",
            name: "thumbnail_prompt_variants",
            strict: true,
            schema: promptVariantsSchema,
          },
        },
      });
    });

    let parsed: { prompts?: string[] } = {};
    const text = (completion.output_text as string) || "";
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { prompts: [] };
    }

    return jsonResponse({
      variants: parsed.prompts || [],
      response_id: completion.id,
      model_used: completion.model,
    });
  } catch (error) {
    const hint = moderationHint(error);
    return jsonResponse({
      error: hint ?? (error instanceof Error ? error.message : "Prompt generation failed"),
      ...(hint ? { moderation_blocked: true } : {}),
    }, 502);
  }
}

async function handleGenerate(body: GenerateRequest) {
  if (!OPENAI_API_KEY) return jsonResponse({ error: "Server not configured" }, 500);

  let aspectRatio = body.aspectRatio;
  let size = mapAspectToSize(aspectRatio);
  let quality = body.quality || "high";

  if (body.platform && PLATFORM_SPECS[body.platform]) {
    const spec = PLATFORM_SPECS[body.platform];
    aspectRatio = spec.aspectRatio;
    size = spec.size;
    quality = spec.quality as "low" | "medium" | "high" | "auto";
  }

  const brandInjection = BRAND_KIT_PROMPT_INJECTION(body.brandKit);
  const prompt = brandInjection ? `${body.prompt}\n\n${brandInjection}` : body.prompt;

  const n = Math.min(body.n || 3, 3);
  const style = body.style || "vivid";
  const background = body.background === "transparent" ? "auto" : (body.background || "auto");
  const outputFormat = body.outputFormat || "webp";
  const outputCompression = body.outputCompression ?? 80;

  try {
    const result = await openai!.images.generate({
      model: "gpt-image-2",
      prompt,
      n,
      size,
      quality,
      style,
      background,
      output_format: outputFormat,
      output_compression: outputCompression,
      response_format: "b64_json",
      moderation: "auto",
    });

    const candidates = result.data.map((img) => ({
      b64_json: img.b64_json,
      revised_prompt: (img as { revised_prompt?: string }).revised_prompt ?? "",
    }));

    return jsonResponse({ candidates, params: { quality, style, background, outputFormat, outputCompression, size } });
  } catch (error) {
    const hint = moderationHint(error);
    return jsonResponse({
      error: hint ?? (error instanceof Error ? error.message : "Image generation failed"),
      ...(hint ? { moderation_blocked: true } : {}),
    }, 502);
  }
}

function buildRefineReqBody(body: RefineRequest, model = IMG_GEN_MAINLINE_MODEL): Record<string, unknown> {
  const imageGenTool: Record<string, unknown> = { type: "image_generation" };
  if (body.size) imageGenTool.size = body.size;
  if (body.quality) imageGenTool.quality = body.quality;
  if (body.background) {
    imageGenTool.background = body.background === "transparent" ? "auto" : body.background;
  }
  if (body.outputFormat) imageGenTool.output_format = body.outputFormat;
  if (typeof body.outputCompression === "number") imageGenTool.output_compression = body.outputCompression;
  if (typeof body.partialImages === "number" && body.partialImages > 0) {
    imageGenTool.partial_images = Math.min(body.partialImages, 3);
  }
  // Force generate / edit / auto — mirrors the official Responses API example.
  if (body.imageAction) imageGenTool.action = body.imageAction;

  // Build the input content. Supports multiple reference images of each kind.
  const userContent: Array<Record<string, unknown>> = [
    { type: "input_text", text: body.prompt },
  ];

  const pushImage = (entry: Record<string, unknown>) => {
    if (userContent.length < 10) userContent.push(entry);
  };

  const addB64Images = (b64?: string | string[], detail = "auto") => {
    if (!b64) return;
    const items = Array.isArray(b64) ? b64 : [b64];
    for (const b of items) {
      pushImage({
        type: "input_image",
        image_url: `data:image/png;base64,${b}`,
        detail,
      });
    }
  };
  const addUrlImages = (url?: string | string[], detail = "auto") => {
    if (!url) return;
    const items = Array.isArray(url) ? url : [url];
    for (const u of items) {
      pushImage({
        type: "input_image",
        image_url: u,
        detail,
      });
    }
  };
  const addFileIdImages = (fileId?: string | string[], detail = "auto") => {
    if (!fileId) return;
    const items = Array.isArray(fileId) ? fileId : [fileId];
    for (const fid of items) {
      pushImage({
        type: "input_image",
        file_id: fid,
        detail,
      });
    }
  };

  addB64Images(body.referenceImageB64, body.imageDetail || "auto");
  addUrlImages(body.referenceImageUrl, body.imageDetail || "auto");
  addFileIdImages(body.referenceImageFileId, body.imageDetail || "auto");

  // Mask editing via the Responses API tool config (preferred for in-context refine).
  if (body.inputImageMaskFileId) {
    imageGenTool.input_image_mask = { file_id: body.inputImageMaskFileId };
  } else if (body.inputImageMaskB64) {
    imageGenTool.input_image_mask = {
      image_url: `data:image/png;base64,${body.inputImageMaskB64}`,
    };
  }

  const reqBody: Record<string, unknown> = {
    model,
    input: [{ role: "user", content: userContent }],
    tools: [imageGenTool],
  };
  if (body.previousResponseId) reqBody.previous_response_id = body.previousResponseId;
  if (typeof body.store === "boolean") reqBody.store = body.store;
  if (Array.isArray(body.include) && body.include.length > 0) reqBody.include = body.include;
  return reqBody;
}

function extractImageResult(completion: { output: Array<{ type?: string; result?: string; revised_prompt?: string }>; id: string }) {
  const imageCalls = completion.output.filter((o) => o.type === "image_generation_call");
  const first = imageCalls[0];
  return {
    b64_json: first?.result ?? "",
    revised_prompt: first?.revised_prompt ?? "",
    response_id: completion.id,
  };
}

async function handleRefine(body: RefineRequest) {
  if (!openai) return jsonResponse({ error: "Server not configured" }, 500);

  try {
    const result = await executeWithModelFallback(async (model) => {
      const completion = await openai!.responses.create(buildRefineReqBody(body, model) as Parameters<typeof openai.responses.create>[0]);
      return extractImageResult(completion as never);
    });
    return jsonResponse({ result });
  } catch (error) {
    const hint = moderationHint(error);
    return jsonResponse({
      error: hint ?? (error instanceof Error ? error.message : "Refine failed"),
      ...(hint ? { moderation_blocked: true } : {}),
    }, 502);
  }
}

function streamRefine(body: RefineRequest): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        if (!openai) throw new Error("Server not configured");
        const run = openai.responses.stream(buildRefineReqBody(body) as Parameters<typeof openai.responses.stream>[0]);
        run.on("response.image_generation_call.partial_image", (ev: { partial_image_b64?: string }) => {
          if (ev?.partial_image_b64) send({ type: "partial", b64: ev.partial_image_b64 });
        });
        const completion = await run.finalResponse();
        send({ type: "done", result: extractImageResult(completion as never) });
      } catch (err) {
        const hint = moderationHint(err);
        send({
          type: "error",
          message: hint ?? (err instanceof Error ? err.message : "Refine stream failed"),
          ...(hint ? { moderation_blocked: true } : {}),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function handleInpaint(body: InpaintRequest) {
  if (!OPENAI_API_KEY) return jsonResponse({ error: "Server not configured" }, 500);

  const size = mapAspectToSize(body.aspectRatio || "16:9");
  const quality = body.quality || "high";
  const style = body.style || "vivid";
  const background = body.background === "transparent" ? "auto" : (body.background || "auto");
  const outputFormat = body.outputFormat || "webp";

  try {
    const imageBytes = await base64ToUint8Array(body.imageB64);
    const maskBytes = await base64ToUint8Array(body.maskB64);

    const imageBlob = new Blob([imageBytes], { type: "image/png" });
    const maskBlob = new Blob([maskBytes], { type: "image/png" });

    const result = await openai!.images.edit({
      model: "gpt-image-2",
      image: imageBlob,
      mask: maskBlob,
      prompt: body.prompt,
      n: 1,
      size,
      quality,
      style,
      background,
      output_format: outputFormat,
      response_format: "b64_json",
    });

    const img = result.data[0];
    return jsonResponse({
      result: {
        b64_json: img.b64_json,
        revised_prompt: (img as { revised_prompt?: string }).revised_prompt ?? "",
        response_id: "",
      },
      params: { quality, style, background, outputFormat, size },
    });
  } catch (error) {
    const hint = moderationHint(error);
    return jsonResponse({
      error: hint ?? (error instanceof Error ? error.message : "Inpaint failed"),
      ...(hint ? { moderation_blocked: true } : {}),
    }, 502);
  }
}

async function handleBrandKit(_body: BrandKitRequest) {
  return jsonResponse({
    message: "Brand kit received",
    brandName: _body.brandName,
    primaryColor: _body.primaryColor,
    secondaryColor: _body.secondaryColor,
    font: _body.font,
    logoUrl: _body.logoUrl || null,
  });
}

async function handlePlatform(body: PlatformRequest) {
  const spec = PLATFORM_SPECS[body.platformKey];
  if (!spec) {
    return jsonResponse({ error: `Unknown platform: ${body.platformKey}` }, 400);
  }
  return jsonResponse({ platform: body.platformKey, specs: spec });
}

async function handleVideoThumbnail(body: VideoThumbnailRequest) {
  if (!openai) return jsonResponse({ error: "Server not configured" }, 500);

  const size = mapAspectToSize(body.aspectRatio);
  const frameCount = Math.max(1, Math.min(body.frames, 10));
  const frames: Array<{ b64: string; prompt: string }> = [];

  for (let i = 0; i < frameCount; i++) {
    const framePrompt = `${body.prompt}, ${VIDEO_THUMBNAIL_PROMPT}, frame ${i + 1} of ${frameCount}`;
    try {
      const frame = await executeWithModelFallback(async (model) => {
        const completion = await openai!.responses.create({
          model,
          input: [{ role: "user", content: [{ type: "input_text", text: framePrompt }] }],
          tools: [{ type: "image_generation", size }],
        });
        const imageCalls = completion.output.filter((o) => o.type === "image_generation_call");
        const first = imageCalls[0];
        return {
          b64: first?.result ?? "",
          prompt: framePrompt,
        };
      });
      frames.push(frame);
    } catch (error) {
      console.error(`[ai-thumbnail-generator] Frame ${i + 1} generation failed:`, error);
      frames.push({ b64: "", prompt: framePrompt });
    }
  }

  return jsonResponse({ frames, duration: body.duration, aspectRatio: body.aspectRatio });
}

async function handleSave(body: SaveRequest) {
  if (!supabase) return jsonResponse({ error: "Supabase not configured" }, 500);

  const startTime = Date.now();

  try {
    const imageBuffer = await base64ToUint8Array(body.imageB64);
    const filename = `${body.templateId}/${crypto.randomUUID()}.${body.controls?.outputFormat || "webp"}`;
    const imageUrl = await uploadBufferToStorage(imageBuffer, filename);

    await persistThumbnailRow({
      templateId: body.templateId,
      imagePath: imageUrl,
      promptUsed: body.promptUsed,
      altText: body.altText || body.templateId,
      userId: body.userId,
    });

    await persistJob({
      templateId: body.templateId,
      userId: body.userId,
      presetKey: body.presetKey,
      promptUsed: body.promptUsed,
      imageUrl,
      imagePath: filename,
      status: "completed",
    });

    const generationTimeMs = Date.now() - startTime;

    await insertAnalytics({
      templateId: body.templateId,
      userId: body.userId,
      presetKey: body.presetKey,
      platform: body.platform,
      brandKitUsed: !!body.brandKit,
      generationTimeMs,
      modelUsed: body.modelUsed || IMG_GEN_MAINLINE_MODEL,
    });

    return jsonResponse({
      imageUrl,
      path: filename,
      job: {
        templateId: body.templateId,
        presetKey: body.presetKey,
        controls: body.controls,
        completedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Save failed" }, 502);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  try {
    const parsed = validateBody(body);
    switch (parsed.action) {
      case "prompts":
        return handlePrompts(parsed as PromptsRequest);
      case "generate":
        return handleGenerate(parsed as GenerateRequest);
      case "refine":
        if ((parsed as RefineRequest).stream) return streamRefine(parsed as RefineRequest);
        return handleRefine(parsed as RefineRequest);
      case "inpaint":
        return handleInpaint(parsed as InpaintRequest);
      case "save":
        return handleSave(parsed as SaveRequest);
      case "brand-kit":
        return handleBrandKit(parsed as BrandKitRequest);
      case "platform":
        return handlePlatform(parsed as PlatformRequest);
      case "video-thumbnail":
        return handleVideoThumbnail(parsed as VideoThumbnailRequest);
      default:
        const r = parsed as Record<string, string>;
        return jsonResponse({ error: `Unknown action ${r.action}` }, 400);
    }
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
