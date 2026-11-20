// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { SavedStylesBar } from '../SavedStylesBar';
import { rememberInBrowser, type SavedTextStyle } from '../../preview/textStyles';

afterEach(() => { cleanup(); window.localStorage.clear(); });
const look = { scale: 1, opacity: 1, animation: 'fade' as const };

function Harness({ initial = [], onApply = vi.fn(), disabled = false }: { initial?: SavedTextStyle[]; onApply?: (s: SavedTextStyle) => void; disabled?: boolean }) {
  const [styles, setStyles] = useState(initial);
  return <SavedStylesBar kind="text" idPrefix="t" styles={styles} onStylesChange={setStyles} capture={() => look} onApply={onApply} applyDisabled={disabled} />;
}

describe('SavedStylesBar', () => {
  it('saves, applies, renames and deletes', () => {
    const onApply = vi.fn();
    render(<Harness onApply={onApply} />);
    fireEvent.change(screen.getByTestId('t-style-name'), { target: { value: 'Hero' } });
    fireEvent.click(screen.getByTestId('t-style-save'));
    expect(screen.getByTestId('t-style-apply').textContent).toBe('Hero');
    fireEvent.click(screen.getByTestId('t-style-apply'));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ name: 'Hero' }));
    fireEvent.click(screen.getByTestId('t-style-rename'));
    fireEvent.change(screen.getByTestId('t-style-rename-input'), { target: { value: 'Big' } });
    fireEvent.click(screen.getByTestId('t-style-rename-save'));
    expect(screen.getByTestId('t-style-apply').textContent).toBe('Big');
    fireEvent.click(screen.getByTestId('t-style-delete'));
    expect(screen.queryByTestId('t-style-apply')).toBeNull();
  });
  it('does not apply to a locked layer', () => {
    render(<Harness initial={[{ id: 'a', name: 'A', kind: 'text', style: look }]} disabled />);
    expect((screen.getByTestId('t-style-apply') as HTMLButtonElement).disabled).toBe(true);
  });
  it('offers styles from this browser and adds them to the project', () => {
    rememberInBrowser({ id: 'b', name: 'From elsewhere', kind: 'text', style: look });
    render(<Harness />);
    fireEvent.click(screen.getByTestId('t-browser-add'));
    expect(screen.getByTestId('t-style-apply').textContent).toBe('From elsewhere');
    expect(screen.queryByTestId('t-browser-styles')).toBeNull();
  });
});
