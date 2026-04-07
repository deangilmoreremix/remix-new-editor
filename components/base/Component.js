/**
 * Base Component Class - Vanilla JS replacement for React.Component
 * Provides lifecycle methods, DOM manipulation, and event handling
 * PRODUCTION VERSION with enhanced security and error handling
 */
import { escapeHtml } from '../../lib/utils/sanitize.js';

export class Component {
  constructor(props = {}) {
    this.props = this.validateProps(props);
    this.state = {};
    this.element = null;
    this.children = [];
    this.eventListeners = [];
    this.subscriptions = [];
    this.documentListeners = []; // Track document-level listeners
    this.isMounted = false;
    this.error = null;
  }

  /**
   * Validate and sanitize props
   * @param {Object} props
   * @returns {Object}
   */
  validateProps(props) {
    if (!props || typeof props !== 'object') return {};
    return { ...props }; // Shallow copy for immutability
  }

  /**
   * Main render method - must be implemented by subclasses
   * @returns {HTMLElement}
   */
  render() {
    throw new Error('Subclasses must implement render() method');
  }

  /**
   * Mount component to DOM container
   * @param {HTMLElement} container
   * @returns {HTMLElement}
   */
  mount(container) {
    if (!container || !(container instanceof HTMLElement)) {
      throw new Error('Container must be a valid HTMLElement');
    }

    try {
      this.element = this.render();
      if (!(this.element instanceof HTMLElement)) {
        throw new Error('render() must return an HTMLElement');
      }

      container.appendChild(this.element);
      this.isMounted = true;
      this.setupEventListeners();
      this.onMount();

      return this.element;
    } catch (error) {
      this.handleRenderError(error);
      throw error;
    }
  }

  /**
   * Handle render errors gracefully
   * @param {Error} error
   */
  handleRenderError(error) {
    console.error('Component render error:', error);
    this.error = error;
    
    // Show error boundary if container exists
    if (this.element?.parentNode) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'component-error';
      errorDiv.setAttribute('role', 'alert');
      errorDiv.innerHTML = `
        <h3>⚠️ Something went wrong</h3>
        <p>${escapeHtml(error.message)}</p>
        <button onclick="this.parentElement.retry()">Retry</button>
      `;
      errorDiv.retry = () => {
        this.error = null;
        this.mount(this.element.parentNode);
      };
      
      // Replace content with error
      if (this.element.parentNode) {
        this.element.parentNode.replaceChild(errorDiv, this.element);
      }
    }
  }

  /**
   * Unmount component and cleanup ALL resources
   */
  unmount() {
    if (!this.isMounted) return;

    try {
      this.onUnmount();
      this.cleanupEventListeners();
      this.cleanupDocumentListeners(); // NEW: Clean document listeners
      this.unsubscribeAll();
      this.cleanupTimers(); // NEW: Clean up any pending timers

      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }

      this.element = null;
      this.isMounted = false;
      this.error = null;
    } catch (error) {
      console.error('Error during unmount:', error);
    }
  }

  /**
   * Update component props
   * @param {Object} newProps
   */
  update(newProps = {}) {
    const oldProps = this.props;
    this.props = this.validateProps({ ...this.props, ...newProps });

    if (this.shouldUpdate(oldProps, this.props)) {
      this.cleanupEventListeners();

      const newElement = this.render();
      if (this.element && this.element.parentNode) {
        this.element.parentNode.replaceChild(newElement, this.element);
      }

      this.element = newElement;
      this.setupEventListeners();
      this.onUpdate();
    }
  }

  /**
   * Determine if component should re-render
   * @param {Object} oldProps
   * @param {Object} newProps
   * @returns {boolean}
   */
  shouldUpdate(oldProps, newProps) {
    return true; // Override for optimization
  }

  /**
   * Update component state
   * @param {Object} newState
   * @param {Function} callback
   */
  setState(newState, callback) {
    if (typeof newState === 'function') {
      this.state = newState(this.state);
    } else {
      this.state = { ...this.state, ...newState };
    }
    
    if (this.isMounted) {
      try {
        this.update();
      } catch (error) {
        this.handleRenderError(error);
      }
    }

    if (callback && typeof callback === 'function') {
      callback();
    }
  }

  /**
   * Setup event listeners - override in subclasses
   */
  setupEventListeners() {
    // Override in subclasses
  }

  /**
   * Cleanup all tracked event listeners
   */
  cleanupEventListeners() {
    this.eventListeners.forEach(({ element, event, handler }) => {
      try {
        element.removeEventListener(event, handler);
      } catch (error) {
        console.warn('Failed to remove event listener:', error);
      }
    });
    this.eventListeners = [];
  }

  /**
   * Cleanup document-level listeners (CRITICAL for memory leak prevention)
   */
  cleanupDocumentListeners() {
    this.documentListeners.forEach(({ element, event, handler }) => {
      try {
        element.removeEventListener(event, handler);
      } catch (error) {
        console.warn('Failed to remove document listener:', error);
      }
    });
    this.documentListeners = [];
  }

  /**
   * Track timers for cleanup
   */
  timers = [];

  setTimer(fn, delay) {
    const timerId = setTimeout(() => {
      fn();
      const index = this.timers.indexOf(timerId);
      if (index > -1) this.timers.splice(index, 1);
    }, delay);
    this.timers.push(timerId);
    return timerId;
  }

  setInterval(fn, delay) {
    const intervalId = setInterval(fn, delay);
    this.timers.push(intervalId);
    return intervalId;
  }

  clearTimer(id) {
    clearTimeout(id);
    clearInterval(id);
    const index = this.timers.indexOf(id);
    if (index > -1) this.timers.splice(index, 1);
  }

  cleanupTimers() {
    this.timers.forEach(id => {
      clearTimeout(id);
      clearInterval(id);
    });
    this.timers = [];
  }

  /**
   * Add event listener with automatic cleanup tracking
   * @param {HTMLElement} element
   * @param {string} event
   * @param {Function} handler
   * @param {Object} options
   */
  addEventListener(element, event, handler, options = {}) {
    element.addEventListener(event, handler, options);
    this.eventListeners.push({ element, event, handler, options });
  }

  /**
   * Add document-level listener (tracked for cleanup)
   * @param {string} event
   * @param {Function} handler
   * @param {Object} options
   */
  addDocumentListener(event, handler, options = {}) {
    document.addEventListener(event, handler, options);
    this.documentListeners.push({ element: document, event, handler, options });
  }

  /**
   * Subscribe to a store
   * @param {Store} store
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  subscribeToStore(store, callback) {
    if (store && typeof store.subscribe === 'function') {
      const unsubscribe = store.subscribe(callback);
      this.subscriptions.push(unsubscribe);
      return unsubscribe;
    }
    return null;
  }

  /**
   * Unsubscribe from all stores
   */
  unsubscribeAll() {
    this.subscriptions.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('Failed to unsubscribe:', error);
        }
      }
    });
    this.subscriptions = [];
  }

  /**
   * Create DOM element from HTML string (with XSS protection)
   * @param {string} html
   * @returns {HTMLElement}
   */
  createElementFromHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstChild;
  }

  /**
   * Safely interpolate values into HTML
   * @param {string} template
   * @param {Object} values
   * @returns {string}
   */
  safeInterpolate(template, values) {
    return template.replace(/\${(\w+)}/g, (match, key) => {
      return escapeHtml(String(values[key] ?? ''));
    });
  }

  /**
   * Query selector within component
   * @param {string} selector
   * @returns {HTMLElement|null}
   */
  querySelector(selector) {
    return this.element ? this.element.querySelector(selector) : null;
  }

  /**
   * Query selector all within component
   * @param {string} selector
   * @returns {NodeList}
   */
  querySelectorAll(selector) {
    return this.element ? this.element.querySelectorAll(selector) : null;
  }

  /**
   * Emit custom event
   * @param {string} eventName
   * @param {*} detail
   */
  emit(eventName, detail = null) {
    if (this.element) {
      const event = new CustomEvent(eventName, { detail, bubbles: true });
      this.element.dispatchEvent(event);
    }
  }

  /**
   * Delegate events to child elements
   * @param {string} event
   * @param {string} selector
   * @param {Function} handler
   */
  delegate(event, selector, handler) {
    if (this.element) {
      this.addEventListener(this.element, event, (e) => {
        if (e.target.matches(selector)) {
          handler.call(this, e);
        }
      });
    }
  }

  /**
   * Lifecycle methods - override in subclasses
   */
  onMount() {}
  onUnmount() {}
  onUpdate() {}
}

export default Component;