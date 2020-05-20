import { RECORDER_TYPES } from '../constants/recorder';
import { RECORDER_MODAL } from '../constants/modals';

// import svgAudio from '../../public/static/svgImages/recorderAudio.svg';
import svgCamera from '../../public/static/svgImages/recorderCamera.svg';
import svgScreen from '../../public/static/svgImages/recorderScreen.svg';

export default ({ actions }) => [
  // TODO: Audio recorder
  // {
  //   id: RECORDER_TYPES.AUDIO,
  //   label: 'Audio',
  //   icon: svgAudio,
  //   action: () => { actions.openModal(RECORDER_MODAL, { type: RECORDER_TYPES.AUDIO }); },
  // },
  {
    id: RECORDER_TYPES.CAMERA,
    label: 'Camera',
    icon: svgCamera,
    action: () => { actions.openModal(RECORDER_MODAL, { type: RECORDER_TYPES.CAMERA }); },
  },
  {
    id: RECORDER_TYPES.SCREEN,
    label: 'Screen Capture',
    icon: svgScreen,
    action: () => { actions.openModal(RECORDER_MODAL, { type: RECORDER_TYPES.SCREEN }); },
  },
];
