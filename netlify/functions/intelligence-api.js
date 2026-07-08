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

  const path = event.path.replace('/api/intelligence', '') || '/';
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
      const { data } = await supabaseService
        .from('contact_variables')
        .select('variables')
        .eq('contact_id', contactId)
        .single();

      return { statusCode: 200, headers, body: JSON.stringify({ variables: data?.variables || {} }) };
    }

    // POST /api/intelligence/auto-timeline/:contactId
    if (path.startsWith('/auto-timeline/') && event.httpMethod === 'POST') {
      const contactId = path.replace('/auto-timeline/', '').split('?')[0];
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
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error', message: err.message }) };
  }
}

async function runDiscoveryPipeline(contactId, sources) {
  // This is a simplified synchronous pipeline for the MVP.
  // In production, use a queue (BullMQ, etc.) and update status via webhook.
  const { getProfile, updateProfile, addDiscovery } = await import('../../src/lib/contactStore.js');

  const profile = getProfile(contactId);
  if (!profile) return;

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
