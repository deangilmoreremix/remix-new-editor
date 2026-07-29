// CapScreenRecorder - WebAssembly wrapper for Cap's screen recording
import { showError, showSuccess } from '../lib/errorBoundary.js';

class CapScreenRecorder {
  constructor() {
    this.isInitialized = false;
    this.isRecording = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.stream = null;
    this.capModule = null;
  }

  async initialize() {
    try {
      // Load Cap WebAssembly module (when available)
      // For now, we'll use enhanced MediaRecorder with Cap-like features
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.warn('Cap WebAssembly not available, falling back to MediaRecorder');
      this.isInitialized = false;
      return false;
    }
  }

  async getDisplayOptions() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Use native screen capture API for display selection
    if (navigator.mediaDevices?.getDisplayMedia) {
      try {
        // Request display media to get available screens
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { mediaSource: 'screen' },
          audio: false
        });

        // Get display information
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();

        // Stop the stream immediately as we just needed display info
        stream.getTracks().forEach(track => track.stop());

        return {
          displays: [{
            id: 'primary',
            name: 'Primary Display',
            width: settings.width || 1920,
            height: settings.height || 1080,
            isPrimary: true
          }],
          windows: [], // Would be populated with Cap's window enumeration
          regions: [] // Would be populated with selectable regions
        };
      } catch (error) {
        console.warn('Could not enumerate displays:', error);
      }
    }

    // Fallback display options
    return {
      displays: [{
        id: 'screen',
        name: 'Screen',
        width: 1920,
        height: 1080,
        isPrimary: true
      }],
      windows: [],
      regions: []
    };
  }

  async startRecording(options = {}) {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    const {
      displayId = 'screen',
      audioSource = 'none', // 'none', 'microphone', 'system', 'both'
      cursorMode = 'show', // 'show', 'hide', 'highlight'
      quality = 'high', // 'low', 'medium', 'high', 'ultra'
      frameRate = 30,
      onDataAvailable = null,
      onStop = null
    } = options;

    try {
      // Set up media constraints based on options
      const videoConstraints = {
        mediaSource: displayId === 'screen' ? 'screen' : 'window',
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: frameRate }
      };

      let audioConstraints = false;

      if (audioSource === 'microphone' || audioSource === 'both') {
        audioConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        };
      }

      // Request screen capture
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: videoConstraints,
        audio: audioConstraints
      });

      // Set up MediaRecorder with quality settings
      const mimeType = this.getMimeType(quality);
      const recorderOptions = {
        mimeType,
        videoBitsPerSecond: this.getVideoBitrate(quality),
        audioBitsPerSecond: audioSource !== 'none' ? 128000 : undefined
      };

      this.mediaRecorder = new MediaRecorder(this.stream, recorderOptions);
      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
          if (onDataAvailable) {
            onDataAvailable(event.data);
          }
        }
      };

      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        if (onStop) {
          onStop(this.recordedChunks);
        }
      };

      this.mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error:', error);
        this.stopRecording();
      };

      // Start recording
      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;

      return {
        stream: this.stream,
        recorder: this.mediaRecorder,
        settings: {
          displayId,
          audioSource,
          cursorMode,
          quality,
          frameRate
        }
      };

    } catch (error) {
      console.error('Failed to start Cap screen recording:', error);
      throw new Error(`Screen recording failed: ${error.message}`);
    }
  }

  async stopRecording() {
    if (!this.isRecording) {
      return null;
    }

    return new Promise((resolve) => {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.onstop = () => {
          this.isRecording = false;

          // Stop all tracks
          if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
          }

          // Create final blob
          const mimeType = this.mediaRecorder.mimeType || 'video/webm';
          const blob = new Blob(this.recordedChunks, { type: mimeType });

          resolve({
            blob,
            url: URL.createObjectURL(blob),
            duration: this.recordedChunks.length, // Rough estimate
            size: blob.size,
            mimeType
          });
        };

        this.mediaRecorder.stop();
      } else {
        resolve(null);
      }
    });
  }

  getMimeType(quality) {
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/mp4;codecs=h264',
      'video/mp4'
    ];

    // Try preferred codecs in order
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    return 'video/webm'; // Fallback
  }

  getVideoBitrate(quality) {
    const bitrates = {
      'low': 1000000,    // 1 Mbps
      'medium': 2500000, // 2.5 Mbps
      'high': 5000000,   // 5 Mbps
      'ultra': 10000000  // 10 Mbps
    };

    return bitrates[quality] || bitrates.high;
  }

  isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  getCapabilities() {
    return {
      screenRecording: this.isSupported(),
      systemAudio: false, // Not available in browsers
      multiDisplay: false, // Limited browser support
      windowCapture: true,
      cursorCapture: true,
      hardwareAcceleration: false, // Browser-dependent
      codecs: {
        webm: MediaRecorder.isTypeSupported('video/webm'),
        mp4: MediaRecorder.isTypeSupported('video/mp4'),
        vp9: MediaRecorder.isTypeSupported('video/webm;codecs=vp9'),
        h264: MediaRecorder.isTypeSupported('video/mp4;codecs=h264')
      }
    };
  }

  dispose() {
    if (this.isRecording) {
      this.stopRecording();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    this.mediaRecorder = null;
    this.stream = null;
    this.recordedChunks = [];
  }
}

// Singleton instance
let capRecorderInstance = null;

export function getCapRecorder() {
  if (!capRecorderInstance) {
    capRecorderInstance = new CapScreenRecorder();
  }
  return capRecorderInstance;
}

export default CapScreenRecorder;