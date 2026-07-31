import OpenAI from 'npm:openai';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

/**
 * Accepts a user-supplied OpenAI key from the request body so the
 * generation is charged to the user rather than to the server's
 * shared env key. Falls back to the server's OPENAI_API_KEY env var
 * if no user key is provided, and throws if neither is available.
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

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    basePrompt,
    role,
    industry,
    methodology,
    tonality,
    focus = [],
    cinematicOptions = {},
    apiKey
  } = body ?? {};

  if (!basePrompt || !role || !industry || !methodology || !tonality) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  let openaiClient;
  try {
    const result = getOpenAIClient(apiKey);
    openaiClient = result.client;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI generation failed';
    return Response.json({ error: message }, { status: 500 });
  }

  const gtmContextLines = [
    `Target role: ${role}`,
    `Industry: ${industry}`,
    `Sales methodology: ${methodology}`,
    `Writing style/tonality: ${tonality}`,
    focus.length ? `Conversion focus: ${focus.join(', ')}` : null,
    cinematicOptions?.openingHook ? 'Emphasize a strong opening hook' : null,
    cinematicOptions?.storytellingStructure ? 'Use a clear 3-act storytelling structure' : null,
    cinematicOptions?.visualElements ? 'Include specific cinematography, lighting and composition details' : null,
    cinematicOptions?.audioElements ? 'Include audio direction (music, SFX, tone)' : null,
    cinematicOptions?.pacingEditing ? 'Specify pacing, rhythm and edit style' : null,
    cinematicOptions?.emotionalEngagement ? 'Emphasize emotional beats and audience empathy' : null,
    cinematicOptions?.ctaIntegration ? 'End with a clear, conversion-focused CTA' : null,
  ].filter(Boolean);

  const input = `You are a world-class cinematic prompt engineer for AI video generation.

GTM CONTEXT:
${gtmContextLines.join('\n')}

TASK:
Rewrite the user's base prompt into a single, premium, conversion-optimized cinematic video prompt.
Weave the GTM context into the actual prompt wording — do not just append a label list.
The result must be a single cohesive, ready-to-use prompt string. No JSON, no markdown, no preamble.

BASE PROMPT:
${basePrompt}`;

  try {
    const completion = await openaiClient.responses.create({
      model: 'gpt-4.1-mini',
      input,
    });

    const optimizedPrompt = (completion.output_text || '').trim();
    if (!optimizedPrompt) {
      return Response.json({ error: 'Empty response from AI' }, { status: 502 });
    }

    return Response.json({ optimizedPrompt });
  } catch (error) {
    console.error('[ai-cinematic-prompt-generator] OpenAI error:', error);
    const message = error instanceof Error ? error.message : 'AI generation failed';
    return Response.json({ error: message }, { status: 502 });
  }
});
