'use client';

import { Loader2 } from 'lucide-react';
import type { LocalAI } from '../localAI/useLocalAI';
import { C, hintStyle, primaryButtonStyle, secondaryButtonStyle, softPanelStyle } from './tokens';

/**
 * The shared notice for a free in-browser AI action: what it does, the ONE-TIME download (size and licence) before
 * anything is fetched, then progress with Cancel, or a plain error. Renders nothing while idle.
 */
export function LocalAINotice({ ai, doing }: { ai: LocalAI; doing: string }): React.JSX.Element | null {
  if (ai.phase === 'idle') return null;
  const size = ai.info ? `${ai.info.sizeMB < 10 ? ai.info.sizeMB : Math.round(ai.info.sizeMB)} MB` : 'a small model';
  return (
    <div data-testid="local-ai-notice" data-phase={ai.phase} role="status" style={{ ...softPanelStyle, marginTop: 8, display: 'grid', gap: 8 }}>
      {ai.phase === 'confirm' && (
        <>
          <p style={{ ...hintStyle, margin: 0, color: C.text }}>
            <strong>{ai.info?.label ?? 'Free on-device AI'}</strong> {doing}. It runs on <strong>this device</strong>, not on a server, and costs nothing.
            It needs a <strong>one-time download of about {size}</strong> ({ai.info?.license ?? 'open licence'}), then it is kept in this browser.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" data-testid="local-ai-confirm" onClick={ai.confirm} style={{ ...primaryButtonStyle, minHeight: 30, fontSize: 11 }}>Download and continue</button>
            <button type="button" data-testid="local-ai-decline" onClick={ai.cancel} style={{ ...secondaryButtonStyle, minHeight: 30, fontSize: 11 }}>Not now</button>
          </div>
        </>
      )}
      {ai.phase === 'running' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Loader2 size={13} className="animate-spin" color={C.cyan} />
          <span style={{ fontSize: 11, color: C.text }}>{ai.message ?? 'Working…'}{typeof ai.progress === 'number' ? ` ${Math.round(ai.progress * 100)}%` : ''}</span>
          <button type="button" data-testid="local-ai-cancel" onClick={ai.cancel} style={{ ...secondaryButtonStyle, minHeight: 26, fontSize: 10, padding: '0 10px' }}>Cancel</button>
        </div>
      )}
      {ai.phase === 'error' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span data-testid="local-ai-error" style={{ fontSize: 11, color: C.danger }}>{ai.error}</span>
          <button type="button" onClick={ai.dismiss} style={{ ...secondaryButtonStyle, minHeight: 26, fontSize: 10, padding: '0 10px' }}>Close</button>
        </div>
      )}
    </div>
  );
}
