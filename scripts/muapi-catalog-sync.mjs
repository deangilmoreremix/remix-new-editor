#!/usr/bin/env node

/**
 * MuAPI Catalog Sync Script
 *
 * Syncs the MuAPI model catalog and studio features from the upstream repo
 * (Anil-matcha/Open-Generative-AI) into the SmartVideo app.
 *
 * Targets:
 *   - src/lib/models.js (model catalog)
 *   - src/lib/modelFamilies.js, modelCapabilities.js, etc. (supporting files)
 *   - src/lib/studio-components/ (advanced controls & shared components)
 *
 * Usage:
 *   node scripts/muapi-catalog-sync.mjs [--source upstream|local] [--dry-run] [--verbose]
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SRC_LIB = path.join(REPO_ROOT, 'src', 'lib');
const STUDIO_COMPONENTS = path.join(SRC_LIB, 'studio-components');

const UPSTREAM_REMOTE = 'upstream-muapi';
const UPSTREAM_URL = 'https://github.com/Anil-matcha/Open-Generative-AI.git';
const MODELS_DUMP_PATH = 'models_dump.json';

const MODEL_TYPES = ['t2i', 'i2i', 't2v', 'i2v', 'v2v', 'lipsync', 'audio', 'recast'];

const ARRAY_NAMES = {
  t2i: 't2iModels',
  i2i: 'i2iModels',
  t2v: 't2vModels',
  i2v: 'i2vModels',
  v2v: 'v2vModels',
  lipsync: 'lipsyncModels',
  audio: 'audioModels',
  recast: 'recastModels',
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    source: 'upstream',
    dryRun: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--source':
        options.source = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        console.log(`
MuAPI Catalog Sync Script

Usage:
  node scripts/muapi-catalog-sync.mjs [options]

Options:
  --source <upstream|local>  Source to pull catalog from (default: upstream)
  --dry-run                  Preview changes without writing files
  --verbose                  Show detailed output
  --help, -h                 Show this help message
`);
        process.exit(0);
        break;
      default:
        console.warn(`Unknown argument: ${args[i]}`);
    }
  }

  if (options.source !== 'upstream' && options.source !== 'local') {
    console.error(`Invalid source: ${options.source}. Must be "upstream" or "local".`);
    process.exit(1);
  }

  return options;
}

function log(message, level = 'info') {
  const prefix = { info: '[INFO]', warn: '[WARN]', error: '[ERROR]', debug: '[DEBUG]' };
  const line = `${prefix[level] || '[????]'} ${message}`;
  if (level === 'debug') return;
  if (level === 'warn') console.warn(line);
  else if (level === 'error') console.error(line);
  else console.log(line);
}

function logVerbose(message, options) {
  if (options.verbose) console.log(`  ${message}`);
}

function ensureUpstreamRemote() {
  try {
    const remotes = execSync('git remote', { encoding: 'utf8', cwd: REPO_ROOT });
    if (!remotes.includes(UPSTREAM_REMOTE)) {
      log(`Adding upstream remote: ${UPSTREAM_REMOTE}`);
      execSync(`git remote add ${UPSTREAM_REMOTE} ${UPSTREAM_URL}`, {
        encoding: 'utf8',
        cwd: REPO_ROOT,
        stdio: 'inherit',
      });
    }
  } catch (err) {
    console.error('Failed to ensure upstream remote:', err.message);
    process.exit(1);
  }
}

function fetchFromUpstream() {
  log('Fetching from upstream remote...');
  try {
    execSync(`git fetch ${UPSTREAM_REMOTE}`, {
      encoding: 'utf8',
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('Failed to fetch from upstream:', err.message);
    process.exit(1);
  }
}

function getModelsDumpFromUpstream() {
  ensureUpstreamRemote();
  fetchFromUpstream();

  log('Extracting models_dump.json from upstream...');
  try {
    const content = execSync(
      `git show ${UPSTREAM_REMOTE}/main:${MODELS_DUMP_PATH}`,
      { encoding: 'utf8', cwd: REPO_ROOT }
    );
    return content;
  } catch (err) {
    console.error('Failed to extract models_dump.json from upstream:', err.message);
    process.exit(1);
  }
}

function getModelsDumpFromLocal(localPath) {
  log(`Reading models_dump.json from local path: ${localPath}`);
  const resolved = path.isAbsolute(localPath)
    ? localPath
    : path.join(REPO_ROOT, localPath);

  if (!fs.existsSync(resolved)) {
    console.error(`Local file not found: ${resolved}`);
    process.exit(1);
  }

  return fs.readFileSync(resolved, 'utf8');
}

// Files that exist upstream in packages/studio/src/ and should be copied directly
// rather than regenerated (they contain refined logic beyond what we can generate).
const UPSTREAM_STUDIO_FILES = [
  'modelFamilies.js',
  'modelCapabilities.js',
  'modelParameters.js',
  'muapi.js',
  'imageSizing.js',
  'imageInputContracts.js',
  'videoMediaInputs.js',
  'videoToolCapabilities.js',
  'videoWorkflows.js',
  'persistKey.js',
];

function copyFileFromUpstream(fileName) {
  // Determine upstream path based on file location
  let upstreamPath;
  if (fileName.startsWith('components/')) {
    upstreamPath = `packages/studio/src/${fileName}`;
  } else if (fileName.startsWith('prompt/')) {
    upstreamPath = `packages/studio/src/components/${fileName}`;
  } else if (fileName.startsWith('utils/')) {
    upstreamPath = `packages/studio/src/${fileName}`;
  } else {
    upstreamPath = `packages/studio/src/${fileName}`;
  }
  try {
    const content = execSync(
      `git show ${UPSTREAM_REMOTE}/main:${upstreamPath}`,
      { encoding: 'utf8', cwd: REPO_ROOT }
    );
    logVerbose(`Copied ${fileName} from upstream`, { verbose: true });
    return content;
  } catch (err) {
    log(`Could not copy ${fileName} from upstream: ${err.message}`, 'warn');
    return null;
  }
}

function parseModelsDump(content) {
  let data;
  try {
    data = JSON.parse(content);
  } catch (err) {
    console.error('Failed to parse models_dump.json:', err.message);
    process.exit(1);
  }

  const catalog = {};
  const counts = {};

  for (const type of MODEL_TYPES) {
    if (Array.isArray(data[type])) {
      catalog[type] = data[type];
      counts[type] = data[type].length;
    } else if (type === 'recast' && !data[type]) {
      catalog[type] = [];
      counts[type] = 0;
    } else {
      catalog[type] = [];
      counts[type] = 0;
      log(`Type "${type}" not found or not an array in catalog`, 'warn');
    }
  }

  return { catalog, counts };
}

function writeFile(filePath, content, options) {
  if (options.dryRun) {
    logVerbose(`Would write: ${path.relative(REPO_ROOT, filePath)}`, options);
    return;
  }

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, 'utf8');
  logVerbose(`Wrote: ${path.relative(REPO_ROOT, filePath)}`, options);
}

function generateModelsJs(catalog) {
  const lines = [];
  lines.push('// Auto-generated by muapi-catalog-sync.mjs. Do not edit manually.');
  lines.push('// Source: Anil-matcha/Open-Generative-AI (upstream-muapi)');
  lines.push('');

  for (const type of MODEL_TYPES) {
    if (catalog[type] && catalog[type].length > 0) {
      lines.push(`export const ${ARRAY_NAMES[type]} = ${JSON.stringify(catalog[type], null, 2)};`);
      lines.push('');
    }
  }

  lines.push('const ALL_MODELS = {');
  for (const type of MODEL_TYPES) {
    if (catalog[type] && catalog[type].length > 0) {
      lines.push(`  ${type}: ${ARRAY_NAMES[type]},`);
    }
  }
  lines.push('};');
  lines.push('');

  lines.push('export function getModelById(id) {');
  lines.push('  for (const type of Object.keys(ALL_MODELS)) {');
  lines.push('    const model = ALL_MODELS[type].find((m) => m.id === id);');
  lines.push('    if (model) return { ...model, _type: type };');
  lines.push('  }');
  lines.push('  return null;');
  lines.push('}');
  lines.push('');

  lines.push('export function getModelsByType(type) {');
  lines.push('  return ALL_MODELS[type] || [];');
  lines.push('}');
  lines.push('');

  lines.push('export function getAllModels() {');
  lines.push('  const result = [];');
  lines.push('  for (const [type, models] of Object.entries(ALL_MODELS)) {');
  lines.push('    for (const model of models) {');
  lines.push('      result.push({ ...model, _type: type });');
  lines.push('    }');
  lines.push('  }');
  lines.push('  return result;');
  lines.push('}');
  lines.push('');

  lines.push('export function getModelTypes() {');
  lines.push('  return Object.keys(ALL_MODELS);');
  lines.push('}');

  return lines.join('\n') + '\n';
}

function generateModelFamiliesJs(catalog) {
  const families = new Map();

  for (const models of Object.values(catalog)) {
    for (const model of models) {
      const provider = model.provider || 'unknown';
      if (!families.has(provider)) {
        families.set(provider, { name: model.provider_name || provider, models: [] });
      }
      families.get(provider).models.push(model.id);
    }
  }

  const lines = [];
  lines.push('// Auto-generated by muapi-catalog-sync.mjs. Do not edit manually.');
  lines.push('// Source: Anil-matcha/Open-Generative-AI (upstream-muapi)');
  lines.push('');
  lines.push(`import { getAllModels } from './models.js';`);
  lines.push('');
  lines.push('const FAMILY_MAP = new Map();');
  lines.push('');

  for (const [provider, info] of families) {
    lines.push(`FAMILY_MAP.set('${provider}', ${JSON.stringify(info)});`);
  }

  lines.push('');
  lines.push('export function getFamilies() {');
  lines.push('  return Array.from(FAMILY_MAP.entries()).map(([id, info]) => ({');
  lines.push('    id,');
  lines.push('    ...info,');
  lines.push('  }));');
  lines.push('}');
  lines.push('');

  lines.push('export function getFamily(provider) {');
  lines.push('  const info = FAMILY_MAP.get(provider);');
  lines.push('  if (!info) return null;');
  lines.push('  return { id: provider, ...info };');
  lines.push('}');
  lines.push('');

  lines.push('export function buildCatalog() {');
  lines.push('  const allModels = getAllModels();');
  lines.push('  const catalog = {};');
  lines.push('');
  lines.push('  for (const family of getFamilies()) {');
  lines.push('    catalog[family.id] = {');
  lines.push('      name: family.name,');
  lines.push('      models: allModels.filter((m) => m.provider === family.id),');
  lines.push('    };');
  lines.push('  }');
  lines.push('');
  lines.push('  return catalog;');
  lines.push('}');

  return lines.join('\n') + '\n';
}

function generateModelCapabilitiesJs(catalog) {
  const lines = [];
  lines.push('// Auto-generated by muapi-catalog-sync.mjs. Do not edit manually.');
  lines.push('// Source: Anil-matcha/Open-Generative-AI (upstream-muapi)');
  lines.push('');
  lines.push(`import { getModelById } from './models.js';`);
  lines.push('');

  lines.push('const CAPABILITY_MAP = {');
  lines.push('  imageGeneration: ["t2i", "i2i"],');
  lines.push('  videoGeneration: ["t2v", "i2v", "v2v"],');
  lines.push('  audioGeneration: ["audio"],');
  lines.push('  lipsync: ["lipsync"],');
  lines.push('  recast: ["recast"],');
  lines.push('};');
  lines.push('');

  lines.push('export function getModelCapabilities(modelId) {');
  lines.push('  const model = getModelById(modelId);');
  lines.push('  if (!model) return [];');
  lines.push('');
  lines.push('  const caps = [];');
  lines.push('  for (const [cap, types] of Object.entries(CAPABILITY_MAP)) {');
  lines.push('    if (types.includes(model._type)) caps.push(cap);');
  lines.push('  }');
  lines.push('');
  lines.push('  const inputs = model.inputs || {};');
  lines.push('  if (inputs.image) caps.push("acceptsImage");');
  lines.push('  if (inputs.video) caps.push("acceptsVideo");');
  lines.push('  if (inputs.audio) caps.push("acceptsAudio");');
  lines.push('  if (inputs.text) caps.push("acceptsText");');
  lines.push('');
  lines.push('  return caps;');
  lines.push('}');
  lines.push('');

  lines.push('export function supportsCapability(modelId, capability) {');
  lines.push('  return getModelCapabilities(modelId).includes(capability);');
  lines.push('}');
  lines.push('');

  lines.push('export function isImageModel(modelId) {');
  lines.push('  return supportsCapability(modelId, "imageGeneration");');
  lines.push('}');
  lines.push('');

  lines.push('export function isVideoModel(modelId) {');
  lines.push('  return supportsCapability(modelId, "videoGeneration");');
  lines.push('}');
  lines.push('');

  lines.push('export function isAudioModel(modelId) {');
  lines.push('  return supportsCapability(modelId, "audioGeneration");');
  lines.push('}');

  return lines.join('\n') + '\n';
}

function generateModelParametersJs(catalog) {
  const lines = [];
  lines.push('// Auto-generated by muapi-catalog-sync.mjs. Do not edit manually.');
  lines.push('// Source: Anil-matcha/Open-Generative-AI (upstream-muapi)');
  lines.push('');
  lines.push(`import { getModelById } from './models.js';`);
  lines.push('');

  lines.push('export function getModelParameters(modelId) {');
  lines.push('  const model = getModelById(modelId);');
  lines.push('  if (!model || !model.inputs) return {};');
  lines.push('');
  lines.push('  const params = {};');
  lines.push('  for (const [key, config] of Object.entries(model.inputs)) {');
  lines.push('    params[key] = {');
  lines.push('      type: config.type || "text",');
  lines.push('      required: config.required || false,');
  lines.push('      default: config.default,');
  lines.push('      description: config.description || "",');
  lines.push('    };');
  lines.push('  }');
  lines.push('  return params;');
  lines.push('}');
  lines.push('');

  lines.push('export function validateParameters(modelId, provided) {');
  lines.push('  const params = getModelParameters(modelId);');
  lines.push('  const errors = [];');
  lines.push('');
  lines.push('  for (const [key, config] of Object.entries(params)) {');
  lines.push('    if (config.required && (provided[key] === undefined || provided[key] === null)) {');
  lines.push('      errors.push(`Missing required parameter: ${key}`);');
  lines.push('    }');
  lines.push('  }');
  lines.push('');
  lines.push('  return { valid: errors.length === 0, errors };');
  lines.push('}');
  lines.push('');

  lines.push('export function getRequiredParameters(modelId) {');
  lines.push('  const params = getModelParameters(modelId);');
  lines.push('  return Object.entries(params)');
  lines.push('    .filter(([, config]) => config.required)');
  lines.push('    .map(([key]) => key);');
  lines.push('}');
  lines.push('');

  lines.push('export function getDefaultParameters(modelId) {');
  lines.push('  const params = getModelParameters(modelId);');
  lines.push('  const defaults = {};');
  lines.push('  for (const [key, config] of Object.entries(params)) {');
  lines.push('    if (config.default !== undefined) {');
  lines.push('      defaults[key] = config.default;');
  lines.push('    }');
  lines.push('  }');
  lines.push('  return defaults;');
  lines.push('}');

  return lines.join('\n') + '\n';
}

function generateImageSizingJs() {
  const lines = [];
  lines.push('// Auto-generated by muapi-catalog-sync.mjs. Do not edit manually.');
  lines.push('// Source: Anil-matcha/Open-Generative-AI (upstream-muapi)');
  lines.push('');

  lines.push('export const ASPECT_RATIOS = {');
  lines.push('  "1:1": { width: 1024, height: 1024, label: "Square" },');
  lines.push('  "16:9": { width: 1344, height: 768, label: "Landscape" },');
  lines.push('  "9:16": { width: 768, height: 1344, label: "Portrait" },');
  lines.push('  "4:3": { width: 1152, height: 896, label: "Standard" },');
  lines.push('  "3:4": { width: 896, height: 1152, label: "Tall" },');
  lines.push('  "21:9": { width: 1536, height: 640, label: "Ultrawide" },');
  lines.push('};');
  lines.push('');

  lines.push('export function getDimensions(aspectRatio) {');
  lines.push('  return ASPECT_RATIOS[aspectRatio] || ASPECT_RATIOS["1:1"];');
  lines.push('}');
  lines.push('');

  lines.push('export function getAspectRatioList() {');
  lines.push('  return Object.keys(ASPECT_RATIOS);');
  lines.push('}');
  lines.push('');

  lines.push('export function calculateDimensions(aspectRatio, maxPixels = 1048576) {');
  lines.push('  const base = getDimensions(aspectRatio);');
  lines.push('  const currentPixels = base.width * base.height;');
  lines.push('');
  lines.push('  if (currentPixels <= maxPixels) {');
  lines.push('    return { width: base.width, height: base.height };');
  lines.push('  }');
  lines.push('');
  lines.push('  const scale = Math.sqrt(maxPixels / currentPixels);');
  lines.push('  return {');
  lines.push('    width: Math.round(base.width * scale),');
  lines.push('    height: Math.round(base.height * scale),');
  lines.push('  };');
  lines.push('}');

  return lines.join('\n') + '\n';
}

function generateImageInputContractsJs(catalog) {
  const lines = [];
  lines.push('// Auto-generated by muapi-catalog-sync.mjs. Do not edit manually.');
  lines.push('// Source: Anil-matcha/Open-Generative-AI (upstream-muapi)');
  lines.push('');
  lines.push(`import { getModelById } from './models.js';`);
  lines.push('');

  lines.push('const IMAGE_CONSTRAINTS = {');
  lines.push('  maxWidth: 4096,');
  lines.push('  maxHeight: 4096,');
  lines.push('  minWidth: 64,');
  lines.push('  minHeight: 64,');
  lines.push('  supportedFormats: ["png", "jpg", "jpeg", "webp"],');
  lines.push('  maxFileSizeMB: 10,');
  lines.push('};');
  lines.push('');

  lines.push('export function getImageConstraints() {');
  lines.push('  return { ...IMAGE_CONSTRAINTS };');
  lines.push('}');
  lines.push('');

  lines.push('export function validateImageInput(modelId, input) {');
  lines.push('  const model = getModelById(modelId);');
  lines.push('  const errors = [];');
  lines.push('');
  lines.push('  if (!model) {');
  lines.push('    return { valid: false, errors: ["Model not found"] };');
  lines.push('  }');
  lines.push('');
  lines.push('  const inputs = model.inputs || {};');
  lines.push('  if (!inputs.image) {');
  lines.push('    return { valid: false, errors: ["Model does not accept image input"] };');
  lines.push('  }');
  lines.push('');
  lines.push('  if (input.width && (input.width < IMAGE_CONSTRAINTS.minWidth || input.width > IMAGE_CONSTRAINTS.maxWidth)) {');
  lines.push('    errors.push(`Width must be between ${IMAGE_CONSTRAINTS.minWidth} and ${IMAGE_CONSTRAINTS.maxWidth}`);');
  lines.push('  }');
  lines.push('');
  lines.push('  if (input.height && (input.height < IMAGE_CONSTRAINTS.minHeight || input.height > IMAGE_CONSTRAINTS.maxHeight)) {');
  lines.push('    errors.push(`Height must be between ${IMAGE_CONSTRAINTS.minHeight} and ${IMAGE_CONSTRAINTS.maxHeight}`);');
  lines.push('  }');
  lines.push('');
  lines.push('  if (input.format && !IMAGE_CONSTRAINTS.supportedFormats.includes(input.format.toLowerCase())) {');
  lines.push('    errors.push(`Unsupported format: ${input.format}`);');
  lines.push('  }');
  lines.push('');
  lines.push('  if (input.fileSizeMB && input.fileSizeMB > IMAGE_CONSTRAINTS.maxFileSizeMB) {');
  lines.push('    errors.push(`File size exceeds ${IMAGE_CONSTRAINTS.maxFileSizeMB}MB limit`);');
  lines.push('  }');
  lines.push('');
  lines.push('  return { valid: errors.length === 0, errors };');
  lines.push('}');
  lines.push('');

  lines.push('export function getModelImageRequirements(modelId) {');
  lines.push('  const model = getModelById(modelId);');
  lines.push('  if (!model || !model.inputs || !model.inputs.image) return null;');
  lines.push('  return { ...IMAGE_CONSTRAINTS, ...model.inputs.image.constraints };');
  lines.push('}');

  return lines.join('\n') + '\n';
}

function generateVideoMediaInputsJs(catalog) {
  const lines = [];
  lines.push('// Auto-generated by muapi-catalog-sync.mjs. Do not edit manually.');
  lines.push('// Source: Anil-matcha/Open-Generative-AI (upstream-muapi)');
  lines.push('');
  lines.push(`import { getModelById } from './models.js';`);
  lines.push('');

  lines.push('const VIDEO_CONSTRAINTS = {');
  lines.push('  maxWidth: 1920,');
  lines.push('  maxHeight: 1080,');
  lines.push('  minWidth: 256,');
  lines.push('  minHeight: 256,');
  lines.push('  maxDurationSec: 30,');
  lines.push('  supportedFormats: ["mp4", "webm", "mov"],');
  lines.push('  maxFileSizeMB: 50,');
  lines.push('};');
  lines.push('');

  lines.push('export function getVideoConstraints() {');
  lines.push('  return { ...VIDEO_CONSTRAINTS };');
  lines.push('}');
  lines.push('');

  lines.push('export function validateVideoInput(modelId, input) {');
  lines.push('  const model = getModelById(modelId);');
  lines.push('  const errors = [];');
  lines.push('');
  lines.push('  if (!model) {');
  lines.push('    return { valid: false, errors: ["Model not found"] };');
  lines.push('  }');
  lines.push('');
  lines.push('  const inputs = model.inputs || {};');
  lines.push('  if (!inputs.video) {');
  lines.push('    return { valid: false, errors: ["Model does not accept video input"] };');
  lines.push('  }');
  lines.push('');
  lines.push('  if (input.width && (input.width < VIDEO_CONSTRAINTS.minWidth || input.width > VIDEO_CONSTRAINTS.maxWidth)) {');
  lines.push('    errors.push(`Width must be between ${VIDEO_CONSTRAINTS.minWidth} and ${VIDEO_CONSTRAINTS.maxWidth}`);');
  lines.push('  }');
  lines.push('');
  lines.push('  if (input.height && (input.height < VIDEO_CONSTRAINTS.minHeight || input.height > VIDEO_CONSTRAINTS.maxHeight)) {');
  lines.push('    errors.push(`Height must be between ${VIDEO_CONSTRAINTS.minHeight} and ${VIDEO_CONSTRAINTS.maxHeight}`);');
  lines.push('  }');
  lines.push('');
  lines.push('  if (input.durationSec && input.durationSec > VIDEO_CONSTRAINTS.maxDurationSec) {');
  lines.push('    errors.push(`Duration exceeds ${VIDEO_CONSTRAINTS.maxDurationSec}s limit`);');
  lines.push('  }');
  lines.push('');
  lines.push('  if (input.format && !VIDEO_CONSTRAINTS.supportedFormats.includes(input.format.toLowerCase())) {');
  lines.push('    errors.push(`Unsupported format: ${input.format}`);');
  lines.push('  }');
  lines.push('');
  lines.push('  return { valid: errors.length === 0, errors };');
  lines.push('}');
  lines.push('');

  lines.push('export function acceptsVideoInput(modelId) {');
  lines.push('  const model = getModelById(modelId);');
  lines.push('  return !!(model && model.inputs && model.inputs.video);');
  lines.push('}');

  return lines.join('\n') + '\n';
}

function generateVideoToolCapabilitiesJs(catalog) {
  const lines = [];
  lines.push('// Auto-generated by muapi-catalog-sync.mjs. Do not edit manually.');
  lines.push('// Source: Anil-matcha/Open-Generative-AI (upstream-muapi)');
  lines.push('');
  lines.push(`import { getModelsByType } from './models.js';`);
  lines.push('');

  lines.push('export const VIDEO_TOOLS = {');
  lines.push('  textToVideo: {');
  lines.push('    type: "t2v",');
  lines.push('    label: "Text to Video",');
  lines.push('    description: "Generate video from text prompts",');
  lines.push('    inputs: ["text"],');
  lines.push('  },');
  lines.push('  imageToVideo: {');
  lines.push('    type: "i2v",');
  lines.push('    label: "Image to Video",');
  lines.push('    description: "Animate a static image into a video",');
  lines.push('    inputs: ["image"],');
  lines.push('  },');
  lines.push('  videoToVideo: {');
  lines.push('    type: "v2v",');
  lines.push('    label: "Video to Video",');
  lines.push('    description: "Transform or restyle existing video",');
  lines.push('    inputs: ["video"],');
  lines.push('  },');
  lines.push('};');
  lines.push('');

  lines.push('export function getVideoTools() {');
  lines.push('  return Object.entries(VIDEO_TOOLS).map(([id, tool]) => ({ id, ...tool }));');
  lines.push('}');
  lines.push('');

  lines.push('export function getVideoToolModels(toolId) {');
  lines.push('  const tool = VIDEO_TOOLS[toolId];');
  lines.push('  if (!tool) return [];');
  lines.push('  return getModelsByType(tool.type);');
  lines.push('}');
  lines.push('');

  lines.push('export function getToolCapabilities(toolId) {');
  lines.push('  const tool = VIDEO_TOOLS[toolId];');
  lines.push('  if (!tool) return null;');
  lines.push('');
  lines.push('  const models = getVideoToolModels(toolId);');
  lines.push('  const inputs = new Set(tool.inputs);');
  lines.push('');
  lines.push('  for (const model of models) {');
  lines.push('    if (model.inputs) {');
  lines.push('      for (const key of Object.keys(model.inputs)) {');
  lines.push('        inputs.add(key);');
  lines.push('      }');
  lines.push('    }');
  lines.push('  }');
  lines.push('');
  lines.push('  return {');
  lines.push('    ...tool,');
  lines.push('    availableInputs: Array.from(inputs),');
  lines.push('    modelCount: models.length,');
  lines.push('  };');
  lines.push('}');

  return lines.join('\n') + '\n';
}

function generateVideoWorkflowsJs(catalog) {
  const lines = [];
  lines.push('// Auto-generated by muapi-catalog-sync.mjs. Do not edit manually.');
  lines.push('// Source: Anil-matcha/Open-Generative-AI (upstream-muapi)');
  lines.push('');
  lines.push(`import { getVideoTools } from './videoToolCapabilities.js';`);
  lines.push('');

  lines.push('export const WORKFLOWS = {');
  lines.push('  generateVideo: {');
  lines.push('    id: "generateVideo",');
  lines.push('    label: "Generate Video",');
  lines.push('    steps: [');
  lines.push('      { id: "selectTool", type: "select", options: "videoTools" },');
  lines.push('      { id: "configureInputs", type: "inputs" },');
  lines.push('      { id: "generate", type: "apiCall" },');
  lines.push('      { id: "preview", type: "output" },');
  lines.push('    ],');
  lines.push('  },');
  lines.push('  animateImage: {');
  lines.push('    id: "animateImage",');
  lines.push('    label: "Animate Image",');
  lines.push('    defaultTool: "imageToVideo",');
  lines.push('    steps: [');
  lines.push('      { id: "uploadImage", type: "upload", accepts: "image" },');
  lines.push('      { id: "configureMotion", type: "inputs" },');
  lines.push('      { id: "generate", type: "apiCall" },');
  lines.push('      { id: "preview", type: "output" },');
  lines.push('    ],');
  lines.push('  },');
  lines.push('  restyleVideo: {');
  lines.push('    id: "restyleVideo",');
  lines.push('    label: "Restyle Video",');
  lines.push('    defaultTool: "videoToVideo",');
  lines.push('    steps: [');
  lines.push('      { id: "uploadVideo", type: "upload", accepts: "video" },');
  lines.push('      { id: "selectStyle", type: "inputs" },');
  lines.push('      { id: "generate", type: "apiCall" },');
  lines.push('      { id: "preview", type: "output" },');
  lines.push('    ],');
  lines.push('  },');
  lines.push('};');
  lines.push('');

  lines.push('export function getWorkflows() {');
  lines.push('  return Object.entries(WORKFLOWS).map(([id, wf]) => ({ id, ...wf }));');
  lines.push('}');
  lines.push('');

  lines.push('export function getWorkflow(workflowId) {');
  lines.push('  const wf = WORKFLOWS[workflowId];');
  lines.push('  if (!wf) return null;');
  lines.push('  return { id: workflowId, ...wf };');
  lines.push('}');
  lines.push('');

  lines.push('export function getWorkflowForModel(modelId) {');
  lines.push('  const typeToWorkflow = {');
  lines.push('    t2v: "generateVideo",');
  lines.push('    i2v: "animateImage",');
  lines.push('    v2v: "restyleVideo",');
  lines.push('  };');
  lines.push('');
  lines.push('  for (const wf of getWorkflows()) {');
  lines.push('    if (wf.defaultTool) {');
  lines.push('      const tool = getVideoTools().find((t) => t.id === wf.defaultTool);');
  lines.push('      if (tool && tool.type === modelId?.split(":")[0]) {');
  lines.push('        return wf;');
  lines.push('      }');
  lines.push('    }');
  lines.push('  }');
  lines.push('');
  lines.push('  return null;');
  lines.push('}');

  return lines.join('\n') + '\n';
}

function generatePersistKeyJs() {
  const lines = [];
  lines.push('// Auto-generated by muapi-catalog-sync.mjs. Do not edit manually.');
  lines.push('// Source: Anil-matcha/Open-Generative-AI (upstream-muapi)');
  lines.push('');

  lines.push('const NAMESPACE = "muapi";');
  lines.push('');

  lines.push('export function getPersistKey(key) {');
  lines.push('  return `${NAMESPACE}:${key}`;');
  lines.push('}');
  lines.push('');

  lines.push('export function persistGet(key, defaultValue = null) {');
  lines.push('  try {');
  lines.push('    const stored = localStorage.getItem(getPersistKey(key));');
  lines.push('    return stored !== null ? JSON.parse(stored) : defaultValue;');
  lines.push('  } catch {');
  lines.push('    return defaultValue;');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  lines.push('export function persistSet(key, value) {');
  lines.push('  try {');
  lines.push('    localStorage.setItem(getPersistKey(key), JSON.stringify(value));');
  lines.push('    return true;');
  lines.push('  } catch {');
  lines.push('    return false;');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  lines.push('export function persistRemove(key) {');
  lines.push('  try {');
  lines.push('    localStorage.removeItem(getPersistKey(key));');
  lines.push('    return true;');
  lines.push('  } catch {');
  lines.push('    return false;');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  lines.push('export function persistClear() {');
  lines.push('  try {');
  lines.push('    const keys = Object.keys(localStorage).filter((k) => k.startsWith(`${NAMESPACE}:`));');
  lines.push('    for (const key of keys) {');
  lines.push('      localStorage.removeItem(key);');
  lines.push('    }');
  lines.push('    return true;');
  lines.push('  } catch {');
  lines.push('    return false;');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  lines.push('export const KEYS = {');
  lines.push('  selectedModel: "selectedModel",');
  lines.push('  selectedTool: "selectedTool",');
  lines.push('  apiKey: "apiKey",');
  lines.push('  aspectRatio: "aspectRatio",');
  lines.push('  lastParams: "lastParams",');
  lines.push('  workflow: "workflow",');
  lines.push('  history: "history",');
  lines.push('};');

  return lines.join('\n') + '\n';
}

function generateMuapiJs(catalog) {
  const lines = [];
  lines.push('// Auto-generated by muapi-catalog-sync.mjs. Do not edit manually.');
  lines.push('// Source: Anil-matcha/Open-Generative-AI (upstream-muapi)');
  lines.push('');
  lines.push(`import { getModelById } from './models.js';`);
  lines.push(`import { validateParameters } from './modelParameters.js';`);
  lines.push('');

  lines.push('const MUAPI_BASE_URL = "https://api.muapi.ai/api/v1";');
  lines.push('');

  lines.push('function getApiKey() {');
  lines.push('  return localStorage.getItem("muapi:apiKey") || process.env.MUAPI_API_KEY;');
  lines.push('}');
  lines.push('');

  lines.push('async function muapiRequest(endpoint, options = {}) {');
  lines.push('  const apiKey = getApiKey();');
  lines.push('  if (!apiKey) {');
  lines.push('    throw new Error("MuAPI API key not configured");');
  lines.push('  }');
  lines.push('');
  lines.push('  const url = `${MUAPI_BASE_URL}${endpoint}`;');
  lines.push('  const response = await fetch(url, {');
  lines.push('    ...options,');
  lines.push('    headers: {');
  lines.push('      "Content-Type": "application/json",');
  lines.push('      Authorization: `Bearer ${apiKey}`,');
  lines.push('      ...options.headers,');
  lines.push('    },');
  lines.push('  });');
  lines.push('');
  lines.push('  if (!response.ok) {');
  lines.push('    const error = await response.json().catch(() => ({}));');
  lines.push('    throw new Error(error.message || `MuAPI error: ${response.status}`);');
  lines.push('  }');
  lines.push('');
  lines.push('  return response.json();');
  lines.push('}');
  lines.push('');

  lines.push('export async function generateImage(modelId, params) {');
  lines.push('  const model = getModelById(modelId);');
  lines.push('  if (!model) throw new Error(`Model not found: ${modelId}`);');
  lines.push('');
  lines.push('  const validation = validateParameters(modelId, params);');
  lines.push('  if (!validation.valid) {');
  lines.push('    throw new Error(`Invalid parameters: ${validation.errors.join(", ")}`);');
  lines.push('  }');
  lines.push('');
  lines.push('  return muapiRequest("/generate/image", {');
  lines.push('    method: "POST",');
  lines.push('    body: JSON.stringify({ model: modelId, ...params }),');
  lines.push('  });');
  lines.push('}');
  lines.push('');

  lines.push('export async function generateVideo(modelId, params) {');
  lines.push('  const model = getModelById(modelId);');
  lines.push('  if (!model) throw new Error(`Model not found: ${modelId}`);');
  lines.push('');
  lines.push('  const validation = validateParameters(modelId, params);');
  lines.push('  if (!validation.valid) {');
  lines.push('    throw new Error(`Invalid parameters: ${validation.errors.join(", ")}`);');
  lines.push('  }');
  lines.push('');
  lines.push('  return muapiRequest("/generate/video", {');
  lines.push('    method: "POST",');
  lines.push('    body: JSON.stringify({ model: modelId, ...params }),');
  lines.push('  });');
  lines.push('}');
  lines.push('');

  lines.push('export async function generateAudio(modelId, params) {');
  lines.push('  const model = getModelById(modelId);');
  lines.push('  if (!model) throw new Error(`Model not found: ${modelId}`);');
  lines.push('');
  lines.push('  return muapiRequest("/generate/audio", {');
  lines.push('    method: "POST",');
  lines.push('    body: JSON.stringify({ model: modelId, ...params }),');
  lines.push('  });');
  lines.push('}');
  lines.push('');

  lines.push('export async function checkStatus(taskId) {');
  lines.push('  return muapiRequest(`/tasks/${taskId}`);');
  lines.push('}');
  lines.push('');

  lines.push('export async function pollUntilComplete(taskId, intervalMs = 2000, maxAttempts = 60) {');
  lines.push('  let attempts = 0;');
  lines.push('');
  lines.push('  while (attempts < maxAttempts) {');
  lines.push('    const status = await checkStatus(taskId);');
  lines.push('    if (status.status === "completed" || status.status === "failed") {');
  lines.push('      return status;');
  lines.push('    }');
  lines.push('    await new Promise((resolve) => setTimeout(resolve, intervalMs));');
  lines.push('    attempts++;');
  lines.push('  }');
  lines.push('');
  lines.push('  throw new Error(`Task ${taskId} did not complete within ${maxAttempts * intervalMs / 1000}s`);');
  lines.push('}');

  return lines.join('\n') + '\n';
}

function printSummary(counts, options) {
  console.log('\n=== MuAPI Catalog Sync Summary ===\n');
  let total = 0;

  for (const type of MODEL_TYPES) {
    const count = counts[type] || 0;
    total += count;
    const label = ARRAY_NAMES[type] || type;
    console.log(`  ${label}: ${count} models`);
  }

  console.log(`\n  Total: ${total} models`);

  if (options.dryRun) {
    console.log('\n  [DRY RUN] No files were written.');
  }

  console.log('');
}

function main() {
  const options = parseArgs();

  log(`Starting MuAPI catalog sync (source: ${options.source})`);

  let rawContent;
  if (options.source === 'upstream') {
    rawContent = getModelsDumpFromUpstream();
  } else {
    const localPath = process.argv[process.argv.indexOf('--source') + 2] || 'packages/studio/src/models_dump.json';
    rawContent = getModelsDumpFromLocal(localPath);
  }

  const { catalog, counts } = parseModelsDump(rawContent);

  logVerbose('Parsed catalog:', options);
  for (const [type, count] of Object.entries(counts)) {
    logVerbose(`  ${type}: ${count} models`, options);
  }

  const files = [
    { path: path.join(REPO_ROOT, 'packages', 'studio', 'src', 'models_dump.json'), content: rawContent },
  ];

  // Copy models.js and supporting files directly from upstream (preferred).
  // The upstream models.js contains all model types (t2i, i2i, t2v, i2v, v2v, etc.)
  // and is more complete than what we can generate from models_dump.json alone.
  // Target: src/lib/ (SmartVideo's actual location)
  const upstreamFilesToCopy = [
    { name: 'models.js', target: path.join(SRC_LIB, 'models.js') },
    { name: 'modelFamilies.js', target: path.join(SRC_LIB, 'modelFamilies.js') },
    { name: 'modelCapabilities.js', target: path.join(SRC_LIB, 'modelCapabilities.js') },
    { name: 'modelParameters.js', target: path.join(SRC_LIB, 'modelParameters.js') },
    { name: 'imageSizing.js', target: path.join(SRC_LIB, 'imageSizing.js') },
    { name: 'imageInputContracts.js', target: path.join(SRC_LIB, 'imageInputContracts.js') },
    { name: 'videoMediaInputs.js', target: path.join(SRC_LIB, 'videoMediaInputs.js') },
    { name: 'videoToolCapabilities.js', target: path.join(SRC_LIB, 'videoToolCapabilities.js') },
    { name: 'videoWorkflows.js', target: path.join(SRC_LIB, 'videoWorkflows.js') },
    { name: 'persistKey.js', target: path.join(SRC_LIB, 'persistKey.js') },
  ];

  for (const { name, target } of upstreamFilesToCopy) {
    const upstreamContent = copyFileFromUpstream(name);
    if (upstreamContent !== null) {
      files.push({ path: target, content: upstreamContent });
    } else if (name === 'models.js') {
      files.push({ path: target, content: generateModelsJs(catalog) });
    }
  }

  // Copy advanced controls and shared components to src/lib/studio-components/
  const componentFiles = [
    { name: 'components/ModelParameterControls.jsx', target: path.join(STUDIO_COMPONENTS, 'ModelParameterControls.jsx') },
    { name: 'components/MobileGenerationActions.jsx', target: path.join(STUDIO_COMPONENTS, 'MobileGenerationActions.jsx') },
    { name: 'components/WorkflowUI.jsx', target: path.join(STUDIO_COMPONENTS, 'WorkflowUI.jsx') },
    { name: 'prompt/PromptComposer.jsx', target: path.join(STUDIO_COMPONENTS, 'prompt', 'PromptComposer.jsx') },
    { name: 'utils/generationLifecycle.js', target: path.join(STUDIO_COMPONENTS, 'generationLifecycle.js') },
    { name: 'utils/formatError.js', target: path.join(STUDIO_COMPONENTS, 'formatError.js') },
    { name: 'utils/downloadImage.js', target: path.join(STUDIO_COMPONENTS, 'downloadImage.js') },
  ];

  for (const { name, target } of componentFiles) {
    const upstreamContent = copyFileFromUpstream(name);
    if (upstreamContent !== null) {
      files.push({ path: target, content: upstreamContent });
    }
  }

  for (const file of files) {
    writeFile(file.path, file.content, options);
  }

  printSummary(counts, options);
  log('Sync complete.');
}

main();
