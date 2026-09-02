const ICONS = {
  startFrame: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`,
  endFrame: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M15 21V9"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path d="M21 15l-5-5L5 21"/></svg>`,
  video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none"/></svg>`,
  audio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
};

function schemaHasInput(model, field, fallback = true) {
  if (!model) return fallback;
  return Object.prototype.hasOwnProperty.call(model.inputs || {}, field);
}

function fileMatchesAccept(file, accept) {
  if (!file || !accept) return true;
  const rules = String(accept)
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);
  if (!rules.length) return true;

  const mime = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  return rules.some((rule) => {
    if (rule.endsWith('/*')) return mime.startsWith(rule.slice(0, -1));
    if (rule.startsWith('.')) return name.endsWith(rule);
    return mime === rule;
  });
}

function buildTools({ model, acceptImage, acceptVideo, acceptAudio, acceptStartFrame, acceptEndFrame }) {
  const hasFirstFrame = schemaHasInput(model, 'first_frame_url');
  const hasLastFrame = schemaHasInput(model, 'last_frame_url');
  const hasReferenceImages = schemaHasInput(model, 'reference_images');
  const hasReferenceVideos = schemaHasInput(model, 'reference_videos');
  const hasReferenceAudios = schemaHasInput(model, 'reference_audios');

  return [
    acceptStartFrame && hasFirstFrame && {
      key: 'startFrame',
      label: 'Start f...',
      title: 'Starting image for the video. Sets the opening scene.',
      accept: 'image/*',
      multiple: false,
    },
    acceptEndFrame && hasLastFrame && {
      key: 'endFrame',
      label: 'End f...',
      title: 'End frame needs a start frame — a last frame on its own is rejected.',
      accept: 'image/*',
      multiple: false,
    },
    acceptImage && hasReferenceImages && {
      key: 'image',
      label: 'IMAGE',
      title: 'Reference Images',
      accept: 'image/*',
      multiple: true,
    },
    acceptVideo && hasReferenceVideos && {
      key: 'video',
      label: 'VIDEO',
      title: 'Reference Videos',
      accept: 'video/*',
      multiple: true,
    },
    acceptAudio && hasReferenceAudios && {
      key: 'audio',
      label: 'AUDIO',
      title: 'Reference Audios',
      accept: 'audio/*',
      multiple: true,
    },
  ].filter(Boolean);
}

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
  toolbar.dataset.dropEnabled = 'true';

  let currentModel = model;
  let streaming = false;
  const cleanupFns = [];

  async function uploadFiles(tool, files) {
    const accepted = Array.from(files || []).filter((file) => fileMatchesAccept(file, tool.accept));
    if (!accepted.length) return;
    const selected = tool.multiple ? accepted : accepted.slice(0, 1);
    for (const file of selected) {
      try {
        await onUpload(tool.key, file, {
          role: tool.key,
          accept: tool.accept,
          source: 'attachment-toolbar',
        });
      } catch (err) {
        console.error('[AttachmentToolbar] upload failed:', err);
      }
    }
  }

  function renderTools(nextModel = currentModel) {
    currentModel = nextModel;
    cleanupFns.splice(0).forEach((cleanup) => cleanup());
    toolbar.innerHTML = '';

    const tools = buildTools({
      model: currentModel,
      acceptImage,
      acceptVideo,
      acceptAudio,
      acceptStartFrame,
      acceptEndFrame,
    });

    tools.forEach((tool) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'studio-attachment-btn';
      btn.title = `${tool.title} — click to browse or drop files here`;
      btn.setAttribute('aria-label', tool.title);
      btn.setAttribute('data-tooltip', tool.title);
      btn.setAttribute('data-attachment-role', tool.key);
      btn.setAttribute('data-accept', tool.accept);
      btn.innerHTML = `<span class="studio-attachment-icon">${ICONS[tool.key] || ''}</span><span class="studio-attachment-label">${tool.label}</span>`;
      btn.disabled = streaming;

      let dragDepth = 0;
      const setDragging = (active) => {
        btn.classList.toggle('is-dragging', active);
        btn.classList.toggle('ring-2', active);
        btn.classList.toggle('ring-primary', active);
        btn.classList.toggle('border-primary', active);
        btn.classList.toggle('bg-primary/10', active);
        btn.setAttribute('aria-dropeffect', active ? 'copy' : 'none');
      };

      const handleClick = () => {
        if (btn.disabled) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = tool.accept;
        input.multiple = tool.multiple;
        input.style.display = 'none';
        document.body.appendChild(input);

        input.onchange = async (e) => {
          await uploadFiles(tool, e.target.files);
          input.remove();
        };
        input.oncancel = () => input.remove();
        input.click();
      };

      const handleDragEnter = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (btn.disabled) return;
        dragDepth += 1;
        const files = Array.from(event.dataTransfer?.files || []);
        const items = Array.from(event.dataTransfer?.items || []);
        const hasCompatibleItem = files.some((file) => fileMatchesAccept(file, tool.accept)) ||
          items.some((item) => item.kind === 'file' && (!item.type || fileMatchesAccept({ type: item.type, name: '' }, tool.accept)));
        if (hasCompatibleItem || (!files.length && !items.length)) setDragging(true);
      };

      const handleDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (btn.disabled) return;
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      };

      const handleDragLeave = (event) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) setDragging(false);
      };

      const handleDrop = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepth = 0;
        setDragging(false);
        if (btn.disabled) return;
        await uploadFiles(tool, event.dataTransfer?.files);
      };

      btn.addEventListener('click', handleClick);
      btn.addEventListener('dragenter', handleDragEnter);
      btn.addEventListener('dragover', handleDragOver);
      btn.addEventListener('dragleave', handleDragLeave);
      btn.addEventListener('drop', handleDrop);
      cleanupFns.push(() => {
        btn.removeEventListener('click', handleClick);
        btn.removeEventListener('dragenter', handleDragEnter);
        btn.removeEventListener('dragover', handleDragOver);
        btn.removeEventListener('dragleave', handleDragLeave);
        btn.removeEventListener('drop', handleDrop);
      });

      toolbar.appendChild(btn);
    });
  }

  renderTools(currentModel);

  const textarea = getTextarea();
  if (textarea && textarea.parentNode) {
    textarea.parentNode.insertBefore(toolbar, textarea);
  } else if (container) {
    container.insertBefore(toolbar, container.firstChild);
  }

  return {
    destroy() {
      cleanupFns.splice(0).forEach((cleanup) => cleanup());
      toolbar.remove();
    },
    setStreaming(isStreaming) {
      streaming = Boolean(isStreaming);
      toolbar.querySelectorAll('button').forEach((btn) => {
        btn.disabled = streaming;
        if (streaming) btn.classList.remove('is-dragging', 'ring-2', 'ring-primary', 'border-primary', 'bg-primary/10');
      });
    },
    updateModel(nextModel) {
      renderTools(nextModel);
    },
  };
}
