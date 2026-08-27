const BASE_URL = 'https://brightbean-web-q2ud.onrender.com';
const API_PREFIX = '/api/v1';
const API_KEY = 'bb_studio_AdSkqw6CI_LMZoehdY2XSLcNggOhcYeAwT1NqGvvun8_4986c14b';

async function request(path, options = {}) {
  const url = `${BASE_URL}${API_PREFIX}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `Request failed: ${response.status}`);
    }
    return text;
  }

  const data = await response.json();
  if (!response.ok) {
    const detail = data?.detail || data?.error || data?.message || JSON.stringify(data);
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  return data;
}

export async function listAccounts() {
  const data = await request('/accounts');
  return (data?.accounts || []);
}

export async function getMe() {
  return request('/me');
}

export async function uploadMedia(file, { title = '', alt_text = '', folder_id = null, tags = '' } = {}) {
  const form = new FormData();
  // Convert Blob to File with a name so the backend can sniff the MIME type
  let uploadFile = file;
  if (file instanceof Blob && !(file instanceof File)) {
    const ext = file.type.includes('image') ? '.jpg' : file.type.includes('video') ? '.mp4' : '.bin';
    uploadFile = new File([file], title ? `${title}${ext}` : `upload${ext}`, { type: file.type });
  } else if (file instanceof File && title && !file.name.includes('.')) {
    uploadFile = new File([file], title, { type: file.type });
  }
  form.append('file', uploadFile);
  form.append('title', title);
  form.append('alt_text', alt_text);
  if (folder_id) form.append('folder_id', folder_id);
  if (tags) form.append('tags', tags);

  return request('/media', {
    method: 'POST',
    body: form,
  });
}

export async function listMedia({ q, media_type, tags, folder_id, is_starred, processing_status = 'completed', created_after, created_before, order_by = '-created_at', cursor, limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (media_type) params.set('media_type', media_type);
  if (tags) params.set('tags', tags);
  if (folder_id) params.set('folder_id', folder_id);
  if (is_starred !== undefined && is_starred !== null) params.set('is_starred', String(is_starred));
  if (processing_status) params.set('processing_status', processing_status);
  if (created_after) params.set('created_after', created_after);
  if (created_before) params.set('created_before', created_before);
  if (order_by) params.set('order_by', order_by);
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));

  const qs = params.toString();
  return request(`/media${qs ? `?${qs}` : ''}`);
}

export async function createScheduledPost({ socialAccountId, caption, title = '', firstComment = '', mediaAssetIds = [], scheduledAt, action = 'schedule', proposedPublishAt, idempotencyKey }) {
  const payload = {
    social_account_id: String(socialAccountId),
    caption,
    title,
    first_comment: firstComment,
    media_asset_ids: mediaAssetIds.map(String),
    action,
    scheduled_at: scheduledAt || null,
    proposed_publish_at: proposedPublishAt || null,
    ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
  };

  return request('/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getPost(postId) {
  return request(`/posts/${postId}`);
}

export async function updatePost(postId, updates = {}) {
  const payload = {};
  if (updates.caption !== undefined) payload.caption = updates.caption;
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.first_comment !== undefined) payload.first_comment = updates.first_comment;
  if (updates.media_asset_ids !== undefined) payload.media_asset_ids = updates.media_asset_ids.map(String);
  if (updates.scheduled_at !== undefined) payload.scheduled_at = updates.scheduled_at;
  if (updates.proposed_publish_at !== undefined) payload.proposed_publish_at = updates.proposed_publish_at;

  return request(`/posts/${postId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function schedulePost(postId, scheduledAt) {
  return request(`/posts/${postId}/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduled_at: scheduledAt }),
  });
}

export async function cancelPost(postId) {
  return request(`/posts/${postId}/cancel`, {
    method: 'POST',
  });
}

export async function getPostAnalytics(postId) {
  return request(`/analytics/posts/${postId}`);
}

export async function getAccountAnalytics(accountId, days = 30) {
  const qs = new URLSearchParams({ days: String(days) });
  return request(`/analytics/accounts/${accountId}?${qs.toString()}`);
}

export default {
  listAccounts,
  getMe,
  uploadMedia,
  listMedia,
  createScheduledPost,
  getPost,
  updatePost,
  schedulePost,
  cancelPost,
  getPostAnalytics,
  getAccountAnalytics,
};
