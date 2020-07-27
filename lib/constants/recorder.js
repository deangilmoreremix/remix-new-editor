export const RECORDER_TYPES = {
  AUDIO: 'audio',
  CAMERA: 'video',
  SCREEN: 'screen',
};

export const AUDIO_RECORD_OPTIONS = ({ WaveSurfer }) => ({
  record: {
    audio: true,
    video: false,
    maxLength: 5 * 60,
    debug: false,
    displayMilliseconds: true,
    audioEngine: 'lamejs',
    audioWorkerURL: '/static/js/lamejs/worker-example/worker-realtime.js',
    audioSampleRate: 44100,
    audioBitRate: 128,
  },
  wavesurfer: {
    backend: 'WebAudio',
    src: 'live',
    waveColor: '#36393b',
    progressColor: 'black',
    debug: false,
    cursorWidth: 1,
    msDisplayMax: 20,
    hideScrollbar: true,
    plugins: [
      // enable microphone plugin
      WaveSurfer && WaveSurfer.microphone && WaveSurfer.microphone.create({
        bufferSize: 4096,
        numberOfInputChannels: 1,
        numberOfOutputChannels: 1,
        constraints: {
          video: false,
          audio: true,
        },
      }),
    ],
  },
});

export const VIDEO_RECORD_OPTIONS = ({ useAudio, type }) => ({
  record: {
    audio: useAudio,
    [type]: true,
    maxLength: 5 * 60,
    convertEngine: 'ts-ebml',
  },
});

export const RECORDER_VIDEOJS_CONFIG = ({ type, useAudio, WaveSurfer }) => ({
  controls: true,
  width: 540,
  height: 304,
  fluid: false,
  controlBar: {
    volumePanel: useAudio,
    fullscreenToggle: false,
  },
  plugins: {
    ...(type === RECORDER_TYPES.AUDIO
      ? AUDIO_RECORD_OPTIONS({ WaveSurfer }) : VIDEO_RECORD_OPTIONS({ useAudio, type })),
  },
});
