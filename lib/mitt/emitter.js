import mitt from 'mitt';

const emitter = mitt();
const emitterActions = {
  DELETE: 'Delete',
};

const deleteItem = (e, id) => {
  if (e.key === emitterActions.DELETE) {
    emitter.emit(emitterActions.DELETE, id);
  }
};

const addDeleteListener = (container, id) => {
  container.addEventListener('keydown', e => deleteItem(e, id));
};

const removeDeleteListener = (container, id) => {
  container.removeEventListener('keydown', e => deleteItem(e, id));
};

export {
  emitter,
  addDeleteListener,
  removeDeleteListener,
  emitterActions,
};
