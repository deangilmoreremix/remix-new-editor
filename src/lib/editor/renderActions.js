export const TEMPLATE_KEY = 'render:templates';
export const DRAFT_KEY = 'render:drafts';

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
  return Boolean(document.execCommand('copy'));
  document.body.removeChild(textarea);
}

export function sendToStoryboard(videoId, videoUrl) {
  navigate('storyboard', { videoId, videoUrl });
}
