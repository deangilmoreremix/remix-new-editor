// The editor's "Enhanced Recorder" used to be a mock-up that never captured anything (no camera,
// screen or microphone, and no file at the end). It now opens the real recorder, which has everything
// it advertised: screen, camera, both and audio, drawing, effects, teleprompter, audio settings and trim.
// Kept as its own name so the editor (a protected file) keeps importing it unchanged.
import { RecorderModal } from './RecorderModal.jsx';

export class EnhancedRecorderModal extends RecorderModal {}

export default EnhancedRecorderModal;
