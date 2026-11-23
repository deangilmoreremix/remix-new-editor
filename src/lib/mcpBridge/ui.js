// The "Let MCP control this tab" switch and the consent dialog. Plain DOM, no framework, no dependencies.
const PILL_ID = 'mcp-bridge-pill';

const css = `
#${PILL_ID}{position:fixed;left:14px;bottom:14px;z-index:2147483000;font:600 12px/1.2 system-ui,sans-serif;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:#14151a;color:#e8e8ee;border:1px solid rgba(255,255,255,.14);box-shadow:0 4px 18px rgba(0,0,0,.4);cursor:pointer}
#${PILL_ID}[data-on="true"]{border-color:#34d399}
#${PILL_ID} i{width:8px;height:8px;border-radius:50%;background:#6b7280;display:inline-block}
#${PILL_ID}[data-on="true"] i{background:#34d399}
#${PILL_ID}[data-error="true"] i{background:#f87171}
.mcp-bridge-modal{position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;font:14px/1.45 system-ui,sans-serif}
.mcp-bridge-modal>div{max-width:440px;width:100%;background:#17181d;color:#e8e8ee;border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:18px}
.mcp-bridge-modal h3{margin:0 0 6px;font-size:15px}
.mcp-bridge-modal code{display:block;margin:8px 0;padding:8px;border-radius:8px;background:#0e0f13;font-size:12px;max-height:120px;overflow:auto;white-space:pre-wrap;word-break:break-word}
.mcp-bridge-modal .row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px}
.mcp-bridge-modal button{padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:#23242b;color:#e8e8ee;font-weight:600;cursor:pointer}
.mcp-bridge-modal button.primary{background:#fff;color:#000}
`;

const RISK_TEXT = { write: 'change something', destructive: 'delete or overwrite something', publish: 'publish or send something' };

/** Ask the user about one tool call. Resolves 'once' | 'all' | 'no'. Closing the dialog is "no". */
export function askConsent({ tool, description, risk, args }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'mcp-bridge-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    const box = document.createElement('div');
    const h = document.createElement('h3');
    h.textContent = 'An MCP client wants to use this tab';
    const p = document.createElement('p');
    p.textContent = `It wants to ${RISK_TEXT[risk] || 'change something'}: ${String(tool).replace(/_/g, ' ')}.${description ? ' ' + description : ''}`;
    const code = document.createElement('code');
    let shown = '';
    try { shown = JSON.stringify(args ?? {}, null, 1).slice(0, 600); } catch { shown = ''; }
    code.textContent = shown;
    const row = document.createElement('div');
    row.className = 'row';
    const done = (v) => { overlay.remove(); resolve(v); };
    const mk = (label, v, cls) => { const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.addEventListener('click', () => done(v)); return b; };
    row.append(mk('No', 'no'), mk('Allow all in this tab', 'all'), mk('Allow once', 'once', 'primary'));
    box.append(h, p, code, row);
    overlay.append(box);
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') done('no'); });
    document.body.appendChild(overlay);
    row.lastChild.focus();
  });
}

export function mountBridgeUi({ bridge, onState }) {
  if (document.getElementById(PILL_ID)) return;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  const pill = document.createElement('button');
  pill.id = PILL_ID;
  pill.type = 'button';
  pill.innerHTML = '<i></i><span></span>';
  const text = pill.querySelector('span');
  const render = (s) => {
    pill.dataset.on = String(!!s.enabled);
    pill.dataset.error = String(!!s.error);
    text.textContent = s.enabled ? (s.error ? 'MCP control: reconnecting…' : s.allowAll ? 'MCP control on · no prompts' : 'MCP control on') : 'Let MCP control this tab';
    pill.title = s.enabled ? 'Click to switch MCP control off' : 'Lets an MCP client you have connected (Claude, Cursor…) use the tools of this studio. Off until you click.';
  };
  render(bridge.state());
  onState(render);
  pill.addEventListener('click', async () => {
    try { if (bridge.state().enabled) await bridge.disable(); else await bridge.enable(); } catch (e) { text.textContent = `MCP control unavailable: ${String(e.message).slice(0, 60)}`; }
  });
  document.body.appendChild(pill);
}
