// [remix] "Leads (n)" strip on a form's settings: count from the published video + a jump to the Leads tab filtered to this form.
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import { countsByForm, WALL_KEY } from '@cinegen/lib/leads/leads';
import { setLeadsForm } from '@cinegen/lib/leads/leads-filter';
import { useLeads } from './use-leads';
import { usePublished } from './use-publish';

export function FormLeadsButton({ overlayId, type }: { overlayId: string; type: string }) {
  const { dispatch } = useWorkspace();
  const pub = usePublished();
  const data = useLeads(pub.id, !!pub.info);
  const key = type === 'list-builder' ? WALL_KEY : overlayId;
  const go = (form: string) => { setLeadsForm(form); dispatch({ type: 'SET_TAB', tab: 'leads' }); };
  const n = countsByForm(data.rows)[key] ?? 0;
  return (
    <div className="form-leads" data-testid="form-leads" style={{ margin: '0 12px 10px', padding: 8, border: '1px solid var(--border-medium,rgba(255,255,255,.18))', borderRadius: 8, fontSize: 11, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
      {pub.info ? (
        <><span>{n} {n === 1 ? 'lead' : 'leads'} from this form</span><button type="button" className="mini-btn" onClick={() => go(key)}>Leads ({n}) →</button></>
      ) : (
        <><span>Publish this video to start collecting leads. Editor submissions are tests.</span><button type="button" className="mini-btn" onClick={() => go('all')}>Publish…</button></>
      )}
    </div>
  );
}
