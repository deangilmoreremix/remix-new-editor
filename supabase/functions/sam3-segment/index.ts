/**
 * Server-side only. Do not import from client bundles.
 *
 * SAM-3 segmentation service. Wraps fal.ai's `fal-ai/sam-3/image` model and
 * exposes a single `segmentImage` helper. All keys are read from server-side
 * environment variables; never expose `FAL_KEY` to the browser.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ── Rate limiting (in-memory; swap for Redis in multi-instance deploys) ──
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(clientId);
  if (!record || now > record.resetTime) {
    rateLimitStore.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

// ── CORS ──
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Prompt-type → fal.ai input builder ──
function buildFalInput(
  imageUrl: string,
  promptType: string,
  prompt: string,
  points?: number[],
  box?: number[]
): Record<string, unknown> {
  const base = { image: imageUrl };
  switch (promptType) {
    case "text":
      return { ...base, text_prompt: prompt };
    case "click": {
      if (!points || !Array.isArray(points) || points.length < 2) {
        throw new Error("click prompt requires at least one [x, y] point in `points`");
      }
      return { ...base, point_coords: points };
    }
    case "box": {
      if (!box || !Array.isArray(box) || box.length !== 4) {
        throw new Error("box prompt requires a [x1, y1, x2, y2] array in `box`");
      }
      return { ...base, box };
    }
    default:
      throw new Error(`Unsupported promptType "${promptType}". Expected text, click, or box.`);
  }
}

// ── fal.ai client (bare fetch, no SDK dependency) ──
async function callFalAi(model: string, input: Record<string, unknown>, apiKey: string): Promise<Record<string, unknown>> {
  const url = `https://fal.run/${model}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
  });

  if (response.status === 429) {
    throw new Error("Rate limited by fal.ai. Please retry shortly.");
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`fal.ai API error ${response.status}: ${text.slice(0, 200)}`);
  }

  const result = await response.json();

  // fal-ai/sam-3/image returns { images: [{ url: "..." }], ... }
  // The mask is in `images[0]`
  const maskUrl =
    (result.images && result.images[0]?.url) ||
    (result.data && (result.data as any).images?.[0]?.url) ||
    (result as any).mask;

  if (!maskUrl) {
    throw new Error("fal.ai response did not contain a mask URL. Raw: " + JSON.stringify(result).slice(0, 200));
  }

  return { maskUrl, raw: result };
}

// ── Edge-function entry point ──
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Rate limiting
  const clientId = req.headers.get("cf-connecting-ip") || "unknown";
  if (!checkRateLimit(clientId)) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
    );
  }

  try {
    const falKey = Deno.env.get("FAL_KEY");
    if (!falKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured: FAL_KEY is not set." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json()) as {
      imageUrl?: string;
      promptType?: string;
      prompt?: string;
      points?: number[];
      box?: number[];
    };

    const { imageUrl, promptType, prompt, points, box } = body;

    if (!imageUrl || !promptType || !prompt) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: imageUrl, promptType, prompt." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const input = buildFalInput(imageUrl, promptType, prompt, points, box);
    const { maskUrl, raw } = await callFalAi("fal-ai/sam-3/image", input, falKey);

    return new Response(
      JSON.stringify({ maskUrl, raw }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[sam3-segment] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
