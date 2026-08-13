import { useState, useEffect, useCallback, useRef } from 'react';
import { createUndoRedo } from '../lib/undoRedo.js';

export function useUndoRedo(initialState, maxHistory = 50) {
  const managerRef = useRef(null);
  if (!managerRef.current) {
    managerRef.current = createUndoRedo(initialState, maxHistory);
  }

  const [state, setState] = useState(() => managerRef.current.getState());

  useEffect(() => {
    const unsubscribe = managerRef.current.subscribe((nextState) => {
      setState(nextState);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    managerRef.current.enableKeyboardShortcuts();
    return () => {
      managerRef.current.disableKeyboardShortcuts();
    };
  }, []);

  const pushState = useCallback((nextState) => {
    managerRef.current.pushState(nextState);
  }, []);

  const undo = useCallback(() => {
    return managerRef.current.undo();
  }, []);

  const redo = useCallback(() => {
    return managerRef.current.redo();
  }, []);

  const canUndo = useCallback(() => managerRef.current.canUndo(), []);
  const canRedo = useCallback(() => managerRef.current.canRedo(), []);
  const reset = useCallback((nextState) => managerRef.current.reset(nextState), []);
  const subscribe = useCallback((listener) => managerRef.current.subscribe(listener), []);

  return {
    state,
    setState: managerRef.current.setState,
    pushState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    subscribe,
  };
}

export default useUndoRedo;
