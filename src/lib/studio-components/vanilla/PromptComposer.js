/**
 * Creates an auto-resizing prompt textarea matching the existing studio style.
 *
 * @param {object} options
 * @param {string} options.placeholder - Placeholder text
 * @param {string} options.value - Initial value
 * @param {function} options.onChange - Callback(value) on input
 * @param {function} options.onSubmit - Callback() on Enter (Shift+Enter for newline)
 * @param {number} options.maxHeightMobile - Max height on mobile (default 150)
 * @param {number} options.maxHeightDesktop - Max height on desktop (default 250)
 * @param {string} options.id - Element ID
 * @param {number} options.rows - Initial rows (default 1)
 * @returns {{ element: HTMLElement, getValue: () => string, setValue: (v) => void, focus: () => void, destroy: () => void }}
 */
export function createPromptTextarea({
  placeholder = '',
  value = '',
  onChange,
  onSubmit,
  maxHeightMobile = 150,
  maxHeightDesktop = 250,
  id,
  rows = 1,
} = {}) {
  const textarea = document.createElement('textarea');
  textarea.id = id;
  textarea.placeholder = placeholder;
  textarea.value = value;
  textarea.rows = rows;
  textarea.className =
    'w-full bg-transparent border-none text-white text-sm placeholder:text-white/20 focus:outline-none resize-none pt-1 leading-relaxed min-h-[40px] max-h-[150px] md:max-h-[250px] overflow-y-auto custom-scrollbar disabled:opacity-40';

  const resize = () => {
    textarea.style.height = 'auto';
    const maxHeight =
      window.innerWidth < 768 ? maxHeightMobile : maxHeightDesktop;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  };

  textarea.addEventListener('input', () => {
    resize();
    if (onChange) onChange(textarea.value);
  });

  textarea.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      if (onSubmit) onSubmit();
    }
  });

  if (value) {
    requestAnimationFrame(resize);
  }

  return {
    element: textarea,
    getValue: () => textarea.value,
    setValue: (v) => {
      textarea.value = v;
      resize();
    },
    focus: () => textarea.focus(),
    destroy: () => {
      textarea.remove();
    },
  };
}

/**
 * Creates a prompt controls bar (aspect ratio, quality, duration buttons container).
 *
 * @param {object} options
 * @param {array} options.children - Child elements to render in the controls bar
 * @param {string} options.className - Additional CSS classes
 * @returns {HTMLElement}
 */
export function createPromptControls({ children = [], className = '' } = {}) {
  const controls = document.createElement('div');
  controls.className = `flex items-center gap-2 relative flex-wrap pb-1 md:pb-0${className ? ` ${className}` : ''}`;
  children.forEach((child) => {
    if (child) controls.appendChild(child);
  });
  return controls;
}

/**
 * Creates a footer action bar for the prompt (generate button area).
 *
 * @param {object} options
 * @param {array} options.children - Child elements
 * @param {string} options.className - Additional CSS classes
 * @returns {HTMLElement}
 */
export function createPromptFooter({ children = [], className = '' } = {}) {
  const footer = document.createElement('div');
  footer.className = `flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-3 border-t border-white/[0.03] relative${className ? ` ${className}` : ''}`;
  children.forEach((child) => {
    if (child) footer.appendChild(child);
  });
  return footer;
}
