export const TRACKED_ACTIONS = {
  ADD_ELEMENT: 'addElement',
  REMOVE_ELEMENT: 'removeElement',
  UPDATE_ELEMENT: 'findAndUpdate',
  SET_ELEMENT_OPTIONS: 'setElementOptions',
  ADD_LAYER: 'addLayer',
  REMOVE_LAYER: 'removeLayer',
  EDIT_LAYER: 'editLayer',
  MOVE_ELEMENTS: 'moveElements',
  SET_BLEND_MODE: 'setBlendMode',
  UPDATE_ELEMENT_FROM_TIMELINE: 'updateElementFromTimeline',
  UPDATE_DURATION: 'changeDuration',
  ADD_RETARGET_FORM: 'createRetargetForm',
  ADD_DATA_FROM_TEMPLATE: 'addData',
};

export const TRACKED_EXCEPTIONS = {
  [TRACKED_ACTIONS.UPDATE_ELEMENT]: {
    argumentIndex: 1,
    checkObject: true,
    notObserverFields: ['caretOffset', 'urlCaretOffset'],
  },
};
export const NUMBER_OF_STEPS = 10;
