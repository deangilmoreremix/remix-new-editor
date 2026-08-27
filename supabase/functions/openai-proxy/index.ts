import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai";

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

function getCorsHeaders(req: Request): Record<string, string> {
  const requestOrigin = req.headers.get("origin") || "";
  const originHeader = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS.length > 0
      ? ALLOWED_ORIGINS[0]
      : "*";
  return {
    "Access-Control-Allow-Origin": originHeader,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
    "Vary": "Origin",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(new Request("http://localhost")), "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = Deno.env.get("OPENAI_DEFAULT_MODEL") || "gpt-5.6-luna";

// Models allowed for structured JSON content generation.
const ALLOWED_MODELS = new Set([
  "gpt-5.6-luna",
  "gpt-5.6-terra",
  "gpt-5.6-sol",
]);

// ---------------------------------------------------------------------------
// Key resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the OpenAI API key for this request.
 *
 * Priority:
 *   1. x-api-key header (user's key from Settings > OpenAI API Key)
 *   2. OPENAI_API_KEY env var (server fallback)
 *
 * The user's own key is preferred so billing goes to their account. The
 * server fallback lets the function work even before a user configures a key.
 */
function resolveOpenAIKey(req: Request): string | null {
  const userKey = req.headers.get("x-api-key");
  if (userKey && userKey.trim()) return userKey.trim();

  const serverKey = Deno.env.get("OPENAI_API_KEY");
  if (serverKey && serverKey.trim()) return serverKey.trim();

  return null;
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

interface OpenAIProxyBody {
  model?: string;
  input?: string;
  instructions?: string;
  response_format?: {
    type: string;
    json_schema: {
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
  temperature?: number;
  max_tokens?: number;
}

function validateBody(body: OpenAIProxyBody): string | null {
  if (!body.input || typeof body.input !== "string") {
    return "Missing required field: input";
  }
  if (body.model && !ALLOWED_MODELS.has(body.model)) {
    return `Unsupported model: ${body.model}. Allowed: ${[...ALLOWED_MODELS].join(", ")}`;
  }
  if (body.response_format) {
    if (body.response_format.type !== "json_schema") {
      return "Only json_schema response_format is supported";
    }
    if (!body.response_format.json_schema?.schema) {
      return "response_format.json_schema.schema is required";
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  // Resolve the API key from the request or environment
  const apiKey = resolveOpenAIKey(req);
  if (!apiKey) {
    return jsonResponse({
      error: "No OpenAI API key available. Add your key in Settings or configure the server.",
    }, 401);
  }

  // Create an OpenAI client scoped to this request's key
  const openai = new OpenAI({ apiKey });

  // Parse body
  let body: OpenAIProxyBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  // Validate
  const validationError = validateBody(body);
  if (validationError) {
    return jsonResponse({ error: validationError }, 400);
  }

  try {
    const completion = await openai.responses.create({
      model: body.model || DEFAULT_MODEL,
      instructions: body.instructions || "You are a helpful assistant. Respond with structured JSON.",
      input: body.input,
      temperature: body.temperature ?? 0.7,
      text: body.response_format
        ? {
            format: {
              type: "json_schema",
              name: body.response_format.json_schema.name || "structured_output",
              schema: body.response_format.json_schema.schema,
              strict: body.response_format.json_schema.strict !== false,
            },
          }
        : undefined,
    });

    const text = (completion.output_text || "").trim();
    if (!text) {
      return jsonResponse({ error: "Empty response from AI" }, 502);
    }

    // Return in the shape the client expects:
    // { output: [{ content: [{ text }] }] }
    return jsonResponse({
      output: [{
        content: [{
          text,
        }],
      }],
      model: body.model || DEFAULT_MODEL,
      usage: completion.usage
        ? {
            input_tokens: completion.usage.input_tokens ?? 0,
            output_tokens: completion.usage.output_tokens ?? 0,
          }
        : undefined,
    });
  } catch (error) {
    console.error("[openai-proxy] OpenAI error:", error);
    const message = error instanceof Error ? error.message : "AI generation failed";
    return jsonResponse({ error: message }, 502);
  }
});
