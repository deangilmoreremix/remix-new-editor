import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class VideoRecorder extends Component {
  constructor(options = {}) {
    super(options);
    this.onRecordingComplete = options.onRecordingComplete || (() => {});
    this.onRecordingError = options.onRecordingError || (() => {});
    this.maxDuration = options.maxDuration || 60;
    this.allowScreen = options.allowScreen !== false;
    this.allowCamera = options.allowCamera !== false;

    this.isRecording = false;
    this.isPaused = false;
    this.recordingTime = 0;
    this.recordedBlob = null;
    this.previewUrl = null;
    this.recordingMode = 'camera'; // 'camera', 'screen', 'both'
    this.hasCameraPermission = false;
    this.hasScreenPermission = false;
    this.countdown = 0;

    this.videoRef = null;
    this.mediaRecorderRef = null;
    this.streamRef = null;
    this.chunksRef = [];
    this.timerRef = null;
    this.countdownRef = null;
  }

  render() {
    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const html = `
      <div class="video-recorder">
        <div class="recorder-header">
          <h3>Video Recorder</h3>
          <div class="recording-status ${this.isRecording ? 'recording' : ''}">
            ${this.isRecording ? '🔴 REC' : '⏸️ STOPPED'}
          </div>
        </div>

        <div class="recorder-body">
          <video
            class="recorder-preview"
            autoplay
            muted
            playsinline
          ></video>

          ${this.countdown > 0 ? `
            <div class="countdown-overlay">
              <div class="countdown-number">${this.countdown}</div>
            </div>
          ` : ''}

          <div class="recorder-controls">
            <div class="time-display">
              ${formatTime(this.recordingTime)} / ${formatTime(this.maxDuration)}
            </div>

            <div class="mode-buttons">
              ${this.allowCamera ? `
                <button class="mode-btn ${this.recordingMode === 'camera' ? 'active' : ''}"
                        onclick="this.handleModeChange('camera')">
                  📹 Camera
                </button>
              ` : ''}

              ${this.allowScreen ? `
                <button class="mode-btn ${this.recordingMode === 'screen' ? 'active' : ''}"
                        onclick="this.handleModeChange('screen')">
                  🖥️ Screen
                </button>
              ` : ''}
            </div>

            <div class="action-buttons">
              ${!this.isRecording ? `
                <button class="record-btn start" onclick="this.startRecording()">
                  ⏺️ Start Recording
                </button>
              ` : `
                <button class="record-btn pause" onclick="this.togglePause()">
                  ${this.isPaused ? '▶️ Resume' : '⏸️ Pause'}
                </button>
                <button class="record-btn stop" onclick="this.stopRecording()">
                  ⏹️ Stop Recording
                </button>
              `}
            </div>
          </div>

          ${this.recordedBlob ? `
            <div class="preview-section">
              <h4>Recording Preview</h4>
              <video class="preview-video" controls></video>
              <div class="preview-actions">
                <button onclick="this.saveRecording()">💾 Save Recording</button>
                <button onclick="this.discardRecording()">🗑️ Discard</button>
              </div>
            </div>
          ` : ''}
        </div>

        <div class="permissions-status">
          ${this.hasCameraPermission ? '📹 Camera: ✅' : '📹 Camera: ❌'}
          ${this.hasScreenPermission ? '🖥️ Screen: ✅' : '🖥️ Screen: ❌'}
        </div>
      </div>
    `;

    return createElementFromHTML(html);
  }

  handleModeChange = (mode) => {
    this.recordingMode = mode;
    this.update();
  };

  async requestCameraPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      if (this.videoRef) {
        this.videoRef.srcObject = stream;
      }

      this.streamRef = stream;
      this.hasCameraPermission = true;
      this.update();
    } catch (error) {
      console.error('Camera permission denied:', error);
      this.hasCameraPermission = false;
      this.onRecordingError(error);
      this.update();
    }
  }

  async requestScreenPermission() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: true
      });

      // Handle when user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        if (this.isRecording) {
          this.stopRecording();
        }
      };

      this.hasScreenPermission = true;
      return stream;
    } catch (error) {
      console.error('Screen permission denied:', error);
      this.hasScreenPermission = false;
      this.onRecordingError(error);
      return null;
    }
  }

  async startRecording() {
    try {
      let stream;

      if (this.recordingMode === 'camera') {
        if (!this.streamRef) {
          await this.requestCameraPermission();
        }
        stream = this.streamRef;
      } else if (this.recordingMode === 'screen') {
        stream = await this.requestScreenPermission();
      } else if (this.recordingMode === 'both') {
        const cameraStream = this.streamRef || await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const screenStream = await this.requestScreenPermission();
        if (screenStream) {
          // Combine streams
          const combinedStream = new MediaStream([
            ...screenStream.getVideoTracks(),
            ...cameraStream.getAudioTracks()
          ]);
          stream = combinedStream;
        }
      }

      if (!stream) {
        throw new Error('No media stream available');
      }

      this.mediaRecorderRef = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });

      this.chunksRef = [];
      this.mediaRecorderRef.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunksRef.push(event.data);
        }
      };

      this.mediaRecorderRef.onstop = () => {
        const blob = new Blob(this.chunksRef, { type: 'video/webm' });
        this.recordedBlob = blob;
        this.previewUrl = URL.createObjectURL(blob);

        // Set preview video
        const previewVideo = this.element.querySelector('.preview-video');
        if (previewVideo) {
          previewVideo.src = this.previewUrl;
        }

        this.isRecording = false;
        this.recordingTime = 0;
        if (this.timerRef) {
          clearInterval(this.timerRef);
        }

        this.update();
        this.onRecordingComplete(blob);
      };

      // Start countdown
      this.startCountdown();

    } catch (error) {
      console.error('Failed to start recording:', error);
      this.onRecordingError(error);
    }
  }

  startCountdown() {
    this.countdown = 3;
    this.update();

    this.countdownRef = setInterval(() => {
      this.countdown--;
      this.update();

      if (this.countdown <= 0) {
        clearInterval(this.countdownRef);
        this.actualStartRecording();
      }
    }, 1000);
  }

  actualStartRecording() {
    this.mediaRecorderRef.start();
    this.isRecording = true;
    this.countdown = 0;

    // Start timer
    this.timerRef = setInterval(() => {
      this.recordingTime++;
      this.update();

      if (this.recordingTime >= this.maxDuration) {
        this.stopRecording();
      }
    }, 1000);

    this.update();
  }

  togglePause() {
    if (!this.mediaRecorderRef) return;

    if (this.isPaused) {
      this.mediaRecorderRef.resume();
      this.isPaused = false;
    } else {
      this.mediaRecorderRef.pause();
      this.isPaused = true;
    }
    this.update();
  }

  stopRecording() {
    if (this.mediaRecorderRef && this.isRecording) {
      this.mediaRecorderRef.stop();
    }

    if (this.timerRef) {
      clearInterval(this.timerRef);
    }

    this.isRecording = false;
    this.update();
  }

  saveRecording() {
    if (this.recordedBlob) {
      const url = URL.createObjectURL(this.recordedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${new Date().toISOString().slice(0, 19)}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  discardRecording() {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
    this.recordedBlob = null;
    this.update();
  }

  stopMediaTracks() {
    if (this.streamRef) {
      this.streamRef.getTracks().forEach(track => track.stop());
      this.streamRef = null;
    }
  }

  mount(element) {
    super.mount(element);
    this.videoRef = this.element.querySelector('.recorder-preview');

    // Request initial permissions
    this.requestCameraPermission();

    // Bind methods to element for onclick handlers
    this.element.handleModeChange = this.handleModeChange.bind(this);
    this.element.startRecording = this.startRecording.bind(this);
    this.element.togglePause = this.togglePause.bind(this);
    this.element.stopRecording = this.stopRecording.bind(this);
    this.element.saveRecording = this.saveRecording.bind(this);
    this.element.discardRecording = this.discardRecording.bind(this);
  }

  unmount() {
    this.stopRecording();
    this.stopMediaTracks();

    if (this.timerRef) clearInterval(this.timerRef);
    if (this.countdownRef) clearInterval(this.countdownRef);
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);

    super.unmount();
  }
}