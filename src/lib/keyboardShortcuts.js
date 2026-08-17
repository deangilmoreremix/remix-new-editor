const listeners = new Set();
let boundHandler = null;

export function useKeyboardShortcuts() {
  if (!boundHandler) {
    boundHandler = (event) => {
      const isMeta = event.metaKey || event.ctrlKey;
      if (!isMeta) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        for (const fn of listeners) fn('undo');
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        for (const fn of listeners) fn('redo');
      } else if (key === 's') {
        event.preventDefault();
        for (const fn of listeners) fn('save');
      }
    };
    window.addEventListener('keydown', boundHandler);
  }

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    destroy() {
      listeners.clear();
    },
  };
}

export function createKeyboardShortcutRegistry() {
  const shortcuts = new Map();

  function register(keyCombo, action, description) {
    shortcuts.set(keyCombo, { action, description });
  }

  function dispatch(event) {
    const isMeta = event.metaKey || event.ctrlKey;
    if (!isMeta) return;
    const parts = [event.key.toLowerCase()];
    if (event.shiftKey) parts.push('shift');
    const combo = parts.join('+');
    const entry = shortcuts.get(combo);
    if (entry) {
      event.preventDefault();
      entry.action();
    }
  }

  function getShortcuts() {
    return Array.from(shortcuts.entries()).map(([combo, { description }]) => ({
      combo,
      description,
    }));
  }

  return { register, dispatch, getShortcuts };
}
