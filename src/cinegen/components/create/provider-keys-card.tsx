// [remix] Replaces CineGen's Topview/Higgsfield credit card: generation here runs on the user's own keys.
import { useEffect, useState } from 'react';
// @ts-expect-error plain JS helpers from the main app
import { byokHeaders } from '../../../lib/editor/agent/audioGen.js';
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';

function keyState() {
  try {
    const h = byokHeaders() as Record<string, string>;
    return { muapi: Boolean(h['X-MuAPI-Key']), openai: Boolean(h['X-OpenAI-Key']) };
  } catch {
    return { muapi: false, openai: false };
  }
}

export function ProviderKeysCard() {
  const { state } = useWorkspace();
  const [keys, setKeys] = useState(keyState);
  useEffect(() => {
    const refresh = () => setKeys(keyState());
    window.addEventListener('focus', refresh);
    window.addEventListener('cinegen:settings-changed', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('cinegen:settings-changed', refresh); };
  }, []);
  const generated = state.assets.filter((a) => a.metadata?.generationProvider).length;
  const row = (label: string, ok: boolean) => (
    <div className="cs-provider-budget__metric">
      <span>{label}</span>
      <strong style={{ color: ok ? 'var(--success)' : 'var(--text-tertiary)' }}>{ok ? 'Key added' : 'No key'}</strong>
    </div>
  );
  return (
    <section className="cs-provider-budget" aria-label="Providers">
      <div className="cs-provider-budget__head">
        <div className="cs-provider-budget__identity">
          <span className="cs-provider-budget__status" />
          <div><span>Providers</span><strong>MuAPI · OpenAI</strong></div>
        </div>
      </div>
      <div className="cs-provider-budget__metrics">
        {row('MuAPI (video, music)', keys.muapi)}
        {row('OpenAI (images, chat)', keys.openai)}
        <div className="cs-provider-budget__metric"><span>Generated in project</span><strong>{generated}</strong></div>
      </div>
    </section>
  );
}
