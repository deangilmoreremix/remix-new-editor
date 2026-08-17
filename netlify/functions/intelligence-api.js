// netlify/functions/intelligence-api.js
import { createClient } from '@supabase/supabase-js';

const supabaseService = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RATE_LIMIT_REQUESTS = 20;
const RATE_LIMIT_WINDOW = 60 * 1000;

async function checkRateLimit(userId) {
  try {
    const windowStart = Date.now() - RATE_LIMIT_WINDOW;
    const { count, error } = await supabaseService
      .from('contact_discoveries')
      .select('*', { count: 'exact', head: true })
      .eq('contact_id', (await getContactIdForUser(userId)) || '00000000-0000-0000-0000-000000000000')
      .gte('created_at', new Date(windowStart).toISOString());
    if (error) return true;
    return (count || 0) < RATE_LIMIT_REQUESTS;
  } catch { return true; }
}

async function getContactIdForUser(userId) {
  // For rate limiting, we just need a rough count. Use discoveries table as proxy.
  return null;
}

async function verifyAuth(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) return { error: 'Missing or invalid authorization header' };
  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabaseService.auth.getUser(token);
    if (error || !user) return { error: 'Invalid or expired token' };
    return { user };
  } catch { return { error: 'Token verification failed' }; }
}

async function fetchWithTimeout(url, options, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}

function validateInput(value, type, maxLength = 500) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length > maxLength) return null;
  if (type === 'username' && !/^[a-zA-Z0-9_\-]+$/.test(trimmed)) return null;
  return trimmed;
}

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Normalize the incoming request path to a route relative to this function.
 *
 * `event.path` may arrive as either the original public path
 * (`/api/intelligence/contacts`) or the rewritten function path
 * (`/.netlify/functions/intelligence-api/contacts`) depending on the
 * redirect rule, `netlify dev`, or the Vite dev proxy. Strip whichever
 * prefix is present so routing works in every environment instead of
 * silently falling through to the terminal 404.
 */
function normalizeRoute(rawPath) {
  let route = String(rawPath || '');
  route = route.split('?')[0];
  for (const prefix of ['/.netlify/functions/intelligence-api', '/api/intelligence']) {
    if (route.startsWith(prefix)) {
      route = route.slice(prefix.length);
      break;
    }
  }
  if (route.length > 1 && route.endsWith('/')) route = route.slice(0, -1);
  return route || '/';
}

/**
 * Verify that `contactId` belongs to `userId`.
 *
 * This module's Supabase client uses the SERVICE_ROLE key and therefore
 * bypasses Row Level Security, so every handler must filter by user_id
 * itself. Several read routes (`/profile/:id`, `/assets/:id`,
 * `/variables/:id`, `/auto-timeline/:id`) previously queried by contact_id
 * alone, which let any authenticated user read any other user's contact
 * intelligence, assets and derived scenes by guessing an id.
 *
 * @returns {boolean} true when the caller owns the contact
 */
async function userOwnsContact(contactId, userId) {
  if (!contactId || !userId) return false;
  const { data } = await supabaseService
    .from('contacts')
    .select('id')
    .eq('id', contactId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

export async function handler(event, context) {
  const headers = corsHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const auth = await verifyAuth(event);
  if (auth.error) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: auth.error }) };
  }

  const userId = auth.user.id;
  if (!await checkRateLimit(userId)) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }) };
  }

  const path = normalizeRoute(event.path);
  let body = {};
  try { if (event.body) body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  try {
    // POST /api/intelligence/contact
    if (path === '/contact' && event.httpMethod === 'POST') {
      const name = validateInput(body.name, 'text', 200);
      if (!name) return { statusCode: 400, headers, body: JSON.stringify({ error: 'name is required' }) };

      const { data: contact, error } = await supabaseService
        .from('contacts')
        .insert({
          user_id: userId,
          name,
          email: body.email,
          phone: body.phone,
          company: body.company,
          title: body.title,
          location: body.location,
          source: body.source || 'manual',
          source_id: body.sourceId,
        })
        .select()
        .single();

      if (error) throw error;

      // Initialize empty profile + variables
      await supabaseService.from('contact_profiles').insert({
        contact_id: contact.id,
        profile: {},
        discovery_status: 'pending',
      });
      await supabaseService.from('contact_variables').insert({
        contact_id: contact.id,
        variables: {},
      });

      return { statusCode: 200, headers, body: JSON.stringify({ contactId: contact.id, contact }) };
    }

    // GET /api/intelligence/contacts
    if (path === '/contacts' && event.httpMethod === 'GET') {
      const limit = Math.min(parseInt(event.queryStringParameters?.limit || '20'), 100);
      const offset = parseInt(event.queryStringParameters?.offset || '0');
      const source = event.queryStringParameters?.source;

      let query = supabaseService
        .from('contacts')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (source) query = query.eq('source', source);

      const { data, error, count } = await query;
      if (error) throw error;

      return { statusCode: 200, headers, body: JSON.stringify({ data: data || [], pagination: { total: count, limit, offset, hasMore: (count || 0) > offset + limit } }) };
    }

    // GET /api/intelligence/profile/:contactId
    if (path.startsWith('/profile/') && event.httpMethod === 'GET') {
      const contactId = path.replace('/profile/', '').split('?')[0];
      // 404 rather than 403 so we don't confirm the existence of other
      // users' contact ids.
      if (!await userOwnsContact(contactId, userId)) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Profile not found' }) };
      }
      const { data: profile } = await supabaseService
        .from('contact_profiles')
        .select('*')
        .eq('contact_id', contactId)
        .single();

      if (!profile) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Profile not found' }) };

      return { statusCode: 200, headers, body: JSON.stringify(profile.profile || {}) };
    }

    // POST /api/intelligence/discover
    if (path === '/discover' && event.httpMethod === 'POST') {
      const contactId = validateInput(body.contactId, 'uuid');
      if (!contactId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'contactId is required' }) };

      // Verify ownership
      const { data: contact } = await supabaseService.from('contacts').select('id').eq('id', contactId).eq('user_id', userId).single();
      if (!contact) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Contact not found' }) };

      // Update status to discovering
      await supabaseService.from('contact_profiles').update({ discovery_status: 'discovering' }).eq('contact_id', contactId);

      // Kick off async discovery (fire and forget for now; in production use a queue)
      const sources = body.sources || ['maigret', 'github', 'website'];
      runDiscoveryPipeline(contactId, sources).catch((err) => {
        console.error('[intelligence] discovery pipeline failed:', err);
        supabaseService.from('contact_profiles').update({ discovery_status: 'failed' }).eq('contact_id', contactId);
      });

      return { statusCode: 200, headers, body: JSON.stringify({ jobId: contactId, status: 'discovering' }) };
    }

    // GET /api/intelligence/assets/:contactId
    if (path.startsWith('/assets/') && event.httpMethod === 'GET') {
      const contactId = path.replace('/assets/', '').split('?')[0];
      if (!await userOwnsContact(contactId, userId)) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Contact not found' }) };
      }
      const { data: assets } = await supabaseService
        .from('contact_assets')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      return { statusCode: 200, headers, body: JSON.stringify({ data: assets || [] }) };
    }

    // GET /api/intelligence/variables/:contactId
    if (path.startsWith('/variables/') && event.httpMethod === 'GET') {
      const contactId = path.replace('/variables/', '').split('?')[0];
      if (!await userOwnsContact(contactId, userId)) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Contact not found' }) };
      }
      const { data } = await supabaseService
        .from('contact_variables')
        .select('variables')
        .eq('contact_id', contactId)
        .single();

      return { statusCode: 200, headers, body: JSON.stringify({ variables: data?.variables || {} }) };
    }

    // POST /api/intelligence/assets/:contactId
    // Runs the asset discovery orchestrator (logo / colors / avatar /
    // screenshot), re-uploads to Supabase storage when configured, and
    // merges the discovered assets + brand colors into the contact profile.
    if (path.startsWith('/assets/') && event.httpMethod === 'POST') {
      const contactId = path.replace('/assets/', '').split('?')[0];
      const { data: contact } = await supabaseService.from('contacts').select('id, user_id').eq('id', contactId).eq('user_id', userId).single();
      if (!contact) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Contact not found' }) };

      const { data: profileRow } = await supabaseService
        .from('contact_profiles')
        .select('profile')
        .eq('contact_id', contactId)
        .single();
      const profile = profileRow?.profile || {};

      const websiteUrl = profile.website?.url;
      const websiteHtml = profile.website?.pages?.[0]?.text
        ? `<html><head>${profile.website.pages[0].title ? `<title>${profile.website.pages[0].title}</title>` : ''}</head><body>${profile.website.pages[0].text}</body></html>`
        : undefined;

      const maigretPlatforms = (profile.history?.discoveries || [])
        .filter((d) => d.source === 'maigret' && d.success)
        .map((d) => d.data?.platforms)
        .filter(Boolean)
        .flat();

      const result = await runAssetDiscovery({
        websiteUrl,
        websiteHtml,
        maigretAvatars: maigretPlatforms.map((p) => p.ids_data?.avatar_url).filter(Boolean),
        githubAvatarUrl: profile.contact?.avatarUrl,
        contactAvatarUrl: profile.contact?.avatarUrl,
      });

      const allDiscovered = [...result.logos, ...result.avatars, ...result.screenshots];
      for (const a of allDiscovered) {
        await supabaseService.from('contact_assets').insert({
          contact_id: contactId,
          asset_type: a.assetType,
          url: a.url,
          storage_path: a.storagePath || null,
          metadata: { ...(a.metadata || {}), discoveredFrom: a.source },
        });
      }

      const newAssets = {
        avatar: dedupe([...(profile.assets?.avatar || []), ...result.avatars.map((a) => a.url)]),
        logos: dedupe([...(profile.assets?.logos || []), ...result.logos.map((a) => a.url)]),
        productImages: dedupe([...(profile.assets?.productImages || [])]),
        icons: dedupe([...(profile.assets?.icons || [])]),
        videos: dedupe([...(profile.assets?.videos || [])]),
      };
      const newBrandColors = {
        ...(profile.brand?.colors || {}),
        ...(result.brandColors.primary ? { primary: result.brandColors.primary } : {}),
        ...(result.brandColors.secondary ? { secondary: result.brandColors.secondary } : {}),
        ...(result.brandColors.accent ? { accent: result.brandColors.accent } : {}),
      };
      profile.assets = newAssets;
      profile.brand = { ...(profile.brand || {}), colors: newBrandColors };
      profile.updatedAt = new Date().toISOString();

      await supabaseService.from('contact_profiles').update({ profile, updated_at: profile.updatedAt }).eq('contact_id', contactId);

      return { statusCode: 200, headers, body: JSON.stringify({ contactId, ...result, assets: newAssets, brandColors: newBrandColors }) };
    }

    // POST /api/intelligence/auto-timeline/:contactId
    if (path.startsWith('/auto-timeline/') && event.httpMethod === 'POST') {
      const contactId = path.replace('/auto-timeline/', '').split('?')[0];
      if (!await userOwnsContact(contactId, userId)) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Profile not found' }) };
      }
      const { data: profileRow } = await supabaseService
        .from('contact_profiles')
        .select('profile')
        .eq('contact_id', contactId)
        .single();

      if (!profileRow) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Profile not found' }) };

      const profile = profileRow.profile;
      const scenes = buildAutoTimelineScenes(profile, body);
      return { statusCode: 200, headers, body: JSON.stringify({ contactId, scenes }) };
    }

    // POST /api/intelligence/enrich
    // Runs OpenAI Responses API structured extraction against the current
    // profile's raw discovery data (Maigret, GitHub, website) and writes
    // the resulting company/intelligence/brand fields back to the profile.
    if (path === '/enrich' && event.httpMethod === 'POST') {
      const contactId = validateInput(body.contactId, 'uuid');
      if (!contactId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'contactId is required' }) };

      const apiKey = process.env.OPENAI_API_KEY;
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

      // Verify ownership
      const { data: contact } = await supabaseService.from('contacts').select('id, name, company').eq('id', contactId).eq('user_id', userId).single();
      if (!contact) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Contact not found' }) };

      const { data: profileRow } = await supabaseService
        .from('contact_profiles')
        .select('profile')
        .eq('contact_id', contactId)
        .single();

      if (!profileRow) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Profile not found' }) };

      const profile = profileRow.profile || {};

      // Build the raw text payload from the profile
      const parts = [];
      const social = profile.social || {};
      const website = profile.website || {};
      const intel = profile.intelligence || {};
      if (intel.summary) parts.push(`Summary: ${intel.summary}`);
      if (social.github) parts.push(`GitHub URL: ${social.github}`);
      if (website.description) parts.push(`Website description: ${website.description}`);
      if (website.title) parts.push(`Website title: ${website.title}`);
      if (contact.company) parts.push(`Company: ${contact.company}`);
      if (social.website) parts.push(`Website: ${social.website}`);

      const rawText = parts.join('\n').trim() || `Contact: ${contact.name}`;

      // Call OpenAI Responses API with strict json_schema
      const openaiRes = await fetchWithTimeout('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          input: [
            { role: 'system', content: 'You are a data extraction assistant. Always return valid JSON only. No markdown, no explanations.' },
            { role: 'user', content: `Extract structured business intelligence from the text below.\n\nText:\n${rawText.slice(0, 4000)}\n\nReturn JSON with: company { name, domain, industry, size, summary }, intelligence { summary, products[], services[], painPoints[], interests[], buyingSignals[], tone }, brand { colors: { primary, secondary, accent } }.` },
          ],
          text: {
            format: {
              type: 'json_schema',
              json_schema: {
                name: 'ContactIntelligence',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    company: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        domain: { type: 'string' },
                        industry: { type: 'string' },
                        size: { type: 'string' },
                        summary: { type: 'string' },
                      },
                      required: ['name'],
                    },
                    intelligence: {
                      type: 'object',
                      properties: {
                        summary: { type: 'string' },
                        products: { type: 'array', items: { type: 'string' } },
                        services: { type: 'array', items: { type: 'string' } },
                        painPoints: { type: 'array', items: { type: 'string' } },
                        interests: { type: 'array', items: { type: 'string' } },
                        buyingSignals: { type: 'array', items: { type: 'string' } },
                        tone: { type: 'string', enum: ['formal', 'casual', 'technical', 'friendly'] },
                      },
                    },
                    brand: {
                      type: 'object',
                      properties: {
                        colors: {
                          type: 'object',
                          properties: {
                            primary: { type: 'string' },
                            secondary: { type: 'string' },
                            accent: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                  required: ['company'],
                },
              },
            },
          },
        }),
      }, 20000);

      if (!openaiRes.ok) {
        const t = await openaiRes.text();
        return { statusCode: 502, headers, body: JSON.stringify({ error: 'OpenAI request failed', detail: t.slice(0, 500) }) };
      }

      const openaiData = await openaiRes.json();
      const textContent = openaiData?.output?.find((o) => o.type === 'message')?.content?.[0]?.text;
      if (!textContent) return { statusCode: 502, headers, body: JSON.stringify({ error: 'OpenAI returned empty content' }) };

      let extracted;
      try { extracted = JSON.parse(textContent); } catch { return { statusCode: 502, headers, body: JSON.stringify({ error: 'OpenAI returned invalid JSON' }) }; }

      // Merge extracted fields into the profile
      profile.company = { ...(profile.company || {}), ...(extracted.company || {}) };
      profile.intelligence = { ...(profile.intelligence || {}), ...(extracted.intelligence || {}) };
      if (extracted.brand?.colors) {
        profile.brand = profile.brand || {};
        profile.brand.colors = { ...(profile.brand.colors || {}), ...extracted.brand.colors };
      }
      profile.updatedAt = new Date().toISOString();

      // Rebuild variables
      const variables = profile.variables || {};
      if (profile.contact?.firstName) variables.firstName = profile.contact.firstName;
      if (profile.contact?.lastName) variables.lastName = profile.contact.lastName;
      if (profile.contact?.name) variables.fullName = profile.contact.name;
      if (profile.contact?.company) variables.company = profile.contact.company;
      if (profile.contact?.email) variables.email = profile.contact.email;
      if (profile.contact?.title) variables.title = profile.contact.title;
      if (profile.contact?.location) variables.location = profile.contact.location;
      if (profile.company?.name) variables.companyName = profile.company.name;
      if (profile.company?.industry) variables.industry = profile.company.industry;
      if (profile.company?.summary) variables.companySummary = profile.company.summary;
      if (profile.intelligence?.summary) variables.intelligenceSummary = profile.intelligence.summary;
      if (profile.intelligence?.painPoints?.[0]) variables.painPoint = profile.intelligence.painPoints[0];
      if (profile.intelligence?.products?.[0]) variables.product = profile.intelligence.products[0];
      if (profile.intelligence?.services?.[0]) variables.service = profile.intelligence.services[0];
      if (profile.intelligence?.tone) variables.tone = profile.intelligence.tone;
      if (profile.brand?.colors?.primary) variables.brandColor = profile.brand.colors.primary;
      if (profile.assets?.logos?.[0]) variables.logoUrl = profile.assets.logos[0];
      if (profile.assets?.avatar?.[0]) variables.avatarUrl = profile.assets.avatar[0];
      if (social.github) variables.github = social.github;
      if (social.linkedin) variables.linkedin = social.linkedin;
      if (social.twitter) variables.twitter = social.twitter;
      if (social.website) variables.website = social.website;
      profile.variables = variables;

      // Persist
      await supabaseService.from('contact_profiles').update({ profile, updated_at: new Date().toISOString() }).eq('contact_id', contactId);
      await supabaseService.from('contact_variables').upsert({ contact_id: contactId, variables });

      return { statusCode: 200, headers, body: JSON.stringify({ contactId, profile, variables }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
  } catch (err) {
    console.error('[intelligence-api] error:', err);
    // Don't leak internal error details (stack-adjacent messages, table
    // names, upstream provider responses) to the client. The full error is
    // still logged above for operators.
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'An internal error occurred. Please try again later.' }) };
  }
}

// ─── Server-side profile store ───────────────────────────────────────────────
//
// The discovery pipeline used to `await import('../../src/lib/contactStore.js')`
// — a browser module backed by localStorage — from inside a Lambda. That file
// does not exist, so the import threw immediately and EVERY /discover call
// failed. Because /discover is fire-and-forget, callers still received
// `200 {status:'discovering'}` while the pipeline silently died and the
// profile was left marked 'failed'.
//
// These helpers replace it with the Supabase-backed equivalents the function
// already has a client for.

/** Load a contact's profile JSON, seeding the empty shape if absent. */
async function loadProfile(contactId) {
  const { data } = await supabaseService
    .from('contact_profiles')
    .select('profile')
    .eq('contact_id', contactId)
    .maybeSingle();
  if (!data) return null;

  const profile = data.profile || {};
  // Guarantee the nested containers the pipeline writes into exist, so it
  // doesn't have to null-guard every assignment.
  profile.contact = profile.contact || {};
  profile.company = profile.company || {};
  profile.brand = profile.brand || {};
  profile.social = profile.social || {};
  profile.website = profile.website || {};
  profile.assets = profile.assets || {};
  profile.intelligence = profile.intelligence || {};
  profile.history = profile.history || {};
  profile.history.discoveries = profile.history.discoveries || [];
  profile.variables = profile.variables || {};
  return profile;
}

/** Persist the profile JSON for a contact. */
async function saveProfile(contactId, profile) {
  const { error } = await supabaseService
    .from('contact_profiles')
    .update({ profile, updated_at: new Date().toISOString() })
    .eq('contact_id', contactId);
  if (error) console.error('[intelligence] saveProfile failed:', error.message);
}

/**
 * Record a discovery attempt, both in the audit table and on the profile's
 * own history (which the asset extractors read back).
 *
 * The in-memory history push happens synchronously, before the awaited insert,
 * because call sites intentionally don't await this — the asset discovery step
 * later in the pipeline reads `profile.history.discoveries` and must see the
 * Maigret entry regardless of DB latency.
 */
function recordDiscovery(contactId, profile, source, status, data = null, error = null, durationMs = null) {
  if (profile?.history?.discoveries) {
    profile.history.discoveries.push({
      source,
      status,
      success: status === 'success',
      timestamp: new Date().toISOString(),
      data,
      error,
    });
  }

  return supabaseService
    .from('contact_discoveries')
    .insert({
      contact_id: contactId,
      source,
      status,
      data,
      error,
      duration_ms: durationMs,
    })
    .then(({ error: insertError }) => {
      if (insertError) console.error('[intelligence] recordDiscovery insert failed:', insertError.message);
    })
    .catch((err) => console.error('[intelligence] recordDiscovery insert failed:', err.message));
}

async function runDiscoveryPipeline(contactId, sources) {
  // This is a simplified synchronous pipeline for the MVP.
  // In production, use a queue (BullMQ, etc.) and update status via webhook.
  const profile = await loadProfile(contactId);
  if (!profile) return;

  // Bound to this contact + profile so the call sites stay terse.
  const addDiscovery = (cid, source, status, data, error, durationMs) =>
    recordDiscovery(contactId, profile, source, status, data, error, durationMs);

  // Maigret
  if (sources.includes('maigret')) {
    try {
      const maigretUrl = process.env.MAIGRET_WORKER_URL;
      const maigretSecret = process.env.MAIGRET_WORKER_SECRET;
      if (maigretUrl && maigretSecret) {
        const username = profile.contact.firstName
          ? `${profile.contact.firstName}${profile.contact.lastName || ''}`.replace(/\s+/g, '')
          : profile.contact.name;
        const res = await fetchWithTimeout(`${maigretUrl}/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': maigretSecret },
          body: JSON.stringify({ username, top: 500, isParsingEnabled: true }),
        }, 60000);
        if (res.ok) {
          const data = await res.json();
          // Extract social URLs
          for (const p of (data.platforms || [])) {
            const platform = p.platform?.toLowerCase();
            if (platform === 'github') profile.social.github = p.url;
            else if (platform === 'linkedin') profile.social.linkedin = p.url;
            else if (platform === 'twitter' || platform === 'x') profile.social.twitter = p.url;
            else if (platform === 'youtube') profile.social.youtube = p.url;
            else if (platform === 'instagram') profile.social.instagram = p.url;
            else if (platform === 'mastodon') profile.social.mastodon = p.url;
            if (p.ids_data?.avatar_url && !profile.assets.avatar?.length) {
              profile.assets.avatar = [p.ids_data.avatar_url];
            }
          }
          addDiscovery(contactId, 'maigret', 'success', data);
        } else {
          addDiscovery(contactId, 'maigret', 'failed', null, `HTTP ${res.status}`);
        }
      } else {
        addDiscovery(contactId, 'maigret', 'failed', null, 'MAIGRET_WORKER_URL not configured');
      }
    } catch (err) {
      addDiscovery(contactId, 'maigret', 'failed', null, err.message);
    }
  }

  // GitHub
  if (sources.includes('github')) {
    try {
      const githubUsername = profile.social.github
        ? profile.social.github.split('/').pop()
        : `${profile.contact.firstName || ''}${profile.contact.lastName || ''}`.replace(/\s+/g, '');
      if (githubUsername) {
        const res = await fetchWithTimeout(`https://api.github.com/users/${encodeURIComponent(githubUsername)}`, {
          headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'remix-new-editor-personalizer' },
        }, 5000);
        if (res.ok) {
          const user = await res.json();
          profile.social.github = user.html_url;
          if (!profile.contact.avatarUrl && user.avatar_url) {
            profile.assets.avatar = [user.avatar_url];
            profile.contact.avatarUrl = user.avatar_url;
          }
          if (user.company && !profile.contact.company) profile.contact.company = user.company;
          if (user.bio && !profile.intelligence.summary) profile.intelligence.summary = user.bio;
          addDiscovery(contactId, 'github', 'success', user);
        } else {
          addDiscovery(contactId, 'github', 'failed', null, `HTTP ${res.status}`);
        }
      }
    } catch (err) {
      addDiscovery(contactId, 'github', 'failed', null, err.message);
    }
  }

  // Website
  if (sources.includes('website')) {
    try {
      let websiteUrl = profile.social.website;
      if (!websiteUrl && profile.contact.company) {
        websiteUrl = `https://${profile.contact.company.toLowerCase().replace(/\s+/g, '')}.com`;
      }
      if (websiteUrl) {
        const res = await fetchWithTimeout(websiteUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; remix-new-editor/1.0)' },
        }, 10000);
        if (res.ok) {
          const html = await res.text();
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
          profile.website = {
            ...profile.website,
            url: websiteUrl,
            title: titleMatch?.[1]?.trim(),
            description: descMatch?.[1]?.trim(),
          };
          addDiscovery(contactId, 'website', 'success', { url: websiteUrl, title: profile.website.title });
        } else {
          addDiscovery(contactId, 'website', 'failed', null, `HTTP ${res.status}`);
        }
      }
    } catch (err) {
      addDiscovery(contactId, 'website', 'failed', null, err.message);
    }
  }

  // Build variables
  const variables = {};
  if (profile.contact.firstName) variables.firstName = profile.contact.firstName;
  if (profile.contact.lastName) variables.lastName = profile.contact.lastName;
  if (profile.contact.name) variables.fullName = profile.contact.name;
  if (profile.contact.company) variables.company = profile.contact.company;
  if (profile.contact.email) variables.email = profile.contact.email;
  if (profile.contact.title) variables.title = profile.contact.title;
  if (profile.contact.location) variables.location = profile.contact.location;
  if (profile.company.name) variables.companyName = profile.company.name;
  if (profile.company.industry) variables.industry = profile.company.industry;
  if (profile.company.summary) variables.companySummary = profile.company.summary;
  if (profile.intelligence.painPoints?.[0]) variables.painPoint = profile.intelligence.painPoints[0];
  if (profile.intelligence.products?.[0]) variables.product = profile.intelligence.products[0];
  if (profile.brand.colors?.primary) variables.brandColor = profile.brand.colors.primary;
  if (profile.assets.logos?.[0]) variables.logoUrl = profile.assets.logos[0];
  if (profile.assets.avatar?.[0]) variables.avatarUrl = profile.assets.avatar[0];

  // Optional: run OpenAI enrichment to produce structured intelligence
  // from the raw Maigret/GitHub/website data. This is a best-effort step —
  // if OpenAI is not configured or fails, the discovery still completes
  // with whatever raw fields were collected.
  if (process.env.OPENAI_API_KEY) {
    try {
      const openaiKey = process.env.OPENAI_API_KEY;
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const rawParts = [
        profile.intelligence.summary,
        profile.website.description,
        profile.website.title,
        profile.social.github ? `GitHub: ${profile.social.github}` : '',
        profile.contact.company ? `Company: ${profile.contact.company}` : '',
      ].filter(Boolean);
      const rawText = rawParts.join('\n').trim() || `Contact: ${profile.contact.name}`;

      const openaiRes = await fetchWithTimeout('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model,
          input: [
            { role: 'system', content: 'You are a data extraction assistant. Always return valid JSON only. No markdown, no explanations.' },
            { role: 'user', content: `Extract structured business intelligence from the text below.\n\nText:\n${rawText.slice(0, 4000)}\n\nReturn JSON with: company { name, domain, industry, size, summary }, intelligence { summary, products[], services[], painPoints[], interests[], buyingSignals[], tone }, brand { colors: { primary, secondary, accent } }.` },
          ],
          text: {
            format: {
              type: 'json_schema',
              json_schema: {
                name: 'ContactIntelligence',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    company: { type: 'object', properties: { name: { type: 'string' }, domain: { type: 'string' }, industry: { type: 'string' }, size: { type: 'string' }, summary: { type: 'string' } }, required: ['name'] },
                    intelligence: { type: 'object', properties: { summary: { type: 'string' }, products: { type: 'array', items: { type: 'string' } }, services: { type: 'array', items: { type: 'string' } }, painPoints: { type: 'array', items: { type: 'string' } }, interests: { type: 'array', items: { type: 'string' } }, buyingSignals: { type: 'array', items: { type: 'string' } }, tone: { type: 'string', enum: ['formal', 'casual', 'technical', 'friendly'] } } },
                    brand: { type: 'object', properties: { colors: { type: 'object', properties: { primary: { type: 'string' }, secondary: { type: 'string' }, accent: { type: 'string' } } } } },
                  },
                  required: ['company'],
                },
              },
            },
          },
        }),
      }, 20000);

      if (openaiRes.ok) {
        const openaiData = await openaiRes.json();
        const textContent = openaiData?.output?.find((o) => o.type === 'message')?.content?.[0]?.text;
        if (textContent) {
          try {
            const extracted = JSON.parse(textContent);
            profile.company = { ...(profile.company || {}), ...(extracted.company || {}) };
            profile.intelligence = { ...(profile.intelligence || {}), ...(extracted.intelligence || {}) };
            if (extracted.brand?.colors) {
              profile.brand = profile.brand || {};
              profile.brand.colors = { ...(profile.brand.colors || {}), ...extracted.brand.colors };
            }
            // Update variables with new structured fields
            if (profile.company.industry) variables.industry = profile.company.industry;
            if (profile.company.summary) variables.companySummary = profile.company.summary;
            if (profile.intelligence.summary) variables.intelligenceSummary = profile.intelligence.summary;
            if (profile.intelligence.painPoints?.[0]) variables.painPoint = profile.intelligence.painPoints[0];
            if (profile.intelligence.products?.[0]) variables.product = profile.intelligence.products[0];
            if (profile.intelligence.services?.[0]) variables.service = profile.intelligence.services[0];
            if (profile.intelligence.tone) variables.tone = profile.intelligence.tone;
            if (profile.brand.colors?.primary) variables.brandColor = profile.brand.colors.primary;
            addDiscovery(contactId, 'openai', 'success', { tokens: textContent.length });
          } catch {
            addDiscovery(contactId, 'openai', 'failed', null, 'Invalid JSON from OpenAI');
          }
        }
      } else {
        addDiscovery(contactId, 'openai', 'failed', null, `HTTP ${openaiRes.status}`);
      }
    } catch (err) {
      addDiscovery(contactId, 'openai', 'failed', null, err.message);
    }
  }

  await supabaseService.from('contact_variables').upsert({
    contact_id: contactId,
    variables,
  });

  profile.variables = variables;

  // Optional: run the asset discovery orchestrator (logo / colors /
  // avatar / screenshot). Best-effort — failure here doesn't fail the
  // overall discovery pipeline. Re-uploads to Supabase storage when
  // SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + ASSETS_BUCKET are set.
  try {
    const assets = await runAssetDiscovery({
      websiteUrl: profile.website?.url,
      websiteHtml: profile.website?.pages?.[0]?.text
        ? `<html><head>${profile.website.pages[0].title ? `<title>${profile.website.pages[0].title}</title>` : ''}</head><body>${profile.website.pages[0].text}</body></html>`
        : undefined,
      maigretAvatars: (profile.history?.discoveries || [])
        .filter((d) => d.source === 'maigret' && d.success)
        .map((d) => d.data?.platforms)
        .filter(Boolean)
        .flat()
        .map((p) => p.ids_data?.avatar_url)
        .filter(Boolean),
      githubAvatarUrl: profile.contact?.avatarUrl,
      contactAvatarUrl: profile.contact?.avatarUrl,
    });

    // Persist to contact_assets
    for (const a of [...assets.logos, ...assets.avatars, ...assets.screenshots]) {
      try {
        await supabaseService.from('contact_assets').insert({
          contact_id: contactId,
          asset_type: a.assetType,
          url: a.url,
          storage_path: a.storagePath || null,
          metadata: { ...(a.metadata || {}), discoveredFrom: a.source },
        });
      } catch {}
    }

    profile.assets = {
      avatar: dedupe([...(profile.assets?.avatar || []), ...assets.avatars.map((a) => a.url)]),
      logos: dedupe([...(profile.assets?.logos || []), ...assets.logos.map((a) => a.url)]),
      productImages: dedupe([...(profile.assets?.productImages || [])]),
      icons: dedupe([...(profile.assets?.icons || [])]),
      videos: dedupe([...(profile.assets?.videos || [])]),
    };
    profile.brand = { ...(profile.brand || {}), colors: {
      ...(profile.brand?.colors || {}),
      ...(assets.brandColors.primary ? { primary: assets.brandColors.primary } : {}),
      ...(assets.brandColors.secondary ? { secondary: assets.brandColors.secondary } : {}),
      ...(assets.brandColors.accent ? { accent: assets.brandColors.accent } : {}),
    } };
    if (assets.brandColors.primary) variables.brandColor = assets.brandColors.primary;

    addDiscovery(contactId, 'assets', assets.errors.length ? 'failed' : 'success', { logoCount: assets.logos.length, avatarCount: assets.avatars.length, screenshotCount: assets.screenshots.length }, assets.errors.length ? assets.errors[0].error : undefined, assets.durationMs);
  } catch (err) {
    addDiscovery(contactId, 'assets', 'failed', null, err.message);
  }

  profile.discovery_status = 'complete';
  profile.last_discovered_at = new Date().toISOString();

  await supabaseService.from('contact_profiles').update({
    profile,
    discovery_status: 'complete',
    last_discovered_at: new Date().toISOString(),
  }).eq('contact_id', contactId);
}

function buildAutoTimelineScenes(profile, opts) {
  const firstName = profile.variables?.firstName || profile.contact?.firstName || 'there';
  const company = profile.variables?.company || profile.contact?.company || '';
  const painPoint = profile.intelligence?.painPoints?.[0];
  const product = profile.intelligence?.products?.[0];
  const logoUrl = profile.assets?.logos?.[0];
  const avatarUrl = profile.assets?.avatar?.[0];
  const brandColor = profile.brand?.colors?.primary;

  const scenes = [];

  scenes.push({
    beat: 'intro',
    prompt: `Brand intro card for ${company}. ${brandColor ? `Brand color: ${brandColor}.` : ''} ${logoUrl ? `Logo: ${logoUrl}.` : ''} Minimalist, professional.`,
    durationSeconds: 3,
    assetHints: logoUrl ? { image: logoUrl } : undefined,
  });

  scenes.push({
    beat: 'greeting',
    prompt: `Hey ${firstName}. ${profile.intelligence?.summary ? profile.intelligence.summary + '.' : ''}`,
    durationSeconds: 4,
  });

  if (painPoint) {
    scenes.push({
      beat: 'pain-point',
      prompt: `${firstName}, I know ${painPoint.toLowerCase()} is a real challenge at ${company}.`,
      durationSeconds: 5,
    });
  }

  if (product) {
    scenes.push({
      beat: 'solution',
      prompt: `That's why ${product} matters for ${company}.`,
      durationSeconds: 6,
    });
  }

  if (avatarUrl) {
    scenes.push({
      beat: 'visual',
      prompt: `Visual: portrait of ${firstName}`,
      durationSeconds: 5,
      assetHints: { image: avatarUrl },
    });
  }

  scenes.push({
    beat: 'closing',
    prompt: `Close with ${firstName} and ${company}. Professional, warm, memorable.`,
    durationSeconds: 3,
  });

  return scenes;
}

// ---------------------------------------------------------------------------
// Asset discovery (inlined JS port of packages/assets/src/extractors/*
// so the Netlify function doesn't need a TS build step)
// ---------------------------------------------------------------------------

function dedupe(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

async function runAssetDiscovery({ websiteUrl, websiteHtml, maigretAvatars = [], githubAvatarUrl, contactAvatarUrl }) {
  const logos = [];
  const avatars = [];
  const screenshots = [];
  const brandColors = {};
  const errors = [];
  const started = Date.now();

  // 1. Logo from website HTML
  if (websiteHtml) {
    try {
      const candidates = detectLogoCandidates(websiteHtml, websiteUrl || '');
      if (candidates[0]) logos.push({ assetType: 'logo', url: candidates[0], source: { source: 'website', sourceUrl: candidates[0], discoveredAt: new Date().toISOString() } });
    } catch (err) { errors.push({ source: 'logo', error: err.message }); }

    try {
      const colors = extractColorsFromHtml(websiteHtml);
      if (colors.primary) brandColors.primary = colors.primary;
      if (colors.secondary) brandColors.secondary = colors.secondary;
      if (colors.accent) brandColors.accent = colors.accent;
    } catch (err) { errors.push({ source: 'colors', error: err.message }); }
  }

  // 2. Avatars (deduped, maigret first then github then manual)
  const seen = new Set();
  const pushAvatar = (url, source) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    avatars.push({ assetType: 'headshot', url, source: { source, sourceUrl: url, discoveredAt: new Date().toISOString() } });
  };
  for (const url of maigretAvatars) pushAvatar(url, 'maigret');
  pushAvatar(githubAvatarUrl, 'github');
  pushAvatar(contactAvatarUrl, 'manual');

  // 3. Screenshot (OG image fallback)
  if (websiteHtml) {
    const og = websiteHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (og) {
      const url = resolveUrl(websiteUrl || '', og[1]);
      screenshots.push({ assetType: 'screenshot', url, source: { source: 'website', sourceUrl: url, discoveredAt: new Date().toISOString() }, metadata: { source: 'og:image' } });
    }
  }

  return { logos, avatars, screenshots, brandColors, errors, durationMs: Date.now() - started };
}

function detectLogoCandidates(html, baseUrl) {
  const candidates = [];
  const resolve = (raw) => resolveUrl(baseUrl, raw);
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogImage) candidates.push({ url: resolve(ogImage[1]), score: 70 });
  const appleMatches = html.matchAll(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/gi);
  for (const m of appleMatches) candidates.push({ url: resolve(m[1]), score: 80 });
  const iconMatches = html.matchAll(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*?>/gi);
  for (const m of iconMatches) {
    const tag = m[0];
    const href = tag.match(/href=["']([^"']+)["']/i);
    if (!href) continue;
    const sizes = tag.match(/sizes=["'](\d+)x(\d+)["']/i);
    const size = sizes ? parseInt(sizes[1], 10) * parseInt(sizes[2], 10) : 16;
    candidates.push({ url: resolve(href[1]), score: 30 + Math.min(60, Math.round(size / 100)) });
  }
  const logoImgs = html.matchAll(/<img[^>]+(?:class|alt)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/gi);
  for (const m of logoImgs) candidates.push({ url: resolve(m[1]), score: 85 });
  const seen = new Set();
  const uniq = candidates.filter((c) => {
    if (seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
  uniq.sort((a, b) => b.score - a.score);
  return uniq.map((c) => c.url);
}

function extractColorsFromHtml(html) {
  const out = {};
  const theme = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
  if (theme) {
    const norm = normalizeColor(theme[1]);
    if (norm) out.primary = norm;
  }
  const styles = [];
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) if (m[1]) styles.push(m[1]);
  const freq = new Map();
  for (const css of styles) {
    for (const m of css.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi)) {
      const norm = normalizeColor(`#${m[1]}`);
      if (norm && isBrandWorthy(norm)) freq.set(norm, (freq.get(norm) || 0) + 1);
    }
    for (const m of css.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi)) {
      const norm = rgbToHex(+m[1], +m[2], +m[3]);
      if (norm && isBrandWorthy(norm)) freq.set(norm, (freq.get(norm) || 0) + 1);
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  if (!out.primary && sorted[0]) out.primary = sorted[0][0];
  if (sorted[1]) out.secondary = sorted[1][0];
  for (const [color] of sorted) {
    if (color !== out.primary && colorDistance(color, out.primary || '#000000') > 80) {
      out.accent = color;
      break;
    }
  }
  return out;
}

function normalizeColor(raw) {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{8}$/.test(s)) return s.slice(0, 7);
  const named = { black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff' };
  return named[s];
}

function isBrandWorthy(hex) {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  if (luma < 25 || luma > 235) return false;
  if (Math.max(r, g, b) - Math.min(r, g, b) < 12) return false;
  return true;
}

function colorDistance(a, b) {
  const ma = a.replace('#', ''); const mb = b.replace('#', '');
  const dr = parseInt(ma.slice(0, 2), 16) - parseInt(mb.slice(0, 2), 16);
  const dg = parseInt(ma.slice(2, 4), 16) - parseInt(mb.slice(2, 4), 16);
  const db = parseInt(ma.slice(4, 6), 16) - parseInt(mb.slice(4, 6), 16);
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function rgbToHex(r, g, b) {
  const to = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function resolveUrl(base, relative) {
  try { return new URL(relative, base).toString(); } catch { return relative; }
}
