// Helpers shared by the tour definitions.

/** Target function: the first visible element matching `selector` whose text matches `re`. */
export const byText = (selector, re) => (root = document) =>
  [...root.querySelectorAll(selector)].find((el) => re.test(el.textContent || '')) || null;

/** The studio banner that createStudioHeader() puts at the top of every studio. */
export const header = (id) => [`[data-studio-header="${id}"]`, `[data-studio="${id}"] h1`];

/** Link to the Academy lesson list for a studio (see src/data/askAcademyMap.js). */
export const academy = (href = '#/academy', label = 'Learn more in the Academy') => ({ href, label });
