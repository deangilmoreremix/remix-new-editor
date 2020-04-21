import mitt from 'mitt';

const emitter = mitt();

const deleteItem = (e, id) => {
  if (e.key === 'Delete') {
    emitter.emit('delete', id);
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
};
