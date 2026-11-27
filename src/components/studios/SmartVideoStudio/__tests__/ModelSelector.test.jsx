// @vitest-environment jsdom
// The Model picker opens on document.body with position: fixed, inside the window. Drawn inside the
// scrolling settings column it was clipped off-screen and nothing in it could be clicked.
import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

const model = (id, name, extra = {}) => ({
  id, name, display_name: name, family: 'Google', description: `${name} model`, cost: 0.04, enabled: true,
  capabilities: {}, ...extra,
});
const MODELS = [model('nano-banana', 'Nano Banana'), model('seedream', 'Seedream', { family: 'ByteDance' }), model('flux', 'Flux Schnell', { family: 'BFL' })];

vi.mock('../svStudio/modelRegistry', () => ({
  syncCatalog: vi.fn(async () => MODELS),
  getModelsForTab: vi.fn(() => MODELS),
  searchModels: vi.fn(() => MODELS),
}));

const { default: ModelSelector, placePicker } = await import('../ModelSelector.tsx');

afterEach(() => cleanup());

async function open(onSelect = vi.fn()) {
  const column = document.createElement('div');
  column.style.overflowY = 'auto';
  column.setAttribute('data-column', '');
  document.body.appendChild(column);
  const utils = render(<ModelSelector tabId="image" selectedModelId="nano-banana" onSelect={onSelect} />, { container: column });
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: /Nano Banana/ }));
  await act(async () => {});
  return { ...utils, column, onSelect };
}

describe('Model picker', () => {
  test('opens on document.body (not inside the scrolling column) with position fixed', async () => {
    const { column } = await open();
    const list = document.querySelector('[data-model-picker]');
    expect(list).not.toBeNull();
    expect(column.contains(list)).toBe(false);
    expect(list.parentElement).toBe(document.body);
    expect(list.style.top).not.toBe('');
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  test('choosing a model selects it and closes the list', async () => {
    const { onSelect } = await open();
    fireEvent.click(screen.getByRole('option', { name: /Seedream/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'seedream' }));
    expect(document.querySelector('[data-model-picker]')).toBeNull();
  });

  test('Escape closes it and puts focus back on the Model box', async () => {
    await open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('[data-model-picker]')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Nano Banana/ }));
  });

  test('a click outside closes it; a click inside does not', async () => {
    await open();
    fireEvent.mouseDown(screen.getByPlaceholderText('Search models...'));
    expect(document.querySelector('[data-model-picker]')).not.toBeNull();
    fireEvent.mouseDown(document.body);
    expect(document.querySelector('[data-model-picker]')).toBeNull();
  });

  test('search still filters the list', async () => {
    await open();
    fireEvent.change(screen.getByPlaceholderText('Search models...'), { target: { value: 'bytedance' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([expect.stringContaining('Seedream')]);
  });
});

describe('placePicker', () => {
  const vp = { width: 1440, height: 900 };
  test('opens below the box when there is room', () => {
    const p = placePicker({ top: 130, bottom: 190, left: 164, width: 327 }, vp);
    expect(p.above).toBe(false);
    expect(p.top).toBe(196);
    expect(p.top + p.maxHeight).toBeLessThanOrEqual(vp.height);
    expect(p.width).toBe(327);
  });

  test('opens above near the bottom of the window, and stays inside it', () => {
    const p = placePicker({ top: 800, bottom: 860, left: 164, width: 327 }, vp);
    expect(p.above).toBe(true);
    expect(p.top).toBeGreaterThanOrEqual(8);
    expect(p.top + p.maxHeight).toBeLessThanOrEqual(800);
  });

  test('a narrow box still gets a readable list, kept inside a small window', () => {
    const p = placePicker({ top: 100, bottom: 140, left: 300, width: 200 }, { width: 360, height: 700 });
    expect(p.width).toBe(320);
    expect(p.left + p.width).toBeLessThanOrEqual(352);
    expect(p.left).toBeGreaterThanOrEqual(8);
  });
});
