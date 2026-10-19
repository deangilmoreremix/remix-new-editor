// Canvas — drag-and-drop staging surface for media/asset placement.
//
// The render() output carries the `stager-wrapper` class that app styles and drop
// handling key off. `state.isOver` tracks whether a drag is currently hovering the
// surface so callers/CSS can show a drop affordance.
export class Canvas {
  constructor() {
    this.state = { isOver: false };
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.className = 'stager-wrapper';
    wrapper.addEventListener('dragover', (event) => this.handleDragOver(event));
    wrapper.addEventListener('dragleave', () => this.handleDragLeave());
    return wrapper;
  }

  handleDragOver(event) {
    // A dragover must call preventDefault or the browser will not allow a drop.
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    this.state.isOver = true;
  }

  handleDragLeave() {
    this.state.isOver = false;
  }
}

export default Canvas;
