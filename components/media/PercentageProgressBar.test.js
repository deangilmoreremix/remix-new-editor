import { PercentageProgressBar } from './PercentageProgressBar.js';

describe('PercentageProgressBar', () => {
  test('renders progress bar', () => {
    const component = new PercentageProgressBar();
    const element = component.render();
    expect(element.classList.contains('progress')).toBe(true);
  });

  test('starts animation when no progress prop', () => {
    const component = new PercentageProgressBar();
    component.onMount();
    expect(component.state.progressState).toBe(0);
    // Simulate interval
  });

  test('sets progress when prop provided', () => {
    const component = new PercentageProgressBar({ progress: 50 });
    component.onMount();
    expect(component.state.progressState).toBe(50);
  });
});