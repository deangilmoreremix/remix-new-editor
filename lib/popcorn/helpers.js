/* eslint-disable no-underscore-dangle */
import interact from 'interactjs';

import { OFF, ON } from '../constants/popcorn';

export const addClass = (container, className) => {
  if (!container.classList.contains(className)) {
    container.classList.add(className);
  }
};

export const removeClass = (container, className) => {
  if (container.classList.contains(className)) {
    container.classList.remove(className);
  }
};

export const on = (container) => {
  container.classList.add(ON);
  container.classList.remove(OFF);
};

export const off = (container) => {
  container.classList.remove(ON);
  container.classList.add(OFF);
};

export const isValidJsonUrl = (url) => {
  const regex = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w.-]+)+[\w\-._~:/?#[\]@!$&'()*+,;=.]+(\.json)$/gmi;

  return regex.test(url);
};

export function draggableResizable(element, callback) {
  function setResizableHandles() {
    const positions = [
      { top: '-4px', left: '-4px' },
      { top: '-4px', left: '50%', transform: 'translateX(-50%)' },
      { top: '-4px', right: '-4px' },
      { top: '50%', left: '-4px', transform: 'translateY(-50%)' },
      { top: '50%', right: '-4px', transform: 'translateY(-50%)' },
      { bottom: '-4px', left: '-4px' },
      { bottom: '-4px', left: '50%', transform: 'translateX(-50%)' },
      { bottom: '-4px', right: '-4px' },
    ];
    element._container.querySelectorAll('.resize-handle').forEach((child) => {
      child.parentNode.removeChild(child);
    });
    positions.forEach((position) => {
      const handle = document.createElement('div');
      handle.classList.add('resize-handle');
      Object.keys(position).forEach((positionKey) => {
        handle.style[positionKey] = position[positionKey];
      });
      element._container.appendChild(handle);
    });
  }

  const dragMoveListener = (event) => {
    const { target } = event;
    const x = (parseFloat(target.getAttribute('data-x')) || (element.left / 100) * element._container.parentNode.offsetWidth) + (event.deltaRect ? event.deltaRect.left : event.dx);
    const y = (parseFloat(target.getAttribute('data-y')) || (element.top / 100) * element._container.parentNode.offsetHeight) + (event.deltaRect ? event.deltaRect.top : event.dy);

    const relativeTop = (y / element._container.parentNode.offsetHeight) * 100;
    const relativeLeft = (x / element._container.parentNode.offsetWidth) * 100;

    element.top = relativeTop;
    element.left = relativeLeft;
    element._container.style.top = `${relativeTop}%`;
    element._container.style.left = `${relativeLeft}%`;

    if (event.rect) {
      const relativeHeight = (
        event.rect.height / element._container.parentNode.offsetHeight
      ) * 100;
      const relativeWidth = (
        event.rect.width / element._container.parentNode.offsetWidth
      ) * 100;
      element.width = relativeWidth;
      element.height = relativeHeight;
      element._container.style.width = `${relativeWidth}%`;
      element._container.style.height = `${relativeHeight}%`;
    }

    target.setAttribute('data-x', x);
    target.setAttribute('data-y', y);
    if (['dragend', 'resizeend'].includes(event.type)) {
      const { type, top, left, width, height } = element;
      element._context.emit('elementUpdated', {
        type,
        element,
        options: {
          top,
          left,
          width,
          height,
        },
      });
      if (typeof callback === 'function') {
        callback(element);
      }
    }
  };

  interact(element._container)
    .resizable({
      // resize from all edges and corners
      edges: { left: true, right: true, bottom: true, top: true },

      listeners: {
        move: dragMoveListener,
      },
      modifiers: [
        // keep the edges inside the parent
        interact.modifiers.restrictEdges({
          outer: 'parent',
        }),

        // minimum size
        interact.modifiers.restrictSize({
          min: { width: 10, height: 10 },
        }),
      ],

      inertia: true,
    })
    .draggable({
      listeners: { move: dragMoveListener },
      inertia: true,
      modifiers: [
        interact.modifiers.restrictRect({
          restriction: 'parent',
          endOnly: true,
        }),
      ],
    });

  setResizableHandles();
}
