export const TEMPLATE_KEY = 'render:templates';
export const DRAFT_KEY = 'render:drafts';

import { supabase } from '../supabase.js';
import { navigate } from '../router.js';

function generateId() {
  return crypto.randomUUID();
}

function getStored(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function setStored(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Get current user ID from Supabase session
async function getCurrentUserId() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Drafts ────────────────────────────────────────────────────────────────

export async function saveDraft(entry = {}) {
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  const draft = {
    id: generateId(),
    label: entry.label || 'Untitled Draft',
    video_url: entry.videoUrl || null,
    video_id: entry.videoId || null,
    prompt: entry.prompt || null,
    metadata: entry.metadata || {},
    created_at: now,
    updated_at: now,
  };

  if (userId) {
    // Save to Supabase for cross-device persistence
    const { data, error } = await supabase
      .from('render_drafts')
      .insert({
        user_id: userId,
        label: draft.label,
        video_url: draft.video_url,
        video_id: draft.video_id,
        prompt: draft.prompt,
        metadata: draft.metadata,
      })
      .select()
      .single();

    if (!error && data) {
      return { ...draft, id: data.id };
    }
    // Fall through to localStorage on error
  }

  // Fallback: localStorage
  const drafts = getStored(DRAFT_KEY);
  drafts.push(draft);
  setStored(DRAFT_KEY, drafts);
  return draft;
}

export async function listDrafts() {
  const userId = await getCurrentUserId();

  if (userId) {
    const { data, error } = await supabase
      .from('render_drafts')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      return data.map((d) => ({
        id: d.id,
        label: d.label,
        videoUrl: d.video_url,
        videoId: d.video_id,
        prompt: d.prompt,
        metadata: d.metadata,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));
    }
  }

  // Fallback: localStorage
  return getStored(DRAFT_KEY);
}

export async function deleteDraft(id) {
  const userId = await getCurrentUserId();

  if (userId) {
    const { error } = await supabase
      .from('render_drafts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (!error) return;
  }

  // Fallback: localStorage
  const drafts = getStored(DRAFT_KEY).filter((d) => d.id !== id);
  setStored(DRAFT_KEY, drafts);
}

// ─── Templates ─────────────────────────────────────────────────────────────

export async function saveTemplate(entry = {}) {
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  const template = {
    id: generateId(),
    label: entry.label || 'Untitled Template',
    config: entry.config || {},
    video_url: entry.videoUrl || null,
    video_id: entry.videoId || null,
    created_at: now,
    updated_at: now,
  };

  if (userId) {
    const { data, error } = await supabase
      .from('render_templates')
      .insert({
        user_id: userId,
        label: template.label,
        config: template.config,
        video_url: template.video_url,
        video_id: template.video_id,
      })
      .select()
      .single();

    if (!error && data) {
      return { ...template, id: data.id };
    }
  }

  // Fallback: localStorage
  const templates = getStored(TEMPLATE_KEY);
  templates.push(template);
  setStored(TEMPLATE_KEY, templates);
  return template;
}

export async function listTemplates() {
  const userId = await getCurrentUserId();

  if (userId) {
    const { data, error } = await supabase
      .from('render_templates')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      return data.map((t) => ({
        id: t.id,
        label: t.label,
        config: t.config,
        videoUrl: t.video_url,
        videoId: t.video_id,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));
    }
  }

  // Fallback: localStorage
  return getStored(TEMPLATE_KEY);
}

export async function duplicateTemplate(id) {
  const userId = await getCurrentUserId();

  if (userId) {
    const { data: original, error: fetchError } = await supabase
      .from('render_templates')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!fetchError && original) {
      const { data, error } = await supabase
        .from('render_templates')
        .insert({
          user_id: userId,
          label: original.label + ' (Copy)',
          config: original.config,
          video_url: original.video_url,
          video_id: original.video_id,
        })
        .select()
        .single();

      if (!error && data) {
        return {
          id: data.id,
          label: data.label,
          config: data.config,
          videoUrl: data.video_url,
          videoId: data.video_id,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
    }
  }

  // Fallback: localStorage
  const templates = getStored(TEMPLATE_KEY);
  const original = templates.find((t) => t.id === id);
  if (!original) return null;

  const copy = {
    ...original,
    id: generateId(),
    label: original.label + ' (Copy)',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  templates.push(copy);
  setStored(TEMPLATE_KEY, templates);
  return copy;
}

export async function deleteTemplate(id) {
  const userId = await getCurrentUserId();

  if (userId) {
    const { error } = await supabase
      .from('render_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (!error) return;
  }

  // Fallback: localStorage
  const templates = getStored(TEMPLATE_KEY).filter((t) => t.id !== id);
  setStored(TEMPLATE_KEY, templates);
}

export async function getVideoMetadata(videoUrl) {
  if (!videoUrl) {
    return null;
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = videoUrl;

    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 8000);

    function onLoadedMetadata() {
      clearTimeout(timeout);
      cleanup();
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      });
    }

    function onError() {
      clearTimeout(timeout);
      cleanup();
      resolve(null);
    }

    function cleanup() {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
      video.src = '';
      video.load();
    }

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('error', onError);
    video.load();
  });
}

export async function downloadFrame(videoEl, opts = {}) {
  const { format = 'image/png', quality = 0.92 } = opts;

  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth || 1920;
  canvas.height = videoEl.videoHeight || 1080;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'frame.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve(blob);
    }, format, quality);
  });
}

export async function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return Boolean(document.execCommand('copy'));
  } finally {
    document.body.removeChild(textarea);
  }
}

export function sendToStoryboard(videoId, videoUrl) {
  navigate('storyboard', { videoId, videoUrl });
}
