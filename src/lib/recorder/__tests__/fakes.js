// Fakes for the browser capture APIs (jsdom has none). Shared by the recorder tests.
export class FakeTrack extends globalThis.EventTarget {
  constructor(kind) { super(); this.kind = kind; this.stopped = false; FakeTrack.all.push(this); }
  stop() { this.stopped = true; }
  end() { this.stop(); this.dispatchEvent(new Event('ended')); }
}
FakeTrack.all = [];

export class FakeStream {
  constructor(tracks = []) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
}

const dataEvent = (data) => Object.assign(new Event('dataavailable'), { data });

export class FakeRecorder extends globalThis.EventTarget {
  static supported = new Set(['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1', 'audio/webm;codecs=opus']);
  static isTypeSupported(t) { return FakeRecorder.supported.has(t); }
  constructor(stream, options) { super(); this.stream = stream; this.options = options; this.state = 'inactive'; FakeRecorder.all.push(this); }
  start(timeslice) { this.timeslice = timeslice; this.state = 'recording'; }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
  flush(text = 'x') { this.dispatchEvent(dataEvent(new Blob([text]))); }
  stop() { this.state = 'inactive'; globalThis.queueMicrotask(() => this.dispatchEvent(dataEvent(new Blob(['end'])))); }
}
FakeRecorder.all = [];

// A minimal origin-private file system: enough for createFileStorage.
export function fakeOpfs() {
  const files = new Map();
  const dir = {
    async getFileHandle(name) {
      return {
        async createWritable() {
          const parts = [];
          return {
            async write({ data }) { parts.push(data); files.set(name, parts); },
            async close() {},
          };
        },
        async getFile() {
          const parts = files.get(name) || [];
          // jsdom Blobs have no arrayBuffer(); give the stored bytes a minimal File-like shape.
          const text = (await Promise.all(parts.map((p) => blobText(p)))).join('');
          return { arrayBuffer: async () => new TextEncoder().encode(text).buffer };
        },
      };
    },
    async removeEntry(name) { files.delete(name); },
  };
  return { storage: { getDirectory: async () => dir }, files };
}

export const blobText = (b) => new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsText(b); });
