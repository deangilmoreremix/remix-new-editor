import { ACTION_TYPES } from '../../constants/reducers/voiceReducer';

export const reducer = (state, action) => {
  if (!action) {
    return state;
  }
  switch (action.type) {
    case ACTION_TYPES.INIT: {
      // waiting language, allowed pro, voices
      const { language, voices = [], allowedPro } = action.value;
      const voicesArray = voices[language] || [];
      const selectedVoices = allowedPro ? voicesArray : voicesArray
        .filter(item => item.standard).map(item => ({ ...item, pro: null }));
      const voice = selectedVoices[0];
      const isPro = allowedPro && !!voice.pro;

      return { init: true, language, selectedVoices, voice, isPro, voices, allowedPro };
    }
    case ACTION_TYPES.SET_LANGUAGE: {
      const { voices, allowedPro } = state;
      let { isPro } = state;
      const { value } = action;
      const voicesArray = voices[value] || [];
      const selectedVoices = allowedPro ? voicesArray : voicesArray
        .filter(item => item.standard).map(item => ({ ...item, pro: null }));
      const voice = selectedVoices[0];
      if (!voice.standard) {
        isPro = true;
      } else if (!voice.pro) {
        isPro = false;
      }
      return {
        ...state,
        language: value,
        selectedVoices,
        voice,
        isPro,
        preview: isPro ? voice.proPreview : voice.preview,
      };
    }
    case ACTION_TYPES.SET_VOICE: {
      const { selectedVoices } = state;
      let { isPro } = state;
      const { value } = action;
      const voice = selectedVoices.find(voiceItem => voiceItem.value === value) || {};
      if (!voice.standard) {
        isPro = true;
      } else if (!voice.pro) {
        isPro = false;
      }
      return { ...state, voice, isPro, preview: isPro ? voice.proPreview : voice.preview };
    }
    case ACTION_TYPES.SET_IS_PRO: {
      const { voice } = state;
      let { isPro } = state;
      isPro = !isPro;
      const preview = isPro ? voice.proPreview : voice.preview;
      if ((isPro && !voice.pro) || (!isPro && !voice.standard)) {
        return { ...state, preview };
      }
      return { ...state, isPro, preview };
    }
    default:
      return state;
  }
};

export const initialState = {
  init: false,
  language: null,
  selectedVoices: [],
  voices: [],
  voice: {},
  isPro: false,
  allowedPro: false,
  preview: null,
};
