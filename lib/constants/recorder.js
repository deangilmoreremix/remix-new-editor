export const RECORDER_TYPES = {
  AUDIO: 'audio',
  CAMERA: 'video',
  SCREEN: 'screen',
};

export const RECORDER_VIDEOJS_CONFIG = {
  controls: true,
  width: 540,
  height: 304,
  fluid: false,
  controlBar: {
    volumePanel: true,
    fullscreenToggle: false,
  },
  plugins: {
    wavesurfer: {
      src: 'live',
      waveColor: '#36393b',
      progressColor: 'black',
      debug: false,
      cursorWidth: 1,
      msDisplayMax: 20,
      hideScrollbar: true,
    },
    record: {
      maxLength: 60,
      convertEngine: 'ts-ebml',
    },
  },
};
