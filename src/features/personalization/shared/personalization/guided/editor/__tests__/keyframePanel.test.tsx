// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { KeyframePanel } from '../KeyframePanel';
import { Timeline } from '../Timeline';
import { createLayer } from '../../../preview/presets';
import type { LayerKeyframe } from '../../../preview/keyframes';

afterEach(cleanup);

const layerWith = (keyframes?: LayerKeyframe[]) => ({ ...createLayer('logo'), id: 'logo-1', keyframes });
const k = (frame: number, patch: Partial<LayerKeyframe> = {}): LayerKeyframe => ({ frame, easing: 'ease-in-out', ...patch });

function panel(keyframes: LayerKeyframe[] | undefined, extra: Partial<Parameters<typeof KeyframePanel>[0]> = {}) {
  const onChange = vi.fn();
  const onSeek = vi.fn();
  render(<KeyframePanel layer={layerWith(keyframes)} playFrame={30} fps={30} durationInFrames={150} onChange={onChange} onSeek={onSeek} {...extra} />);
  return { onChange, onSeek };
}

describe('KeyframePanel', () => {
  it('explains how to start when there are no keyframes', () => {
    panel(undefined);
    expect(screen.getByText(/Move the playhead, then add a keyframe/)).toBeTruthy();
    expect(screen.queryByTestId('keyframe-clear')).toBeNull();
  });

  it('adds a keyframe at the playhead holding the values in effect (no jump)', () => {
    const { onChange } = panel([k(0, { scale: 1 }), k(60, { scale: 2 })]);
    fireEvent.click(screen.getByTestId('keyframe-add'));
    const list = onChange.mock.calls[0][0] as LayerKeyframe[];
    expect(list.map((x) => x.frame)).toEqual([0, 30, 60]);
    expect(list[1].scale).toBeGreaterThan(1);
    expect(list[1].scale).toBeLessThan(2);
  });

  it('does not add a second keyframe on the same frame', () => {
    panel([k(30, { dx: 0.1 })]);
    expect((screen.getByTestId('keyframe-add') as HTMLButtonElement).disabled).toBe(true);
  });

  it('edits one value of one keyframe, in friendly units', () => {
    const { onChange } = panel([k(30, { dx: 0.1 })]);
    fireEvent.change(screen.getByTestId('keyframe-dx'), { target: { value: '25' } });
    expect((onChange.mock.calls[0][0] as LayerKeyframe[])[0].dx).toBeCloseTo(0.25, 6);
    fireEvent.change(screen.getByTestId('keyframe-rotation'), { target: { value: '12' } });
    expect((onChange.mock.calls[1][0] as LayerKeyframe[])[0].rotation).toBe(12);
  });

  it('ignores an emptied field', () => {
    const { onChange } = panel([k(30, { dx: 0.1 })]);
    fireEvent.change(screen.getByTestId('keyframe-dx'), { target: { value: '' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('changes easing, deletes a keyframe, clears all, and seeks to one', () => {
    const { onChange, onSeek } = panel([k(10, { dx: 0 }), k(30, { dx: 0.1 })]);
    const row = screen.getAllByTestId('keyframe-row')[1];
    fireEvent.change(within(row).getByTestId('keyframe-easing'), { target: { value: 'hold' } });
    expect((onChange.mock.calls[0][0] as LayerKeyframe[]).find((x) => x.frame === 30)!.easing).toBe('hold');
    fireEvent.click(within(row).getByTestId('keyframe-delete'));
    expect((onChange.mock.calls[1][0] as LayerKeyframe[]).map((x) => x.frame)).toEqual([10]);
    fireEvent.click(screen.getByTestId('keyframe-clear'));
    expect(onChange.mock.calls[2][0]).toBeUndefined();
    fireEvent.click(within(row).getByTestId('keyframe-seek'));
    expect(onSeek).toHaveBeenCalledWith(30);
  });

  it('starts from a ready-made motion over the layer\'s time on screen', () => {
    const { onChange } = panel(undefined);
    fireEvent.change(screen.getByTestId('keyframe-preset'), { target: { value: 'drift' } });
    const list = onChange.mock.calls[0][0] as LayerKeyframe[];
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0].dx).toBeLessThan(0);
    expect(list.at(-1)!.dx).toBeGreaterThan(0);
  });
});

describe('Timeline keyframe diamonds', () => {
  const layers = [layerWith([k(15, { dx: 0.1 }), k(60, { dx: 0.2 })])];
  const base = { layers, labels: { 'logo-1': 'Logo' }, durationInFrames: 150, fps: 30, selectedId: 'logo-1', onSelect: vi.fn(), onChange: vi.fn() };

  it('shows one diamond per keyframe, labeled with its time', () => {
    render(<Timeline {...base} />);
    const diamonds = screen.getAllByTestId('timeline-keyframe');
    expect(diamonds).toHaveLength(2);
    expect(diamonds[0].getAttribute('aria-label')).toBe('Logo keyframe at 0.5 s');
  });

  it('selects the layer and seeks when a diamond is pressed', () => {
    const onSelect = vi.fn();
    const onSeek = vi.fn();
    render(<Timeline {...base} onSelect={onSelect} onSeek={onSeek} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-keyframe')[1]);
    expect(onSelect).toHaveBeenCalledWith('logo-1');
    expect(onSeek).toHaveBeenCalledWith(60);
  });

  it('moves a keyframe with the arrow keys (Shift = 10 frames)', () => {
    const onKeyframeMove = vi.fn();
    render(<Timeline {...base} onKeyframeMove={onKeyframeMove} />);
    const d = screen.getAllByTestId('timeline-keyframe')[0];
    fireEvent.keyDown(d, { key: 'ArrowRight' });
    expect(onKeyframeMove).toHaveBeenLastCalledWith('logo-1', 15, 16);
    fireEvent.keyDown(d, { key: 'ArrowLeft', shiftKey: true });
    expect(onKeyframeMove).toHaveBeenLastCalledWith('logo-1', 15, 5);
  });

  it('shows no diamonds for a layer without keyframes', () => {
    render(<Timeline {...base} layers={[layerWith(undefined)]} />);
    expect(screen.queryByTestId('timeline-keyframe')).toBeNull();
  });
});
