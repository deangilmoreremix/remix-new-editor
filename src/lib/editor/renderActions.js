export const TEMPLATE_KEY = 'render:templates';
export const DRAFT_KEY = 'render:drafts';

import { navigate } from '../router.js';

export function generateId() {
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

export function saveDraft(entry = {}) {
  const draft = {
    id: generateId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...entry,
  };
  const drafts = getStored(DRAFT_KEY);
  drafts.push(draft);
  setStored(DRAFT_KEY, drafts);
  return draft;
}

export function saveTemplate(entry = {}) {
  const template = {
    id: generateId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...entry,
  };
  const templates = getStored(TEMPLATE_KEY);
  templates.push(template);
  setStored(TEMPLATE_KEY, templates);
  return template;
}

export function listDrafts() {
  return getStored(DRAFT_KEY);
}

export function listTemplates() {
  return getStored(TEMPLATE_KEY);
}

export function duplicateTemplate(id) {
  const templates = getStored(TEMPLATE_KEY);
  const original = templates.find((t) => t.id === id);
  if (!original) {
    return null;
  }
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

export function deleteDraft(id) {
  const drafts = getStored(DRAFT_KEY).filter((d) => d.id !== id);
  setStored(DRAFT_KEY, drafts);
}

export function deleteTemplate(id) {
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
  const { format = 'image/png', quality = 0.92, filename } = opts;

  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth || 1920;
  canvas.height = videoEl.videoHeight || 1080;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  const currentTime = typeof videoEl.currentTime === 'number' ? videoEl.currentTime : 0;
  const minutes = Math.floor(currentTime / 60);
  const seconds = Math.floor(currentTime % 60);
  const ms = Math.floor((currentTime % 1) * 1000);
  const timeTag = `${String(minutes).padStart(2, '0')}-${String(seconds).padStart(2, '0')}-${String(ms).padStart(3, '0')}`;
  const baseName = filename || `smartvideo-frame-${timeTag}`;
  const extension = format === 'image/jpeg' ? 'jpg' : format.replace('image/', '') || 'png';
  const safeName = `${baseName.replace(/[^a-zA-Z0-9_-]+/g, '_')}.${extension}`;

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Frame export produced an empty image'));
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = safeName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          // Keep the URL alive briefly so the browser can finish the download,
          // then revoke it to avoid leaking object URLs.
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          resolve(blob);
        },
        format,
        quality
      );
    } catch (err) {
      reject(new Error(`Frame export failed: ${err.message}`));
    }
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
