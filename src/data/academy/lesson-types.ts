// Shared Lesson type for the AI Creator Academy rich LEARN view.
// Consumed by src/data/academy/lessons.ts (track 01) and the per-track
// files in src/data/academy/lessons/*.ts. Keep this the single source of truth
// for the shape — AcademyPage matches rich lessons to catalog lessons by `id`.

export interface Lesson {
  id: string;
  slug: string;
  order: number;
  title: string;
  summary: string;
  time: string;
  prerequisites: string[];
  /** The framing problem the lesson solves. */
  problem: string;
  /** Core mental model, as bullet points. */
  concept: string[];
  /** Concrete steps the reader should perform. */
  doIt: string[];
  /** How to monetize / ship the skill. */
  launchIt: string[];
  /** Practice prompts. */
  exercises: string[];
  relatedTemplateIds: string[];
  relatedAssetIds: string[];
}
