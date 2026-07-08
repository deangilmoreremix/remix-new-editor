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
      { onConflict: "target_type, target_id, user_id" }
    );
  if (error) console.error("[ai-thumbnail-generator] persist error", error);
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
}

interface GenerateRequest {
  action: "generate";
  prompt: string;
  aspectRatio: string;
  n?: number;
}

interface RefineRequest {
  action: "refine";
  prompt: string;
  previousResponseId: string;
}

interface InpaintRequest {
  action: "inpaint";
  prompt: string;
  imageB64: string;
  maskB64: string;
  aspectRatio?: string;
}

interface SaveRequest {
  action: "save";
  templateId: string;
  imageB64: string;
  altText: string;
  userId: string;
  promptUsed: string;
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

  const brief =
    body.brief ||
    buildPromptBrief(body.template?.name || body.templateId, {
      visualStyle: body.template?.visualStyle,
      cinematography: body.template?.cinematography,
      niche: body.template?.niche,
      aspectRatio: body.template?.aspectRatio || "16:9",
      outputType: body.template?.outputType || "video",
    });

  const instruction = `You are a thumbnail prompt engineer for gpt-image-2.
Using the template context below, write 3 DISTINCT thumbnail prompts.
Each prompt must:
- Lead with a single hero subject/scene
- Include 3-5 cinematic modifiers (lighting, lens, palette, mood)
- End with quality/style tokens (e.g. "editorial, 4K, high contrast")
- AVOID text, logos, watermarks, UI elements

Return ONLY valid JSON: {"prompts": ["...", "...", "..."]}

TEMPLATE CONTEXT:
${brief}`;

  try {
    const completion = await openai.responses.create({
      model: IMG_GEN_MAINLINE_MODEL,
      input: instruction,
    });

    const text = (completion.output_text as string) || "";
    let parsed: { prompts?: string[] } = {};
    try {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { prompts: [] };
    } catch {
      parsed.prompts = text
        .split("\n")
        .map((l) => l.replace(/^["\-\s]+/, "").trim())
        .filter((l) => l.length > 20)
        .slice(0, 3);
    }

    return jsonResponse({ variants: parsed.prompts || [] });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Prompt generation failed" }, 502);
  }
}

async function handleGenerate(body: GenerateRequest) {
  if (!OPENAI_API_KEY) return jsonResponse({ error: "Server not configured" }, 500);

  const size = mapAspectToSize(body.aspectRatio);
  const n = Math.min(body.n || 3, 3);

  try {
    const result = await openai!.images.generate({
      model: "gpt-image-2",
      prompt: body.prompt,
      n,
      size,
      quality: "hd",
      style: "vivid",
      output_format: "webp",
      output_compression: 80,
      response_format: "b64_json",
      moderation: "auto",
    });

    const candidates = result.data.map((img) => ({
      b64_json: img.b64_json,
      revised_prompt: (img as { revised_prompt?: string }).revised_prompt ?? "",
    }));

    return jsonResponse({ candidates });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Image generation failed" }, 502);
  }
}

async function handleRefine(body: RefineRequest) {
  if (!openai) return jsonResponse({ error: "Server not configured" }, 500);

  try {
    const completion = await openai.responses.create({
      model: IMG_GEN_MAINLINE_MODEL,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: body.prompt }],
        },
      ],
      tools: [{ type: "image_generation" }],
      previous_response_id: body.previousResponseId,
    });

    const imageCalls = completion.output.filter((o) => o.type === "image_generation_call");
    const result = imageCalls[0] as { result?: string };

    return jsonResponse({
      result: {
        b64_json: result?.result ?? "",
        revised_prompt: "",
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
      quality: "hd",
      style: "vivid",
      output_format: "webp",
      response_format: "b64_json",
    });

    const img = result.data[0];
    return jsonResponse({
      result: {
        b64_json: img.b64_json,
        revised_prompt: (img as { revised_prompt?: string }).revised_prompt ?? "",
        response_id: "",
      },
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
