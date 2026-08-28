import { useState, useCallback } from 'react';
import { uploadFileToStorage } from '../lib/hybrid-supabase.js';

export function useAttachmentState() {
  const [attachments, setAttachments] = useState({
    images: [],
    videos: [],
    audios: [],
    startFrame: null,
    endFrame: null,
  });

  const handleUpload = useCallback(async (key, file) => {
    if (!file) return;
    try {
      const url = await uploadFileToStorage(file);
      const attachment = { id: crypto.randomUUID(), url, file, type: key };

      setAttachments((prev) => {
        if (key === 'startFrame' || key === 'endFrame') {
          return { ...prev, [key]: attachment };
        }
        const arrayKey = key + 's';
        return { ...prev, [arrayKey]: [...prev[arrayKey], attachment] };
      });
    } catch (error) {
      console.error('Failed to upload attachment:', error);
      throw error;
    }
  }, []);

  const handleRemove = useCallback((key, id) => {
    setAttachments((prev) => {
      if (key === 'startFrame' || key === 'endFrame') {
        return { ...prev, [key]: null };
      }
      const arrayKey = key + 's';
      return { ...prev, [arrayKey]: prev[arrayKey].filter((a) => a.id !== id) };
    });
  }, []);

  const reset = useCallback(() => {
    setAttachments({ images: [], videos: [], audios: [], startFrame: null, endFrame: null });
  }, []);

  const toPayload = useCallback(() => ({
    reference_images: attachments.images.map((a) => a.url),
    reference_videos: attachments.videos.map((a) => a.url),
    reference_audios: attachments.audios.map((a) => a.url),
    first_frame_url: attachments.startFrame?.url || null,
    last_frame_url: attachments.endFrame?.url || null,
  }), [attachments]);

  return {
    attachments,
    handleUpload,
    handleRemove,
    reset,
    toPayload,
    setAttachments,
  };
}
