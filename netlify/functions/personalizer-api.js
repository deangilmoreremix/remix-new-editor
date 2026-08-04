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
      .from('personalization_projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', new Date(windowStart).toISOString());
    if (error) return true;
    return (count || 0) < RATE_LIMIT_REQUESTS;
  } catch { return true; }
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

async function checkGitHub(username) {
  try {
    const res = await fetchWithTimeout(
      `https://api.github.com/users/${encodeURIComponent(username)}`,
      { headers: { 'User-Agent': 'VideoRemix-Personalizer', ...(process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {}) } },
      5000
    );
    if (!res.ok) return null;
    const data = await res.json();
    return { platform: 'github', exists: true, public_repos: data.public_repos, followers: data.followers, bio: data.bio, company: data.company, url: data.html_url };
  } catch { return null; }
}

async function callMaigretWorker(username, options, maigretUrl, maigretSecret) {
  // If options already contains usernames, don't add username field
  const payload = options && options.usernames ? { ...options } : { username, ...options };
  const res = await fetchWithTimeout(`${maigretUrl}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': maigretSecret },
    body: JSON.stringify(payload)
  }, 60000);
  if (!res.ok) { const text = await res.text(); throw new Error(`Maigret worker failed (${res.status}): ${text}`); }
  return res.json();
}

async function callOpenAI(apiKey, systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4-turbo-preview', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.7, max_tokens: 2000 }),
      signal: controller.signal
    });
    if (!res.ok) { const text = await res.text(); throw new Error(`OpenAI API error (${res.status}): ${text}`); }
    const data = await res.json();
    return data.choices[0].message.content;
  } finally { clearTimeout(timeout); }
}

async function callGemini(apiKey, systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 2000 } }),
      signal: controller.signal
    });
    if (!res.ok) { const text = await res.text(); throw new Error(`Gemini API error (${res.status}): ${text}`); }
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  } finally { clearTimeout(timeout); }
}

function validateInput(value, type, maxLength = 500) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length > maxLength) return null;
  if (type === 'username' && !/^[a-zA-Z0-9_\-\s,]+$/.test(trimmed)) return null;
  return trimmed;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeCypherString(str) {
  if (str == null) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

export async function handler(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const auth = await verifyAuth(event);
  if (auth.error) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  const userId = auth.user.id;
  if (!await checkRateLimit(userId)) return { statusCode: 429, headers, body: JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }) };

  const path = event.path.replace('/api/personalizer', '');
  let body = {};
  try { if (event.body) body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  try {
    // POST /api/personalizer/scan
    if (path === '/scan' && event.httpMethod === 'POST') {
      // Accept single username (string) or multiple usernames (array, or comma/newline separated string)
      let usernames = [];
      if (Array.isArray(body.targetNames)) {
        usernames = body.targetNames.filter(Boolean);
      } else if (Array.isArray(body.usernames)) {
        usernames = body.usernames.filter(Boolean);
      } else if (body.targetName) {
        const single = validateInput(body.targetName, 'username');
        if (!single) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid targetName required' }) };
        // Split on comma, semicolon, or whitespace for multi-username support
        usernames = single.split(/[,;\s]+/).map(u => u.trim()).filter(Boolean);
      }

      if (usernames.length === 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'targetName or targetNames required' }) };
      }

      // Validate each
      usernames = usernames.map(u => validateInput(u, 'username')).filter(Boolean);
      if (usernames.length === 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid targetName required' }) };
      }
      if (usernames.length > 10) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Maximum 10 usernames per scan' }) };
      }

      const opts = body.options || body;
      const maigretOptions = {
        top: opts.top ? parseInt(opts.top) : 500,
        tags: opts.tags || undefined,
        proxy: opts.proxy || undefined,
        retries: opts.retries ? parseInt(opts.retries) : 1,
        noRecursion: opts.noRecursion === true || opts.disableRecursive === true,
        isParsingEnabled: opts.isParsingEnabled !== false && opts.disableParsing !== true,
        permute: opts.enablePermutations === true,
        checkDomains: opts.withDomains === true,
      };

      // For multi-username, send as array
      const maigretPayload = { ...maigretOptions };
      if (usernames.length === 1) {
        maigretPayload.username = usernames[0];
      } else {
        maigretPayload.usernames = usernames;
      }

      let scanData;
      if (process.env.MAIGRET_WORKER_URL && process.env.MAIGRET_WORKER_SECRET) {
        try {
          scanData = await callMaigretWorker(usernames.length === 1 ? usernames[0] : null, maigretPayload, process.env.MAIGRET_WORKER_URL, process.env.MAIGRET_WORKER_SECRET);
        } catch (maigretError) {
          console.error('Maigret worker failed:', maigretError.message);
          // Fallback to GitHub lookup for the first username
          const github = await checkGitHub(usernames[0]);
          scanData = github ? { summary: `Public presence on GitHub (${github.public_repos} repos)`, platforms: [github], confidence: 0.8, usernames } : null;
        }
      } else {
        const github = await checkGitHub(usernames[0]);
        scanData = github ? { summary: `Public presence on GitHub (${github.public_repos} repos)`, platforms: [github], confidence: 0.8, usernames } : null;
      }

      if (!scanData) scanData = { summary: 'No public scan data found', platforms: [], confidence: 0.0, usernames };

      // Store the target name as a combined string or single
      const targetNameForDb = usernames.length === 1 ? usernames[0] : usernames.join(', ');

      const { data: scan, error: scanError } = await supabaseService.from('profile_scan_results').insert({ user_id: userId, target_name: targetNameForDb, scan_data: scanData }).select().single();
      if (scanError) throw scanError;

      return { statusCode: 200, headers, body: JSON.stringify({ scanId: scan.id, scanData, usernames }) };
    }

    // POST /api/personalizer/generate
    if (path === '/generate' && event.httpMethod === 'POST') {
      const targetName = validateInput(body.targetName, 'username');
      const mode = validateInput(body.mode, 'text', 50);
      if (!targetName || !mode) return { statusCode: 400, headers, body: JSON.stringify({ error: 'targetName and mode required' }) };

      const targetCompany = body.targetCompany ? validateInput(body.targetCompany, 'text', 200) : null;
      const manualNotes = body.manualNotes ? validateInput(body.manualNotes, 'text', 2000) : null;
      const appId = validateInput(body.appId || 'ai-video-agency', 'text', 100);

      let project;
      const { data: existingProject } = await supabaseService.from('personalization_projects').select('*').eq('id', body.projectId || '').eq('user_id', userId).single();
      if (existingProject) {
        project = existingProject;
      } else {
        const { data, error } = await supabaseService.from('personalization_projects').insert({ user_id: userId, app_id: appId, mode, target_name: targetName, target_company: targetCompany, manual_notes: manualNotes, status: 'generating' }).select().single();
        if (error) throw error;
        project = data;
      }

      let scanData = null;
      if (project.scan_id) {
        const { data: scanResult } = await supabaseService.from('profile_scan_results').select('scan_data').eq('id', project.scan_id).eq('user_id', userId).single();
        scanData = scanResult?.scan_data;
      }

      const { data: templates } = await supabaseService.from('personalizer_templates').select('*').eq('app_id', appId).eq('mode', mode);
      const systemPrompt = templates?.find(t => t.template_type === 'system')?.content || 'You are a helpful assistant that generates personalized business content.';
      let userPrompt = templates?.find(t => t.template_type === 'user')?.content || `Generate a ${mode} for ${targetName}`;
      userPrompt = userPrompt
        .replace(/\{\{targetName\}\}/g, targetName)
        .replace(/\{\{targetCompany\}\}/g, targetCompany || 'N/A')
        .replace(/\{\{manualNotes\}\}/g, manualNotes || 'N/A')
        .replace(/\{\{scanData\}\}/g, scanData ? JSON.stringify(scanData, null, 2) : 'No scan data available')
        .replace(/\{\{offer\}\}/g, validateInput(body.offer, 'text', 500) || 'N/A')
        .replace(/\{\{goal\}\}/g, validateInput(body.goal, 'text', 500) || 'N/A')
        .replace(/\{\{tone\}\}/g, validateInput(body.tone, 'text', 50) || 'professional')
        .replace(/\{\{cta\}\}/g, validateInput(body.cta, 'text', 500) || 'N/A')
        // Visual personalization variables
        .replace(/\{\{visualStyle\}\}/g, body.visualStyle || 'cinematic')
        .replace(/\{\{aspectRatio\}\}/g, body.aspectRatio || '16:9')
        .replace(/\{\{storyType\}\}/g, body.storyType || 'founder-story')
        .replace(/\{\{duration\}\}/g, body.durationSeconds || '30');

      let generatedContent;
      try {
        if (process.env.OPENAI_API_KEY) {
          generatedContent = await callOpenAI(process.env.OPENAI_API_KEY, systemPrompt, userPrompt);
        } else { throw new Error('OpenAI API key not configured'); }
      } catch (openaiError) {
        console.error('OpenAI failed:', openaiError.message);
        try {
          if (process.env.GEMINI_API_KEY) {
            generatedContent = await callGemini(process.env.GEMINI_API_KEY, systemPrompt, userPrompt);
          } else { throw new Error('Gemini API key not configured'); }
        } catch (geminiError) {
          console.error('Gemini failed:', geminiError.message);
          generatedContent = `Generated ${mode} for ${targetName} at ${targetCompany || 'N/A'}.\n\nNotes: ${manualNotes || 'None'}\n\nScan Data: ${scanData ? JSON.stringify(scanData, null, 2) : 'None'}`;
        }
      }

      const output = { type: mode, content: generatedContent, metadata: { tone: body.tone || 'professional', offer: body.offer || null, goal: body.goal || null, cta: body.cta || null, scanData: !!scanData } };
      const { error: outputError } = await supabaseService.from('personalization_outputs').insert({ project_id: project.id, output_type: mode, content: output });
      if (outputError) throw outputError;

      await supabaseService.from('personalization_projects').update({ status: 'complete', updated_at: new Date().toISOString() }).eq('id', project.id);

      return { statusCode: 200, headers, body: JSON.stringify({ output, project }) };
    }

    // GET /api/personalizer/apps
    if (path === '/apps' && event.httpMethod === 'GET') {
      const { data, error } = await supabaseService.from('personalizer_apps').select('*');
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify(data || []) };
    }

    // GET /api/personalizer/history
    if (path === '/history' && event.httpMethod === 'GET') {
      const limit = Math.min(parseInt(event.queryStringParameters?.limit || '20'), 100);
      const offset = parseInt(event.queryStringParameters?.offset || '0');
      const { data, error, count } = await supabaseService.from('personalization_projects').select('*', { count: 'exact' }).eq('user_id', userId).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ data, pagination: { total: count, limit, offset, hasMore: offset + (count || 0) > offset + limit } }) };
    }

    // POST /api/personalizer/save
    if (path === '/save' && event.httpMethod === 'POST') {
      if (!body.projectId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'projectId required' }) };
      const { data, error } = await supabaseService.from('personalization_projects').update({ status: 'saved', updated_at: new Date().toISOString() }).eq('id', body.projectId).eq('user_id', userId).select().single();
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // POST /api/personalizer/generate-visual
    if (path === '/generate-visual' && event.httpMethod === 'POST') {
      const targetName = validateInput(body.targetName, 'username');
      const mode = body.mode;
      if (!targetName || !mode) return { statusCode: 400, headers, body: JSON.stringify({ error: 'targetName and mode required' }) };

      const appId = validateInput(body.appId || 'ai-video-agency', 'text', 100);
      const targetCompany = body.targetCompany ? validateInput(body.targetCompany, 'text', 200) : null;
      const manualNotes = body.manualNotes ? validateInput(body.manualNotes, 'text', 2000) : null;
      const visualStyle = validateInput(body.visualStyle, 'text', 50) || 'cinematic';
      const aspectRatio = validateInput(body.aspectRatio, 'text', 10) || '16:9';
      const storyType = validateInput(body.storyType, 'text', 50) || 'founder-story';
      const durationSeconds = Math.min(parseInt(body.durationSeconds) || 30, 120);

      // Get or create project
      let project;
      const { data: existingProject } = await supabaseService.from('personalization_projects').select('*').eq('id', body.projectId || '').eq('user_id', userId).single();
      if (existingProject) {
        project = existingProject;
      } else {
        const { data, error } = await supabaseService.from('personalization_projects').insert({
          user_id: userId, app_id: appId, mode, target_name: targetName,
          target_company: targetCompany, manual_notes: manualNotes,
          visual_style: visualStyle, aspect_ratio: aspectRatio,
          duration_seconds: durationSeconds, status: 'generating'
        }).select().single();
        if (error) throw error;
        project = data;
      }

      // Get scan data if available
      let scanData = null;
      if (project.scan_id) {
        const { data: scanResult } = await supabaseService.from('profile_scan_results').select('scan_data').eq('id', project.scan_id).eq('user_id', userId).single();
        scanData = scanResult?.scan_data;
      }

      // Get prompt templates
      const { data: templates } = await supabaseService.from('personalizer_templates').select('*').eq('app_id', appId).eq('mode', mode);
      const systemPrompt = templates?.find(t => t.template_type === 'system')?.content || 'You are an expert at creating highly personalized visual prompts.';
      let userPrompt = templates?.find(t => t.template_type === 'user')?.content || `Generate a ${mode} for ${targetName}`;

      userPrompt = userPrompt
        .replace(/\{\{targetName\}\}/g, targetName)
        .replace(/\{\{targetCompany\}\}/g, targetCompany || 'N/A')
        .replace(/\{\{manualNotes\}\}/g, manualNotes || 'N/A')
        .replace(/\{\{scanData\}\}/g, scanData ? JSON.stringify(scanData, null, 2) : 'No scan data available')
        .replace(/\{\{offer\}\}/g, validateInput(body.offer, 'text', 500) || 'N/A')
        .replace(/\{\{goal\}\}/g, validateInput(body.goal, 'text', 500) || 'N/A')
        .replace(/\{\{tone\}\}/g, validateInput(body.tone, 'text', 50) || 'professional')
        .replace(/\{\{cta\}\}/g, validateInput(body.cta, 'text', 500) || 'N/A')
        .replace(/\{\{visualStyle\}\}/g, visualStyle)
        .replace(/\{\{aspectRatio\}\}/g, aspectRatio)
        .replace(/\{\{storyType\}\}/g, storyType)
        .replace(/\{\{duration\}\}/g, durationSeconds.toString());

      // Generate visual prompt via AI
      let generatedContent;
      try {
        if (process.env.OPENAI_API_KEY) {
          generatedContent = await callOpenAI(process.env.OPENAI_API_KEY, systemPrompt, userPrompt);
        } else { throw new Error('OpenAI API key not configured'); }
      } catch (openaiError) {
        console.error('OpenAI failed:', openaiError.message);
        try {
          if (process.env.GEMINI_API_KEY) {
            generatedContent = await callGemini(process.env.GEMINI_API_KEY, systemPrompt, userPrompt);
          } else { throw new Error('Gemini API key not configured'); }
        } catch (geminiError) {
          console.error('Gemini failed:', geminiError.message);
          generatedContent = `Visual ${mode} prompt for ${targetName} at ${targetCompany || 'N/A'}. Style: ${visualStyle}. Aspect: ${aspectRatio}. Duration: ${durationSeconds}s.`;
        }
      }

      const output = {
        type: mode,
        content: generatedContent,
        metadata: {
          visualStyle, aspectRatio, storyType, durationSeconds,
          scanData: !!scanData, appId, targetName, targetCompany
        }
      };

      // Save output
      const { error: outputError } = await supabaseService.from('personalization_outputs').insert({
        project_id: project.id, output_type: mode, content: output
      });
      if (outputError) throw outputError;

      // Store placeholder asset entry (actual generation happens client-side via MuAPI)
      const { error: assetError } = await supabaseService.from('personalized_assets').insert({
        project_id: project.id,
        asset_type: mode === 'personalized-video' ? 'video' : 'image',
        generation_prompt: generatedContent,
        status: 'pending',
        metadata: { outputId: project.id, mode, visualStyle, aspectRatio }
      });
      if (assetError) console.error('Asset storage error:', assetError.message);

      await supabaseService.from('personalization_projects').update({ status: 'complete', updated_at: new Date().toISOString() }).eq('id', project.id);

      return { statusCode: 200, headers, body: JSON.stringify({ output, project }) };
    }

    // POST /api/personalizer/send-to-app
    // Hands off a saved project + its scan data to another app (e.g. a
    // video editor, an email composer, a CRM) by writing a small
    // `remix_handoff` envelope to localStorage on the client via a 200
    // response (the client picks it up) and updating the project's
    // handoff_history.
    if (path === '/send-to-app' && event.httpMethod === 'POST') {
      const projectId = body.projectId;
      const targetApp = validateInput(body.targetApp, 'text', 100);
      const handoffPayload = body.payload || {};
      if (!projectId || !targetApp) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'projectId and targetApp required' }) };
      }

      const { data: project, error: projError } = await supabaseService
        .from('personalization_projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single();
      if (projError || !project) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Project not found' }) };
      }

      // Load associated scan + output
      let scanData = null;
      if (project.scan_id) {
        const { data: scanRow } = await supabaseService.from('profile_scan_results').select('scan_data').eq('id', project.scan_id).eq('user_id', userId).single();
        scanData = scanRow?.scan_data || null;
      }
      const { data: outputs } = await supabaseService.from('personalization_outputs').select('*').eq('project_id', project.id).order('created_at', { ascending: false });
      const latestOutput = outputs?.[0] || null;

      // Build the handoff envelope
      const handoffId = crypto.randomUUID();
      const envelope = {
        id: handoffId,
        targetApp,
        createdAt: new Date().toISOString(),
        project: {
          id: project.id,
          appId: project.app_id,
          mode: project.mode,
          targetName: project.target_name,
          targetCompany: project.target_company,
          manualNotes: project.manual_notes,
          status: project.status,
        },
        scanData,
        output: latestOutput?.content || null,
        payload: handoffPayload,
        variables: scanData?.variables || {},
        returnUrl: body.returnUrl || null,
      };

      // Persist a handoff record so the user can audit what was sent where
      const handoffHistory = Array.isArray(project.handoff_history) ? project.handoff_history : [];
      handoffHistory.unshift({
        id: handoffId,
        targetApp,
        timestamp: envelope.createdAt,
        outputId: latestOutput?.id || null,
        scanId: project.scan_id || null,
        returnUrl: envelope.returnUrl,
      });
      // Keep last 50 handoffs per project
      const trimmedHistory = handoffHistory.slice(0, 50);

      await supabaseService
        .from('personalization_projects')
        .update({ handoff_history: trimmedHistory, updated_at: new Date().toISOString() })
        .eq('id', project.id);

      return { statusCode: 200, headers, body: JSON.stringify({ handoffId, envelope }) };
    }

    // GET /api/personalizer/export/:scanId
    // Exports the scan result in the requested format. Defaults to JSON
    // for ingestion by other tools. Supports JSON, HTML (pretty report),
    // Markdown (summary), and CSV (platform table).
    if (path.startsWith('/export/') && event.httpMethod === 'GET') {
      const scanId = path.replace('/export/', '').split('?')[0];
      const format = (event.queryStringParameters?.format || 'json').toLowerCase();

      const { data: scan, error: scanError } = await supabaseService
        .from('profile_scan_results')
        .select('*')
        .eq('id', scanId)
        .eq('user_id', userId)
        .single();
      if (scanError || !scan) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Scan not found' }) };
      }

      const scanData = scan.scan_data || {};
      const targetName = scan.target_name;
      const platforms = Array.isArray(scanData.platforms) ? scanData.platforms : [];
      const summary = scanData.summary || '';

      if (format === 'json') {
        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ targetName, scannedAt: scan.created_at, summary, confidence: scanData.confidence, platforms, warnings: scanData.warnings || [] }, null, 2),
        };
      }

      if (format === 'csv') {
        const rows = ['platform,url,status,username'];
        for (const p of platforms) {
          const platform = (p.platform || '').replace(/"/g, '""');
          const url = (p.url || '').replace(/"/g, '""');
          const status = (p.status || 'found').replace(/"/g, '""');
          const username = (p.username || targetName).replace(/"/g, '""');
          rows.push(`"${platform}","${url}","${status}","${username}"`);
        }
        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${targetName}-maigret.csv"` },
          body: rows.join('\n'),
        };
      }

      if (format === 'md' || format === 'markdown') {
        const lines = [];
        lines.push(`# Maigret scan: ${targetName}`);
        lines.push('');
        lines.push(`**Scanned:** ${scan.created_at}`);
        lines.push(`**Summary:** ${summary}`);
        if (scanData.confidence) lines.push(`**Confidence:** ${(scanData.confidence * 100).toFixed(0)}%`);
        lines.push('');
        lines.push('## Platforms');
        lines.push('');
        lines.push('| Platform | URL | Status |');
        lines.push('| -------- | --- | ------ |');
        for (const p of platforms) {
          lines.push(`| ${p.platform || ''} | [${p.url}](${p.url}) | ${p.status || 'found'} |`);
        }
        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'text/markdown; charset=utf-8' },
          body: lines.join('\n'),
        };
      }

      if (format === 'html') {
        const platformRows = platforms
          .map(
            (p) => `<tr><td>${escapeHtml(p.platform || '')}</td><td><a href="${escapeHtml(p.url)}">${escapeHtml(p.url)}</a></td><td>${escapeHtml(p.status || 'found')}</td></tr>`,
          )
          .join('');
        const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Maigret scan: ${escapeHtml(targetName)}</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;max-width:860px;margin:40px auto;padding:0 24px;color:#1a1a1a;background:#fff}h1{margin-bottom:8px}table{border-collapse:collapse;width:100%;margin-top:24px}th,td{border:1px solid #e5e7eb;padding:8px 12px;text-align:left;font-size:14px}th{background:#f9fafb}a{color:#1d4ed8;text-decoration:none}a:hover{text-decoration:underline}.meta{color:#6b7280;font-size:14px}</style>
</head><body>
<h1>Maigret scan: ${escapeHtml(targetName)}</h1>
<p class="meta">Scanned ${escapeHtml(scan.created_at)}</p>
<p>${escapeHtml(summary)}</p>
${scanData.confidence ? `<p class="meta">Confidence: ${(scanData.confidence * 100).toFixed(0)}%</p>` : ''}
<table>
<thead><tr><th>Platform</th><th>URL</th><th>Status</</tr></thead>
<tbody>${platformRows || '<tr><td colspan="3">No platforms found</td></tr>'}</tbody>
</table>
</body></html>`;
        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
          body: html,
        };
      }

      if (format === 'txt') {
        const lines = [];
        lines.push(`Maigret scan: ${targetName}`);
        lines.push(`Scanned: ${scan.created_at}`);
        lines.push(`Summary: ${summary}`);
        if (scanData.confidence) lines.push(`Confidence: ${(scanData.confidence * 100).toFixed(0)}%`);
        lines.push('');
        lines.push('Platforms:');
        for (const p of platforms) {
          lines.push(`  - ${p.platform || 'unknown'}: ${p.url} (${p.status || 'found'})`);
        }
        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${targetName}-maigret.txt"` },
          body: lines.join('\n'),
        };
      }

      if (format === 'graph') {
        // Standalone interactive graph HTML using vis-network from CDN
        const graph = scanData.graph || { nodes: [], edges: [] };
        const graphJson = JSON.stringify(graph).replace(/</g, '\\u003c');
        const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Maigret graph: ${escapeHtml(targetName)}</title>
<script src="https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
<style>body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#1a1a1a;color:#fff}#header{padding:16px 24px;background:#222;border-bottom:1px solid #333}#header h1{margin:0;font-size:18px}#header p{margin:4px 0 0;color:#888;font-size:13px}#graph{width:100vw;height:calc(100vh - 70px)}</style>
</head><body>
<div id="header"><h1>Maigret graph: ${escapeHtml(targetName)}</h1><p>${escapeHtml(summary)}</p></div>
<div id="graph"></div>
<script>
const data = ${graphJson};
const nodes = data.nodes.map(n => {
  let color = '#3b82f6', shape = 'dot', size = 12;
  if (n.type === 'seed') { color = '#eab308'; shape = 'star'; size = 20; }
  else if (n.type === 'platform') { color = '#22c55e'; shape = 'dot'; size = 14; }
  else if (n.type === 'alias') { color = '#a855f7'; shape = 'triangle'; size = 10; }
  else if (n.type === 'identity') { color = '#06b6d4'; shape = 'box'; size = 10; }
  return { id: n.id, label: n.label, color, shape, size, title: n.url || n.label };
});
const edges = data.edges.map(e => ({ from: e.source, to: e.target, label: e.relation, arrows: 'to', color: '#555' }));
const container = document.getElementById('graph');
const network = new vis.Network(container, { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) }, {
  physics: { enabled: true, solver: 'forceAtlas2Based', forceAtlas2Based: { gravitationalConstant: -50, centralGravity: 0.01, springLength: 100 } },
  interaction: { hover: true, tooltipDelay: 100 }
});
network.on('doubleClick', (params) => { if (params.nodes.length > 0) { const node = nodes.find(n => n.id === params.nodes[0]); if (node && node.title && node.title.startsWith('http')) window.open(node.title, '_blank'); } });
</script>
</body></html>`;
        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="${targetName}-maigret-graph.html"` },
          body: html,
        };
      }

      if (format === 'xmind') {
        // XMind 8 mindmap format (XML)
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmap-content>
  <sheet id="${scanId}" title="${escapeHtml(targetName)}">
    <topic id="root" structure-class="org.xmind.ui.map.unbalanced" timestamp="${new Date().toISOString()}">
      <title>${escapeHtml(targetName)}</title>
      <children>
        <topics type="attached">
          <topic>
            <title>Summary</title>
            <notes><plain>${escapeHtml(summary)}</plain></notes>
          </topic>
          <topic>
            <title>Platforms</title>
            <children>
              <topics type="attached">
                ${platforms.map(p => `<topic><title>${escapeHtml(p.platform || 'unknown')}</title><notes><plain>${escapeHtml(p.url || '')}</plain></notes></topic>`).join('\n                ')}
              </topics>
            </children>
          </topic>
        </topics>
      </children>
    </topic>
  </sheet>
</xmap-content>`;
        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/xml; charset=utf-8', 'Content-Disposition': `attachment; filename="${targetName}-maigret.xmind"` },
          body: xml,
        };
      }

      if (format === 'pdf') {
        // Rich HTML report with print-optimized CSS; browser can print to PDF.
        const platformRows = platforms
          .map(
            (p) => `<tr>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;font-size:14px">${escapeHtml(p.platform || '')}</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;font-size:14px"><a href="${escapeHtml(p.url)}">${escapeHtml(p.url)}</a></td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;font-size:14px">${escapeHtml(p.status || 'found')}</td>
            </tr>`,
          )
          .join('');
        const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Maigret scan: ${escapeHtml(targetName)}</title>
<style>
  @page { size: A4; margin: 24mm; }
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 860px; margin: 0 auto; padding: 24px; color: #1a1a1a; background: #fff; }
  h1 { margin-bottom: 8px; font-size: 24px; }
  .meta { color: #6b7280; font-size: 14px; margin-bottom: 16px; }
  .summary-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
  table { border-collapse: collapse; width: 100%; margin-top: 24px; }
  th, td { border: 1px solid #e5e7eb; padding: 10px 12px; text-align: left; font-size: 14px; }
  th { background: #f9fafb; font-weight: 600; }
  a { color: #1d4ed8; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .confidence { display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; margin-top: 8px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style>
</head><body>
<h1>Maigret scan: ${escapeHtml(targetName)}</h1>
<p class="meta">Scanned ${escapeHtml(scan.created_at)}${scanData.confidence ? ` · Confidence: ${(scanData.confidence * 100).toFixed(0)}%` : ''}</p>
<div class="summary-box">
  <strong>Summary:</strong> ${escapeHtml(summary)}
</div>
<table>
<thead><tr><th>Platform</th><th>URL</th><th>Status</th></tr></thead>
<tbody>${platformRows || '<tr><td colspan="3" style="text-align:center;color:#6b7280;padding:24px">No platforms found</td></tr>'}</tbody>
</table>
<div class="footer">
  <p>Generated by Maigret · ${new Date().toISOString()}</p>
  <p class="no-print">To save as PDF: use your browser's Print → Save as PDF</p>
</div>
</body></html>`;
        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="${targetName}-maigret.pdf.html"` },
          body: html,
        };
      }

      if (format === 'neo4j') {
        // Generate idempotent Neo4j Cypher script from graph data.
        const graph = scanData.graph || { nodes: [], edges: [] };
        const statements = [];
        const nodeIds = new Set();
        const relKeys = new Set();

        for (const node of graph.nodes || []) {
          const nid = escapeCypherString(node.id);
          const label = escapeCypherString(node.label || node.id);
          const ntype = escapeCypherString(node.type || 'Platform');
          const url = node.url ? escapeCypherString(node.url) : null;
          const platform = node.platform ? escapeCypherString(node.platform) : null;
          const username = node.username ? escapeCypherString(node.username) : null;
          const status = node.status ? escapeCypherString(node.status) : null;

          if (!nodeIds.has(nid)) {
            nodeIds.add(nid);
            const props = [`id: '${nid}'`, `label: '${label}'`, `type: '${ntype}'`];
            if (url) props.push(`url: '${url}'`);
            if (platform) props.push(`platform: '${platform}'`);
            if (username) props.push(`username: '${username}'`);
            if (status) props.push(`status: '${status}'`);
            statements.push(`MERGE (n:MaigretNode {id: '${nid}'})\nSET n += {${props.join(', ')}}`);
          }
        }

        for (const edge of graph.edges || []) {
          const src = escapeCypherString(edge.source || '');
          const tgt = escapeCypherString(edge.target || '');
          const rel = escapeCypherString(edge.relation || 'RELATED');
          const key = `${src}|${tgt}|${rel}`;
          if (src && tgt && !relKeys.has(key)) {
            relKeys.add(key);
            statements.push(`MATCH (a:MaigretNode {id: '${src}'}), (b:MaigretNode {id: '${tgt}'})\nMERGE (a)-[r:${rel}]->(b)`);
          }
        }

        const cypher = statements.join(';\n\n') + ';';
        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/octet-stream; charset=utf-8', 'Content-Disposition': `attachment; filename="${targetName}-maigret.cypher"` },
          body: cypher,
        };
      }

      return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown format: ${format}. Supported: json, csv, md, html, txt, graph, xmind, pdf, neo4j` }) };
    }

    // POST /api/personalizer/analyze
    // AI analysis mode: builds a Maigret-style Markdown report from scan data
    // and sends it to OpenAI to produce a short investigation summary.
    if (path === '/analyze' && event.httpMethod === 'POST') {
      const scanId = validateInput(body.scanId, 'text', 100);
      if (!scanId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'scanId is required' }) };

      const { data: scan, error: scanError } = await supabaseService
        .from('profile_scan_results')
        .select('*')
        .eq('id', scanId)
        .eq('user_id', userId)
        .single();
      if (scanError || !scan) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Scan not found' }) };
      }

      const scanData = scan.scan_data || {};
      const targetName = scan.target_name;
      const platforms = Array.isArray(scanData.platforms) ? scanData.platforms : [];
      const summary = scanData.summary || '';

      // Build Markdown report in Maigret format
      const lines = [];
      lines.push(`# Maigret scan: ${targetName}`);
      lines.push('');
      lines.push(`**Scanned:** ${scan.created_at}`);
      lines.push(`**Summary:** ${summary}`);
      if (scanData.confidence) lines.push(`**Confidence:** ${(scanData.confidence * 100).toFixed(0)}%`);
      lines.push('');
      lines.push('## Platforms');
      lines.push('');
      for (const p of platforms) {
        lines.push(`- **${p.platform || 'unknown'}**: ${p.url} (${p.status || 'found'})`);
        const ids = p.ids_data || {};
        if (ids.name) lines.push(`  - Name: ${ids.name}`);
        if (ids.bio) lines.push(`  - Bio: ${ids.bio}`);
        if (ids.company) lines.push(`  - Company: ${ids.company}`);
        if (ids.location) lines.push(`  - Location: ${ids.location}`);
        if (ids.avatar_url) lines.push(`  - Avatar: ${ids.avatar_url}`);
      }
      lines.push('');
      lines.push('## Statistics');
      lines.push('');
      lines.push(`- Sites checked: ${scanData.sitesChecked || 0}`);
      lines.push(`- Sites found: ${scanData.sitesFound || 0}`);
      lines.push(`- Platforms: ${platforms.length}`);

      const markdownReport = lines.join('\n');

      // AI analysis system prompt
      const systemPrompt = `You are an OSINT investigation assistant. Given a Maigret scan report, produce a short, neutral investigation summary in exactly this format:

REAL NAME: [most likely real name or "Unknown"]
LOCATION: [most likely location or "Unknown"]
OCCUPATION: [most likely occupation/role or "Unknown"]
INTERESTS: [comma-separated interests or "Unknown"]
LANGUAGES: [comma-separated languages or "Unknown"]
MAIN WEBSITE: [primary website or "None"]
USERNAME VARIANTS: [comma-separated variants found or "None"]
PLATFORMS FOUND: [count]
ACTIVE YEARS: [estimate or "Unknown"]
CONFIDENCE: [High/Medium/Low]
FOLLOW-UP LEADS: [bullet list of follow-up investigation suggestions]

Keep it concise. Do not invent information. If unsure, say "Unknown".`;

      let analysisSummary = '';
      try {
        if (process.env.OPENAI_API_KEY) {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'gpt-4-turbo-preview',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: markdownReport },
              ],
              temperature: 0.7,
              max_tokens: 1000,
            }),
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`OpenAI API error (${res.status}): ${text}`);
          }
          const data = await res.json();
          analysisSummary = data.choices?.[0]?.message?.content || 'No analysis generated.';
        } else {
          throw new Error('OpenAI API key not configured');
        }
      } catch (err) {
        console.error('AI analysis failed:', err.message);
        analysisSummary = `AI analysis unavailable: ${err.message}`;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          scanId,
          targetName,
          markdownReport,
          analysisSummary,
          generatedAt: new Date().toISOString(),
        }),
      };
    }

    // GET /api/personalizer/scans - list scan history for current user
    if (path === '/scans' && event.httpMethod === 'GET') {
      const limit = Math.min(parseInt(event.queryStringParameters?.limit || '20'), 100);
      const offset = parseInt(event.queryStringParameters?.offset || '0');
      const { data, error, count } = await supabaseService
        .from('profile_scan_results')
        .select('id, target_name, created_at, scan_data', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      const summary = (data || []).map(row => ({
        id: row.id,
        targetName: row.target_name,
        scannedAt: row.created_at,
        sitesFound: row.scan_data?.sitesFound || 0,
        sitesChecked: row.scan_data?.sitesChecked || 0,
        confidence: row.scan_data?.confidence || 0,
        usernames: row.scan_data?.usernames || [row.target_name],
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ data: summary, pagination: { total: count, limit, offset, hasMore: offset + (count || 0) > offset + limit } }) };
    }

    // GET /api/personalizer/settings - get user scan settings
    if (path === '/settings' && event.httpMethod === 'GET') {
      const { data, error } = await supabaseService
        .from('user_scan_settings')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ settings: data || { default_top: 500, default_timeout_ms: 15000, permute_enabled: false, disable_recursion: false, check_domains: false } }) };
    }

    // POST /api/personalizer/settings - save user scan settings
    if (path === '/settings' && event.httpMethod === 'POST') {
      const settings = body.settings || {};
      const payload = {
        user_id: userId,
        default_top: Math.min(2500, Math.max(1, parseInt(settings.default_top) || 500)),
        default_timeout_ms: Math.min(60000, Math.max(5000, parseInt(settings.default_timeout_ms) || 15000)),
        permute_enabled: settings.permute_enabled === true,
        disable_recursion: settings.disable_recursion === true,
        check_domains: settings.check_domains === true,
        proxy: settings.proxy || null,
        tor_proxy: settings.tor_proxy || null,
        i2p_proxy: settings.i2p_proxy || null,
        dark_mode: settings.dark_mode === true,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabaseService
        .from('user_scan_settings')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ settings: data }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Endpoint not found' }) };
  } catch (err) {
    console.error('API Error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'An internal error occurred. Please try again later.' }) };
  }
}
