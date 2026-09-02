const ICONS = {
  startFrame: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`,
  endFrame: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M15 21V9"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path d="M21 15l-5-5L5 21"/></svg>`,
  video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none"/></svg>`,
  audio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
};

export function createAttachmentToolbar({
  container,
  onUpload,
  getTextarea,
  acceptImage = true,
  acceptVideo = true,
  acceptAudio = true,
  acceptStartFrame = true,
  acceptEndFrame = true,
  model,
}) {
  const toolbar = document.createElement('div');
  toolbar.className = 'studio-attachment-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Attachment toolbar');

  const inputsSchema = model?.inputs || {};
  const hasFirstFrame = model ? 'first_frame_url' in inputsSchema : true;
  const hasLastFrame = model ? 'last_frame_url' in inputsSchema : true;
  const hasReferenceImages = model ? 'reference_images' in inputsSchema : true;
  const hasReferenceVideos = model ? 'reference_videos' in inputsSchema : true;
  const hasReferenceAudios = model ? 'reference_audios' in inputsSchema : true;

  const tools = [
    acceptStartFrame && hasFirstFrame && { key: 'startFrame', label: 'Start f...', title: 'Starting image for the video. Sets the opening scene.', accept: 'image/*', multiple: false },
    acceptEndFrame && hasLastFrame && { key: 'endFrame', label: 'End f...', title: 'End frame needs a start frame — a last frame on its own is rejected.', accept: 'image/*', multiple: false },
    acceptImage && hasReferenceImages && { key: 'image', label: 'IMAGE', title: 'Reference Images', accept: 'image/*', multiple: true },
    acceptVideo && hasReferenceVideos && { key: 'video', label: 'VIDEO', title: 'Reference Videos', accept: 'video/*', multiple: true },
    acceptAudio && hasReferenceAudios && { key: 'audio', label: 'AUDIO', title: 'Reference Audios', accept: 'audio/*', multiple: true },
  ].filter(Boolean);

  tools.forEach((tool) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'studio-attachment-btn';
    btn.title = tool.title;
    btn.setAttribute('aria-label', tool.title);
    btn.setAttribute('data-tooltip', tool.title);
    btn.innerHTML = `<span class="studio-attachment-icon">${ICONS[tool.key] || ''}</span><span class="studio-attachment-label">${tool.label}</span>`;

    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = tool.accept;
      input.multiple = tool.multiple;
      input.style.display = 'none';
      document.body.appendChild(input);

      input.onchange = async (e) => {
        const files = Array.from(e.target.files || []);
        for (const file of files) {
          try {
            await onUpload(tool.key, file);
          } catch (err) {
            console.error('[AttachmentToolbar] upload failed:', err);
          }
        }
        if (input.parentNode) document.body.removeChild(input);
      };

      input.oncancel = () => {
        if (input.parentNode) document.body.removeChild(input);
      };

      input.click();
    });

    toolbar.appendChild(btn);
  });

  const textarea = getTextarea();
  if (textarea && textarea.parentNode) {
    textarea.parentNode.insertBefore(toolbar, textarea);
  } else if (container) {
    container.insertBefore(toolbar, container.firstChild);
  }

  return {
    destroy() {
      toolbar.remove();
    },
    setStreaming(isStreaming) {
      toolbar.querySelectorAll('button').forEach((btn) => {
        btn.disabled = isStreaming;
      });
    },
    updateModel(model) {
      // Re-render toolbar with new model capabilities
      toolbar.innerHTML = '';
      const inputsSchema = model?.inputs || {};
      const hasFirstFrame = 'first_frame_url' in inputsSchema;
      const hasLastFrame = 'last_frame_url' in inputsSchema;
      const hasReferenceImages = 'reference_images' in inputsSchema;
      const hasReferenceVideos = 'reference_videos' in inputsSchema;
      const hasReferenceAudios = 'reference_audios' in inputsSchema;

      const tools = [
        acceptStartFrame && hasFirstFrame && { key: 'startFrame', label: 'Start f...', title: 'Starting image for the video. Sets the opening scene.', accept: 'image/*', multiple: false },
        acceptEndFrame && hasLastFrame && { key: 'endFrame', label: 'End f...', title: 'End frame needs a start frame — a last frame on its own is rejected.', accept: 'image/*', multiple: false },
        acceptImage && hasReferenceImages && { key: 'image', label: 'IMAGE', title: 'Reference Images', accept: 'image/*', multiple: true },
        acceptVideo && hasReferenceVideos && { key: 'video', label: 'VIDEO', title: 'Reference Videos', accept: 'video/*', multiple: true },
        acceptAudio && hasReferenceAudios && { key: 'audio', label: 'AUDIO', title: 'Reference Audios', accept: 'audio/*', multiple: true },
      ].filter(Boolean);

      tools.forEach((tool) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'studio-attachment-btn';
        btn.title = tool.title;
        btn.setAttribute('aria-label', tool.title);
        btn.setAttribute('data-tooltip', tool.title);
        btn.innerHTML = `<span class="studio-attachment-icon">${ICONS[tool.key] || ''}</span><span class="studio-attachment-label">${tool.label}</span>`;

        btn.addEventListener('click', async () => {
          if (btn.disabled) return;
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = tool.accept;
          input.multiple = tool.multiple;
          input.style.display = 'none';
          document.body.appendChild(input);

          input.onchange = async (e) => {
            const files = Array.from(e.target.files || []);
            for (const file of files) {
              try {
                await onUpload(tool.key, file);
              } catch (err) {
                console.error('[AttachmentToolbar] upload failed:', err);
              }
            }
            if (input.parentNode) document.body.removeChild(input);
          };

          input.oncancel = () => {
            if (input.parentNode) document.body.removeChild(input);
          };

          input.click();
        });

        toolbar.appendChild(btn);
      });
    },
  };
}
