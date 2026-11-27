// The unified "Add to timeline" window has a Template videos tab (hosted AI video clips, added as video clips at the playhead).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddToTimelineModal, type AddToTimelineActions } from '@cinegen/components/edit/add-to-timeline-modal';
import type { TemplateVideo } from '@cinegen/components/edit/template-videos-modal';

vi.mock('@cinegen/lib/occ/mg-templates', async (orig) => ({ ...(await orig<typeof import('@cinegen/lib/occ/mg-templates')>()), loadMgTemplates: async () => [] }));

const actions = (over: Partial<AddToTimelineActions> = {}): AddToTimelineActions => ({ onPickMotion: vi.fn(), onAddKind: vi.fn(), onAddTemplate: vi.fn(), ...over });

describe('Add to timeline: Template videos tab', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('is hidden when the editor does not provide onPickTemplateVideo', () => {
    render(<AddToTimelineModal onClose={() => {}} actions={actions()} />);
    expect(screen.queryByRole('tab', { name: /Template videos/ })).toBeNull();
  });

  it('shows the tab with a count, opens the template panel, and a picked clip goes to the editor and closes the window', () => {
    const onPickTemplateVideo = vi.fn();
    const onClose = vi.fn();
    render(<AddToTimelineModal onClose={onClose} actions={actions({ onPickTemplateVideo })} />);
    const tab = screen.getByRole('tab', { name: /Template videos/ });
    expect(tab.textContent).toMatch(/\d+$/);
    fireEvent.click(tab);
    expect(screen.getByRole('tablist', { name: 'Template video categories' })).toBeTruthy(); // the template panel's own category chips
    fireEvent.click(screen.queryAllByTestId(/^template-video-/)[0]);
    expect(onPickTemplateVideo).toHaveBeenCalledTimes(1);
    expect((onPickTemplateVideo.mock.calls[0][0] as TemplateVideo).videoSrc).toMatch(/^https:\/\//);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the shared modal shell and closes from the × button, Escape and a backdrop press, but not from a press inside', () => {
    const onClose = vi.fn();
    render(<AddToTimelineModal onClose={onClose} actions={actions()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('.cg-modal__title')?.textContent).toBe('Add to timeline');
    fireEvent.mouseDown(screen.getByRole('tablist', { name: 'Categories' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.mouseDown(dialog);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
