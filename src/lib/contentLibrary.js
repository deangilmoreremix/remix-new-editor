import { supabase, isSupabaseConfigured } from './supabase.js';
import { uploadFileToStorage } from '../lib/uploadService.js';
import { getUserKey } from './userKey.js';
import { formatErrorMessage } from './errorMessages.js';

// ── Saved content (local store) ──────────────────────────────────────────
// "Content" is where people keep what they want to come back to: generations
// they saved from a studio or the Library, plus uploads and stock media. Saved
// generations live in localStorage so saving always works (with or without
// Supabase) and deleting one never touches a storage bucket.
const SAVED_KEY = 'sv_saved_content';

function readSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; }
}
function writeSaved(list) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); } catch { /* storage full/blocked */ }
  try { window.dispatchEvent(new CustomEvent('sv:content-saved')); } catch { /* non-browser */ }
}

function inferType(url, type) {
  if (type === 'video' || type === 'audio' || type === 'image' || type === 'pdf') return type;
  const ext = (String(url).split('?')[0].split('.').pop() || '').toLowerCase();
  if (['mp4', 'webm', 'mov', 'm4v'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  return 'image';
}

export function isSavedToContent(url) {
  return readSaved().some((i) => i.url === url);
}

/** Save a generation (or any media URL) to Content. Returns the saved entry. */
export function saveToContent({ url, type, prompt = '', model = '', studio = '', filename, source = 'saved', attribution } = {}) {
  if (!url) return null;
  const list = readSaved();
  const existing = list.find((i) => i.url === url);
  if (existing) return existing;
  const kind = inferType(url, type);
  const entry = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    url,
    type: kind,
    filename: filename || (prompt ? prompt.slice(0, 60) : `${studio || 'saved'}-${kind}`),
    prompt,
    model,
    studio,
    source,
    ...(attribution ? { attribution } : {}),
    created_at: new Date().toISOString(),
  };
  list.unshift(entry);
  writeSaved(list);
  return entry;
}

export function removeSavedContent(idOrUrl) {
  writeSaved(readSaved().filter((i) => i.id !== idOrUrl && i.url !== idOrUrl));
}

export async function listContentLibrary() {
  const saved = readSaved();
  if (!isSupabaseConfigured()) return saved;
  const { data, error } = await supabase
    .from('content_library')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to list content library:', error);
    return saved;
  }

  const seen = new Set(saved.map((i) => i.url));
  return [...saved, ...(data || []).filter((i) => !seen.has(i.url))]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

export async function uploadToContentLibrary(file) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  // Validate file type
  const isPdf = file.type === 'application/pdf';
  const isVideo = file.type.startsWith('video/');

  if (!isPdf && !isVideo) {
    throw new Error('Only PDF and video files are allowed.');
  }

  // 1. Upload file to storage
  let url;
  try {
    url = await uploadFileToStorage(file);
  } catch (e) {
    throw new Error(formatErrorMessage(e, 'Upload failed'), { cause: e });
  }

  // 2. Derive full storage path from URL
  const urlPath = new URL(url).pathname;
  const storagePath = urlPath.split('/').slice(-2).join('/'); // e.g. "userKey/filename.pdf"

  // 3. Determine type
  const type = isPdf ? 'pdf' : 'video';

  // 4. Write metadata record
  const { data, error } = await supabase
    .from('content_library')
    .insert({
      filename: file.name,
      type,
      url,
      storage_path: storagePath,
      size: file.size,
      mime_type: file.type,
      uploaded_by: getUserKey(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save content library metadata: ${error.message}`);
  }

  return data;
}

export async function saveContentLibraryEntry(url, meta = {}) {
  // Without Supabase keep the entry locally so uploads/stock picks still show up.
  if (!isSupabaseConfigured()) {
    return saveToContent({ url, type: meta.type, filename: meta.filename, source: meta.source || 'upload', attribution: meta.attribution });
  }

  try {
    const urlPath = new URL(url).pathname;
    const filename = decodeURIComponent(urlPath.split('/').pop()?.split('?')[0] || 'upload');
    const ext = (filename.split('.').pop() || '').toLowerCase();

    let type = meta.type || 'pdf';
    if (!meta.type) {
      if (ext === 'mp4' || ext === 'webm' || ext === 'mov' || ext === 'avi' || ext === 'mkv' || ext === 'm4v' || ext === 'flv' || ext === 'wmv' || ext === '3gp' || ext === 'ogv') {
        type = 'video';
      } else if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp' || ext === 'gif' || ext === 'svg' || ext === 'bmp') {
        type = 'image';
      } else if (ext !== 'pdf') {
        type = 'pdf';
      }
    }

    const storagePath = urlPath.split('/').slice(-2).join('/');

    let fileSize = 0;
    let mimeType = type === 'pdf' ? 'application/pdf' : type === 'video' ? 'video/mp4' : 'image/jpeg';
    try {
      const head = await fetch(url, { method: 'HEAD' });
      if (head.ok) {
        const contentLength = head.headers.get('content-length');
        if (contentLength) fileSize = parseInt(contentLength, 10);
        const contentType = head.headers.get('content-type');
        if (contentType) mimeType = contentType;
      }
    } catch {
      // ignore fetch errors; defaults are fine
    }

    const record = {
      filename,
      type,
      url,
      storage_path: storagePath,
      size: fileSize,
      mime_type: mimeType,
      uploaded_by: getUserKey(),
    };

    if (meta.attribution !== undefined) record.attribution = meta.attribution;
    if (meta.pexelsId !== undefined) record.pexels_id = meta.pexelsId;
    if (meta.source !== undefined) record.source = meta.source;
    if (meta.thumb !== undefined) record.thumb = meta.thumb;
    if (meta.width !== undefined) record.width = meta.width;
    if (meta.height !== undefined) record.height = meta.height;
    if (meta.duration !== undefined) record.duration = meta.duration;

    const { data, error } = await supabase
      .from('content_library')
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('Failed to save content library entry:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error saving content library entry:', err);
    return null;
  }
}

export async function deleteFromContentLibrary(id) {
  if (typeof id === 'string' && id.startsWith('local-')) {
    removeSavedContent(id);
    return;
  }
  if (!isSupabaseConfigured()) return;

  // First, fetch the record to get the storage path
  const { data, error: fetchError } = await supabase
    .from('content_library')
    .select('storage_path')
    .eq('id', id)
    .single();

  if (fetchError || !data) {
    console.error('Failed to fetch content library entry for deletion:', fetchError);
    return;
  }

  // Delete the file from storage
  try {
    const { error: storageError } = await supabase.storage
      .from('uploads')
      .remove([data.storage_path]);

    if (storageError) {
      console.error('Failed to delete file from storage:', storageError);
    }
  } catch (err) {
    console.error('Error deleting file from storage:', err);
  }

  // Delete the metadata record
  const { error: deleteError } = await supabase
    .from('content_library')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error('Failed to delete from content library:', deleteError);
    throw deleteError;
  }
}
