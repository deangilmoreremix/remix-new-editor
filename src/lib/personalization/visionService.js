async function getSession() {
  try {
    const { createClient } = await import('../supabase.js');
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  } catch {
    return null;
  }
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
  if (!response.ok) {
    throw new Error(payload?.error || `Vision request failed (${response.status})`);
  }
  return payload;
}

export async function analyzePersonalizationImages({
  images,
  businessContext = {},
  targetVideoFormat = '',
} = {}) {
  const cleanImages = (Array.isArray(images) ? images : [])
    .filter((image) => image?.id && image?.imageUrl)
    .slice(0, 8)
    .map((image) => ({
      id: String(image.id),
      imageUrl: String(image.imageUrl),
      categoryHint: image.categoryHint || undefined,
      roleHint: image.roleHint || undefined,
    }));

  if (!cleanImages.length) throw new Error('At least one image is required.');

  const payload = await postVision({
    mode: 'analyze',
    images: cleanImages,
    businessContext,
    targetVideoFormat,
  });
  return Array.isArray(payload?.analyses) ? payload.analyses : [];
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
