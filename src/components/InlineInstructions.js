// Studios open straight onto the working tool. The "1-2-3 how it works"
// step cards and Quick Tips used to sit above or around the tool and made each
// studio read like a marketing landing page, so they are no longer rendered.
//
// This still returns an element because callers add classes to it and some
// studios (Cinema, Audio) use it as an insertBefore() anchor.
export function createInlineInstructions(studioId) {
  const placeholder = document.createElement('div');
  placeholder.className = 'hidden';
  placeholder.setAttribute('data-inline-instructions', studioId || '');
  placeholder.setAttribute('aria-hidden', 'true');
  return placeholder;
}
