// Base Component Class - Core of the vanilla JS component system
// Provides lifecycle management, automatic event cleanup, store subscriptions, and error boundaries

export default class Component {
  constructor(props = {}, options = {}) {
    this.props = props;
    this.state = {};
    this.element = null;
    this.children = [];
    this.eventListeners = [];
    this.storeSubscriptions = [];
    this.isMounted = false;
    this.isDestroyed = false;
    this.parent = null;
    this.key = options.key || null;
    this.ref = options.ref || null;

    // Error boundary
    this.error = null;
    this.errorInfo = null;

    // Lifecycle hooks
    this.beforeMount = this.beforeMount.bind(this);
    this.mounted = this.mounted.bind(this);
    this.beforeUpdate = this.beforeUpdate.bind(this);
    this.updated = this.updated.bind(this);
    this.beforeUnmount = this.beforeUnmount.bind(this);
    this.unmounted = this.unmounted.bind(this);
    this.onError = this.onError.bind(this);
  }

  // ========== LIFECYCLE METHODS ==========

  // Called before component is mounted
  beforeMount() {
    // Override in subclasses
  }

  // Called after component is mounted
  mounted() {
    // Override in subclasses
  }

  // Called before component updates
  beforeUpdate() {
    // Override in subclasses
  }

  // Called after component updates
  updated() {
    // Override in subclasses
  }

  // Called before component is unmounted
  beforeUnmount() {
    // Override in subclasses
  }

  // Called after component is unmounted
  unmounted() {
    // Override in subclasses
  }

  // Error boundary handler
  onError(error, errorInfo) {
    this.error = error;
    this.errorInfo = errorInfo;
    console.error('Component Error:', error, errorInfo);
    this.renderError();
  }

  // ========== STATE MANAGEMENT ==========

  // Set component state (triggers re-render)
  setState(newState, callback = null) {
    if (this.isDestroyed) return;

    const prevState = { ...this.state };
    this.state = { ...this.state, ...newState };

    if (this.shouldUpdate(prevState, this.state)) {
      this.update();
    }

    if (callback) {
      callback();
    }
  }

  // Check if component should update
  shouldUpdate(prevState, nextState) {
    return JSON.stringify(prevState) !== JSON.stringify(nextState) ||
           JSON.stringify(this.props) !== JSON.stringify(this.props);
  }

  // Force component update
  forceUpdate(callback = null) {
    if (this.isDestroyed) return;
    this.update();
    if (callback) callback();
  }

  // ========== STORE SUBSCRIPTIONS ==========

  // Subscribe to store changes
  subscribeToStore(store, callback) {
    if (!store || typeof store.subscribe !== 'function') {
      console.warn('Invalid store provided to subscribeToStore');
      return;
    }

    const unsubscribe = store.subscribe(callback);
    this.storeSubscriptions.push(unsubscribe);
    return unsubscribe;
  }

  // Unsubscribe from all stores
  unsubscribeFromStores() {
    this.storeSubscriptions.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this.storeSubscriptions = [];
  }

  // ========== EVENT MANAGEMENT ==========

  // Add event listener with automatic cleanup
  addEventListener(element, event, handler, options = {}) {
    if (!element || !event || !handler) return;

    const boundHandler = handler.bind(this);
    element.addEventListener(event, boundHandler, options);

    this.eventListeners.push({
      element,
      event,
      handler: boundHandler,
      options
    });

    return boundHandler;
  }

  // Remove specific event listener
  removeEventListener(element, event, handler) {
    const index = this.eventListeners.findIndex(listener =>
      listener.element === element &&
      listener.event === event &&
      listener.handler === handler
    );

    if (index > -1) {
      const listener = this.eventListeners[index];
      listener.element.removeEventListener(listener.event, listener.handler, listener.options);
      this.eventListeners.splice(index, 1);
    }
  }

  // Remove all event listeners
  removeAllEventListeners() {
    this.eventListeners.forEach(listener => {
      try {
        listener.element.removeEventListener(listener.event, listener.handler, listener.options);
      } catch (error) {
        // Element might already be removed
        console.warn('Failed to remove event listener:', error);
      }
    });
    this.eventListeners = [];
  }

  // ========== DOM MANIPULATION ==========

  // Create element from HTML string
  createElementFromHTML(htmlString) {
    const template = document.createElement('template');
    template.innerHTML = htmlString.trim();
    return template.content.firstElementChild;
  }

  // Create element from JSX-like object (simplified)
  createElement(tagName, attributes = {}, ...children) {
    const element = document.createElement(tagName);

    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        // Event handler
        const eventName = key.toLowerCase().substring(2);
        this.addEventListener(element, eventName, value);
      } else if (key === 'ref' && typeof value === 'function') {
        value(element);
      } else {
        element.setAttribute(key, value);
      }
    });

    // Add children
    children.forEach(child => {
      if (typeof child === 'string' || typeof child === 'number') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Component) {
        element.appendChild(child.render());
      } else if (child instanceof HTMLElement) {
        element.appendChild(child);
      } else if (Array.isArray(child)) {
        child.forEach(c => {
          if (c instanceof Component) {
            element.appendChild(c.render());
          } else if (c instanceof HTMLElement) {
            element.appendChild(c);
          } else if (typeof c === 'string') {
            element.appendChild(document.createTextNode(c));
          }
        });
      }
    });

    return element;
  }

  // Query element within component
  $(selector) {
    return this.element ? this.element.querySelector(selector) : null;
  }

  // Query all elements within component
  $$(selector) {
    return this.element ? Array.from(this.element.querySelectorAll(selector)) : [];
  }

  // ========== RENDERING ==========

  // Main render method (must be implemented by subclasses)
  render() {
    throw new Error('render() method must be implemented by subclass');
  }

  // Render error state
  renderError() {
    const errorElement = this.createElement('div', {
      className: 'component-error',
      style: {
        padding: '20px',
        border: '1px solid #dc3545',
        borderRadius: '4px',
        backgroundColor: '#f8d7da',
        color: '#721c24'
      }
    },
    this.createElement('h3', {}, 'Component Error'),
    this.createElement('p', {}, this.error?.message || 'An unexpected error occurred'),
    this.createElement('details', {},
      this.createElement('summary', {}, 'Error Details'),
      this.createElement('pre', {}, this.error?.stack || 'No stack trace available')
    )
    );

    return errorElement;
  }

  // Update component (re-render)
  update() {
    if (this.isDestroyed || !this.element) return;

    try {
      this.beforeUpdate();

      const newElement = this.render();

      // Replace element content
      if (this.element.parentNode) {
        this.element.parentNode.replaceChild(newElement, this.element);
        this.element = newElement;
      }

      this.updated();
    } catch (error) {
      this.onError(error, { componentStack: this.constructor.name });
    }
  }

  // ========== COMPONENT MANAGEMENT ==========

  // Mount component to DOM
  mount(container) {
    if (this.isDestroyed) return;

    try {
      this.beforeMount();

      if (typeof container === 'string') {
        container = document.querySelector(container);
      }

      if (!container) {
        throw new Error('Invalid container provided to mount()');
      }

      this.element = this.render();
      container.appendChild(this.element);
      this.isMounted = true;

      this.mounted();
    } catch (error) {
      this.onError(error, { phase: 'mounting' });
    }
  }

  // Unmount component from DOM
  unmount() {
    if (!this.isMounted || this.isDestroyed) return;

    try {
      this.beforeUnmount();

      // Remove from DOM
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }

      // Clean up
      this.removeAllEventListeners();
      this.unsubscribeFromStores();
      this.element = null;
      this.isMounted = false;

      this.unmounted();
    } catch (error) {
      console.error('Error during unmount:', error);
    }
  }

  // Destroy component completely
  destroy() {
    this.unmount();
    this.isDestroyed = true;

    // Clear references
    this.props = null;
    this.state = null;
    this.children = [];
    this.parent = null;
  }

  // ========== CHILD COMPONENT MANAGEMENT ==========

  // Add child component
  addChild(childComponent) {
    if (!(childComponent instanceof Component)) {
      throw new Error('Child must be a Component instance');
    }

    childComponent.parent = this;
    this.children.push(childComponent);
  }

  // Remove child component
  removeChild(childComponent) {
    const index = this.children.indexOf(childComponent);
    if (index > -1) {
      childComponent.parent = null;
      this.children.splice(index, 1);
    }
  }

  // Get child by key
  getChild(key) {
    return this.children.find(child => child.key === key);
  }

  // ========== UTILITIES ==========

  // Debounce function calls
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttle function calls
  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Generate unique ID
  generateId(prefix = 'component') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Deep clone object
  clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // Check if running in browser
  isBrowser() {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  // Safe console logging
  log(...args) {
    if (this.isBrowser() && console) {
      console.log(`[${this.constructor.name}]`, ...args);
    }
  }

  // Safe console error
  error(...args) {
    if (this.isBrowser() && console) {
      console.error(`[${this.constructor.name}]`, ...args);
    }
  }
}

// Named export kept alongside the default so legacy importers that use
// `import { Component } from '../base/Component.js'` (resolved to this
// src/ variant by the dev-server legacy resolver) continue to work.
export { Component };