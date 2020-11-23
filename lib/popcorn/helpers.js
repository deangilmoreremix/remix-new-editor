/* eslint-disable no-underscore-dangle */
import interact from 'interactjs';

import { OFF, ON } from '../constants/popcorn';
import { deleteItem } from '../mitt/emitter';
import CloseIcon from '../../public/static/images/media/delete-layer.svg';

export const removeHandleElements = (container) => {
  const deleteButton = container?.querySelector('.delete-handle');
  const resizeElements = container?.querySelectorAll('.resize-handle');

  if (resizeElements && resizeElements.length >= 1) {
    deleteButton.remove();
    resizeElements.forEach(node => node.remove());
  }
};

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

export const createDraggableHandle = (options, container, cb) => {
  const draggableHandle = document.createElement('div');
  draggableHandle.classList.add('ui-draggable-handle');
  draggableHandle.addEventListener('dblclick', () => onDblClick(options, container, cb));
  draggableHandle.setAttribute('tabIndex', -1);

  const tooltipElement = document.createElement('div');
  tooltipElement.innerHTML = 'Double click to edit';
  tooltipElement.classList.add('butter-tooltip');

  draggableHandle.appendChild(tooltipElement);

  return draggableHandle;
};

export const onDblClick = (options, container, cb) => {
  const draggableHandle = container.querySelector('.ui-draggable-handle');
  if (draggableHandle) {
    options.stopMove = true;
    options.stopResize = true;
    draggableResizable({ ...options, container }, null, { ratio: 'preserve' });
    draggableHandle.removeEventListener('dblclick', onDblClick);
    draggableHandle.style.width = 0;
    draggableHandle.style.height = 0;
  }
  if (cb && typeof cb === 'function') {
    cb();
  }
};

export const removeDbClick = (options, container, cb) => {
  const draggableHandle = container.querySelector('.ui-draggable-handle');
  if (draggableHandle) {
    draggableResizable({ ...options, container }, null, { ratio: 'preserve' });
    draggableHandle.removeEventListener('dblclick', onDblClick);
    draggableHandle.style.width = '100%';
    draggableHandle.style.height = '100%';
  }
  if (cb && typeof cb === 'function') {
    cb();
  }
};

const defaultEdges = { left: true, right: true, bottom: true, top: true };

export function draggableResizable(
  element,
  callback,
  { restrictBorders = false, edges = {} } = {}) {
  if (interact.isSet(element)) {
    interact(element).unset();
  }

  function setResizableHandles() {
    const deleteButton = document.createElement('button');
    const existingDeleteButton = element._container.querySelector('.delete-handle');

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

    deleteButton.classList.add('delete-handle');
    deleteButton.innerHTML = CloseIcon;

    deleteButton.addEventListener('click', addEvent => {
      deleteItem(addEvent, element.id, true);
      deleteButton.removeEventListener('click', deleteEvent => deleteItem(deleteEvent, element.id, true));
    });

    element._container.querySelectorAll('.resize-handle').forEach((child) => {
      child.parentNode.removeChild(child);
    });
    if (!existingDeleteButton) {
      element._container.appendChild(deleteButton);
    }
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
    const isResize = !!(event && event.deltaRect);
    const x = (element.left / 100) * element._container.parentNode.offsetWidth
      + (isResize ? event.deltaRect.left : event.dx);
    const y = (element.top / 100) * element._container.parentNode.offsetHeight
      + (isResize ? event.deltaRect.top : event.dy);

    const relativeTop = (y / element._container.parentNode.offsetHeight) * 100;
    const relativeLeft = (x / element._container.parentNode.offsetWidth) * 100;
    const relativeHeight = ((isResize ? (element._container.clientHeight + event.deltaRect.height)
      : element._container.clientHeight) / element._container.parentNode.offsetHeight || 1) * 100;
    const relativeWidth = ((isResize ? (element._container.clientWidth + event.deltaRect.width)
      : element._container.clientWidth) / element._container.parentNode.offsetWidth || 1) * 100;

    if (relativeTop > 0 - Math.min(relativeHeight, relativeWidth) && relativeTop < 100) {
      element.top = relativeTop;
      element._container.style.top = `${relativeTop}%`;
    }
    if (relativeLeft > 0 - Math.min(relativeHeight, relativeWidth) / 2
      && relativeLeft < 100 - Math.min(relativeHeight, relativeWidth) / 2) {
      element.left = relativeLeft;
      element._container.style.left = `${relativeLeft}%`;
    }

    if (isResize) {
      element.width = relativeWidth;
      element.height = relativeHeight;
      element._container.style.width = `${relativeWidth}%`;
      element._container.style.height = `${relativeHeight}%`;
    }

    target.setAttribute('data-x', x);
    target.setAttribute('data-y', y);
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
      edges: { ...defaultEdges, ...edges },

      listeners: {
        move: !element.stopResize ? dragMoveListener : null,
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
      // ToDo edit in future
      // modifiers: ratio
      //   ? [interact.modifiers.aspectRatio({
      //     ratio,
      //     modifiers: defaultResizableModifiers,
      //   })]
      //   : defaultResizableModifiers,
      modifiers: defaultResizableModifiers,

      inertia: true,
    })
    .draggable({
      listeners: {
        move: !element.stopMove ? dragMoveListener : null,
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
