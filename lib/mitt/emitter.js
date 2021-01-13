import mitt from 'mitt';

const emitter = mitt();
const emitterActions = {
  SEQUENCES_READY: 'sequencesReady',
  SEQUENCES_LOADING: 'sequencesLoading',
  DELETE: 'Delete',
  ARRAY_DELETE: 'arrayDelete',
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

export const selectItem = (e, id, isSuperAdmin) => {
  if (e.type === emitterActions.SELECT) {
    let data = id;
    if (e.ctrlKey && isSuperAdmin) {
      data = { id, isCtrlKey: e.ctrlKey };
    }
    emitter.emit(emitterActions.SELECT, data);
  }
};

const addDeleteListener = (container, id) => {
  if (container) {
    container.addEventListener('keydown', e => deleteItem(e, id));
  }
};

const arrayDeleteListener = () => {
  document.addEventListener('keydown', e => {
    if (e.key === emitterActions.DELETE) {
      emitter.emit(emitterActions.ARRAY_DELETE);
    }
  });
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

export {
  emitter,
  addDeleteListener,
  removeDeleteListener,
  arrayDeleteListener,
  emitterActions,
};
