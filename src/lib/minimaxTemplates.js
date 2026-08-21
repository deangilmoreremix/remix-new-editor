import { minimaxH3Demos, MINIMAX_MODEL } from '../data/beatapiMinimaxH3Demos.js';

export const minimaxH3Templates = minimaxH3Demos.map((demo) => ({
  id: `minimax-h3-${demo.slug}`,
  name: demo.title,
  model: MINIMAX_MODEL,
  modelType: ['UGC', 'Web / UI', 'Social'].includes(demo.category) ? 'i2v' : 't2v',
  aspectRatio: demo.aspectRatio,
  duration: demo.duration,
  basePrompt: demo.prompt || null,
  tags: demo.tags,
  category: demo.category,
  useCase: demo.useCase,
  posterSrc: demo.posterSrc,
  videoSrc: demo.videoSrc,
  sourceAuthor: demo.sourceAuthor,
  sourceUrl: demo.sourceUrl,
}));

export function getMinimaxTemplateById(id) {
  return minimaxH3Templates.find((template) => template.id === id);
}

export function getAllMinimaxTemplates() {
  return minimaxH3Templates;
}
