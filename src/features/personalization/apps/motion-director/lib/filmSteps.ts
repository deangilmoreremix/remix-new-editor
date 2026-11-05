/**
 * The seven steps of a Motion Director film, as the chat shows them:
 * Product → Capture → Storyboard → Animate → Beat sync → Frame QA → Deliver.
 * Plain data so the hook, the chat UI and tests share one definition.
 */
export type FilmStepId = 'product' | 'capture' | 'storyboard' | 'animate' | 'beat' | 'qa' | 'deliver';
export type FilmStepState = 'todo' | 'active' | 'done' | 'skipped' | 'error';

export interface FilmStep {
  id: FilmStepId;
  title: string;
  sub: string;
  state: FilmStepState;
  /** What happened in this step (e.g. "6 card crops · logo · 4 site images"). */
  detail?: string;
}

export const FILM_STEPS: ReadonlyArray<Pick<FilmStep, 'id' | 'title' | 'sub'>> = [
  { id: 'product', title: 'Product', sub: 'Your web page' },
  { id: 'capture', title: 'Capture', sub: 'Real page assets' },
  { id: 'storyboard', title: 'Storyboard', sub: 'Shot recipe cards' },
  { id: 'animate', title: 'Animate', sub: 'Remotion code' },
  { id: 'beat', title: 'Beat sync', sub: 'Sound design' },
  { id: 'qa', title: 'Frame QA', sub: 'Render + inspect' },
  { id: 'deliver', title: 'Deliver', sub: 'Editable outputs' },
];

export const initialSteps = (): FilmStep[] => FILM_STEPS.map((s) => ({ ...s, state: 'todo' }));

/** Set one step's state (and detail), leaving the others as they are. */
export const markStep = (steps: FilmStep[], id: FilmStepId, state: FilmStepState, detail?: string): FilmStep[] =>
  steps.map((s) => (s.id === id ? { ...s, state, detail: detail ?? (state === s.state ? s.detail : undefined) } : s));
