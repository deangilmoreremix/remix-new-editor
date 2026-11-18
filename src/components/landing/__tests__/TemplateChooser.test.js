import { describe, it, expect, vi, afterEach } from 'vitest';
import { templateCards, openTemplateChooser } from '../TemplateChooser.js';
import { TEMPLATES } from '../../../lib/landingPages/templates.js';

const designs = TEMPLATES.filter((t) => t.puck);
const groups = [['No landing page', [{ id: '', name: 'Plain video page', description: '', layout: 'minimal' }]], ['Editable landing pages', designs], ['Empty', []]];

afterEach(() => { document.body.innerHTML = ''; });

describe('landing page chooser', () => {
  it('shows every design as a card in its group (live page preview), and marks the picked one', async () => {
    const onPick = vi.fn();
    const mountPuckPage = vi.fn(() => ({ destroy() {} }));
    const { node, destroy } = templateCards({ groups, selected: 'puck-spark', onPick, deps: { mountPuckPage } });
    expect(node.querySelectorAll('[data-template-card]')).toHaveLength(designs.length + 1);
    expect(node.textContent).toContain('Editable landing pages');
    expect(node.textContent).not.toContain('Empty');
    expect(node.querySelector('[data-template-card="puck-spark"]').getAttribute('aria-pressed')).toBe('true');
    node.querySelector('[data-template-card="puck-enterprise"]').click();
    expect(onPick).toHaveBeenCalledWith('puck-enterprise');
    expect(node.querySelector('[data-template-card="puck-enterprise"]').getAttribute('aria-pressed')).toBe('true');
    expect(node.querySelector('[data-template-card="puck-spark"]').getAttribute('aria-pressed')).toBe('false');
    // Editable designs get a live page preview; other layouts keep their wireframe.
    expect(node.querySelector('[data-template-card="puck-enterprise"] [role="img"]')).not.toBeNull();
    expect(node.querySelector('[data-template-card=""] svg')).not.toBeNull();
    await vi.waitFor(() => expect(mountPuckPage).toHaveBeenCalledTimes(designs.length));
    expect(mountPuckPage.mock.calls[0][1].data).toBe(designs[0].puckData);
    destroy();
    expect(node.querySelector('[data-template-card="puck-enterprise"] [role="img"]').children).toHaveLength(0);
  });

  it('as a modal: pick a card, then "Use this page"', () => {
    const onPick = vi.fn();
    openTemplateChooser({ groups, selected: 'design-not-listed', onPick });
    const dlg = document.querySelector('[data-template-chooser]');
    const ok = dlg.querySelector('[data-template-confirm]');
    expect(ok.disabled).toBe(true);
    dlg.querySelector('[data-template-card="puck-leadiq"]').click();
    expect(onPick).not.toHaveBeenCalled();
    ok.click();
    expect(onPick).toHaveBeenCalledWith('puck-leadiq');
    expect(document.querySelector('[data-template-chooser]')).toBeNull();
  });

  it('the plain video page can be picked; Esc and a click outside close without picking', () => {
    const onPick = vi.fn();
    openTemplateChooser({ groups, selected: 'puck-spark', onPick });
    document.querySelector('[data-template-card=""]').click();
    document.querySelector('[data-template-confirm]').click();
    expect(onPick).toHaveBeenLastCalledWith('');
    openTemplateChooser({ groups, selected: 'puck-spark', onPick });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('[data-template-chooser]')).toBeNull();
    openTemplateChooser({ groups, selected: 'puck-spark', onPick });
    const overlay = document.querySelector('[data-template-chooser]');
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('[data-template-chooser]')).toBeNull();
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});
