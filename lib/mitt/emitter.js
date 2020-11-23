import mitt from 'mitt';

const emitter = mitt();
const emitterActions = {
  SEQUENCES_READY: 'sequencesReady',
  SEQUENCES_LOADING: 'sequencesLoading',
  DELETE: 'Delete',
  SELECT: 'click',
  HOVER: 'hover',
  VIDEO_READY: 'videoReady',
  VIDEO_LOOPED: 'videoLooped',
};

export const deleteItem = (e, id, isButton = false) => {
  if (!isButton) {
    if (e.key === emitterActions.DELETE) {
      emitter.emit(emitterActions.DELETE, id);
    }
  } else {
    emitter.emit(emitterActions.DELETE, id);
  }
};

export const selectItem = (e, id) => {
  if (e.type === emitterActions.SELECT) {
    emitter.emit(emitterActions.SELECT, id);
  }
};

const addDeleteListener = (container, id) => {
  if (container) {
    container.addEventListener('keydown', e => deleteItem(e, id));
  }
};

const removeDeleteListener = (container, id) => {
  if (container) {
    const deleteButton = container.querySelector('.delete-handle');
    container.removeEventListener('keydown', e => deleteItem(e, id));

    if (deleteButton) {
      deleteButton.removeEventListener('click', e => deleteItem(e, id, true));
    }
  }
};

const addSelectListener = (container, id, options) => {
  container.addEventListener('click', e => selectItem(e, id), options);
};

const removeSelectListener = (container, id) => {
  container.removeEventListener('click', e => selectItem(e, id));
};

export {
  emitter,
  addDeleteListener,
  removeDeleteListener,
  addSelectListener,
  removeSelectListener,
  emitterActions,
};
