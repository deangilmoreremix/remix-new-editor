import { Canvas } from './Canvas.js';

describe('Canvas', () => {
  test('should create canvas element', () => {
    const canvas = new Canvas();
    const element = canvas.render();
    expect(element.classList.contains('stager-wrapper')).toBe(true);
  });

  test('should handle drag over', () => {
    const canvas = new Canvas();
    const element = canvas.render();
    const event = new Event('dragover');
    canvas.handleDragOver(event);
    expect(canvas.state.isOver).toBe(true);
  });
});