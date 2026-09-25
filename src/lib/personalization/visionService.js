async function getSession() {
  try {
    const { supabase } = await import('../supabase.js');
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  } catch {
    return null;
  }
}

function visionHttpError(response, payload) {
  const backendMessage = payload?.message || payload?.error;
  if (response.status === 401) {
    return new Error('Your SmartVideo session expired. Sign in again, then retry Vision.');
  }
  if (response.status === 403) {
    return new Error('Your account is not authorized to use SmartVideo AI Vision for this workspace.');
  }
  if (response.status === 429) {
    return new Error('Vision is temporarily rate-limited. Wait a moment, then retry.');
  }
  return new Error(backendMessage || `Vision request failed (${response.status})`);
}

async function postVision(body) {
  const session = await getSession();
  if (!session?.access_token) {
    throw new Error('Sign in to use SmartVideo AI Vision.');
  }

  const response = await fetch('/api/personalizer/image-analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw visionHttpError(response, payload);
  return payload;
}

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'msclkid', '_ga', '_gl',
]);

export function normalizePersonalizationImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:image/')) return raw;
  try {
    const parsed = new URL(raw);
    let normalized = `${parsed.protocol}//${parsed.hostname}`;
    if (parsed.port && !['80', '443'].includes(parsed.port)) normalized += `:${parsed.port}`;
    normalized += parsed.pathname;
    const params = new URLSearchParams(parsed.search);
    TRACKING_PARAMS.forEach((param) => params.delete(param));
    const query = params.toString();
    if (query) normalized += `?${query}`;
    return normalized.toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/\/+$/, '');
  }
}

export async function analyzePersonalizationImages({
  images,
  businessContext = {},
  targetVideoFormat = '',
} = {}) {
  const cleanImages = (Array.isArray(images) ? images : [])
    .filter((image) => image?.id && image?.imageUrl)
    .map((image) => ({
      id: String(image.id),
      imageUrl: String(image.imageUrl),
      categoryHint: image.categoryHint || undefined,
      roleHint: image.roleHint || undefined,
    }));

  if (!cleanImages.length) throw new Error('At least one image is required.');

  const normalizedFirstId = new Map();
  const duplicateIds = new Set();
  for (const image of cleanImages) {
    const key = normalizePersonalizationImageUrl(image.imageUrl);
    if (!key) continue;
    if (normalizedFirstId.has(key)) duplicateIds.add(image.id);
    else normalizedFirstId.set(key, image.id);
  }

  const analyses = [];
  for (let offset = 0; offset < cleanImages.length; offset += 8) {
    const batch = cleanImages.slice(offset, offset + 8);
    const payload = await postVision({
      mode: 'analyze',
      images: batch,
      businessContext,
      targetVideoFormat,
    });
    const batchAnalyses = Array.isArray(payload?.analyses) ? payload.analyses : [];
    if (!batchAnalyses.length) {
      throw new Error(`Vision returned no analysis for batch ${Math.floor(offset / 8) + 1}.`);
    }
    analyses.push(...batchAnalyses);
  }

  if (!analyses.length) throw new Error('Vision returned no analyses.');

  return analyses.map((analysis) => ({
    ...analysis,
    duplicateLikely: Boolean(analysis.duplicateLikely || duplicateIds.has(String(analysis.id))),
  }));
}

export async function validatePersonalizationImageEdit({
  originalImageUrl,
  editedImageUrl,
  preserve = [],
  intendedOperation = 'image edit',
  businessContext = {},
} = {}) {
  if (!originalImageUrl || !editedImageUrl) {
    throw new Error('Original and edited image references are required.');
  }

  const payload = await postVision({
    mode: 'validate',
    originalImageUrl,
    editedImageUrl,
    preserve: Array.isArray(preserve) ? preserve : [],
    intendedOperation,
    businessContext,
  });

  if (!payload?.validation) throw new Error('Vision validation returned no result.');
  return payload.validation;
}
