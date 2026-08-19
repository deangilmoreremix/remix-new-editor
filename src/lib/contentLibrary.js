import { supabase, isSupabaseConfigured, uploadFileToStorage } from './supabase.js';
import { getUserKey } from './userKey.js';
import { formatErrorMessage } from './errorMessages.js';

export async function listContentLibrary() {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('content_library')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to list content library:', error);
    return [];
  }

  return data || [];
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
  if (!isSupabaseConfigured()) return;

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
