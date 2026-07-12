// Self-contained alert service.
// Provides a SweetAlert-compatible surface (showError/showSuccess/showInfo/
// showNotice/showProgress/showConfirmation/promptString/closeAlert) without
// requiring an external dependency. safeAlert is callable with an options
// object (matching SweetAlert's signature) and also exposes getState/close/
// stopLoading/closeAll so legacy callers keep working.

const rootEl = (() => {
  if (typeof document === 'undefined') return null;
  let root = document.getElementById('alert-service-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'alert-service-root';
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;';
    document.body.appendChild(root);
  }
  return root;
})();

let openInstance = null;

function getState() {
  return { isOpen: !!openInstance };
}

function clearActive() {
  if (openInstance && openInstance.parentNode) {
    openInstance.parentNode.removeChild(openInstance);
  }
  openInstance = null;
}

function close() {
  clearActive();
}

function stopLoading() {
  const btn = openInstance && openInstance.querySelector('[data-alert-loading]');
  if (btn) {
    btn.disabled = false;
    btn.textContent = btn.getAttribute('data-alert-loading') || btn.textContent;
  }
}

function ensureMounted(overlay) {
  if (rootEl) rootEl.appendChild(overlay);
  openInstance = overlay;
  return overlay;
}

function buildModal({ title, text, icon, buttons, input, dangerMode, onClose }) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);pointer-events:auto;padding:16px;';

  const card = document.createElement('div');
  card.style.cssText =
    'width:100%;max-width:420px;border-radius:16px;border:1px solid rgba(255,255,255,0.08);' +
    'background:linear-gradient(180deg,#11151f,#0a0d16);color:#fff;padding:24px;text-align:center;' +
    'box-shadow:0 24px 60px rgba(0,0,0,0.5);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;';

  const iconMap = {
    error: '⚠️',
    success: '✅',
    warning: '⚠️',
    info: 'ℹ️',
  };
  if (icon && iconMap[icon]) {
    const iconEl = document.createElement('div');
    iconEl.style.cssText = 'font-size:40px;margin-bottom:12px;';
    iconEl.textContent = iconMap[icon];
    card.appendChild(iconEl);
  }

  if (title) {
    const titleEl = document.createElement('h2');
    titleEl.style.cssText = 'margin:0 0 8px;font-size:20px;font-weight:700;';
    titleEl.textContent = title;
    card.appendChild(titleEl);
  }

  if (text) {
    const textEl = document.createElement('p');
    textEl.style.cssText = 'margin:0 0 16px;color:rgba(255,255,255,0.65);font-size:14px;line-height:1.5;';
    textEl.textContent = text;
    card.appendChild(textEl);
  }

  let inputEl = null;
  if (input) {
    inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.style.cssText =
      'width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);' +
      'background:rgba(255,255,255,0.05);color:#fff;margin-bottom:16px;font-size:14px;outline:none;';
    card.appendChild(inputEl);
  }

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;';

  const overlayClick = (e) => {
    if (e.target === overlay) rejectAndClose();
  };

  function resolveAndClose(value) {
    overlay.removeEventListener('click', overlayClick);
    clearActive();
    onClose(value);
  }

  function rejectAndClose() {
    overlay.removeEventListener('click', overlayClick);
    clearActive();
    onClose(null);
  }

  const defaultButtons =
    buttons === false
      ? []
      : Array.isArray(buttons)
      ? buttons
      : [{ text: 'OK', value: true, className: dangerMode ? 'danger' : 'primary' }];

  defaultButtons.forEach((b) => {
    const btn = document.createElement('button');
    const base = 'padding:10px 18px;border-radius:10px;border:none;font-weight:600;font-size:14px;cursor:pointer;';
    if (b.className === 'danger') {
      btn.style.cssText = base + 'background:#ef4444;color:#fff;';
    } else if (b.className === 'primary') {
      btn.style.cssText = base + 'background:#3b82f6;color:#fff;';
    } else {
      btn.style.cssText = base + 'background:rgba(255,255,255,0.1);color:#fff;';
    }
    btn.textContent = b.text || 'OK';
    btn.addEventListener('click', () => {
      if (b.loading) {
        btn.disabled = true;
        btn.setAttribute('data-alert-loading', b.text || 'OK');
        btn.textContent = 'Loading...';
        return;
      }
      if (input) {
        resolveAndClose(inputEl.value);
      } else {
        resolveAndClose(typeof b.value === 'undefined' ? true : b.value);
      }
    });
    actions.appendChild(btn);
  });

  overlay.addEventListener('click', overlayClick);
  card.appendChild(actions);
  overlay.appendChild(card);
  return { overlay, inputEl };
}

function safeAlert(options) {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const opts = typeof options === 'string' ? { text: options } : options || {};
    const hasInput = opts.content === 'input';
    const buttons =
      opts.buttons === false
        ? false
        : opts.buttons === true
        ? [{ text: 'OK', value: true, className: opts.dangerMode ? 'danger' : 'primary' }]
        : opts.buttons;

    const { overlay } = buildModal({
      title: opts.title,
      text: opts.text,
      icon: opts.icon,
      buttons,
      input: hasInput,
      dangerMode: opts.dangerMode,
      onClose: (value) => resolve(value),
    });

    ensureMounted(overlay);
    const inputEl = overlay.querySelector('input');
    if (inputEl) inputEl.focus();
  });
}

safeAlert.getState = getState;
safeAlert.close = close;
safeAlert.stopLoading = stopLoading;
safeAlert.closeAll = close;

const closeFn = () => {
  safeAlert.stopLoading();
  safeAlert.close();
};

export function closeAlert() {
  if (safeAlert.getState().isOpen) {
    closeFn();
  } else {
    setTimeout(closeFn);
  }
}

export function showError(text) {
  return safeAlert({ title: 'Error', text, icon: 'error' });
}

export function showSuccess(text, title) {
  return safeAlert({ title, text, icon: 'success' });
}

export function showInfo(text, title = 'Info', icon = 'info') {
  return safeAlert({ title, text, icon });
}

export function showNotice(text, title = 'Notice', icon = 'info') {
  return safeAlert({ title, text, icon });
}

export function showProgress(text = 'Working...', title = 'Info') {
  return safeAlert({
    title,
    text,
    buttons: false,
    closeOnClickOutside: false,
    closeOnEsc: false,
    icon: 'info',
  });
}

export function showConfirmation(text, title) {
  return safeAlert({
    title: title ?? 'Are you sure?',
    text,
    icon: 'warning',
    buttons: true,
    dangerMode: true,
  }).then((value) => !!value);
}

export function promptString(text, buttonText = 'Ok') {
  return safeAlert({
    text,
    content: 'input',
    buttons: [{ text: buttonText, value: true, className: 'primary' }],
  });
}

export default {
  closeAlert,
  promptString,
  showConfirmation,
  showSuccess,
  showError,
  showInfo,
  showProgress,
  showNotice,
};
