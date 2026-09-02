function parseAccept(accept = '') {
  return String(accept)
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function fileMatchesAccept(file, accept = '') {
  const rules = parseAccept(accept);
  if (!rules.length) return true;
  const mime = String(file?.type || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  return rules.some((rule) => {
    if (rule.endsWith('/*')) return mime.startsWith(rule.slice(0, -1));
    if (rule.startsWith('.')) return name.endsWith(rule);
    return mime === rule;
  });
}

function findDropHost(root, target) {
  let node = target instanceof Element ? target : null;
  while (node && node !== root) {
    const input = node.querySelector?.('input[type="file"]');
    if (input) return { host: node, input };
    node = node.parentElement;
  }
  return null;
}

function dispatchFiles(input, files) {
  const selected = input.multiple ? files : files.slice(0, 1);
  if (!selected.length) return false;

  try {
    const transfer = new DataTransfer();
    selected.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch {
    // Some browsers/test environments expose FileList as read-only without a
    // constructible DataTransfer. Existing studios mostly register `onchange`,
    // so call that handler directly as a safe fallback.
    if (typeof input.onchange === 'function') {
      input.onchange({ target: { files: selected, value: '' }, currentTarget: input });
      return true;
    }
  }
  return false;
}

export function enableStudioFileDropDelegation(root) {
  if (!root || root.dataset.fileDropDelegation === 'true') {
    return { destroy() {} };
  }
  root.dataset.fileDropDelegation = 'true';

  let activeHost = null;
  let dragDepth = 0;

  const setActiveHost = (host) => {
    if (activeHost && activeHost !== host) {
      activeHost.classList.remove('studio-file-drop-active', 'ring-2', 'ring-primary', 'border-primary');
    }
    activeHost = host || null;
    if (activeHost) {
      activeHost.classList.add('studio-file-drop-active', 'ring-2', 'ring-primary', 'border-primary');
    }
  };

  const clearActiveHost = () => {
    if (activeHost) {
      activeHost.classList.remove('studio-file-drop-active', 'ring-2', 'ring-primary', 'border-primary');
    }
    activeHost = null;
    dragDepth = 0;
  };

  const onDragEnter = (event) => {
    const match = findDropHost(root, event.target);
    if (!match || match.input.disabled) return;
    const files = Array.from(event.dataTransfer?.files || []);
    const items = Array.from(event.dataTransfer?.items || []);
    const hasCompatible = files.some((file) => fileMatchesAccept(file, match.input.accept)) ||
      items.some((item) => item.kind === 'file' && (!item.type || fileMatchesAccept({ type: item.type, name: '' }, match.input.accept)));
    if (!hasCompatible && (files.length || items.length)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepth += 1;
    setActiveHost(match.host);
  };

  const onDragOver = (event) => {
    const match = findDropHost(root, event.target);
    if (!match || match.input.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    setActiveHost(match.host);
  };

  const onDragLeave = (event) => {
    if (!activeHost) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) clearActiveHost();
  };

  const onDrop = (event) => {
    const match = findDropHost(root, event.target) || (activeHost ? findDropHost(root, activeHost) : null);
    if (!match || match.input.disabled) {
      clearActiveHost();
      return;
    }

    const compatible = Array.from(event.dataTransfer?.files || [])
      .filter((file) => fileMatchesAccept(file, match.input.accept));
    if (!compatible.length) {
      clearActiveHost();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dispatchFiles(match.input, compatible);
    clearActiveHost();
  };

  root.addEventListener('dragenter', onDragEnter);
  root.addEventListener('dragover', onDragOver);
  root.addEventListener('dragleave', onDragLeave);
  root.addEventListener('drop', onDrop);

  return {
    destroy() {
      clearActiveHost();
      root.removeEventListener('dragenter', onDragEnter);
      root.removeEventListener('dragover', onDragOver);
      root.removeEventListener('dragleave', onDragLeave);
      root.removeEventListener('drop', onDrop);
      delete root.dataset.fileDropDelegation;
    },
  };
}
