/**
 * Base Store Class - Vanilla JS replacement for MobX stores
 * Implements Pub/Sub pattern for state management
 */
export class Store {
  constructor(initialState = {}) {
    this.state = { ...initialState };
    this.listeners = new Set();
    this.actions = {};
    this.computed = {};
  }

  /**
   * Subscribe to store changes
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Get current state
   * @returns {Object}
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Update state and notify listeners
   * @param {Object} updates
   */
  setState(updates) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };

    if (this.shouldNotify(oldState, this.state)) {
      this.notify();
    }
  }

  /**
   * Determine if listeners should be notified
   * @param {Object} oldState
   * @param {Object} newState
   * @returns {boolean}
   */
  shouldNotify(oldState, newState) {
    return true; // Override for optimization
  }

  /**
   * Notify all listeners
   */
  notify() {
    this.listeners.forEach(callback => {
      try {
        callback(this.getState());
      } catch (error) {
        console.error('Error in store listener:', error);
      }
    });
  }

  /**
   * Create an action method
   * @param {string} name
   * @param {Function} actionFn
   */
  createAction(name, actionFn) {
    this.actions[name] = (...args) => {
      try {
        const result = actionFn.apply(this, args);
        // If action returns a promise, handle it
        if (result && typeof result.then === 'function') {
          return result.then(() => this.notify()).catch(error => {
            console.error(`Action ${name} failed:`, error);
            throw error;
          });
        }
        this.notify();
        return result;
      } catch (error) {
        console.error(`Action ${name} failed:`, error);
        throw error;
      }
    };
  }

  /**
   * Create a computed property
   * @param {string} name
   * @param {Function} computeFn
   */
  createComputed(name, computeFn) {
    this.computed[name] = () => computeFn.call(this, this.state);
    Object.defineProperty(this, name, {
      get: () => this.computed[name](),
      enumerable: true
    });
  }

  /**
   * Reset store to initial state
   */
  reset() {
    this.state = {};
    this.notify();
  }

  /**
   * Dispose store and cleanup
   */
  dispose() {
    this.listeners.clear();
    this.actions = {};
    this.computed = {};
  }
}

/**
 * Singleton store instances for global state
 */
export const storeInstances = new Map();

/**
 * Get or create store instance
 * @param {string} name
 * @param {Function} StoreClass
 * @param {*} initialState
 * @returns {Store}
 */
export function getStore(name, StoreClass, initialState = {}) {
  if (!storeInstances.has(name)) {
    storeInstances.set(name, new StoreClass(initialState));
  }
  return storeInstances.get(name);
}

/**
 * Dispose all stores
 */
export function disposeAllStores() {
  storeInstances.forEach(store => store.dispose());
  storeInstances.clear();
}

export default Store;