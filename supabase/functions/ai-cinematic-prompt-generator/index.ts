import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai";
// Real GTM skill prompts (gtm-skills library) used to ground generation in
// concrete examples. Shared single source of truth with the frontend.
import {
  gtmSkillsPromptForContext,
} from "../../../src/lib/gtmSkillsData.js";

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
const GTM_MODEL = Deno.env.get("GTM_PROMPT_MODEL") || "gpt-4.1-mini";
const GTM_VARIANT_COUNT = Number(Deno.env.get("GTM_VARIANT_COUNT") || "3");

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

/**
 * Persist a GTM generation row (best-effort; never blocks the response).
 */
async function recordGeneration(params: {
  userId?: string | null;
  studioType?: string;
  action: string;
  basePrompt: string;
  gtmParams: Record<string, unknown>;
  structuredPrompt?: unknown;
  openaiResponseId?: string;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
}) {
  if (!supabase) return;
  try {
    await supabase.from("gtm_prompt_generations").insert({
      user_id: params.userId ?? null,
      studio_type: params.studioType ?? null,
      action: params.action,
      base_prompt: params.basePrompt,
      gtm_params: params.gtmParams,
      structured_prompt: params.structuredPrompt ?? null,
      openai_response_id: params.openaiResponseId ?? null,
      input_tokens: params.inputTokens ?? 0,
      output_tokens: params.outputTokens ?? 0,
      model: params.model ?? GTM_MODEL,
    });
  } catch (err) {
    console.error("[ai-cinematic-prompt-generator] persist error:", err);
  }
}

// Helper to read the caller user id from the Authorization header (JWT).
function getUserId(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  try {
    const token = auth.slice(7);
    // Decode the JWT payload (no verification; the anon key path is untrusted
    // but the RLS insert policy still requires auth.uid() = user_id).
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// Structured Outputs schema (mirrors src/lib/gtmResponses.js).
const GTM_PROMPT_SCHEMA = {
  type: "object",
  strict: true,
  additionalProperties: false,
  properties: {
    hook: { type: "string" },
    storybeat_1: { type: "string" },
    storybeat_2: { type: "string" },
    storybeat_3: { type: "string" },
    visualDirection: { type: "string" },
    audioDirection: { type: "string" },
    cta: { type: "string" },
    estimatedDurationSec: { type: "integer" },
  },
  required: [
    "hook",
    "storybeat_1",
    "storybeat_2",
    "storybeat_3",
    "visualDirection",
    "audioDirection",
    "cta",
    "estimatedDurationSec",
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildInstructions(): string {
  const exampleNote = [
    "You have access to a real GTM skills library (gtm-skills.com, MIT) containing roles,",
    "industries, methodologies (MEDDPICC, SPIN, Challenger, Sandler, Value/Gap Selling) and",
    "250+ concrete sales prompt examples. The user's selected context (role/industry/",
    "methodology) is used to retrieve the most relevant real examples, which are injected",
    "into the input below under \"REAL GTM SKILL EXAMPLES\".",
    "Mirror the structure, depth, and concrete bracketed-variable style of those examples",
    "when shaping the cinematic prompt — they are the gold standard for this domain.",
  ].join(" ");

  return [
    "You are a world-class cinematic prompt engineer for AI video generation and a senior GTM (Go-To-Market) sales enablement expert.",
    "Given a base concept plus GTM context (role, industry, sales methodology, writing style, conversion focus, cinematic elements),",
    "produce a single, premium, conversion-optimized cinematic video prompt.",
    "Return it as structured sections (hook, three story beats, visual direction, audio direction, CTA, estimated duration).",
    "Weave the GTM context into the actual wording — do not just append a label list.",
    exampleNote,
    "Output ONLY the structured schema. No markdown, no preamble.",
  ].join(" ");
}

/**
 * Retrieve real GTM skill examples relevant to the selected context and render
 * them as a block to ground the model. Returns "" when nothing matches.
 */
function buildSkillContext(params: {
  role: string;
  industry: string;
  methodology: string;
  limit?: number;
}): string {
  try {
    const examples = gtmSkillsPromptForContext({
      role: params.role,
      industry: params.industry,
      methodology: params.methodology,
      limit: params.limit ?? 3,
    });
    if (!examples) return "";
    return `\n\nREAL GTM SKILL EXAMPLES (retrieved from gtm-skills library):\n${examples}`;
  } catch {
    return "";
  }
}

function buildGTMInput(params: {
  basePrompt: string;
  role: string;
  industry: string;
  methodology: string;
  tonality: string;
  focus: string[];
  cinematicOptions: Record<string, boolean>;
}): string {
  const {
    basePrompt,
    role,
    industry,
    methodology,
    tonality,
    focus = [],
    cinematicOptions = {},
  } = params;

  const ctx = [
    `Target role: ${role}`,
    `Industry: ${industry}`,
    `Sales methodology: ${methodology}`,
    `Writing style/tonality: ${tonality}`,
    focus.length ? `Conversion focus: ${focus.join(", ")}` : null,
    cinematicOptions?.openingHook ? "Emphasize a strong opening hook" : null,
    cinematicOptions?.storytellingStructure ? "Use a clear 3-act storytelling structure" : null,
    cinematicOptions?.visualElements ? "Include specific cinematography, lighting and composition details" : null,
    cinematicOptions?.audioElements ? "Include audio direction (music, SFX, tone)" : null,
    cinematicOptions?.pacingEditing ? "Specify pacing, rhythm and edit style" : null,
    cinematicOptions?.emotionalEngagement ? "Emphasize emotional beats and audience empathy" : null,
    cinematicOptions?.ctaIntegration ? "End with a clear, conversion-focused CTA" : null,
  ].filter(Boolean);

  const skillContext = buildSkillContext({
    role,
    industry,
    methodology,
    limit: 3,
  });

  return `GTM CONTEXT:\n${ctx.join("\n")}\n\nBASE PROMPT:\n${basePrompt}${skillContext}`;
}

// Text-capable, Responses-API models offered in the GTM Boost model chooser.
// Mirrors the client-side catalog (src/lib/gtmResponses.js) so the server
// fallback honors the user's selection. Anything else falls back to GTM_MODEL.
const ALLOWED_MODELS = new Set([
  "gpt-4.1-mini",
  "gpt-4.1",
  "gpt-5.4-mini",
  "gpt-5.4",
  "gpt-5.6-terra",
  "gpt-5.6-sol",
]);

function resolveModel(preferred?: string): string {
  if (preferred && ALLOWED_MODELS.has(preferred)) return preferred;
  return GTM_MODEL;
}

function extractUsage(json: any): { inputTokens: number; outputTokens: number } {
  const u = json?.usage || {};
  return {
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

// Generate a single structured prompt.
async function handleGenerate(body: Record<string, unknown>, userId?: string | null) {
  if (!openai) return jsonResponse({ error: "Server not configured" }, 500);

  const gtmParams = {
    basePrompt: String(body.basePrompt || ""),
    role: String(body.role || ""),
    industry: String(body.industry || ""),
    methodology: String(body.methodology || ""),
    tonality: String(body.tonality || ""),
    focus: Array.isArray(body.focus) ? (body.focus as string[]) : [],
    cinematicOptions:
      body.cinematicOptions && typeof body.cinematicOptions === "object"
        ? (body.cinematicOptions as Record<string, boolean>)
        : {},
    model: String(body.model || ""),
  };

  const completion = await openai.responses.create({
    model: resolveModel(gtmParams.model),
    instructions: buildInstructions(),
    input: buildGTMInput(gtmParams),
    store: true,
    temperature: 0.7,
    text: {
      format: {
        type: "json_schema",
        name: "gtm_cinematic_prompt",
        schema: GTM_PROMPT_SCHEMA,
        strict: true,
      },
    },
    include: ["input_tokens", "output_tokens"],
  });

  const text = (completion.output_text || "").trim();
  if (!text) return jsonResponse({ error: "Empty response from AI" }, 502);

  let prompt: unknown;
  try {
    prompt = JSON.parse(text);
  } catch {
    return jsonResponse({ error: "Failed to parse structured prompt" }, 502);
  }

  const usage = extractUsage(completion);
  await recordGeneration({
    userId,
    studioType: typeof body.studioType === "string" ? body.studioType : undefined,
    action: "generate",
    basePrompt: gtmParams.basePrompt,
    gtmParams,
    structuredPrompt: prompt,
    openaiResponseId: completion.id,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    model: GTM_MODEL,
  });

  return jsonResponse({ prompt, response_id: completion.id, usage });
}

// Multi-turn refine via previous_response_id.
async function handleRefine(body: Record<string, unknown>, userId?: string | null) {
  if (!openai) return jsonResponse({ error: "Server not configured" }, 500);

  const previousResponseId = body.previousResponseId;
  const refineInstruction = body.refineInstruction;
  if (!previousResponseId || !refineInstruction) {
    return jsonResponse({ error: "Missing previousResponseId or refineInstruction" }, 400);
  }

  const completion = await openai.responses.create({
    model: resolveModel(String(body.model || "")),
    instructions: buildInstructions(),
    input: [{ role: "user", content: String(refineInstruction) }],
    previous_response_id: String(previousResponseId),
    store: true,
    temperature: 0.7,
    text: {
      format: {
        type: "json_schema",
        name: "gtm_cinematic_prompt",
        schema: GTM_PROMPT_SCHEMA,
        strict: true,
      },
    },
    include: ["input_tokens", "output_tokens"],
  });

  const text = (completion.output_text || "").trim();
  if (!text) return jsonResponse({ error: "Empty response from AI" }, 502);

  let prompt: unknown;
  try {
    prompt = JSON.parse(text);
  } catch {
    return jsonResponse({ error: "Failed to parse structured prompt" }, 502);
  }

  const usage = extractUsage(completion);
  await recordGeneration({
    userId,
    studioType: typeof body.studioType === "string" ? body.studioType : undefined,
    action: "refine",
    basePrompt: String(body.basePrompt || ""),
    gtmParams: { previousResponseId, refineInstruction },
    structuredPrompt: prompt,
    openaiResponseId: completion.id,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    model: GTM_MODEL,
  });

  return jsonResponse({ prompt, response_id: completion.id, usage });
}

// Parallel variants.
async function handleVariants(body: Record<string, unknown>, userId?: string | null) {
  if (!openai) return jsonResponse({ error: "Server not configured" }, 500);

  const count = Math.min(Math.max(Number(body.count) || GTM_VARIANT_COUNT, 1), 5);
  const params = {
    basePrompt: String(body.basePrompt || ""),
    role: String(body.role || ""),
    industry: String(body.industry || ""),
    methodology: String(body.methodology || ""),
    tonality: String(body.tonality || ""),
    focus: Array.isArray(body.focus) ? (body.focus as string[]) : [],
    cinematicOptions:
      body.cinematicOptions && typeof body.cinematicOptions === "object"
        ? (body.cinematicOptions as Record<string, boolean>)
        : {},
    model: String(body.model || ""),
  };

  const results = await Promise.all(
    Array.from({ length: count }).map(async () => {
      try {
        const completion = await openai!.responses.create({
          model: resolveModel(params.model),
          instructions: buildInstructions(),
          input: buildGTMInput(params),
          store: true,
          temperature: 0.9,
          text: {
            format: {
              type: "json_schema",
              name: "gtm_cinematic_prompt",
              schema: GTM_PROMPT_SCHEMA,
              strict: true,
            },
          },
          include: ["input_tokens", "output_tokens"],
        });
        const text = (completion.output_text || "").trim();
        if (!text) return null;
        try {
          return { prompt: JSON.parse(text), response_id: completion.id, usage: extractUsage(completion) };
        } catch {
          return null;
        }
      } catch {
        return null;
      }
    })
  );

  const variants = results.filter((r): r is NonNullable<typeof r> => r !== null);
  if (variants.length === 0) return jsonResponse({ error: "All variant generations failed" }, 502);

  // Persist the chosen-first variant for usage tracking.
  const first = variants[0];
  const fu = first.usage || { inputTokens: 0, outputTokens: 0 };
  await recordGeneration({
    userId,
    studioType: typeof body.studioType === "string" ? body.studioType : undefined,
    action: "variants",
    basePrompt: params.basePrompt,
    gtmParams: params,
    structuredPrompt: first.prompt,
    openaiResponseId: first.response_id,
    inputTokens: fu.inputTokens,
    outputTokens: fu.outputTokens,
    model: GTM_MODEL,
  });

  return jsonResponse({ variants });
}

// Streaming single generate (SSE token deltas).
function streamGenerate(body: Record<string, unknown>, userId?: string | null): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        if (!openai) throw new Error("Server not configured");

        const gtmParams = {
          basePrompt: String(body.basePrompt || ""),
          role: String(body.role || ""),
          industry: String(body.industry || ""),
          methodology: String(body.methodology || ""),
          tonality: String(body.tonality || ""),
          focus: Array.isArray(body.focus) ? (body.focus as string[]) : [],
          cinematicOptions:
            body.cinematicOptions && typeof body.cinematicOptions === "object"
              ? (body.cinematicOptions as Record<string, boolean>)
              : {},
          model: String(body.model || ""),
        };

        const run = openai.responses.stream({
          model: resolveModel(gtmParams.model),
          instructions: buildInstructions(),
          input: buildGTMInput(gtmParams),
          store: true,
          temperature: 0.7,
          text: {
            format: {
              type: "json_schema",
              name: "gtm_cinematic_prompt",
              schema: GTM_PROMPT_SCHEMA,
              strict: true,
            },
          },
          include: ["input_tokens", "output_tokens"],
        });

        run.on("response.output_text.delta", (ev: { delta?: string }) => {
          if (ev?.delta) send({ type: "delta", text: ev.delta });
        });

        const completion = await run.finalResponse();
        const text = (completion.output_text || "").trim();
        let prompt: unknown = null;
        try {
          prompt = text ? JSON.parse(text) : null;
        } catch {
          prompt = { hook: text };
        }
        const usage = extractUsage(completion);
        send({ type: "done", prompt, response_id: completion.id, usage });

        await recordGeneration({
          userId,
          studioType: typeof body.studioType === "string" ? body.studioType : undefined,
          action: "generate",
          basePrompt: gtmParams.basePrompt,
          gtmParams,
          structuredPrompt: prompt,
          openaiResponseId: completion.id,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          model: GTM_MODEL,
        });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Stream failed" });
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

  const b = (body ?? {}) as Record<string, unknown>;
  const action = typeof b.action === "string" ? b.action : "generate";
  const userId = getUserId(req);

  // stream=true requests (generate action) return an SSE response.
  if (action === "generate" && b.stream === true) {
    if (!openai) return jsonResponse({ error: "Server not configured" }, 500);
    return streamGenerate(b, userId);
  }

  if (!openai) {
    return jsonResponse({ error: "Server not configured" }, 500);
  }

  try {
    switch (action) {
      case "generate":
        return await handleGenerate(b, userId);
      case "refine":
        return await handleRefine(b, userId);
      case "variants":
        return await handleVariants(b, userId);
      default:
        return jsonResponse({ error: `Unknown action ${action}` }, 400);
    }
  } catch (error) {
    console.error("[ai-cinematic-prompt-generator] OpenAI error:", error);
    const message = error instanceof Error ? error.message : "AI generation failed";
    return jsonResponse({ error: message }, 502);
  }
});
