/**
 * Catalog Sync Edge Function
 *
 * POST /functions/v1/sync-muapi-models
 *
 * Server-side catalog synchronization from MuAPI.
 * Calls GET https://api.muapi.ai/api/v1/models
 * and upserts into ai_models table.
 *
 * Protected by service role key.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface MuapiModel {
  name: string;
  description?: string;
  category?: string;
  family?: string;
  group_of?: string;
  cost?: number;
  cost_currency?: string;
  cost_strategy?: string;
  dynamic_pricing?: boolean;
  endpoint: string;
  estimate_endpoint?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const MUAPI_API_KEY = Deno.env.get('MUAPI_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch MuAPI catalog
    const muapiUrl = 'https://api.muapi.ai/api/v1/models';
    const muapiResponse = await fetch(muapiUrl, {
      headers: {
        'x-api-key': MUAPI_API_KEY || '',
      },
    });

    if (!muapiResponse.ok) {
      const errorText = await muapiResponse.text();
      return new Response(
        JSON.stringify({
          error: `MuAPI catalog fetch failed: ${muapiResponse.status}`,
          details: errorText.slice(0, 200)
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const muapiData = await muapiResponse.json();
    const muapiModels: MuapiModel[] = muapiData.models || [];

    const syncedAt = new Date().toISOString();
    let newCount = 0;
    let updatedCount = 0;
    let removedCount = 0;
    const errors: Array<{ model: string; error: string }> = [];

    // 2. Load existing models
    const { data: existingModels, error: fetchError } = await supabase
      .from('ai_models')
      .select('provider, model_name, enabled, featured, recommended, studios, tags, input_schema, output_schema')
      .eq('provider', 'muapi');

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch existing models', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingMap = new Map(
      (existingModels || []).map((m) => [m.model_name, m])
    );

    // 3. Prepare upsert batch
    const toUpsert: Array<Record<string, unknown>> = [];

    for (const muapiModel of muapiModels) {
      const key = muapiModel.name;
      const existing = existingMap.get(key);

      if (existing) {
        // Merge: preserve SmartVideo-specific metadata
        const merged = {
          provider: 'muapi',
          model_name: muapiModel.name,
          display_name: formatDisplayName(muapiModel.name),
          description: muapiModel.description,
          category: muapiModel.category,
          family: muapiModel.family,
          group_of: muapiModel.group_of,
          endpoint: muapiModel.endpoint,
          estimate_endpoint: muapiModel.estimate_endpoint,
          cost: muapiModel.cost,
          cost_currency: muapiModel.cost_currency || 'USD',
          dynamic_pricing: muapiModel.dynamic_pricing || false,
          enabled: existing.enabled, // Preserve admin config
          featured: existing.featured,
          recommended: existing.recommended,
          studios: existing.studios?.length > 0 ? existing.studios : inferStudios(muapiModel),
          tags: existing.tags?.length > 0 ? existing.tags : inferTags(muapiModel),
          synced_at: syncedAt,
          updated_at: syncedAt,
        };

        const changed =
          merged.description !== existing.description ||
          merged.category !== existing.category ||
          merged.endpoint !== existing.endpoint;

        if (changed) updatedCount++;

        toUpsert.push(merged);
        existingMap.delete(key);
      } else {
        // New model — default to disabled for safety
        const newModel = {
          provider: 'muapi',
          model_name: muapiModel.name,
          display_name: formatDisplayName(muapiModel.name),
          description: muapiModel.description,
          category: muapiModel.category,
          family: muapiModel.family,
          group_of: muapiModel.group_of,
          endpoint: muapiModel.endpoint,
          estimate_endpoint: muapiModel.estimate_endpoint,
          cost: muapiModel.cost,
          cost_currency: muapiModel.cost_currency || 'USD',
          dynamic_pricing: muapiModel.dynamic_pricing || false,
          enabled: false,
          featured: false,
          recommended: false,
          studios: inferStudios(muapiModel),
          tags: inferTags(muapiModel),
          synced_at: syncedAt,
          created_at: syncedAt,
        };
        newCount++;
        toUpsert.push(newModel);
      }
    }

    // 4. Detect removed models
    removedCount = existingMap.size;

    // 5. Batch upsert
    if (toUpsert.length > 0) {
      // Use upsert with onConflict
      const { error: upsertError } = await supabase
        .from('ai_models')
        .upsert(toUpsert, { onConflict: 'provider,model_name' });

      if (upsertError) {
        errors.push({ model: 'batch', error: upsertError.message });
      }
    }

    // 6. Mark removed models
    if (removedCount > 0) {
      for (const [name, model] of existingMap) {
        try {
          await supabase
            .from('ai_models')
            .update({
              tags: [...(model.tags || []), 'removed-from-catalog'],
              synced_at: syncedAt,
            })
            .eq('provider', 'muapi')
            .eq('model_name', name);
        } catch (err) {
          errors.push({
            model: name,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        syncedAt,
        totalModels: muapiModels.length,
        newModels: newCount,
        updatedModels: updatedCount,
        removedModels: removedCount,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[sync-muapi-models] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Sync failed',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function formatDisplayName(name: string): string {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function inferStudios(model: MuapiModel): string[] {
  const category = (model.category || '').toLowerCase();
  const family = (model.family || '').toLowerCase();
  const studios: string[] = [];

  if (category.includes('text-to-image') || family.includes('image')) studios.push('image');
  if (category.includes('image-to-image')) studios.push('image', 'edit');
  if (category.includes('text-to-video') || category.includes('image-to-video') || family.includes('video')) {
    studios.push('video', 'cinema');
  }
  if (category.includes('video-to-video') || category.includes('video-effects')) {
    studios.push('video', 'effects');
  }
  if (category.includes('audio') || family.includes('audio')) studios.push('audio');
  if (category.includes('avatar')) studios.push('avatar', 'character');
  if (category.includes('upscale') || category.includes('enhance')) studios.push('upscale', 'edit');
  if (category.includes('3d') || family.includes('3d')) studios.push('3d');

  if (studios.length === 0) studios.push('image');
  return studios;
}

function inferTags(model: MuapiModel): string[] {
  const tags: string[] = [];
  const category = (model.category || '').toLowerCase();

  if (category.includes('text-to-image')) tags.push('t2i');
  if (category.includes('image-to-image')) tags.push('i2i');
  if (category.includes('text-to-video')) tags.push('t2v');
  if (category.includes('image-to-video')) tags.push('i2v');
  if (category.includes('video-to-video')) tags.push('v2v');
  if (category.includes('audio')) tags.push('audio');
  if (category.includes('avatar')) tags.push('avatar');
  if (model.dynamic_pricing) tags.push('dynamic-pricing');

  return tags;
}
