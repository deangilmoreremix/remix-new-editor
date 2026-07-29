// Base Modal Class - Foundation for all modal dialogs
// Provides overlay management, animations, and accessibility

import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class Modal extends Component {
  constructor(props = {}) {
    super(props);

    this.overlay = null;
    this.modalElement = null;
    this.isOpen = false;
    this.isAnimated = props.animated !== false;
    this.size = props.size || 'medium'; // small, medium, large, fullscreen
    this.closable = props.closable !== false;

    // Accessibility
    this.focusableElements = [];
    this.previouslyFocusedElement = null;

    // Callbacks
    this.onOpen = props.onOpen || (() => {});
    this.onClose = props.onClose || (() => {});
    this.onConfirm = props.onConfirm || (() => {});
    this.onCancel = props.onCancel || (() => {});
  }

  // ========== LIFECYCLE ==========

  beforeMount() {
    // Store previously focused element for accessibility
    this.previouslyFocusedElement = document.activeElement;
  }

  mounted() {
    this.setupAccessibility();
    this.setupEventListeners();
    this.animateIn();
  }

  beforeUnmount() {
    this.animateOut();
    this.restoreFocus();
  }

  // ========== RENDERING ==========

  render() {
    const modalClasses = [
      'modal',
      `modal-${this.size}`,
      this.isAnimated ? 'modal-animated' : '',
      this.isOpen ? 'modal-open' : ''
    ].filter(Boolean).join(' ');

    return createElementFromHTML(`
      <div class="modal-overlay ${this.isOpen ? 'active' : ''}" role="dialog" aria-modal="true">
        <div class="modal-container ${modalClasses}" role="document">
          <!-- Modal Header -->
          <div class="modal-header">
            <h2 class="modal-title">${this.getTitle()}</h2>
            ${this.closable ? '<button class="modal-close" aria-label="Close">&times;</button>' : ''}
          </div>

          <!-- Modal Body -->
          <div class="modal-body">
            ${this.renderBody()}
          </div>

          <!-- Modal Footer -->
          <div class="modal-footer">
            ${this.renderFooter()}
          </div>
        </div>
      </div>
    `);
  }

  // Override these methods in subclasses
  getTitle() {
    return 'Modal';
  }

  renderBody() {
    return '<div class="modal-placeholder">Modal content goes here</div>';
  }

  renderFooter() {
    return `
      <button class="btn btn-secondary modal-cancel">Cancel</button>
      <button class="btn btn-primary modal-confirm">Confirm</button>
    `;
  }

  // ========== MODAL MANAGEMENT ==========

  open() {
    if (this.isOpen) return;

    this.isOpen = true;
    document.body.appendChild(this.render());
    document.body.classList.add('modal-open');

    // Update DOM references
    this.overlay = document.querySelector('.modal-overlay');
    this.modalElement = this.overlay.querySelector('.modal-container');

    this.mounted();
    this.onOpen();
  }

  close() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.beforeUnmount();

    setTimeout(() => {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      document.body.classList.remove('modal-open');
      this.unmounted();
      this.onClose();
    }, this.isAnimated ? 300 : 0);
  }

  // ========== ACCESSIBILITY ==========

  setupAccessibility() {
    if (!this.overlay) return;

    // Set ARIA attributes
    this.overlay.setAttribute('aria-labelledby', 'modal-title');
    this.overlay.setAttribute('aria-describedby', 'modal-body');

    // Focus management
    this.focusableElements = this.overlay.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (this.focusableElements.length > 0) {
      this.focusableElements[0].focus();
    }

    // Keyboard navigation
    this.addEventListener(document, 'keydown', this.handleKeyDown.bind(this));
  }

  restoreFocus() {
    if (this.previouslyFocusedElement && this.previouslyFocusedElement.focus) {
      this.previouslyFocusedElement.focus();
    }
  }

  handleKeyDown(e) {
    switch (e.key) {
      case 'Escape':
        if (this.closable) {
          this.close();
        }
        break;
      case 'Tab':
        this.handleTabNavigation(e);
        break;
      case 'Enter':
        if (e.target.classList.contains('modal-confirm')) {
          this.handleConfirm();
        }
        break;
    }
  }

  handleTabNavigation(e) {
    if (this.focusableElements.length === 0) return;

    const firstElement = this.focusableElements[0];
    const lastElement = this.focusableElements[this.focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  // ========== EVENT HANDLERS ==========

  setupEventListeners() {
    if (!this.overlay) return;

    // Close button
    const closeBtn = this.overlay.querySelector('.modal-close');
    if (closeBtn) {
      this.addEventListener(closeBtn, 'click', () => this.close());
    }

    // Overlay click
    this.addEventListener(this.overlay, 'click', (e) => {
      if (e.target === this.overlay && this.closable) {
        this.close();
      }
    });

    // Action buttons
    const cancelBtn = this.overlay.querySelector('.modal-cancel');
    if (cancelBtn) {
      this.addEventListener(cancelBtn, 'click', () => this.handleCancel());
    }

    const confirmBtn = this.overlay.querySelector('.modal-confirm');
    if (confirmBtn) {
      this.addEventListener(confirmBtn, 'click', () => this.handleConfirm());
    }
  }

  handleConfirm() {
    this.onConfirm();
    this.close();
  }

  handleCancel() {
    this.onCancel();
    this.close();
  }

  // ========== ANIMATIONS ==========

  animateIn() {
    if (!this.isAnimated || !this.modalElement) return;

    // Start with hidden state
    this.modalElement.style.opacity = '0';
    this.modalElement.style.transform = 'scale(0.9) translateY(-20px)';

    // Animate in
    requestAnimationFrame(() => {
      this.modalElement.style.transition = 'all 0.3s ease-out';
      this.modalElement.style.opacity = '1';
      this.modalElement.style.transform = 'scale(1) translateY(0)';
    });
  }

  animateOut() {
    if (!this.isAnimated || !this.modalElement) return;

    this.modalElement.style.opacity = '0';
    this.modalElement.style.transform = 'scale(0.9) translateY(-20px)';
  }

  // ========== UTILITIES ==========

  setSize(size) {
    this.size = size;
    if (this.modalElement) {
      this.modalElement.className = this.modalElement.className.replace(
        /modal-(small|medium|large|fullscreen)/,
        `modal-${size}`
      );
    }
  }

  setTitle(title) {
    this.title = title;
    const titleEl = this.overlay?.querySelector('.modal-title');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }

  updateBody(content) {
    const bodyEl = this.overlay?.querySelector('.modal-body');
    if (bodyEl) {
      if (typeof content === 'string') {
        bodyEl.innerHTML = content;
      } else if (content instanceof HTMLElement) {
        bodyEl.innerHTML = '';
        bodyEl.appendChild(content);
      }
    }
  }

  // ========== STATIC METHODS ==========

  static alert(message, options = {}) {
    const modal = new Modal({
      ...options,
      closable: true,
      onConfirm: () => {}, // Just close
      onCancel: () => {} // Just close
    });

    modal.getTitle = () => 'Alert';
    modal.renderBody = () => `<p>${message}</p>`;
    modal.renderFooter = () => '<button class="btn btn-primary modal-confirm">OK</button>';

    modal.open();
    return modal;
  }

  static confirm(message, options = {}) {
    return new Promise((resolve) => {
      const modal = new Modal({
        ...options,
        closable: true,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });

      modal.getTitle = () => 'Confirm';
      modal.renderBody = () => `<p>${message}</p>`;

      modal.open();
    });
  }

  static prompt(message, defaultValue = '', options = {}) {
    return new Promise((resolve) => {
      const modal = new Modal({
        ...options,
        closable: true,
        onConfirm: () => {
          const input = modal.overlay.querySelector('input');
          resolve(input ? input.value : '');
        },
        onCancel: () => resolve(null)
      });

      modal.getTitle = () => 'Input';
      modal.renderBody = () => `
        <p>${message}</p>
        <input type="text" class="form-input" value="${defaultValue}" autofocus>
      `;

      modal.open();
    });
  }
}