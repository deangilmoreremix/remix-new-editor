import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "openai";

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

// Mainline model for Responses API image_generation tool.
// Override via env if needed: IMG_GEN_MAINLINE_MODEL=gpt-5.5
const IMG_GEN_MAINLINE_MODEL = Deno.env.get("IMG_GEN_MAINLINE_MODEL") || "gpt-4.1-mini";

// Server-side preset definitions — keep in sync with src/lib/thumbnailPresets.js.
// The brief modifier is appended to the auto-composed brief.
const PRESET_MODIFIERS: Record<string, string> = {
  cinematic: 'widescreen cinematic composition, shallow depth of field, anamorphic lens, color graded, 24fps, editorial framing',
  productCutout: 'isolated product on plain background, centered, crisp silhouette, no halos, label legible, soft contact shadow',
  lifestyle: 'lifestyle photography, warm natural light, candid moment, real-people feel, gentle color palette, inviting atmosphere',
  boldText: 'high-contrast composition, single dominant subject, large negative space for headline overlay, punchy colors, thumbnail-readable from arm\'s length',
  minimal: 'minimal composition, generous negative space, restrained palette, single subtle subject, professional restraint',
  vertical: 'vertical 9:16 framing, top-of-frame subject, lower-third space for caption, mobile-readable',
};

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapAspectToSize(ratio: string): string {
  if (ratio === "9:16") return "1024x1792";
  if (ratio === "16:9") return "1792x1024";
  if (ratio === "1:1") return "1024x1024";
  return "1024x1024";
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

async function base64ToUint8Array(b64: string): Promise<Uint8Array> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Action = "prompts" | "generate" | "refine" | "inpaint" | "save";

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
  // For reference-image input on multi-modal refine
  referenceImageB64?: string;
  referenceImageUrl?: string;
  referenceImageFileId?: string;
  imageDetail?: "low" | "high" | "original" | "auto";
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
}

type RequestBody = PromptsRequest | GenerateRequest | RefineRequest | InpaintRequest | SaveRequest;

function validateBody(body: unknown): RequestBody {
  if (!body || typeof body !== "object") throw new Error("Invalid body");
  const b = body as Record<string, unknown>;
  const action = b.action as Action;
  if (!action || !["prompts", "generate", "refine", "inpaint", "save"].includes(action)) {
    throw new Error("Missing or invalid action");
  }
  return body as RequestBody;
}

async function handlePrompts(body: PromptsRequest) {
  if (!openai) return jsonResponse({ error: "Server not configured" }, 500);

  const baseBrief =
    body.brief ||
    buildPromptBrief(body.template?.name || body.templateId, {
      visualStyle: body.template?.visualStyle,
      cinematography: body.template?.cinematography,
      niche: body.template?.niche,
      aspectRatio: body.template?.aspectRatio || "16:9",
      outputType: body.template?.outputType || "video",
    });

  const modifier = body.presetKey && PRESET_MODIFIERS[body.presetKey]
    ? body.presetModifier || PRESET_MODIFIERS[body.presetKey]
    : "";

  const brief = modifier ? `${baseBrief}\n\nStyle direction: ${modifier}` : baseBrief;

  const systemInstruction = `You are a thumbnail prompt engineer for gpt-image-2.
Using the template context below, write 3 DISTINCT thumbnail prompts.
Each prompt must:
- Lead with a single hero subject/scene
- Include 3-5 cinematic modifiers (lighting, lens, palette, mood)
- End with quality/style tokens (e.g. "editorial, 4K, high contrast")
- AVOID text, logos, watermarks, UI elements

Return JSON matching the provided schema.`;

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
    const completion = await openai.responses.create({
      model: IMG_GEN_MAINLINE_MODEL,
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
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Prompt generation failed" }, 502);
  }
}

async function handleGenerate(body: GenerateRequest) {
  if (!OPENAI_API_KEY) return jsonResponse({ error: "Server not configured" }, 500);

  const size = mapAspectToSize(body.aspectRatio);
  const n = Math.min(body.n || 3, 3);
  const quality = body.quality || "high";
  const style = body.style || "vivid";
  // gpt-image-2 does not support transparent — clamp to auto if requested
  const background = body.background === "transparent" ? "auto" : (body.background || "auto");
  const outputFormat = body.outputFormat || "webp";
  const outputCompression = body.outputCompression ?? 80;

  try {
    const result = await openai!.images.generate({
      model: "gpt-image-2",
      prompt: body.prompt,
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
    return jsonResponse({ error: error instanceof Error ? error.message : "Image generation failed" }, 502);
  }
}

async function handleRefine(body: RefineRequest) {
  if (!openai) return jsonResponse({ error: "Server not configured" }, 500);

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

  // Build the input content. If a reference image is supplied, attach it as
  // an input_image alongside the text.
  const userContent: Array<Record<string, unknown>> = [
    { type: "input_text", text: body.prompt },
  ];
  if (body.referenceImageB64) {
    userContent.push({
      type: "input_image",
      image_url: `data:image/png;base64,${body.referenceImageB64}`,
      detail: body.imageDetail || "auto",
    });
  } else if (body.referenceImageUrl) {
    userContent.push({
      type: "input_image",
      image_url: body.referenceImageUrl,
      detail: body.imageDetail || "auto",
    });
  } else if (body.referenceImageFileId) {
    userContent.push({
      type: "input_image",
      file_id: body.referenceImageFileId,
      detail: body.imageDetail || "auto",
    });
  }

  const reqBody: Record<string, unknown> = {
    model: IMG_GEN_MAINLINE_MODEL,
    input: [{ role: "user", content: userContent }],
    tools: [imageGenTool],
  };
  if (body.previousResponseId) reqBody.previous_response_id = body.previousResponseId;
  if (typeof body.store === "boolean") reqBody.store = body.store;
  if (Array.isArray(body.include) && body.include.length > 0) reqBody.include = body.include;

  try {
    const completion = await openai.responses.create(reqBody as Parameters<typeof openai.responses.create>[0]);

    const imageCalls = completion.output.filter((o) => o.type === "image_generation_call");
    const first = imageCalls[0] as { result?: string; revised_prompt?: string } | undefined;

    return jsonResponse({
      result: {
        b64_json: first?.result ?? "",
        revised_prompt: (first as { revised_prompt?: string })?.revised_prompt ?? "",
        response_id: completion.id,
      },
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Refine failed" }, 502);
  }
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
    return jsonResponse({ error: error instanceof Error ? error.message : "Inpaint failed" }, 502);
  }
}

async function handleSave(body: SaveRequest) {
  if (!supabase) return jsonResponse({ error: "Supabase not configured" }, 500);

  try {
    const imageBuffer = await base64ToUint8Array(body.imageB64);
    const filename = `${body.templateId}/${crypto.randomUUID()}.webp`;
    const imageUrl = await uploadBufferToStorage(imageBuffer, filename);

    await persistThumbnailRow({
      templateId: body.templateId,
      imagePath: imageUrl,
      promptUsed: body.promptUsed,
      altText: body.altText || body.templateId,
      userId: body.userId,
    });

    return jsonResponse({ imageUrl, path: filename });
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
        return handleRefine(parsed as RefineRequest);
      case "inpaint":
        return handleInpaint(parsed as InpaintRequest);
      case "save":
        return handleSave(parsed as SaveRequest);
      default:
        const r = parsed as Record<string, string>;
        return jsonResponse({ error: `Unknown action ${r.action}` }, 400);
    }
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
