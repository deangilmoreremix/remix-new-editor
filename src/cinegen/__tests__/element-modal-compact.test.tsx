import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// The assistant / generator pull in app-only CSS and providers; the modal's own logic is what is under test.
vi.mock('@cinegen/components/elements/element-description-assistant', () => ({ ElementDescriptionAssistant: () => null }));
vi.mock('@cinegen/components/elements/element-generate', () => ({ ElementGenerate: () => null }));
vi.mock('@cinegen/components/elements/element-image-upload', () => ({ ElementImageUpload: () => null }));
import { ElementModalCompact } from '@cinegen/components/elements/element-modal-compact';

// [remix] CineGen's one-page "New Element" modal (commit 93ac07a), saving through the variation model.
describe('ElementModalCompact', () => {
  it('creates an element with name, type, description and a baseline variation', async () => {
    const onSave = vi.fn();
    render(<ElementModalCompact onSave={onSave} onClose={() => {}} />);
    expect(screen.getByText('New Element')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('e.g. Detective Sarah'), { target: { value: 'David Besh' } });
    fireEvent.click(screen.getByText('Prop'));
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const data = onSave.mock.calls[0][0];
    expect(data).toMatchObject({ name: 'David Besh', type: 'prop' });
    expect(data.variations).toHaveLength(1);
    expect(data.activeVariationId).toBe(data.variations[0].id);
  });
  it('edit mode shows Delete and Save, and Continuity looks opens the studio with the draft', () => {
    const onOpenStudio = vi.fn();
    const element = { id: 'e1', name: 'Mara', type: 'character', description: 'x', images: [], createdAt: '', updatedAt: '' } as never;
    render(<ElementModalCompact element={element} onSave={() => {}} onDelete={() => {}} onClose={() => {}} onOpenStudio={onOpenStudio} />);
    expect(screen.getByText('Edit Element')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
    fireEvent.click(screen.getByText('Continuity looks…'));
    expect(onOpenStudio).toHaveBeenCalledWith({ name: 'Mara', type: 'character', description: 'x' });
  });
});
