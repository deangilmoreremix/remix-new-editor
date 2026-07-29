// Base Store Class - Pub/Sub pattern for state management
// Replaces MobX with vanilla JS implementation

export default class Store {
  constructor(initialState = {}) {
    this.state = { ...initialState };
    this.listeners = new Map(); // Map of listener IDs to callback functions
    this.nextListenerId = 0;
    this.isDestroyed = false;

    // Bind methods
    this.subscribe = this.subscribe.bind(this);
    this.unsubscribe = this.unsubscribe.bind(this);
    this.getState = this.getState.bind(this);
    this.setState = this.setState.bind(this);
    this.notify = this.notify.bind(this);
    this.destroy = this.destroy.bind(this);
  }

  // ========== STATE MANAGEMENT ==========

  // Get current state
  getState() {
    return { ...this.state };
  }

  // Set state (triggers notifications to subscribers)
  setState(updater) {
    if (this.isDestroyed) return;

    let newState;
    const currentState = this.getState();

    if (typeof updater === 'function') {
      newState = updater(currentState);
    } else if (typeof updater === 'object') {
      newState = { ...currentState, ...updater };
    } else {
      throw new Error('setState expects a function or object');
    }

    // Check if state actually changed
    if (this.isEqual(currentState, newState)) {
      return;
    }

    this.state = newState;
    this.notify();
  }

  // Update specific property in state
  update(key, value) {
    this.setState(prevState => ({
      ...prevState,
      [key]: typeof value === 'function' ? value(prevState[key]) : value
    }));
  }

  // ========== PUB/SUB SYSTEM ==========

  // Subscribe to state changes
  subscribe(listener, context = null) {
    if (this.isDestroyed) return () => {};

    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }

    const id = this.nextListenerId++;
    const boundListener = context ? listener.bind(context) : listener;

    this.listeners.set(id, boundListener);

    // Return unsubscribe function
    return () => this.unsubscribe(id);
  }

  // Unsubscribe from state changes
  unsubscribe(id) {
    if (this.listeners.has(id)) {
      this.listeners.delete(id);
    }
  }

  // Notify all subscribers of state change
  notify() {
    if (this.isDestroyed) return;

    const currentState = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(currentState);
      } catch (error) {
        console.error('Error in store listener:', error);
      }
    });
  }

  // ========== COMPUTED VALUES ==========

  // Create computed property (automatically updates when dependencies change)
  computed(dependencies, computeFn) {
    let cachedValue;
    let cachedDeps;

    const updateCache = () => {
      const currentDeps = dependencies.map(dep => {
        if (typeof dep === 'function') {
          return dep();
        }
        return dep;
      });

      if (!this.isEqual(cachedDeps, currentDeps)) {
        cachedDeps = currentDeps;
        cachedValue = computeFn(...currentDeps);
      }
    };

    return () => {
      updateCache();
      return cachedValue;
    };
  }

  // ========== ACTIONS ==========

  // Create action (for better debugging and consistency)
  action(name, actionFn) {
    const wrappedAction = (...args) => {
      try {
        const result = actionFn.apply(this, args);
        return result;
      } catch (error) {
        console.error(`Action "${name}" failed:`, error);
        throw error;
      }
    };

    wrappedAction.actionName = name;
    return wrappedAction;
  }

  // ========== UTILITIES ==========

  // Deep equality check
  isEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key) || !this.isEqual(a[key], b[key])) {
          return false;
        }
      }

      return true;
    }

    return false;
  }

  // Reset store to initial state
  reset(initialState = {}) {
    this.state = { ...initialState };
    this.notify();
  }

  // Get specific value from state
  get(key, defaultValue = undefined) {
    return this.state[key] !== undefined ? this.state[key] : defaultValue;
  }

  // Check if store has specific key
  has(key) {
    return key in this.state;
  }

  // Get store info (for debugging)
  getInfo() {
    return {
      name: this.constructor.name,
      state: this.getState(),
      listenerCount: this.listeners.size,
      isDestroyed: this.isDestroyed
    };
  }

  // ========== LIFECYCLE ==========

  // Destroy store and clean up
  destroy() {
    this.listeners.clear();
    this.state = {};
    this.isDestroyed = true;
  }

  // ========== STATIC METHODS ==========

  // Create store instance with middleware
  static withMiddleware(storeClass, middlewares = []) {
    return class ExtendedStore extends storeClass {
      constructor(...args) {
        super(...args);

        // Apply middlewares
        middlewares.forEach(middleware => {
          if (typeof middleware === 'function') {
            middleware(this);
          }
        });
      }
    };
  }

  // Create observable store
  static observable(initialState = {}) {
    return new Store(initialState);
  }
}

// ========== STORE MIDDLEWARE ==========

// Logger middleware
export function logger(store) {
  const originalSetState = store.setState;
  store.setState = function(updater) {
    const prevState = store.getState();
    originalSetState.call(this, updater);
    const nextState = store.getState();

    console.group(`[${store.constructor.name}] State Changed`);
    console.log('Previous:', prevState);
    console.log('Next:', nextState);
    console.groupEnd();
  };
}

// Persistence middleware
export function persistence(store, storageKey) {
  // Load initial state from storage
  const storedState = localStorage.getItem(storageKey);
  if (storedState) {
    try {
      const parsedState = JSON.parse(storedState);
      store.state = { ...store.state, ...parsedState };
    } catch (error) {
      console.warn('Failed to load persisted state:', error);
    }
  }

  // Save state changes to storage
  const originalSetState = store.setState;
  store.setState = function(updater) {
    originalSetState.call(this, updater);
    try {
      localStorage.setItem(storageKey, JSON.stringify(store.getState()));
    } catch (error) {
      console.warn('Failed to persist state:', error);
    }
  };
}

// Validation middleware
export function validation(store, validator) {
  const originalSetState = store.setState;
  store.setState = function(updater) {
    let newState;
    const currentState = store.getState();

    if (typeof updater === 'function') {
      newState = updater(currentState);
    } else {
      newState = { ...currentState, ...updater };
    }

    // Validate new state
    const validationResult = validator(newState);
    if (validationResult !== true) {
      console.error('State validation failed:', validationResult);
      return;
    }

    originalSetState.call(this, newState);
  };
}

// ========== HOOKS FOR COMPONENTS ==========

// useStore hook replacement
export function useStore(store) {
  return {
    state: store.getState(),
    setState: store.setState.bind(store),
    subscribe: store.subscribe.bind(store),
    get: store.get.bind(store),
    update: store.update.bind(store)
  };
}

// useSelector hook replacement
export function useSelector(store, selector) {
  const selectedValue = selector(store.getState());
  return selectedValue;
}

// useDispatch hook replacement
export function useDispatch(store) {
  return (action) => {
    if (typeof action === 'function') {
      action(store);
    } else {
      console.warn('useDispatch expects a function');
    }
  };
}