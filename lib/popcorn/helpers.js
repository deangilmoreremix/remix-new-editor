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

export function draggableResizable(element, callback, { ratio, restrictBorders = false } = {}) {
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
    const rotation = element._container.style.transform.split('(').pop().split('deg)')[0];
    const isResize = !!(event && event.deltaRect);
    const deltaRectX = isResize ? event.deltaRect.left : Math.round(event.dx);
    const deltaRectY = isResize ? event.deltaRect.top : Math.round(event.dy);
    const { target } = event;
    const x = (parseFloat(target.getAttribute('data-x')) || Math.round(element.left / 100) * Math.round(element._container.parentNode.offsetWidth)) + deltaRectX;
    const y = (parseFloat(target.getAttribute('data-y')) || Math.round(element.top / 100) * Math.round(element._container.parentNode.offsetHeight)) + deltaRectY;

    const relativeTop = (Math.round(y)
      / Math.round(element._container.parentNode.offsetHeight)) * 100;

    const relativeLeft = (Math.round(x)
      / Math.round(element._container.parentNode.offsetWidth)) * 100;
    element.top = relativeTop;
    element.left = relativeLeft;
    element._container.style.top = `${relativeTop}%`;
    element._container.style.left = `${relativeLeft}%`;

    if (event.rect) {
      const relativeHeight = (
        Math.round(event.rect.height)
        / Math.round(element._container.parentNode.offsetHeight)) * 100;
      const relativeWidth = (Math.round(event.rect.width)
        / Math.round(element._container.parentNode.offsetWidth)
      ) * 100;
      element.width = relativeWidth;
      element.height = relativeHeight;
      if (isResize) {
        if (rotation % 90 === 0) {
          element._container.style.width = `${Math.round(relativeWidth)}%`;
          element._container.style.height = `${Math.round(relativeHeight)}%`;
        } else {
          element._container.style.width = `${Math.round(relativeWidth)}%`;
          element._container.style.height = `${Math.round(relativeHeight)}%`;
        }
      } else if (rotation % 90 === 0) {
        element._container.style.width = `${Math.round(relativeWidth)}%`;
        element._container.style.height = `${Math.round(relativeHeight)}%`;
      } else {
        element._container.style.width = `${Math.round(
          Math.round(relativeWidth) * Math.cos(rotation % 90))}%`;
        element._container.style.height = `${Math.round(
          Math.round(relativeHeight) * Math.sin(rotation % 90))}%`;
      }
    }
    target.setAttribute('data-x', Math.round(x));
    target.setAttribute('data-y', Math.round(y));
  };

  const defaultResizableModifiers = [
    // keep the edges inside the parent
    interact.modifiers.restrictEdges({
      outer: 'parent',
    }),

    // minimum size
    interact.modifiers.restrictSize({
      min: { width: 10, height: 10 },
    }),
  ];

  interact(element._container)
    .resizable({
      // resize from all edges and corners
      margin: 10,
      edges: { left: true, right: true, bottom: true, top: true },

      listeners: {
        move: dragMoveListener,
        end: () => {
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
        },
      },
      modifiers: ratio
        ? [interact.modifiers.aspectRatio({
          ratio,
          modifiers: defaultResizableModifiers,
        })]
        : defaultResizableModifiers,

      inertia: true,
    })
    .draggable({
      listeners: {
        move: dragMoveListener,
        end: () => {
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
        },
      },
      inertia: true,
      modifiers: [
        interact.modifiers.restrictRect({
          ...(restrictBorders ? { restriction: 'parent' } : {}),
          endOnly: true,
        }),
      ],
    });

  setResizableHandles();
}
