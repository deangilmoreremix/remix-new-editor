// [remix] Asset picker (Leads tab): this business's saved assets, assigned to the video's image slots.
import { useMemo, useState } from 'react';
import { assetState, slotStatus, type LibAsset } from '@cinegen/lib/leads/personalize-writeback';
import type { BusinessLibrary } from './use-business-library';

const CATEGORIES = ['all', 'logo', 'image', 'product', 'service', 'team', 'premises', 'website'] as const;
const ORIGIN_LABEL: Record<string, string> = { discovered: 'Found on website', uploaded: 'Uploaded', 'ai-generated': 'AI-generated' };

export function AssetPicker({ lib, usedUrls = new Set<string>() }: { lib: BusinessLibrary; usedUrls?: Set<string> }) {
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('all');
  const [pick, setPick] = useState<string | null>(null); // asset id waiting for a slot
  const [confirm, setConfirm] = useState<{ slot: string; assetId: string } | null>(null);
  const assignedIds = useMemo(() => new Set(lib.assignments.map((a) => a.asset_id).filter(Boolean) as string[]), [lib.assignments]);
  const shown = lib.assets.filter((a) => cat === 'all' || a.category === cat);
  const slotLabel = (slot: string) => lib.slots.find((s) => s.slot === slot)?.label ?? slot;

  if (lib.unavailable) return <section className="leads-card" data-testid="asset-picker"><h3 className="leads-card__title">Business assets</h3><p className="leads-note" data-testid="picker-unavailable">The business asset library is not installed on this project yet (database upgrade pending).</p></section>;

  return (
    <section className="leads-card" data-testid="asset-picker">
      <h3 className="leads-card__title">Business assets{lib.business && <span className="leads-pill" data-testid="picker-business">{lib.business.name}</span>}</h3>
      {!lib.signedIn && <p className="leads-note" data-testid="picker-signin">Sign in to save and reuse business assets.</p>}
      {lib.signedIn && !lib.business && (
        <div className="leads-row"><p className="leads-note" data-testid="picker-nobiz">Select or add a business to see its saved assets.</p>
          <button type="button" className="leads-btn leads-btn--primary" onClick={() => void lib.findMore()} data-testid="picker-find-business">Find a business</button></div>
      )}
      {lib.business && (
        <>
          <div className="leads-slots" data-testid="picker-slots">
            {lib.slots.length === 0 && <p className="leads-note">This video has no Personalized Image overlays. Add one from the Elements tab to place a logo or photo.</p>}
            {lib.slots.map((s) => {
              const st = slotStatus(s, lib.assignments, lib.assets);
              const a = lib.assignments.find((x) => x.slot === s.slot);
              const asset = a && lib.assets.find((x) => x.id === a.asset_id);
              return (
                <div key={s.slot} className="leads-slot" data-testid={`slot-${s.slot}`} data-status={st}>
                  <b>{s.label}</b>
                  <span className={`leads-tag leads-tag--${st === 'missing' ? 'wall' : 'lead'}`}>{st === 'filled' ? (a?.manual ? 'Chosen by you' : 'Auto') : st === 'fallback' ? 'Using fallback' : 'Missing'}</span>
                  {asset && <img className="leads-thumb leads-thumb--sm" src={asset.thumb_url || asset.storage_url} alt={`${s.label} for ${lib.business?.name}`} />}
                  {st === 'missing' && <span className="leads-note">No {s.label} yet: search again, upload, or pick a saved one below.</span>}
                  {asset && <button type="button" className="leads-x" aria-label={`Clear ${s.label}`} onClick={() => void lib.clear(s.slot)}>✕</button>}
                </div>
              );
            })}
          </div>
          <div className="leads-chips" role="tablist" aria-label="Asset category">
            {CATEGORIES.map((c) => <button key={c} type="button" role="tab" aria-selected={cat === c} className={`leads-chip${cat === c ? ' is-on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
          </div>
          {shown.length === 0 && <p className="leads-note" data-testid="picker-empty">No saved {cat === 'all' ? '' : `${cat} `}assets for {lib.business.name}. Find more on their website or upload one.</p>}
          <div className="leads-grid" data-testid="picker-grid">
            {shown.map((a: LibAsset) => {
              const st = assetState(a, assignedIds, usedUrls);
              return (
                <div key={a.id} className={`leads-asset${pick === a.id ? ' is-picked' : ''}`} data-testid={`asset-${a.id}`} data-state={st}>
                  <img className="leads-thumb" src={a.thumb_url || a.storage_url} alt={a.meta?.name || `${a.category} asset`} loading="lazy" />
                  <div className="leads-asset__meta"><span className={`leads-tag leads-tag--${st === 'discovered' ? 'wall' : 'lead'}`} data-testid={`state-${a.id}`}>{st}</span><span className="leads-note">{ORIGIN_LABEL[a.origin] ?? a.origin}</span></div>
                  <div className="leads-row">
                    <button type="button" className="leads-btn" disabled={lib.busy || lib.slots.length === 0} onClick={() => setPick(pick === a.id ? null : a.id)} data-testid={`use-${a.id}`}>{assignedIds.has(a.id) ? 'Reassign' : 'Use as…'}</button>
                    <button type="button" className="leads-x" aria-label="Remove from library" disabled={lib.busy} onClick={() => void lib.remove(a.id)} data-testid={`remove-${a.id}`}>✕</button>
                  </div>
                  {pick === a.id && (
                    <div className="leads-chips" data-testid={`slots-for-${a.id}`}>
                      {lib.slots.map((s) => (
                        <button key={s.slot} type="button" className="leads-chip" data-testid={`assign-${a.id}-${s.slot}`} onClick={async () => {
                          const cur = lib.assignments.find((x) => x.slot === s.slot);
                          // replacing an image the user chose needs an explicit yes
                          if (cur?.manual && cur.asset_id && cur.asset_id !== a.id) { setConfirm({ slot: s.slot, assetId: a.id }); return; }
                          if (await lib.assign(s.slot, a.id, { manual: true })) setPick(null);
                        }}>{s.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {confirm && (
            <div className="leads-note" role="alertdialog" data-testid="replace-confirm">
              Replace the {slotLabel(confirm.slot)} you chose?{' '}
              <button type="button" className="leads-btn leads-btn--primary" data-testid="replace-yes" onClick={async () => { if (await lib.assign(confirm.slot, confirm.assetId, { manual: true })) { setPick(null); } setConfirm(null); }}>Replace</button>{' '}
              <button type="button" className="leads-btn" onClick={() => setConfirm(null)}>Keep current</button>
            </div>
          )}
          <div className="leads-row">
            <button type="button" className="leads-btn leads-btn--primary" disabled={lib.busy} onClick={() => void lib.findMore()} data-testid="picker-find">Find more assets</button>
            <label className="leads-btn" data-testid="picker-upload-label">Upload image
              <input type="file" accept="image/*" hidden data-testid="picker-upload" onChange={(e) => { const f = e.target.files?.[0]; if (f) void lib.upload(f, cat === 'all' ? 'image' : cat); e.target.value = ''; }} />
            </label>
          </div>
        </>
      )}
      {lib.notice && <p className="leads-note" role="status" data-testid="picker-notice">{lib.notice}</p>}
      {lib.error && <p className="leads-error" role="alert" data-testid="picker-error">{lib.error}</p>}
    </section>
  );
}
