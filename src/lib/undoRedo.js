const MAX_HISTORY_DEFAULT = 50;

function deepClone(value) {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function createUndoRedo(initialState, maxHistory = MAX_HISTORY_DEFAULT) {
  const undoStack = [];
  const redoStack = [];
  let currentState = deepClone(initialState);
  const listeners = new Set();

  function getState() {
    return currentState;
  }

  function setState(next) {
    currentState = next;
    notify();
  }

  function notify() {
    for (const listener of listeners) {
      listener(currentState);
    }
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function pushState(nextState) {
    undoStack.push(deepClone(currentState));
    if (undoStack.length > maxHistory) {
      undoStack.shift();
    }
    redoStack.length = 0;
    currentState = deepClone(nextState);
    notify();
  }

  function undo() {
    if (undoStack.length === 0) return null;
    const prev = undoStack.pop();
    redoStack.push(deepClone(currentState));
    currentState = deepClone(prev);
    notify();
    return currentState;
  }

  function redo() {
    if (redoStack.length === 0) return null;
    const next = redoStack.pop();
    undoStack.push(deepClone(currentState));
    currentState = deepClone(next);
    notify();
    return currentState;
  }

  function canUndo() {
    return undoStack.length > 0;
  }

  function canRedo() {
    return redoStack.length > 0;
  }

  function reset(nextState) {
    undoStack.length = 0;
    redoStack.length = 0;
    currentState = deepClone(nextState);
    notify();
  }

  function handleKeyDown(event) {
    const isMeta = event.metaKey || event.ctrlKey;
    if (!isMeta) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      undo();
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault();
      redo();
    }
  }

  let boundHandler = null;

  function enableKeyboardShortcuts() {
    if (boundHandler) return;
    boundHandler = handleKeyDown;
    window.addEventListener('keydown', boundHandler);
  }

  function disableKeyboardShortcuts() {
    if (!boundHandler) return;
    window.removeEventListener('keydown', boundHandler);
    boundHandler = null;
  }

  enableKeyboardShortcuts();

  return {
    getState,
    setState,
    pushState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    subscribe,
    enableKeyboardShortcuts,
    disableKeyboardShortcuts,
  };
}

export { createUndoRedo, MAX_HISTORY_DEFAULT };
export default createUndoRedo;
