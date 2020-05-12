import mitt from 'mitt';

const emitter = mitt();
const emitterActions = {
  DELETE: 'Delete',
  HOVER: 'hover',
};

const deleteItem = (e, id) => {
  if (e.key === emitterActions.DELETE) {
    emitter.emit(emitterActions.DELETE, id);
  }
};

const addDeleteListener = (container, id) => {
  if (container) {
    container.addEventListener('keydown', e => deleteItem(e, id));
  }
};

const removeDeleteListener = (container, id) => {
  if (container) {
    container.removeEventListener('keydown', e => deleteItem(e, id));
  }
};

export {
  emitter,
  addDeleteListener,
  removeDeleteListener,
  emitterActions,
};
