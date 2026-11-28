// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { trapFocus, focusables } from '../focusTrap.js';

const tab = (shift = false) => { const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true }); document.dispatchEvent(e); return e; };
function setup() {
  document.body.innerHTML = '<button id="opener">open</button><div id="dlg"><button id="a">A</button><input id="b"><button id="c">C</button></div><button id="outside">out</button>';
  const opener = document.getElementById('opener'); opener.focus();
  return { opener, dlg: document.getElementById('dlg') };
}

describe('focus trap', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  it('puts focus in the dialog, keeps Tab inside it both ways, and gives focus back on release', () => {
    const { opener, dlg } = setup();
    const release = trapFocus(dlg);
    expect(document.activeElement.id).toBe('a');
    document.getElementById('c').focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement.id).toBe('a'); // wrapped from the last to the first
    expect(tab(true).defaultPrevented).toBe(true);
    expect(document.activeElement.id).toBe('c'); // and back
    document.getElementById('b').focus();
    expect(tab().defaultPrevented).toBe(false); // in the middle the browser moves focus itself
    release();
    expect(document.activeElement).toBe(opener);
    document.getElementById('c').focus();
    expect(tab().defaultPrevented).toBe(false); // no longer trapped
  });
  it('pulls focus back in if it somehow ended up outside', () => {
    const { dlg } = setup();
    trapFocus(dlg);
    document.getElementById('outside').focus();
    tab();
    expect(dlg.contains(document.activeElement)).toBe(true);
  });
  it('starts on the control you name, and skips disabled and hidden ones', () => {
    const { dlg } = setup();
    document.getElementById('a').disabled = true;
    document.getElementById('c').hidden = true;
    expect(focusables(dlg).map((n) => n.id)).toEqual(['b']);
    trapFocus(dlg, { initial: document.getElementById('b') });
    expect(document.activeElement.id).toBe('b');
  });
  it('handles a dialog with nothing to focus, and releasing twice', () => {
    document.body.innerHTML = '<div id="dlg"><p>just text</p></div>';
    const dlg = document.getElementById('dlg');
    const release = trapFocus(dlg);
    expect(document.activeElement).toBe(dlg);
    expect(tab().defaultPrevented).toBe(true);
    release(); release();
  });
});
