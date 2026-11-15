/**
 * Whether a keyboard event comes from somewhere the user is typing. Editor-wide
 * shortcuts that edit the timeline (Delete / Backspace remove the selected clip,
 * Ctrl+D duplicates it, Ctrl+Z undoes the timeline) must not fire there: they
 * would swallow the keystroke (the field could no longer be edited) and change
 * the timeline instead.
 */
export function isTypingTarget(target) {
  if (!target || typeof target !== 'object') return false;
  const tag = String(target.tagName || '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    // Buttons, checkboxes and range sliders do not take typed text.
    return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color', 'image'].includes(String(target.type || 'text').toLowerCase());
  }
  return !!target.isContentEditable;
}
