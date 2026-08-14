import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai";

const OPENAI_IMAGE_MODELS = new Set(['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini']);

function isOpenAIImageModel(modelId: string): boolean {
  return OPENAI_IMAGE_MODELS.has(modelId);
}

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

/**
 * Build an OpenAI client for the current request.
 *
 * The user may have entered their own OpenAI API key in the in-app
 * Settings / API modal (see `apiKeyManager` on the client). When the
 * client forwards that key in the request body (or multipart form)
 * under the field name `apiKey`, we use it for the OpenAI calls so
 * the generation is charged to the user rather than to the server's
 * shared env key.
 *
 * Falls back to the server's `OPENAI_API_KEY` env var if no user key
 * is provided, and to a 500 if neither is available.
 *
 * Returns { client, usedUserKey } so handlers can report which key
 * was used back to the client.
 */
function getOpenAIClient(userKey?: string | null): { client: OpenAI; usedUserKey: boolean; source: "user" | "server" } {
  if (userKey && typeof userKey === "string" && userKey.startsWith("sk-")) {
    return { client: new OpenAI({ apiKey: userKey }), usedUserKey: true, source: "user" };
  }
  if (OPENAI_API_KEY) {
    return { client: new OpenAI({ apiKey: OPENAI_API_KEY }), usedUserKey: false, source: "server" };
  }
  throw new Error("No OpenAI API key available — set OPENAI_API_KEY on the server or provide one in the request body");
}

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

// The Supabase admin client is per-process (uses the service role key) and
// doesn't depend on the user's OpenAI key, so it can stay a singleton.
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Action = "prompts" | "generate" | "refine" | "inpaint" | "save" | "brand-kit" | "platform" | "video-thumbnail" | "upload-reference" | "recommend-templates" | "surprise-me";

interface RecommendTemplatesRequest {
  action: "recommend-templates";
  context: {
    postText?: string;
    title?: string;
    platforms?: string[];
    mediaType?: string;
    hasPersonReference?: boolean;
    hasProductReference?: boolean;
    aspectRatio?: string;
  };
  apiKey?: string;
}

interface SurpriseMeRequest {
  action: "surprise-me";
  context: {
    postText?: string;
    title?: string;
    platforms?: string[];
    mediaType?: string;
    hasPersonReference?: boolean;
    hasProductReference?: boolean;
    aspectRatio?: string;
  };
  apiKey?: string;
}

interface RecommendTemplatesResponse {
  recommended: Array<{
    templateId: string;
    score: number;
    reason: string;
  }>;
}

interface SurpriseMeResponse {
  concept: {
    name: string;
    concept: string;
    headline: string;
    requiresReference: boolean;
    referenceType?: string | null;
    aspectRatio: string;
    imagePrompt: string;
    fields: Record<string, unknown>;
  };
}

interface UploadReferenceRequest {
  action: "upload-reference";
  purpose?: string;
}

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
  apiKey?: string;
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
  // User-supplied OpenAI key (forwarded from client apiKeyManager).
  apiKey?: string;
}

interface GenerateRequest {
  action: "generate";
  prompt: string;
  aspectRatio: string;
  // Explicit model override. Defaults to "gpt-image-2" in handleGenerate.
  model?: string;
  size?: string;
  // Number of candidates. gpt-image-2 supports up to 10.
  n?: number;
  quality?: "low" | "medium" | "high" | "auto";
  style?: "vivid" | "natural";
  background?: "transparent" | "opaque" | "auto";
  outputFormat?: "png" | "webp" | "jpeg";
  outputCompression?: number;
  // gpt-image-2 always processes at high fidelity; older models can use
  // low | medium | high. The Image API ignores this for gpt-image-2.
  inputFidelity?: "low" | "medium" | "high";
  moderation?: "auto" | "low";
  partialImages?: number;
  stream?: boolean;
  // OpenAI abuse-tracking identifier (any string ≤ 64 chars).
  user?: string;
  brandKit?: BrandKit;
  platform?: string;
  // User-supplied OpenAI key.
  apiKey?: string;
}

interface RefineRequest {
  action: "refine";
  prompt: string;
  previousResponseId: string;
  size?: string;
  quality?: "low" | "medium" | "high" | "auto";
  style?: "vivid" | "natural";
  background?: "transparent" | "opaque" | "auto";
  outputFormat?: "png" | "webp" | "jpeg";
  outputCompression?: number;
  moderation?: "auto" | "low";
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
  // Pin a specific mainline Responses model (overrides fallback chain).
  responsesModel?: string;
  // Pin a specific GPT Image model (for the image_generation tool).
  model?: string;
  // gpt-image-2 always uses high input fidelity; older models honor this.
  inputFidelity?: "low" | "medium" | "high";
  // OpenAI abuse-tracking identifier.
  user?: string;
  // User-supplied OpenAI key.
  apiKey?: string;
}

interface InpaintRequest {
  action: "inpaint";
  prompt: string;
  imageB64: string;
  maskB64: string;
  aspectRatio?: string;
  model?: string;
  size?: string;
  quality?: "low" | "medium" | "high" | "auto";
  style?: "vivid" | "natural";
  background?: "transparent" | "opaque" | "auto";
  outputFormat?: "png" | "webp" | "jpeg";
  outputCompression?: number;
  inputFidelity?: "low" | "medium" | "high";
  // Extra reference images for the edits endpoint (single value or array).
  referenceImageB64?: string | string[];
  user?: string;
  apiKey?: string;
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

type RequestBody = PromptsRequest | GenerateRequest | RefineRequest | InpaintRequest | SaveRequest | BrandKitRequest | PlatformRequest | VideoThumbnailRequest | UploadReferenceRequest | RecommendTemplatesRequest | SurpriseMeRequest;

function validateBody(body: unknown): RequestBody {
  if (!body || typeof body !== "object") throw new Error("Invalid body");
  const b = body as Record<string, unknown>;
  const action = b.action as Action;
  if (!action || !["prompts", "generate", "refine", "inpaint", "save", "brand-kit", "platform", "video-thumbnail", "recommend-templates", "surprise-me"].includes(action)) {
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

// Allowed sizes per model. gpt-image-2 supports any valid resolution
// (edges multiples of 16, long/short ratio <= 3:1, 655,360 ≤ pixels ≤ 8,294,400);
// the older gpt-image-1.x models only support the three legacy fixed sizes
// plus "auto".
const MODEL_ALLOWED_SIZES: Record<string, string[]> = {
  "gpt-image-2": ["any"], // server-side we validate on demand
  "gpt-image-1.5": ["1024x1024", "1536x1024", "1024x1536", "auto"],
  "gpt-image-1": ["1024x1024", "1536x1024", "1024x1536", "auto"],
  "gpt-image-1-mini": ["1024x1024", "1536x1024", "1024x1536", "auto"],
};

function getModelAllowedSizes(model: string): string[] {
  return MODEL_ALLOWED_SIZES[model] || MODEL_ALLOWED_SIZES["gpt-image-2"];
}

function isSizeAllowedForModel(model: string, size: string): boolean {
  const allowed = getModelAllowedSizes(model);
  if (allowed.includes("any")) return true;
  return allowed.includes(size);
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
  let openai: OpenAI;
  let keySource: "user" | "server";
  try {
    const res = getOpenAIClient(body.apiKey);
    openai = res.client;
    keySource = res.source;
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Server not configured" }, 500);
  }

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
      return await openai.responses.create({
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
      key_source: keySource,
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
  let openai: OpenAI;
  let keySource: "user" | "server";
  try {
    const res = getOpenAIClient(body.apiKey);
    openai = res.client;
    keySource = res.source;
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Server not configured" }, 500);
  }

  const model = body.model || "gpt-image-2";

  if (isOpenAIImageModel(model)) {
    return handleGenerateOpenAI(body, model, openai, keySource);
  }

  return handleGenerateMuapi(body, model, keySource);
}

// ---------------------------------------------------------------------------
// OpenAI Images API path (gpt-image-2, 1.5, 1, 1-mini)
// ---------------------------------------------------------------------------

async function handleGenerateOpenAI(
  body: GenerateRequest,
  model: string,
  openai: OpenAI,
  keySource: "user" | "server"
) {
  const isGptImage2 = model === "gpt-image-2";

  let aspectRatio = body.aspectRatio;
  let size = body.size || mapAspectToSize(aspectRatio);
  let quality = body.quality || "high";

  if (body.platform && PLATFORM_SPECS[body.platform]) {
    const spec = PLATFORM_SPECS[body.platform];
    aspectRatio = spec.aspectRatio;
    if (!body.size) size = spec.size;
    quality = spec.quality as "low" | "medium" | "high" | "auto";
  }

  if (!isGptImage2 && size !== "auto" && !isSizeAllowedForModel(model, size)) {
    return jsonResponse({
      error: `Size ${size} not supported by ${model}. Allowed: ${getModelAllowedSizes(model).join(", ")}`,
    }, 400);
  }

  const brandInjection = BRAND_KIT_PROMPT_INJECTION(body.brandKit);
  const prompt = brandInjection ? `${body.prompt}\n\n${brandInjection}` : body.prompt;

  const maxN = isGptImage2 ? 10 : 4;
  const n = Math.min(Math.max(body.n || 3, 1), maxN);

  const style = isGptImage2 ? (body.style || "vivid") : undefined;
  const background = !isGptImage2 && body.background === "transparent"
    ? "transparent"
    : (body.background === "transparent" ? "auto" : (body.background || "auto"));
  const outputFormat = body.outputFormat || "webp";
  const outputCompression = body.outputCompression ?? 80;
  const moderation = body.moderation || "auto";
  const inputFidelity = isGptImage2 ? undefined : (body.inputFidelity || "high");

  if (body.stream) {
    return streamGenerate({
      prompt, model, n, size, quality,
      style: style as "vivid" | "natural" | undefined,
      background, outputFormat, outputCompression, moderation,
      inputFidelity, partialImages: body.partialImages ?? 0,
      user: body.user, keySource, openai,
    });
  }

  try {
    const generatePayload: Record<string, unknown> = {
      model, prompt, n, size, quality, background,
      output_format: outputFormat, output_compression: outputCompression,
      response_format: "b64_json", moderation,
    };
    if (style) generatePayload.style = style;
    if (inputFidelity) generatePayload.input_fidelity = inputFidelity;
    if (body.user) generatePayload.user = body.user;

    const result = await openai.images.generate(generatePayload as Parameters<typeof OpenAI.prototype.images.generate>[0]);

    const candidates = result.data.map((img) => ({
      b64_json: img.b64_json,
      revised_prompt: (img as { revised_prompt?: string }).revised_prompt ?? "",
    }));

    return jsonResponse({
      candidates,
      params: { quality, style, background, outputFormat, outputCompression, size, moderation },
      key_source: keySource,
      model_used: model,
    });
  } catch (error) {
    const hint = moderationHint(error);
    return jsonResponse({
      error: hint ?? (error instanceof Error ? error.message : "Image generation failed"),
      ...(hint ? { moderation_blocked: true } : {}),
    }, 502);
  }
}

// ---------------------------------------------------------------------------
// muapi-proxy path (all non-OpenAI models)
// ---------------------------------------------------------------------------

async function handleGenerateMuapi(
  body: GenerateRequest,
  model: string,
  keySource: "user" | "server"
) {
  const muapiKey = body.muapi_api_key || Deno.env.get("MUAPI_API_KEY");
  if (!muapiKey) {
    return jsonResponse({
      error: "Muapi API key required for this model. Set MUAPI_API_KEY on the server or provide muapi_api_key in the request.",
    }, 500);
  }

  const endpoint = normalizeLegacyEndpoint(model);
  const params: Record<string, unknown> = {
    prompt: body.prompt,
  };
  if (body.n) params.n = body.n;
  if (body.aspectRatio) params.aspect_ratio = body.aspectRatio;
  if (body.size) params.size = body.size;
  if (body.quality) params.quality = body.quality;

  const proxyUrl = `${SUPABASE_URL}/functions/v1/muapi-proxy`;

  let proxyRes: Response;
  try {
    proxyRes = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY || "",
      },
      body: JSON.stringify({
        endpoint,
        params,
        muapi_api_key: muapiKey,
        generationType: "image",
      }),
    });
  } catch (err) {
    return jsonResponse({
      error: `Failed to reach muapi-proxy: ${err instanceof Error ? err.message : "network error"}`,
    }, 502);
  }

  if (!proxyRes.ok) {
    let detail = "";
    try { detail = await proxyRes.text(); } catch { /* ignore */ }
    return jsonResponse({
      error: `muapi-proxy error (${proxyRes.status}): ${detail || proxyRes.statusText}`,
    }, 502);
  }

  let muapiResult: Record<string, unknown>;
  try {
    muapiResult = await proxyRes.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON response from muapi-proxy" }, 502);
  }

  const images = (muapiResult.images || muapiResult.data || []) as Array<Record<string, unknown>>;
  const candidates = images.map((img) => ({
    b64_json: (img.b64 as string) || (img.base64 as string) || "",
    revised_prompt: (img.revised_prompt as string) || "",
  }));

  return jsonResponse({
    candidates,
    params: { size: body.size, quality: body.quality, aspectRatio: body.aspectRatio },
    key_source: keySource,
    model_used: model,
  });
}

function streamGenerate(opts: {
  prompt: string;
  model: string;
  n: number;
  size: string;
  quality: "low" | "medium" | "high" | "auto";
  style: "vivid" | "natural" | undefined;
  background: "auto" | "opaque" | "transparent";
  outputFormat: "png" | "webp" | "jpeg";
  outputCompression: number;
  moderation: "auto" | "low";
  inputFidelity?: "low" | "medium" | "high";
  partialImages: number;
  user?: string;
  keySource: "user" | "server";
  openai: OpenAI;
}): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        if (!opts.openai) throw new Error("Server not configured");
        // Build streaming payload conditionally.
        const streamPayload: Record<string, unknown> = {
          model: opts.model,
          prompt: opts.prompt,
          n: opts.n,
          size: opts.size,
          quality: opts.quality,
          background: opts.background,
          output_format: opts.outputFormat,
          output_compression: opts.outputCompression,
          response_format: "b64_json",
          moderation: opts.moderation,
          stream: true,
          partial_images: Math.max(0, Math.min(opts.partialImages, 3)),
        };
        if (opts.style) streamPayload.style = opts.style;
        if (opts.inputFidelity) streamPayload.input_fidelity = opts.inputFidelity;
        if (opts.user) streamPayload.user = opts.user;

        const run = opts.openai.images.generate(streamPayload as Parameters<typeof OpenAI.prototype.images.generate>[0]);

        const candidates: Array<{ b64_json: string; revised_prompt: string }> = [];
        for await (const event of run as AsyncIterable<unknown>) {
          const e = event as { type?: string; b64_json?: string; partial_image_index?: number; partial_image_b64?: string; revised_prompt?: string };
          if (e.type === "image_generation.partial_image") {
            const b64 = e.partial_image_b64 ?? e.b64_json;
            if (b64) send({ type: "partial", b64, index: e.partial_image_index });
          } else if (e.type === "image_generation.completed" || e.type === "image_generation") {
            // Some SDK versions emit the final b64 on the terminal event.
            if (e.b64_json) {
              candidates.push({ b64_json: e.b64_json, revised_prompt: e.revised_prompt ?? "" });
            }
          }
        }

        if (candidates.length === 0) {
          // Fall back to a non-streaming call if the streamed events never
          // produced a final b64 (older SDKs sometimes only send partials).
          const fallback: Record<string, unknown> = {
            model: opts.model,
            prompt: opts.prompt,
            n: opts.n,
            size: opts.size,
            quality: opts.quality,
            background: opts.background,
            output_format: opts.outputFormat,
            output_compression: opts.outputCompression,
            response_format: "b64_json",
            moderation: opts.moderation,
          };
          if (opts.style) fallback.style = opts.style;
          if (opts.inputFidelity) fallback.input_fidelity = opts.inputFidelity;
          if (opts.user) fallback.user = opts.user;

          const result = await opts.openai.images.generate(fallback as Parameters<typeof OpenAI.prototype.images.generate>[0]);
          for (const img of result.data) {
            candidates.push({
              b64_json: img.b64_json,
              revised_prompt: (img as { revised_prompt?: string }).revised_prompt ?? "",
            });
          }
        }

        send({ type: "done", result: { candidates, key_source: opts.keySource, model_used: opts.model } });
      } catch (err) {
        const hint = moderationHint(err);
        send({
          type: "error",
          message: hint ?? (err instanceof Error ? err.message : "Image generation stream failed"),
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
  // Per-image-model selection for the image_generation tool. The Responses
  // tool accepts an `image_model` hint; some SDK versions put it under
  // `model` instead. We set both for compatibility.
  if (body.model) {
    imageGenTool.image_model = body.model;
  }

  // Build the input content. Supports multiple reference images of each kind.
  const userContent: Array<Record<string, unknown>> = [
    { type: "input_text", text: body.prompt },
  ];

  // Cap at 10 input items (1 text + 9 images) to match the Responses API
  // input_image size limits described in the official guide.
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
  // OpenAI abuse-tracking identifier (≤ 64 chars per their API).
  if (body.user) reqBody.user = body.user;
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
  let openai: OpenAI;
  let keySource: "user" | "server";
  try {
    const res = getOpenAIClient(body.apiKey);
    openai = res.client;
    keySource = res.source;
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Server not configured" }, 500);
  }

  // If the caller pinned a Responses model, try that first, then fall back
  // to the chain (IMG_GEN_MAINLINE_MODEL → gpt-4.1-mini → gpt-4o).
  const preferred = body.responsesModel ? [body.responsesModel, ...MODEL_FALLBACK_CHAIN].filter(
    (m, i, arr) => arr.indexOf(m) === i
  ) : MODEL_FALLBACK_CHAIN;

  try {
    const result = await executeWithModelFallback(async (model) => {
      const completion = await openai.responses.create(buildRefineReqBody(body, model) as Parameters<typeof OpenAI.prototype.responses.create>[0]);
      return extractImageResult(completion as never);
    }, preferred);
    return jsonResponse({ result, key_source: keySource });
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
        const { client, source } = getOpenAIClient(body.apiKey);
        const run = client.responses.stream(buildRefineReqBody(body) as Parameters<typeof OpenAI.prototype.responses.stream>[0]);
        run.on("response.image_generation_call.partial_image", (ev: { partial_image_b64?: string }) => {
          if (ev?.partial_image_b64) send({ type: "partial", b64: ev.partial_image_b64 });
        });
        const completion = await run.finalResponse();
        send({ type: "done", result: { ...extractImageResult(completion as never), key_source: source } });
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
  let openai: OpenAI;
  let keySource: "user" | "server";
  try {
    const res = getOpenAIClient(body.apiKey);
    openai = res.client;
    keySource = res.source;
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Server not configured" }, 500);
  }

  const model = body.model || "gpt-image-2";
  const isGptImage2 = model === "gpt-image-2";
  const size = body.size || mapAspectToSize(body.aspectRatio || "16:9");
  const quality = body.quality || "high";
  const style = isGptImage2 ? (body.style || "vivid") : undefined;
  const background = body.background === "transparent" ? "transparent" : (body.background || "auto");
  const outputFormat = body.outputFormat || "webp";
  const outputCompression = body.outputCompression ?? 80;
  const inputFidelity = isGptImage2 ? undefined : (body.inputFidelity || "high");

  try {
    const imageBytes = await base64ToUint8Array(body.imageB64);
    const maskBytes = await base64ToUint8Array(body.maskB64);

    const imageBlob = new Blob([imageBytes], { type: "image/png" });
    const maskBlob = new Blob([maskBytes], { type: "image/png" });

    // Build reference image array (Image API edits supports multiple).
    // The first image is the one to edit; additional images are references.
    const imageArray: Array<Blob> = [imageBlob];
    if (body.referenceImageB64) {
      const refs = Array.isArray(body.referenceImageB64) ? body.referenceImageB64 : [body.referenceImageB64];
      for (const ref of refs) {
        if (typeof ref === "string" && ref.length > 0) {
          const refBytes = await base64ToUint8Array(ref);
          imageArray.push(new Blob([refBytes], { type: "image/png" }));
        }
      }
    }

    const editPayload: Record<string, unknown> = {
      model,
      image: imageArray.length === 1 ? imageArray[0] : imageArray,
      mask: maskBlob,
      prompt: body.prompt,
      n: 1,
      size,
      quality,
      background,
      output_format: outputFormat,
      output_compression: outputCompression,
      response_format: "b64_json",
    };
    if (style) editPayload.style = style;
    if (inputFidelity) editPayload.input_fidelity = inputFidelity;
    if (body.user) editPayload.user = body.user;

    const result = await openai.images.edit(editPayload as Parameters<typeof OpenAI.prototype.images.edit>[0]);

    const img = result.data[0];
    return jsonResponse({
      result: {
        b64_json: img.b64_json,
        revised_prompt: (img as { revised_prompt?: string }).revised_prompt ?? "",
        response_id: "",
      },
      params: { quality, style, background, outputFormat, size },
      key_source: keySource,
      model_used: model,
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

async function handleUploadReference(req: Request) {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  const form = await req.formData();
  const file = form.get("file");
  const purpose = (form.get("purpose") as string) || "vision";
  const userKey = (form.get("apiKey") as string) || null;

  if (!file || !(file instanceof File)) {
    return jsonResponse({ error: "Missing file" }, 400);
  }

  // OpenAI Files API accepts: png, jpeg, webp, gif
  const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
  if (file.type && !allowed.has(file.type)) {
    return jsonResponse({ error: `Unsupported MIME type: ${file.type}` }, 400);
  }

  let openai: OpenAI;
  let keySource: "user" | "server";
  try {
    const res = getOpenAIClient(userKey);
    openai = res.client;
    keySource = res.source;
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Server not configured" }, 500);
  }

  try {
    const created = await openai.files.create({
      file: file as unknown as File,
      purpose: purpose as "vision" | "user_data" | "evals",
    });
    return jsonResponse({ id: created.id, purpose: created.purpose, bytes: created.bytes, filename: created.filename, key_source: keySource });
  } catch (error) {
    const hint = moderationHint(error);
    return jsonResponse({
      error: hint ?? (error instanceof Error ? error.message : "File upload failed"),
      ...(hint ? { moderation_blocked: true } : {}),
    }, 502);
  }
}

async function handleRecommendTemplates(body: RecommendTemplatesRequest) {
  let openai: OpenAI;
  let keySource: "user" | "server";
  try {
    const res = getOpenAIClient(body.apiKey);
    openai = res.client;
    keySource = res.source;
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Server not configured" }, 500);
  }

  const ctx = body.context || {};
  const postText = (ctx.postText || "").trim();
  const title = (ctx.title || "").trim();
  const platforms = Array.isArray(ctx.platforms) ? ctx.platforms : [];
  const mediaType = ctx.mediaType || "image";
  const aspectRatio = ctx.aspectRatio || "16:9";

  const { templates: registryTemplates, getTemplateIds } = await import(
    "npm:./_registry.js"
  );

  const knownIds = getTemplateIds();
  const compactList = knownIds.slice(0, 60).map((id) => {
    const t = registryTemplates[id] || {};
    return {
      id,
      name: t.name || id,
      category: t.category || "",
      niche: t.niche || "",
      aspectRatio: t.aspectRatio || aspectRatio,
      outputType: t.outputType || "image",
    };
  });

  const systemInstruction = `You are a thumbnail template recommendation engine.
Given the user's social context and a compact list of available templates, recommend 6-12 templates that best match their content.
Score each recommendation 0-100.
Return strict JSON only.`;

  const userInstruction = `User context:
- Post text: "${postText || "(none)"}"
- Title: "${title || "(none)"}"
- Platforms: ${platforms.join(", ") || "none"}
- Media type: ${mediaType}
- Aspect ratio: ${aspectRatio}

Available templates:
${JSON.stringify(compactList, null, 2)}

Return JSON with shape:
{ "recommended": [ { "templateId": string, "score": number, "reason": string } ] }`;

  const recommendSchema = {
    type: "object",
    properties: {
      recommended: {
        type: "array",
        minItems: 1,
        maxItems: 12,
        items: {
          type: "object",
          properties: {
            templateId: { type: "string" },
            score: { type: "number", minimum: 0, maximum: 100 },
            reason: { type: "string" },
          },
          required: ["templateId", "score", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["recommended"],
    additionalProperties: false,
  };

  try {
    const completion = await executeWithModelFallback(async (model) => {
      return await openai.responses.create({
        model,
        instructions: systemInstruction,
        input: userInstruction,
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: "template_recommendations",
            strict: true,
            schema: recommendSchema,
          },
        },
      });
    });

    let parsed: Record<string, unknown> = {};
    const text = (completion.output_text as string) || "";
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { recommended: [] };
    }

    const rawRecommended = (parsed.recommended as Array<Record<string, unknown>>) || [];

    const recommended = rawRecommended
      .filter((item) => knownIds.includes(item.templateId as string))
      .map((item) => ({
        templateId: item.templateId as string,
        score: typeof item.score === "number" ? item.score : 50,
        reason: (item.reason as string) || "Recommended",
      }));

    if (recommended.length === 0) {
      const fallbackIds = knownIds.slice(0, 6);
      return jsonResponse({
        recommended: fallbackIds.map((id) => ({
          templateId: id,
          score: 50,
          reason: "Popular template",
        })),
      });
    }

    return jsonResponse({ recommended });
  } catch (error) {
    const hint = moderationHint(error);
    return jsonResponse({
      error: hint ?? (error instanceof Error ? error.message : "Recommendation failed"),
      ...(hint ? { moderation_blocked: true } : {}),
      recommended: knownIds.slice(0, 6).map((id) => ({
        templateId: id,
        score: 50,
        reason: "Popular template (fallback)",
      })),
    }, 502);
  }
}

async function handleSurpriseMe(body: SurpriseMeRequest) {
  let openai: OpenAI;
  let keySource: "user" | "server";
  try {
    const res = getOpenAIClient(body.apiKey);
    openai = res.client;
    keySource = res.source;
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Server not configured" }, 500);
  }

  const ctx = body.context || {};
  const postText = (ctx.postText || "").trim();
  const title = (ctx.title || "").trim();
  const platforms = Array.isArray(ctx.platforms) ? ctx.platforms : [];
  const mediaType = ctx.mediaType || "image";
  const aspectRatio = ctx.aspectRatio || "16:9";

  const systemInstruction = `You are a creative thumbnail concept generator.
Given the user's social media context, invent a completely NEW, original thumbnail concept that does NOT match any existing template.
The concept should be vivid, specific, and ready to generate.
Return strict JSON only. Do NOT reuse or copy existing template names.`;

  const userInstruction = `User content:
- Post text: "${postText || "(none)"}"
- Title: "${title || "(none)"}"
- Platforms: ${platforms.join(", ") || "none"}
- Media type: ${mediaType}
- Aspect ratio: ${aspectRatio}

Invent a fresh thumbnail concept.`;

  const surpriseSchema = {
    type: "object",
    properties: {
      concept: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 3, maxLength: 80 },
          concept: { type: "string", minLength: 10 },
          headline: { type: "string", maxLength: 120 },
          requiresReference: { type: "boolean" },
          referenceType: { type: "string", enum: ["person", "product", "logo", "scene", "style", null] },
          aspectRatio: { type: "string" },
          imagePrompt: { type: "string", minLength: 20 },
          fields: { type: "object" },
        },
        required: ["name", "concept", "imagePrompt", "requiresReference", "aspectRatio", "fields"],
        additionalProperties: false,
      },
    },
    required: ["concept"],
    additionalProperties: false,
  };

  try {
    const completion = await executeWithModelFallback(async (model) => {
      return await openai.responses.create({
        model,
        instructions: systemInstruction,
        input: userInstruction,
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: "surprise_me_concept",
            strict: true,
            schema: surpriseSchema,
          },
        },
      });
    });

    let parsed: Record<string, unknown> = {};
    const text = (completion.output_text as string) || "";
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    const concept = parsed.concept as Record<string, unknown> | undefined;
    if (!concept || !concept.name || !concept.imagePrompt) {
      throw new Error("Incomplete Surprise Me concept from model");
    }

    return jsonResponse({
      concept: {
        name: String(concept.name),
        concept: String(concept.concept || concept.name),
        headline: String(concept.headline || ""),
        requiresReference: Boolean(concept.requiresReference),
        referenceType: concept.referenceType || null,
        aspectRatio: String(concept.aspectRatio || aspectRatio),
        imagePrompt: String(concept.imagePrompt),
        fields: (concept.fields as Record<string, unknown>) || {},
      },
    });
  } catch (error) {
    const hint = moderationHint(error);
    return jsonResponse({
      error: hint ?? (error instanceof Error ? error.message : "Surprise Me failed"),
      ...(hint ? { moderation_blocked: true } : {}),
    }, 502);
  }
}

async function handleVideoThumbnail(body: VideoThumbnailRequest) {
  let openai: OpenAI;
  let keySource: "user" | "server";
  try {
    const res = getOpenAIClient(body.apiKey);
    openai = res.client;
    keySource = res.source;
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Server not configured" }, 500);
  }

  const size = mapAspectToSize(body.aspectRatio);
  const frameCount = Math.max(1, Math.min(body.frames, 10));
  const frames: Array<{ b64: string; prompt: string }> = [];

  for (let i = 0; i < frameCount; i++) {
    const framePrompt = `${body.prompt}, ${VIDEO_THUMBNAIL_PROMPT}, frame ${i + 1} of ${frameCount}`;
    try {
      const frame = await executeWithModelFallback(async (model) => {
        const completion = await openai.responses.create({
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

  return jsonResponse({ frames, duration: body.duration, aspectRatio: body.aspectRatio, key_source: keySource });
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

  // Multipart form requests (e.g. upload-reference) bypass JSON parsing.
  const contentType = req.headers.get("content-type") || "";
  if (contentType.startsWith("multipart/form-data")) {
    try {
      const form = await req.formData();
      const action = form.get("action");
      if (action === "upload-reference") {
        return handleUploadReference(req);
      }
      return jsonResponse({ error: `Unsupported multipart action: ${action}` }, 400);
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : "Invalid multipart body" }, 400);
    }
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
      case "recommend-templates":
        return handleRecommendTemplates(parsed as RecommendTemplatesRequest);
      case "surprise-me":
        return handleSurpriseMe(parsed as SurpriseMeRequest);
      case "upload-reference":
        return jsonResponse({ error: "upload-reference requires multipart/form-data" }, 400);
      default:
        const r = parsed as Record<string, string>;
        return jsonResponse({ error: `Unknown action ${r.action}` }, 400);
    }
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
