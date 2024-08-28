import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { RECORDER_TYPES } from '../constants/recorder';
import { RECORDER_MODAL } from '../constants/modals';

import svgAudio from '../../public/static/svgImages/recorderAudio.svg';
import svgCamera from '../../public/static/svgImages/recorderCamera.svg';
import svgScreen from '../../public/static/svgImages/recorderScreen.svg';

const RecorderModal = dynamic(() => import('../../components/modals/RecorderModal'), { ssr: false });

const loadScreenAppScript = () => {
  const script = document.createElement('script');
  script.src = 'https://screenapp.io/app/plugin.js';
  script.charset = 'UTF-8';
  script.type = 'text/javascript';
  script.onload = () => {
    const screenApp = new window.ScreenApp('667de452336ca9be3b3beb51', ({ id, url }) => {
      console.log('Recording completed', { id, url });
    });
    screenApp.mount('#screenapp-plugin');
  };
  document.body.appendChild(script);
};

export default ({ actions, useAudio }) => [
  {
    id: RECORDER_TYPES.AUDIO,
    label: 'Audio',
    icon: svgAudio,
    action: () => {
      actions.openModal(RECORDER_MODAL, { type: RECORDER_TYPES.AUDIO, useAudio });
    },
  },
  {
    id: RECORDER_TYPES.CAMERA,
    label: 'Camera',
    icon: svgCamera,
    action: () => {
      actions.openModal(RECORDER_MODAL, { type: RECORDER_TYPES.CAMERA, useAudio });
    },
  },
  {
    id: RECORDER_TYPES.SCREEN,
    label: 'Screen',
    icon: svgScreen,
    action: () => {
      loadScreenAppScript();
      // actions.openModal(RECORDER_MODAL, { type: RECORDER_TYPES.SCREEN, useAudio });
    },
  },
];
