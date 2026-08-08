import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  supabase: { functions: { invoke: vi.fn() } },
  isSupabaseConfigured: vi.fn(() => true),
  getSupabaseUrl: vi.fn(),
  getUserKey: vi.fn(),
}));

import { GTMInfoModal } from '../components/modals/GTMInfoModal.jsx';
import { gtmContentLibrary } from '../lib/gtmContentLibrary.js';

const makeSafeEl = () => {
  const el = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn(() => false) },
    style: {},
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    getAttribute: vi.fn(() => null),
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    focus: vi.fn(),
    blur: vi.fn(),
    click: vi.fn(),
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    dataset: {},
    type: '',
  };
  el.querySelector = vi.fn(() => makeSafeEl());
  el.querySelectorAll = vi.fn(() => []);
  return el;
};

describe('GTMInfoModal', () => {
  let fakeOverlay;

  beforeEach(() => {
    fakeOverlay = makeSafeEl();
    global.window = {
      CustomEvent: class CustomEvent { constructor(type, opts) { this.type = type; this.detail = opts?.detail || {}; } },
      dispatchEvent: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false, addEventListener: vi.fn() })),
    };
    global.navigator = { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with the correct title', () => {
    const modal = new GTMInfoModal();
    expect(modal.title).toBe('Understanding GTM Boost Options');
  });

  it('renders all seven GTM categories', () => {
    const modal = new GTMInfoModal();
    const body = modal.renderBody();
    expect(body).toContain('Target Role');
    expect(body).toContain('Industry');
    expect(body).toContain('Sales Methodology');
    expect(body).toContain('Writing Style');
    expect(body).toContain('Model');
    expect(body).toContain('Conversion Focus');
    expect(body).toContain('Cinematic Enhancement Elements');
  });

  it('renders section counts', () => {
    const modal = new GTMInfoModal();
    const body = modal.renderBody();
    expect(body).toContain('gtm-info-section-count');
    expect(body).toContain('aria-label=');
  });

  it('renders a search input', () => {
    const modal = new GTMInfoModal();
    const body = modal.renderBody();
    expect(body).toContain('id="gtm-info-search"');
    expect(body).toContain('data-action="gtm-info-search"');
    expect(body).toContain('Search options...');
  });

  it('renders expand/collapse all controls', () => {
    const modal = new GTMInfoModal();
    const body = modal.renderBody();
    expect(body).toContain('data-action="gtm-expand-all"');
    expect(body).toContain('data-action="gtm-collapse-all"');
  });

  it('renders recommended combinations', () => {
    const modal = new GTMInfoModal();
    const body = modal.renderBody();
    expect(body).toContain('Recommended Starting Combinations');
    expect(body).toContain('Cold Outreach Starter');
    expect(body).toContain('Enterprise Demo');
    expect(body).toContain('data-combo-label=');
  });

  it('renders bestFor and example for options', () => {
    const modal = new GTMInfoModal();
    const body = modal.renderBody();
    expect(body).toContain('Best for');
    expect(body).toContain('Example');
  });

  it('renders difficulty badges', () => {
    const modal = new GTMInfoModal();
    const body = modal.renderBody();
    expect(body).toContain('Easy');
    expect(body).toContain('Medium');
    expect(body).toContain('Hard');
  });

  it('renders role descriptions', () => {
    const modal = new GTMInfoModal();
    const body = modal.renderBody();
    expect(body).toContain('SDR/BDR Prospecting');
    expect(body).toContain('Account Executive Discovery');
    expect(body).toContain('Sales Management');
    expect(body).toContain('Revenue Operations');
    expect(body).toContain('Customer Success');
    expect(body).toContain('Executive Leadership');
  });

  it('renders industry descriptions', () => {
    const modal = new GTMInfoModal();
    const body = modal.renderBody();
    expect(body).toContain('SaaS');
    expect(body).toContain('FinTech');
    expect(body).toContain('Healthcare');
  });

  it('renders methodology descriptions', () => {
    const modal = new GTMInfoModal();
    const body = modal.renderBody();
    expect(body).toContain('MEDDPICC');
    expect(body).toContain('SPIN Selling');
    expect(body).toContain('Challenger Sale');
    expect(body).toContain('Gap Selling');
    expect(body).toContain('Value Selling');
    expect(body).toContain('Sandler Selling');
  });

  it('renders tonality descriptions', () => {
    const modal = new GTMInfoModal();
    const body = modal.renderBody();
    expect(body).toContain('Professional');
    expect(body).toContain('Executive Gravitas');
    expect(body).toContain('Conversational Peer');
  });

  it('renders model descriptions from gtmContentLibrary', () => {
    const modal = new GTMInfoModal();
    const body = modal.renderBody();
    expect(body).toContain('GPT-4o Mini');
    expect(body).toContain('GPT-4o');
    expect(body).toContain('GPT-4.1');
    expect(body).toContain('GPT-5 Mini');
    expect(body).toContain('GPT-5 Nano');
    expect(body).toContain('cost-effective');
    expect(body).toContain('Balanced performance');
  });

  it('renders conversion focus descriptions', () => {
    const modal = new GTMInfoModal();
    const body = modal.renderBody();
    expect(body).toContain('Lead Generation');
    expect(body).toContain('Brand Awareness');
    expect(body).toContain('Education');
    expect(body).toContain('Product Demo');
  });

  it('renders cinematic element descriptions', () => {
    const modal = new GTMInfoModal();
    const body = modal.renderBody();
    expect(body).toContain('Opening Hooks');
    expect(body).toContain('Storytelling Structure');
    expect(body).toContain('Visual Cinematography');
    expect(body).toContain('Audio Excellence');
    expect(body).toContain('Pacing &amp; Editing');
    expect(body).toContain('Emotional Engagement');
    expect(body).toContain('CTA Integration');
  });

  it('uses details/summary for accessible accordion sections', () => {
    const modal = new GTMInfoModal();
    const body = modal.renderBody();
    expect(body).toContain('<details');
    expect(body).toContain('<summary');
  });

  it('has a close button in the footer', () => {
    const modal = new GTMInfoModal();
    expect(modal.footerContent).toContain('Close');
    expect(modal.footerContent).toContain('data-action="close"');
  });

  it('binds the close button in setupEventListeners', () => {
    const modal = new GTMInfoModal();
    modal.overlay = fakeOverlay;
    expect(() => modal.setupEventListeners()).not.toThrow();
    const closeBtn = fakeOverlay.querySelector('[data-action="close"]');
    expect(closeBtn).toBeTruthy();
  });

  it('filters sections by search query', () => {
    const modal = new GTMInfoModal();
    modal.searchQuery = 'SaaS';
    const body = modal.renderBody();
    expect(body).toContain('SaaS');
    expect(body).not.toContain('FinTech');
  });

  it('renders empty state when no results match', () => {
    const modal = new GTMInfoModal();
    modal.searchQuery = 'zzzz-not-found';
    const body = modal.renderBody();
    expect(body).toContain('No matching options found.');
    expect(body).toContain('Try a shorter search term.');
  });

  it('supports expand all', () => {
    const modal = new GTMInfoModal();
    modal.setAllSectionsOpen(true);
    expect(modal.allExpanded).toBe(true);
    expect(modal.expandedSections.size).toBeGreaterThan(0);
  });

  it('supports collapse all', () => {
    const modal = new GTMInfoModal();
    modal.setAllSectionsOpen(true);
    modal.setAllSectionsOpen(false);
    expect(modal.allExpanded).toBe(false);
    expect(modal.expandedSections.size).toBe(0);
  });

  it('detects reduced motion preference', () => {
    const modal = new GTMInfoModal();
    modal.detectReducedMotion();
    expect(modal.prefersReducedMotion).toBe(false);
  });

  it('binds search, expand, collapse, and combo listeners in setupEventListeners', () => {
    const modal = new GTMInfoModal();
    modal.overlay = fakeOverlay;
    expect(() => modal.setupEventListeners()).not.toThrow();
    expect(fakeOverlay.querySelector('[data-action="gtm-info-search"]')).toBeTruthy();
    expect(fakeOverlay.querySelector('[data-action="gtm-expand-all"]')).toBeTruthy();
    expect(fakeOverlay.querySelector('[data-action="gtm-collapse-all"]')).toBeTruthy();
    expect(fakeOverlay.querySelector('[data-action="gtm-combo"]')).toBeTruthy();
  });

  it('renders aria-live region for sections', () => {
    const modal = new GTMInfoModal();
    const body = modal.renderBody();
    expect(body).toContain('aria-live="polite"');
    expect(body).toContain('aria-label="GTM Boost options"');
  });
});
