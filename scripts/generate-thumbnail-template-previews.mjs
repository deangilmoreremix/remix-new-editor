#!/usr/bin/env node

/**
 * generate-thumbnail-template-previews.mjs
 *
 * Admin/dev script to generate preview images for thumbnail templates
 * that don't have previews yet.
 *
 * Usage:
 *   node scripts/generate-thumbnail-template-previews.mjs [options]
 *
 * Options:
 *   --template=<id>       Generate preview for a specific template only
 *   --force               Overwrite existing previews
 *   --dry-run             Show what would be generated without calling APIs
 *   --update-registry     Update previewUrl in the registry file after generation
 *   --help, -h            Show this help message
 *
 * Environment variables:
 *   VITE_SUPABASE_URL           Supabase project URL (required)
 *   VITE_SUPABASE_ANON_KEY      Supabase anon/public key (required)
 *   SUPABASE_SERVICE_ROLE_KEY   Service role key (required for storage uploads)
 *   OPENAI_API_KEY              OpenAI API key (optional; forwarded to edge function)
 *
 * The script calls the ai-thumbnail-generator edge function's `generate` action
 * with each template's `previewPrompt`, then uploads the resulting image to
 * Supabase Storage under `template-thumbnails/previews/{templateId}.webp`.
 *
 * This script is for development/admin use only and is NOT part of the
 * normal user-facing application.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const REGISTRY_PATH = resolve(PROJECT_ROOT, 'src/lib/thumbnailTemplateRegistry.js');
const PUBLIC_THUMBNAILS_DIR = resolve(PROJECT_ROOT, 'public/thumbnails/templates');
const BUCKET = 'template-thumbnails';
const STORAGE_PREFIX = 'previews';
const EDGE_FUNCTION = 'ai-thumbnail-generator';

// ---------------------------------------------------------------------------
// Minimal .env loader (avoids adding a runtime dependency)
// ---------------------------------------------------------------------------

function loadEnvFile() {
  const envPath = join(PROJECT_ROOT, '.env');
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, 'utf-8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = {
    template: null,
    force: false,
    dryRun: false,
    updateRegistry: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg.startsWith('--template=')) {
      flags.template = arg.slice('--template='.length);
    } else if (arg === '--force') {
      flags.force = true;
    } else if (arg === '--dry-run') {
      flags.dryRun = true;
    } else if (arg === '--update-registry') {
      flags.updateRegistry = true;
    }
  }

  return flags;
}

function printHelp() {
  console.log(`
Usage: node scripts/generate-thumbnail-template-previews.mjs [options]

Options:
  --template=<id>       Generate preview for a specific template only
  --force               Overwrite existing previews
  --dry-run             Show what would be generated without calling APIs
  --update-registry     Update previewUrl in the registry file after generation
  --help, -h            Show this help message

Environment:
  VITE_SUPABASE_URL           Supabase project URL (required)
  VITE_SUPABASE_ANON_KEY      Supabase anon key (required)
  SUPABASE_SERVICE_ROLE_KEY   Service role key (required for storage uploads)
  OPENAI_API_KEY              OpenAI API key (optional)

Examples:
  node scripts/generate-thumbnail-template-previews.mjs --dry-run
  node scripts/generate-thumbnail-template-previews.mjs --template=creator-reaction
  node scripts/generate-thumbnail-template-previews.mjs --force --update-registry
`);
}

// ---------------------------------------------------------------------------
// Load template registry
// ---------------------------------------------------------------------------

async function loadTemplateRegistry() {
  try {
    const module = await import(REGISTRY_PATH);
    const templates = module.THUMBNAIL_TEMPLATES || {};
    return Object.entries(templates).map(([key, template]) => ({
      key,
      ...template,
    }));
  } catch (err) {
    console.error(`Failed to load template registry from ${REGISTRY_PATH}:`, err.message);
    console.error('Ensure the file exists and all dependencies are resolvable.');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Preview existence checks
// ---------------------------------------------------------------------------

async function listStoragePreviews(supabase) {
  let files = [];
  try {
    const { data, error } = await supabase.storage.from(BUCKET).list(STORAGE_PREFIX, {
      limit: 100,
    });
    if (!error && Array.isArray(data)) {
      files = data.map((f) => f.name);
    }
  } catch {
    // Storage may not be reachable yet; treat as empty
  }
  return files;
}

async function previewExists(supabase, templateId, storageFiles) {
  const fileName = `${templateId}.webp`;

  const localPath = join(PUBLIC_THUMBNAILS_DIR, fileName);
  if (existsSync(localPath)) {
    return { exists: true, location: 'local', path: localPath };
  }

  if (storageFiles.includes(fileName)) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${STORAGE_PREFIX}/${fileName}`);
    return { exists: true, location: 'supabase', url: data.publicUrl };
  }

  return { exists: false };
}

// ---------------------------------------------------------------------------
// Edge function invocation
// ---------------------------------------------------------------------------

async function callEdgeFunction(supabaseUrl, supabaseAnonKey, body) {
  const url = `${supabaseUrl}/functions/v1/${EDGE_FUNCTION}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      // ignore
    }
    throw new Error(`Edge function error (${res.status}): ${detail || res.statusText}`);
  }

  return res.json();
}

async function generatePreviewImage(supabaseUrl, supabaseAnonKey, template, openAiKey) {
  const body = {
    action: 'generate',
    prompt: template.previewPrompt,
    aspectRatio: '16:9',
    model: 'gpt-image-2',
    quality: 'high',
    n: 1,
    outputFormat: 'webp',
  };

  if (openAiKey) {
    body.apiKey = openAiKey;
  }

  const data = await callEdgeFunction(supabaseUrl, supabaseAnonKey, body);

  if (data?.error) {
    throw new Error(data.error);
  }

  const candidate = data?.candidates?.[0];
  if (!candidate?.b64_json) {
    throw new Error('No image data returned from edge function');
  }

  return candidate.b64_json;
}

// ---------------------------------------------------------------------------
// Storage upload (mirrors uploadBufferToStorage in the edge function)
// ---------------------------------------------------------------------------

async function uploadToStorage(supabase, templateId, b64) {
  const base64Data = String(b64).replace(/^data:image\/\w+;base64,/, '');
  const binary = Buffer.from(base64Data, 'base64');
  const buffer = new Uint8Array(binary);

  const path = `${STORAGE_PREFIX}/${templateId}.webp`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'image/webp', upsert: true });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ---------------------------------------------------------------------------
// Registry file update
// ---------------------------------------------------------------------------

function updateRegistryFile(templateId, newPreviewUrl) {
  const oldPreviewUrl = `/thumbnails/templates/${templateId}.webp`;
  let content = readFileSync(REGISTRY_PATH, 'utf-8');

  if (!content.includes(oldPreviewUrl)) {
    console.warn(`  Could not find old preview path "${oldPreviewUrl}" in registry file; skipping registry update.`);
    return false;
  }

  const newContent = content.replace(oldPreviewUrl, newPreviewUrl);

  if (newContent === content) {
    console.warn(`  No changes needed in registry file.`);
    return false;
  }

  writeFileSync(REGISTRY_PATH, newContent, 'utf-8');
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadEnvFile();

  const flags = parseArgs(process.argv.slice(2));

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  // Validate environment
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl) {
    console.error('Error: VITE_SUPABASE_URL environment variable is required.');
    process.exit(1);
  }
  if (!supabaseAnonKey) {
    console.error('Error: VITE_SUPABASE_ANON_KEY environment variable is required.');
    process.exit(1);
  }
  if (!supabaseServiceKey && !flags.dryRun) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY is required for storage uploads.');
    console.error('       Omit --dry-run to skip uploads without this key.');
    process.exit(1);
  }

  // Supabase client for storage operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

  // Load templates
  const templates = await loadTemplateRegistry();

  if (templates.length === 0) {
    console.log('No templates found in registry.');
    process.exit(0);
  }

  // Filter by template flag
  const targetTemplates = flags.template
    ? templates.filter((t) => t.id === flags.template || t.key === flags.template)
    : templates;

  if (flags.template && targetTemplates.length === 0) {
    console.error(`Template "${flags.template}" not found in registry.`);
    process.exit(1);
  }

  // Cache existing storage files to avoid repeated API calls
  const storageFiles = flags.dryRun ? [] : await listStoragePreviews(supabase);

  const results = {
    success: [],
    skipped: [],
    failed: [],
  };

  console.log(`Processing ${targetTemplates.length} template(s)...\n`);

  for (const template of targetTemplates) {
    const templateId = template.id;
    const templateName = template.name || templateId;

    // Check if preview already exists
    const existing = await previewExists(supabase, templateId, storageFiles);

    if (existing.exists && !flags.force) {
      const reason = `Preview already exists (${existing.location})`;
      results.skipped.push({ id: templateId, name: templateName, reason });
      console.log(`  [SKIP] ${templateName} (${templateId}): ${reason}`);
      continue;
    }

    if (flags.dryRun) {
      console.log(`  [DRY RUN] Would generate: ${templateName} (${templateId})`);
      results.skipped.push({ id: templateId, name: templateName, reason: 'Dry run' });
      continue;
    }

    // Generate preview
    console.log(`  [GEN ] ${templateName} (${templateId})`);

    try {
      const b64 = await generatePreviewImage(supabaseUrl, supabaseAnonKey, template, openAiKey);
      const sizeKB = Math.round((b64.length * 0.75) / 1024);
      console.log(`       Generated ${sizeKB}KB base64`);

      const publicUrl = await uploadToStorage(supabase, templateId, b64);
      console.log(`       Uploaded: ${publicUrl}`);

      if (flags.updateRegistry) {
        const updated = updateRegistryFile(templateId, publicUrl);
        if (updated) {
          console.log(`       Registry file updated`);
        }
      }

      results.success.push({ id: templateId, name: templateName, url: publicUrl });
    } catch (err) {
      results.failed.push({ id: templateId, name: templateName, error: err.message });
      console.error(`       Error: ${err.message}`);
    }
  }

  // Summary report
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Total processed:    ${targetTemplates.length}`);
  console.log(`  Generated:          ${results.success.length}`);
  console.log(`  Skipped:            ${results.skipped.length}`);
  console.log(`  Failed:             ${results.failed.length}`);

  if (results.success.length > 0) {
    console.log('\nGenerated previews:');
    for (const s of results.success) {
      console.log(`  ${s.id}: ${s.url}`);
    }

    if (!flags.updateRegistry) {
      console.log('\nUpdate the registry file with these previewUrl values:');
      for (const s of results.success) {
        console.log(`  ${s.id}: '${s.url}'`);
      }
    }
  }

  if (results.failed.length > 0) {
    console.log('\nFailures:');
    for (const f of results.failed) {
      console.log(`  ${f.id}: ${f.error}`);
    }
  }

  if (results.failed.length > 0) {
    process.exitCode = 1;
  }
}

main();
