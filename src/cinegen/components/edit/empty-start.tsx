// [remix] What a brand-new project shows in the viewer: three big ways to start, instead of a black screen. Each one opens something that
// already exists (the import picker, the template video browser, the Template Generator wizard).
import { openAddToTimeline } from './add-to-timeline-registry';
import { IMPORT_MEDIA_EVENT, OPEN_GENERATOR_EVENT } from './start-events';

const ACTIONS: Array<{ id: string; icon: string; title: string; text: string; run: () => void }> = [
  { id: 'import', icon: '⬆', title: 'Add your video', text: 'Upload a video, photo or sound from your computer.', run: () => { window.dispatchEvent(new CustomEvent(IMPORT_MEDIA_EVENT)); } },
  { id: 'videos', icon: '🎬', title: 'Pick a template video', text: 'Start from a ready-made AI video clip. Pictures and sound show right on the timeline.', run: () => { openAddToTimeline('videos'); } },
  { id: 'generator', icon: '✨', title: 'Make a video for me', text: 'Answer a few questions and get a finished timeline with text, forms and buttons.', run: () => { window.dispatchEvent(new CustomEvent(OPEN_GENERATOR_EVENT)); } },
];

export function EmptyStart() {
  return (
    <div className="empty-start" data-testid="empty-start" role="region" aria-label="Start your video">
      <div className="empty-start__title">Start your video</div>
      <div className="empty-start__sub">Pick one. You can add animations, overlays, sounds and more from the Library on the left at any time.</div>
      <div className="empty-start__row">
        {ACTIONS.map((a) => (
          <button key={a.id} type="button" className="empty-start__card" data-testid={`empty-start-${a.id}`} onClick={a.run}>
            <span className="empty-start__icon" aria-hidden="true">{a.icon}</span>
            <strong>{a.title}</strong>
            <span>{a.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
