/**
 * Edit Page Features — Ported from CineGen for Timeline Studio
 *
 * Features:
 * 4.1 Dual viewer (source + timeline)
 * 4.2 Source viewer frame scrub
 * 4.3 Audio sync (auto-align)
 * 4.4 Batch sync
 * 4.5 Proxy playback toggle
 * 4.6 Multiple timeline tabs
 * 4.7 Music generation presets
 * 4.8 Instrumental toggle
 * 4.9 Duration snapping
 * 4.10 Horizontal/vertical flip
 * 4.11 Speed adjustment (0.1x–2x)
 */

export class EditPageFeatures {
  constructor(state, callbacks = {}) {
    this.state = state;
    this.callbacks = callbacks;
    this.proxyEnabled = false;
    this.activeViewer = 'timeline'; // source | timeline
    this.timelineTabs = [{ id: 'main', name: 'Main Edit', active: true }];
    this.activeTabId = 'main';
    this.musicGen = {
      genre: '',
      mood: '',
      style: '',
      tempo: 120,
      instrumental: true,
      duration: 30
    };
  }

  // === 4.1 Dual Viewer ===
  setActiveViewer(viewer) {
    if (['source', 'timeline'].includes(viewer)) {
      this.activeViewer = viewer;
    }
  }

  isDualViewer() {
    return this.timelineTabs.length > 0;
  }

  // === 4.2 Source Viewer Frame Scrub ===
  seekToFrame(time) {
    if (this.callbacks.seekTo) {
      this.callbacks.seekTo(time);
    }
  }

  stepFrame(direction) {
    const fps = this.state.fps || 30;
    const frameTime = 1 / fps;
    const current = (this.state.playheadPercent / 100) * (this.state.timelineSeconds || 60);
    const newTime = current + (direction * frameTime);
    this.seekToFrame(Math.max(0, newTime));
  }

  // === 4.3 Audio Sync (waveform-based) ===
  async syncAudioToVideo(audioClipId, videoClipId) {
    const audioTrack = this.state.tracks?.find(t => t.type === 'audio');
    const videoTrack = this.state.tracks?.find(t => t.type === 'video');

    if (!audioTrack || !videoTrack) {
      return { success: false, error: 'Audio or video track not found' };
    }

    const audioClip = audioTrack.clips.find(c => c.id === audioClipId);
    const videoClip = videoTrack.clips.find(c => c.id === videoClipId);

    if (!audioClip || !videoClip) {
      return { success: false, error: 'Clip not found' };
    }

    // If audio buffer available, perform waveform analysis
    if (audioClip.audioBuffer && videoClip.audioBuffer) {
      const offset = this._calculateWaveformOffset(audioClip.audioBuffer, videoClip.audioBuffer);
      audioClip.left = videoClip.left + (offset / (this.state.timelineSeconds || 60)) * 100;
      audioClip.syncOffset = offset;
      return { success: true, offset, method: 'waveform' };
    }

    // Fallback: align starts
    audioClip.left = videoClip.left;
    return { success: true, offset: 0, method: 'align-start' };
  }

  _calculateWaveformOffset(audioBuffer, referenceBuffer) {
    const audioData = audioBuffer.getChannelData(0);
    const refData = referenceBuffer.getChannelData(0);

    // Use cross-correlation to find best alignment
    const maxLag = Math.min(audioData.length, refData.length, 44100); // Max 1 second lag
    let bestOffset = 0;
    let bestCorrelation = -Infinity;

    // Sample at intervals for performance
    const step = Math.floor(maxLag / 100);

    for (let lag = -maxLag / 2; lag < maxLag / 2; lag += step) {
      let correlation = 0;
      const sampleSize = Math.min(44100, audioData.length, refData.length);

      for (let i = 0; i < sampleSize; i++) {
        const audioIdx = Math.floor(i + lag);
        if (audioIdx >= 0 && audioIdx < audioData.length) {
          correlation += audioData[audioIdx] * refData[i];
        }
      }

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = lag;
      }
    }

    // Convert sample offset to seconds
    return bestOffset / audioBuffer.sampleRate;
  }

  // === 4.4 Batch Sync ===
  batchSync(audioTrackId, videoTrackId) {
    const audioTrack = this.state.tracks?.find(t => t.id === audioTrackId);
    const videoTrack = this.state.tracks?.find(t => t.id === videoTrackId);

    if (!audioTrack || !videoTrack) return { synced: 0 };

    let synced = 0;
    audioTrack.clips.forEach(audioClip => {
      const videoClip = videoTrack.clips.find(v =>
        Math.abs(v.left - audioClip.left) < 5
      );
      if (videoClip) {
        audioClip.left = videoClip.left;
        audioClip.width = videoClip.width;
        synced++;
      }
    });

    return { synced };
  }

  // === 4.5 Proxy Playback Toggle ===
  toggleProxy() {
    this.proxyEnabled = !this.proxyEnabled;
    return this.proxyEnabled;
  }

  isProxyEnabled() {
    return this.proxyEnabled;
  }

  // === 4.6 Multiple Timeline Tabs ===
  addTimelineTab(name) {
    const tab = {
      id: `tab-${Date.now()}`,
      name: name || `Edit ${this.timelineTabs.length + 1}`,
      active: false
    };
    this.timelineTabs.push(tab);
    return tab;
  }

  removeTimelineTab(tabId) {
    if (this.timelineTabs.length <= 1) return false;
    this.timelineTabs = this.timelineTabs.filter(t => t.id !== tabId);
    if (this.activeTabId === tabId) {
      this.activeTabId = this.timelineTabs[0].id;
    }
    return true;
  }

  setActiveTab(tabId) {
    this.timelineTabs.forEach(t => t.active = (t.id === tabId));
    this.activeTabId = tabId;
  }

  // === 4.7 Music Generation Presets ===
  setMusicGenParams(params) {
    Object.assign(this.musicGen, params);
  }

  getMusicPresets() {
    return {
      genres: ['Cinematic', 'Electronic', 'Jazz', 'Rock', 'Classical', 'Ambient', 'Hip Hop', 'Pop'],
      moods: ['Uplifting', 'Dark', 'Energetic', 'Calm', 'Tense', 'Happy', 'Melancholic', 'Epic'],
      styles: ['Orchestral', 'Minimal', 'Lo-fi', 'Synthwave', 'Acoustic', 'Orchestral', 'Chill'],
      tempos: [
        { id: 'slow', label: 'Slow (60-80 BPM)', min: 60, max: 80 },
        { id: 'medium', label: 'Medium (90-120 BPM)', min: 90, max: 120 },
        { id: 'fast', label: 'Fast (130-160 BPM)', min: 130, max: 160 }
      ]
    };
  }

  // === 4.8 Instrumental Toggle ===
  toggleInstrumental() {
    this.musicGen.instrumental = !this.musicGen.instrumental;
    return this.musicGen.instrumental;
  }

  // === 4.9 Duration Snapping ===
  snapDuration(requestedDuration, clipDuration) {
    // Snap to nearest sensible duration
    const snapPoints = [5, 10, 15, 20, 30];
    const target = Math.min(requestedDuration, clipDuration);
    let closest = snapPoints[0];
    let minDist = Math.abs(target - closest);

    for (const point of snapPoints) {
      const dist = Math.abs(target - point);
      if (dist < minDist) {
        minDist = dist;
        closest = point;
      }
    }

    return closest;
  }

  // === 4.10 Horizontal/Vertical Flip ===
  toggleFlip(clipId, direction) {
    const clip = this._findClip(clipId);
    if (!clip) return null;

    if (!clip.transform) clip.transform = {};

    if (direction === 'horizontal') {
      clip.transform.flipH = !clip.transform.flipH;
      return clip.transform.flipH;
    } else if (direction === 'vertical') {
      clip.transform.flipV = !clip.transform.flipV;
      return clip.transform.flipV;
    }
    return null;
  }

  // === 4.11 Speed Adjustment ===
  setClipSpeed(clipId, speed) {
    const clip = this._findClip(clipId);
    if (!clip) return null;

    // Clamp to 0.1x–2x range
    clip.playbackRate = Math.max(0.1, Math.min(2, speed));
    return clip.playbackRate;
  }

  getSpeedPresets() {
    return [
      { value: 0.25, label: '0.25x (Slow)' },
      { value: 0.5, label: '0.5x' },
      { value: 0.75, label: '0.75x' },
      { value: 1, label: '1x (Normal)' },
      { value: 1.25, label: '1.25x' },
      { value: 1.5, label: '1.5x' },
      { value: 2, label: '2x (Fast)' }
    ];
  }

  _findClip(clipId) {
    for (const track of this.state.tracks || []) {
      const clip = (track.clips || []).find(c => c.id === clipId);
      if (clip) return clip;
    }
    return null;
  }
}

export default EditPageFeatures;
