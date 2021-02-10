export const editorStyles = {
  timeline: {
    minHeight: 35,
    defaultHeight: 253,
    maxDifferenceHeightPx: 40,
  },
  canvas: {
    canvasDefaultDifferencePX: 82,
    canvasDifferencePX: 47,
  },
  toolbar: {
    differencePX: 18,
  },
  pageHeightWithoutHeader: '91vh',
  maxBlockHeight: '82vh',
  calculateHeight(value) {
    return `calc(${this.maxBlockHeight} - ${value}px)`;
  },
};
