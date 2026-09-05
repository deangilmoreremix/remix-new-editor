// Reliability QA for the modal -> right-side drawer conversion in BaseModal.
// Verifies real DOM mechanics (jsdom): render structure, drawer CSS rules,
// close/animate-out teardown, Escape handling, static confirm/cancel/alert
// promises, and stacked (nested) drawers.
//
// NOTE: this file only observes behavior. No source files are modified.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BaseModal, ConfirmModal } from '../../src/components/modals/BaseModal.jsx';

// BaseModal.close() schedules destroy() at DESIGN_SYSTEM.durations.normal (200ms).
// Wait longer than that so teardown definitely ran.
const CLOSE_WAIT = 350;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const overlays = () => Array.from(document.querySelectorAll('.modal-overlay'));
const lastOverlay = () => overlays()[overlays().length - 1] || null;

function hardResetDom() {
  overlays().forEach((el) => el.parentNode && el.parentNode.removeChild(el));
  document.body.classList.remove('modal-open');
  document.body.style.overflow = '';
}

describe('BaseModal drawer conversion - import sanity', () => {
  it('imports BaseModal and ConfirmModal cleanly', () => {
    expect(typeof BaseModal).toBe('function');
    expect(typeof ConfirmModal).toBe('function');
    expect(Object.getPrototypeOf(ConfirmModal)).toBe(BaseModal);
    // Static drawer helpers still present
    expect(typeof BaseModal.confirm).toBe('function');
    expect(typeof BaseModal.alert).toBe('function');
    expect(typeof BaseModal.prompt).toBe('function');
    expect(BaseModal.SIZES).toMatchObject({
      small: { maxWidth: '400px' },
      medium: { maxWidth: '600px' },
      large: { maxWidth: '800px' },
      full: { maxWidth: '90vw' },
    });
  });
});

describe('BaseModal drawer - open() renders drawer structure', () => {
  let modal;

  beforeEach(() => {
    hardResetDom();
    modal = new BaseModal({ title: 'X', size: 'large' });
    modal.open();
  });

  afterEach(async () => {
    if (modal) modal.close();
    await wait(CLOSE_WAIT);
    hardResetDom();
  });

  it('creates .modal-overlay in the document', () => {
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.getAttribute('role')).toBe('dialog');
    expect(overlay.getAttribute('aria-modal')).toBe('true');
  });

  it('.modal-content exists and carries the size class modal-large', () => {
    const content = document.querySelector('.modal-content');
    expect(content).not.toBeNull();
    expect(content.classList.contains('modal-content')).toBe(true);
    expect(content.classList.contains('modal-large')).toBe(true);
  });

  it('renders header, title, body and pinned footer', () => {
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay.querySelector('.modal-header')).not.toBeNull();
    expect(overlay.querySelector('.modal-title')).not.toBeNull();
    expect(overlay.querySelector('.modal-title').textContent.trim()).toBe('X');
    expect(overlay.querySelector('.modal-body')).not.toBeNull();
    expect(overlay.querySelector('.modal-footer')).not.toBeNull();
    // close button (closable defaults true)
    expect(overlay.querySelector('.modal-close')).not.toBeNull();
  });

  it('injects <style id="base-modal-styles"> containing the drawer rules', () => {
    const styleEl = document.getElementById('base-modal-styles');
    expect(styleEl).not.toBeNull();
    expect(styleEl.tagName.toLowerCase()).toBe('style');

    const css = styleEl.textContent || '';
    expect(css.length).toBeGreaterThan(0);

    // Drawer mechanics required by the conversion
    expect(css).toContain('justify-content: flex-end'); // pinned to right edge
    expect(css).toContain('transform: translateX(100%)'); // off-canvas start
    expect(css).toContain('height: 100%'); // full height

    // Supporting drawer traits
    expect(css).toContain('position: fixed');
    expect(css).toContain('align-items: stretch');
    expect(css).toContain('transform: translateX(0)'); // slid-in state
    expect(css).toContain('overflow-y: auto'); // scrollable body

    // Bounded width per size
    expect(css).toContain('.modal-content.modal-small { max-width: 400px; }');
    expect(css).toContain('.modal-content.modal-medium { max-width: 600px; }');
    expect(css).toContain('.modal-content.modal-large { max-width: 800px; }');

    // Backdrop still present
    expect(css).toMatch(/background:\s*rgba\(0,0,0,0\.55\)/);
  });

  it('scopes the drawer transform to the overlay .active state', () => {
    const css = document.getElementById('base-modal-styles').textContent;
    const activeRule = css.match(
      /\.modal-overlay\.active\s+\.modal-content\s*\{[^}]*\}/
    );
    expect(activeRule).not.toBeNull();
    expect(activeRule[0]).toContain('translateX(0)');
  });
});

describe('BaseModal drawer - close()', () => {
  afterEach(() => hardResetDom());

  it('removes .modal-overlay from the DOM after the animation window', async () => {
    const modal = new BaseModal({ title: 'Closing', size: 'medium' });
    modal.open();
    expect(document.querySelector('.modal-overlay')).not.toBeNull();

    modal.close();
    // animateOut() drops the .active class immediately
    expect(modal.state).toBe('closing');

    await wait(CLOSE_WAIT);

    expect(document.querySelector('.modal-overlay')).toBeNull();
    expect(modal.state).toBe('closed');
    expect(document.body.classList.contains('modal-open')).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('fires onClose exactly once and is idempotent on repeated close()', async () => {
    let closeCount = 0;
    const modal = new BaseModal({ title: 'Once', onClose: () => closeCount++ });
    modal.open();
    modal.close();
    modal.close(); // guarded by state !== 'open'
    await wait(CLOSE_WAIT);

    expect(closeCount).toBe(1);
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });
});

describe('BaseModal drawer - Escape key', () => {
  afterEach(() => hardResetDom());

  it('closes the drawer on document keydown Escape', async () => {
    const modal = new BaseModal({ title: 'Esc', size: 'small' });
    modal.open();
    expect(document.querySelector('.modal-overlay')).not.toBeNull();

    document.dispatchEvent(
      new window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
    );

    await wait(CLOSE_WAIT);
    expect(document.querySelector('.modal-overlay')).toBeNull();
    expect(modal.state).toBe('closed');
  });

  it('does NOT close on Escape when closeOnEscape is false', async () => {
    const modal = new BaseModal({ title: 'NoEsc', closeOnEscape: false });
    modal.open();

    document.dispatchEvent(
      new window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
    );

    await wait(CLOSE_WAIT);
    expect(document.querySelector('.modal-overlay')).not.toBeNull();
    expect(modal.state).toBe('open');

    modal.close();
    await wait(CLOSE_WAIT);
  });

  it('unbinds its document keydown listener after destroy', async () => {
    const modal = new BaseModal({ title: 'Unbind' });
    modal.open();
    modal.close();
    await wait(CLOSE_WAIT);

    // A stale listener would throw or resurrect DOM; assert clean no-op.
    expect(() =>
      document.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      )
    ).not.toThrow();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });
});

describe('BaseModal statics - confirm / alert promises', () => {
  afterEach(async () => {
    hardResetDom();
    await wait(10);
  });

  it('BaseModal.confirm() returns a Promise resolving true when .modal-confirm is clicked', async () => {
    const p = BaseModal.confirm('Are you sure?');
    expect(p).toBeInstanceOf(Promise);

    const overlay = lastOverlay();
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector('.modal-body').textContent).toContain(
      'Are you sure?'
    );

    const confirmBtn = overlay.querySelector('.modal-confirm');
    expect(confirmBtn).not.toBeNull();
    expect(confirmBtn.textContent.trim()).toBe('Confirm');

    confirmBtn.dispatchEvent(
      new window.MouseEvent('click', { bubbles: true, cancelable: true })
    );

    await expect(p).resolves.toBe(true);

    await wait(CLOSE_WAIT);
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('BaseModal.confirm() resolves false when .modal-cancel is clicked', async () => {
    const p = BaseModal.confirm('Discard changes?');

    const overlay = lastOverlay();
    const cancelBtn = overlay.querySelector('.modal-cancel');
    expect(cancelBtn).not.toBeNull();
    expect(cancelBtn.textContent.trim()).toBe('Cancel');

    cancelBtn.dispatchEvent(
      new window.MouseEvent('click', { bubbles: true, cancelable: true })
    );

    await expect(p).resolves.toBe(false);

    await wait(CLOSE_WAIT);
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('BaseModal.alert() resolves and renders a single confirm action', async () => {
    const p = BaseModal.alert('Heads up!');
    expect(p).toBeInstanceOf(Promise);

    const overlay = lastOverlay();
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector('.modal-body').textContent).toContain(
      'Heads up!'
    );
    // cancelText is null for alert -> only the confirm button in the footer
    expect(overlay.querySelector('.modal-cancel')).toBeNull();

    const okBtn = overlay.querySelector('.modal-confirm');
    expect(okBtn).not.toBeNull();
    expect(okBtn.textContent.trim()).toBe('OK');

    okBtn.dispatchEvent(
      new window.MouseEvent('click', { bubbles: true, cancelable: true })
    );

    await expect(p).resolves.toBe(true);

    await wait(CLOSE_WAIT);
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('confirm drawer uses the small size class and drawer structure', async () => {
    const p = BaseModal.confirm('Sized?');
    const content = lastOverlay().querySelector('.modal-content');
    expect(content.classList.contains('modal-small')).toBe(true);
    expect(content.querySelector('.modal-footer')).not.toBeNull();
    expect(content.querySelector('.modal-body')).not.toBeNull();

    lastOverlay()
      .querySelector('.modal-cancel')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await p;
    await wait(CLOSE_WAIT);
  });
});

describe('BaseModal drawer - nested / stacked drawers', () => {
  afterEach(() => hardResetDom());

  it('supports two simultaneously open drawers and closes both cleanly', async () => {
    const first = new BaseModal({ title: 'First', size: 'medium' });
    const second = new BaseModal({ title: 'Second', size: 'large' });

    first.open();
    expect(overlays()).toHaveLength(1);

    second.open();
    expect(overlays()).toHaveLength(2);

    // Both are real, independent drawer roots in the DOM at the same time.
    const [o1, o2] = overlays();
    expect(o1).not.toBe(o2);
    expect(o1.querySelector('.modal-title').textContent.trim()).toBe('First');
    expect(o2.querySelector('.modal-title').textContent.trim()).toBe('Second');
    expect(o1.querySelector('.modal-content').classList.contains('modal-medium')).toBe(true);
    expect(o2.querySelector('.modal-content').classList.contains('modal-large')).toBe(true);

    // Close the top-most drawer first.
    second.close();
    await wait(CLOSE_WAIT);
    expect(overlays()).toHaveLength(1);
    expect(document.querySelector('.modal-title').textContent.trim()).toBe('First');

    first.close();
    await wait(CLOSE_WAIT);
    expect(overlays()).toHaveLength(0);
    expect(document.body.classList.contains('modal-open')).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });
});

describe('BaseModal drawer - backdrop click', () => {
  afterEach(() => hardResetDom());

  it('closes when the overlay (backdrop) itself is clicked', async () => {
    const modal = new BaseModal({ title: 'Backdrop' });
    modal.open();
    const overlay = document.querySelector('.modal-overlay');

    overlay.dispatchEvent(
      new window.MouseEvent('click', { bubbles: true, cancelable: true })
    );

    await wait(CLOSE_WAIT);
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('does NOT close when a click originates inside .modal-content', async () => {
    const modal = new BaseModal({ title: 'Inside' });
    modal.open();
    const body = document.querySelector('.modal-body');

    body.dispatchEvent(
      new window.MouseEvent('click', { bubbles: true, cancelable: true })
    );

    await wait(CLOSE_WAIT);
    expect(document.querySelector('.modal-overlay')).not.toBeNull();
    expect(modal.state).toBe('open');

    modal.close();
    await wait(CLOSE_WAIT);
  });
});
