// [remix] Edit a Smart Text overlay in place on the video (double-click it). The text is edited with the same chips for {{tokens}} as
// the inspector's box; Enter (or clicking away) keeps the change, Shift+Enter adds a line, Esc cancels.
// @ts-expect-error plain JS token chip helpers shared with the inspector
import { tokensToHtml, htmlToTokens } from '../../../lib/editor/addons/tokenChips.js';

/** Starts editing the overlay element's text. Returns a function that ends the edit (keeping the change), or null when it has no text. */
export function beginInlineTextEdit(el: HTMLElement, text: string, onCommit: (text: string) => void): (() => void) | null {
  const span = el.querySelector<HTMLElement>('.personalizer-input');
  if (!span || span.getAttribute('contenteditable') === 'true') return null;
  const saved = span.innerHTML;
  span.setAttribute('contenteditable', 'true');
  span.spellcheck = false;
  span.classList.add('is-editing');
  span.innerHTML = tokensToHtml(text);
  span.focus();
  const sel = el.ownerDocument.getSelection();
  if (sel) { const r = el.ownerDocument.createRange(); r.selectNodeContents(span); sel.removeAllRanges(); sel.addRange(r); }

  let done = false;
  const finish = (keep: boolean) => {
    if (done) return;
    done = true;
    span.removeEventListener('keydown', onKey);
    span.removeEventListener('blur', onBlur);
    span.removeEventListener('pointerdown', stop);
    span.removeEventListener('paste', onPaste);
    span.setAttribute('contenteditable', 'false');
    span.classList.remove('is-editing');
    const value = htmlToTokens(span);
    if (keep && value !== text) onCommit(value); // the overlay is rebuilt from the new text
    else span.innerHTML = saved;
  };
  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation(); // Space / E / V / Backspace are typing here, not editor shortcuts
    if (e.key === 'Escape') { e.preventDefault(); finish(false); } else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
  };
  const onBlur = () => finish(true);
  const stop = (e: Event) => e.stopPropagation(); // the move / resize handles must not take the click that places the cursor
  const onPaste = (e: ClipboardEvent) => { e.preventDefault(); el.ownerDocument.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? ''); };
  span.addEventListener('keydown', onKey);
  span.addEventListener('blur', onBlur);
  span.addEventListener('pointerdown', stop);
  span.addEventListener('paste', onPaste);
  return () => finish(true);
}
