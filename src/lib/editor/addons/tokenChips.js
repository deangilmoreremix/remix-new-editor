/**
 * Smart Text editing box: personalization tokens shown as chips, like upstream's
 * contentEditable text area (lib/utils/tokens-helper.js wrapTokens / unwrapTokens).
 *
 * The stored value stays a plain string with {{tokens}}, so saved projects, the
 * published player and the export are unchanged: only the editing box differs.
 */

// Same pattern as upstream lib/constants/tokens.js TOKEN_REGEX: {{name}}, {{up name}}, {{d name "fallback"}}.
const TOKEN_RE = /\{\{(up \w+|d \w+ (?:"[^{}]*"|'[^{}]*')|"\w+"|\w+)\}\}/g;

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => escHtml(s).replace(/"/g, '&quot;');
const textHtml = (s) => escHtml(s).replace(/\n/g, '<br>');

/** Plain text with {{tokens}} -> HTML for the editing box (tokens become non-editable chips). */
export function tokensToHtml(text) {
  const src = String(text ?? '');
  let out = '';
  let last = 0;
  for (const m of src.matchAll(TOKEN_RE)) {
    out += textHtml(src.slice(last, m.index));
    const parts = m[1].split(' ');
    const helper = parts.length > 1 ? parts[0] : '';
    const name = parts.length > 1 ? parts[1] : m[1].replace(/"/g, '');
    const cls = helper === 'up' ? ' token-uppercase' : helper === 'd' ? ' token-default' : '';
    out += `<span class="personalized-token${cls}" contenteditable="false" data-token="${escAttr(m[0])}">${escHtml(name)}</span>`;
    last = m.index + m[0].length;
  }
  return out + textHtml(src.slice(last));
}

const isBlock = (n) => n.nodeType === 1 && (n.tagName === 'DIV' || n.tagName === 'P');

/** The editing box -> plain text with {{tokens}}. Handles the <div>/<br> line breaks browsers insert on Enter. */
export function htmlToTokens(root) {
  const lines = [''];
  const push = (t) => { lines[lines.length - 1] += t; };
  const newLine = () => lines.push('');
  // index of a line opened by entering a block that nothing has been written to or closed yet (so a nested block reuses it)
  let fresh = -1;
  const walk = (node) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) push(String(n.nodeValue).replace(/ /g, ' '));
      else if (n.nodeType === 1) {
        if (n.dataset && n.dataset.token != null) push(n.dataset.token);
        else if (n.tagName === 'BR') {
          // a <br> that only holds an empty block open is not a line break of its own
          const sole = isBlock(node) && node.childNodes.length === 1;
          if (!sole) newLine();
        } else if (isBlock(n)) {
          const at = lines.length - 1;
          const reuse = lines[at] === '' && (at === 0 || fresh === at);
          if (!reuse) newLine();
          fresh = lines.length - 1;
          walk(n);
          fresh = -1;
        } else walk(n);
      }
    }
  };
  walk(root);
  return lines.join('\n');
}

/** A chip element for a token key such as "firstName" (used when the Personalize menu inserts one). */
export function tokenChip(doc, key) {
  const span = doc.createElement('span');
  span.className = 'personalized-token';
  span.contentEditable = 'false';
  span.dataset.token = `{{${key}}}`;
  span.textContent = String(key).replace(/^(up|d) /, '').split(' ')[0];
  return span;
}
